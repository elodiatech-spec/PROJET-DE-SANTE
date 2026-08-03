/**
 * Test du dépôt de fichiers dans le Drive.
 *
 *   node tests/televersement.mjs
 *
 * Vérifie, contre le vrai code du script Apps Script exécuté sur un classeur et
 * un Drive simulés, que le fichier atterrit dans le bon sous-dossier, qu'un
 * jeton client ne dépose que chez lui, et qu'un refus est toujours explicite.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CODE_EXPERT = 'code-expert-de-test';
const JETON_CLIENT = 'jetonclienttestabcdefgh';

// Identifiants de 33 caractères, comme ceux que Drive attribue réellement.
const ID_DOSSIER_CLIENT = '1AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPp';
const ID_DOSSIER_AUTRE = '1ZzYyXxWwVvUuTtSsRrQqPpOoNnMmLlKk';

/** Les huit sous-dossiers du gabarit, tels que le Drive les porte. */
const SOUS_DOSSIERS = [
  '01 — Projet de santé', '02 — Juridique', '03 — Dossier ARS', '04 — Finances',
  '05 — Immobilier', '06 — Équipe', '07 — Partenariats', '08 — Identité visuelle',
];

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
      setValue: (v) => { grille[ligne - 1][colonne - 1] = v; },
      getValue: () => grille[ligne - 1][colonne - 1],
    }),
    appendRow: (v) => {
      const c = v.slice();
      while (c.length < entetes.length) c.push('');
      grille.push(c);
    },
    deleteRow: (l) => { grille.splice(l - 1, 1); },
    _grille: grille,
  };
}

/* -------------------------------------------------------- Drive simulé --- */
function dossierSimule(nom, sousNoms, crees) {
  const sous = (sousNoms || []).map((n) => dossierSimule(n, [], crees));
  return {
    getName: () => nom,
    getUrl: () => `https://drive.google.com/drive/folders/ID_${nom}`,
    getFolders: () => {
      let i = 0;
      return { hasNext: () => i < sous.length, next: () => sous[i++] };
    },
    createFolder: (n) => {
      const d = dossierSimule(n, [], crees);
      sous.push(d);
      return d;
    },
    createFile: (blob) => {
      const fichier = {
        getId: () => `fichier_${crees.length + 1}`,
        getName: () => blob._nom,
        getUrl: () => `https://drive.google.com/file/d/fichier_${crees.length + 1}/view`,
      };
      crees.push({ dossier: nom, nom: blob._nom, mime: blob._mime, octets: blob._octets.length });
      return fichier;
    },
  };
}

function chargerScript() {
  const proprietes = new Map([['CODE_EXPERT', CODE_EXPERT]]);
  const crees = [];

  const dossiers = {
    [ID_DOSSIER_CLIENT]: dossierSimule('MSP du jeton', SOUS_DOSSIERS, crees),
    [ID_DOSSIER_AUTRE]: dossierSimule('Autre MSP', SOUS_DOSSIERS, crees),
  };

  const contexte = vm.createContext({
    SpreadsheetApp: { getActive: () => contexte.__classeur, flush: () => {} },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (proprietes.has(k) ? proprietes.get(k) : null),
        setProperty: (k, v) => proprietes.set(k, v),
      }),
    },
    ContentService: {
      createTextOutput: (s) => ({ setMimeType: () => ({ _texte: s }) }),
      MimeType: { JSON: 'json' },
    },
    Utilities: {
      formatDate: (d) => d.toISOString().slice(0, 10),
      getUuid: () => '0123456789abcdef0123456789abcdef',
      base64Decode: (s) => Buffer.from(s, 'base64'),
      newBlob: (octets, mime, nom) => ({ _octets: octets, _mime: mime, _nom: nom }),
    },
    DriveApp: {
      getFolderById: (id) => {
        if (!dossiers[id]) throw new Error(`Dossier introuvable : ${id}`);
        return dossiers[id];
      },
    },
    HtmlService: {
      createHtmlOutput: (h) => ({ setTitle: () => ({ setXFrameOptionsMode: () => ({ _html: h }) }) }),
      XFrameOptionsMode: { DEFAULT: 'default' },
    },
    console,
  });

  vm.runInContext(
    readFileSync(join(RACINE, 'apps-script/Code.gs'), 'utf8')
    + '\nglobalThis.__EXPORT = { doPost, ONGLETS, AMORCE };',
    contexte);

  const { ONGLETS, AMORCE } = contexte.__EXPORT;

  const feuilles = {};
  Object.keys(ONGLETS).forEach((nom) => {
    feuilles[nom] = feuilleSimulee(nom, ONGLETS[nom], AMORCE[nom] || []);
  });
  contexte.__classeur = {
    getSheetByName: (n) => feuilles[n] || null,
    getSheets: () => Object.values(feuilles),
  };

  // Le deuxième projet reçoit le jeton et un vrai dossier Drive ; le troisième
  // un dossier aussi, mais pas de jeton ; le quatrième reste sans dossier.
  const projets = feuilles.Projets._grille;
  const iJeton = projets[0].indexOf('jeton');
  const iUrl = projets[0].indexOf('drive_url');
  const iId = projets[0].indexOf('id');

  projets[2][iJeton] = JETON_CLIENT;
  // Adresse suffixée, comme celles que Drive donne au partage.
  projets[2][iUrl] = `https://drive.google.com/drive/folders/${ID_DOSSIER_CLIENT}?usp=sharing`;
  projets[3][iUrl] = `https://drive.google.com/drive/folders/${ID_DOSSIER_AUTRE}`;
  projets[4][iUrl] = '';

  const appel = (corps) =>
    JSON.parse(contexte.__EXPORT.doPost({ postData: { contents: JSON.stringify(corps) } })._texte);

  return {
    appel, feuilles, crees,
    projetDuJeton: projets[2][iId],
    projetAutre: projets[3][iId],
    projetSansDossier: projets[4][iId],
  };
}

/* ------------------------------------------------------------ Scénarios -- */
const s = chargerScript();
const controles = [];
const verifier = (intitule, ok, detail) => controles.push([intitule, ok, detail]);

const contenu = Buffer.from('Statuts de la SISA — projet de test').toString('base64');

const deposer = (extra) => s.appel({
  action: 'televerser', nom: 'statuts.pdf', mimeType: 'application/pdf',
  categorie: 'Juridique', contenu, ...extra,
});

/* --- Refus d'accès --- */
const sansRien = deposer({ projetId: s.projetDuJeton });
verifier('sans code ni jeton : refusé', !!sansRien.erreur && !sansRien.fichier, sansRien.erreur);

const mauvaisCode = deposer({ projetId: s.projetDuJeton, cle: 'pas-le-bon-code' });
verifier('mauvais code : refusé', !!mauvaisCode.erreur && !mauvaisCode.fichier, mauvaisCode.erreur);

verifier('aucun fichier créé par les tentatives refusées', s.crees.length === 0, s.crees.length);

/* --- L'expert dépose --- */
const parExpert = deposer({ projetId: s.projetDuJeton, cle: CODE_EXPERT });
verifier('expert : dépôt accepté', !parExpert.erreur && !!parExpert.fichier, parExpert.erreur);
verifier('expert : rangé dans « 02 — Juridique »',
  parExpert.fichier?.dossier === '02 — Juridique', parExpert.fichier?.dossier);
verifier('la référence porte une adresse de fichier',
  /^https:\/\/drive\.google\.com\/file\//.test(parExpert.fichier?.url || ''), parExpert.fichier?.url);
verifier('la référence porte le nom du fichier',
  parExpert.fichier?.nom === 'statuts.pdf', parExpert.fichier?.nom);
// 37 octets et non 34 caractères : le tiret cadratin en pèse trois à lui seul.
verifier('la taille est lisible', parExpert.fichier?.taille === '37 o', parExpert.fichier?.taille);
verifier('le contenu est décodé, pas transmis en base64',
  s.crees[0]?.octets === 37, s.crees[0]?.octets);
verifier('le type MIME est conservé', s.crees[0]?.mime === 'application/pdf', s.crees[0]?.mime);

/* --- Chaque catégorie tombe dans son sous-dossier --- */
const attendus = {
  Projet: '01 — Projet de santé', Juridique: '02 — Juridique', ARS: '03 — Dossier ARS',
  Finances: '04 — Finances', Immobilier: '05 — Immobilier', 'Équipe': '06 — Équipe',
  Partenariats: '07 — Partenariats', 'Identité': '08 — Identité visuelle',
};
const mauvaises = Object.keys(attendus).filter((cat) => {
  const r = deposer({ projetId: s.projetDuJeton, cle: CODE_EXPERT, categorie: cat });
  return r.fichier?.dossier !== attendus[cat];
});
verifier('les huit catégories tombent dans leur sous-dossier',
  mauvaises.length === 0, mauvaises.join(', '));

const inconnue = deposer({ projetId: s.projetDuJeton, cle: CODE_EXPERT, categorie: 'Fantaisie' });
verifier('catégorie inconnue : repli sur le dossier du projet',
  inconnue.fichier?.dossier === 'MSP du jeton', inconnue.fichier?.dossier);

/* --- Le client dépose, mais chez lui seulement --- */
const parClient = deposer({ projetId: s.projetDuJeton, jeton: JETON_CLIENT });
verifier('client : dépôt accepté sur son projet', !parClient.erreur && !!parClient.fichier, parClient.erreur);

const avant = s.crees.length;
const croise = deposer({ projetId: s.projetAutre, jeton: JETON_CLIENT });
verifier('client : dépôt refusé sur le projet d\'un autre', !!croise.erreur, croise.erreur);
verifier('client : rien créé dans le Drive de l\'autre', s.crees.length === avant, s.crees.length - avant);

/* --- Refus explicites --- */
const sansProjet = deposer({ projetId: '', cle: CODE_EXPERT });
verifier('projet non précisé : refusé', !!sansProjet.erreur, sansProjet.erreur);

const sansDossier = deposer({ projetId: s.projetSansDossier, cle: CODE_EXPERT });
verifier('projet sans dossier Drive : refus expliqué',
  /dossier Drive/i.test(sansDossier.erreur || '') && /Portefeuille clients/.test(sansDossier.erreur || ''),
  sansDossier.erreur);

const vide = deposer({ projetId: s.projetDuJeton, cle: CODE_EXPERT, contenu: '' });
verifier('fichier vide : refusé', !!vide.erreur, vide.erreur);

const sansNom = deposer({ projetId: s.projetDuJeton, cle: CODE_EXPERT, nom: '   ' });
verifier('nom manquant : refusé', !!sansNom.erreur, sansNom.erreur);

// 11 Mo dépassent le plafond de 10 Mo : le refus doit citer la taille.
const trosGros = deposer({
  projetId: s.projetDuJeton, cle: CODE_EXPERT,
  contenu: Buffer.alloc(11 * 1024 * 1024, 0).toString('base64'),
});
verifier('fichier trop volumineux : refusé',
  !!trosGros.erreur && /Mo/.test(trosGros.erreur), trosGros.erreur);

/* --- Innocuité --- */
const glissant = deposer({
  projetId: s.projetDuJeton, cle: CODE_EXPERT, nom: '../../etc/passwd',
});
verifier('les barres obliques du nom sont neutralisées',
  glissant.fichier?.nom.indexOf('/') === -1, glissant.fichier?.nom);

const projetsAvant = JSON.stringify(s.feuilles.Projets._grille);
deposer({ projetId: s.projetDuJeton, cle: CODE_EXPERT });
verifier('un dépôt ne touche pas à la feuille Projets',
  JSON.stringify(s.feuilles.Projets._grille) === projetsAvant, '');
verifier('un dépôt n\'inscrit rien dans l\'onglet Documents',
  s.feuilles.Documents._grille.every((l) => !String(l.join('')).includes('statuts.pdf')), '');

/* --- Cohérence du plafond entre le script et l'application --- */
const plafondScript = readFileSync(join(RACINE, 'apps-script/Code.gs'), 'utf8')
  .match(/TAILLE_MAX_OCTETS\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/);
const plafondApp = readFileSync(join(RACINE, 'assets/js/config.js'), 'utf8')
  .match(/TAILLE_MAX_DEPOT\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/);
verifier('le plafond annoncé par l\'application est celui du script',
  !!plafondScript && !!plafondApp && plafondScript[1] === plafondApp[1],
  `script ${plafondScript?.[1]} Mo / app ${plafondApp?.[1]} Mo`);

/* ------------------------------------------------------------- Rapport --- */
let echecs = 0;
controles.forEach(([intitule, ok, detail]) => {
  if (!ok) echecs += 1;
  console.log(`  ${ok ? 'ok  ' : 'ÉCHEC'}  ${intitule}${!ok && detail ? `  → ${detail}` : ''}`);
});
console.log(`\n${controles.length - echecs} / ${controles.length} contrôles passés`);
process.exit(echecs ? 1 : 0);
