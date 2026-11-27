/**
 * Test de la rédaction du projet de santé avec Claude.
 *
 *   node tests/redaction.mjs
 *
 * Exécute le vrai code du script contre un classeur, un Drive et une API
 * Claude simulés, et vérifie :
 *   — que seule la console expert peut demander ou suivre une rédaction ;
 *   — que la demande joint le dossier (fiche, questionnaire, sources, modèle)
 *     et respecte les paramètres de l'API ;
 *   — que le chapitre reçu devient un Google Docs mis en forme, graphique compris ;
 *   — que le fil conducteur passe au chapitre suivant ;
 *   — que la validation est bornée et que le client ne voit rien des brouillons ;
 *   — que la liste des chapitres concorde avec celle de l'application.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CODE_EXPERT = 'code-expert-de-test';
const JETON_CLIENT = 'jetonclienttestabcdefgh';
const ID_DOSSIER = 'DOSSIERPROJET0123456789abcdef';

/* ---------------------------------------------------- Classeur simulé ---- */
function feuilleSimulee(nom, entetes, lignes) {
  const grille = [entetes.slice(), ...lignes.map((l) => {
    const c = l.slice();
    while (c.length < entetes.length) c.push('');
    return c;
  })];
  return {
    getName: () => nom,
    getDataRange: () => ({ getValues: () => grille.map((l) => l.slice()) }),
    getLastRow: () => grille.length,
    getLastColumn: () => entetes.length,
    getRange: (ligne, colonne) => ({
      setValue: (v) => { while (grille.length < ligne) grille.push(entetes.map(() => '')); grille[ligne - 1][colonne - 1] = v; },
      getValue: () => grille[ligne - 1][colonne - 1],
      setValues: (v) => { grille[ligne - 1] = v[0].slice(); return { setFontWeight: () => ({ setFontColor: () => ({ setBackground: () => {} }) }) }; },
    }),
    appendRow: (v) => {
      const c = v.slice();
      while (c.length < grille[0].length) c.push('');
      grille.push(c);
    },
    deleteRow: (l) => { grille.splice(l - 1, 1); },
    setFrozenRows: () => {},
    _grille: grille,
  };
}

/* ------------------------------------------------------- Drive simulé ---- */
const fichier = (id, nom, mimeType, contenu) => ({
  getId: () => id, getName: () => nom, getMimeType: () => mimeType,
  getBlob: () => ({ getBytes: () => Buffer.from(contenu), getDataAsString: () => contenu }),
});
const iterateur = (liste) => { let i = 0; return { hasNext: () => i < liste.length, next: () => liste[i++] }; };

const fichiersSources = [
  fichier('pdf1', 'CartoSanté — APL 2024.pdf', 'application/pdf', '%PDF-1.4 données APL'),
  fichier('gdoc1', 'Notes INSEE', 'application/vnd.google-apps.document', ''),
  fichier('docx1', 'Ancien projet.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'x'),
];
const sousDossier = (nom, fichiers) => ({ getName: () => nom, getFiles: () => iterateur(fichiers), getFolders: () => iterateur([]) });
const sourcesCh1 = sousDossier('Sources — Chapitre 1', [fichier('s1', 'Filosofi commune.pdf', 'application/pdf', '%PDF pauvreté')]);
const sourcesCh2 = sousDossier('Sources — Chapitre 2', [fichier('s2', 'Organigramme équipe.pdf', 'application/pdf', '%PDF équipe')]);
const sourcesCommun = sousDossier('Sources — Commun', [fichier('s0', 'Fiche commune.pdf', 'application/pdf', '%PDF commune')]);
const dossiersCrees = [];
const dossier01 = {
  getId: () => 'DOSSIER01', getName: () => '01 — Projet de santé',
  getFolders: () => iterateur([sourcesCh1, sourcesCh2, sourcesCommun]),
  createFolder: (n) => { dossiersCrees.push(n); },
  searchFiles: () => iterateur([fichier('logo1', 'logo MSP.png', 'image/png', 'PNG')]),
  getFiles: () => iterateur(fichiersSources), getUrl: () => 'https://drive.google.com/drive/folders/DOSSIER01',
};
const dossierProjet = {
  getId: () => ID_DOSSIER, getName: () => 'Projet',
  getFolders: () => iterateur([dossier01]), getFiles: () => iterateur([]),
  searchFiles: () => iterateur([]),
};

/* ------------------------------------------------ API Claude simulée ---- */
const appels = [];
const etatApi = { statutLot: 'in_progress', resultat: null, lots: 0 };
const REPONSE_CH1 = [
  '<chapitre><h1 class="x">1. Diagnostic territorial et contexte sanitaire</h1>',
  '<figure data-schema>{"titre":"Parcours patient diabétique d\'Atlantic","etapes":[{"titre":"Repérage","detail":"En officine","acteur":"Pharmacien"},{"titre":"Consultation","acteur":"Médecin traitant"}]}</figure>',
  '<h2>1.1. Territoire</h2><p onclick="mal()">La commune compte 12 000 habitants (INSEE, RP 2021).</p>',
  '<figure data-graphique=\'{"type":"barres","titre":"APL médecins généralistes","source":"CartoSanté 2024","categories":["Commune","Département","France"],"series":[{"nom":"APL","valeurs":[2.1,2.9,3.3]}]}\'></figure>',
  '<table><tr><th>Indicateur</th><th>Valeur</th></tr><tr><td>APL</td><td>2,1</td></tr></table>',
  '<blockquote><p><strong>Observations</strong> Offre inférieure au département.</p></blockquote>',
  '<script>alert(1)</script></chapitre>',
  '<fil>{"faits":["APL commune 2,1 (CartoSanté 2024)","Axe 1 : accès aux soins"]}</fil>',
  '<a_completer>Taux de pauvreté communal (INSEE Filosofi)</a_completer>',
].join('\n');

function reponse(code, corps) {
  const texte = typeof corps === 'string' ? corps : JSON.stringify(corps);
  return { getResponseCode: () => code, getContentText: () => texte };
}

const UrlFetchApp = {
  fetch(url, opts = {}) {
    appels.push({ url, opts });
    if (url.includes('/results')) return reponse(200, JSON.stringify({ custom_id: 'c', result: etatApi.resultat }) + '\n');
    if (url.startsWith('https://api.anthropic.com/v1/messages/batches')) {
      if (opts.headers?.['x-api-key'] !== 'sk-ant-test') return reponse(401, { error: { message: 'invalid x-api-key' } });
      if (opts.method === 'post') { etatApi.lots++; return reponse(200, { id: `msgbatch_${etatApi.lots}`, processing_status: 'in_progress' }); }
      return reponse(200, { id: 'msgbatch', processing_status: etatApi.statutLot, results_url: 'https://api.anthropic.com/v1/messages/batches/x/results' });
    }
    if (url.includes('/export?mimeType=')) {
      if (url.includes('gdoc1')) return reponse(200, 'Population : 12 000 habitants (INSEE, RP 2021).');
      return reponse(200, 'MODELE DE CHAPITRE — structure type.');
    }
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files')) {
      if (Buffer.from(opts.payload).toString().includes('PROJET DE SANTÉ')) {
        etatApi.finals = (etatApi.finals || 0) + 1;
        return reponse(200, { id: `docfinal${etatApi.finals}`, webViewLink: `https://docs.google.com/document/d/docfinal${etatApi.finals}/edit` });
      }
      return reponse(200, { id: 'docch1', webViewLink: 'https://docs.google.com/document/d/docch1/edit' });
    }
    return reponse(404, 'inconnu');
  },
};

/* -------------------------------------------------- DocumentApp simulé -- */
const T = { PARAGRAPH: 'PARAGRAPH', LIST_ITEM: 'LIST_ITEM', TABLE: 'TABLE', HORIZONTAL_RULE: 'HR', PAGE_BREAK: 'PB' };
const H = { NORMAL: 'N', HEADING1: 'H1', HEADING2: 'H2' };
const chaine = (o) => new Proxy(o, { get: (t, k) => (k in t ? t[k] : () => chaine(t)) });
function element(type, texte = '', titre = H.NORMAL) {
  const el = {
    type, texte, titre,
    getType: () => type, getText: () => texte, getHeading: () => el.titre, getNumChildren: () => 0,
    setHeading: (h) => { el.titre = h; return chaine(el); },
    editAsText: () => chaine({}),
    copy: () => element(type, texte, el.titre),
  };
  el.asParagraph = () => chaine(el); el.asListItem = () => el; el.asTable = () => el;
  return el;
}
function corpsSimule(enfants = []) {
  const c = {
    enfants, logo: false,
    getNumChildren: () => enfants.length, getChild: (i) => enfants[i],
    appendParagraph: (x) => { const e = typeof x === 'string' ? element(T.PARAGRAPH, x) : x; enfants.push(e); return chaine(e); },
    appendListItem: (x) => { enfants.push(x); return x; },
    appendTable: (x) => { enfants.push(x); return x; },
    appendPageBreak: () => { enfants.push(element(T.PAGE_BREAK)); },
    appendHorizontalRule: () => { enfants.push(element(T.HORIZONTAL_RULE)); },
    insertImage: (i) => { c.logo = true; return { getWidth: () => 400, getHeight: () => 200,
      setHeight: () => ({ setWidth: () => {} }), getParent: () => ({ asParagraph: () => ({ setAlignment: () => {} }) }) }; },
    getText: () => enfants.map((e) => e.texte).join('\n'),
  };
  return c;
}
const documents = {
  docch1: { corps: corpsSimule([
    element(T.PARAGRAPH, 'Projet de santé — MSP · document de travail rédigé le 01/11/2026'),
    element(T.PARAGRAPH, '1. Diagnostic territorial et contexte sanitaire', H.HEADING1),
    element(T.PARAGRAPH, '1.1. Territoire', H.HEADING2),
    element(T.PARAGRAPH, 'Taux de pauvreté : [donnée à compléter : taux — source à mobiliser : INSEE].'),
    element(T.TABLE, 'Indicateur | Valeur'),
    element(T.LIST_ITEM, 'Axe 1 : accès aux soins'),
  ]) },
};
const DocumentApp = {
  ElementType: T, ParagraphHeading: H, HorizontalAlignment: { CENTER: 'c' },
  openById: (id) => {
    if (!documents[id]) documents[id] = { corps: corpsSimule([element(T.PARAGRAPH, 'PROJET DE SANTÉ')]) };
    const d = documents[id];
    return { getBody: () => d.corps, getFooter: () => null,
      addFooter: () => ({ appendParagraph: (t) => { d.pied = t; return chaine({}); } }), saveAndClose: () => {} };
  },
};

/* ------------------------------------------------------- Charts simulé -- */
const chainable = () => {
  const o = {};
  ['setDataTable', 'setTitle', 'setDimensions', 'setColors', 'setLegendPosition'].forEach((m) => { o[m] = () => o; });
  o.build = () => ({ getAs: () => ({ getBytes: () => Buffer.from('PNG') }) });
  return o;
};
const Charts = {
  newDataTable: () => { const t = { addColumn: () => t, addRow: () => t, build: () => ({}) }; return t; },
  newColumnChart: chainable, newBarChart: chainable, newLineChart: chainable, newPieChart: chainable,
  ColumnType: { STRING: 's', NUMBER: 'n' }, Position: { BOTTOM: 'b' },
};

/* ------------------------------------------------------------ Script ---- */
const proprietes = new Map([['CODE_EXPERT', CODE_EXPERT]]);
const contexte = vm.createContext({
  SpreadsheetApp: { getActive: () => contexte.__classeur, flush: () => {} },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (k) => (proprietes.has(k) ? proprietes.get(k) : null),
      setProperty: (k, v) => proprietes.set(k, v),
    }),
  },
  ContentService: { createTextOutput: (s) => ({ setMimeType: () => ({ _texte: s }) }), MimeType: { JSON: 'json' } },
  Utilities: {
    formatDate: (d) => d.toISOString().slice(0, 10),
    getUuid: () => '0123-4567',
    base64Encode: (b) => Buffer.from(b).toString('base64'),
    newBlob: (s) => ({ getBytes: () => Buffer.from(String(s)) }),
  },
  DriveApp: {
    getFolderById: (id) => { if (id !== ID_DOSSIER) throw new Error('dossier inconnu'); return dossierProjet; },
    getFileById: (id) => {
      if (id === 'IMPORTCH4abcdefghijklmnopqrstuvwxyz') return { getId: () => id, getName: () => 'CH4 existant', getMimeType: () => 'application/vnd.google-apps.document', getUrl: () => `https://docs.google.com/document/d/${id}/edit` };
      if (id === 'IMPORTPDFabcdefghijklmnopqrstuvwxyz') return { getId: () => id, getName: () => 'x.pdf', getMimeType: () => 'application/pdf', getUrl: () => '' };
      return { getName: () => 'Modèle d\'un autre projet' };
    },
  },
  ScriptApp: { getOAuthToken: () => 'jeton-oauth' },
  UrlFetchApp, Charts, DocumentApp,
  HtmlService: { createHtmlOutput: () => ({}), XFrameOptionsMode: {} },
  console,
});
vm.runInContext(readFileSync(join(RACINE, 'apps-script/Code.gs'), 'utf8')
  + '\nglobalThis.__EXPORT = { doPost, ONGLETS, AMORCE, CHAPITRES_REDACTION };', contexte);

const { ONGLETS, AMORCE, CHAPITRES_REDACTION } = contexte.__EXPORT;
const feuilles = {};
Object.keys(ONGLETS).filter((n) => n !== 'Redaction').forEach((nom) => {
  feuilles[nom] = feuilleSimulee(nom, ONGLETS[nom], AMORCE[nom] || []);
});
contexte.__classeur = {
  getSheetByName: (n) => feuilles[n] || null,
  // L'onglet Redaction n'existe pas encore : le script doit le créer.
  insertSheet: (n) => (feuilles[n] = feuilleSimulee(n, [], [])),
};
const projets = feuilles.Projets._grille;
const col = (c) => projets[0].indexOf(c);
projets[1][col('jeton')] = JETON_CLIENT;
projets[1][col('drive_url')] = `https://drive.google.com/drive/folders/${ID_DOSSIER}`;
const P = projets[1][col('id')];

const appel = (corps) => JSON.parse(contexte.__EXPORT.doPost({ postData: { contents: JSON.stringify(corps) } })._texte);
const expert = (corps) => appel({ cle: CODE_EXPERT, ...corps });
const lignes = () => (feuilles.Redaction ? feuilles.Redaction._grille : []);
const ligne = (chap) => {
  const g = lignes(); if (!g.length) return null;
  const l = g.find((x) => x[0] === P && x[1] === chap);
  return l ? Object.fromEntries(g[0].map((h, i) => [h, l[i]])) : null;
};

const controles = [];
const verifier = (intitule, ok, detail) => controles.push([intitule, !!ok, detail]);

// Réponses du client au questionnaire, pour vérifier qu'elles sont jointes.
expert({ action: 'upsert', entite: 'questionnaire', id: `${P}:horaires`,
  payload: { donnees: JSON.stringify({ precisions: 'Ouvert le samedi matin' }) } });

/* --- Accès --- */
const parClient = appel({ jeton: JETON_CLIENT, action: 'redigerChapitre', projetId: P, chapitre: 'ch1' });
verifier('client : ne peut pas demander une rédaction', /expert/i.test(parClient.erreur || ''), parClient.erreur);
const suiviClient = appel({ jeton: JETON_CLIENT, action: 'suivreRedaction', projetId: P, chapitre: 'ch1' });
verifier('client : ne peut pas suivre une rédaction', !!suiviClient.erreur, suiviClient.erreur);

const sansCle = expert({ action: 'redigerChapitre', projetId: P, chapitre: 'ch1' });
verifier('sans clé : message qui indique le menu à utiliser', /Définir ma clé Claude/.test(sansCle.erreur || ''), sansCle.erreur);

const inconnu = expert({ action: 'redigerChapitre', projetId: P, chapitre: 'ch9' });
verifier('chapitre inconnu refusé', !!inconnu.erreur, inconnu.erreur);

/* --- Demande --- */
proprietes.set('CLAUDE_API_KEY', 'sk-ant-test');
const demande = expert({ action: 'redigerChapitre', projetId: P, chapitre: 'ch1', consignes: 'Insister sur le diabète.' });
verifier('expert : demande acceptée', demande.ok && demande.redaction?.statut === 'en_cours', demande.erreur);

const envoi = appels.find((a) => a.url === 'https://api.anthropic.com/v1/messages/batches' && a.opts.method === 'post');
const corps = envoi ? JSON.parse(envoi.opts.payload) : { requests: [{ params: {} }] };
const params = corps.requests[0].params;
const texteDemande = (params.messages?.[0]?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
verifier('en-têtes : clé et version de l\'API', envoi?.opts.headers['x-api-key'] === 'sk-ant-test'
  && envoi?.opts.headers['anthropic-version'] === '2026-10-21', JSON.stringify(envoi?.opts.headers));
verifier('chapitre 1 (analyse) : Claude Opus', params.model === 'claude-opus-5-5', params.model);
verifier('sources : commun et chapitre 1 joints', (demande.redaction.sources || []).includes('Filosofi commune.pdf')
  && (demande.redaction.sources || []).includes('Fiche commune.pdf'), JSON.stringify(demande.redaction.sources));
verifier('sources : celles du chapitre 2 écartées', !(demande.redaction.sources || []).includes('Organigramme équipe.pdf'), JSON.stringify(demande.redaction.sources));
verifier('dossiers de sources manquants créés', dossiersCrees.includes('Sources — Introduction') && dossiersCrees.includes('Sources — Chapitre 6')
  && !dossiersCrees.includes('Sources — Chapitre 1'), JSON.stringify(dossiersCrees));
verifier('paramètres permis seulement (pas de temperature)', params.max_tokens > 0 && params.output_config?.effort === 'high'
  && !('temperature' in params) && !('top_p' in params), JSON.stringify(Object.keys(params)));
verifier('consigne système : interdiction d\'inventer des données', /N'invente jamais une donnée/.test(params.system || ''), '');
verifier('identifiant de requête conforme', /^[a-zA-Z0-9_-]{1,64}$/.test(corps.requests[0].custom_id), corps.requests[0].custom_id);
verifier('la fiche et le questionnaire sont joints', texteDemande.includes('MSP Santé Caraïbes') && texteDemande.includes('Ouvert le samedi matin'), '');
verifier('le plan du chapitre et la méthode sont joints', texteDemande.includes('1.3. Z.I.P / QPV') && texteDemande.includes('comparaison au département'), '');
verifier('les consignes de l\'expert sont jointes', texteDemande.includes('Insister sur le diabète.'), '');
verifier('le chapitre modèle est joint, signalé comme autre territoire', texteDemande.includes('MODELE DE CHAPITRE') && texteDemande.includes('AUTRE territoire'), '');
verifier('PDF joint en bloc document', params.messages[0].content.some((b) => b.type === 'document' && b.source.media_type === 'application/pdf'), '');
verifier('Google Docs joint en texte', texteDemande.includes('Population : 12 000 habitants'), '');
verifier('format non lu signalé, pas envoyé', (demande.redaction.ignores || []).some((n) => n.startsWith('Ancien projet.docx')), JSON.stringify(demande.redaction.ignores));
verifier('onglet Redaction créé et ligne en cours', ligne('ch1')?.statut === 'en_cours' && ligne('ch1')?.lot_id === 'msgbatch_1', JSON.stringify(ligne('ch1')));

const doublon = expert({ action: 'redigerChapitre', projetId: P, chapitre: 'ch1' });
verifier('pas de seconde demande pendant une rédaction en cours', /déjà en cours/.test(doublon.erreur || ''), doublon.erreur);

/* --- Lecture --- */
const vueExpert = expert({ action: 'getAll' });
verifier('expert : voit l\'état de la rédaction', vueExpert.redaction?.[P]?.ch1?.statut === 'en_cours', JSON.stringify(vueExpert.redaction?.[P]));
const vueClient = appel({ jeton: JETON_CLIENT, action: 'getAll' });
verifier('client : ne reçoit rien des brouillons', vueClient.redaction === undefined, Object.keys(vueClient).join(','));

/* --- Suivi --- */
const attente = expert({ action: 'suivreRedaction', projetId: P, chapitre: 'ch1' });
verifier('lot en traitement : statut inchangé', attente.redaction?.statut === 'en_cours' && !appels.some((a) => a.url.includes('/upload/')), attente.erreur);

etatApi.statutLot = 'ended';
etatApi.resultat = { type: 'succeeded', message: { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '…' }, { type: 'text', text: REPONSE_CH1 }] } };
const recu = expert({ action: 'suivreRedaction', projetId: P, chapitre: 'ch1' });
verifier('lot terminé : chapitre prêt', recu.redaction?.statut === 'pret' && recu.redaction?.docUrl.includes('docch1'), recu.erreur || JSON.stringify(recu.redaction));

const envoiDoc = appels.find((a) => a.url.includes('/upload/drive/v3/files'));
const corpsDoc = envoiDoc ? Buffer.from(envoiDoc.opts.payload).toString() : '';
verifier('Google Docs créé dans le dossier 01, converti depuis HTML',
  corpsDoc.includes('"parents":["DOSSIER01"]') && corpsDoc.includes('application/vnd.google-apps.document') && corpsDoc.includes('text/html'), '');
verifier('titre du document : projet, chapitre, version', corpsDoc.includes('PDS — MSP Santé Caraïbes — 1. Diagnostic territorial et contexte sanitaire — v1'), '');
verifier('titre en bandeau de couleur, attributs d\'origine retirés', /background-color:#0b3c5d[^>]*><h1 style="[^"]*color:#ffffff/.test(corpsDoc) && !corpsDoc.includes('class="x"'), '');
verifier('script et gestionnaires d\'événements retirés', !corpsDoc.includes('<script') && !corpsDoc.includes('onclick'), '');
verifier('schéma rendu en étapes numérotées reliées par des flèches', corpsDoc.includes('Parcours patient diabétique')
  && corpsDoc.includes('▼') && corpsDoc.includes('Médecin traitant') && !corpsDoc.includes('data-schema'), '');
verifier('graphique rendu en image avec sa source', corpsDoc.includes('data:image/png;base64,') && corpsDoc.includes('Source : CartoSanté 2024'), '');
verifier('encadré converti en cellule colorée', !corpsDoc.includes('<blockquote') && /<td style="[^"]*background-color:#f3f8fb/.test(corpsDoc), '');
verifier('fil conducteur et éléments à compléter enregistrés',
  ligne('ch1').fil.includes('APL commune 2,1') && ligne('ch1').a_completer.includes('Filosofi') && ligne('ch1').version === 1, JSON.stringify(ligne('ch1')));

const nbUpload = appels.filter((a) => a.url.includes('/upload/')).length;
expert({ action: 'suivreRedaction', projetId: P, chapitre: 'ch1' });
verifier('un second suivi ne recrée pas le document', appels.filter((a) => a.url.includes('/upload/')).length === nbUpload, '');

/* --- Validation --- */
const valClient = appel({ jeton: JETON_CLIENT, action: 'upsert', entite: 'redaction', id: `${P}:ch1`, payload: { statut: 'valide' } });
verifier('client : ne peut pas valider', !!valClient.erreur, valClient.erreur);
const valFaux = expert({ action: 'upsert', entite: 'redaction', id: `${P}:ch1`, payload: { statut: 'en_cours', doc_url: 'x' } });
verifier('statut non permis refusé', !!valFaux.erreur && ligne('ch1').statut === 'pret', valFaux.erreur);
const valSans = expert({ action: 'upsert', entite: 'redaction', id: `${P}:ch3`, payload: { statut: 'valide' } });
verifier('chapitre jamais rédigé : validation refusée', !!valSans.erreur, valSans.erreur);
const val = expert({ action: 'upsert', entite: 'redaction', id: `${P}:ch1`, payload: { statut: 'valide', docUrl: 'https://pirate' } });
verifier('expert : valide le chapitre, rien d\'autre ne change', !val.erreur && ligne('ch1').statut === 'valide' && ligne('ch1').doc_url.includes('docch1'), val.erreur);

/* --- Document final --- */
const assClient = appel({ jeton: JETON_CLIENT, action: 'assemblerProjet', projetId: P });
verifier('client : ne peut pas assembler', /expert/i.test(assClient.erreur || ''), assClient.erreur);
const ass = expert({ action: 'assemblerProjet', projetId: P });
const fin = documents.docfinal1?.corps;
const texteFin = fin ? fin.getText() : '';
verifier('assemblage : document prêt, version 1', ass.redaction?.statut === 'pret' && ass.redaction?.docUrl.includes('docfinal1')
  && ass.redaction?.version === 1, ass.erreur || JSON.stringify(ass.redaction));
verifier('assemblage : 1 chapitre sur 7 et mentions à compléter comptées',
  /1 chapitre sur 7/.test(ass.redaction?.message) && /1 mention \[à compléter\]/.test(ass.redaction?.message), ass.redaction?.message);
verifier('assemblage : chapitres manquants listés', ass.redaction?.aCompleter.split('\n').length === 6
  && ass.redaction.aCompleter.includes('non rédigé'), ass.redaction?.aCompleter);
const garde = Buffer.from(appels.filter((a) => a.url.includes('/upload/')).pop().opts.payload).toString();
verifier('page de garde : titre, structure, avertissement « document incomplet »',
  garde.includes('PROJET DE SANTÉ') && garde.includes('MSP Santé Caraïbes') && garde.includes('Document incomplet'), '');
verifier('page de garde : rangée dans 01 — Projet de santé', garde.includes('"parents":["DOSSIER01"]')
  && garde.includes('Document final — v1'), '');
verifier('logo de la structure inséré', fin?.logo === true, '');
verifier('sommaire avec titres de niveau 1 et 2', texteFin.includes('SOMMAIRE')
  && texteFin.split('1.1. Territoire').length === 3, texteFin);
verifier('chapitre recopié sans son bandeau de travail', texteFin.includes('Indicateur | Valeur')
  && texteFin.includes('Axe 1 : accès aux soins') && !texteFin.includes('document de travail rédigé le'), texteFin);
verifier('pied de page avec la version', /version 1 du/.test(documents.docfinal1?.pied || ''), documents.docfinal1?.pied);
const ass2 = expert({ action: 'assemblerProjet', projetId: P });
verifier('nouvel assemblage : version 2, nouveau document', ass2.redaction?.version === 2 && ass2.redaction?.docUrl.includes('docfinal2'), JSON.stringify(ass2.redaction));
const valFin = expert({ action: 'upsert', entite: 'redaction', id: `${P}:final`, payload: { statut: 'valide' } });
verifier('document final : validable par l\'expert', !valFin.erreur && ligne('final').statut === 'valide', valFin.erreur);
verifier('document final : relu par l\'expert', expert({ action: 'getAll' }).redaction?.[P]?.final?.version === 2, '');
verifier('document final : rien côté client', appel({ jeton: JETON_CLIENT, action: 'getAll' }).redaction === undefined, '');

/* --- Chapitre suivant : fil conducteur, sources --- */
fichiersSources.push(fichier('docch1', 'PDS — chapitre 1', 'application/vnd.google-apps.document', ''));
etatApi.statutLot = 'in_progress';
const avant = appels.length;
const d2 = expert({ action: 'redigerChapitre', projetId: P, chapitre: 'ch2' });
const envoi2 = appels.slice(avant).find((a) => a.opts.method === 'post' && a.url.endsWith('/batches'));
const texte2 = envoi2 ? JSON.parse(envoi2.opts.payload).requests[0].params.messages[0].content.filter((b) => b.type === 'text').map((b) => b.text).join('\n') : '';
verifier('chapitre 2 : le fil du chapitre 1 est transmis', !d2.erreur && texte2.includes('[ch1]') && texte2.includes('APL commune 2,1'), d2.erreur);
verifier('chapitre 2 : le document du chapitre 1 n\'est pas renvoyé comme source',
  !(d2.redaction?.sources || []).includes('PDS — chapitre 1'), JSON.stringify(d2.redaction?.sources));

/* --- Échec du lot --- */
etatApi.statutLot = 'ended';
etatApi.resultat = { type: 'errored', error: { type: 'error', error: { type: 'invalid_request_error', message: 'prompt is too long' } } };
const echec = expert({ action: 'suivreRedaction', projetId: P, chapitre: 'ch2' });
verifier('lot en erreur : statut erreur et motif lisible', echec.redaction?.statut === 'erreur' && /prompt is too long/.test(echec.redaction?.message), JSON.stringify(echec.redaction));
const relance = expert({ action: 'redigerChapitre', projetId: P, chapitre: 'ch2' });
verifier('après une erreur, nouvelle demande possible', !relance.erreur, relance.erreur);

/* --- Modèle économique pour les chapitres d'organisation --- */
const avant3 = appels.length;
const d3 = expert({ action: 'redigerChapitre', projetId: P, chapitre: 'ch3' });
const envoi3 = appels.slice(avant3).find((a) => a.opts.method === 'post' && a.url.endsWith('/batches'));
verifier('chapitre 3 : Claude Sonnet', !d3.erreur && JSON.parse(envoi3.opts.payload).requests[0].params.model === 'claude-sonnet-5-5', d3.erreur);
verifier('chapitre 3 : ni les sources du chapitre 1 ni celles du 2',
  !(d3.redaction.sources || []).some((n) => /Filosofi|Organigramme/.test(n)), JSON.stringify(d3.redaction.sources));
const prep = expert({ action: 'preparerSources', projetId: P });
verifier('préparation des dossiers de sources : réservée, sans erreur', !prep.erreur && typeof prep.crees === 'number', prep.erreur);
const prepClient = appel({ jeton: JETON_CLIENT, action: 'preparerSources', projetId: P });
verifier('client : ne peut pas créer les dossiers de sources', !!prepClient.erreur, prepClient.erreur);

/* --- Import d'un chapitre existant --- */
const impClient = appel({ jeton: JETON_CLIENT, action: 'importerChapitre', projetId: P, chapitre: 'ch4', url: 'https://docs.google.com/document/d/IMPORTCH4abcdefghijklmnopqrstuvwxyz/edit' });
verifier('client : ne peut pas importer', !!impClient.erreur, impClient.erreur);
const impPdf = expert({ action: 'importerChapitre', projetId: P, chapitre: 'ch4', url: 'https://drive.google.com/file/d/IMPORTPDFabcdefghijklmnopqrstuvwxyz/view' });
verifier('import : un PDF est refusé', /Google Docs/.test(impPdf.erreur || ''), impPdf.erreur);
const imp = expert({ action: 'importerChapitre', projetId: P, chapitre: 'ch4', url: 'https://docs.google.com/document/d/IMPORTCH4abcdefghijklmnopqrstuvwxyz/edit' });
verifier('import : chapitre classé prêt, avec son document', imp.redaction?.statut === 'pret' && ligne('ch4').lot_id === 'import'
  && ligne('ch4').doc_id === 'IMPORTCH4abcdefghijklmnopqrstuvwxyz', imp.erreur || JSON.stringify(ligne('ch4')));
const avant5 = appels.length;
expert({ action: 'redigerChapitre', projetId: P, chapitre: 'ch5' });
const envoi5 = appels.slice(avant5).find((a) => a.opts.method === 'post' && a.url.endsWith('/batches'));
const texte5 = envoi5 ? JSON.parse(envoi5.opts.payload).requests[0].params.messages[0].content.filter((b) => b.type === 'text').map((b) => b.text).join('\n') : '';
verifier('chapitre 5 : le texte du chapitre 4 importé est joint', texte5.includes('<chapitre_deja_redige id="ch4">'), texte5.slice(0, 200));

/* --- Concordance avec l'application --- */
const ctx = vm.createContext({});
vm.runInContext(readFileSync(join(RACINE, 'assets/js/config.js'), 'utf8') + '\nglobalThis.__C = CHAPITRES_REDACTION;', ctx);
const ecarts = [];
CHAPITRES_REDACTION.forEach((c, i) => {
  const a = ctx.__C[i];
  if (!a || a.id !== c.id) ecarts.push(`position ${i} : ${c.id} ≠ ${a?.id}`);
  else if (JSON.stringify(a.prestations) !== JSON.stringify(c.prestations)) ecarts.push(`${c.id} : prestations différentes`);
});
if (ctx.__C.length !== CHAPITRES_REDACTION.length) ecarts.push('nombre de chapitres différent');
verifier('chapitres identiques côté serveur et côté application', !ecarts.length, ecarts.join(' ; '));

/* ------------------------------------------------------------ Résultats -- */
let echecs = 0;
controles.forEach(([intitule, ok, detail]) => {
  if (!ok) echecs++;
  console.log(`${ok ? '  ok  ' : ' ÉCHEC'}  ${intitule}${ok ? '' : `  → ${detail}`}`);
});
console.log(`\n${controles.length - echecs} / ${controles.length} contrôles passés`);
assert.strictEqual(echecs, 0, `${echecs} contrôle(s) en échec`);
