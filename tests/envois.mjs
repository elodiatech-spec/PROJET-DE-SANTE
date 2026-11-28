/**
 * Test des envois et démarches.
 *
 *   node tests/envois.mjs
 *
 * Création, mise à jour et suppression d'un envoi, préparation du dossier
 * d'envoi (copies des pièces, lettre et bordereau), accès réservé à l'expert.
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
const uploads = [];
const copies = [];
const dossiersCrees = [];
let numeroDossier = 0;
const dossierEnvoi = (nom) => {
  const fichiersDedans = [];
  const ident = 'DENVOI' + String(++numeroDossier).padStart(2, '0') + '0123456789abcdefghijklmn';
  const d = { getId: () => ident, getName: () => nom, getUrl: () => 'https://drive.google.com/drive/folders/' + ident,
    getFiles: () => iterateur(fichiersDedans), getFolders: () => iterateur([]), _fichiers: fichiersDedans };
  return d;
};
const dossierProjet = { getId: () => ID_DOSSIER, getFolders: () => iterateur(dossiersCrees.filter((d) => d._racine)), getFiles: () => iterateur([]),
  createFolder: (nom) => { const d = dossierEnvoi(nom); d._racine = true; dossiersCrees.push(d); return d; } };
dossierProjet.createFolder = (nom) => {
  const d = dossierEnvoi(nom);
  if (/^09/.test(nom)) { d._racine = true; d.createFolder = (sous) => { const e = dossierEnvoi(sous); e._sous = true; dossiersCrees.push(e); return e; }; }
  dossiersCrees.push(d);
  return d;
};
const fichiersDrive = { PIECEUNabcdefghijklmnopqrstuvwxyz: 'Statuts de la SISA', PIECEDEUXabcdefghijklmnopqrstuvwx: 'Projet de santé' };
const DriveApp = {
  getFolderById: (id) => {
    if (id === ID_DOSSIER) return dossierProjet;
    const d = dossiersCrees.find((x) => x.getId() === id);
    if (d) return d;
    throw new Error('inconnu');
  },
  getFileById: (id) => {
    if (!fichiersDrive[id]) throw new Error('fichier inconnu');
    return { getName: () => fichiersDrive[id], makeCopy: (nom, dossier) => { copies.push({ nom, d: dossier.getName() }); dossier._fichiers.push({ getName: () => nom }); return {}; } };
  },
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
  DriveApp, DocumentApp: {}, UrlFetchApp,
  ScriptApp: { getOAuthToken: () => 'x', getService: () => ({ getUrl: () => 'https://script/exec' }) },
  HtmlService: { createHtmlOutput: (h) => ({ setTitle: () => ({ _html: h }), _html: h }), XFrameOptionsMode: {} },
  console,
});
vm.runInContext(readFileSync(join(RACINE, 'apps-script/Code.gs'), 'utf8')
  + '\nglobalThis.__EXPORT = { doPost, doGet, ONGLETS, AMORCE };', contexte);
const { ONGLETS, AMORCE } = contexte.__EXPORT;
const feuilles = {};
Object.keys(ONGLETS).filter((n) => n !== 'Envois').forEach((n) => { feuilles[n] = feuilleSimulee(n, ONGLETS[n], AMORCE[n] || []); });
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

const PIECES = [
  { nom: 'Statuts de la SISA', url: 'https://docs.google.com/document/d/PIECEUNabcdefghijklmnopqrstuvwxyz/edit' },
  { nom: 'Projet de santé', url: 'https://docs.google.com/document/d/PIECEDEUXabcdefghijklmnopqrstuvwx/edit' },
  { nom: 'Attestation sur papier', url: '' },
];

/* --- Création --- */
const clientRefus = appel({ jeton: JETON_CLIENT, action: 'enregistrerEnvoi', projetId: PID, envoi: { destinataire: 'ARS', objet: 'X' } });
verifier('client : ne peut pas créer un envoi', !!clientRefus.erreur, clientRefus.erreur);
verifier('objet obligatoire', !!expert({ action: 'enregistrerEnvoi', projetId: PID, envoi: { destinataire: 'ARS', objet: ' ' } }).erreur, '');
verifier('statut inconnu refusé', !!expert({ action: 'enregistrerEnvoi', projetId: PID, envoi: { destinataire: 'ARS', objet: 'X', statut: 'zz' } }).erreur, '');
verifier('date non reconnue refusée', !!expert({ action: 'enregistrerEnvoi', projetId: PID, envoi: { destinataire: 'ARS', objet: 'X', envoyeLe: '12/03/2026' } }).erreur, '');
verifier('identifiant invalide refusé', !!expert({ action: 'enregistrerEnvoi', projetId: PID, envoi: { id: "x'; DROP", destinataire: 'ARS', objet: 'X' } }).erreur, '');

const cree = expert({ action: 'enregistrerEnvoi', projetId: PID, envoi: { id: 'envtest0001', destinataire: 'ARS', objet: 'Transmission du projet de santé',
  canal: 'courriel', courrielDest: 'ars@exemple.fr', pieces: PIECES } });
verifier('envoi créé, à préparer', cree.envois?.length === 1 && cree.envois[0].statut === 'a_preparer' && cree.envois[0].id === 'envtest0001', JSON.stringify(cree));
verifier('pièces conservées avec leur lien', cree.envois[0].pieces.length === 3 && cree.envois[0].pieces[0].url.startsWith('https://'), JSON.stringify(cree.envois[0].pieces));

/* --- Préparation du dossier d'envoi --- */
const refusPrep = appel({ jeton: JETON_CLIENT, action: 'preparerEnvoi', projetId: PID, id: 'envtest0001' });
verifier('client : ne peut pas préparer un envoi', !!refusPrep.erreur, refusPrep.erreur);
verifier('envoi inconnu refusé', !!expert({ action: 'preparerEnvoi', projetId: PID, id: 'envinconnu' }).erreur, '');
const prep = expert({ action: 'preparerEnvoi', projetId: PID, id: 'envtest0001' });
verifier('dossier d\'envoi créé dans « 09 — Envois et démarches »', dossiersCrees.some((d) => /^09/.test(d.getName())) && dossiersCrees.some((d) => d._sous && /ARS — Transmission/.test(d.getName())), dossiersCrees.map((d) => d.getName()).join(' | '));
verifier('deux pièces copiées, numérotées', prep.copiees === 2 && copies[0].nom === '01 — Statuts de la SISA' && copies[1].nom === '02 — Projet de santé', JSON.stringify(copies));
verifier('pièce sans fichier Drive signalée', prep.nonCopiees?.length === 1 && /Attestation sur papier/.test(prep.nonCopiees[0]), JSON.stringify(prep.nonCopiees));
const lettre = uploads.find((u) => u.includes('BORDEREAU DES PIÈCES TRANSMISES'));
verifier('lettre : structure, destinataire, objet, bordereau', !!lettre && lettre.includes(NOM) && lettre.includes('ars@exemple.fr') && lettre.includes('Objet : Transmission du projet de santé')
  && lettre.includes('Statuts de la SISA') && lettre.includes('Attestation sur papier'), (lettre || '').slice(0, 200));
verifier('envoi prêt, avec liens du dossier et de la lettre', prep.envois[0].statut === 'pret' && /drive\/folders\//.test(prep.envois[0].dossierUrl) && prep.envois[0].lettreUrl.startsWith('https://docs/'), JSON.stringify(prep.envois[0]));
const prep2 = expert({ action: 'preparerEnvoi', projetId: PID, id: 'envtest0001' });
verifier('seconde préparation : même dossier, lettre sans écrasement', dossiersCrees.filter((d) => d._sous).length === 1 && prep2.envois[0].dossierUrl === prep.envois[0].dossierUrl, '');
verifier('seconde préparation : pièces recopiées sous un nom libre', copies[2].nom === '01 — Statuts de la SISA (2)', JSON.stringify(copies.slice(2)));

/* --- Suivi --- */
const majSuivi = expert({ action: 'enregistrerEnvoi', projetId: PID, envoi: { ...prep2.envois[0], statut: 'envoye', canal: 'courriel' } });
verifier('marqué envoyé : la date du jour est posée', majSuivi.envois[0].statut === 'envoye' && /^\d{4}-\d{2}-\d{2}$/.test(majSuivi.envois[0].envoyeLe), JSON.stringify(majSuivi.envois[0]));
const majAr = expert({ action: 'enregistrerEnvoi', projetId: PID, envoi: { ...majSuivi.envois[0], statut: 'accuse', arLe: '2026-12-02', reference: 'ARS-2026-114', relanceLe: '2026-12-16' } });
verifier('accusé de réception, référence et relance conservés', majAr.envois[0].arLe === '2026-12-02' && majAr.envois[0].reference === 'ARS-2026-114' && majAr.envois[0].relanceLe === '2026-12-16', JSON.stringify(majAr.envois[0]));
verifier('l\'envoi n\'est pas dupliqué par la mise à jour', majAr.envois.length === 1, '');
verifier('pièces conservées par la mise à jour', majAr.envois[0].pieces.length === 3, '');

/* --- Lecture --- */
const vue = expert({ action: 'getAll' });
verifier('expert : lit les envois', vue.envois?.[PID]?.length === 1, JSON.stringify(vue.envois));
verifier('client : ne reçoit pas les envois', appel({ jeton: JETON_CLIENT, action: 'getAll' }).envois === undefined, '');

/* --- Suppression --- */
verifier('client : ne peut pas supprimer', !!appel({ jeton: JETON_CLIENT, action: 'supprimerEnvoi', projetId: PID, id: 'envtest0001' }).erreur, '');
const sup = expert({ action: 'supprimerEnvoi', projetId: PID, id: 'envtest0001' });
verifier('envoi supprimé', sup.envois?.length === 0, JSON.stringify(sup));

let echecs = 0;
controles.forEach(([i, ok, d]) => { if (!ok) echecs++; console.log(`${ok ? '  ok  ' : ' ÉCHEC'}  ${i}${ok ? '' : `  → ${d}`}`); });
console.log(`\n${controles.length - echecs} / ${controles.length} contrôles passés`);
assert.strictEqual(echecs, 0, `${echecs} contrôle(s) en échec`);
