/**
 * ElodiaTech — Passerelle Google Sheets & Drive
 * Plateforme de pilotage des projets de santé (MSP & centres de santé)
 *
 * Ce script remplit trois rôles :
 *   1. Construire la base (menu « ElodiaTech » > « Initialiser la base »)
 *   2. Servir les données à l'application web (doGet / doPost)
 *   3. Créer l'arborescence Drive de chaque projet
 *
 * Fichier généré — voir docs/connexion-google-sheets.md du dépôt.
 */

/* ==========================================================================
   CONFIGURATION — identifiants des dossiers Drive
   ========================================================================== */
var DOSSIER_RACINE = '1MOmLg078g_VyPUFS614WkGrh30W4LAAP';   // ElodiaTech — Projets de Santé
var DOSSIER_PROJETS = '1aLdlM3QJwdpm6XfqvhtUXLK9FJfxTY9v';  // 03 — Projets
var DOSSIER_MODELE = '1yxmCRenKoK-WR7EgZSmIMuIxECnoi4xu';   // _MODELE — Nouveau projet

/* ==========================================================================
   STRUCTURE DES ONGLETS
   ========================================================================== */
var ONGLETS = {
  "Lisez-moi": [
    "Consigne"
  ],
  "Projets": [
    "id",
    "nom",
    "type",
    "ville",
    "departement",
    "adresse",
    "lat",
    "lng",
    "reference",
    "formule",
    "option_immobilier",
    "modele_juridique",
    "date_debut",
    "client_nom",
    "client_fonction",
    "client_email",
    "client_tel",
    "consultant_nom",
    "consultant_email",
    "equipe",
    "surface",
    "gdoc_projet_sante",
    "drive_url",
    "site_url"
  ],
  "Prestations": [
    "projet_id",
    "prestation_id",
    "statut",
    "echeance",
    "note",
    "livrable_url"
  ],
  "Catalogue": [
    "prestation_id",
    "lot",
    "lot_nom",
    "titre",
    "description",
    "livrable",
    "acteur",
    "jours",
    "F1",
    "F2",
    "F3"
  ],
  "Documents": [
    "projet_id",
    "id",
    "nom",
    "cat",
    "type",
    "taille",
    "date",
    "auteur",
    "url"
  ],
  "Signatures": [
    "projet_id",
    "id",
    "titre",
    "desc",
    "statut",
    "date",
    "url"
  ],
  "Messages": [
    "projet_id",
    "id",
    "auteur",
    "role",
    "texte",
    "date"
  ],
  "Evenements": [
    "projet_id",
    "id",
    "titre",
    "type",
    "date",
    "heure",
    "lieu"
  ],
  "ComptesRendus": [
    "projet_id",
    "id",
    "date",
    "objet",
    "participants",
    "decisions",
    "statut"
  ],
  "Financements": [
    "projet_id",
    "id",
    "source",
    "montant",
    "statut",
    "echeance"
  ],
  "Partenaires": [
    "projet_id",
    "id",
    "nom",
    "type",
    "statut"
  ]
};

var ENTITES_PAR_PROJET = {
  documents:     { onglet: 'Documents',     champs: ['id', 'nom', 'cat', 'type', 'taille', 'date', 'auteur', 'url'] },
  signatures:    { onglet: 'Signatures',    champs: ['id', 'titre', 'desc', 'statut', 'date', 'url'] },
  messages:      { onglet: 'Messages',      champs: ['id', 'auteur', 'role', 'texte', 'date'] },
  evenements:    { onglet: 'Evenements',    champs: ['id', 'titre', 'type', 'date', 'heure', 'lieu'] },
  comptesRendus: { onglet: 'ComptesRendus', champs: ['id', 'date', 'objet', 'participants', 'decisions', 'statut'] },
  financements:  { onglet: 'Financements',  champs: ['id', 'source', 'montant', 'statut', 'echeance'] },
  partenaires:   { onglet: 'Partenaires',   champs: ['id', 'nom', 'type', 'statut'] }
};

/* ==========================================================================
   DONNÉES D'AMORÇAGE (jeu de démonstration)
   ========================================================================== */
var AMORCE = {
 "Lisez-moi": [
  [
   "Base de données de la plateforme ElodiaTech — Projets de Santé."
  ],
  [
   ""
  ],
  [
   "Ne renommez pas les onglets ni la première ligne de chaque onglet : le script Apps Script s'appuie dessus."
  ],
  [
   "Onglet Projets     — un projet par ligne. La colonne « formule » vaut F1, F2 ou F3."
  ],
  [
   "Onglet Prestations — une ligne par prestation et par projet. Statuts : a_faire, en_cours, a_valider, valide, bloque."
  ],
  [
   "Onglet Catalogue   — référence en lecture seule des 34 prestations et de leur rattachement aux formules."
  ],
  [
   "Autres onglets     — documents, signatures, messages, événements, comptes rendus, financements, partenaires."
  ],
  [
   ""
  ],
  [
   "Les dates s'écrivent au format AAAA-MM-JJ. Formatez ces colonnes en « Texte brut » pour éviter tout décalage."
  ],
  [
   ""
  ],
  [
   "Mise en service : Extensions > Apps Script, puis suivre docs/connexion-google-sheets.md du dépôt GitHub."
  ],
  [
   "Le dossier Drive « ElodiaTech — Projets de Santé » accueille les pièces déposées par le client et l'expert."
  ]
 ],
 "Projets": [
  [
   "msp-fort-de-france",
   "MSP Santé Caraïbes",
   "MSP",
   "Fort-de-France",
   "Martinique (972)",
   "124 avenue de la Liberté, 97232 Le Lamentin",
   14.615,
   -61.002,
   "MSP-972-0048",
   "F3",
   "OUI",
   "sisa",
   "2025-10-31",
   "Dr Marc Dubois",
   "Médecin généraliste · porteur du projet",
   "m.dubois@msp-caraibes.fr",
   "0596 00 00 00",
   "Jean-Philippe B.",
   "jp.b@elodiatech.com",
   9,
   280,
   "https://docs.google.com/document/d/EXEMPLE_MSP_CARAIBES/edit",
   "https://drive.google.com/drive/folders/EXEMPLE_MSP_CARAIBES",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "MSP Archipel",
   "MSP",
   "Pointe-à-Pitre",
   "Guadeloupe (971)",
   "8 rue Frébault, 97110 Pointe-à-Pitre",
   16.2412,
   -61.5344,
   "MSP-971-0112",
   "F2",
   "OUI",
   "sisa",
   "2026-03-03",
   "Dr Aline Mercier",
   "Médecin généraliste · coordinatrice",
   "a.mercier@msp-archipel.fr",
   "0590 00 00 00",
   "Jean-Philippe B.",
   "jp.b@elodiatech.com",
   6,
   195,
   "https://docs.google.com/document/d/EXEMPLE_MSP_ARCHIPEL/edit",
   "https://drive.google.com/drive/folders/EXEMPLE_MSP_ARCHIPEL",
   ""
  ],
  [
   "cds-gros-morne",
   "Centre de Santé Nord",
   "CDS",
   "Gros-Morne",
   "Martinique (972)",
   "15 rue Schoelcher, 97213 Gros-Morne",
   14.7333,
   -61.0167,
   "CDS-972-0031",
   "F1",
   "NON",
   "assoc",
   "2026-05-31",
   "Mme Sophie Rivière",
   "Directrice · structure gestionnaire",
   "s.riviere@cds-nord.fr",
   "0596 00 00 00",
   "Camille R.",
   "c.r@elodiatech.com",
   12,
   240,
   "https://docs.google.com/document/d/EXEMPLE_CDS_NORD/edit",
   "https://drive.google.com/drive/folders/EXEMPLE_CDS_NORD",
   ""
  ],
  [
   "cds-cayenne",
   "Centre de Santé Amazonie",
   "CDS",
   "Cayenne",
   "Guyane (973)",
   "42 avenue du Général de Gaulle, 97300 Cayenne",
   4.9224,
   -52.3135,
   "CDS-973-0007",
   "F2",
   "NON",
   "assoc",
   "2026-07-01",
   "Dr Paul Anselme",
   "Médecin coordonnateur",
   "p.anselme@cds-amazonie.fr",
   "0594 00 00 00",
   "Camille R.",
   "c.r@elodiatech.com",
   8,
   310,
   "",
   "",
   ""
  ]
 ],
 "Prestations": [
  [
   "msp-fort-de-france",
   "P01",
   "valide",
   "2025-11-03",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P02",
   "valide",
   "2025-11-05",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P03",
   "valide",
   "2025-11-07",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P04",
   "valide",
   "2025-11-10",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P05",
   "valide",
   "2025-11-11",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P06",
   "valide",
   "2025-11-21",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P07",
   "valide",
   "2025-11-29",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P08",
   "valide",
   "2025-12-14",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P09",
   "valide",
   "2025-12-20",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P10",
   "valide",
   "2025-12-25",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P11",
   "valide",
   "2025-12-29",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P12",
   "valide",
   "2026-01-02",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P13",
   "valide",
   "2026-01-06",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P14",
   "valide",
   "2026-01-10",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P15",
   "valide",
   "2026-01-15",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P16",
   "valide",
   "2026-01-20",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P17",
   "valide",
   "2026-01-30",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P18",
   "valide",
   "2026-02-07",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P19",
   "valide",
   "2026-02-11",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P20",
   "valide",
   "2026-02-17",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P21",
   "valide",
   "2026-02-22",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P22",
   "valide",
   "2026-03-02",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P23",
   "valide",
   "2026-03-06",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P24",
   "valide",
   "2026-03-11",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P25",
   "a_valider",
   "2026-08-04",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P26",
   "en_cours",
   "2026-08-06",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P27",
   "bloque",
   "2026-07-26",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P28",
   "a_faire",
   "2026-08-09",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P29",
   "a_faire",
   "2026-08-15",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P30",
   "a_faire",
   "2026-08-20",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P31",
   "a_faire",
   "2026-08-25",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P32",
   "en_cours",
   "2026-09-09",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P33",
   "a_faire",
   "2026-09-21",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P34",
   "a_faire",
   "2026-10-11",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P01",
   "valide",
   "2026-03-06",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P02",
   "valide",
   "2026-03-08",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P03",
   "valide",
   "2026-03-10",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P04",
   "valide",
   "2026-03-13",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P05",
   "valide",
   "2026-03-14",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P06",
   "valide",
   "2026-03-24",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P07",
   "valide",
   "2026-04-01",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P08",
   "valide",
   "2026-04-16",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P09",
   "valide",
   "2026-04-22",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P10",
   "valide",
   "2026-04-27",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P11",
   "valide",
   "2026-05-01",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P12",
   "valide",
   "2026-05-05",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P13",
   "valide",
   "2026-05-09",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P14",
   "valide",
   "2026-05-13",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P15",
   "valide",
   "2026-05-18",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P16",
   "a_valider",
   "2026-08-05",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P17",
   "en_cours",
   "2026-08-15",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P18",
   "en_cours",
   "2026-08-23",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P19",
   "a_faire",
   "2026-08-27",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P20",
   "a_faire",
   "2026-09-02",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P21",
   "a_faire",
   "2026-07-26",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P22",
   "a_faire",
   "2026-09-10",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P23",
   "a_faire",
   "2026-09-14",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P24",
   "a_faire",
   "2026-09-19",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P25",
   "a_faire",
   "2026-09-23",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P26",
   "a_faire",
   "2026-09-25",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P27",
   "a_faire",
   "2026-09-29",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P28",
   "a_faire",
   "2026-10-02",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P01",
   "valide",
   "2026-06-03",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P02",
   "valide",
   "2026-06-05",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P03",
   "valide",
   "2026-06-07",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P04",
   "valide",
   "2026-06-10",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P05",
   "valide",
   "2026-06-11",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P06",
   "valide",
   "2026-06-21",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P07",
   "valide",
   "2026-06-29",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P08",
   "a_valider",
   "2026-08-15",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P09",
   "en_cours",
   "2026-08-21",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P10",
   "en_cours",
   "2026-08-26",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P11",
   "a_faire",
   "2026-08-30",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P12",
   "a_faire",
   "2026-09-03",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P13",
   "a_faire",
   "2026-09-07",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P14",
   "a_faire",
   "2026-09-11",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P15",
   "a_faire",
   "2026-09-16",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P16",
   "a_faire",
   "2026-09-21",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P01",
   "valide",
   "2026-07-04",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P02",
   "valide",
   "2026-07-06",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P03",
   "valide",
   "2026-07-08",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P04",
   "valide",
   "2026-07-11",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P05",
   "a_valider",
   "2026-08-01",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P06",
   "en_cours",
   "2026-08-11",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P07",
   "en_cours",
   "2026-08-19",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P08",
   "a_faire",
   "2026-09-03",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P09",
   "a_faire",
   "2026-09-09",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P10",
   "a_faire",
   "2026-09-14",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P11",
   "a_faire",
   "2026-09-18",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P12",
   "a_faire",
   "2026-09-22",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P13",
   "a_faire",
   "2026-09-26",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P14",
   "a_faire",
   "2026-09-30",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P15",
   "a_faire",
   "2026-10-05",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P16",
   "a_faire",
   "2026-10-10",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P17",
   "a_faire",
   "2026-10-20",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P18",
   "a_faire",
   "2026-10-28",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P19",
   "a_faire",
   "2026-11-01",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P20",
   "a_faire",
   "2026-11-07",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P21",
   "a_faire",
   "2026-11-12",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P22",
   "a_faire",
   "2026-11-20",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P23",
   "a_faire",
   "2026-11-24",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P24",
   "a_faire",
   "2026-11-29",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P25",
   "a_faire",
   "2026-12-03",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P26",
   "a_faire",
   "2026-12-05",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P27",
   "a_faire",
   "2026-12-09",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P28",
   "a_faire",
   "2026-12-12",
   "",
   ""
  ]
 ],
 "Catalogue": [
  [
   "P01",
   "L0",
   "Cadrage & démarrage",
   "Questionnaire de faisabilité",
   "Recueil des informations sur l'équipe, le territoire et la maturité du projet.",
   "Questionnaire complété",
   "client",
   3,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P02",
   "L0",
   "Cadrage & démarrage",
   "Rendez-vous découverte (visio)",
   "Échange de cadrage avec l'expert : ambitions, contraintes, calendrier cible.",
   "Compte rendu de cadrage",
   "mixte",
   2,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P03",
   "L0",
   "Cadrage & démarrage",
   "Validation du périmètre & de l'offre",
   "Choix de la formule d'accompagnement et validation du périmètre d'intervention.",
   "Proposition commerciale signée",
   "mixte",
   2,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P04",
   "L0",
   "Cadrage & démarrage",
   "Signature du mandat d'accompagnement",
   "Signature électronique du devis et du mandat d'accompagnement ElodiaTech.",
   "Mandat signé (eIDAS)",
   "client",
   3,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P05",
   "L0",
   "Cadrage & démarrage",
   "Ouverture de l'espace client & du Drive",
   "Création de l'espace de suivi, du coffre-fort documentaire et des accès de l'équipe.",
   "Accès plateforme & Drive",
   "expert",
   1,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P06",
   "LA",
   "Projet de santé",
   "Diagnostic territorial",
   "Démographie médicale, zonage ARS (ZIP/ZAC), QPV, offre de soins existante, données INSEE et CartoSanté.",
   "Rapport de diagnostic territorial",
   "expert",
   10,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P07",
   "LA",
   "Projet de santé",
   "Analyse des besoins de santé",
   "Prévalence des pathologies, populations cibles, besoins non couverts, priorités de santé publique du territoire.",
   "Note d'analyse des besoins",
   "expert",
   8,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P08",
   "LA",
   "Projet de santé",
   "Construction du projet de santé",
   "Rédaction structurée du projet de santé conforme aux attendus HAS et au cahier des charges ARS.",
   "Projet de santé (version de travail)",
   "mixte",
   15,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P09",
   "LA",
   "Projet de santé",
   "Axes stratégiques & plan d'actions",
   "Définition des axes prioritaires, des actions opérationnelles, des porteurs et des indicateurs de suivi.",
   "Plan d'actions pluriannuel",
   "mixte",
   6,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P10",
   "LA",
   "Projet de santé",
   "Organisation de l'exercice coordonné",
   "Réunions de concertation pluriprofessionnelle (RCP), protocoles pluriprofessionnels, parcours patients complexes.",
   "Protocoles & modalités RCP",
   "mixte",
   5,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P11",
   "LA",
   "Projet de santé",
   "Accès aux soins",
   "Amplitude horaire, soins non programmés, articulation avec le SAS et la régulation, réponse aux demandes urgentes.",
   "Volet accès aux soins",
   "mixte",
   4,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P12",
   "LA",
   "Projet de santé",
   "Prévention",
   "Actions de prévention et de dépistage, éducation thérapeutique du patient (ETP), promotion de la santé.",
   "Programme de prévention",
   "mixte",
   4,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P13",
   "LA",
   "Projet de santé",
   "Travail en équipe",
   "Composition de l'équipe, gouvernance, réunions d'équipe, accueil des stagiaires et des nouveaux professionnels.",
   "Volet organisation d'équipe",
   "mixte",
   4,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P14",
   "LA",
   "Projet de santé",
   "Partage d'informations",
   "Système d'information partagé labellisé Ségur, messagerie sécurisée MSSanté, Mon espace santé, conformité RGPD.",
   "Volet système d'information",
   "mixte",
   4,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P15",
   "LA",
   "Projet de santé",
   "Qualité & évaluation",
   "Démarche qualité, indicateurs de suivi, modalités d'évaluation annuelle et d'amélioration continue.",
   "Dispositif qualité & indicateurs",
   "expert",
   5,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P16",
   "LA",
   "Projet de santé",
   "Document finalisé",
   "Mise en forme, relecture, validation par l'équipe et production du document définitif transmissible à l'ARS.",
   "Projet de santé finalisé (PDF)",
   "expert",
   5,
   "OUI",
   "OUI",
   "OUI"
  ],
  [
   "P17",
   "LB",
   "Structuration juridique & dossier ARS",
   "Structuration SISA ou association 1901",
   "Choix du véhicule juridique, rédaction des statuts, règlement intérieur, formalités d'immatriculation.",
   "Statuts & règlement intérieur",
   "expert",
   10,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P18",
   "LB",
   "Structuration juridique & dossier ARS",
   "Préparation du dossier ARS",
   "Constitution du dossier complet, vérification des pièces obligatoires, cohérence avec le cahier des charges régional.",
   "Dossier ARS complet",
   "expert",
   8,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P19",
   "LB",
   "Structuration juridique & dossier ARS",
   "Accompagnement au dépôt",
   "Dépôt sur le portail dédié, suivi de l'instruction, réponses aux demandes de compléments.",
   "Accusé de dépôt ARS",
   "expert",
   4,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P20",
   "LB",
   "Structuration juridique & dossier ARS",
   "Démarches ACI applicables",
   "Vérification de l'éligibilité à l'ACI, montage du contrat tripartite et dépôt auprès de la CPAM.",
   "Contrat ACI déposé",
   "expert",
   6,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P21",
   "LC",
   "Financements & subventions",
   "Identification des aides ARS",
   "Recensement des aides mobilisables (FIR, aides à l'installation, crédits d'amorçage) et montage des demandes.",
   "Dossier de demande FIR",
   "expert",
   5,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P22",
   "LC",
   "Financements & subventions",
   "Opportunités FEDER si mobilisables",
   "Analyse d'éligibilité aux fonds européens, montage du dossier et dépôt sur le portail e-Synergie.",
   "Dossier FEDER déposé",
   "expert",
   8,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P23",
   "LD",
   "Conventions & partenariats",
   "Conventions CCAS",
   "Conventionnement avec le centre communal d'action sociale et les collectivités du territoire.",
   "Convention CCAS signée",
   "expert",
   4,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P24",
   "LD",
   "Conventions & partenariats",
   "Conventions partenaires médicaux",
   "Conventions avec les établissements hospitaliers, HAD, SSIAD, laboratoires et pharmacies partenaires.",
   "Conventions partenaires",
   "expert",
   5,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P25",
   "LD",
   "Conventions & partenariats",
   "Partenariats prévention",
   "Partenariats avec les acteurs de la prévention, associations de patients et réseaux de santé publique.",
   "Conventions prévention",
   "expert",
   4,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P26",
   "LE",
   "Prestataires & outils métier",
   "Mise en relation expert-comptable",
   "Sélection d'un cabinet spécialisé SISA / structure de santé, cadrage de la mission comptable et sociale.",
   "Devis expert-comptable",
   "expert",
   2,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P27",
   "LE",
   "Prestataires & outils métier",
   "Prestataires logiciels médicaux",
   "Analyse des solutions labellisées Ségur, comparatif fonctionnel et financier adapté à la structure.",
   "Comparatif logiciels",
   "expert",
   4,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P28",
   "LE",
   "Prestataires & outils métier",
   "Organisation des démonstrations",
   "Planification et animation des démonstrations éditeurs avec l'équipe, aide à la décision finale.",
   "Grille de décision éditeur",
   "expert",
   3,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P29",
   "LF",
   "Identité visuelle & digital",
   "Création du logo",
   "Conception du logo de la structure, propositions, itérations et livraison des fichiers sources.",
   "Logo (SVG, PNG, sources)",
   "expert",
   6,
   "",
   "",
   "OUI"
  ],
  [
   "P30",
   "LF",
   "Identité visuelle & digital",
   "Charte graphique",
   "Palette, typographies, règles d'usage et gabarits documentaires de la structure.",
   "Charte graphique (PDF)",
   "expert",
   5,
   "",
   "",
   "OUI"
  ],
  [
   "P31",
   "LF",
   "Identité visuelle & digital",
   "Identité visuelle & déclinaisons",
   "Signalétique, papeterie, plaquette patients, supports d'affichage et déclinaisons réseaux.",
   "Kit de déclinaisons",
   "expert",
   5,
   "",
   "",
   "OUI"
  ],
  [
   "P32",
   "LF",
   "Identité visuelle & digital",
   "Site internet professionnel",
   "Conception, rédaction, mise en ligne du site de la structure, mentions légales et conformité RGPD.",
   "Site internet en ligne",
   "expert",
   15,
   "",
   "",
   "OUI"
  ],
  [
   "P33",
   "LG",
   "Déploiement & coordination",
   "Accompagnement au déploiement",
   "Installation des outils, formation de l'équipe, procédures d'accueil et accompagnement à l'ouverture.",
   "Plan de déploiement & formations",
   "expert",
   12,
   "",
   "",
   "OUI"
  ],
  [
   "P34",
   "LG",
   "Déploiement & coordination",
   "Coordination globale du projet",
   "Pilotage transverse, comités de suivi, interface avec l'ensemble des intervenants jusqu'à l'ouverture.",
   "Comptes rendus de comités",
   "expert",
   20,
   "",
   "",
   "OUI"
  ]
 ],
 "Documents": [
  [
   "msp-fort-de-france",
   "doc1",
   "Projet_de_sante_MSP_Caraibes_V4.pdf",
   "Projet",
   "pdf",
   "4,2 Mo",
   "2026-07-05",
   "Jean-Philippe B.",
   ""
  ],
  [
   "msp-fort-de-france",
   "doc2",
   "Statuts_SISA_signes.pdf",
   "Juridique",
   "pdf",
   "1,1 Mo",
   "2026-05-31",
   "Jean-Philippe B.",
   ""
  ],
  [
   "msp-fort-de-france",
   "doc3",
   "Dossier_ARS_depot.zip",
   "ARS",
   "zip",
   "18,4 Mo",
   "2026-06-21",
   "Jean-Philippe B.",
   ""
  ],
  [
   "msp-fort-de-france",
   "doc4",
   "Plan_financement_triennal.xlsx",
   "Finances",
   "xls",
   "286 Ko",
   "2026-07-13",
   "Jean-Philippe B.",
   ""
  ],
  [
   "msp-fort-de-france",
   "doc5",
   "Plans_execution_BPE.pdf",
   "Immobilier",
   "pdf",
   "12,7 Mo",
   "2026-06-28",
   "ArchiSanté Caraïbes",
   ""
  ],
  [
   "msp-fort-de-france",
   "doc6",
   "Charte_graphique_MSP.pdf",
   "Identité",
   "pdf",
   "6,8 Mo",
   "2026-07-22",
   "Studio ElodiaTech",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "doc7",
   "Diagnostic_territorial_971.pdf",
   "Projet",
   "pdf",
   "3,4 Mo",
   "2026-06-09",
   "Jean-Philippe B.",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "doc8",
   "Projet_de_sante_V2_travail.docx",
   "Projet",
   "doc",
   "780 Ko",
   "2026-07-25",
   "Jean-Philippe B.",
   ""
  ],
  [
   "cds-gros-morne",
   "doc9",
   "Questionnaire_faisabilite.pdf",
   "Projet",
   "pdf",
   "520 Ko",
   "2026-06-13",
   "Sophie Rivière",
   ""
  ],
  [
   "cds-gros-morne",
   "doc10",
   "Analyse_besoins_sante_Nord.pdf",
   "Projet",
   "pdf",
   "2,9 Mo",
   "2026-07-20",
   "Camille R.",
   ""
  ],
  [
   "cds-cayenne",
   "doc11",
   "Compte_rendu_cadrage.pdf",
   "Projet",
   "pdf",
   "410 Ko",
   "2026-07-17",
   "Camille R.",
   ""
  ]
 ],
 "Signatures": [
  [
   "msp-fort-de-france",
   "sig1",
   "Mandat d'accompagnement ElodiaTech",
   "Devis et mandat d'accompagnement Formule 3.",
   "signe",
   "2025-11-18",
   ""
  ],
  [
   "msp-fort-de-france",
   "sig2",
   "Statuts constitutifs SISA",
   "Acte constitutif à déposer au greffe du tribunal de commerce.",
   "signe",
   "2026-01-22",
   ""
  ],
  [
   "msp-fort-de-france",
   "sig3",
   "Projet de santé — validation équipe",
   "Validation collégiale du projet de santé avant transmission à l'ARS.",
   "signe",
   "2026-07-01",
   ""
  ],
  [
   "msp-fort-de-france",
   "sig4",
   "Contrat ACI (CPAM)",
   "Contrat tripartite d'engagement interprofessionnel.",
   "a_signer",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "sig5",
   "Convention CCAS Le Lamentin",
   "Convention de partenariat avec le centre communal d'action sociale.",
   "a_signer",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "sig6",
   "Mandat d'accompagnement ElodiaTech",
   "Devis et mandat Formule 2.",
   "signe",
   "2026-03-03",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "sig7",
   "Statuts constitutifs SISA",
   "Statuts en attente de signature des associés.",
   "a_signer",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "sig8",
   "Mandat d'accompagnement ElodiaTech",
   "Devis et mandat Formule 1.",
   "signe",
   "2026-06-01",
   ""
  ],
  [
   "cds-cayenne",
   "sig9",
   "Mandat d'accompagnement ElodiaTech",
   "Devis et mandat Formule 2.",
   "signe",
   "2026-07-03",
   ""
  ]
 ],
 "Messages": [
  [
   "msp-fort-de-france",
   "m1",
   "Jean-Philippe B.",
   "expert",
   "Bonjour Docteur, le dossier ARS a bien été déposé. Nous sommes en attente de l'accusé de réception.",
   "2026-07-19"
  ],
  [
   "msp-fort-de-france",
   "m2",
   "Dr Marc Dubois",
   "client",
   "Parfait, merci. Où en est le contrat ACI ?",
   "2026-07-20"
  ],
  [
   "msp-fort-de-france",
   "m3",
   "Jean-Philippe B.",
   "expert",
   "Le contrat ACI est prêt et déposé sur le parapheur électronique. Il attend votre signature.",
   "2026-07-21"
  ],
  [
   "msp-pointe-a-pitre",
   "m4",
   "Jean-Philippe B.",
   "expert",
   "Le diagnostic territorial est finalisé, vous pouvez le consulter dans le coffre-fort documentaire.",
   "2026-07-23"
  ],
  [
   "cds-gros-morne",
   "m5",
   "Camille R.",
   "expert",
   "Bonjour, l'analyse des besoins de santé est terminée. Je vous propose une visio la semaine prochaine.",
   "2026-07-26"
  ],
  [
   "cds-cayenne",
   "m6",
   "Camille R.",
   "expert",
   "Bienvenue sur votre espace de suivi. Le questionnaire de faisabilité est disponible.",
   "2026-07-17"
  ]
 ],
 "Evenements": [
  [
   "msp-fort-de-france",
   "e1",
   "Comité de pilotage mensuel",
   "reunion",
   "2026-08-04",
   "14:30",
   "Visioconférence"
  ],
  [
   "msp-fort-de-france",
   "e2",
   "Commission ARS — instruction du dossier",
   "jalon",
   "2026-08-21",
   "09:00",
   "ARS Martinique"
  ],
  [
   "msp-fort-de-france",
   "e3",
   "Livraison de la maquette du site internet",
   "livrable",
   "2026-08-12",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "e4",
   "Formation équipe — logiciel métier",
   "formation",
   "2026-09-04",
   "09:00",
   "Sur site"
  ],
  [
   "msp-pointe-a-pitre",
   "e5",
   "Atelier rédaction — exercice coordonné",
   "reunion",
   "2026-08-06",
   "18:00",
   "Visioconférence"
  ],
  [
   "msp-pointe-a-pitre",
   "e6",
   "Clôture du dépôt FEDER",
   "jalon",
   "2026-08-18",
   "23:59",
   "Portail e-Synergie"
  ],
  [
   "cds-gros-morne",
   "e7",
   "Restitution du diagnostic territorial",
   "reunion",
   "2026-08-09",
   "10:00",
   "Sur site"
  ],
  [
   "cds-cayenne",
   "e8",
   "Rendez-vous découverte",
   "reunion",
   "2026-08-03",
   "15:00",
   "Visioconférence"
  ]
 ],
 "ComptesRendus": [
  [
   "msp-fort-de-france",
   "cr1",
   "2026-07-19",
   "Comité de pilotage — juillet",
   "Dr Dubois, Jean-Philippe B., ArchiSanté",
   "Validation des plans d'exécution. Lancement de la charte graphique.",
   "valide"
  ],
  [
   "msp-fort-de-france",
   "cr2",
   "2026-06-21",
   "Cadrage des statuts SISA",
   "Associés, Jean-Philippe B., cabinet comptable",
   "Modèle SISA approuvé à l'unanimité des associés.",
   "valide"
  ],
  [
   "msp-pointe-a-pitre",
   "cr3",
   "2026-07-11",
   "Restitution du diagnostic territorial",
   "Dr Mercier, équipe, Jean-Philippe B.",
   "Priorisation de trois axes : diabète, santé mentale, prévention.",
   "valide"
  ],
  [
   "cds-cayenne",
   "cr4",
   "2026-07-17",
   "Réunion de lancement",
   "Dr Anselme, Camille R.",
   "Calendrier validé, démarrage du diagnostic territorial.",
   "valide"
  ]
 ],
 "Financements": [
  [
   "msp-fort-de-france",
   "f1",
   "FIR — ARS Martinique",
   120000,
   "accorde",
   "2026-06-01"
  ],
  [
   "msp-fort-de-france",
   "f2",
   "FEDER — programme régional",
   240000,
   "instruction",
   "2026-09-14"
  ],
  [
   "msp-fort-de-france",
   "f3",
   "ACI — CPAM",
   68000,
   "depose",
   "2026-08-30"
  ],
  [
   "msp-fort-de-france",
   "f4",
   "Collectivité territoriale",
   45000,
   "instruction",
   "2026-09-29"
  ],
  [
   "msp-pointe-a-pitre",
   "f5",
   "FIR — ARS Guadeloupe",
   85000,
   "depose",
   "2026-08-25"
  ],
  [
   "msp-pointe-a-pitre",
   "f6",
   "FEDER — programme régional",
   150000,
   "etude",
   "2026-10-29"
  ],
  [
   "cds-cayenne",
   "f7",
   "FIR — ARS Guyane",
   95000,
   "etude",
   "2026-10-14"
  ]
 ],
 "Partenaires": [
  [
   "msp-fort-de-france",
   "pa1",
   "CCAS du Lamentin",
   "Collectivité",
   "a_signer"
  ],
  [
   "msp-fort-de-france",
   "pa2",
   "CHU de Martinique",
   "Établissement hospitalier",
   "signe"
  ],
  [
   "msp-fort-de-france",
   "pa3",
   "HAD Martinique",
   "Hospitalisation à domicile",
   "signe"
  ],
  [
   "msp-fort-de-france",
   "pa4",
   "Réseau prévention diabète 972",
   "Prévention",
   "en_cours"
  ],
  [
   "msp-pointe-a-pitre",
   "pa5",
   "CHU de Guadeloupe",
   "Établissement hospitalier",
   "en_cours"
  ]
 ]
};

/* ==========================================================================
   MENU
   ========================================================================== */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ElodiaTech')
    .addItem('Initialiser la base (onglets + données de démonstration)', 'initialiserBase')
    .addItem('Créer les onglets vides seulement', 'initialiserBaseVide')
    .addSeparator()
    .addItem('Créer les dossiers Drive manquants', 'creerTousLesDossiers')
    .addToUi();
}

/* ==========================================================================
   CONSTRUCTION DE LA BASE
   ========================================================================== */
function initialiserBase() { construire(true); }
function initialiserBaseVide() { construire(false); }

function construire(avecDonnees) {
  var classeur = SpreadsheetApp.getActive();
  var ui = SpreadsheetApp.getUi();

  var reponse = ui.alert(
    'Initialiser la base',
    avecDonnees
      ? 'Les onglets vont être créés et remplis avec le jeu de démonstration. Les onglets existants du même nom seront écrasés. Continuer ?'
      : 'Les onglets vont être créés vides (en-têtes seuls). Les onglets existants du même nom seront écrasés. Continuer ?',
    ui.ButtonSet.OK_CANCEL);
  if (reponse !== ui.Button.OK) return;

  Object.keys(ONGLETS).forEach(function (nom) {
    var entetes = ONGLETS[nom];
    var feuille = classeur.getSheetByName(nom);
    if (feuille) { feuille.clear(); } else { feuille = classeur.insertSheet(nom); }

    feuille.getRange(1, 1, 1, entetes.length).setValues([entetes])
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1e95cb');
    feuille.setFrozenRows(1);

    if (avecDonnees && AMORCE[nom] && AMORCE[nom].length) {
      var lignes = AMORCE[nom].map(function (l) {
        var copie = l.slice();
        while (copie.length < entetes.length) copie.push('');
        return copie;
      });
      feuille.getRange(2, 1, lignes.length, entetes.length).setValues(lignes);
    }

    // Les colonnes de dates restent en texte : évite tout décalage de fuseau.
    entetes.forEach(function (titre, i) {
      if (titre === 'date' || titre === 'echeance' || titre === 'date_debut') {
        feuille.getRange(1, i + 1, feuille.getMaxRows()).setNumberFormat('@');
      }
    });

    feuille.autoResizeColumns(1, Math.min(entetes.length, 8));
  });

  // Onglet par défaut « Feuille 1 » devenu inutile
  var parDefaut = classeur.getSheetByName('Feuille 1') || classeur.getSheetByName('Sheet1');
  if (parDefaut && classeur.getSheets().length > 1) classeur.deleteSheet(parDefaut);

  classeur.setActiveSheet(classeur.getSheetByName('Lisez-moi'));
  ui.alert('Base initialisée', 'Les ' + Object.keys(ONGLETS).length + ' onglets sont prêts.', ui.ButtonSet.OK);
}

/* ==========================================================================
   API — LECTURE
   ========================================================================== */
function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === 'getAll') return json(construireDonnees());
    return json({ erreur: 'Action inconnue' });
  } catch (err) {
    return json({ erreur: String(err) });
  }
}

function construireDonnees() {
  var projets = lireOnglet('Projets').map(function (r) {
    return {
      id: r.id,
      nom: r.nom,
      type: r.type || 'MSP',
      ville: r.ville || '',
      departement: r.departement || '',
      adresse: r.adresse || '',
      coords: [Number(r.lat) || 14.64, Number(r.lng) || -61.02],
      reference: r.reference || '',
      formule: r.formule || 'F1',
      options: { immobilier: String(r.option_immobilier).toUpperCase() === 'OUI' },
      modeleJuridique: r.modele_juridique || 'sisa',
      dateDebut: iso(r.date_debut),
      client: {
        nom: r.client_nom || '', fonction: r.client_fonction || '',
        email: r.client_email || '', tel: String(r.client_tel || '')
      },
      consultant: { nom: r.consultant_nom || '', email: r.consultant_email || '' },
      equipe: Number(r.equipe) || 0,
      surface: Number(r.surface) || 0,
      gdocProjetSante: r.gdoc_projet_sante || '',
      driveUrl: r.drive_url || '',
      siteUrl: r.site_url || '',
      prestations: {}
    };
  });

  var parId = {};
  projets.forEach(function (p) { parId[p.id] = p; });

  lireOnglet('Prestations').forEach(function (r) {
    var p = parId[r.projet_id];
    if (!p || !r.prestation_id) return;
    p.prestations[r.prestation_id] = {
      statut: r.statut || 'a_faire',
      echeance: iso(r.echeance),
      note: r.note || '',
      livrableUrl: r.livrable_url || '',
      majLe: iso(new Date())
    };
  });

  var donnees = { projets: projets };

  Object.keys(ENTITES_PAR_PROJET).forEach(function (cle) {
    var conf = ENTITES_PAR_PROJET[cle];
    var groupe = {};
    projets.forEach(function (p) { groupe[p.id] = []; });
    lireOnglet(conf.onglet).forEach(function (r) {
      if (!groupe[r.projet_id]) return;
      var item = {};
      conf.champs.forEach(function (c) {
        item[c] = (c === 'date' || c === 'echeance') ? iso(r[c]) : r[c];
      });
      if (conf.champs.indexOf('montant') >= 0) item.montant = Number(r.montant) || 0;
      groupe[r.projet_id].push(item);
    });
    donnees[cle] = groupe;
  });

  return donnees;
}

/* ==========================================================================
   API — ÉCRITURE
   ========================================================================== */
function doPost(e) {
  try {
    var requete = JSON.parse(e.postData.contents);
    if (requete.action !== 'update') return json({ erreur: 'Action non prise en charge' });

    if (requete.entite === 'prestations') {
      var parties = String(requete.id).split(':');
      majPrestation(parties[0], parties[1], requete.payload || {});
      return json({ ok: true });
    }
    return json({ erreur: 'Entité non prise en charge : ' + requete.entite });
  } catch (err) {
    return json({ erreur: String(err) });
  }
}

function majPrestation(projetId, prestationId, payload) {
  var feuille = SpreadsheetApp.getActive().getSheetByName('Prestations');
  if (!feuille) throw new Error("Onglet 'Prestations' introuvable");

  var valeurs = feuille.getDataRange().getValues();
  var entetes = valeurs[0].map(String);
  var iProjet = entetes.indexOf('projet_id');
  var iPresta = entetes.indexOf('prestation_id');

  var correspondance = { statut: 'statut', echeance: 'echeance', note: 'note', livrableUrl: 'livrable_url' };

  for (var ligne = 1; ligne < valeurs.length; ligne++) {
    if (valeurs[ligne][iProjet] === projetId && valeurs[ligne][iPresta] === prestationId) {
      Object.keys(correspondance).forEach(function (cle) {
        if (payload[cle] === undefined) return;
        var col = entetes.indexOf(correspondance[cle]);
        if (col >= 0) feuille.getRange(ligne + 1, col + 1).setValue(payload[cle]);
      });
      return;
    }
  }

  var nouvelle = entetes.map(function (h) {
    if (h === 'projet_id') return projetId;
    if (h === 'prestation_id') return prestationId;
    if (h === 'livrable_url') return payload.livrableUrl || '';
    return payload[h] !== undefined ? payload[h] : '';
  });
  feuille.appendRow(nouvelle);
}

/* ==========================================================================
   ARBORESCENCE DRIVE
   Crée, pour chaque projet dépourvu de drive_url, un dossier calqué sur
   « _MODELE — Nouveau projet » et inscrit son URL dans l'onglet Projets.
   ========================================================================== */
function creerTousLesDossiers() {
  var feuille = SpreadsheetApp.getActive().getSheetByName('Projets');
  if (!feuille) throw new Error("Onglet 'Projets' introuvable");

  var valeurs = feuille.getDataRange().getValues();
  var entetes = valeurs[0].map(String);
  var iId = entetes.indexOf('id');
  var iNom = entetes.indexOf('nom');
  var iVille = entetes.indexOf('ville');
  var iUrl = entetes.indexOf('drive_url');

  var parent = DriveApp.getFolderById(DOSSIER_PROJETS);
  var modele = DriveApp.getFolderById(DOSSIER_MODELE);
  var sousDossiers = [];
  var it = modele.getFolders();
  while (it.hasNext()) sousDossiers.push(it.next().getName());
  sousDossiers.sort();

  var crees = 0;
  for (var l = 1; l < valeurs.length; l++) {
    if (!valeurs[l][iId]) continue;
    if (String(valeurs[l][iUrl] || '').indexOf('http') === 0) continue;

    var titre = valeurs[l][iNom] + (valeurs[l][iVille] ? ' — ' + valeurs[l][iVille] : '');
    var dossier = parent.createFolder(titre);
    sousDossiers.forEach(function (n) { dossier.createFolder(n); });

    feuille.getRange(l + 1, iUrl + 1).setValue(dossier.getUrl());
    crees++;
  }

  SpreadsheetApp.getUi().alert(
    'Dossiers Drive',
    crees ? crees + ' dossier(s) de projet créé(s) avec leurs sous-dossiers.' : 'Tous les projets disposent déjà de leur dossier.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/* ==========================================================================
   UTILITAIRES
   ========================================================================== */
function lireOnglet(nom) {
  var feuille = SpreadsheetApp.getActive().getSheetByName(nom);
  if (!feuille) return [];
  var valeurs = feuille.getDataRange().getValues();
  if (valeurs.length < 2) return [];
  var entetes = valeurs[0].map(function (h) { return String(h).trim(); });
  return valeurs.slice(1)
    .filter(function (l) { return l.join('').trim() !== ''; })
    .map(function (l) {
      var obj = {};
      entetes.forEach(function (h, i) { obj[h] = l[i]; });
      return obj;
    });
}

function iso(valeur) {
  if (!valeur) return '';
  if (valeur instanceof Date) return Utilities.formatDate(valeur, 'GMT', 'yyyy-MM-dd');
  return String(valeur).slice(0, 10);
}

function json(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet))
    .setMimeType(ContentService.MimeType.JSON);
}
