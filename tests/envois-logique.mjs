/**
 * Test de la logique des envois côté application.
 *
 *   node tests/envois-logique.mjs
 *
 * Relance (délai usuel ou date fixée), documents proposés d'office selon le
 * destinataire, démarches propres au type de structure, accès réservé à l'expert.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  readFileSync(join(RACINE, 'assets/js/config.js'), 'utf8'),
  readFileSync(join(RACINE, 'assets/js/store.js'), 'utf8'),
  'globalThis.__EXPORT = { Store, Dates, DESTINATAIRES_ENVOIS, STATUTS_ENVOI, RUBRIQUES, DELAI_RELANCE_JOURS };',
].join('\n');
const memoire = new Map();
const contexte = vm.createContext({
  localStorage: { getItem: (k) => memoire.get(k) ?? null, setItem: (k, v) => memoire.set(k, v), removeItem: (k) => memoire.delete(k) },
  fetch: async () => ({ ok: true, json: async () => ({ ok: true }) }), console,
});
vm.runInContext(source, contexte);
const { Store, Dates, DESTINATAIRES_ENVOIS, STATUTS_ENVOI, RUBRIQUES, DELAI_RELANCE_JOURS } = contexte.__EXPORT;

const controles = [];
const verifier = (i, ok, d) => controles.push([i, !!ok, d]);
const jour = (n) => Dates.addDays(Dates.today(), n);

verifier('envoi sans réponse depuis le délai usuel : à relancer', Store.envoiARelancer({ statut: 'envoye', envoyeLe: jour(-DELAI_RELANCE_JOURS) }), '');
verifier('envoi récent : pas à relancer', !Store.envoiARelancer({ statut: 'envoye', envoyeLe: jour(-3) }), '');
verifier('date de relance fixée et passée : à relancer', Store.envoiARelancer({ statut: 'accuse', envoyeLe: jour(-3), relanceLe: jour(-1) }), '');
verifier('date de relance fixée à venir : pas à relancer, même après le délai', !Store.envoiARelancer({ statut: 'envoye', envoyeLe: jour(-40), relanceLe: jour(5) }), '');
verifier('réponse reçue ou clos : jamais à relancer', !Store.envoiARelancer({ statut: 'reponse', envoyeLe: jour(-90) }) && !Store.envoiARelancer({ statut: 'clos', envoyeLe: jour(-90) }), '');
verifier('à préparer : jamais à relancer', !Store.envoiARelancer({ statut: 'a_preparer', envoyeLe: '' }), '');

verifier('chaque destinataire a une démarche ou est libre', DESTINATAIRES_ENVOIS.every((d) => d.demarches.length || d.id === 'autre'), '');
verifier('chaque démarche a un objet', DESTINATAIRES_ENVOIS.every((d) => d.demarches.every((x) => x.objet)), '');
verifier('un état pour chaque statut du serveur', ['a_preparer', 'pret', 'envoye', 'accuse', 'complements', 'reponse', 'clos'].every((k) => STATUTS_ENVOI[k]), '');

const ACI = DESTINATAIRES_ENVOIS.find((d) => d.id === 'cpam').demarches;
verifier('ACI réservée aux MSP, accord national aux centres de santé', ACI.find((x) => /ACI/.test(x.objet)).types[0] === 'MSP' && ACI.find((x) => /centres de santé/.test(x.objet)).types[0] === 'CDS', '');

Store.init();
Store.setRole('expert');
Store.setProjet('msp-fort-de-france');
const sugg = Store.documentsSuggeres('ordres');
verifier('Ordres : statuts proposés d\'après leur nom', sugg.includes('doc2'), JSON.stringify(sugg));
verifier('Ordres : plans de locaux non proposés', !sugg.includes('doc5'), JSON.stringify(sugg));
const sArs = Store.documentsSuggeres('ars');
verifier('ARS : projet de santé proposé (pièce du dépôt)', sArs.includes('doc1'), JSON.stringify(sArs));
verifier('destinataire inconnu : rien', Store.documentsSuggeres('zz').length === 0, '');

const dossier = RUBRIQUES.find((r) => r.id === 'dossier');
verifier('l\'onglet Envois est dans Documents & signatures', dossier.pages.includes('envois'), '');
Store.setRole('client');
verifier('client : page Envois inaccessible', !Store.moduleAccessible('envois'), '');
Store.setRole('expert');
verifier('expert : page Envois accessible', Store.moduleAccessible('envois'), '');
verifier('expert : notification d\'envoi à relancer (exemple)', Store.notifications('msp-fort-de-france').some((n) => /à relancer/.test(n.titre)), '');
Store.setRole('client');
verifier('client : aucune notification d\'envoi', !Store.notifications('msp-fort-de-france').some((n) => /envoi/.test(n.titre)), '');

let echecs = 0;
controles.forEach(([i, ok, d]) => { if (!ok) echecs++; console.log(`${ok ? '  ok  ' : ' ÉCHEC'}  ${i}${ok ? '' : `  → ${d}`}`); });
console.log(`\n${controles.length - echecs} / ${controles.length} contrôles passés`);
assert.strictEqual(echecs, 0, `${echecs} contrôle(s) en échec`);
