/**
 * Test du questionnaire « Informations du projet ».
 *
 *   node tests/questionnaire.mjs
 *
 * Vérifie, contre le vrai code du script exécuté sur un classeur simulé :
 *   — que le client renseigne les rubriques de son seul projet ;
 *   — que le serveur écarte les rubriques et les champs inconnus, borne la
 *     taille, et fixe lui-même l'auteur et la date ;
 *   — que la relecture rend les réponses au bon projet, et à lui seul ;
 *   — que la liste des champs du serveur et celle de l'application concordent.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CODE_EXPERT = 'code-expert-de-test';
const JETON_CLIENT = 'jetonclienttestabcdefgh';   // 23 caractères, > 12 requis

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

function chargerScript(codeExpert) {
  const proprietes = new Map();
  if (codeExpert) proprietes.set('CODE_EXPERT', codeExpert);

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
    },
    DriveApp: {},
    HtmlService: {
      createHtmlOutput: (h) => ({ setTitle: () => ({ setXFrameOptionsMode: () => ({ _html: h }) }) }),
      XFrameOptionsMode: { DEFAULT: 'default' },
    },
    console,
  });

  vm.runInContext(
    readFileSync(join(RACINE, 'apps-script/Code.gs'), 'utf8')
    + '\nglobalThis.__EXPORT = { doPost, doGet, ONGLETS, AMORCE, QUESTIONNAIRE_CHAMPS };',
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

  // On attribue un jeton au deuxième projet du classeur.
  const projets = feuilles.Projets._grille;
  const iJeton = projets[0].indexOf('jeton');
  projets[2][iJeton] = JETON_CLIENT;
  const projetDuJeton = projets[2][projets[0].indexOf('id')];

  const appel = (corps) =>
    JSON.parse(contexte.__EXPORT.doPost({ postData: { contents: JSON.stringify(corps) } })._texte);

  return { appel, feuilles, projetDuJeton, doGet: contexte.__EXPORT.doGet, QUESTIONNAIRE_CHAMPS: contexte.__EXPORT.QUESTIONNAIRE_CHAMPS };
}

/* ------------------------------------------------------------ Scénarios -- */
const s = chargerScript(CODE_EXPERT);
const controles = [];
const verifier = (intitule, ok, detail) => controles.push([intitule, ok, detail]);
const P = s.projetDuJeton;
const ligne = (rub) => s.feuilles.Questionnaire._grille.find((l) => l[0] === P && l[1] === rub);
const ecrire = (porte, id, donnees, extra = {}) => s.appel({
  action: 'upsert', entite: 'questionnaire', ...porte, id, payload: { donnees: JSON.stringify(donnees), ...extra },
});

/* --- Écriture par le client --- */
const r1 = ecrire({ jeton: JETON_CLIENT }, `${P}:structure`, {
  type: 'Maison de santé pluriprofessionnelle (MSP)', nom: 'MSP Test', commune: 'Le Marigot', pirate: 'x',
}, { majPar: 'expert', majLe: '1999-01-01' });
verifier('client : renseigne une rubrique de son projet', !r1.erreur, r1.erreur);
const l1 = ligne('structure');
const d1 = l1 ? JSON.parse(l1[2]) : {};
verifier('la ligne est écrite dans l\'onglet Questionnaire', !!l1, '');
verifier('champ inconnu écarté', d1.nom === 'MSP Test' && d1.pirate === undefined, l1 && l1[2]);
verifier('auteur fixé par le serveur, pas par le navigateur', l1 && l1[4] === 'client', l1 && l1[4]);
verifier('date fixée par le serveur', l1 && /^20\d\d-/.test(l1[3]) && l1[3] !== '1999-01-01', l1 && l1[3]);

const r2 = ecrire({ jeton: JETON_CLIENT }, `${P}:equipe`, {
  pros: [{ nom: 'DIA', prenom: 'Mamady', profession: 'Médecin généraliste' }, { nom: 'THOMAS', profession: 'Médecin généraliste' }],
});
verifier('client : tableau enregistré', !r2.erreur && JSON.parse(ligne('equipe')[2]).pros.length === 2, r2.erreur);

const r3 = ecrire({ jeton: JETON_CLIENT }, `${P}:structure`, { nom: 'MSP Test modifiée' });
verifier('mise à jour sans doublon de ligne',
  !r3.erreur && s.feuilles.Questionnaire._grille.filter((l) => l[0] === P && l[1] === 'structure').length === 1, r3.erreur);

/* --- Refus --- */
const autre = s.feuilles.Projets._grille.slice(1).map((l) => l[0]).find((id) => id !== P);
const croise = ecrire({ jeton: JETON_CLIENT }, `${autre}:structure`, { nom: 'Intrus' });
verifier('client : ne peut pas écrire dans le questionnaire d\'un autre projet', !!croise.erreur, croise.erreur);

const inconnue = ecrire({ jeton: JETON_CLIENT }, `${P}:notes_internes`, { x: 'y' });
verifier('rubrique inconnue refusée', !!inconnue.erreur, inconnue.erreur);

const illisible = s.appel({ action: 'upsert', entite: 'questionnaire', jeton: JETON_CLIENT, id: `${P}:axes`, payload: { donnees: '{pas du json' } });
verifier('réponses illisibles refusées', !!illisible.erreur, illisible.erreur);

const tableau = s.appel({ action: 'upsert', entite: 'questionnaire', jeton: JETON_CLIENT, id: `${P}:axes`, payload: { donnees: '[1,2]' } });
verifier('réponses qui ne sont pas un objet refusées', !!tableau.erreur, tableau.erreur);

const enorme = ecrire({ jeton: JETON_CLIENT }, `${P}:axes`, {
  axes: Array.from({ length: 30 }, () => ({ intitule: 'x'.repeat(2900), constat: 'y'.repeat(2900) })),
});
verifier('rubrique trop volumineuse refusée', !!enorme.erreur, enorme.erreur);

const supprime = s.appel({ action: 'delete', entite: 'questionnaire', jeton: JETON_CLIENT, id: `${P}:structure` });
verifier('client : ne peut pas supprimer une rubrique', !!supprime.erreur && !!ligne('structure'), supprime.erreur);

/* --- Écriture par l'expert --- */
const rx = ecrire({ cle: CODE_EXPERT }, `${P}:logiciel`, { logiciel: 'Maiia' });
verifier('expert : complète une rubrique', !rx.erreur && ligne('logiciel')[4] === 'expert', rx.erreur);

/* --- Relecture --- */
const vueClient = s.appel({ action: 'getAll', jeton: JETON_CLIENT });
const qc = vueClient.questionnaire || {};
verifier('client : relit ses réponses', qc[P]?.structure?.donnees?.nom === 'MSP Test modifiée', JSON.stringify(qc[P]?.structure));
verifier('client : ne reçoit que son projet', Object.keys(qc).length === 1 && !!qc[P], Object.keys(qc).join(','));
verifier('relecture : tableau restitué', qc[P]?.equipe?.donnees?.pros?.[0]?.nom === 'DIA', '');
verifier('relecture : auteur restitué', qc[P]?.logiciel?.majPar === 'expert', qc[P]?.logiciel?.majPar);

const vueExpert = s.appel({ action: 'getAll', cle: CODE_EXPERT });
verifier('expert : questionnaire de chaque projet', Object.keys(vueExpert.questionnaire || {}).length === vueExpert.projets.length, '');

/* --- Concordance avec l'application --- */
const contexteAppli = vm.createContext({});
vm.runInContext(readFileSync(join(RACINE, 'assets/js/config.js'), 'utf8') + '\nglobalThis.__Q = QUESTIONNAIRE;', contexteAppli);
const serveur = s.QUESTIONNAIRE_CHAMPS;
const ecarts = [];
contexteAppli.__Q.forEach((r) => {
  if (!serveur[r.id]) { ecarts.push(`rubrique ${r.id} absente du serveur`); return; }
  r.champs.filter((c) => c.type !== 'fichiers').forEach((c) => {
    if (!serveur[r.id].includes(c.id)) ecarts.push(`${r.id}.${c.id} refusé par le serveur`);
  });
});
Object.keys(serveur).forEach((id) => {
  if (!contexteAppli.__Q.some((r) => r.id === id)) ecarts.push(`rubrique ${id} absente de l'application`);
});
verifier('les champs de l\'application sont tous acceptés par le serveur', !ecarts.length, ecarts.join(' ; '));

/* ------------------------------------------------------------ Résultats -- */
let echecs = 0;
controles.forEach(([intitule, ok, detail]) => {
  if (!ok) echecs++;
  console.log(`${ok ? '  ok  ' : ' ÉCHEC'}  ${intitule}${ok ? '' : `  → ${detail}`}`);
});
console.log(`\n${controles.length - echecs} / ${controles.length} contrôles passés`);
assert.strictEqual(echecs, 0, `${echecs} contrôle(s) en échec`);
