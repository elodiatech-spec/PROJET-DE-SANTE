/**
 * Test d'intégration de la synchronisation Google Sheets.
 *
 *   node tests/aller-retour.mjs
 *
 * Le test ne touche à aucune donnée réelle : il charge le code de
 * l'application et celui du script Apps Script dans des bacs à sable, simule
 * un classeur en mémoire, puis vérifie qu'une action de l'interface aboutit
 * bien à la bonne modification dans le classeur — et qu'une relecture rend
 * ensuite l'état attendu.
 *
 * À relancer après toute modification de store.js ou de apps-script/Code.gs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ==========================================================================
   Bac à sable 1 — l'application
   ========================================================================== */
function chargerApplication() {
  const source = [
    readFileSync(join(RACINE, 'assets/js/config.js'), 'utf8'),
    readFileSync(join(RACINE, 'assets/js/store.js'), 'utf8'),
    'globalThis.__EXPORT = { Store };',
  ].join('\n');

  const memoire = new Map();
  const requetes = [];

  const contexte = vm.createContext({
    localStorage: {
      getItem: (k) => (memoire.has(k) ? memoire.get(k) : null),
      setItem: (k, v) => memoire.set(k, v),
      removeItem: (k) => memoire.delete(k),
    },
    fetch: async (url, options) => {
      requetes.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ ok: true }) };
    },
    console,
  });

  vm.runInContext(source, contexte);
  return { Store: contexte.__EXPORT.Store, requetes };
}

/* ==========================================================================
   Bac à sable 2 — le script Apps Script et un classeur simulé
   ========================================================================== */
function feuilleSimulee(nom, entetes, lignes) {
  const grille = [entetes.slice(), ...lignes.map((l) => {
    const copie = l.slice();
    while (copie.length < entetes.length) copie.push('');
    return copie;
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
    appendRow: (valeurs) => {
      const copie = valeurs.slice();
      while (copie.length < entetes.length) copie.push('');
      grille.push(copie);
    },
    deleteRow: (ligne) => { grille.splice(ligne - 1, 1); },
    _grille: grille,
  };
}

function chargerScript() {
  const contexte = vm.createContext({
    SpreadsheetApp: { getActive: () => contexte.__classeur, flush: () => {} },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: {
      createTextOutput: (s) => ({ setMimeType: () => ({ _texte: s }) }),
      MimeType: { JSON: 'json' },
    },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
    DriveApp: {},
    console,
  });

  vm.runInContext(
    readFileSync(join(RACINE, 'apps-script/Code.gs'), 'utf8')
    + '\nglobalThis.__EXPORT = { doPost, construireDonnees, ONGLETS, AMORCE };',
    contexte);

  const { ONGLETS, AMORCE } = contexte.__EXPORT;

  // Le classeur de départ est reconstitué à partir des données d'amorçage
  // embarquées dans le script : aucune dépendance externe.
  const feuilles = {};
  Object.keys(ONGLETS).forEach((nom) => {
    feuilles[nom] = feuilleSimulee(nom, ONGLETS[nom], AMORCE[nom] || []);
  });
  contexte.__classeur = {
    getSheetByName: (n) => feuilles[n] || null,
    getSheets: () => Object.values(feuilles),
  };

  return { ...contexte.__EXPORT, feuilles };
}

/* ==========================================================================
   Scénario
   ========================================================================== */
const { Store, requetes } = chargerApplication();

Store.init();
Store.state.reglages.source = 'sheets';
Store.state.reglages.webAppUrl = 'https://exemple.test/exec';
Store.setRole('expert');
Store.setProjet('cds-gros-morne');           // souscrit en Formule 1

Store.changerFormule('cds-gros-morne', 'F3');
Store.majProjet({ options: { immobilier: true } }, 'cds-gros-morne');
Store.majPrestation('P08', { statut: 'valide', note: 'Validé en réunion.' });
Store.ajouterDocument({ nom: 'Test.pdf', cat: 'ARS', type: 'pdf', url: '', taille: '1 Mo', auteur: 'Camille R.' });
Store.ajouterEvenement({ titre: 'Comité de suivi', date: '2026-09-15', heure: '10:00', lieu: 'Visio', type: 'reunion' });
Store.ajouterFinancement({ source: 'FIR — ARS Martinique', montant: '50000', statut: 'etude', echeance: '2026-10-01' });
Store.ajouterPartenaire({ nom: 'CCAS Gros-Morne', type: 'Collectivité', statut: 'a_faire' });
Store.majSignature('sig8', { statut: 'signe', date: '2026-08-01' });
Store.ajouterCompteRendu({ date: '2026-08-01', objet: 'Point mensuel', participants: 'Équipe', decisions: 'RAS' });
Store.ajouterMessage('Bonjour', 'Camille R.', 'expert');

// Fiche client : correction d'informations après création
Store.majFicheClient('cds-gros-morne', {
  'client.nom': 'Mme Sophie Rivière-Martin',
  'client.tel': '0596 11 22 33',
  ville: 'Gros-Morne',
  notes: 'Reprise du dossier en août.',
  formule: 'F3',
});

// Réunion Meet : compte rendu portant les deux liens
Store.ajouterCompteRendu({
  date: '2026-08-10', type: 'visio', objet: 'Comité de pilotage — août',
  lienMeet: 'https://meet.google.com/test-copil',
  lienDoc: 'https://docs.google.com/document/d/TEST_CR/edit',
});

// Événement porteur d'un lien de visioconférence
Store.ajouterEvenement({
  titre: 'Point hebdomadaire', date: '2026-08-20', heure: '09:00',
  type: 'reunion', lieu: 'Visioconférence', lien: 'https://meet.google.com/test-hebdo',
});

Store.supprimerDocument(Store.liste('documents').find((d) => d.nom === 'Test.pdf').id);
Store.supprimerProjet('cds-cayenne');

/* ==========================================================================
   Rejeu des requêtes contre le script
   ========================================================================== */
const script = chargerScript();
const erreurs = [];

requetes.forEach((r, i) => {
  const reponse = JSON.parse(script.doPost({ postData: { contents: JSON.stringify(r) } })._texte);
  if (reponse.erreur) erreurs.push(`requête ${i} (${r.action}/${r.entite || 'lot'}) : ${reponse.erreur}`);
});

/* ==========================================================================
   Vérifications
   ========================================================================== */
const lire = (onglet) => {
  const grille = script.feuilles[onglet]._grille;
  const entetes = grille[0];
  return grille.slice(1).map((l) => Object.fromEntries(entetes.map((h, i) => [h, l[i]])));
};

const projets = lire('Projets');
const prestations = lire('Prestations');
const projet = projets.find((p) => p.id === 'cds-gros-morne');
const sesPrestations = prestations.filter((p) => p.projet_id === 'cds-gros-morne');
const p08 = sesPrestations.find((p) => p.prestation_id === 'P08');
const relu = script.construireDonnees();
const projetRelu = relu.projets.find((p) => p.id === 'cds-gros-morne');

const crMeet = lire('ComptesRendus').find((c) => c.objet === 'Comité de pilotage — août');
const evtMeet = lire('Evenements').find((e) => e.titre === 'Point hebdomadaire');

const controles = [
  ['le script ne renvoie aucune erreur', erreurs.length === 0, erreurs.join(' | ')],
  ['15 requêtes émises par l\'application', requetes.length === 15, requetes.length],
  ['la formule est passée en F3', projet.formule === 'F3', projet.formule],
  ['fiche client : nom du porteur corrigé', projet.client_nom === 'Mme Sophie Rivière-Martin', projet.client_nom],
  ['fiche client : téléphone enregistré', projet.client_tel === '0596 11 22 33', projet.client_tel],
  ['fiche client : notes internes enregistrées', projet.notes === 'Reprise du dossier en août.', projet.notes],
  ['compte rendu : lien Meet enregistré', crMeet && crMeet.lien_meet === 'https://meet.google.com/test-copil', crMeet && crMeet.lien_meet],
  ['compte rendu : Google Doc enregistré', crMeet && crMeet.lien_doc === 'https://docs.google.com/document/d/TEST_CR/edit', crMeet && crMeet.lien_doc],
  ['compte rendu : nature « visio »', crMeet && crMeet.type === 'visio', crMeet && crMeet.type],
  ['événement : lien de visioconférence enregistré', evtMeet && evtMeet.lien === 'https://meet.google.com/test-hebdo', evtMeet && evtMeet.lien],
  ['l\'option immobilier vaut OUI', projet.option_immobilier === 'OUI', projet.option_immobilier],
  ['le projet compte 34 prestations', sesPrestations.length === 34, sesPrestations.length],
  ['P34 a été créée par la montée de formule', !!sesPrestations.find((p) => p.prestation_id === 'P34'), 'absente'],
  ['P08 est validée', p08.statut === 'valide', p08.statut],
  ['la note de P08 est écrite', p08.note === 'Validé en réunion.', p08.note],
  ['l\'échéance de P08 reste au format AAAA-MM-JJ', /^\d{4}-\d{2}-\d{2}$/.test(String(p08.echeance)), p08.echeance],
  ['le document supprimé n\'est plus là', !lire('Documents').find((d) => d.nom === 'Test.pdf'), 'toujours présent'],
  ['l\'événement est ajouté', !!lire('Evenements').find((e) => e.titre === 'Comité de suivi'), 'absent'],
  ['le financement est ajouté', !!lire('Financements').find((f) => f.montant === 50000), 'absent'],
  ['le partenaire est ajouté', !!lire('Partenaires').find((p) => p.nom === 'CCAS Gros-Morne'), 'absent'],
  ['la signature sig8 est signée', lire('Signatures').find((s) => s.id === 'sig8').statut === 'signe', 'non signée'],
  ['le compte rendu est ajouté', !!lire('ComptesRendus').find((c) => c.objet === 'Point mensuel'), 'absent'],
  ['le message est ajouté', !!lire('Messages').find((m) => m.texte === 'Bonjour'), 'absent'],
  ['le projet supprimé a disparu', !projets.find((p) => p.id === 'cds-cayenne'), 'toujours présent'],
  ['cascade : ses prestations aussi', !prestations.find((p) => p.projet_id === 'cds-cayenne'), 'restantes'],
  ['cascade : ses signatures aussi', !lire('Signatures').find((s) => s.projet_id === 'cds-cayenne'), 'restantes'],
  ['aucune cellule indéfinie', !script.feuilles.Projets._grille.flat().includes(undefined), 'undefined présent'],
  ['relecture : formule F3', projetRelu.formule === 'F3', projetRelu.formule],
  ['relecture : option immobilier active', projetRelu.options.immobilier === true, projetRelu.options.immobilier],
  ['relecture : 34 prestations', Object.keys(projetRelu.prestations).length === 34, Object.keys(projetRelu.prestations).length],
  ['relecture : P08 validée', projetRelu.prestations.P08.statut === 'valide', projetRelu.prestations.P08.statut],
  ['relecture : projet supprimé absent', !relu.projets.find((p) => p.id === 'cds-cayenne'), 'présent'],
  ['relecture : nom du porteur corrigé', projetRelu.client.nom === 'Mme Sophie Rivière-Martin', projetRelu.client.nom],
  ['relecture : lien Meet exposé en lienMeet',
    relu.comptesRendus['cds-gros-morne'].some((c) => c.lienMeet === 'https://meet.google.com/test-copil'), 'absent'],
  ['relecture : Google Doc exposé en lienDoc',
    relu.comptesRendus['cds-gros-morne'].some((c) => c.lienDoc === 'https://docs.google.com/document/d/TEST_CR/edit'), 'absent'],
  ['relecture : lien de l\'événement',
    relu.evenements['cds-gros-morne'].some((e) => e.lien === 'https://meet.google.com/test-hebdo'), 'absent'],
];

let echecs = 0;
controles.forEach(([intitule, ok, detail]) => {
  if (!ok) echecs++;
  console.log(`${ok ? '  ok  ' : ' ÉCHEC'}  ${intitule}${ok ? '' : `  → ${detail}`}`);
});

console.log(`\n${controles.length - echecs} / ${controles.length} contrôles passés`);
assert.strictEqual(echecs, 0, `${echecs} contrôle(s) en échec`);
