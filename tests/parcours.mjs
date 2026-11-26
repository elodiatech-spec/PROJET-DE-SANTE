/**
 * Test du parcours administratif (suite de l'audit du 26 novembre 2026).
 *
 *   node tests/parcours.mjs
 *
 * Vérifie que la feuille de route suit le parcours réel de chaque structure :
 *   — MSP : immatriculation de la SISA, ACI ; jamais l'ANCS ni l'agrément ;
 *   — centre de santé : déclaration de l'association, engagement de
 *     conformité, agrément (« Non nécessaire » par défaut), ANCS ; jamais l'ACI ;
 *   — la forme juridique connue l'emporte sur le type de structure ;
 *   — le jalon « équipe médicale minimale » retient les étapes qui en dépendent ;
 *   — la fin du périmètre et le suivi après l'ouverture sont annoncés ;
 *   — portails, catalogue du script et questionnaire restent cohérents.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

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
vm.runInContext([
  readFileSync(join(RACINE, 'assets/js/config.js'), 'utf8'),
  readFileSync(join(RACINE, 'assets/js/store.js'), 'utf8'),
  'globalThis.__EXPORT = { Store, PRESTATIONS, PORTAILS, QUESTIONNAIRE, APRES_PERIMETRE };',
].join('\n'), contexte);
const { Store, PRESTATIONS, PORTAILS, QUESTIONNAIRE } = contexte.__EXPORT;

const controles = [];
const verifier = (intitule, ok, detail) => controles.push([intitule, !!ok, detail]);

Store.init();
Store.setRole('expert');
const ID = 'msp-fort-de-france';
Store.setProjet(ID);

const configurer = (champs) => Store.commit((s) => { Object.assign(s.projets.find((p) => p.id === ID), champs); });
const ids = () => Store.prestations(ID).map((p) => p.id);
const statut = (id) => Store.prestations(ID).find((p) => p.id === id)?.etat.statut;

/* --- MSP en SISA --- */
configurer({ type: 'MSP', modeleJuridique: 'sisa' });
Store.changerFormule(ID, 'F2');
let l = ids();
verifier('MSP : immatriculation SISA, jalon équipe, ACI, France Santé présents',
  ['P39', 'P44', 'P20', 'P42'].every((x) => l.includes(x)), l.join(','));
verifier('MSP : ni association, ni engagement de conformité, ni agrément, ni ANCS',
  !['P40', 'P36', 'P43', 'P41'].some((x) => l.includes(x)), l.join(','));
verifier("MSP : l'immatriculation précède la charte interne",
  l.indexOf('P17') < l.indexOf('P39') && l.indexOf('P39') < l.indexOf('P35'), l.join(','));
verifier('MSP : le jalon porte la condition de la SISA',
  /deux médecins/.test(Store.prestations(ID).find((p) => p.id === 'P44').desc), '');

/* --- Centre de santé associatif --- */
configurer({ type: 'CDS', modeleJuridique: 'assoc' });
Store.changerFormule(ID, 'F3');
l = ids();
verifier('CDS : déclaration association, conformité, agrément, ANCS présents',
  ['P40', 'P36', 'P43', 'P41'].every((x) => l.includes(x)), l.join(','));
verifier("CDS : ni immatriculation SISA, ni ACI", !['P39', 'P20'].some((x) => l.includes(x)), l.join(','));
verifier("CDS : l'agrément naît « Non nécessaire »", statut('P43') === 'bloque', statut('P43'));
verifier("CDS : l'agrément suit l'engagement de conformité", l.indexOf('P36') < l.indexOf('P43'), l.join(','));

/* --- La forme juridique connue l'emporte --- */
configurer({ type: 'MSP', modeleJuridique: 'assoc' });
l = ids();
verifier("MSP portée par une association : déclaration de l'association, pas de Kbis SISA",
  l.includes('P40') && !l.includes('P39'), l.join(','));
configurer({ type: 'CDS', modeleJuridique: '' });
l = ids();
verifier('forme juridique inconnue : le type de structure décide', l.includes('P40') && !l.includes('P39'), l.join(','));
configurer({ type: 'CDS', modeleJuridique: 'assoc' });

/* --- Jalon équipe médicale --- */
Store.majPrestation('P44', { statut: 'en_cours' });
const attente = Store.prerequisManquants('P38', ID).map((p) => p.id);
verifier('jalon non atteint : signature du projet de santé retenue', attente.includes('P44'), attente.join(','));
verifier('jalon non atteint : dépôt ARS, conformité et ANCS retenus',
  ['P19', 'P36', 'P41'].every((x) => Store.prerequisManquants(x, ID).length === 1), '');
verifier("une étape sans prérequis n'est jamais retenue", Store.prerequisManquants('P37', ID).length === 0, '');
Store.majPrestation('P44', { statut: 'valide' });
verifier('jalon validé : plus rien ne retient la signature', Store.prerequisManquants('P38', ID).length === 0, '');
Store.majPrestation('P44', { statut: 'bloque' });
verifier('jalon « Non nécessaire » : la contrainte est levée', Store.prerequisManquants('P38', ID).length === 0, '');

/* --- Fin de périmètre et suivi --- */
Store.changerFormule(ID, 'F1');
let a = Store.apresPerimetre(ID);
const horsF1 = a.horsFormule.map((p) => p.id);
verifier('F1 : les démarches hors formule sont listées (déclaration, conformité, ANCS)',
  ['P40', 'P36', 'P41'].every((x) => horsF1.includes(x)), horsF1.join(','));
verifier("F1 : l'ouverture n'est pas couverte", !a.ouvertureCouverte, '');
verifier('F1 : hors formule, rien de propre aux MSP pour un centre de santé',
  !horsF1.some((x) => ['P39', 'P20'].includes(x)), horsF1.join(','));
verifier('centre de santé : suivi annuel ANCS et agrément définitif, pas les indicateurs ACI',
  a.suivi.some((e) => /accord national/.test(e.titre)) && a.suivi.some((e) => /définitif/.test(e.titre))
    && !a.suivi.some((e) => /ACI/.test(e.titre)), a.suivi.map((e) => e.titre).join(' | '));
Store.changerFormule(ID, 'F3');
a = Store.apresPerimetre(ID);
verifier("F3 : rien hors formule, l'ouverture est couverte", !a.horsFormule.length && a.ouvertureCouverte, a.horsFormule.length);
configurer({ type: 'MSP', modeleJuridique: 'sisa' });
a = Store.apresPerimetre(ID);
verifier('MSP : suivi annuel ACI, ni ANCS ni agrément',
  a.suivi.some((e) => /ACI/.test(e.titre)) && !a.suivi.some((e) => /accord national|définitif/.test(e.titre)), '');

/* --- Cohérence des références --- */
const portailsManquants = PRESTATIONS.filter((p) => p.portail && !PORTAILS.some((x) => x.id === p.portail)).map((p) => p.id);
verifier('chaque portail cité par une prestation existe', !portailsManquants.length, portailsManquants.join(','));
const liensNonSurs = PORTAILS.flatMap((p) => p.liens).filter((x) => !/^https:\/\//.test(x.url)).map((x) => x.url);
verifier('tous les liens de portail sont en https', !liensNonSurs.length, liensNonSurs.join(','));
const prerequisInconnus = PRESTATIONS.flatMap((p) => p.prerequis || []).filter((id) => !PRESTATIONS.some((x) => x.id === id));
verifier('chaque prérequis désigne une prestation existante', !prerequisInconnus.length, prerequisInconnus.join(','));
verifier('identifiants de prestation uniques', new Set(PRESTATIONS.map((p) => p.id)).size === PRESTATIONS.length, '');

const code = readFileSync(join(RACINE, 'apps-script/Code.gs'), 'utf8');
const ctxGs = vm.createContext({});
vm.runInContext(code + '\nglobalThis.__G = { AMORCE, QUESTIONNAIRE_CHAMPS };', ctxGs);
const catalogue = ctxGs.__G.AMORCE.Catalogue.map((r) => r[0]);
verifier('catalogue du script identique au catalogue de l\'application',
  JSON.stringify(catalogue) === JSON.stringify(PRESTATIONS.map((p) => p.id)), `${catalogue.length} / ${PRESTATIONS.length}`);
const champsServeur = ctxGs.__G.QUESTIONNAIRE_CHAMPS;
const oublis = QUESTIONNAIRE.flatMap((r) => r.champs.filter((c) => c.type !== 'fichiers'
  && !(champsServeur[r.id] || []).includes(c.id)).map((c) => `${r.id}.${c.id}`));
verifier('chaque champ du questionnaire est accepté par le script (France Santé, agrément compris)', !oublis.length, oublis.join(','));

/* ------------------------------------------------------------ Résultats -- */
let echecs = 0;
controles.forEach(([intitule, ok, detail]) => {
  if (!ok) echecs++;
  console.log(`${ok ? '  ok  ' : ' ÉCHEC'}  ${intitule}${ok ? '' : `  → ${detail}`}`);
});
console.log(`\n${controles.length - echecs} / ${controles.length} contrôles passés`);
process.exit(echecs ? 1 : 0);
