/**
 * Test des actes et documents générés avec Claude.
 *
 *   node tests/actes.mjs
 *
 * Exécute le vrai code du script contre un classeur, un Drive et une API
 * Claude simulés : accès réservé à l'expert, sources jointes (modèles
 * officiels, chapitres rédigés, pièces du dossier), Google Docs dans le
 * dossier de la catégorie, validation bornée, concordance avec l'application.
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
const dossier01 = {
  getId: () => 'DOSSIER01', getName: () => '01 — Projet de santé',
  getFiles: () => iterateur(fichiersSources), getFolders: () => iterateur([]),
};
const fichiersJuridique = [fichier('kbis', 'Kbis provisoire.pdf', 'application/pdf', '%PDF kbis')];
const dossier02 = {
  getId: () => 'DOSSIER02', getName: () => '02 — Juridique',
  getFiles: () => iterateur(fichiersJuridique), getFolders: () => iterateur([]),
};
const dossierProjet = {
  getId: () => ID_DOSSIER, getName: () => 'Projet',
  getFolders: () => iterateur([dossier01, dossier02]), getFiles: () => iterateur([]),
};

// Racine ElodiaTech : « Sources officielles des actes / <document> ».
const creations = [];
function dossierSimule(nom, fichiers = []) {
  const enfants = [];
  return {
    getId: () => `F-${nom}`, getName: () => nom, _fichiers: fichiers, _enfants: enfants,
    getFiles: () => iterateur(fichiers), getFolders: () => iterateur(enfants),
    getFoldersByName: (n) => iterateur(enfants.filter((e) => e.getName() === n)),
    createFolder: (n) => { const d = dossierSimule(n); enfants.push(d); creations.push(n); return d; },
  };
}
const racine = dossierSimule('ElodiaTech');
const sourcesActes = racine.createFolder('Sources officielles des actes');
const dossierStatuts = sourcesActes.createFolder('Statuts de la SISA');
dossierStatuts._fichiers.push(fichier('cnom', 'Modèle statuts SISA — Ordre des médecins.pdf', 'application/pdf', '%PDF modele cnom'));
creations.length = 0;

/* ------------------------------------------------ API Claude simulée ---- */
const appels = [];
const etatApi = { statutLot: 'in_progress', resultat: null, lots: 0 };
const REPONSE_ACTE = [
  '<document><h1>Statuts de la SISA</h1><h2>Article 1 — Forme</h2><p>Société interprofessionnelle de soins ambulatoires.</p>',
  '<h2>Article 6 — Capital</h2><p>[à compléter : montant du capital]</p>',
  '<table><tr><th>Nom</th><th>Qualité</th><th>Signature</th></tr><tr><td></td><td></td><td></td></tr></table></document>',
  '<a_completer>Montant du capital\nRépartition des parts</a_completer>',
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
      if (url.includes('docch2')) return reponse(200, 'CHAPITRE 2 VALIDE : gérance assurée par le Dr Exemple.');
      return reponse(200, 'MODELE DE CHAPITRE — structure type.');
    }
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files')) {
      return reponse(200, { id: 'docacte1', webViewLink: 'https://docs.google.com/document/d/docacte1/edit' });
    }
    return reponse(404, 'inconnu');
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
  DriveApp: { getFolderById: (id) => (id === ID_DOSSIER ? dossierProjet : racine) },
  ScriptApp: { getOAuthToken: () => 'jeton-oauth' },
  UrlFetchApp, Charts,
  HtmlService: { createHtmlOutput: () => ({}), XFrameOptionsMode: {} },
  console,
});
vm.runInContext(readFileSync(join(RACINE, 'apps-script/Code.gs'), 'utf8')
  + '\nglobalThis.__EXPORT = { doPost, ONGLETS, AMORCE, ACTES_GENERES };', contexte);

const { ONGLETS, AMORCE, ACTES_GENERES } = contexte.__EXPORT;
const feuilles = {};
Object.keys(ONGLETS).filter((n) => n !== 'Redaction' && n !== 'Actes').forEach((nom) => {
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
const lignes = () => (feuilles.Actes ? feuilles.Actes._grille : []);
const ligne = (acte) => {
  const g = lignes(); if (!g.length) return null;
  const l = g.find((x) => x[0] === P && x[1] === acte);
  return l ? Object.fromEntries(g[0].map((h, i) => [h, l[i]])) : null;
};


const controles = [];
const verifier = (intitule, ok, detail) => controles.push([intitule, !!ok, detail]);

// Un chapitre 2 validé et un brouillon : les actes reprennent leurs choix.
feuilles.Redaction = feuilleSimulee('Redaction', ONGLETS.Redaction, [
  [P, 'ch2', 'valide', 'b', 'docch2', 'u', 1, '', '', '["Gérance : Dr Exemple"]', '', ''],
]);

/* --- Accès --- */
const parClient = appel({ jeton: JETON_CLIENT, action: 'redigerActe', projetId: P, acte: 'statuts_sisa' });
verifier('client : ne peut pas demander un acte', /expert/i.test(parClient.erreur || ''), parClient.erreur);
const sansCle = expert({ action: 'redigerActe', projetId: P, acte: 'statuts_sisa' });
verifier('sans clé : message qui indique le menu', /Définir ma clé Claude/.test(sansCle.erreur || ''), sansCle.erreur);
proprietes.set('CLAUDE_API_KEY', 'sk-ant-test');
const inconnu = expert({ action: 'redigerActe', projetId: P, acte: 'faux' });
verifier('document inconnu refusé', !!inconnu.erreur, inconnu.erreur);

/* --- Demande --- */
const d = expert({ action: 'redigerActe', projetId: P, acte: 'statuts_sisa', consignes: 'Capital de 1 500 €.' });
verifier('expert : demande acceptée', d.ok && d.acte?.statut === 'en_cours', d.erreur);
const envoi = appels.find((a) => a.url === 'https://api.anthropic.com/v1/messages/batches' && a.opts.method === 'post');
const params = envoi ? JSON.parse(envoi.opts.payload).requests[0].params : {};
const blocs = params.messages?.[0]?.content || [];
const texte = blocs.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
verifier('consigne système des actes (projet, rien inventé)', /PROJET de document/.test(params.system || '') && /N'invente jamais/.test(params.system || ''), '');
verifier('le contenu attendu et les consignes sont joints', texte.includes('L.4041-1') && texte.includes('Capital de 1 500 €.'), '');
verifier('le chapitre validé est joint en texte', texte.includes('CHAPITRE 2 VALIDE') && texte.includes('[ch2, validé]'), '');
verifier('le fil conducteur est joint', texte.includes('Gérance : Dr Exemple'), '');
verifier('le modèle officiel déposé est joint comme source officielle',
  texte.includes('<source_officielle nom="Modèle statuts SISA — Ordre des médecins.pdf">')
  && blocs.some((b) => b.type === 'document'), '');
verifier('les pièces du dossier « 02 — Juridique » sont jointes', texte.includes('<piece_du_dossier nom="Kbis provisoire.pdf">'), '');
verifier('les dossiers de sources manquants sont créés (commun)', creations.includes('00 — Commun à tous les actes'), creations.join(','));
verifier('onglet Actes créé, ligne en cours', ligne('statuts_sisa')?.statut === 'en_cours', JSON.stringify(ligne('statuts_sisa')));
verifier('pas de seconde demande pendant la rédaction',
  /déjà en cours/.test(expert({ action: 'redigerActe', projetId: P, acte: 'statuts_sisa' }).erreur || ''), '');

/* --- Lecture --- */
verifier('expert : voit l\'état des actes', expert({ action: 'getAll' }).actes?.[P]?.statuts_sisa?.statut === 'en_cours', '');
verifier('client : ne reçoit rien des actes en préparation', appel({ jeton: JETON_CLIENT, action: 'getAll' }).actes === undefined, '');

/* --- Suivi --- */
verifier('lot en traitement : statut inchangé',
  expert({ action: 'suivreActe', projetId: P, acte: 'statuts_sisa' }).acte?.statut === 'en_cours', '');
etatApi.statutLot = 'ended';
etatApi.resultat = { type: 'succeeded', message: { stop_reason: 'end_turn', content: [{ type: 'text', text: REPONSE_ACTE }] } };
const recu = expert({ action: 'suivreActe', projetId: P, acte: 'statuts_sisa' });
verifier('lot terminé : projet prêt avec son lien', recu.acte?.statut === 'pret' && recu.acte?.docUrl.includes('docacte1'), recu.erreur || JSON.stringify(recu.acte));
const envoiDoc = appels.find((a) => a.url.includes('/upload/drive/v3/files'));
const corpsDoc = envoiDoc ? Buffer.from(envoiDoc.opts.payload).toString() : '';
verifier('Google Docs créé dans « 02 — Juridique »', corpsDoc.includes('"parents":["DOSSIER02"]'), '');
verifier('titre et bandeau du document', corpsDoc.includes('Statuts de la SISA — MSP Santé Caraïbes — projet v1') && corpsDoc.includes('Projet de document — '), '');
verifier('éléments à compléter enregistrés', String(ligne('statuts_sisa').a_completer).includes('Montant du capital'), '');

/* --- Validation --- */
verifier('client : ne peut pas valider',
  !!appel({ jeton: JETON_CLIENT, action: 'upsert', entite: 'actes', id: `${P}:statuts_sisa`, payload: { statut: 'valide' } }).erreur, '');
verifier('acte jamais rédigé : validation refusée',
  !!expert({ action: 'upsert', entite: 'actes', id: `${P}:budget`, payload: { statut: 'valide' } }).erreur, '');
const val = expert({ action: 'upsert', entite: 'actes', id: `${P}:statuts_sisa`, payload: { statut: 'valide', doc_url: 'x' } });
verifier('expert : valide, rien d\'autre ne change', !val.erreur && ligne('statuts_sisa').statut === 'valide'
  && String(ligne('statuts_sisa').doc_url).includes('docacte1'), val.erreur);

/* --- Erreur --- */
etatApi.statutLot = 'in_progress';
expert({ action: 'redigerActe', projetId: P, acte: 'convention_ccas' });
etatApi.statutLot = 'ended';
etatApi.resultat = { type: 'errored', error: { type: 'error', error: { message: 'overloaded' } } };
const echec = expert({ action: 'suivreActe', projetId: P, acte: 'convention_ccas' });
verifier('lot en erreur : statut erreur et motif', echec.acte?.statut === 'erreur' && /overloaded/.test(echec.acte?.message), JSON.stringify(echec.acte));

/* --- Concordance avec l'application --- */
const ctx = vm.createContext({});
vm.runInContext(readFileSync(join(RACINE, 'assets/js/config.js'), 'utf8') + '\nglobalThis.__C = { ACTES_GENERES, PRESTATIONS, CATEGORIES_DOC };', ctx);
const ecarts = [];
ACTES_GENERES.forEach((a, i) => {
  const b = ctx.__C.ACTES_GENERES[i];
  ['id', 'titre', 'categorie', 'signature', 'prestation'].forEach((k) => { if (!b || b[k] !== a[k]) ecarts.push(`${a.id}.${k}`); });
  if (JSON.stringify(b?.types) !== JSON.stringify(a.types) || JSON.stringify(b?.modeles) !== JSON.stringify(a.modeles)) ecarts.push(`${a.id}.types`);
});
if (ctx.__C.ACTES_GENERES.length !== ACTES_GENERES.length) ecarts.push('nombre');
verifier('actes identiques côté serveur et côté application', !ecarts.length, ecarts.join(','));
const incoherents = ACTES_GENERES.filter((a) => !ctx.__C.CATEGORIES_DOC.includes(a.categorie)
  || (a.prestation && !ctx.__C.PRESTATIONS.some((p) => p.id === a.prestation))).map((a) => a.id);
verifier('catégories et prestations des actes existent', !incoherents.length, incoherents.join(','));

/* ------------------------------------------------------------ Résultats -- */
let nbEchecs = 0;
controles.forEach(([intitule, ok, detail]) => {
  if (!ok) nbEchecs++;
  console.log(`${ok ? '  ok  ' : ' ÉCHEC'}  ${intitule}${ok ? '' : `  → ${detail}`}`);
});
console.log(`\n${controles.length - nbEchecs} / ${controles.length} contrôles passés`);
process.exit(nbEchecs ? 1 : 0);
