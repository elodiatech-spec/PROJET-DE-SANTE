# ElodiaTech — Plateforme Projets de Santé

Application de pilotage des projets de santé pour **maisons de santé pluriprofessionnelles (MSP)** et
**centres de santé (CDS)**, avec deux espaces distincts :

- **Espace client** — le porteur de projet suit l'avancement réel de son dossier, consulte les livrables
  et valide ce qui attend son retour.
- **Espace expert** — le consultant ElodiaTech pilote son portefeuille de projets, fait évoluer chaque
  prestation et administre le périmètre d'intervention.

Le cœur de l'application est **l'offre souscrite** : la formule choisie par le client détermine
automatiquement les lots de travail activés, les prestations à conduire, les livrables attendus
et les modules visibles dans la navigation.

---

## Démarrage

Aucune installation, aucune dépendance à construire. Ouvrez `index.html` dans un navigateur.

Pour un service local (recommandé) :

```bash
npx --yes serve plateforme-projet-sante
```

Publication sur GitHub Pages : poussez le dossier tel quel et activez Pages sur la branche voulue.

---

## Les trois formules

| | Formule 1 | Formule 2 | Formule 3 |
|---|---|---|---|
| **Intitulé** | Projet de santé | Création complète | Création & déploiement Premium |
| **Tarif** | À partir de 5 900 € HT | À partir de 8 900 € HT | À partir de 12 500 € HT |
| **Lots couverts** | 2 | 6 | 8 |
| **Prestations** | 16 | 28 | 34 |
| **Durée indicative** | 4 mois | 8 mois | 12 mois |

### Les 8 lots de travail

| Lot | Intitulé | F1 | F2 | F3 |
|---|---|:--:|:--:|:--:|
| L0 | Cadrage & démarrage | ✅ | ✅ | ✅ |
| LA | Projet de santé | ✅ | ✅ | ✅ |
| LB | Structuration juridique & dossier ARS | — | ✅ | ✅ |
| LC | Financements & subventions | — | ✅ | ✅ |
| LD | Conventions & partenariats | — | ✅ | ✅ |
| LE | Prestataires & outils métier | — | ✅ | ✅ |
| LF | Identité visuelle & digital | — | — | ✅ |
| LG | Déploiement & coordination | — | — | ✅ |

Changer la formule d'un projet depuis **Console expert → Offres & périmètres** met immédiatement
à jour l'espace du client : les modules hors périmètre disparaissent de sa navigation et les
nouvelles prestations sont créées au statut « À faire ».

Le module **Immobilier, locaux & ERP** est une option activable projet par projet, indépendamment
de la formule.

---

## Statuts d'une prestation

L'avancement global n'est pas saisi à la main : il est calculé à partir du statut de chaque prestation.

| Statut | Poids dans l'avancement | Qui agit |
|---|:--:|---|
| À faire | 0 % | — |
| En cours | 50 % | ElodiaTech |
| À valider par le client | 85 % | Le client |
| Validé | 100 % | — |
| Bloqué | 20 % | ElodiaTech |

L'expert fait évoluer le statut depuis la feuille de route. Le client ne dispose que d'une action :
valider ce qui lui est soumis.

---

## Structure du projet

```
plateforme-projet-sante/
├── index.html                    Coque de l'application
├── assets/
│   ├── css/app.css               Design system : thèmes clair/sombre, composants, responsive
│   ├── img/                      Logo ElodiaTech (complet, wordmark, marque carrée)
│   └── js/
│       ├── config.js             Référentiels : formules, lots, 34 prestations, modules, FAQ, ERP
│       ├── store.js              État, persistance, sélecteurs calculés, adaptateur Google Sheets
│       ├── views.js              Rendu des 21 vues
│       └── app.js                Navigation, interactions, modales, graphiques, carte
├── apps-script/
│   └── Code.gs                   Passerelle Google Sheets & Drive (à coller dans Apps Script)
├── tests/
│   └── aller-retour.mjs          Test d'intégration de la synchronisation
├── docs/
│   └── connexion-google-sheets.md
└── README.md
```

L'ordre des balises `<script>` dans `index.html` est significatif : `config` → `store` → `views` → `app`.

### Où modifier quoi

| Besoin | Fichier | Repère |
|---|---|---|
| Tarifs, intitulés, périmètre des offres | `config.js` | `FORMULES` |
| Ajouter ou reformuler une prestation | `config.js` | `PRESTATIONS` |
| Ajouter un module de navigation | `config.js` | `MODULES` + une entrée dans `Views` |
| Questions de la FAQ | `config.js` | `FAQ` |
| Critères du cahier des charges ERP | `config.js` | `CAHIER_ERP` |
| Pièces du dossier ARS | `config.js` | `PIECES_DOSSIER` |
| Couleurs, typographie, espacements | `app.css` | section 1 et 2 |
| Projets de démonstration | `store.js` | `demoProjets()` |

---

## Données : Google Sheets & Drive

Par défaut, l'application fonctionne sur un **jeu de démonstration** (4 projets, une formule
différente chacun). Les modifications sont conservées dans le navigateur (`localStorage`),
ce qui permet de tester l'application de façon réaliste avant tout branchement.

La base Google est déjà créée :

- **Dossier racine** — [ElodiaTech — Projets de Santé](https://drive.google.com/drive/folders/1MOmLg078g_VyPUFS614WkGrh30W4LAAP)
- **Feuille de calcul** — [ElodiaTech — Base Projets de Santé](https://docs.google.com/spreadsheets/d/1sM39tIIMygSjLwncVNbldBuhaoaZaAUZEH_IExfi7SM/edit)

Le script [`apps-script/Code.gs`](apps-script/Code.gs) construit les onglets, crée
l'arborescence Drive de chaque projet et sert les données à l'application.
Procédure complète : [docs/connexion-google-sheets.md](docs/connexion-google-sheets.md).

Chaque projet dispose d'un dossier Drive à huit sous-dossiers correspondant aux catégories
documentaires. Client et expert y déposent leurs pièces, puis les référencent dans le
coffre-fort de l'application.

Une fois la feuille reliée, la synchronisation est **bidirectionnelle** : la lecture recharge
tout depuis la feuille, et chaque modification faite dans l'interface — formule, prestations,
documents, signatures, planning, financements, partenaires, messages — y est renvoyée
automatiquement. Le détail figure dans la documentation de connexion.

Un export JSON complet est disponible depuis **Console expert → Paramètres & données**.

## Tests

```bash
node tests/aller-retour.mjs
```

Vérifie l'intégration Google Sheets de bout en bout, sur un classeur simulé en mémoire :
les actions de l'interface produisent-elles les bonnes écritures, et une relecture rend-elle
l'état attendu. Aucune donnée réelle n'est touchée.

---

## Fonctionnalités

**Pilotage**
- Tableau de bord adapté au rôle : avancement, actions attendues, échéances, alertes de retard
- Feuille de route : avancement par lot, filtres, statut et échéance pilotables par l'expert
- Rétroplanning recalculable à partir de la charge indicative de chaque prestation

**Ingénierie**
- Projet de santé : document collaboratif, 5 chapitres réglementaires alimentés par les prestations
- Structuration juridique : SISA ou association loi 1901
- Immobilier : carte, intervenants, cahier des charges ERP en 19 critères

**Guichets & financements**
- Portails Stars FIR, e-Synergie, Espace Pro Ameli
- Suivi des 12 pièces obligatoires du dossier
- Tableau des demandes de financement avec taux d'obtention
- Conventions et annuaire de prestataires

**Documents & validation**
- Coffre-fort documentaire par catégorie
- Parapheurs de signature électronique administrés par l'expert
- Bibliothèque des livrables par lot

**Collaboration**
- Messagerie
- Planning du projet, et pour l'expert **planning général** cumulant les échéances
  de tout le portefeuille, filtrable par client
- Événements porteurs d'un lien Google Meet, rejoignable d'un clic par le client
- Comptes rendus typés — visioconférence, entretien téléphonique, réunion sur site,
  échange écrit — portant le lien de la réunion et celui du Google Doc de notes.
  Un lien Meet collé crée le compte rendu ; la saisie manuelle reste possible.

**Console expert**
- Portefeuille en **étiquettes clients** : un clic ouvre la vue d'ensemble du projet
- **Fiche client** complète, créable et modifiable : structure, porteur, référent,
  cadrage, notes internes
- Attribution des formules et des options
- Paramètres et source de données

**Accès**
- Page de connexion aux couleurs ElodiaTech : une adresse électronique reconnue
  ouvre directement le bon espace — celui de l'expert, ou le dossier du client
  correspondant. Une liste de profils permet aussi d'entrer sans saisie.
- Hors session, l'application n'est pas rendue : rien à voir dans la page.
- La session est conservée d'une visite à l'autre ; déconnexion depuis le menu du profil.

> Cet écran **identifie** un profil, il ne vérifie aucun mot de passe. C'est une
> commodité de navigation, pas une barrière de sécurité : voir la section
> « Sécurité du rendu » plus bas.

**Transverse**
- Thèmes clair et sombre
- Recherche globale (`Ctrl` / `⌘` + `K`)
- Responsive mobile, tablette et bureau
- Navigation au clavier, `Échap` ferme modales et panneaux, styles d'impression

---

## Sécurité du rendu

Toute donnée dynamique passe par `esc()` avant insertion dans le DOM, et seules les URL
`http(s)` sont acceptées via `urlSure()`. Un message de messagerie ou un nom de document
contenant du HTML est affiché tel quel, jamais interprété.

Cette protection porte sur le rendu côté navigateur. Lors du branchement d'un backend,
l'authentification et le contrôle d'accès aux données restent à mettre en place côté serveur :
la page de connexion et la bascule client/expert sont des commodités de navigation,
pas des barrières de sécurité. Toutes les données du portefeuille sont chargées dans le
navigateur, quel que soit le profil choisi.

Le jour où un serveur sera en place, l'écran de connexion est prêt à l'accueillir :
`Store.identifier()` et `Store.connecter()` dans `assets/js/store.js` sont les deux seuls
points à remplacer par un véritable appel d'authentification.

---

## Dépendances externes

Chargées par CDN, aucune installation :

- [Chart.js](https://www.chartjs.org/) — graphiques
- [Leaflet](https://leafletjs.com/) + OpenStreetMap — cartographie
- [Font Awesome](https://fontawesome.com/) — icônes
- Google Fonts (Plus Jakarta Sans) — typographie
