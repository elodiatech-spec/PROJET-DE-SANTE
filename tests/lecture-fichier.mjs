/**
 * Test de la lecture de fichiers par la passerelle.
 *
 *   node tests/lecture-fichier.mjs
 *
 * Le script lit les fichiers avec les droits du compte propriétaire : il pourrait
 * donc renvoyer n'importe quel fichier de ce Drive. Le contrôle décisif est que
 * le fichier demandé descende bien du dossier du projet — sans lui, un jeton
 * client deviendrait une clé de lecture sur l'ensemble du Drive.
 *
 * Ce test éprouve ce contrôle sur un Drive simulé où cohabitent le dossier d'un
 * client, celui d'un autre client, et un dossier privé hors de tout projet.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CODE_EXPERT = 'code-expert-de-test';
const JETON_CLIENT = 'jetonclienttestabcdefgh';

const ID_DOSSIER_CLIENT = '1AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPp';
const ID_DOSSIER_AUTRE = '1ZzYyXxWwVvUuTtSsRrQqPpOoNnMmLlKk';

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
    appendRow: (v) => { grille.push(v.slice()); },
    deleteRow: (l) => { grille.splice(l - 1, 1); },
    _grille: grille,
  };
}

/* -------------------------------------------------------- Drive simulé --- */
/**
 * Arbre simulé. Chaque fichier connaît ses parents, chaque dossier les siens :
 * c'est exactement ce que `fichierDansDossier` remonte.
 */
function construireDrive() {
  const dossiers = {};
  const fichiers = {};

  const creerDossier = (id, nom, parents) => {
    dossiers[id] = {
      _id: id, _parents: parents,
      getId: () => id,
      getName: () => nom,
      getParents: () => {
        let i = 0;
        return { hasNext: () => i < parents.length, next: () => dossiers[parents[i++]] };
      },
    };
  };

  const creerFichier = (id, nom, parents, contenu, mime) => {
    fichiers[id] = {
      getId: () => id,
      getName: () => nom,
      getMimeType: () => mime,
      getBlob: () => ({
        getBytes: () => Buffer.from(contenu),
        getContentType: () => mime,
      }),
      // Un Google Docs n'a pas de contenu binaire : seul `getAs` en produit un.
      getAs: (cible) => {
        if (mime.indexOf('application/vnd.google-apps.') !== 0) {
          throw new Error(`getAs inattendu sur ${mime}`);
        }
        return {
          getBytes: () => Buffer.from(`%PDF export de ${nom}`),
          getContentType: () => cible,
        };
      },
      getParents: () => {
        let i = 0;
        return { hasNext: () => i < parents.length, next: () => dossiers[parents[i++]] };
      },
    };
  };

  // Racine, dossiers de projet, sous-dossiers de catégorie, et un dossier privé.
  creerDossier('racine', 'ElodiaTech — Projets', []);
  creerDossier(ID_DOSSIER_CLIENT, 'MSP du jeton', ['racine']);
  creerDossier(ID_DOSSIER_AUTRE, 'Autre MSP', ['racine']);
  creerDossier('sous-juridique', '02 — Juridique', [ID_DOSSIER_CLIENT]);
  creerDossier('prive', 'Comptabilité ElodiaTech', ['racine']);

  creerFichier('f-client', 'Statuts.pdf', ['sous-juridique'], 'contenu des statuts', 'application/pdf');
  creerFichier('f-autre', 'Convention.pdf', [ID_DOSSIER_AUTRE], 'contenu autre client', 'application/pdf');
  creerFichier('f-prive', 'Bilan_ElodiaTech.pdf', ['prive'], 'contenu confidentiel', 'application/pdf');

  // Un Google Docs rangé dans le dossier du projet : doit être exporté en PDF.
  creerFichier('f-gdoc', 'Reglement de fonctionnement', ['sous-juridique'],
    '(contenu non binaire)', 'application/vnd.google-apps.document');

  return { dossiers, fichiers };
}

function chargerScript() {
  const proprietes = new Map([['CODE_EXPERT', CODE_EXPERT]]);
  const drive = construireDrive();

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
      base64Encode: (o) => Buffer.from(o).toString('base64'),
      newBlob: (octets, mime, nom) => ({ _octets: octets, _mime: mime, _nom: nom }),
    },
    DriveApp: {
      getFolderById: (id) => {
        if (!drive.dossiers[id]) throw new Error(`Dossier introuvable : ${id}`);
        return drive.dossiers[id];
      },
      getFileById: (id) => {
        if (!drive.fichiers[id]) throw new Error(`Fichier introuvable : ${id}`);
        return drive.fichiers[id];
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

  const projets = feuilles.Projets._grille;
  const iJeton = projets[0].indexOf('jeton');
  const iUrl = projets[0].indexOf('drive_url');
  const iId = projets[0].indexOf('id');

  projets[2][iJeton] = JETON_CLIENT;
  projets[2][iUrl] = `https://drive.google.com/drive/folders/${ID_DOSSIER_CLIENT}`;
  projets[3][iUrl] = `https://drive.google.com/drive/folders/${ID_DOSSIER_AUTRE}`;

  const appel = (corps) =>
    JSON.parse(contexte.__EXPORT.doPost({ postData: { contents: JSON.stringify(corps) } })._texte);

  return { appel, projetDuJeton: projets[2][iId], projetAutre: projets[3][iId] };
}

/* ------------------------------------------------------------ Scénarios -- */
const s = chargerScript();
const controles = [];
const verifier = (intitule, ok, detail) => controles.push([intitule, ok, detail]);

const lire = (extra) => s.appel({ action: 'lireFichier', ...extra });

/* --- Refus d'accès --- */
const sansRien = lire({ projetId: s.projetDuJeton, fileId: 'f-client' });
verifier('sans code ni jeton : refusé', !!sansRien.erreur && !sansRien.fichier, sansRien.erreur);

/* --- Lecture légitime --- */
const parExpert = lire({ projetId: s.projetDuJeton, fileId: 'f-client', cle: CODE_EXPERT });
verifier('expert : lit un fichier du dossier du projet', !parExpert.erreur && !!parExpert.fichier, parExpert.erreur);
verifier('le contenu est renvoyé en base64',
  parExpert.fichier?.contenu === Buffer.from('contenu des statuts').toString('base64'),
  parExpert.fichier?.contenu);
verifier('le type MIME est renvoyé', parExpert.fichier?.mimeType === 'application/pdf', parExpert.fichier?.mimeType);
verifier('le nom est renvoyé', parExpert.fichier?.nom === 'Statuts.pdf', parExpert.fichier?.nom);

const parClient = lire({ projetId: s.projetDuJeton, fileId: 'f-client', jeton: JETON_CLIENT });
verifier('client : lit un fichier de son propre dossier — sans aucun droit Drive',
  !parClient.erreur && !!parClient.fichier, parClient.erreur);

/* --- Document Google : exporté en PDF, pas servi tel quel --- */
const gdoc = lire({ projetId: s.projetDuJeton, fileId: 'f-gdoc', cle: CODE_EXPERT });
verifier('un Google Docs du dossier du projet est lisible', !gdoc.erreur && !!gdoc.fichier, gdoc.erreur);
verifier('il est converti en PDF, non servi dans son format natif',
  gdoc.fichier?.mimeType === 'application/pdf', gdoc.fichier?.mimeType);
verifier('son nom reçoit l\'extension .pdf, sans quoi le téléchargement serait inouvrable',
  gdoc.fichier?.nom === 'Reglement de fonctionnement.pdf', gdoc.fichier?.nom);
verifier('le contenu exporté est bien renvoyé',
  gdoc.fichier?.contenu === Buffer.from('%PDF export de Reglement de fonctionnement').toString('base64'),
  gdoc.fichier?.contenu?.slice(0, 30));

const gdocClient = lire({ projetId: s.projetDuJeton, fileId: 'f-gdoc', jeton: JETON_CLIENT });
verifier('le client lit ce Google Docs sans compte Google ni partage',
  !gdocClient.erreur && gdocClient.fichier?.mimeType === 'application/pdf', gdocClient.erreur);

/* --- Le contrôle décisif : cloisonnement du Drive --- */
const filePrive = lire({ projetId: s.projetDuJeton, fileId: 'f-prive', jeton: JETON_CLIENT });
verifier('client : ne peut pas lire un fichier privé hors de tout projet',
  !!filePrive.erreur && !filePrive.fichier, filePrive.erreur);

const fileAutreClient = lire({ projetId: s.projetDuJeton, fileId: 'f-autre', jeton: JETON_CLIENT });
verifier('client : ne peut pas lire le fichier d\'un autre client via son propre projet',
  !!fileAutreClient.erreur && !fileAutreClient.fichier, fileAutreClient.erreur);

// Le refus « hors projet » porte un code : l'application s'en sert pour basculer
// sur l'affichage par adresse Drive, qui convient à un lien collé vers un
// fichier partagé vivant ailleurs. Sans ce code, elle devrait deviner en lisant
// le message — et casserait au premier reformulage.
verifier('le refus hors-projet est identifiable par son code, pas par son message',
  filePrive.code === 'hors-projet', filePrive.code);
verifier('un refus de cloisonnement client garde ce même code',
  fileAutreClient.code === 'hors-projet', fileAutreClient.code);

const jetonInvalide = lire({ projetId: s.projetDuJeton, fileId: 'f-client', jeton: 'jetonquinexistepasdutout' });
verifier('un refus d\'authentification ne porte pas le code hors-projet',
  !!jetonInvalide.erreur && jetonInvalide.code !== 'hors-projet',
  `${jetonInvalide.erreur} / code « ${jetonInvalide.code} »`);

const croise = lire({ projetId: s.projetAutre, fileId: 'f-autre', jeton: JETON_CLIENT });
verifier('client : ne peut pas lire en désignant le projet d\'un autre',
  !!croise.erreur && !croise.fichier, croise.erreur);

// L'expert non plus ne doit pas sortir du dossier du projet désigné : le contrôle
// vaut pour tous, pas seulement pour les clients.
const expertHorsProjet = lire({ projetId: s.projetDuJeton, fileId: 'f-prive', cle: CODE_EXPERT });
verifier('expert : ne peut pas lire un fichier étranger au projet désigné',
  !!expertHorsProjet.erreur && !expertHorsProjet.fichier, expertHorsProjet.erreur);

const expertAutreProjet = lire({ projetId: s.projetAutre, fileId: 'f-autre', cle: CODE_EXPERT });
verifier('expert : lit bien le fichier du projet qu\'il désigne',
  !expertAutreProjet.erreur && !!expertAutreProjet.fichier, expertAutreProjet.erreur);

/* --- Refus explicites --- */
const sansFichier = lire({ projetId: s.projetDuJeton, cle: CODE_EXPERT });
verifier('fichier non précisé : refusé', !!sansFichier.erreur, sansFichier.erreur);

const sansProjet = lire({ fileId: 'f-client', cle: CODE_EXPERT });
verifier('projet non précisé : refusé', !!sansProjet.erreur, sansProjet.erreur);

const inconnu = lire({ projetId: s.projetDuJeton, fileId: 'fichier-qui-nexiste-pas', cle: CODE_EXPERT });
verifier('fichier inexistant : refus explicite',
  !!inconnu.erreur && /introuvable/i.test(inconnu.erreur), inconnu.erreur);

/* ------------------------------------------------------------- Rapport --- */
let echecs = 0;
controles.forEach(([intitule, ok, detail]) => {
  if (!ok) echecs += 1;
  console.log(`  ${ok ? 'ok  ' : 'ÉCHEC'}  ${intitule}${!ok && detail ? `  → ${detail}` : ''}`);
});
console.log(`\n${controles.length - echecs} / ${controles.length} contrôles passés`);
process.exit(echecs ? 1 : 0);
