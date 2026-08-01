# Connecter la plateforme à Google Sheets et Drive

Tout est déjà en place dans votre Drive. Il reste trois étapes, réalisables en une quinzaine
de minutes, pour relier l'application à cette base.

---

## Ce qui a été créé dans votre Drive

**Dossier racine** — [ElodiaTech — Projets de Santé](https://drive.google.com/drive/folders/1MOmLg078g_VyPUFS614WkGrh30W4LAAP)

```
ElodiaTech — Projets de Santé/
├── 01 — Base de données/
│   └── ElodiaTech — Base Projets de Santé      ← la feuille de calcul
├── 02 — Modèles et ressources/
└── 03 — Projets/
    └── _MODELE — Nouveau projet/               ← gabarit dupliqué pour chaque projet
        ├── 01 — Projet de santé
        ├── 02 — Juridique
        ├── 03 — Dossier ARS
        ├── 04 — Finances
        ├── 05 — Immobilier
        ├── 06 — Équipe
        ├── 07 — Partenariats
        └── 08 — Identité visuelle
```

**Feuille de calcul** — [ElodiaTech — Base Projets de Santé](https://docs.google.com/spreadsheets/d/1sM39tIIMygSjLwncVNbldBuhaoaZaAUZEH_IExfi7SM/edit)

Elle est vide pour l'instant : l'étape 1 la remplit.

Les huit sous-dossiers reprennent exactement les catégories de documents de l'application.
Un document déposé dans `03 — Dossier ARS` se référence dans le coffre-fort avec la catégorie « ARS ».

---

## Étape 1 — Installer le script et construire la base

1. Ouvrez la feuille de calcul, puis **Extensions → Apps Script**.
2. Supprimez le contenu de `Code.gs` et collez celui de [`apps-script/Code.gs`](../apps-script/Code.gs).
3. Enregistrez (💾), puis **rechargez la feuille de calcul**.
4. Un menu **ElodiaTech** apparaît dans la barre de menus. Choisissez
   **« Initialiser la base (onglets + données de démonstration) »**.
5. Autorisez le script lorsque Google le demande (première exécution uniquement).

Les 11 onglets sont créés, mis en forme et remplis :

| Onglet | Contenu |
|---|---|
| `Lisez-moi` | Consignes d'utilisation |
| `Projets` | Un projet par ligne — c'est ici que se règle la formule (F1/F2/F3) |
| `Prestations` | Une ligne par prestation et par projet, avec statut et échéance |
| `Catalogue` | Référence des 34 prestations et de leur rattachement aux formules |
| `Documents`, `Signatures`, `Messages`, `Evenements`, `ComptesRendus`, `Financements`, `Partenaires` | Données de suivi |

> Pour partir d'une base vierge, choisissez plutôt **« Créer les onglets vides seulement »**.

---

## Étape 2 — Créer les dossiers Drive des projets

Toujours dans le menu **ElodiaTech**, choisissez **« Créer les dossiers Drive manquants »**.

Pour chaque projet dépourvu d'adresse Drive, le script :

- crée un dossier `Nom du projet — Ville` dans `03 — Projets` ;
- y recopie les huit sous-dossiers du gabarit ;
- inscrit l'adresse du dossier dans la colonne `drive_url` de l'onglet `Projets`.

L'application affiche alors, dans le coffre-fort documentaire, un bouton
**« Ouvrir le Drive du projet »** accessible **au client comme à l'expert**.

Pour que le client puisse déposer ses pièces : partagez-lui son dossier de projet
(clic droit sur le dossier → **Partager** → droit **Éditeur**). Ne partagez que le dossier
du projet concerné, jamais le dossier racine.

---

## Étape 3 — Publier l'application web et la relier

1. Dans l'éditeur Apps Script : **Déployer → Nouveau déploiement**.
2. Type : **Application web**.
3. Exécuter en tant que : **Moi**.
4. Qui a accès : **Tout le monde**.
5. Copiez l'URL fournie — elle se termine par `/exec`.
6. Dans la plateforme : basculez sur l'**espace expert**, ouvrez
   **Console expert → Paramètres & données**, collez l'URL, **Enregistrez**,
   puis cliquez sur **Synchroniser maintenant**.

Les données de la feuille remplacent alors le jeu de démonstration local.

> **Confidentialité.** « Tout le monde » signifie que quiconque connaît l'URL peut lire les
> données servies par le script. N'y placez pas de données de santé à caractère personnel.
> Pour un usage avec des données réelles, prévoyez un backend authentifié plutôt qu'une
> feuille publiée. Ce point est repris dans le README.

---

## Ce qui circule dans quel sens

**Lecture.** « Synchroniser maintenant » recharge l'intégralité des projets et de leurs
données de suivi depuis la feuille.

**Écriture.** Dès qu'une source Google Sheets est active, **toute modification faite dans
l'interface est renvoyée vers la feuille**, sans action de votre part :

| Action dans l'interface | Onglet mis à jour |
|---|---|
| Changer la formule d'un projet | `Projets` + les prestations ajoutées dans `Prestations` |
| Activer ou désactiver le module immobilier | `Projets` |
| Modifier le modèle juridique, le lien Google Doc, l'adresse du site | `Projets` |
| Créer ou supprimer un projet | `Projets` (+ purge de ses lignes dans tous les autres onglets) |
| Changer le statut, l'échéance, la note ou le lien d'une prestation | `Prestations` |
| Référencer ou supprimer un document | `Documents` |
| Marquer un acte signé, renseigner un lien de parapheur | `Signatures` |
| Ajouter un événement, un compte rendu, un financement, un partenaire | onglet correspondant |
| Envoyer un message | `Messages` |

En cas d'échec réseau, la modification reste enregistrée localement et un message vous
le signale : aucune saisie n'est perdue. Relancez une synchronisation ensuite pour repartir
de l'état de la feuille.

**Attention aux modifications concurrentes.** Si vous éditez la feuille à la main pendant
qu'une session de l'application est ouverte, la dernière écriture l'emporte. Pour un travail
à plusieurs, privilégiez l'interface et gardez la feuille en lecture.

### Vérifier que l'aller-retour fonctionne

Depuis le dossier du dépôt :

```bash
node tests/aller-retour.mjs
```

Le test simule un classeur en mémoire, exécute une douzaine d'actions de l'interface, applique
les écritures avec le vrai code du script, puis vérifie l'état obtenu. Il ne touche à aucune
donnée réelle. À relancer après toute modification de `store.js` ou de `apps-script/Code.gs`.

---

## Modifier la formule d'un client

Deux chemins, qui produisent le même résultat :

- **Depuis l'application** — espace expert, tableau de bord, bloc « Offre souscrite par le client » :
  un clic sur la formule suffit. Une confirmation n'est demandée que si le changement retire
  des lots au client.
- **Depuis la feuille** — onglet `Projets`, colonne `formule` : saisissez `F1`, `F2` ou `F3`,
  puis resynchronisez depuis la plateforme.

---

## Dépannage

| Symptôme | Cause probable |
|---|---|
| Le menu « ElodiaTech » n'apparaît pas | Rechargez la feuille après avoir enregistré le script. |
| `Réponse 401` ou `403` | Le déploiement n'est pas accessible à « Tout le monde ». |
| `Format inattendu : la clé 'projets' est absente` | L'onglet `Projets` est absent ou vide — relancez « Initialiser la base ». |
| `Failed to fetch` | L'URL ne se termine pas par `/exec`, ou le déploiement a été supprimé. |
| Les modifications du script restent sans effet | **Déployer → Gérer les déploiements → Modifier → Nouvelle version**. |
| Dates décalées d'un jour | Les colonnes de dates doivent être au format **Texte brut**. Le script s'en charge à l'initialisation. |
| « Créer les dossiers Drive » ne fait rien | Tous les projets ont déjà une `drive_url`. Videz la cellule pour forcer la recréation. |
