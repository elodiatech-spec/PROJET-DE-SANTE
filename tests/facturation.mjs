/**
 * Test de la facturation.
 *
 *   node tests/facturation.mjs
 *
 * Devis préparé d'après le devis type (échéancier 60 % / 40 %), acceptation,
 * factures d'acompte et de solde, paiement, relances, numérotation continue,
 * facture jamais supprimée, accès réservé à l'expert.
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
  if (/^(09|04)/.test(nom)) { d._racine = true; d.createFolder = (sous) => { const e = dossierEnvoi(sous); e._sous = true; dossiersCrees.push(e); return e; }; }
  dossiersCrees.push(d);
  return d;
};
dossierProjet.createFolder('04 — Finances');
const textesDoc = {};
const ID_MODELE = { F1: '1fpYIeMmmoi6Dw0UCOcaN9xhzCGLzAAGJjU_HX62Xcx4', F2: '1d6JzxzISJIbk5rLT841Hvu1m4Q02eEAbuaP1gFJQHO0', F3: '15Lz6P_OIKDnXKp33TrZEVuz5H-5u16bnjqQ_7iCLCPE' };
const NB = '\u00a0';
const MONTANTS = { F1: ['5' + NB + '900,00', '501,50', '6' + NB + '401,50'], F2: ['8' + NB + '900,00', '756,50', '9' + NB + '656,50'], F3: ['12' + NB + '500,00', '1' + NB + '062,50', '13' + NB + '562,50'] };
const MODELE_TEXTE = (f) => `DEVIS N° D26[•••••] Date : [jj/mm/aaaa] Validité : [30] jours Forfait ${f} ${MONTANTS[f][0]} € Total HT ${MONTANTS[f][0]} € TVA 8,5 % ${MONTANTS[f][1]} € TOTAL TTC ${MONTANTS[f][2]} € Règlement [À réception / selon l'échéancier : à préciser] Client : [Nom de la structure ou du client]`;
const DriveApp = {
  getFolderById: (id) => {
    if (id === ID_DOSSIER) return dossierProjet;
    const d = dossiersCrees.find((x) => x.getId() === id);
    if (d) return d;
    throw new Error('inconnu');
  },
  getFileById: (id) => {
    const f = Object.keys(ID_MODELE).find((k) => ID_MODELE[k] === id);
    if (!f) throw new Error('fichier inconnu');
    return { makeCopy: (nom, dossier) => { copies.push({ nom, d: dossier.getName() }); textesDoc.COPIE = MODELE_TEXTE(f); textesDoc.NOM = nom;
      return { getId: () => 'COPIE', getUrl: () => 'https://docs/COPIE', getName: () => nom }; } };
  },
};
const DocumentApp = {
  openById: () => ({
    getBody: () => ({ replaceText: (motif, par) => { textesDoc.COPIE = textesDoc.COPIE.replace(new RegExp(motif.replace(/\\x\{([0-9A-Fa-f]{4})\}/g, '\\u$1'), 'g'), par); } }),
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

P[1][col('formule')] = 'F2';
P[1][col('client_nom')] = 'Dr Marc Dubois';
P[1][col('client_email')] = 'client@exemple.fr';

/* --- Accès --- */
verifier('client : ne peut pas créer un devis', !!appel({ jeton: JETON_CLIENT, action: 'creerDevis', projetId: PID }).erreur, '');
verifier('montant invalide refusé', !!expert({ action: 'creerDevis', projetId: PID, montantHt: -5 }).erreur, '');

/* --- Devis --- */
const d1 = expert({ action: 'creerDevis', projetId: PID });
const devis = d1.facturation?.[0];
verifier('devis créé en brouillon, au prix de la formule F2', devis?.type === 'devis' && devis.statut === 'brouillon' && devis.montantHt === 8900 && devis.numero === 'D' + new Date().getFullYear().toString().slice(2) + '-00001', JSON.stringify(d1));
verifier('TVA 8,5 % et TTC calculés', devis.montantTva === 756.5 && devis.montantTtc === 9656.5, JSON.stringify(devis));
verifier('devis rangé dans « 04 — Finances »', copies[0]?.d === '04 — Finances' && copies[0].nom.startsWith('Devis ' + devis.numero), JSON.stringify(copies));
verifier('devis prérempli : numéro, date, validité, client', textesDoc.COPIE.includes(devis.numero) && !textesDoc.COPIE.includes('[jj/mm/aaaa]') && textesDoc.COPIE.includes('Validité : 30 jours') && textesDoc.COPIE.includes(NOM), textesDoc.COPIE);
verifier('échéancier 60 % / 40 % inscrit dans le règlement', /60 % à la commande.*40 % à la validation du projet de santé par l'ARS/.test(textesDoc.COPIE) && !textesDoc.COPIE.includes('à préciser'), textesDoc.COPIE);
verifier('montants du modèle conservés au prix standard', textesDoc.COPIE.includes('8' + NB + '900,00'), '');
verifier('second devis refusé tant que le premier est en cours', !!expert({ action: 'creerDevis', projetId: PID }).erreur, '');

/* --- Facturer avant acceptation --- */
verifier('pas de facture avant acceptation du devis', /accepté/.test(expert({ action: 'creerFacture', projetId: PID, devisId: devis.id, tranche: 'commande' }).erreur || ''), '');
verifier('état de devis inconnu refusé', !!expert({ action: 'enregistrerFacturation', projetId: PID, doc: { id: devis.id, statut: 'payee' } }).erreur, '');
const env = expert({ action: 'enregistrerFacturation', projetId: PID, doc: { id: devis.id, statut: 'envoye' } });
verifier('devis envoyé', env.facturation[0].statut === 'envoye', '');
const acc = expert({ action: 'enregistrerFacturation', projetId: PID, doc: { id: devis.id, statut: 'accepte' } });
verifier('devis accepté : date d\'acceptation posée', acc.facturation[0].statut === 'accepte' && /^\d{4}-\d{2}-\d{2}$/.test(acc.facturation[0].accepteLe), JSON.stringify(acc.facturation[0]));

/* --- Acompte de 60 % --- */
verifier('client : ne peut pas facturer', !!appel({ jeton: JETON_CLIENT, action: 'creerFacture', projetId: PID, devisId: devis.id, tranche: 'commande' }).erreur, '');
verifier('tranche inconnue refusée', !!expert({ action: 'creerFacture', projetId: PID, devisId: devis.id, tranche: 'zz' }).erreur, '');
const f1 = expert({ action: 'creerFacture', projetId: PID, devisId: devis.id, tranche: 'commande' });
const acompte = f1.facturation.find((x) => x.type === 'facture');
verifier('acompte : 60 % de 8 900 € HT = 5 340 € HT', acompte?.montantHt === 5340 && acompte.tranche === 'commande' && acompte.statut === 'emise', JSON.stringify(acompte));
verifier('acompte : TVA 453,90 € et TTC 5 793,90 €', acompte.montantTva === 453.9 && acompte.montantTtc === 5793.9, JSON.stringify(acompte));
verifier('numérotation des factures indépendante de celle des devis', /^F\d{2}-00001$/.test(acompte.numero), acompte.numero);
const docAcompte = uploads.find((u) => u.includes('FACTURE') && u.includes(acompte.numero));
verifier('facture : émetteur, client, montants, pénalités, escompte', !!docAcompte && docAcompte.includes('SIRET 921 549 531 00017') && docAcompte.includes(NOM) && docAcompte.includes('5\u00a0340,00\u00a0€')
  && docAcompte.includes('40 €') && docAcompte.includes('pas d\'escompte'), (docAcompte || '').slice(0, 200));
verifier('coordonnées bancaires absentes : signalées à compléter', docAcompte.includes('[à compléter dans la fiche Société émettrice]'), '');
verifier('acompte déjà facturé : refus du doublon', /déjà facturée/.test(expert({ action: 'creerFacture', projetId: PID, devisId: devis.id, tranche: 'commande' }).erreur || ''), '');

/* --- Solde de 40 % : après validation par l'ARS --- */
verifier('solde refusé tant que l\'ARS n\'a pas validé', /ARS/.test(expert({ action: 'creerFacture', projetId: PID, devisId: devis.id, tranche: 'validation_ars' }).erreur || ''), '');
const val = expert({ action: 'enregistrerFacturation', projetId: PID, doc: { id: devis.id, arsValideLe: '2027-03-15' } });
verifier('date de validation ARS enregistrée', val.facturation[0].arsValideLe === '2027-03-15', '');
const f2 = expert({ action: 'creerFacture', projetId: PID, devisId: devis.id, tranche: 'validation_ars' });
const solde = f2.facturation.filter((x) => x.type === 'facture').find((x) => x.tranche === 'validation_ars');
verifier('solde : 40 % = 3 560 € HT (total moins acompte, sans écart d\'arrondi)', solde?.montantHt === 3560 && solde.montantHt + acompte.montantHt === devis.montantHt, JSON.stringify(solde));
const docSolde = uploads.find((u) => u.includes(solde.numero));
verifier('facture de solde : rappelle le devis, l\'acompte et la validation ARS', docSolde.includes('15/03/2027') && docSolde.includes(devis.numero) && docSolde.includes('5\u00a0340,00\u00a0€ HT'), '');
verifier('numéros consécutifs', Number(solde.numero.slice(-5)) === Number(acompte.numero.slice(-5)) + 1, `${acompte.numero} ${solde.numero}`);
verifier('devis accepté et facturé : état figé', !!expert({ action: 'enregistrerFacturation', projetId: PID, doc: { id: devis.id, statut: 'refuse' } }).erreur, '');

/* --- Paiement et relances --- */
const rel = expert({ action: 'enregistrerFacturation', projetId: PID, doc: { id: acompte.id, relances: [{ date: '2026-12-10', niveau: 1 }, { date: '2026-12-28', niveau: 2 }] } });
const apresRel = rel.facturation.find((x) => x.id === acompte.id);
verifier('relances consignées avec leur niveau', apresRel.relances.length === 2 && apresRel.relances[1].niveau === 2, JSON.stringify(apresRel.relances));
verifier('date de relance invalide refusée', !!expert({ action: 'enregistrerFacturation', projetId: PID, doc: { id: acompte.id, relances: [{ date: 'hier', niveau: 1 }] } }).erreur, '');
const pay = expert({ action: 'enregistrerFacturation', projetId: PID, doc: { id: acompte.id, statut: 'payee', payeLe: '2026-12-30', modePaiement: 'Virement' } });
const payee = pay.facturation.find((x) => x.id === acompte.id);
verifier('facture payée : date et mode consignés', payee.statut === 'payee' && payee.payeLe === '2026-12-30' && payee.modePaiement === 'Virement', JSON.stringify(payee));
verifier('les montants d\'une facture ne changent pas', payee.montantHt === 5340, '');
verifier('une facture ne se supprime pas', /s.annule/.test(expert({ action: 'supprimerFacturation', projetId: PID, id: acompte.id }).erreur || ''), '');
const ann = expert({ action: 'enregistrerFacturation', projetId: PID, doc: { id: solde.id, statut: 'annulee' } });
verifier('facture annulée, conservée dans la numérotation', ann.facturation.find((x) => x.id === solde.id).statut === 'annulee', '');
verifier('facture annulée : ne se rouvre pas', !!expert({ action: 'enregistrerFacturation', projetId: PID, doc: { id: solde.id, statut: 'emise' } }).erreur, '');
const f3 = expert({ action: 'creerFacture', projetId: PID, devisId: devis.id, tranche: 'validation_ars' });
verifier('tranche annulée : refacturable avec un nouveau numéro', Number(f3.facturation.filter((x) => x.type === 'facture').pop().numero.slice(-5)) === Number(solde.numero.slice(-5)) + 1, '');

/* --- Montant personnalisé : les trois montants du modèle sont remplacés --- */
const PID2 = P[2][col('id')];
P[2][col('formule')] = 'F3';
P[2][col('drive_url')] = P[1][col('drive_url')];
const dp = expert({ action: 'creerDevis', projetId: PID2, montantHt: 9500 });
const devis2 = dp.facturation?.[0];
verifier('devis à montant personnalisé : 9 500 € HT', devis2?.montantHt === 9500 && devis2.montantTtc === 10307.5, JSON.stringify(dp));
verifier('montants du modèle F3 remplacés (HT, TVA, TTC)', textesDoc.COPIE.includes('9' + NB + '500,00') && textesDoc.COPIE.includes('807,50') && textesDoc.COPIE.includes('10' + NB + '307,50')
  && !textesDoc.COPIE.includes('12' + NB + '500,00') && !textesDoc.COPIE.includes('13' + NB + '562,50'), textesDoc.COPIE);
verifier('numéro de devis suivant dans la série', devis2.numero.endsWith('-00002'), devis2.numero);
const sup = expert({ action: 'supprimerFacturation', projetId: PID2, id: devis2.id });
verifier('devis en brouillon : se supprime', sup.facturation?.length === 0, JSON.stringify(sup));

/* --- Lecture, suppression --- */
const vue = expert({ action: 'getAll' });
verifier('expert : lit la facturation', vue.facturation?.[PID]?.length >= 4, JSON.stringify(Object.keys(vue.facturation || {})));
verifier('client : ne reçoit pas la facturation', appel({ jeton: JETON_CLIENT, action: 'getAll' }).facturation === undefined, '');
verifier('client : ne peut pas modifier la facturation', !!appel({ jeton: JETON_CLIENT, action: 'enregistrerFacturation', projetId: PID, doc: { id: devis.id, statut: 'envoye' } }).erreur, '');

let echecs = 0;
controles.forEach(([i, ok, d]) => { if (!ok) echecs++; console.log(`${ok ? '  ok  ' : ' ÉCHEC'}  ${i}${ok ? '' : `  → ${d}`}`); });
console.log(`\n${controles.length - echecs} / ${controles.length} contrôles passés`);
assert.strictEqual(echecs, 0, `${echecs} contrôle(s) en échec`);
