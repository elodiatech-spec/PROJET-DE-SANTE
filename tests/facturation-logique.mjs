/**
 * Test de la facturation côté application, et de sa cohérence avec le script.
 *
 *   node tests/facturation-logique.mjs
 *
 * Échéancier, prix des formules et fiche de la société émettrice identiques dans
 * l'application et dans le script ; « Recommandée » sur la seule formule F3 ;
 * échéancier calculé, relances graduées, factures à émettre, accès expert.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f) => readFileSync(join(RACINE, f), 'utf8');

// Application
const memoire = new Map();
const app = vm.createContext({
  localStorage: { getItem: (k) => memoire.get(k) ?? null, setItem: (k, v) => memoire.set(k, v), removeItem: (k) => memoire.delete(k) },
  fetch: async () => ({ ok: true, json: async () => ({ ok: true }) }), console,
});
vm.runInContext(lire('assets/js/config.js') + '\n' + lire('assets/js/store.js')
  + '\nglobalThis.__E = { Store, Dates, FORMULES, ECHEANCIER, EMETTEUR_DEFAUT, NIVEAUX_RELANCE, STATUTS_FACTURATION, RUBRIQUES };', app);
const { Store, Dates, FORMULES, ECHEANCIER, EMETTEUR_DEFAUT, NIVEAUX_RELANCE, STATUTS_FACTURATION, RUBRIQUES } = app.__E;

// Script
const srv = vm.createContext({ console });
vm.runInContext(lire('apps-script/Code.gs') + '\nglobalThis.__S = { ECHEANCIER_, PRIX_FORMULES_, EMETTEUR_SERVEUR_DEFAUT, STATUTS_DEVIS_, STATUTS_FACTURE_ };', srv);
const S = srv.__S;

const controles = [];
const verifier = (i, ok, d) => controles.push([i, !!ok, d]);
const jour = (n) => Dates.addDays(Dates.today(), n);

verifier('échéancier : 60 % puis 40 %, total 100 %', ECHEANCIER[0].part === 60 && ECHEANCIER[1].part === 40 && ECHEANCIER.reduce((t, x) => t + x.part, 0) === 100, '');
verifier('échéancier identique dans le script', ECHEANCIER.every((t, i) => t.tranche === S.ECHEANCIER_[i].tranche && t.part === S.ECHEANCIER_[i].part && t.libelle === S.ECHEANCIER_[i].libelle), JSON.stringify(S.ECHEANCIER_));
verifier('prix des formules identiques dans le script', Object.keys(FORMULES).every((k) => FORMULES[k].prixHT === S.PRIX_FORMULES_[k]), JSON.stringify(S.PRIX_FORMULES_));
const communs = Object.keys(S.EMETTEUR_SERVEUR_DEFAUT).filter((k) => S.EMETTEUR_SERVEUR_DEFAUT[k] !== '');
verifier('fiche émettrice par défaut identique dans le script', communs.every((k) => EMETTEUR_DEFAUT[k] === S.EMETTEUR_SERVEUR_DEFAUT[k]), communs.filter((k) => EMETTEUR_DEFAUT[k] !== S.EMETTEUR_SERVEUR_DEFAUT[k]).join(', '));
verifier('« Recommandée » sur la seule formule F3', FORMULES.F3.recommandee === true && FORMULES.F1.recommandee === false && FORMULES.F2.recommandee === false, '');
verifier('tous les états du script ont un libellé', [...S.STATUTS_DEVIS_, ...S.STATUTS_FACTURE_].every((k) => STATUTS_FACTURATION[k]), '');
verifier('l\'onglet Facturation est dans Documents & signatures', RUBRIQUES.find((r) => r.id === 'dossier').pages.includes('facturation'), '');

Store.init();
Store.setRole('expert');
Store.setProjet('msp-fort-de-france');
const base = { type: 'devis', statut: 'accepte', montantHt: 8900, tauxTva: 8.5, arsValideLe: '', relances: [] };
const devis = { ...base, id: 'd1', numero: 'D26-00001' };
Store.commit((s) => { s.facturation['msp-fort-de-france'] = [devis]; });
let e = Store.echeancier(devis);
verifier('acompte : 5 340 € HT, solde : 3 560 € HT', e[0].montantHt === 5340 && e[1].montantHt === 3560 && e[0].montantHt + e[1].montantHt === 8900, JSON.stringify(e.map((x) => x.montantHt)));
verifier('TTC avec TVA 8,5 %', e[0].montantTtc === 5793.9 && e[1].montantTtc === 3862.6, JSON.stringify(e.map((x) => x.montantTtc)));
verifier('devis accepté : acompte à émettre, solde en attente de l\'ARS', e[0].aEmettre && !e[1].aEmettre && e[1].enAttente, '');
verifier('notification : facture d\'acompte à émettre', Store.facturesAEmettre('msp-fort-de-france').some((a) => /acompte/.test(a.titre)), '');
Store.commit((s) => { s.facturation['msp-fort-de-france'] = [{ ...devis, arsValideLe: jour(-2) }]; });
e = Store.echeancier(Store.devisActif());
verifier('validation ARS : le solde devient à émettre', e[1].aEmettre, '');
verifier('devis non accepté : rien à émettre', (Store.commit((s) => { s.facturation['msp-fort-de-france'] = [{ ...devis, statut: 'envoye' }]; }), Store.facturesAEmettre('msp-fort-de-france').length === 0), '');

const facture = (o) => ({ ...base, id: 'f' + Math.random(), type: 'facture', statut: 'emise', numero: 'F26-0000' + Math.ceil(Math.random() * 9), devisId: 'd1', tranche: 'commande', montantHt: 5340, montantTva: 453.9, montantTtc: 5793.9, ...o });
verifier('facture non échue : pas en retard', !Store.factureEnRetard(facture({ echeance: jour(3) })), '');
verifier('facture échue non payée : en retard', Store.factureEnRetard(facture({ echeance: jour(-1) })), '');
verifier('facture payée : jamais en retard', !Store.factureEnRetard(facture({ echeance: jour(-90), statut: 'payee' })), '');
verifier('relance : rappel courtois au début du retard', Store.niveauRelanceConseille(facture({ echeance: jour(-3) })) === 1, '');
verifier('relance : ferme après 15 jours', Store.niveauRelanceConseille(facture({ echeance: jour(-16) })) === 2, '');
verifier('relance : mise en demeure après 30 jours', Store.niveauRelanceConseille(facture({ echeance: jour(-31) })) === 3, '');
verifier('relance : on monte d\'un niveau après une relance déjà faite', Store.niveauRelanceConseille(facture({ echeance: jour(-3), relances: [{ date: jour(-2), niveau: 1 }] })) === 2, '');
verifier('relance : jamais au-delà du niveau 3', Store.niveauRelanceConseille(facture({ echeance: jour(-3), relances: [{}, {}, {}, {}] })) === 3 && Object.keys(NIVEAUX_RELANCE).length === 3, '');
verifier('pas de relance tant que non échue', Store.niveauRelanceConseille(facture({ echeance: jour(5) })) === 0, '');

Store.commit((s) => { s.facturation['msp-fort-de-france'] = [facture({ id: 'a', echeance: jour(-5), numero: 'F26-00001' }), facture({ id: 'b', statut: 'payee', montantTtc: 3862.6, numero: 'F26-00002' }), facture({ id: 'c', statut: 'annulee', numero: 'F26-00003' })]; });
const t = Store.totauxFacturation('msp-fort-de-france');
verifier('totaux : facturé, encaissé, reste, échu (factures annulées exclues)', t.facture === 9656.5 && t.encaisse === 3862.6 && t.reste === 5793.9 && t.enRetard === 5793.9, JSON.stringify(t));
verifier('notification : facture échue (expert)', Store.notifications('msp-fort-de-france').some((n) => /impayée/.test(n.titre)), '');
Store.setRole('client');
verifier('client : page Facturation inaccessible', !Store.moduleAccessible('facturation'), '');
verifier('client : aucune notification de facturation', !Store.notifications('msp-fort-de-france').some((n) => /facture/i.test(n.titre)), '');

let echecs = 0;
controles.forEach(([i, ok, d]) => { if (!ok) echecs++; console.log(`${ok ? '  ok  ' : ' ÉCHEC'}  ${i}${ok ? '' : `  → ${d}`}`); });
console.log(`\n${controles.length - echecs} / ${controles.length} contrôles passés`);
assert.strictEqual(echecs, 0, `${echecs} contrôle(s) en échec`);
