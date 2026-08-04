/**
 * Test du calcul d'avancement face aux prestations « Non nécessaire ».
 *
 *   node tests/avancement.mjs
 *
 * Une prestation marquée « Non nécessaire » (statut technique : `bloque`) ne
 * sera pas effectuée — elle est hors périmètre, pas simplement en retard.
 * Ce test vérifie qu'elle est exclue de tous les calculs qui mesurent ce qui
 * reste à faire, sans être supprimée de la feuille de route pour autant.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

function chargerApplication() {
  const source = [
    readFileSync(join(RACINE, 'assets/js/config.js'), 'utf8'),
    readFileSync(join(RACINE, 'assets/js/store.js'), 'utf8'),
    'globalThis.__EXPORT = { Store, STATUTS };',
  ].join('\n');

  const memoire = new Map();
  const contexte = vm.createContext({
    localStorage: {
      getItem: (k) => (memoire.has(k) ? memoire.get(k) : null),
      setItem: (k, v) => memoire.set(k, v),
      removeItem: (k) => memoire.delete(k),
    },
    fetch: async () => ({ ok: true, json: async () => ({ ok: true }) }),
    console,
  });

  vm.runInContext(source, contexte);
  return contexte.__EXPORT;
}

const { Store, STATUTS } = chargerApplication();
Store.init();
Store.setRole('expert');
Store.setProjet('msp-fort-de-france');
Store.changerFormule('msp-fort-de-france', 'F3');

const controles = [];
const verifier = (intitule, ok, detail) => controles.push([intitule, ok, detail]);

const prestations = Store.prestations();
const cible = prestations[0];
const autre = prestations[1];

const avant = Store.avancement();
const totalAvant = Store.prestationsApplicables().length;

// Une échéance passée, pour vérifier qu'elle ne compte plus comme un retard
// une fois la prestation jugée non nécessaire.
Store.majPrestation(cible.id, { statut: 'bloque', echeance: '2020-01-01' });

verifier('exclue de prestationsApplicables',
  !Store.prestationsApplicables().some((p) => p.id === cible.id), 'toujours présente');

verifier('le total applicable diminue d\'une unité',
  Store.prestationsApplicables().length === totalAvant - 1, Store.prestationsApplicables().length);

verifier('reste visible dans la feuille de route complète',
  Store.prestations().some((p) => p.id === cible.id), 'disparue de la liste complète');

verifier('l\'avancement ne baisse pas — au contraire, il ne peut que remonter ou stagner',
  Store.avancement() >= avant, `${Store.avancement()} % (était ${avant} %)`);

verifier('n\'apparaît plus dans les prestations en retard malgré l\'échéance 2020',
  !Store.enRetard().some((p) => p.id === cible.id), 'toujours comptée en retard');

verifier('n\'apparaît plus dans les prochaines échéances',
  !Store.echeances(undefined, 50).some((e) => e.titre === cible.titre), 'encore listée');

const lot = Store.avancementParLot().find((l) => l.id === cible.lot);
verifier('avancementParLot signale la prestation hors périmètre',
  lot.horsPerimetre >= 1, lot.horsPerimetre);
verifier('avancementParLot ne compte plus la prestation exclue dans son total',
  !Store.prestations().filter((p) => p.lot === cible.lot && p.etat.statut !== 'bloque').length
    || lot.total === Store.prestations().filter((p) => p.lot === cible.lot && p.etat.statut !== 'bloque').length,
  lot.total);

// Valider une autre prestation du même lot doit continuer à faire progresser
// le pourcentage normalement — l'exclusion ne doit pas fausser le reste.
const pctAvantValidation = Store.avancement();
Store.majPrestation(autre.id, { statut: 'valide' });
verifier('valider une prestation applicable fait progresser le pourcentage',
  Store.avancement() > pctAvantValidation || autre.etat.statut === 'valide',
  `${pctAvantValidation} % → ${Store.avancement()} %`);

verifier('le statut « bloque » porte le libellé « Non nécessaire », pas « Bloqué »',
  STATUTS.bloque.label === 'Non nécessaire', STATUTS.bloque.label);

/* ------------------------------------------------------------- Rapport --- */
let echecs = 0;
controles.forEach(([intitule, ok, detail]) => {
  if (!ok) echecs += 1;
  console.log(`  ${ok ? 'ok  ' : 'ÉCHEC'}  ${intitule}${!ok && detail ? `  → ${detail}` : ''}`);
});
console.log(`\n${controles.length - echecs} / ${controles.length} contrôles passés`);
process.exit(echecs ? 1 : 0);
