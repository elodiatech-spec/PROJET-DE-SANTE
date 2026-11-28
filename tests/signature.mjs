/**
 * Test des documents du dossier et de la signature interne.
 *
 *   node tests/signature.mjs
 *
 * Lettres d'engagement générées par professionnel, modèles types copiés et
 * préremplis, liens de signature personnels, page publique, signature,
 * certificat quand tous ont signé, accès réservé à l'expert.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert';
import { createHash } from 'node:crypto';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CODE_EXPERT = 'code-expert-de-test';
const JETON_CLIENT = 'jetonclienttestabcdefgh';
const ID_DOSSIER = 'DOSSIERPROJET0123456789abcdef';

function feuilleSimulee(nom, entetes, lignes) {
  const grille = [entetes.slice(), ...lignes.map((l) => { const c = l.slice(); while (c.length < entetes.length) c.push(''); return c; })];
  return {
    getName: () => nom,
    getDataRange: () => ({ getValues: () => grille.map((l) => l.slice()) }),
    getLastRow: () => grille.length,
    getRange: (ligne, colonne) => ({
      setValue: (v) => { grille[ligne - 1][colonne - 1] = v; },
      setValues: (v) => { grille[ligne - 1] = v[0].slice(); return { setFontWeight: () => ({ setFontColor: () => ({ setBackground: () => {} }) }) }; },
    }),
    appendRow: (v) => { const c = v.slice(); while (c.length < grille[0].length) c.push(''); grille.push(c); },
    deleteRow: (l) => { grille.splice(l - 1, 1); },
    setFrozenRows: () => {},
    _grille: grille,
  };
}

const iterateur = (l) => { let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; };
const dossiersCat = {};
const dossier = (nom) => ({ getId: () => 'D-' + nom, getName: () => nom, getUrl: () => 'https://drive/' + nom, getFiles: () => iterateur([]), getFolders: () => iterateur([]) });
['01 — Projet de santé', '02 — Juridique', '04 — Finances', '06 — Équipe'].forEach((n) => { dossiersCat[n] = dossier(n); });
const dossierProjet = { getId: () => ID_DOSSIER, getFolders: () => iterateur(Object.values(dossiersCat)), getFiles: () => iterateur([]) };

const uploads = [];
const copies = [];
const textesDoc = {};
const contenuPdf = Buffer.from('%PDF lettre');
const fichiers = {
  DOCASIGNERabcdefghijklmnopqrstuvwxyz: { nom: "Lettre d'engagement — Christiane CATIN" },
};
const DriveApp = {
  getFolderById: (id) => { if (id !== ID_DOSSIER) throw new Error('inconnu'); return dossierProjet; },
  getFileById: (id) => {
    if (fichiers[id]) return {
      getName: () => fichiers[id].nom, getAs: () => ({ getBytes: () => [...contenuPdf] }),
      getParents: () => iterateur([dossiersCat['06 — Équipe']]),
    };
    if (id === '1yVXC3KscXV3DT2IRMI_qdM7qB3xvpzz80A37Fh09ilo') return {
      makeCopy: (nom, d) => { copies.push({ nom, d: d.getName() }); textesDoc.COPIE = 'Le Client : [dénomination ou nom, prénom] — [courriel du client]';
        return { getId: () => 'COPIE', getUrl: () => 'https://docs/COPIE', getName: () => nom }; },
    };
    throw new Error('fichier inconnu');
  },
};
const DocumentApp = {
  openById: (id) => ({
    getBody: () => ({ replaceText: (motif, par) => { textesDoc[id] = textesDoc[id].replace(new RegExp(motif, 'g'), par); } }),
    saveAndClose: () => {},
  }),
};
const UrlFetchApp = {
  fetch(url, opts) {
    const corps = Buffer.from(opts.payload).toString();
    uploads.push(corps);
    const id = 'GDOC' + uploads.length;
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ id, webViewLink: 'https://docs/' + id }) };
  },
};

const proprietes = new Map([['CODE_EXPERT', CODE_EXPERT]]);
const contexte = vm.createContext({
  SpreadsheetApp: { getActive: () => contexte.__classeur, flush: () => {} },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => proprietes.get(k) || null, setProperty: () => {} }) },
  ContentService: { createTextOutput: (s) => ({ setMimeType: () => ({ _texte: s }) }), MimeType: { JSON: 'json' } },
  Utilities: {
    formatDate: (d) => d.toISOString().slice(0, 10), getUuid: () => 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6'.replace(/[0-9a-f]/g, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]),
    base64Encode: (b) => Buffer.from(b).toString('base64'),
    newBlob: (s) => ({ getBytes: () => Buffer.from(String(s)) }),
    computeDigest: (alg, octets) => [...createHash('sha256').update(Buffer.from(octets)).digest()].map((b) => (b > 127 ? b - 256 : b)),
    DigestAlgorithm: { SHA_256: 'sha256' },
  },
  DriveApp, DocumentApp, UrlFetchApp,
  ScriptApp: { getOAuthToken: () => 'x', getService: () => ({ getUrl: () => 'https://script/exec' }) },
  HtmlService: { createHtmlOutput: (h) => ({ setTitle: () => ({ _html: h }), _html: h }), XFrameOptionsMode: {} },
  console,
});
vm.runInContext(readFileSync(join(RACINE, 'apps-script/Code.gs'), 'utf8')
  + '\nglobalThis.__EXPORT = { doPost, doGet, signerDocument, ONGLETS, AMORCE };', contexte);
const { ONGLETS, AMORCE } = contexte.__EXPORT;
const feuilles = {};
Object.keys(ONGLETS).filter((n) => n !== 'Signataires').forEach((n) => { feuilles[n] = feuilleSimulee(n, ONGLETS[n], AMORCE[n] || []); });
contexte.__classeur = { getSheetByName: (n) => feuilles[n] || null, insertSheet: (n) => (feuilles[n] = feuilleSimulee(n, [], [])) };
const P = feuilles.Projets._grille;
const col = (c) => P[0].indexOf(c);
P[1][col('jeton')] = JETON_CLIENT;
P[1][col('drive_url')] = `https://drive.google.com/drive/folders/${ID_DOSSIER}`;
const PID = P[1][col('id')];
const NOM = P[1][col('nom')];

const appel = (c) => JSON.parse(contexte.__EXPORT.doPost({ postData: { contents: JSON.stringify(c) } })._texte);
const expert = (c) => appel({ cle: CODE_EXPERT, ...c });
const controles = [];
const verifier = (i, ok, d) => controles.push([i, !!ok, d]);

// Professionnels du questionnaire
expert({ action: 'upsert', entite: 'questionnaire', id: `${PID}:equipe`, payload: { donnees: JSON.stringify({ pros: [
  { nom: 'CATIN', prenom: 'Christiane', profession: 'Médecin généraliste', email: 'c.catin@exemple.fr', site: 'Site 2' },
  { nom: 'THOMAS', prenom: 'Félix', profession: 'Médecin généraliste', email: '' },
  { nom: '[à recruter]', prenom: '', profession: 'IPA' }] }) } });

/* --- Lettres d'engagement --- */
const lettresClient = appel({ jeton: JETON_CLIENT, action: 'genererLettresEngagement', projetId: PID });
verifier('client : ne peut pas générer les lettres', !!lettresClient.erreur, lettresClient.erreur);
const lettres = expert({ action: 'genererLettresEngagement', projetId: PID });
verifier('une lettre par professionnel nommé (pas pour « à recruter »)', lettres.lettres?.length === 2, JSON.stringify(lettres));
verifier('lettre préremplie : structure, professionnel, profession', uploads[0].includes('Christiane CATIN') && uploads[0].includes(NOM)
  && uploads[0].includes('Médecin généraliste') && uploads[0].includes('"parents":["D-06 — Équipe"]'), uploads[0].slice(0, 300));
verifier('courriel repris pour la signature', lettres.lettres[0].email === 'c.catin@exemple.fr', lettres.lettres[0].email);

/* --- Modèle type copié et prérempli --- */
const copie = expert({ action: 'copierModele', projetId: PID, modele: 'mandat_accompagnement' });
verifier('modèle copié dans le dossier Juridique du client', copies[0]?.d === '02 — Juridique' && copies[0].nom.includes(NOM), JSON.stringify(copies));
verifier('modèle prérempli avec le nom du client', textesDoc.COPIE.includes(NOM) && !textesDoc.COPIE.includes('[dénomination'), textesDoc.COPIE);
verifier('modèle inconnu refusé', !!expert({ action: 'copierModele', projetId: PID, modele: 'xx' }).erreur, '');

/* --- Signature --- */
const doc = 'https://docs.google.com/document/d/DOCASIGNERabcdefghijklmnopqrstuvwxyz/edit';
const sigClient = appel({ jeton: JETON_CLIENT, action: 'preparerSignature', projetId: PID, docUrl: doc, signataires: [{ nom: 'X' }] });
verifier('client : ne peut pas préparer une signature', !!sigClient.erreur, sigClient.erreur);
const prep = expert({ action: 'preparerSignature', projetId: PID, docUrl: doc, titre: 'Lettre CATIN', signatureId: 'sig1',
  signataires: [{ nom: 'Christiane CATIN', email: 'c.catin@exemple.fr', qualite: 'Médecin' }, { nom: 'Sébastien NARECE', qualite: 'Porteur' }] });
verifier('deux liens personnels créés', prep.signataires?.length === 2 && prep.signataires.every((s) => /\?signer=[a-z0-9]{24}$/.test(s.lien)), JSON.stringify(prep.signataires));
const jetons = feuilles.Signataires._grille.slice(1).map((l) => l[feuilles.Signataires._grille[0].indexOf('jeton')]);
const page = contexte.__EXPORT.doGet({ parameter: { signer: jetons[0] } });
verifier('page de signature : document, signataire, PDF à lire', page._html.includes('Lettre CATIN') && page._html.includes('Christiane CATIN')
  && page._html.includes('data:application/pdf;base64,'), '');
verifier('lien inconnu : page d\'erreur, sans document', contexte.__EXPORT.doGet({ parameter: { signer: 'inconnu123456789' } })._html.includes('invalide'), '');
const m1 = contexte.__EXPORT.signerDocument(jetons[0], 'Christiane CATIN');
const l1 = feuilles.Signataires._grille[1];
const h = feuilles.Signataires._grille[0];
verifier('signature enregistrée avec heure, nom et empreinte SHA-256', /enregistrée/.test(m1) && l1[h.indexOf('statut')] === 'signe'
  && l1[h.indexOf('empreinte')] === createHash('sha256').update(contenuPdf).digest('hex'), JSON.stringify(l1));
verifier('pas de certificat tant qu\'un signataire manque', !uploads.some((u) => u.includes('CERTIFICAT DE SIGNATURE')), '');
verifier('double signature sans effet', /déjà signé/.test(contexte.__EXPORT.signerDocument(jetons[0], 'Autre')), '');
let refus = '';
try { contexte.__EXPORT.signerDocument('inconnu123456789', 'X'); } catch (e) { refus = e.message; }
verifier('jeton inconnu refusé', /invalide/.test(refus), refus);
contexte.__EXPORT.signerDocument(jetons[1], 'Sébastien NARECE');
const cert = uploads.find((u) => u.includes('CERTIFICAT DE SIGNATURE'));
verifier('tous ont signé : certificat créé à côté du document', !!cert && cert.includes('Sébastien NARECE') && cert.includes('"parents":["D-06 — Équipe"]'), '');
const vue = expert({ action: 'getAll' });
verifier('expert : suit l\'état des signataires', vue.signataires?.[PID]?.every((s) => s.statut === 'signe'), JSON.stringify(vue.signataires?.[PID]));
verifier('client : ne reçoit pas les liens de signature', appel({ jeton: JETON_CLIENT, action: 'getAll' }).signataires === undefined, '');

let echecs = 0;
controles.forEach(([i, ok, d]) => { if (!ok) echecs++; console.log(`${ok ? '  ok  ' : ' ÉCHEC'}  ${i}${ok ? '' : `  → ${d}`}`); });
console.log(`\n${controles.length - echecs} / ${controles.length} contrôles passés`);
assert.strictEqual(echecs, 0, `${echecs} contrôle(s) en échec`);
