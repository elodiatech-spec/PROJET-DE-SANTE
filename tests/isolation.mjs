/**
 * Test du cloisonnement des accès.
 *
 *   node tests/isolation.mjs
 *
 * Vérifie, contre le vrai code du script Apps Script exécuté sur un classeur
 * simulé, qu'un jeton client ne rapporte que son propre dossier et ne permet
 * d'écrire que ce qui lui est permis — quoi que prétende le navigateur qui
 * envoie la requête.
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
    + '\nglobalThis.__EXPORT = { doPost, doGet, ONGLETS, AMORCE };',
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

  return { appel, feuilles, projetDuJeton, doGet: contexte.__EXPORT.doGet };
}

/* ------------------------------------------------------------ Scénarios -- */
const s = chargerScript(CODE_EXPERT);
const controles = [];
const verifier = (intitule, ok, detail) => controles.push([intitule, ok, detail]);

/* --- Lecture --- */
const sansRien = s.appel({ action: 'getAll' });
verifier('sans code ni jeton : refusé', !!sansRien.erreur && !sansRien.projets, JSON.stringify(sansRien).slice(0, 80));

const mauvaisCode = s.appel({ action: 'getAll', cle: 'pas-le-bon-code' });
verifier('mauvais code : refusé', !!mauvaisCode.erreur && !mauvaisCode.projets, JSON.stringify(mauvaisCode).slice(0, 80));

const mauvaisJeton = s.appel({ action: 'getAll', jeton: 'jetonquinexistepasdutout' });
verifier('jeton inconnu : refusé', !!mauvaisJeton.erreur && !mauvaisJeton.projets, JSON.stringify(mauvaisJeton).slice(0, 80));

const expert = s.appel({ action: 'getAll', cle: CODE_EXPERT });
verifier('code expert : tout le portefeuille', Array.isArray(expert.projets) && expert.projets.length === 4, expert.projets?.length);

const client = s.appel({ action: 'getAll', jeton: JETON_CLIENT });
verifier('jeton client : un seul dossier', Array.isArray(client.projets) && client.projets.length === 1, client.projets?.length);
verifier('jeton client : le bon dossier', client.projets?.[0]?.id === s.projetDuJeton, client.projets?.[0]?.id);

/* --- Ce que le client ne doit pas recevoir --- */
const brut = JSON.stringify(client);
const autresProjets = expert.projets.filter((p) => p.id !== s.projetDuJeton);
verifier('aucun nom d\'un autre client dans la réponse',
  !autresProjets.some((p) => brut.includes(p.nom)),
  autresProjets.filter((p) => brut.includes(p.nom)).map((p) => p.nom).join(', '));
verifier('aucun porteur d\'un autre client dans la réponse',
  !autresProjets.some((p) => p.client?.nom && brut.includes(p.client.nom)), '');
verifier('notes internes absentes', client.projets[0].notes === '', client.projets[0].notes);
verifier('jeton absent de sa propre fiche', !client.projets[0].jeton, client.projets[0].jeton);
verifier('expert : notes et jeton présents',
  expert.projets.some((p) => p.jeton === JETON_CLIENT), '');

/* --- Écritures du client --- */
const okPresta = s.appel({
  action: 'upsert', entite: 'prestations', jeton: JETON_CLIENT,
  id: `${s.projetDuJeton}:P08`, payload: { statut: 'valide' },
});
verifier('client : peut valider une prestation de son projet', !okPresta.erreur, okPresta.erreur);

const okMessage = s.appel({
  action: 'upsert', entite: 'messages', jeton: JETON_CLIENT,
  id: `${s.projetDuJeton}:mtest`, payload: { auteur: 'Client', role: 'client', texte: 'Bonjour', date: '2026-08-02' },
});
verifier('client : peut écrire un message', !okMessage.erreur, okMessage.erreur);

const autreProjet = autresProjets[0].id;
const croise = s.appel({
  action: 'upsert', entite: 'prestations', jeton: JETON_CLIENT,
  id: `${autreProjet}:P08`, payload: { statut: 'valide' },
});
verifier('client : ne peut pas écrire chez un autre client', !!croise.erreur, croise.erreur);

const changeFormule = s.appel({
  action: 'upsert', entite: 'projets', jeton: JETON_CLIENT,
  id: s.projetDuJeton, payload: { formule: 'F3' },
});
verifier('client : ne peut pas changer sa formule', !!changeFormule.erreur, changeFormule.erreur);

const supprime = s.appel({ action: 'delete', entite: 'projets', jeton: JETON_CLIENT, id: s.projetDuJeton });
verifier('client : ne peut rien supprimer', !!supprime.erreur, supprime.erreur);

const finance = s.appel({
  action: 'upsert', entite: 'financements', jeton: JETON_CLIENT,
  id: `${s.projetDuJeton}:ftest`, payload: { source: 'Test', montant: 1 },
});
verifier('client : ne peut pas toucher aux financements', !!finance.erreur, finance.erreur);

// Champ hors liste blanche : silencieusement ignoré, la ligne n'est pas altérée
const avantEcheance = s.feuilles.Prestations._grille
  .find((l) => l[0] === s.projetDuJeton && l[1] === 'P09')?.[3];
s.appel({
  action: 'upsert', entite: 'prestations', jeton: JETON_CLIENT,
  id: `${s.projetDuJeton}:P09`, payload: { statut: 'valide', echeance: '2099-01-01', note: 'injection' },
});
const ligneP09 = s.feuilles.Prestations._grille.find((l) => l[0] === s.projetDuJeton && l[1] === 'P09');
verifier('client : échéance non modifiable', ligneP09[3] === avantEcheance, ligneP09[3]);
verifier('client : note de suivi non modifiable', !ligneP09[4], ligneP09[4]);
verifier('client : le statut a bien été pris', ligneP09[2] === 'valide', ligneP09[2]);

/* --- Écritures de l'expert --- */
const expertEcrit = s.appel({
  action: 'upsert', entite: 'projets', cle: CODE_EXPERT,
  id: s.projetDuJeton, payload: { formule: 'F3' },
});
verifier('expert : peut tout écrire', !expertEcrit.erreur, expertEcrit.erreur);

/* --- Le point de diagnostic ne livre rien --- */
const diag = JSON.parse(s.doGet({ parameter: { diag: '1' } })._texte);
verifier('doGet en diagnostic ne renvoie aucune donnée', !diag.projets && diag.ok === true, JSON.stringify(diag));

const accueil = s.doGet({ parameter: {} })._html;
verifier('doGet sans paramètre : page d\'aiguillage, sans donnée',
  accueil.indexOf('passerelle de donn') !== -1 && accueil.indexOf('MSP Sant') === -1,
  accueil.slice(0, 60));

/* --- Script non encore configuré : reste ouvert pour la mise en service --- */
const sansCode = chargerScript(null);
const ouvert = sansCode.appel({ action: 'getAll' });
verifier('avant configuration : accès ouvert', Array.isArray(ouvert.projets), ouvert.erreur);

/* ------------------------------------------------------------ Résultats -- */
let echecs = 0;
controles.forEach(([intitule, ok, detail]) => {
  if (!ok) echecs++;
  console.log(`${ok ? '  ok  ' : ' ÉCHEC'}  ${intitule}${ok ? '' : `  → ${detail}`}`);
});
console.log(`\n${controles.length - echecs} / ${controles.length} contrôles passés`);
assert.strictEqual(echecs, 0, `${echecs} contrôle(s) en échec`);
