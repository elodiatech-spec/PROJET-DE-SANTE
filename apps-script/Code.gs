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
/** Adresse publique de l'application, vers laquelle renvoyer les visiteurs égarés. */
var URL_APPLICATION = 'https://elodiatech-spec.github.io/PROJET-DE-SANTE/';

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
    "client_indicatif",
    "consultant_nom",
    "consultant_email",
    "equipe",
    "surface",
    "gdoc_projet_sante",
    "drive_url",
    "site_url",
    "notes",
    "jeton"
  ],
  "Prestations": [
    "projet_id",
    "prestation_id",
    "statut",
    "echeance",
    "date_realisation",
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
    "url",
    "piece"
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
    "lieu",
    "lien",
    "canal"
  ],
  "ComptesRendus": [
    "projet_id",
    "id",
    "date",
    "objet",
    "type",
    "participants",
    "decisions",
    "statut",
    "lien_meet",
    "lien_doc"
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
  ],
  "Pieces": [
    "projet_id",
    "id",
    "nom",
    "cat",
    "par",
    "aide",
    "pour"
  ],
  "Experts": [
    "id",
    "nom",
    "fonction",
    "email",
    "tel",
    "principal"
  ],
  "Questionnaire": [
    "projet_id",
    "rubrique",
    "donnees",
    "maj_le",
    "maj_par"
  ],
  "Redaction": [
    "projet_id", "chapitre", "statut", "lot_id", "doc_id", "doc_url", "version",
    "maj_le", "message", "fil", "consignes", "a_completer"
  ],
  "Actes": [
    "projet_id", "acte", "statut", "lot_id", "doc_id", "doc_url", "version",
    "maj_le", "message", "consignes", "a_completer"
  ],
  "Prestataires": [
    "id",
    "nom",
    "metier",
    "specialite",
    "contact",
    "tel",
    "lot"
  ]
};

var ENTITES_PAR_PROJET = {
  documents:     { onglet: 'Documents',     champs: ['id', 'nom', 'cat', 'type', 'taille', 'date', 'auteur', 'url', 'piece'] },
  signatures:    { onglet: 'Signatures',    champs: ['id', 'titre', 'desc', 'statut', 'date', 'url'] },
  messages:      { onglet: 'Messages',      champs: ['id', 'auteur', 'role', 'texte', 'date'] },
  evenements:    { onglet: 'Evenements',    champs: ['id', 'titre', 'type', 'canal', 'date', 'heure', 'lieu', 'lien'] },
  comptesRendus: { onglet: 'ComptesRendus', champs: ['id', 'date', 'objet', 'type', 'participants', 'decisions', 'statut', 'lien_meet', 'lien_doc'] },
  financements:  { onglet: 'Financements',  champs: ['id', 'source', 'montant', 'statut', 'echeance'] },
  partenaires:   { onglet: 'Partenaires',   champs: ['id', 'nom', 'type', 'statut'] },
  // Demandes de pièces ajoutées par l'expert, en plus du socle du catalogue.
  pieces:        { onglet: 'Pieces',        champs: ['id', 'nom', 'cat', 'par', 'aide', 'pour'] }
};

/**
 * QUESTIONNAIRE — informations fournies par le client pour la rédaction du
 * projet de santé. Une ligne par projet et par rubrique ; la colonne
 * « donnees » contient les réponses au format JSON.
 * Seuls les champs listés ici sont acceptés : tout autre champ envoyé par
 * le navigateur est ignoré, quel que soit le rôle.
 */
var QUESTIONNAIRE_CHAMPS = {
  structure:  ['type', 'nom', 'forme', 'porteur', 'coordinateur', 'coord_contact', 'commune', 'activites_agrement'],
  equipe:     ['pros', 'secretariat'],
  assistants: ['presence', 'liste'],
  locaux:     ['sites', 'occupation', 'surface', 'pieces', 'pmr', 'projet_immo'],
  horaires:   ['horaires', 'precisions'],
  axes:       ['choix', 'axes', 'valeurs'],
  moyens:     ['plan_fin', 'aci', 'france_sante', 'apports', 'equipements', 'materiel_note'],
  logiciel:   ['logiciel', 'rdv', 'telemed', 'outils']
};
var QUESTIONNAIRE_TAILLE_MAX = 45000;   // caractères par rubrique (limite d'une cellule : 50 000)

/** Colonnes de la feuille exposées à l'application sous un autre nom. */
var ALIAS_LECTURE = {
  comptesRendus: { lien_meet: 'lienMeet', lien_doc: 'lienDoc' }
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
   "Onglet Catalogue   — référence en lecture seule des 43 prestations et de leur rattachement aux formules."
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
   "2025-11-01",
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
   "",
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
   "2026-03-01",
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
   "",
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
   "2026-06-01",
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
   "",
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
   "",
   ""
  ]
 ],
 "Prestations": [
  [
   "msp-fort-de-france",
   "P01",
   "valide",
   "2025-11-04",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P02",
   "valide",
   "2025-11-06",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P03",
   "valide",
   "2025-11-08",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P04",
   "valide",
   "2025-11-11",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P05",
   "valide",
   "2025-11-12",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P06",
   "valide",
   "2025-11-22",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P07",
   "valide",
   "2025-11-30",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P08",
   "valide",
   "2025-12-15",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P09",
   "valide",
   "2025-12-21",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P10",
   "valide",
   "2025-12-26",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P11",
   "valide",
   "2025-12-30",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P12",
   "valide",
   "2026-01-03",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P13",
   "valide",
   "2026-01-07",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P14",
   "valide",
   "2026-01-11",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P15",
   "valide",
   "2026-01-16",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P16",
   "valide",
   "2026-01-21",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P17",
   "valide",
   "2026-01-31",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P18",
   "valide",
   "2026-02-08",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P19",
   "valide",
   "2026-02-12",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P20",
   "valide",
   "2026-02-18",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P21",
   "valide",
   "2026-02-23",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P22",
   "valide",
   "2026-03-03",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P23",
   "valide",
   "2026-03-07",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P24",
   "valide",
   "2026-03-12",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P25",
   "a_valider",
   "2026-08-05",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P26",
   "en_cours",
   "2026-08-07",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P27",
   "bloque",
   "2026-07-27",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P28",
   "a_faire",
   "2026-08-10",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P29",
   "a_faire",
   "2026-08-16",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P30",
   "a_faire",
   "2026-08-21",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P31",
   "a_faire",
   "2026-08-26",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P32",
   "en_cours",
   "2026-09-10",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P33",
   "a_faire",
   "2026-09-22",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "P34",
   "a_faire",
   "2026-10-12",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P01",
   "valide",
   "2026-03-04",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P02",
   "valide",
   "2026-03-06",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P03",
   "valide",
   "2026-03-08",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P04",
   "valide",
   "2026-03-11",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P05",
   "valide",
   "2026-03-12",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P06",
   "valide",
   "2026-03-22",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P07",
   "valide",
   "2026-03-30",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P08",
   "valide",
   "2026-04-14",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P09",
   "valide",
   "2026-04-20",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P10",
   "valide",
   "2026-04-25",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P11",
   "valide",
   "2026-04-29",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P12",
   "valide",
   "2026-05-03",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P13",
   "valide",
   "2026-05-07",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P14",
   "valide",
   "2026-05-11",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P15",
   "valide",
   "2026-05-16",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P16",
   "a_valider",
   "2026-08-06",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P17",
   "en_cours",
   "2026-08-16",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P18",
   "en_cours",
   "2026-08-24",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P19",
   "a_faire",
   "2026-08-28",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P20",
   "a_faire",
   "2026-09-03",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P21",
   "a_faire",
   "2026-07-27",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P22",
   "a_faire",
   "2026-09-11",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P23",
   "a_faire",
   "2026-09-15",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P24",
   "a_faire",
   "2026-09-20",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P25",
   "a_faire",
   "2026-09-24",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P26",
   "a_faire",
   "2026-09-26",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P27",
   "a_faire",
   "2026-09-30",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "P28",
   "a_faire",
   "2026-10-03",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P01",
   "valide",
   "2026-06-04",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P02",
   "valide",
   "2026-06-06",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P03",
   "valide",
   "2026-06-08",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P04",
   "valide",
   "2026-06-11",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P05",
   "valide",
   "2026-06-12",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P06",
   "valide",
   "2026-06-22",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P07",
   "valide",
   "2026-06-30",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P08",
   "a_valider",
   "2026-08-16",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P09",
   "en_cours",
   "2026-08-22",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P10",
   "en_cours",
   "2026-08-27",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P11",
   "a_faire",
   "2026-08-31",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P12",
   "a_faire",
   "2026-09-04",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P13",
   "a_faire",
   "2026-09-08",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P14",
   "a_faire",
   "2026-09-12",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P15",
   "a_faire",
   "2026-09-17",
   "",
   ""
  ],
  [
   "cds-gros-morne",
   "P16",
   "a_faire",
   "2026-09-22",
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
   "2026-08-02",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P06",
   "en_cours",
   "2026-08-12",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P07",
   "en_cours",
   "2026-08-20",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P08",
   "a_faire",
   "2026-09-04",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P09",
   "a_faire",
   "2026-09-10",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P10",
   "a_faire",
   "2026-09-15",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P11",
   "a_faire",
   "2026-09-19",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P12",
   "a_faire",
   "2026-09-23",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P13",
   "a_faire",
   "2026-09-27",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P14",
   "a_faire",
   "2026-10-01",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P15",
   "a_faire",
   "2026-10-06",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P16",
   "a_faire",
   "2026-10-11",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P17",
   "a_faire",
   "2026-10-21",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P18",
   "a_faire",
   "2026-10-29",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P19",
   "a_faire",
   "2026-11-02",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P20",
   "a_faire",
   "2026-11-08",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P21",
   "a_faire",
   "2026-11-13",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P22",
   "a_faire",
   "2026-11-21",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P23",
   "a_faire",
   "2026-11-25",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P24",
   "a_faire",
   "2026-11-30",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P25",
   "a_faire",
   "2026-12-04",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P26",
   "a_faire",
   "2026-12-06",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P27",
   "a_faire",
   "2026-12-10",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "P28",
   "a_faire",
   "2026-12-13",
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
   "Choix du véhicule juridique, rédaction des statuts et du règlement intérieur, préparation du dossier d'immatriculation.",
   "Statuts & règlement intérieur",
   "expert",
   10,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P39",
   "LB",
   "Structuration juridique & dossier ARS",
   "Immatriculation de la SISA",
   "Télédéclaration de la SISA sur le guichet unique des formalités d'entreprises (INPI), suivi de l'immatriculation au registre du commerce et des sociétés.",
   "Extrait Kbis de la SISA",
   "expert",
   5,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P40",
   "LB",
   "Structuration juridique & dossier ARS",
   "Déclaration de l'association",
   "Déclaration de création de l'association par le téléservice e-création, publication au Journal officiel des associations (JOAFE) et obtention du récépissé portant le numéro RNA.",
   "Récépissé de déclaration (n° RNA)",
   "expert",
   5,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P35",
   "LB",
   "Structuration juridique & dossier ARS",
   "Règlement de fonctionnement",
   "Rédaction du règlement de fonctionnement : organisation interne, droits et obligations des usagers, fonctionnement des instances, modalités d'accueil et de prise en charge.",
   "Règlement de fonctionnement",
   "expert",
   5,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P36",
   "LB",
   "Structuration juridique & dossier ARS",
   "Engagement de conformité d'un centre de santé",
   "Constitution et dépôt de l'engagement de conformité au référentiel national, préalable obligatoire à l'ouverture d'un centre de santé, accompagné du projet de santé et du règlement de fonctionnement.",
   "Engagement de conformité déposé",
   "expert",
   6,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P43",
   "LB",
   "Structuration juridique & dossier ARS",
   "Agrément des activités dentaire, ophtalmologique ou orthoptique",
   "Obligatoire pour un centre de santé exerçant l'une de ces activités : demande d'agrément provisoire avant l'ouverture (projet de santé, règlement de fonctionnement, déclarations de liens d'intérêts des dirigeants, contrats avec des sociétés tierces). L'agrément devient définitif un an après l'ouverture.",
   "Agrément provisoire de l'ARS",
   "expert",
   8,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P44",
   "LB",
   "Structuration juridique & dossier ARS",
   "Équipe médicale minimale réunie",
   "Professionnels de santé recrutés ou engagés, au premier rang desquels le ou les médecins : l'équipe doit être constituée avant la signature du projet de santé et les démarches auprès de l'ARS et de l'Assurance Maladie.",
   "Liste des professionnels engagés (RPPS)",
   "client",
   1,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P38",
   "LB",
   "Structuration juridique & dossier ARS",
   "Signatures du projet de santé en ligne",
   "Mise en signature électronique du projet de santé par l'ensemble des professionnels de l'équipe, puis archivage de l'exemplaire signé.",
   "Projet de santé signé par l'équipe",
   "mixte",
   3,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P19",
   "LB",
   "Structuration juridique & dossier ARS",
   "Dépôt du projet de santé",
   "Transmission du projet de santé signé à l'ARS, suivi de l'instruction et réponses aux demandes de compléments.",
   "Accusé de dépôt ARS",
   "expert",
   4,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P37",
   "LB",
   "Structuration juridique & dossier ARS",
   "Immatriculation FINESS",
   "Demande d'inscription au répertoire FINESS (labellisation établissement médico-social) auprès de l'ARS et du pôle établissement de l'Assurance Maladie, puis suivi de l'attribution du numéro.",
   "Numéro FINESS attribué",
   "expert",
   5,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P20",
   "LC",
   "Financements & subventions",
   "Démarches ACI applicables",
   "Vérification de l'éligibilité à l'ACI, montage du contrat tripartite et dépôt auprès de la caisse d'assurance maladie (CGSS dans les départements d'outre-mer).",
   "Contrat ACI signé",
   "expert",
   6,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P41",
   "LC",
   "Financements & subventions",
   "Adhésion à l'accord national des centres de santé",
   "Adhésion du centre de santé à l'accord national (ANCS) qui régit ses relations avec l'Assurance Maladie et ouvre droit à la rémunération forfaitaire : constitution et dépôt du dossier auprès de la caisse (CGSS dans les départements d'outre-mer), suivi de l'instruction.",
   "Adhésion à l'accord national signée",
   "expert",
   6,
   "",
   "OUI",
   "OUI"
  ],
  [
   "P42",
   "LC",
   "Financements & subventions",
   "Déclaration d'intention France Santé",
   "Vérification des critères du label (médecin traitant, offre infirmière, ouverture cinq jours sur sept, tarifs opposables, participation aux soins non programmés), dépôt de la déclaration d'intention en ligne, suivi de l'instruction par l'ARS jusqu'au courrier de labellisation.",
   "Courrier de labellisation France Santé",
   "expert",
   3,
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
   "2026-07-06",
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
   "2026-06-01",
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
   "2026-06-22",
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
   "2026-07-14",
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
   "2026-06-29",
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
   "2026-07-23",
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
   "2026-06-10",
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
   "2026-07-26",
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
   "2026-06-14",
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
   "2026-07-21",
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
   "2026-07-18",
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
   "2025-11-19",
   ""
  ],
  [
   "msp-fort-de-france",
   "sig2",
   "Statuts constitutifs SISA",
   "Acte constitutif à déposer au greffe du tribunal de commerce.",
   "signe",
   "2026-01-23",
   ""
  ],
  [
   "msp-fort-de-france",
   "sig3",
   "Projet de santé — validation équipe",
   "Validation collégiale du projet de santé avant transmission à l'ARS.",
   "signe",
   "2026-07-02",
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
   "2026-03-04",
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
   "2026-06-02",
   ""
  ],
  [
   "cds-cayenne",
   "sig9",
   "Mandat d'accompagnement ElodiaTech",
   "Devis et mandat Formule 2.",
   "signe",
   "2026-07-04",
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
   "2026-07-20"
  ],
  [
   "msp-fort-de-france",
   "m2",
   "Dr Marc Dubois",
   "client",
   "Parfait, merci. Où en est le contrat ACI ?",
   "2026-07-21"
  ],
  [
   "msp-fort-de-france",
   "m3",
   "Jean-Philippe B.",
   "expert",
   "Le contrat ACI est prêt et déposé sur le parapheur électronique. Il attend votre signature.",
   "2026-07-22"
  ],
  [
   "msp-pointe-a-pitre",
   "m4",
   "Jean-Philippe B.",
   "expert",
   "Le diagnostic territorial est finalisé, vous pouvez le consulter dans le coffre-fort documentaire.",
   "2026-07-24"
  ],
  [
   "cds-gros-morne",
   "m5",
   "Camille R.",
   "expert",
   "Bonjour, l'analyse des besoins de santé est terminée. Je vous propose une visio la semaine prochaine.",
   "2026-07-27"
  ],
  [
   "cds-cayenne",
   "m6",
   "Camille R.",
   "expert",
   "Bienvenue sur votre espace de suivi. Le questionnaire de faisabilité est disponible.",
   "2026-07-18"
  ]
 ],
 "Evenements": [
  [
   "msp-fort-de-france",
   "e1",
   "Comité de pilotage mensuel",
   "reunion",
   "2026-08-05",
   "14:30",
   "Visioconférence",
   "https://meet.google.com/exemple-copil"
  ],
  [
   "msp-fort-de-france",
   "e2",
   "Commission ARS — instruction du dossier",
   "jalon",
   "2026-08-22",
   "09:00",
   "ARS Martinique",
   ""
  ],
  [
   "msp-fort-de-france",
   "e3",
   "Livraison de la maquette du site internet",
   "livrable",
   "2026-08-13",
   "",
   "",
   ""
  ],
  [
   "msp-fort-de-france",
   "e4",
   "Formation équipe — logiciel métier",
   "formation",
   "2026-09-05",
   "09:00",
   "Sur site",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "e5",
   "Atelier rédaction — exercice coordonné",
   "reunion",
   "2026-08-07",
   "18:00",
   "Visioconférence",
   "https://meet.google.com/exemple-atelier"
  ],
  [
   "msp-pointe-a-pitre",
   "e6",
   "Clôture du dépôt FEDER",
   "jalon",
   "2026-08-19",
   "23:59",
   "Portail e-Synergie",
   ""
  ],
  [
   "cds-gros-morne",
   "e7",
   "Restitution du diagnostic territorial",
   "reunion",
   "2026-08-10",
   "10:00",
   "Sur site",
   ""
  ],
  [
   "cds-cayenne",
   "e8",
   "Rendez-vous découverte",
   "reunion",
   "2026-08-04",
   "15:00",
   "Visioconférence",
   "https://meet.google.com/exemple-decouverte"
  ]
 ],
 "ComptesRendus": [
  [
   "msp-fort-de-france",
   "cr1",
   "2026-07-20",
   "Comité de pilotage — juillet",
   "visio",
   "Dr Dubois, Jean-Philippe B., ArchiSanté",
   "Validation des plans d'exécution. Lancement de la charte graphique.",
   "valide",
   "https://meet.google.com/exemple-copil",
   "https://docs.google.com/document/d/EXEMPLE_CR_JUILLET/edit"
  ],
  [
   "msp-fort-de-france",
   "cr2",
   "2026-06-22",
   "Cadrage des statuts SISA",
   "presentiel",
   "Associés, Jean-Philippe B., cabinet comptable",
   "Modèle SISA approuvé à l'unanimité des associés.",
   "valide",
   "",
   ""
  ],
  [
   "msp-pointe-a-pitre",
   "cr3",
   "2026-07-12",
   "Restitution du diagnostic territorial",
   "visio",
   "Dr Mercier, équipe, Jean-Philippe B.",
   "Priorisation de trois axes : diabète, santé mentale, prévention.",
   "valide",
   "",
   ""
  ],
  [
   "cds-cayenne",
   "cr4",
   "2026-07-18",
   "Point téléphonique de lancement",
   "telephone",
   "Dr Anselme, Camille R.",
   "Calendrier validé, démarrage du diagnostic territorial.",
   "valide",
   "",
   ""
  ]
 ],
 "Financements": [
  [
   "msp-fort-de-france",
   "f1",
   "FIR — ARS Martinique",
   120000,
   "accorde",
   "2026-06-02"
  ],
  [
   "msp-fort-de-france",
   "f2",
   "FEDER — programme régional",
   240000,
   "instruction",
   "2026-09-15"
  ],
  [
   "msp-fort-de-france",
   "f3",
   "ACI — CPAM",
   68000,
   "depose",
   "2026-08-31"
  ],
  [
   "msp-fort-de-france",
   "f4",
   "Collectivité territoriale",
   45000,
   "instruction",
   "2026-09-30"
  ],
  [
   "msp-pointe-a-pitre",
   "f5",
   "FIR — ARS Guadeloupe",
   85000,
   "depose",
   "2026-08-26"
  ],
  [
   "msp-pointe-a-pitre",
   "f6",
   "FEDER — programme régional",
   150000,
   "etude",
   "2026-10-30"
  ],
  [
   "cds-cayenne",
   "f7",
   "FIR — ARS Guyane",
   95000,
   "etude",
   "2026-10-15"
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
 ],
 "Experts": [
 [
  "exp1",
  "ARNOBE Frédéric",
  "Expert projets de santé · fondateur",
  "elodiatech@gmail.com",
  "",
  "OUI"
 ]
],
 "Prestataires": [
 [
  "v1",
  "ComptaSanté Antilles",
  "Expert-comptable",
  "SISA, paie et fiscalité des structures de santé",
  "contact@comptasante.fr",
  "LE"
 ],
 [
  "v2",
  "WEDA",
  "Logiciel médical",
  "Solution labellisée Ségur, lecteurs CPx",
  "commercial@weda.fr",
  "LE"
 ],
 [
  "v3",
  "Maiia / Cegedim",
  "Logiciel médical",
  "Agenda partagé, téléconsultation, Ségur",
  "contact@maiia.com",
  "LE"
 ],
 [
  "v4",
  "ArchiSanté Caraïbes",
  "Architecte",
  "ERP catégorie 5, accessibilité PMR",
  "agence@archisante.fr",
  "LE"
 ],
 [
  "v5",
  "BET Tropic Ingénierie",
  "Bureau d'études",
  "Fluides, thermique, acoustique en milieu tropical",
  "etudes@tropic-ing.fr",
  "LE"
 ],
 [
  "v6",
  "Studio ElodiaTech",
  "Identité visuelle",
  "Logo, charte graphique, site internet",
  "studio@elodiatech.com",
  "LF"
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
    .addItem('Vérifier la base', 'verifierBase')
    .addItem('Mettre à jour la structure (sans perte de données)', 'mettreAJourStructure')
    .addSeparator()
    .addItem('Définir mon code expert', 'definirCodeExpert')
    .addItem('Générer les liens clients', 'genererJetonsClients')
    .addSeparator()
    .addItem('Créer les dossiers Drive manquants', 'creerTousLesDossiers')
    .addSeparator()
    .addItem('Définir ma clé Claude (rédaction du projet de santé)', 'definirCleClaude')
    .addItem('Créer les dossiers des sources officielles des actes', 'creerDossiersSourcesActes')
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

  var noms = Object.keys(ONGLETS);

  noms.forEach(function (nom) {
    var entetes = ONGLETS[nom];
    var feuille = classeur.getSheetByName(nom);
    if (feuille) { feuille.clear(); } else { feuille = classeur.insertSheet(nom); }

    // Le format texte doit être posé AVANT l'écriture : sans cela Sheets
    // convertit « 2026-03-15 » en date sérielle et l'affiche en nombre.
    entetes.forEach(function (titre, i) {
      if (titre === 'date' || titre === 'echeance' || titre === 'date_debut' || titre === 'date_realisation') {
        feuille.getRange(1, i + 1, feuille.getMaxRows()).setNumberFormat('@');
      }
    });

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

    feuille.autoResizeColumns(1, Math.min(entetes.length, 8));
  });

  // Onglet par défaut laissé par Google (« Feuille 1 », « Feuille1 », « Sheet1 »…).
  // On ne se fie pas à son nom, qui varie selon la langue : on supprime toute
  // feuille étrangère à la structure ET restée vide, ce qui préserve les
  // onglets que vous auriez ajoutés vous-même.
  classeur.getSheets().forEach(function (f) {
    if (noms.indexOf(f.getName()) !== -1) return;
    if (f.getLastRow() > 0 || f.getLastColumn() > 0) return;
    if (classeur.getSheets().length > 1) classeur.deleteSheet(f);
  });

  classeur.setActiveSheet(classeur.getSheetByName('Lisez-moi'));
  ui.alert('Base initialisée',
    'Les ' + noms.length + ' onglets sont prêts : ' + noms.join(', ') + '.',
    ui.ButtonSet.OK);
}

/**
 * Ajoute les colonnes et les onglets apparus depuis l'installation, sans
 * toucher aux données existantes. À lancer après toute mise à jour du script.
 */
function mettreAJourStructure() {
  var classeur = SpreadsheetApp.getActive();
  var ui = SpreadsheetApp.getUi();
  var ajouts = [];

  Object.keys(ONGLETS).forEach(function (nom) {
    var attendues = ONGLETS[nom];
    var feuille = classeur.getSheetByName(nom);

    if (!feuille) {
      feuille = classeur.insertSheet(nom);
      feuille.getRange(1, 1, 1, attendues.length).setValues([attendues])
        .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1e95cb');
      feuille.setFrozenRows(1);
      ajouts.push('onglet « ' + nom +' » créé');
      return;
    }

    var existantes = feuille.getRange(1, 1, 1, Math.max(1, feuille.getLastColumn()))
      .getValues()[0].map(function (h) { return String(h).trim(); });

    attendues.forEach(function (colonne) {
      if (existantes.indexOf(colonne) !== -1) return;
      var position = feuille.getLastColumn() + 1;
      feuille.getRange(1, position).setValue(colonne)
        .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1e95cb');
      if (colonne === 'date' || colonne === 'echeance' || colonne === 'date_debut' || colonne === 'date_realisation') {
        feuille.getRange(1, position, feuille.getMaxRows()).setNumberFormat('@');
      }
      existantes.push(colonne);
      ajouts.push(nom + ' : colonne « ' + colonne + ' » ajoutée');
    });
  });

  ui.alert('Mise à jour de la structure',
    ajouts.length ? ajouts.join('\n') : 'La structure était déjà à jour, rien à faire.',
    ui.ButtonSet.OK);
}

/**
 * Contrôle de l'installation — menu « Vérifier la base ».
 * Affiche le nombre de lignes par onglet pour confirmer que tout est en place.
 */
function verifierBase() {
  var classeur = SpreadsheetApp.getActive();
  var lignes = [];
  var manquants = [];

  Object.keys(ONGLETS).forEach(function (nom) {
    var f = classeur.getSheetByName(nom);
    if (!f) { manquants.push(nom); return; }
    lignes.push(nom + ' : ' + Math.max(0, f.getLastRow() - 1) + ' ligne(s)');
  });

  var message = lignes.join('\n');
  if (manquants.length) {
    message += '\n\nOnglets MANQUANTS : ' + manquants.join(', ')
             + "\nRelancez « Initialiser la base ».";
  } else {
    message += '\n\nStructure complète.';
  }

  SpreadsheetApp.getUi().alert('État de la base', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/* ==========================================================================
   CONTRÔLE D'ACCÈS

   Deux porte-clés, vérifiés ici et nulle part ailleurs :

   — le CODE EXPERT, rangé dans les propriétés du script. Il n'apparaît donc
     ni dans le dépôt GitHub, ni dans le navigateur. Il ouvre l'ensemble du
     portefeuille et autorise toutes les écritures.
   — un JETON par client, inscrit dans la colonne « jeton » de l'onglet
     Projets. Il ne donne accès qu'à ce projet, et à trois écritures.

   Sans l'un des deux, le script ne renvoie aucune donnée. Le cloisonnement
   est réel : le navigateur d'un client ne reçoit jamais le dossier d'un autre.
   ========================================================================== */

var PROPRIETE_CODE_EXPERT = 'CODE_EXPERT';

/** Définit ou remplace le code expert — menu « Définir mon code expert ». */
function definirCodeExpert() {
  var ui = SpreadsheetApp.getUi();
  var reponse = ui.prompt('Code expert',
    "Choisissez le code qui vous donnera accès à l'ensemble du portefeuille.\n"
    + "Douze caractères au minimum.\n\n"
    + "Il est conservé dans ce script uniquement : ni dans la page publique, ni dans le dépôt.",
    ui.ButtonSet.OK_CANCEL);

  if (reponse.getSelectedButton() !== ui.Button.OK) return;

  var code = reponse.getResponseText().trim();
  if (code.length < 12) {
    ui.alert('Code trop court', 'Il faut au moins 12 caractères. Rien n\'a été enregistré.', ui.ButtonSet.OK);
    return;
  }

  PropertiesService.getScriptProperties().setProperty(PROPRIETE_CODE_EXPERT, code);
  ui.alert('Code enregistré',
    "Saisissez-le sur la page de connexion de l'application, avec votre adresse électronique.\n\n"
    + "Oublié ? Revenez ici pour en définir un nouveau — les liens clients, eux, ne changent pas.",
    ui.ButtonSet.OK);
}

function codeExpertDefini() {
  return !!PropertiesService.getScriptProperties().getProperty(PROPRIETE_CODE_EXPERT);
}

/**
 * Reconnaît l'auteur d'une requête.
 * @returns {{role:string, projetId?:string, ouvert?:boolean}|null}
 */
function autoriser(requete) {
  var attendu = PropertiesService.getScriptProperties().getProperty(PROPRIETE_CODE_EXPERT);

  // Tant qu'aucun code n'est défini, le script reste ouvert : sans cela
  // l'application serait inutilisable avant la première configuration.
  if (!attendu) return { role: 'expert', ouvert: true };

  if (requete.cle && String(requete.cle) === String(attendu)) return { role: 'expert' };

  if (requete.jeton) {
    var projetId = projetDuJeton(String(requete.jeton));
    if (projetId) return { role: 'client', projetId: projetId };
  }

  return null;
}

function projetDuJeton(jeton) {
  if (!jeton || jeton.length < 12) return null;
  var trouve = null;
  lireOnglet('Projets').forEach(function (r) {
    if (r.jeton && String(r.jeton) === jeton) trouve = r.id;
  });
  return trouve;
}

/** Attribue un jeton aux projets qui n'en ont pas encore. */
function genererJetonsClients() {
  var ui = SpreadsheetApp.getUi();
  var feuille = SpreadsheetApp.getActive().getSheetByName('Projets');
  if (!feuille) throw new Error("Onglet 'Projets' introuvable");

  var valeurs = feuille.getDataRange().getValues();
  var entetes = valeurs[0].map(String);
  var iId = entetes.indexOf('id');
  var iJeton = entetes.indexOf('jeton');

  if (iJeton < 0) {
    ui.alert('Colonne manquante',
      "La colonne « jeton » est absente.\nLancez d'abord « Mettre à jour la structure ».",
      ui.ButtonSet.OK);
    return;
  }

  var crees = 0;
  for (var l = 1; l < valeurs.length; l++) {
    if (!valeurs[l][iId]) continue;
    if (String(valeurs[l][iJeton] || '').length >= 12) continue;
    feuille.getRange(l + 1, iJeton + 1).setValue(nouveauJeton());
    crees++;
  }

  ui.alert('Liens clients',
    crees
      ? crees + " jeton(s) créé(s).\n\nRécupérez le lien de chaque client depuis la console "
        + "expert de l'application : bouton « Lien » sur son étiquette."
      : 'Tous les projets disposent déjà de leur jeton.',
    ui.ButtonSet.OK);
}

/**
 * Jeton d'un projet : le crée s'il n'en a pas encore, le renvoie sinon.
 * Un projet conserve donc le même lien tant qu'on ne vide pas sa cellule.
 */
function jetonDuProjet(projetId) {
  var feuille = SpreadsheetApp.getActive().getSheetByName('Projets');
  if (!feuille) throw new Error("Onglet 'Projets' introuvable");

  var valeurs = feuille.getDataRange().getValues();
  var entetes = valeurs[0].map(String);
  var iId = entetes.indexOf('id');
  var iJeton = entetes.indexOf('jeton');

  if (iJeton < 0) {
    throw new Error("colonne « jeton » absente — lancez « Mettre à jour la structure »");
  }

  for (var l = 1; l < valeurs.length; l++) {
    if (String(valeurs[l][iId]) !== projetId) continue;
    var existant = String(valeurs[l][iJeton] || '');
    if (existant.length >= 12) return existant;
    var jeton = nouveauJeton();
    feuille.getRange(l + 1, iJeton + 1).setValue(jeton);
    return jeton;
  }

  throw new Error('projet introuvable : ' + projetId);
}

/** Jeton imprévisible de 24 caractères, sans caractères ambigus. */
function nouveauJeton() {
  var alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  var source = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var jeton = '';
  for (var i = 0; i < 24; i++) {
    jeton += alphabet.charAt(parseInt(source.charAt(i), 16) * 2 % alphabet.length);
  }
  return jeton;
}

/* ==========================================================================
   API — LECTURE
   Tout passe par doPost : les secrets ne circulent pas dans l'URL, qui
   finirait dans l'historique du navigateur et dans les journaux serveur.
   ========================================================================== */
/**
 * Cette adresse est la passerelle de données, pas l'application.
 * Quelqu'un qui l'ouvre dans son navigateur — vous, ou un client à qui elle
 * aurait été transmise par erreur — doit comprendre où aller, plutôt que de
 * tomber sur du JSON. Aucune donnée n'est livrée ici, dans les deux cas.
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.diag === '1') {
    return json({
      ok: true,
      service: 'ElodiaTech — passerelle Projets de Santé',
      protege: codeExpertDefini(),
    });
  }

  var page =
    '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>ElodiaTech — Projets de Santé</title>'
    + '<style>'
    + 'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;'
    + 'background:#06192a;color:#f1f5f9;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px}'
    + '.c{max-width:520px;text-align:center}'
    + 'h1{font-size:1.35rem;margin:0 0 12px}'
    + 'p{color:#93a4bb;line-height:1.6;margin:0 0 22px}'
    + 'a{display:inline-block;background:#1e95cb;color:#fff;text-decoration:none;'
    + 'padding:13px 26px;border-radius:10px;font-weight:700}'
    + 'a:hover{background:#157aa8}'
    + 'small{display:block;margin-top:26px;color:#647d94;font-size:.78rem}'
    + '</style></head><body><div class="c">'
    + '<h1>Vous êtes sur la passerelle de données</h1>'
    + '<p>Cette adresse relie l\'application à sa base Google Sheets. '
    + 'Elle ne contient aucune information et n\'affiche aucun dossier.<br><br>'
    + 'L\'espace de suivi se trouve ici :</p>'
    + '<a href="' + URL_APPLICATION + '">Ouvrir la plateforme</a>'
    + '<small>ElodiaTech — Ingénierie médicale</small>'
    + '</div></body></html>';

  return HtmlService.createHtmlOutput(page)
    .setTitle('ElodiaTech — Projets de Santé')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * @param {string} [projetIdUnique] restreint la réponse à un seul projet.
 */
function construireDonnees(projetIdUnique) {
  var projets = lireOnglet('Projets')
    .filter(function (r) { return !projetIdUnique || r.id === projetIdUnique; })
    .map(function (r) {
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
        email: r.client_email || '', tel: String(r.client_tel || ''),
        indicatif: String(r.client_indicatif || '596')
      },
      consultant: { nom: r.consultant_nom || '', email: r.consultant_email || '' },
      equipe: Number(r.equipe) || 0,
      surface: Number(r.surface) || 0,
      gdocProjetSante: r.gdoc_projet_sante || '',
      driveUrl: r.drive_url || '',
      siteUrl: r.site_url || '',
      // Notes internes et jeton d'accès : réservés à l'expert. Un client
      // ne reçoit ni les remarques prises sur son dossier, ni sa propre clé.
      notes: projetIdUnique ? '' : (r.notes || ''),
      jeton: projetIdUnique ? '' : (r.jeton || ''),
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
      dateRealisation: iso(r.date_realisation),
      note: r.note || '',
      livrableUrl: r.livrable_url || '',
      majLe: iso(new Date())
    };
  });

  var donnees = { projets: projets };

  // Questionnaire : réponses par projet et par rubrique.
  donnees.questionnaire = {};
  projets.forEach(function (p) { donnees.questionnaire[p.id] = {}; });
  lireOnglet('Questionnaire').forEach(function (r) {
    var groupe = donnees.questionnaire[r.projet_id];
    if (!groupe || !QUESTIONNAIRE_CHAMPS[r.rubrique]) return;
    var contenu = {};
    try { contenu = JSON.parse(String(r.donnees || '{}')) || {}; } catch (e) { contenu = {}; }
    groupe[r.rubrique] = { donnees: contenu, majLe: String(r.maj_le || ''), majPar: String(r.maj_par || '') };
  });

  // Annuaire des prestataires : commun à tous, visible aussi par le client.
  donnees.prestataires = lireOnglet('Prestataires').map(function (r) {
    return {
      id: r.id, nom: r.nom || '', metier: r.metier || '',
      specialite: r.specialite || '', contact: r.contact || '',
      tel: r.tel ? String(r.tel) : '', lot: r.lot || 'LE'
    };
  });

  // L'équipe ElodiaTech ne concerne que l'expert : le client connaît déjà
  // son référent par la fiche de son projet.
  if (!projetIdUnique) {
    // Rédaction avec Claude : brouillons et consignes restent chez l'expert.
    // Le client ne lit un chapitre qu'une fois validé, par ses documents.
    donnees.redaction = donneesRedaction_(projets);
    donnees.actes = donneesActes_(projets);
    donnees.experts = lireOnglet('Experts').map(function (r) {
      return {
        id: r.id, nom: r.nom || '', fonction: r.fonction || '',
        email: r.email || '', tel: String(r.tel || ''),
        principal: String(r.principal || '').toUpperCase() === 'OUI' ? 'OUI' : 'NON'
      };
    });
  }

  Object.keys(ENTITES_PAR_PROJET).forEach(function (cle) {
    var conf = ENTITES_PAR_PROJET[cle];
    var alias = ALIAS_LECTURE[cle] || {};
    var groupe = {};
    projets.forEach(function (p) { groupe[p.id] = []; });

    lireOnglet(conf.onglet).forEach(function (r) {
      if (!groupe[r.projet_id]) return;
      var item = {};
      conf.champs.forEach(function (colonne) {
        var clef = alias[colonne] || colonne;
        var valeur = r[colonne];
        item[clef] = (colonne === 'date' || colonne === 'echeance') ? iso(valeur)
                   : (valeur === undefined || valeur === null) ? '' : valeur;
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

   L'application envoie l'une de ces requêtes :
     { action:'upsert', entite, id, payload }   crée ou met à jour une ligne
     { action:'delete', entite, id }            supprime une ligne
     { action:'batch',  operations:[ … ] }      plusieurs opérations d'un coup

   Le champ « id » reprend les colonnes identifiantes de l'entité, séparées
   par le caractère deux-points.
   Exemples : 'msp-fort-de-france' pour un projet,
              'msp-fort-de-france:P17' pour une prestation.
   ========================================================================== */

/** Correspondance entre les champs envoyés par l'application et les colonnes. */
var ECRITURE = {
  projets: {
    onglet: 'Projets', cles: ['id'], cascade: true,
    champs: {
      nom: 'nom', type: 'type', ville: 'ville', departement: 'departement',
      adresse: 'adresse', lat: 'lat', lng: 'lng', reference: 'reference',
      formule: 'formule', optionImmobilier: 'option_immobilier',
      modeleJuridique: 'modele_juridique', dateDebut: 'date_debut',
      clientNom: 'client_nom', clientFonction: 'client_fonction',
      clientEmail: 'client_email', clientTel: 'client_tel',
      clientIndicatif: 'client_indicatif',
      consultantNom: 'consultant_nom', consultantEmail: 'consultant_email',
      equipe: 'equipe', surface: 'surface',
      gdocProjetSante: 'gdoc_projet_sante', driveUrl: 'drive_url', siteUrl: 'site_url',
      notes: 'notes'
    }
  },
  prestations: {
    onglet: 'Prestations', cles: ['projet_id', 'prestation_id'],
    champs: { statut: 'statut', echeance: 'echeance', dateRealisation: 'date_realisation',
              note: 'note', livrableUrl: 'livrable_url' }
  },
  // Seul le statut se modifie par cette voie (validation d'un chapitre) ;
  // le reste de la ligne est écrit par le script au fil de la rédaction.
  redaction: {
    onglet: 'Redaction', cles: ['projet_id', 'chapitre'],
    champs: { statut: 'statut' }
  },
  actes: {
    onglet: 'Actes', cles: ['projet_id', 'acte'],
    champs: { statut: 'statut' }
  },
  documents: {
    onglet: 'Documents', cles: ['projet_id', 'id'],
    champs: { nom: 'nom', cat: 'cat', type: 'type', taille: 'taille', date: 'date', auteur: 'auteur', url: 'url', piece: 'piece' }
  },
  signatures: {
    onglet: 'Signatures', cles: ['projet_id', 'id'],
    champs: { titre: 'titre', desc: 'desc', statut: 'statut', date: 'date', url: 'url' }
  },
  messages: {
    onglet: 'Messages', cles: ['projet_id', 'id'],
    champs: { auteur: 'auteur', role: 'role', texte: 'texte', date: 'date' }
  },
  evenements: {
    onglet: 'Evenements', cles: ['projet_id', 'id'],
    champs: { titre: 'titre', type: 'type', canal: 'canal', date: 'date', heure: 'heure', lieu: 'lieu', lien: 'lien' }
  },
  comptesRendus: {
    onglet: 'ComptesRendus', cles: ['projet_id', 'id'],
    champs: {
      date: 'date', objet: 'objet', type: 'type', participants: 'participants',
      decisions: 'decisions', statut: 'statut', lienMeet: 'lien_meet', lienDoc: 'lien_doc'
    }
  },
  financements: {
    onglet: 'Financements', cles: ['projet_id', 'id'],
    champs: { source: 'source', montant: 'montant', statut: 'statut', echeance: 'echeance' }
  },
  partenaires: {
    onglet: 'Partenaires', cles: ['projet_id', 'id'],
    champs: { nom: 'nom', type: 'type', statut: 'statut' }
  },
  questionnaire: {
    onglet: 'Questionnaire', cles: ['projet_id', 'rubrique'],
    champs: { donnees: 'donnees', majLe: 'maj_le', majPar: 'maj_par' }
  },
  pieces: {
    onglet: 'Pieces', cles: ['projet_id', 'id'],
    champs: { nom: 'nom', cat: 'cat', par: 'par', aide: 'aide', pour: 'pour' }
  },

  // Référentiels communs : pas de colonne projet_id, la clé est l'identifiant.
  experts: {
    onglet: 'Experts', cles: ['id'],
    champs: { nom: 'nom', fonction: 'fonction', email: 'email', tel: 'tel', principal: 'principal' }
  },
  prestataires: {
    onglet: 'Prestataires', cles: ['id'],
    champs: { nom: 'nom', metier: 'metier', specialite: 'specialite', contact: 'contact', tel: 'tel', lot: 'lot' }
  }
};

/**
 * Écritures permises à un client, sur son seul projet.
 * Tout le reste — formule, fiche, suppression, financements… — est refusé
 * par le serveur, quoi que prétende le navigateur qui envoie la requête.
 */
var ECRITURES_CLIENT = {
  prestations: ['statut'],   // valider un livrable qui lui est soumis
  messages: null,            // null = tous les champs de l'entité
  documents: null,           // référencer une pièce qu'il a déposée
  questionnaire: ['donnees'],// renseigner les informations de son projet
};

function doPost(e) {
  var verrou = LockService.getScriptLock();
  try {
    var requete = JSON.parse(e.postData.contents);

    // --- Contrôle d'accès, avant toute chose ---
    var acces = autoriser(requete);
    if (!acces) {
      return json({ erreur: "Accès refusé : code ou lien invalide." });
    }

    // --- Lecture ---
    if (requete.action === 'getAll') {
      return json(acces.role === 'expert'
        ? construireDonnees()
        : construireDonnees(acces.projetId));
    }

    // --- Création du lien d'accès d'un client, à la demande de l'expert ---
    if (requete.action === 'genererJeton') {
      if (acces.role !== 'expert') throw new Error('Réservé à l\'expert.');
      verrou.waitLock(25000);
      return json({ ok: true, jeton: jetonDuProjet(String(requete.projetId)) });
    }

    // --- Création de l'arborescence Drive ---
    if (requete.action === 'creerDossiers') {
      if (acces.role !== 'expert') throw new Error('Réservé à l\'expert.');
      verrou.waitLock(120000);   // création de dossiers : plus lent qu'une écriture
      return json({ ok: true, dossiers: creerDossiers(String(requete.projetId || '')) });
    }

    // --- Dépôt d'un fichier dans le Drive du projet ---
    // Aucun verrou : rien n'est écrit dans la feuille, et un téléversement
    // ne doit pas retarder les écritures des autres.
    if (requete.action === 'televerser') {
      return json({ ok: true, fichier: televerserFichier(requete, acces) });
    }

    // --- Lecture du contenu d'un fichier du dossier du projet ---
    // Aucun verrou : lecture seule, rien n'est écrit.
    if (requete.action === 'lireFichier') {
      return json({ ok: true, fichier: lireFichierDuProjet(requete, acces) });
    }

    // --- Rédaction d'un chapitre avec Claude : réservée à l'expert ---
    // Aucun verrou pendant l'envoi : l'assemblage du dossier prend plusieurs
    // secondes et ne doit pas bloquer les écritures. Le suivi prend le sien.
    if (requete.action === 'redigerChapitre' || requete.action === 'suivreRedaction') {
      if (acces.role !== 'expert') throw new Error('Réservé à l\'expert.');
      return json({ ok: true, redaction: requete.action === 'redigerChapitre'
        ? redigerChapitre(requete) : suivreRedaction(requete) });
    }
    if (requete.action === 'redigerActe' || requete.action === 'suivreActe') {
      if (acces.role !== 'expert') throw new Error('Réservé à l\'expert.');
      return json({ ok: true, acte: requete.action === 'redigerActe' ? redigerActe(requete) : suivreActe(requete) });
    }

    // --- Écriture ---
    verrou.waitLock(25000);   // deux écritures simultanées décaleraient les lignes

    var resultat;
    if (requete.action === 'batch') {
      resultat = (requete.operations || []).map(function (op) {
        var r = executerEcriture(op, acces);
        SpreadsheetApp.flush();
        return r;
      });
    } else {
      resultat = executerEcriture(requete, acces);
    }
    return json({ ok: true, resultat: resultat });

  } catch (err) {
    // `code` distingue un refus attendu, sur lequel l'application peut se
    // rabattre, d'une véritable panne à signaler à l'utilisateur.
    return json({
      erreur: String(err && err.message ? err.message : err),
      code: (err && err.code) ? String(err.code) : ''
    });
  } finally {
    try { verrou.releaseLock(); } catch (ignore) { /* verrou jamais pris */ }
  }
}

function executerEcriture(op, acces) {
  var conf = ECRITURE[op.entite];
  if (!conf) throw new Error('Entité inconnue : ' + op.entite);

  var cles = String(op.id).split(':');
  if (cles.length !== conf.cles.length) {
    throw new Error('Identifiant invalide pour ' + op.entite + ' : ' + op.id);
  }

  var payload = op.payload || {};

  // --- Restrictions applicables au client ---
  if (acces && acces.role === 'client') {
    if (!(op.entite in ECRITURES_CLIENT)) {
      throw new Error('Écriture non autorisée sur ' + op.entite + '.');
    }
    if (op.action === 'delete') {
      throw new Error('Suppression non autorisée.');
    }
    // La première clé est toujours le projet : il doit être le sien.
    if (cles[0] !== acces.projetId) {
      throw new Error('Écriture refusée : ce projet ne vous appartient pas.');
    }
    var champsPermis = ECRITURES_CLIENT[op.entite];
    if (champsPermis) {
      var filtre = {};
      champsPermis.forEach(function (c) {
        if (payload[c] !== undefined) filtre[c] = payload[c];
      });
      payload = filtre;
    }
  }

  if (op.entite === 'questionnaire') {
    if (op.action === 'delete' && acces && acces.role === 'expert') return supprimerLigne(conf, cles);
    payload = questionnaireValide(cles[1], payload, acces);
  }

  if (op.entite === 'redaction' || op.entite === 'actes') {
    // Valider un chapitre ou un document rédigé, ou revenir sur cette validation : rien d'autre.
    if (op.action === 'delete') throw new Error('Suppression non autorisée.');
    var ligneR = op.entite === 'redaction' ? ligneRedaction_(cles[0], cles[1]) : ligneActe_(cles[0], cles[1]);
    if (!ligneR || ['pret', 'valide'].indexOf(String(ligneR.statut)) === -1) {
      throw new Error('Ce document n\'a pas de version rédigée à valider.');
    }
    if (['pret', 'valide'].indexOf(String(payload.statut)) === -1) throw new Error('Statut non permis.');
    payload = { statut: payload.statut };
  }

  if (op.action === 'delete') return supprimerLigne(conf, cles);
  return ecrireLigne(conf, cles, payload);   // 'upsert' et 'update'
}

/**
 * Contrôle une rubrique du questionnaire avant écriture : rubrique connue,
 * champs autorisés uniquement, taille bornée. L'horodatage et l'auteur sont
 * fixés ici, jamais repris du navigateur.
 */
function questionnaireValide(rubrique, payload, acces) {
  var permis = QUESTIONNAIRE_CHAMPS[rubrique];
  if (!permis) throw new Error('Rubrique inconnue : ' + rubrique);

  var brut = payload.donnees;
  var objet;
  try { objet = typeof brut === 'string' ? JSON.parse(brut || '{}') : (brut || {}); }
  catch (e) { throw new Error('Réponses illisibles pour la rubrique ' + rubrique + '.'); }
  if (!objet || typeof objet !== 'object' || Array.isArray(objet)) {
    throw new Error('Réponses illisibles pour la rubrique ' + rubrique + '.');
  }

  var propre = {};
  permis.forEach(function (champ) {
    if (objet[champ] === undefined) return;
    var v = objet[champ];
    if (Array.isArray(v)) {
      propre[champ] = v.slice(0, 80).map(function (ligne) {
        var l = {};
        Object.keys(ligne || {}).slice(0, 20).forEach(function (k) {
          l[String(k).slice(0, 40)] = String(ligne[k] == null ? '' : ligne[k]).slice(0, 3000);
        });
        return l;
      });
    } else {
      propre[champ] = String(v == null ? '' : v).slice(0, 5000);
    }
  });

  var texte = JSON.stringify(propre);
  if (texte.length > QUESTIONNAIRE_TAILLE_MAX) {
    throw new Error('Rubrique trop longue : raccourcissez les textes ou déposez un document.');
  }
  return {
    donnees: texte,
    majLe: new Date().toISOString(),
    majPar: acces && acces.role === 'client' ? 'client' : 'expert'
  };
}

function ecrireLigne(conf, cles, payload) {
  var feuille = SpreadsheetApp.getActive().getSheetByName(conf.onglet);
  if (!feuille) throw new Error('Onglet introuvable : ' + conf.onglet);

  var valeurs = feuille.getDataRange().getValues();
  var entetes = valeurs[0].map(String);

  var idxCles = conf.cles.map(function (c) {
    var i = entetes.indexOf(c);
    if (i < 0) throw new Error('Colonne « ' + c + ' » absente de ' + conf.onglet);
    return i;
  });

  var ligne = trouverLigne(valeurs, idxCles, cles);

  if (ligne > 0) {
    Object.keys(conf.champs).forEach(function (cleJs) {
      if (payload[cleJs] === undefined) return;
      var col = entetes.indexOf(conf.champs[cleJs]);
      if (col >= 0) feuille.getRange(ligne + 1, col + 1).setValue(payload[cleJs]);
    });
    return conf.onglet + ' : ligne mise à jour';
  }

  var inverse = {};
  Object.keys(conf.champs).forEach(function (k) { inverse[conf.champs[k]] = k; });

  feuille.appendRow(entetes.map(function (h) {
    var iCle = conf.cles.indexOf(h);
    if (iCle >= 0) return cles[iCle];
    var cleJs = inverse[h];
    return (cleJs && payload[cleJs] !== undefined) ? payload[cleJs] : '';
  }));
  return conf.onglet + ' : ligne ajoutée';
}

function supprimerLigne(conf, cles) {
  var classeur = SpreadsheetApp.getActive();
  var feuille = classeur.getSheetByName(conf.onglet);
  if (!feuille) throw new Error('Onglet introuvable : ' + conf.onglet);

  var valeurs = feuille.getDataRange().getValues();
  var entetes = valeurs[0].map(String);
  var idxCles = conf.cles.map(function (c) { return entetes.indexOf(c); });

  var ligne = trouverLigne(valeurs, idxCles, cles);
  if (ligne > 0) feuille.deleteRow(ligne + 1);

  // Suppression d'un projet : ses lignes filles disparaissent avec lui.
  if (conf.cascade) {
    var projetId = cles[0];
    Object.keys(ECRITURE).forEach(function (nom) {
      var c = ECRITURE[nom];
      if (c.cascade) return;
      var f = classeur.getSheetByName(c.onglet);
      if (!f) return;
      var v = f.getDataRange().getValues();
      var iP = v[0].map(String).indexOf('projet_id');
      if (iP < 0) return;
      for (var l = v.length - 1; l >= 1; l--) {
        if (String(v[l][iP]) === projetId) f.deleteRow(l + 1);
      }
    });
  }
  return conf.onglet + ' : ligne supprimée';
}

function trouverLigne(valeurs, idxCles, cles) {
  for (var l = 1; l < valeurs.length; l++) {
    var correspond = true;
    for (var k = 0; k < idxCles.length; k++) {
      if (String(valeurs[l][idxCles[k]]) !== String(cles[k])) { correspond = false; break; }
    }
    if (correspond) return l;
  }
  return -1;
}

/* ==========================================================================
   ARBORESCENCE DRIVE
   Crée, pour chaque projet dépourvu de drive_url, un dossier calqué sur
   « _MODELE — Nouveau projet » et inscrit son URL dans l'onglet Projets.
   ========================================================================== */
/**
 * Crée l'arborescence Drive des projets qui n'en ont pas.
 * @param {string} [projetId] limite le traitement à un seul projet.
 * @returns {Array} [{ id, nom, url }] des dossiers créés.
 */
function creerDossiers(projetId) {
  var feuille = SpreadsheetApp.getActive().getSheetByName('Projets');
  if (!feuille) throw new Error("Onglet 'Projets' introuvable");

  var valeurs = feuille.getDataRange().getValues();
  var entetes = valeurs[0].map(String);
  var iId = entetes.indexOf('id');
  var iNom = entetes.indexOf('nom');
  var iVille = entetes.indexOf('ville');
  var iUrl = entetes.indexOf('drive_url');

  if (iUrl < 0) throw new Error("colonne « drive_url » absente de l'onglet Projets");

  var parent = DriveApp.getFolderById(DOSSIER_PROJETS);

  // Les sous-dossiers reprennent ceux du gabarit : le modifier suffit à
  // changer la structure des projets créés ensuite.
  var sousDossiers = [];
  var it = DriveApp.getFolderById(DOSSIER_MODELE).getFolders();
  while (it.hasNext()) sousDossiers.push(it.next().getName());
  sousDossiers.sort();

  var crees = [];
  for (var l = 1; l < valeurs.length; l++) {
    var id = String(valeurs[l][iId] || '');
    if (!id) continue;
    if (projetId && id !== projetId) continue;

    // Le jeu de démonstration contient des adresses factices (…/EXEMPLE_…).
    // Elles ne doivent pas empêcher la création du vrai dossier.
    var url = String(valeurs[l][iUrl] || '');
    if (url.indexOf('http') === 0 && url.indexOf('EXEMPLE') === -1) continue;

    var titre = valeurs[l][iNom] + (valeurs[l][iVille] ? ' — ' + valeurs[l][iVille] : '');
    var dossier = parent.createFolder(titre);
    sousDossiers.forEach(function (n) { dossier.createFolder(n); });

    feuille.getRange(l + 1, iUrl + 1).setValue(dossier.getUrl());
    crees.push({ id: id, nom: titre, url: dossier.getUrl() });
  }

  return crees;
}

/** Même traitement, déclenché depuis le menu de la feuille. */
function creerTousLesDossiers() {
  var crees = creerDossiers('');
  SpreadsheetApp.getUi().alert('Dossiers Drive',
    crees.length
      ? crees.length + ' dossier(s) de projet créé(s) avec leurs sous-dossiers.'
      : 'Tous les projets disposent déjà de leur dossier.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/* ==========================================================================
   TÉLÉVERSEMENT DE FICHIERS
   Le navigateur envoie le contenu encodé et la catégorie ; le script décide
   du sous-dossier. L'arborescence Drive reste ainsi connue du serveur seul.

   Le déploiement s'exécutant « en tant que moi », c'est le compte
   propriétaire qui crée le fichier : un client dépose ses pièces sans qu'on
   ait à lui partager quoi que ce soit dans le Drive.
   ========================================================================== */

/**
 * Sous-dossier de destination pour chaque catégorie du coffre-fort.
 * Le repérage se fait sur le numéro d'ordre et non sur le libellé complet :
 * renommer « 03 — Dossier ARS » en « 03 — ARS » reste donc sans effet.
 */
var DOSSIERS_CATEGORIE = {
  'Projet': '01', 'Juridique': '02', 'ARS': '03', 'Finances': '04',
  'Immobilier': '05', 'Équipe': '06', 'Partenariats': '07', 'Identité': '08'
};

/** Au-delà, le dépôt direct dans le Drive reste la bonne voie. */
var TAILLE_MAX_OCTETS = 10 * 1024 * 1024;

/**
 * Crée un fichier dans le Drive du projet et renvoie sa référence.
 * @returns {{id:string, nom:string, url:string, taille:string, dossier:string}}
 */
function televerserFichier(requete, acces) {
  var projetId = String(requete.projetId || '');
  if (!projetId) throw new Error('Projet non précisé.');

  // Un jeton client ne dépose que dans son propre dossier.
  if (acces.role === 'client' && projetId !== acces.projetId) {
    throw new Error('Dépôt refusé : ce projet ne vous appartient pas.');
  }

  // Une barre oblique dans le nom ferait croire à Drive à un chemin.
  var nom = String(requete.nom || '').replace(/[\/\\]/g, '-').trim();
  if (!nom) throw new Error('Nom de fichier manquant.');

  var contenu = String(requete.contenu || '');
  if (!contenu) throw new Error('Fichier vide.');

  var octets = Utilities.base64Decode(contenu);
  if (octets.length > TAILLE_MAX_OCTETS) {
    throw new Error('« ' + nom + ' » pèse ' + formaterOctets(octets.length)
      + '. Au-delà de ' + formaterOctets(TAILLE_MAX_OCTETS)
      + ', déposez le fichier directement dans le Drive puis référencez son lien.');
  }

  var cible = sousDossierCategorie(dossierDuProjet(projetId), String(requete.categorie || ''));
  var fichier = cible.createFile(
    Utilities.newBlob(octets, String(requete.mimeType || 'application/octet-stream'), nom));

  return {
    id: fichier.getId(),
    nom: fichier.getName(),
    url: fichier.getUrl(),
    taille: formaterOctets(octets.length),
    dossier: cible.getName()
  };
}

/**
 * Renvoie le contenu d'un fichier du dossier d'un projet, encodé en base64.
 *
 * Pourquoi passer par le script plutôt que par l'adresse Drive : un fichier
 * déposé par l'application vit dans le Drive du compte propriétaire, sans
 * partage. Le client n'y a donc aucun accès, et même l'expert échoue dans un
 * cadre intégré — le navigateur y bloque les cookies de session Google, d'où le
 * message « Impossible d'accéder à votre compte Google ». Servir les octets
 * par ici règle les deux cas sans rendre aucun document public.
 *
 * @returns {{nom:string, mimeType:string, taille:string, contenu:string}}
 */
function lireFichierDuProjet(requete, acces) {
  var projetId = String(requete.projetId || '');
  if (!projetId) throw new Error('Projet non précisé.');

  // Un jeton client ne lit que dans son propre dossier.
  if (acces.role === 'client' && projetId !== acces.projetId) {
    throw new Error('Lecture refusée : ce projet ne vous appartient pas.');
  }

  var fileId = String(requete.fileId || '');
  if (!fileId) throw new Error('Fichier non précisé.');

  var fichier;
  try {
    fichier = DriveApp.getFileById(fileId);
  } catch (e) {
    throw new Error('Fichier introuvable ou hors de portée du script.');
  }

  // Contrôle décisif : le script agit avec les droits du propriétaire, donc il
  // pourrait lire n'importe quel fichier de son Drive. On exige que celui
  // demandé descende bien du dossier du projet, sans quoi un jeton client
  // deviendrait une clé de lecture sur tout le Drive.
  if (!fichierDansDossier(fichier, dossierDuProjet(projetId).getId())) {
    // Cas légitime et fréquent : un lien collé vers un fichier qui vit ailleurs
    // dans le Drive. Le code permet à l'application de basculer sur l'affichage
    // par adresse, qui fonctionne si le fichier est partagé — au lieu de
    // présenter un échec à l'utilisateur.
    var refus = new Error('Ce fichier ne relève pas du dossier de ce projet.');
    refus.code = 'hors-projet';
    throw refus;
  }

  // Un Google Docs, Sheets ou Slides n'a pas de contenu binaire propre : il
  // s'exporte. En PDF, il s'affiche dans n'importe quel navigateur, sans
  // dépendre du moteur de rendu de Google — qui exige une session et reste
  // muet dans un cadre intégré, d'où les pages blanches constatées.
  var natif = String(fichier.getMimeType() || '');
  var blob = (natif.indexOf('application/vnd.google-apps.') === 0)
    ? fichier.getAs('application/pdf')
    : fichier.getBlob();

  var octets = blob.getBytes();
  if (octets.length > TAILLE_MAX_OCTETS) {
    throw new Error('« ' + fichier.getName() + ' » pèse ' + formaterOctets(octets.length)
      + ', au-delà de la limite d\'affichage de ' + formaterOctets(TAILLE_MAX_OCTETS)
      + '. Ouvrez-le directement dans le Drive.');
  }

  // Un document exporté prend l'extension de son export : sans elle, le
  // téléchargement produirait un fichier que le système ne saurait pas ouvrir.
  var nomRendu = fichier.getName();
  if (natif.indexOf('application/vnd.google-apps.') === 0 && !/\.pdf$/i.test(nomRendu)) {
    nomRendu += '.pdf';
  }

  return {
    nom: nomRendu,
    mimeType: blob.getContentType() || 'application/octet-stream',
    taille: formaterOctets(octets.length),
    contenu: Utilities.base64Encode(octets)
  };
}

/**
 * Vrai si le fichier descend du dossier donné, en remontant ses parents.
 * Trois niveaux suffisent : projet → sous-dossier de catégorie → fichier.
 */
function fichierDansDossier(fichier, idDossierAttendu) {
  var aExplorer = [];
  var it = fichier.getParents();
  while (it.hasNext()) aExplorer.push({ dossier: it.next(), profondeur: 0 });

  while (aExplorer.length) {
    var courant = aExplorer.shift();
    if (courant.dossier.getId() === idDossierAttendu) return true;
    if (courant.profondeur >= 3) continue;
    var parents = courant.dossier.getParents();
    while (parents.hasNext()) {
      aExplorer.push({ dossier: parents.next(), profondeur: courant.profondeur + 1 });
    }
  }
  return false;
}

/** Dossier Drive d'un projet, d'après la colonne « drive_url » de l'onglet Projets. */
function dossierDuProjet(projetId) {
  var feuille = SpreadsheetApp.getActive().getSheetByName('Projets');
  if (!feuille) throw new Error("Onglet 'Projets' introuvable");

  var valeurs = feuille.getDataRange().getValues();
  var entetes = valeurs[0].map(String);
  var iId = entetes.indexOf('id');
  var iUrl = entetes.indexOf('drive_url');
  if (iUrl < 0) throw new Error("colonne « drive_url » absente de l'onglet Projets");

  for (var l = 1; l < valeurs.length; l++) {
    if (String(valeurs[l][iId] || '') !== projetId) continue;
    // Dans « …/drive/folders/<ID>?usp=sharing », l'identifiant est la seule
    // longue suite de caractères d'adresse : aucun segment fixe ne l'égale.
    var trouve = String(valeurs[l][iUrl] || '').match(/[-\w]{25,}/);
    if (trouve) return DriveApp.getFolderById(trouve[0]);
    break;
  }

  throw new Error("Ce projet n'a pas encore de dossier Drive. Créez-le depuis "
    + 'Console expert → Portefeuille clients, bouton « Créer les dossiers Drive ».');
}

/** Sous-dossier correspondant à la catégorie ; à défaut, la racine du projet. */
function sousDossierCategorie(dossierProjet, categorie) {
  var prefixe = DOSSIERS_CATEGORIE[categorie];
  if (!prefixe) return dossierProjet;

  var it = dossierProjet.getFolders();
  while (it.hasNext()) {
    var d = it.next();
    if (d.getName().indexOf(prefixe) === 0) return d;
  }
  return dossierProjet;   // arborescence remaniée : le dossier du projet fait l'affaire
}

function formaterOctets(octets) {
  if (octets < 1024) return octets + ' o';
  if (octets < 1048576) return Math.round(octets / 1024) + ' Ko';
  return (octets / 1048576).toFixed(1).replace('.', ',') + ' Mo';
}

/* ==========================================================================
   RÉDACTION DU PROJET DE SANTÉ AVEC CLAUDE — réservée à l'expert

   Chaque chapitre est rédigé par Claude à partir de tout ce que le dossier
   contient : fiche du projet, informations fournies par le client, partenaires,
   financements, fichiers déposés dans « 01 — Projet de santé » (données
   CartoSanté, INSEE, ODISSÉ… téléchargées par l'expert) et faits retenus par
   les chapitres déjà rédigés, pour que l'ensemble reste cohérent.

   La demande part en lot (API Message Batches) : la rédaction d'un chapitre
   long dépasse la durée qu'Apps Script accorde à un appel direct, et le lot
   coûte moitié moins. L'application vient ensuite demander où en est le lot ;
   une fois terminé, le chapitre devient un Google Docs dans le dossier
   « 01 — Projet de santé ».

   La clé de l'API reste dans les propriétés du script : elle n'apparaît ni
   dans le dépôt, ni dans le navigateur, ni dans la feuille.
   ========================================================================== */

var PROPRIETE_CLE_CLAUDE = 'CLAUDE_API_KEY';
var PROPRIETE_MODELE_CLAUDE = 'CLAUDE_MODELE';
var MODELE_CLAUDE_DEFAUT = 'claude-opus-5-5';
var URL_LOTS_CLAUDE = 'https://api.anthropic.com/v1/messages/batches';
var VERSION_API_CLAUDE = '2026-10-21';
var JETONS_SORTIE_MAX = 64000;

/** Bornes de ce qui est joint à une demande. */
var SOURCES_MAX_FICHIERS = 12;
var SOURCES_MAX_OCTETS_FICHIER = 8 * 1024 * 1024;
var SOURCES_MAX_OCTETS_TOTAL = 24 * 1024 * 1024;
var SOURCES_MAX_CARACTERES_TEXTE = 120000;   // par document Google ou fichier texte
var MODELE_MAX_CARACTERES = 60000;

/** Plan général imposé, rappelé à chaque demande pour situer le chapitre. */
var PLAN_GENERAL_PDS = [
  'INTRODUCTION', 'PRÉAMBULE', 'SOMMAIRE',
  '1. Diagnostic territorial et contexte sanitaire (1.1 Territoire ; 1.2 Population ; 1.3 ZIP / QPV si présence ; 1.4 Offre de soins ; 1.5 Besoins du territoire)',
  "2. Organisation de l'exercice coordonné (2.1 Professionnels impliqués ; 2.2 Pilotage et fonctionnement ; 2.3 Projet de santé : objectifs et valeurs, axes, actions, moyens matériels et financiers ; 2.4 Projet immobilier)",
  "3. Organisation de l'accès aux soins (3.1 Prise en charge des patients : accès et continuité, plan de gestion des crises, permanence des soins ; 3.2 Soins spécialisés et paramédicaux hors les murs ; 3.3 Missions de santé publique ; 3.4 Qualité de la prise en charge)",
  '4. Organisation du travail en équipe (4.1 Coordination ; 4.2 Coopérations formalisées ; 4.3 DPC ; 4.4 Suivi, évaluation, amélioration continue ; 4.5 Accueil d\'étudiants, recherche)',
  "5. Partage d'informations (5.1 Entre professionnels ; 5.2 Vers les professionnels extérieurs ; 5.3 Accès du patient à ses informations ; 5.4 Communication externe)",
  '6. Signature du projet de santé', 'CONCLUSION'
].join('\n');

/**
 * Chapitres rédigeables. `modele` : Google Docs d'un projet déjà livré, lu
 * pour sa structure et son ton — jamais pour ses chiffres. `methode` choisit
 * la grille d'analyse imposée. `prestations` : étapes de la feuille de route
 * soumises au client quand le chapitre est validé.
 */
var CHAPITRES_REDACTION = [
  { id: 'intro', titre: 'Introduction et préambule', methode: 'cadre', modele: '', prestations: [],
    plan: "INTRODUCTION : objet du document, porteur, territoire, nature de la structure (MSP ou centre de santé) et cadre réglementaire.\n"
        + "PRÉAMBULE : genèse du projet, démarche suivie, professionnels à l'initiative, engagements et calendrier." },
  { id: 'ch1', titre: '1. Diagnostic territorial et contexte sanitaire', methode: 'diagnostic',
    modele: '13BuJJLZJ4HG37An03KpQahucpkNMJC88L1UvNgLuwAs', prestations: ['P06', 'P07'],
    plan: "1.1. Territoire\n1.2. Population\n1.3. Z.I.P / QPV (uniquement si le territoire compte une zone d'intervention prioritaire ou un quartier prioritaire de la politique de la ville)\n1.4. Offre de soins\n1.5. Besoins du territoire" },
  { id: 'ch2', titre: "2. Organisation de l'exercice coordonné", methode: 'diagnostic',
    modele: '1HEtv2V5NTL3sVqlDpLto5wkH2uSSmuOKhaiAZQ_dnbo', prestations: ['P08', 'P09', 'P10'],
    plan: "2.1. Professionnels impliqués dans la démarche (en interne ; en externe : partenaires médicaux, partenaires sociaux — hub, CCAS —, partenaires de prévention)\n2.2. Pilotage et fonctionnement\n2.3. Projet de santé\n2.3.1. Objectifs et valeurs\n2.3.2. Axes du projet de santé\n2.3.3. Actions du projet de santé\n2.3.4. Moyens matériels et financiers\n2.4. Projet immobilier" },
  { id: 'ch3', titre: "3. Organisation de l'accès aux soins", methode: 'organisation',
    modele: '1tzEgbmxwHPNyo1UTPeM8ILqVqWooNrY3-DHqcb5W61A', prestations: ['P11', 'P12'],
    plan: "3.1. Organisation de la prise en charge des patients\n3.1.1. Accès aux soins et continuité des soins\n3.1.2. Plan de gestion des crises et des événements majeurs\n3.1.3. Permanence des soins\n3.2. Organisation d'une diversité de services de soins médicaux spécialisés et paramédicaux hors les murs\n3.3. Missions de santé publique\n3.4. La qualité de la prise en charge" },
  { id: 'ch4', titre: '4. Organisation du travail en équipe', methode: 'organisation',
    modele: '1sLh8rVofOsz9k6xFhisRwiNcLHl-W6_kBcSjPY1k1sc', prestations: ['P13', 'P15'],
    plan: "4.1. Coordination de l'exercice pluriprofessionnel\n4.2. Formalisation de coopérations pluriprofessionnelles (conventions, protocoles, partenariats)\n4.3. Développement professionnel continu\n4.4. Suivi, évaluation et amélioration continue\n4.5. Accueil d'étudiants — Recherche" },
  { id: 'ch5', titre: "5. Partage d'informations", methode: 'cadre',
    modele: '1fkLrAIIbdAlKt5dHYYU2P2kz2VifdZnnS8d_bhYBA94', prestations: ['P14'],
    plan: "5.1. Entre les professionnels impliqués dans la démarche\n5.2. En direction des professionnels extérieurs (en interne ; en externe : partenaires médicaux, partenaires sociaux — hub, CCAS —, partenaires de prévention)\n5.3. Accès du patient aux informations médicales le concernant\n5.4. Communication externe et visibilité" },
  { id: 'ch6', titre: '6. Signature du projet de santé et conclusion', methode: 'cadre',
    modele: '1I2NxLzcLKdmxDmf4i-yMHW7qY0k_7G1cbsjKaIyBOfA', prestations: [],
    plan: "6. SIGNATURE DU PROJET DE SANTÉ : tableau des signataires (nom, profession, qualité, date, signature) reprenant les professionnels impliqués, engagement collectif.\nCONCLUSION : synthèse des axes, des engagements et de la trajectoire du projet." }
];

var REDACTION_COLONNES = ONGLETS['Redaction'];

/* ---------------------------------------------------- Menu de la clé ---- */

/** Menu « Définir ma clé Claude ». Son premier lancement fait aussi accorder
 *  au script le droit d'appeler un service extérieur. */
function definirCleClaude() {
  var ui = SpreadsheetApp.getUi();
  var reponse = ui.prompt('Clé de l\'API Claude',
    "Collez la clé créée sur console.anthropic.com (elle commence par « sk-ant- »).\n\n"
    + "Elle est conservée dans les propriétés de ce script uniquement : ni dans la feuille, "
    + "ni dans l'application, ni dans le dépôt GitHub.",
    ui.ButtonSet.OK_CANCEL);
  if (reponse.getSelectedButton() !== ui.Button.OK) return;

  var cle = reponse.getResponseText().trim();
  if (cle.indexOf('sk-ant-') !== 0) {
    ui.alert('Clé non reconnue', 'Une clé de l\'API Claude commence par « sk-ant- ». Rien n\'a été enregistré.', ui.ButtonSet.OK);
    return;
  }
  PropertiesService.getScriptProperties().setProperty(PROPRIETE_CLE_CLAUDE, cle);

  var essai = testerCleClaude_(cle);
  ui.alert(essai.ok ? 'Clé enregistrée et vérifiée' : 'Clé enregistrée, mais l\'essai a échoué',
    essai.ok
      ? 'La rédaction avec Claude est disponible dans l\'application, page « Projet de santé ».'
      : essai.message + '\n\nVérifiez la clé et le crédit disponible sur console.anthropic.com, puis recommencez.',
    ui.ButtonSet.OK);
}

/** Interroge la liste des lots : un appel sans coût qui valide la clé. */
function testerCleClaude_(cle) {
  try {
    var rep = UrlFetchApp.fetch(URL_LOTS_CLAUDE + '?limit=1', {
      method: 'get', headers: entetesClaude_(cle), muteHttpExceptions: true
    });
    var code = rep.getResponseCode();
    if (code === 200) return { ok: true };
    return { ok: false, message: 'Réponse ' + code + ' : ' + messageErreurClaude_(rep.getContentText()) };
  } catch (e) {
    return { ok: false, message: String(e && e.message ? e.message : e) };
  }
}

function cleClaude_() {
  var cle = PropertiesService.getScriptProperties().getProperty(PROPRIETE_CLE_CLAUDE);
  if (!cle) {
    throw new Error("La clé de l'API Claude n'est pas encore définie. Dans la feuille de base, "
      + 'menu ElodiaTech → « Définir ma clé Claude ».');
  }
  return cle;
}

function entetesClaude_(cle) {
  return { 'x-api-key': cle, 'anthropic-version': VERSION_API_CLAUDE };
}

function messageErreurClaude_(texte) {
  try {
    var j = JSON.parse(texte);
    if (j && j.error && j.error.message) return j.error.message;
  } catch (e) { /* texte brut */ }
  return String(texte || '').slice(0, 300);
}

/* ------------------------------------------------- Onglet Redaction ---- */

function feuilleRedaction_() { return assurerOnglet_('Redaction'); }

/** Onglet créé à la première demande : aucune manipulation préalable de la feuille. */
function assurerOnglet_(nom) {
  var classeur = SpreadsheetApp.getActive();
  var feuille = classeur.getSheetByName(nom);
  if (feuille) return feuille;
  feuille = classeur.insertSheet(nom);
  feuille.getRange(1, 1, 1, ONGLETS[nom].length).setValues([ONGLETS[nom]])
    .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1e95cb');
  feuille.setFrozenRows(1);
  return feuille;
}

function ligneRedaction_(projetId, chapitre) {
  return lireOnglet('Redaction').filter(function (r) {
    return String(r.projet_id) === projetId && String(r.chapitre) === chapitre;
  })[0] || null;
}

function ecrireRedaction_(projetId, chapitre, champs) {
  feuilleRedaction_();
  var conf = { onglet: 'Redaction', cles: ['projet_id', 'chapitre'], champs: {} };
  REDACTION_COLONNES.slice(2).forEach(function (c) { conf.champs[c] = c; });
  champs.maj_le = new Date().toISOString();
  ecrireLigne(conf, [projetId, chapitre], champs);
}

/** Lignes de rédaction, pour la vue de l'expert. */
function donneesRedaction_(projets) {
  var parProjet = {};
  projets.forEach(function (p) { parProjet[p.id] = {}; });
  lireOnglet('Redaction').forEach(function (r) {
    var groupe = parProjet[r.projet_id];
    if (!groupe || !chapitreRedaction_(String(r.chapitre))) return;
    groupe[r.chapitre] = {
      statut: String(r.statut || ''),
      docId: String(r.doc_id || ''),
      docUrl: String(r.doc_url || ''),
      version: Number(r.version) || 0,
      majLe: String(r.maj_le || ''),
      message: String(r.message || ''),
      consignes: String(r.consignes || ''),
      aCompleter: String(r.a_completer || ''),
      enCours: String(r.statut) === 'en_cours'
    };
  });
  return parProjet;
}

function chapitreRedaction_(id) {
  for (var i = 0; i < CHAPITRES_REDACTION.length; i++) {
    if (CHAPITRES_REDACTION[i].id === id) return CHAPITRES_REDACTION[i];
  }
  return null;
}

/* ------------------------------------------------- Envoi de la demande -- */

/**
 * Action « redigerChapitre » : assemble le dossier et soumet la rédaction.
 * @returns {{statut:string, lotId:string, sources:Array, ignores:Array}}
 */
function redigerChapitre(requete) {
  var projetId = String(requete.projetId || '');
  var chapitre = chapitreRedaction_(String(requete.chapitre || ''));
  if (!projetId) throw new Error('Projet non précisé.');
  if (!chapitre) throw new Error('Chapitre inconnu.');

  var projet = construireDonnees(projetId);
  if (!projet.projets.length) throw new Error('Projet introuvable.');

  var cle = cleClaude_();
  var consignes = String(requete.consignes || '').slice(0, 8000);

  var existant = ligneRedaction_(projetId, chapitre.id);
  if (existant && String(existant.statut) === 'en_cours') {
    throw new Error('Une rédaction de ce chapitre est déjà en cours.');
  }

  var dossier = sousDossierCategorie(dossierDuProjet(projetId), 'Projet');
  var dejaRediges = lireOnglet('Redaction')
    .filter(function (r) { return String(r.projet_id) === projetId && r.doc_id; })
    .map(function (r) { return String(r.doc_id); });
  var sources = sourcesDuDossier_(dossier, dejaRediges);

  var lot = envoyerLotClaude_(cle, projetId + '-' + chapitre.id, consigneSysteme_(),
    contenuDemande_(projetId, projet, chapitre, consignes, sources));

  var noms = sources.lus.map(function (s) { return s.nom; });
  ecrireRedaction_(projetId, chapitre.id, {
    statut: 'en_cours', lot_id: lot.id, consignes: consignes,
    message: 'Rédaction demandée. Sources jointes : ' + (noms.length ? noms.join(', ') : 'aucune')
      + (sources.ignores.length ? '. Non lues : ' + sources.ignores.join(', ') : '') + '.'
  });

  return { statut: 'en_cours', lotId: lot.id, sources: noms, ignores: sources.ignores };
}

/** Règles de rédaction, communes à tous les chapitres. */
function consigneSysteme_() {
  return [
    "Tu es consultant expert en centres de santé, maisons de santé pluriprofessionnelles (MSP), CPTS, exercice coordonné, santé publique, diagnostic territorial et ingénierie de projet de santé, au sein du cabinet ElodiaTech.",
    "Tu rédiges un chapitre du projet de santé d'une structure d'exercice coordonné. Le document est destiné à l'ARS, à l'Assurance Maladie, aux collectivités, aux fédérations et aux professionnels de la structure. Il doit pouvoir être déposé sans réécriture majeure.",
    "",
    "RÈGLES ABSOLUES SUR LES DONNÉES",
    "- N'invente jamais une donnée statistique, un effectif, un nom, une date, un montant ou un engagement. Tout chiffre vient des pièces fournies (sources jointes, informations du client, fiche du projet) et porte sa source et son année entre parenthèses, par exemple (INSEE, RP 2021).",
    "- Si une donnée nécessaire manque, écris à sa place : [donnée à compléter : <indicateur précis> — source à mobiliser : <INSEE, CartoSanté, ODISSÉ, Observatoire des territoires, POSS, IEDOM, DREES, ARS, Assurance Maladie, Santé publique France>].",
    "- Une information du client qui demande vérification, ou une référence réglementaire dont tu n'es pas certain, est suivie de [à confirmer].",
    "- Les références réglementaires citées doivent exister : Code de la santé publique (articles L.1411-11-1, L.6323-1 et suivants pour les centres de santé, L.6323-3 pour les MSP), accord conventionnel interprofessionnel du 20 avril 2017 (ACI), accord national des centres de santé, référentiels HAS, FNCS et AVECsanté. En cas de doute sur un numéro d'article, cite le texte sans le numéro.",
    "- Le chapitre modèle éventuellement fourni sert pour la structure, le niveau de détail et le ton. Ne reprends jamais ses chiffres, ses noms ni ses constats : ils concernent un autre territoire.",
    "",
    "STYLE",
    "- Style institutionnel, professionnel, technique, compatible ARS. Aucun langage commercial, aucune formule vague, aucune généralité non démontrée : chaque affirmation s'appuie sur une donnée, une analyse ou une référence réglementaire.",
    "- Du texte rédigé, personnalisé au territoire et à l'équipe, et pas seulement des tableaux : chaque tableau ou graphique est précédé d'une phrase qui l'introduit et suivi d'une analyse.",
    "- Écris en français, avec les noms réels de la structure, de la commune et des professionnels tels qu'ils figurent dans les pièces.",
    "",
    "FORMAT DE SORTIE — respecte-le exactement",
    "1. Le chapitre en HTML simple, entre <chapitre> et </chapitre>. Balises permises : h1 (titre du chapitre, une seule fois), h2, h3, h4, p, ul, ol, li, strong, em, table, thead, tbody, tr, th, td, blockquote, br. Aucun attribut de style, aucune classe.",
    "   - Encadré de synthèse : <blockquote> contenant un <p><strong>Observations</strong> …</p>, etc.",
    "   - Graphique : <figure data-graphique='{JSON}'></figure> où JSON vaut {\"type\":\"barres|lignes|secteurs|pyramide\",\"titre\":\"…\",\"source\":\"…\",\"categories\":[\"…\"],\"series\":[{\"nom\":\"…\",\"valeurs\":[nombres]}]}. Pour une pyramide des âges : categories = tranches d'âge, deux séries « Hommes » et « Femmes ». Pour des secteurs : une seule série. N'emploie un graphique que si toutes ses valeurs figurent dans les pièces ; sinon écris <p>[Figure à insérer : <type> — <ce qu'elle montre> — source : <…>]</p>.",
    "   - Logigramme ou schéma d'organisation : décris-le en liste ordonnée claire, précédée de <p>[Schéma à insérer : <titre>]</p>.",
    "2. Entre <fil> et </fil>, un objet JSON {\"faits\":[\"…\"]} : 10 à 25 faits établis dans ce chapitre que les chapitres suivants devront reprendre à l'identique (axes retenus, chiffres clés avec leur source, partenaires, horaires, organisation décidée).",
    "3. Entre <a_completer> et </a_completer>, la liste en texte simple, une ligne par élément, des données et validations qui restent à obtenir.",
    "Rien d'autre en dehors de ces trois blocs."
  ].join('\n');
}

/** Grille d'analyse imposée selon la nature du chapitre. */
function methodeChapitre_(methode) {
  if (methode === 'diagnostic') {
    return "Pour chaque indicateur : donnée du territoire, comparaison au département, à la région et à la France, analyse des écarts, enjeux, risques. "
      + "Chaque sous-partie se termine par un encadré <blockquote> en trois paragraphes : Observations, Analyse, Conséquences pour le projet de santé. "
      + "Illustre par des graphiques (histogrammes, courbes d'évolution, secteurs, pyramide des âges) quand les données le permettent ; chaque graphique est suivi de son analyse.";
  }
  if (methode === 'organisation') {
    return "Mets chaque organisation décrite en corrélation logique avec les axes du projet de santé (cite l'axe concerné). "
      + "Chaque sous-partie se termine par un encadré <blockquote> en quatre paragraphes : Observations, Analyse, Conséquences pour le projet de santé et l'organisation, Impact pour les populations cibles du territoire. "
      + "Ajoute des tableaux d'organisation (qui fait quoi, quand, avec quel outil) et des logigrammes décrits.";
  }
  return "Rédige un texte structuré et argumenté, relié aux axes du projet de santé et aux constats du diagnostic. Ajoute des tableaux lorsque l'information s'y prête.";
}

/** Contenu du message : pièces du dossier, puis la demande elle-même. */
function contenuDemande_(projetId, donnees, chapitre, consignes, sources) {
  var p = donnees.projets[0];
  var blocs = blocsDossier_(projetId, donnees, chapitre.id);

  if (chapitre.modele) {
    var modele = '';
    try { modele = exporterTexteGoogle_(chapitre.modele, 'text/plain').slice(0, MODELE_MAX_CARACTERES); }
    catch (e) { modele = ''; }
    if (modele) {
      blocs.push(texteBloc_('<chapitre_modele>\nExemple d\'un projet livré pour un AUTRE territoire. '
        + 'Structure et ton uniquement ; aucun chiffre ni constat à reprendre.\n\n' + modele + '\n</chapitre_modele>'));
    }
  }

  sources.lus.forEach(function (s) {
    blocs.push(texteBloc_('<source nom="' + s.nom.replace(/"/g, "'") + '">'));
    blocs.push(s.bloc);
  });
  if (!sources.lus.length) {
    blocs.push(texteBloc_('<sources>Aucun fichier source dans le dossier « 01 — Projet de santé ». '
      + 'Toute donnée statistique doit donc être signalée à compléter.</sources>'));
  }

  blocs.push(texteBloc_([
    'Rédige maintenant le chapitre suivant du projet de santé de « ' + p.nom + ' ».',
    '', 'CHAPITRE : ' + chapitre.titre, '', 'SOUS-PARTIES ATTENDUES :', chapitre.plan,
    '', 'MÉTHODE : ' + methodeChapitre_(chapitre.methode),
    '', 'PLAN GÉNÉRAL DU DOCUMENT (pour situer le chapitre) :', PLAN_GENERAL_PDS,
    '', 'Reste cohérent avec le fil conducteur des chapitres déjà rédigés.',
    consignes ? '\nCONSIGNES PARTICULIÈRES DE L\'EXPERT :\n' + consignes : ''
  ].join('\n')));

  return blocs;
}

function texteBloc_(t) { return { type: 'text', text: t }; }

/** Soumet une demande unique en lot ; renvoie le lot créé ({id, …}). */
function envoyerLotClaude_(cle, identifiant, systeme, contenu) {
  var corps = {
    requests: [{
      custom_id: String(identifiant).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64),
      params: {
        model: PropertiesService.getScriptProperties().getProperty(PROPRIETE_MODELE_CLAUDE) || MODELE_CLAUDE_DEFAUT,
        max_tokens: JETONS_SORTIE_MAX,
        output_config: { effort: 'high' },
        system: systeme,
        messages: [{ role: 'user', content: contenu }]
      }
    }]
  };
  var rep = UrlFetchApp.fetch(URL_LOTS_CLAUDE, {
    method: 'post', contentType: 'application/json', headers: entetesClaude_(cle),
    payload: JSON.stringify(corps), muteHttpExceptions: true
  });
  if (rep.getResponseCode() !== 200) {
    throw new Error('Claude a refusé la demande (' + rep.getResponseCode() + ') : '
      + messageErreurClaude_(rep.getContentText()));
  }
  return JSON.parse(rep.getContentText());
}

/**
 * État d'un lot : { etat: 'en_cours' } tant qu'il tourne, puis
 * { etat: 'erreur', motif } ou { etat: 'ok', texte, tronque }.
 */
function resultatLotClaude_(cle, lotId) {
  var rep = UrlFetchApp.fetch(URL_LOTS_CLAUDE + '/' + encodeURIComponent(String(lotId)), {
    headers: entetesClaude_(cle), muteHttpExceptions: true
  });
  if (rep.getResponseCode() !== 200) {
    throw new Error('Suivi impossible (' + rep.getResponseCode() + ') : ' + messageErreurClaude_(rep.getContentText()));
  }
  var lot = JSON.parse(rep.getContentText());
  if (lot.processing_status !== 'ended') return { etat: 'en_cours' };

  var resultats = UrlFetchApp.fetch(lot.results_url, { headers: entetesClaude_(cle), muteHttpExceptions: true });
  var resultat = null;
  String(resultats.getContentText('UTF-8')).split('\n').forEach(function (l) {
    if (!l.trim()) return;
    try { resultat = JSON.parse(l).result; } catch (e) { /* ligne illisible */ }
  });
  if (!resultat || resultat.type !== 'succeeded') {
    return { etat: 'erreur', motif: !resultat ? 'aucun résultat renvoyé'
      : resultat.type === 'errored' ? ('erreur : ' + ((resultat.error && resultat.error.error && resultat.error.error.message)
          || (resultat.error && resultat.error.message) || 'inconnue'))
      : resultat.type === 'expired' ? 'délai dépassé' : 'demande annulée' };
  }
  return {
    etat: 'ok',
    texte: (resultat.message.content || []).filter(function (b) { return b.type === 'text'; })
      .map(function (b) { return b.text; }).join('\n'),
    tronque: resultat.message.stop_reason === 'max_tokens'
  };
}

/** Fiche, informations du client, partenaires, financements, fil conducteur. */
function blocsDossier_(projetId, donnees, chapitreExclu) {
  var blocs = [];
  var p = donnees.projets[0];
  var fiche = {
    nom: p.nom, type: p.type, commune: p.ville, departement: p.departement, adresse: p.adresse,
    modele_juridique: p.modeleJuridique, nombre_professionnels: p.equipe, surface_m2: p.surface,
    date_de_debut_accompagnement: p.dateDebut, referent_client: p.client && p.client.nom,
    fonction_referent: p.client && p.client.fonction
  };
  blocs.push(texteBloc_('<fiche_projet>\n' + JSON.stringify(fiche, null, 1) + '\n</fiche_projet>'));

  var q = (donnees.questionnaire || {})[projetId] || {};
  var reponses = {};
  Object.keys(q).forEach(function (rub) { reponses[rub] = q[rub].donnees; });
  blocs.push(texteBloc_('<informations_client>\n'
    + (Object.keys(reponses).length ? JSON.stringify(reponses, null, 1) : 'Aucune information renseignée par le client.')
    + '\n</informations_client>'));

  var partenaires = (donnees.partenaires || {})[projetId] || [];
  var financements = (donnees.financements || {})[projetId] || [];
  blocs.push(texteBloc_('<partenaires>\n' + JSON.stringify(partenaires) + '\n</partenaires>\n'
    + '<financements>\n' + JSON.stringify(financements) + '\n</financements>'));

  var fil = lireOnglet('Redaction')
    .filter(function (r) { return String(r.projet_id) === projetId && r.chapitre !== chapitreExclu && r.fil; })
    .map(function (r) { return '[' + r.chapitre + '] ' + r.fil; });
  blocs.push(texteBloc_('<fil_conducteur>\n'
    + (fil.length ? fil.join('\n') : 'Aucun chapitre rédigé auparavant.') + '\n</fil_conducteur>'));
  return blocs;
}

/**
 * Fichiers du dossier « 01 — Projet de santé » et de ses sous-dossiers
 * directs, convertis en blocs lisibles par Claude.
 * @param {Array<string>} exclus chapitres déjà rédigés, qui passent par le fil conducteur.
 */
function sourcesDuDossier_(dossier, exclus) {
  var fichiers = [];
  var collecter = function (d) {
    var it = d.getFiles();
    while (it.hasNext()) fichiers.push(it.next());
  };
  collecter(dossier);
  var sous = dossier.getFolders();
  while (sous.hasNext()) collecter(sous.next());

  var lus = [], ignores = [], total = 0;
  fichiers.forEach(function (f) {
    var nom = f.getName();
    if (exclus.indexOf(f.getId()) !== -1) return;
    if (lus.length >= SOURCES_MAX_FICHIERS) { ignores.push(nom + ' (nombre maximal atteint)'); return; }

    var type = String(f.getMimeType() || '');
    try {
      var bloc = null, poids = 0;
      if (type === 'application/vnd.google-apps.document') {
        var t = exporterTexteGoogle_(f.getId(), 'text/plain').slice(0, SOURCES_MAX_CARACTERES_TEXTE);
        bloc = texteBloc_(t); poids = t.length;
      } else if (type === 'application/vnd.google-apps.spreadsheet') {
        var csv = exporterTexteGoogle_(f.getId(), 'text/csv').slice(0, SOURCES_MAX_CARACTERES_TEXTE);
        bloc = texteBloc_('Premier onglet, au format CSV :\n' + csv); poids = csv.length;
      } else if (type === 'application/pdf' || /^image\/(png|jpeg|gif|webp)$/.test(type)
                 || /^text\//.test(type) || type === 'application/json') {
        var octets = f.getBlob().getBytes();
        poids = octets.length;
        if (poids > SOURCES_MAX_OCTETS_FICHIER) { ignores.push(nom + ' (' + formaterOctets(poids) + ', trop volumineux)'); return; }
        if (type === 'application/pdf') {
          bloc = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Utilities.base64Encode(octets) } };
        } else if (type.indexOf('image/') === 0) {
          bloc = { type: 'image', source: { type: 'base64', media_type: type, data: Utilities.base64Encode(octets) } };
        } else {
          bloc = texteBloc_(f.getBlob().getDataAsString('UTF-8').slice(0, SOURCES_MAX_CARACTERES_TEXTE));
        }
      } else {
        ignores.push(nom + ' (format non lu : convertissez-le en Google Docs, Google Sheets ou PDF)');
        return;
      }
      if (total + poids > SOURCES_MAX_OCTETS_TOTAL) { ignores.push(nom + ' (volume total atteint)'); return; }
      total += poids;
      lus.push({ nom: nom, bloc: bloc });
    } catch (e) {
      ignores.push(nom + ' (lecture impossible)');
    }
  });
  return { lus: lus, ignores: ignores };
}

/** Texte d'un fichier Google, par l'export de l'API Drive. */
function exporterTexteGoogle_(fileId, mimeType) {
  var rep = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId)
    + '/export?mimeType=' + encodeURIComponent(mimeType), {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
  });
  if (rep.getResponseCode() !== 200) throw new Error('export impossible (' + rep.getResponseCode() + ')');
  return rep.getContentText('UTF-8');
}

/* ------------------------------------------------- Suivi et réception -- */

/**
 * Action « suivreRedaction » : interroge le lot ; s'il est terminé, crée le
 * Google Docs du chapitre et enregistre le fil conducteur.
 */
function suivreRedaction(requete) {
  var projetId = String(requete.projetId || '');
  var chapitre = chapitreRedaction_(String(requete.chapitre || ''));
  if (!projetId || !chapitre) throw new Error('Projet ou chapitre non précisé.');

  // Deux onglets ouverts interrogeraient le même lot : un seul doit créer le document.
  var verrou = LockService.getScriptLock();
  verrou.waitLock(60000);
  try {
    var ligne = ligneRedaction_(projetId, chapitre.id);
    if (!ligne) throw new Error('Aucune rédaction demandée pour ce chapitre.');
    if (String(ligne.statut) !== 'en_cours') return etatRedaction_(projetId, chapitre.id);

    var res = resultatLotClaude_(cleClaude_(), ligne.lot_id);
    if (res.etat === 'en_cours') return etatRedaction_(projetId, chapitre.id);
    if (res.etat === 'erreur') {
      ecrireRedaction_(projetId, chapitre.id, { statut: 'erreur', message: 'Rédaction non aboutie : ' + res.motif + '.' });
      return etatRedaction_(projetId, chapitre.id);
    }

    var texte = res.texte;
    var html = extraireBloc_(texte, 'chapitre');
    if (!html) {
      ecrireRedaction_(projetId, chapitre.id, { statut: 'erreur',
        message: 'Réponse inattendue : le chapitre est absent' + (res.tronque ? ' (longueur maximale atteinte)' : '') + '.' });
      return etatRedaction_(projetId, chapitre.id);
    }

    var projet = lireOnglet('Projets').filter(function (r) { return r.id === projetId; })[0] || {};
    var version = (Number(ligne.version) || 0) + 1;
    var titreDoc = 'PDS — ' + (projet.nom || projetId) + ' — ' + chapitre.titre + ' — v' + version;
    var dossier = sousDossierCategorie(dossierDuProjet(projetId), 'Projet');
    var doc = creerGoogleDoc_(titreDoc, mettreEnForme_(html, chapitre, projet), dossier.getId());

    var fil = extraireBloc_(texte, 'fil');
    try { fil = JSON.stringify((JSON.parse(fil).faits || []).slice(0, 40)); } catch (e) { fil = String(fil || '').slice(0, 8000); }

    ecrireRedaction_(projetId, chapitre.id, {
      statut: 'pret', doc_id: doc.id, doc_url: doc.url, version: version,
      fil: String(fil).slice(0, 20000),
      a_completer: extraireBloc_(texte, 'a_completer').trim().slice(0, 20000),
      message: 'Version ' + version + ' rédigée'
        + (res.tronque ? ' — attention : longueur maximale atteinte, fin du chapitre à vérifier' : '') + '.'
    });
    return etatRedaction_(projetId, chapitre.id);
  } finally {
    try { verrou.releaseLock(); } catch (ignore) { /* rien */ }
  }
}

function etatRedaction_(projetId, chapitreId) {
  var projets = [{ id: projetId }];
  return donneesRedaction_(projets)[projetId][chapitreId] || null;
}

function extraireBloc_(texte, balise) {
  var m = String(texte || '').match(new RegExp('<' + balise + '>([\\s\\S]*?)</' + balise + '>'));
  if (m) return m[1].trim();
  // Réponse tronquée : on garde ce qui suit la balise ouvrante.
  var debut = String(texte || '').indexOf('<' + balise + '>');
  return debut >= 0 ? String(texte).slice(debut + balise.length + 2).trim() : '';
}

/* ------------------------------------------------ Mise en forme du Doc -- */

var COULEURS_PDS = { titre: '#0b3c5d', accent: '#1e95cb', entete: '#e6f3fa', bordure: '#b9d7e8', encadre: '#f3f8fb' };
var PALETTE_GRAPHIQUES = ['#1e95cb', '#0b3c5d', '#f2a541', '#5bb381', '#c75c5c', '#8a6fb3'];

/** HTML final : balises nettoyées, styles en ligne, graphiques rendus en images. */
function mettreEnForme_(html, chapitre, projet) {
  var propre = String(html)
    .replace(/<(script|style|iframe|object|embed|svg|form)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(img|link|meta|input)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '');

  // Graphiques : rendus par le service Charts, insérés en image.
  propre = propre.replace(/<figure\s+data-graphique\s*=\s*'([^']*)'\s*>\s*<\/figure>/gi, function (tout, json) {
    return figureGraphique_(json);
  }).replace(/<figure\s+data-graphique\s*=\s*"([^"]*)"\s*>\s*<\/figure>/gi, function (tout, json) {
    return figureGraphique_(json.replace(/&quot;/g, '"'));
  });

  // Attributs retirés (sauf fusion de cellules), puis styles imposés.
  propre = propre.replace(/<(h[1-4]|p|ul|ol|li|table|thead|tbody|tr|blockquote|strong|em)\s[^>]*>/gi, '<$1>');
  propre = propre.replace(/<(th|td)\s([^>]*)>/gi, function (tout, balise, attrs) {
    var garde = (attrs.match(/(colspan|rowspan)\s*=\s*"?\d+"?/gi) || []).join(' ');
    return '<' + balise + (garde ? ' ' + garde : '') + '>';
  });

  // Google Docs ignore le fond d'un bloc de citation à l'import : l'encadré
  // devient un tableau d'une cellule, dont le fond, lui, est conservé.
  propre = propre.replace(/<blockquote>/gi, '<table><tr><td data-encadre="1">')
                 .replace(/<\/blockquote>/gi, '</td></tr></table>');

  var police = "font-family:Arial,sans-serif;";
  var styles = {
    h1: police + 'font-size:20pt;color:' + COULEURS_PDS.titre + ';border-bottom:2pt solid ' + COULEURS_PDS.accent + ';padding-bottom:4pt;',
    h2: police + 'font-size:15pt;color:' + COULEURS_PDS.titre + ';margin-top:18pt;',
    h3: police + 'font-size:12.5pt;color:' + COULEURS_PDS.accent + ';margin-top:12pt;',
    h4: police + 'font-size:11pt;color:' + COULEURS_PDS.titre + ';',
    p: police + 'font-size:10.5pt;line-height:1.35;text-align:justify;',
    li: police + 'font-size:10.5pt;line-height:1.3;',
    table: 'border-collapse:collapse;width:100%;margin:6pt 0;',
    th: police + 'font-size:9.5pt;background-color:' + COULEURS_PDS.entete + ';color:' + COULEURS_PDS.titre + ';border:1pt solid ' + COULEURS_PDS.bordure + ';padding:4pt;text-align:left;',
    td: police + 'font-size:9.5pt;border:1pt solid ' + COULEURS_PDS.bordure + ';padding:4pt;vertical-align:top;',
    encadre: police + 'background-color:' + COULEURS_PDS.encadre + ';border:1pt solid ' + COULEURS_PDS.bordure
      + ';border-left:4pt solid ' + COULEURS_PDS.accent + ';padding:6pt 10pt;vertical-align:top;'
  };
  propre = propre.replace(/<td data-encadre="1">/g, '<td style="' + styles.encadre + '">');
  delete styles.encadre;
  Object.keys(styles).forEach(function (b) {
    propre = propre.replace(new RegExp('<' + b + '(\\s[^>]*)?>', 'gi'), function (tout, attrs) {
      if (/style=/.test(attrs || '')) return tout;
      return '<' + b + (attrs || '') + ' style="' + styles[b] + '">';
    });
  });

  var bandeau = '<p style="' + police + 'font-size:9pt;color:#5b6b7b;">' + (chapitre.bandeau || 'Projet de santé') + ' — '
    + echapperHtml_(projet.nom || '') + (projet.ville ? ' (' + echapperHtml_(projet.ville) + ')' : '')
    + ' · ElodiaTech — Ingénierie médicale · document de travail rédigé le '
    + Utilities.formatDate(new Date(), 'America/Martinique', 'dd/MM/yyyy') + '</p>';

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + echapperHtml_(chapitre.titre)
    + '</title></head><body>' + bandeau + propre + '</body></html>';
}

/** Rend un graphique décrit en JSON ; à défaut, laisse un emplacement signalé. */
function figureGraphique_(json) {
  var g;
  try { g = JSON.parse(json); } catch (e) { return '<p>[Figure à insérer : description illisible]</p>'; }
  var titre = String(g.titre || 'Graphique');
  var legende = '<p style="font-family:Arial,sans-serif;font-size:9pt;color:#5b6b7b;text-align:center;"><em>'
    + echapperHtml_(titre) + (g.source ? ' — Source : ' + echapperHtml_(String(g.source)) : '') + '</em></p>';
  try {
    var categories = (g.categories || []).map(String);
    var series = (g.series || []).filter(function (s) { return s && (s.valeurs || []).length === categories.length; });
    if (!categories.length || !series.length) throw new Error('données incomplètes');
    if (g.type === 'secteurs') series = series.slice(0, 1);

    var table = Charts.newDataTable().addColumn(Charts.ColumnType.STRING, 'Catégorie');
    series.forEach(function (s) { table.addColumn(Charts.ColumnType.NUMBER, String(s.nom || '')); });
    categories.forEach(function (c, i) {
      table.addRow([c].concat(series.map(function (s) { return Number(s.valeurs[i]) || 0; })));
    });

    var constructeur = g.type === 'lignes' ? Charts.newLineChart()
      : g.type === 'secteurs' ? Charts.newPieChart()
      : g.type === 'pyramide' ? Charts.newBarChart()
      : Charts.newColumnChart();
    var graphique = constructeur.setDataTable(table.build()).setTitle(titre)
      .setDimensions(900, g.type === 'pyramide' ? 560 : 460)
      .setColors(PALETTE_GRAPHIQUES.slice(0, Math.max(series.length, g.type === 'secteurs' ? categories.length : 1)))
      .setLegendPosition(Charts.Position.BOTTOM)
      .build();
    var png = graphique.getAs('image/png').getBytes();
    return '<p style="text-align:center;"><img width="600" src="data:image/png;base64,'
      + Utilities.base64Encode(png) + '"></p>' + legende;
  } catch (e) {
    return '<p>[Figure à insérer : ' + echapperHtml_(titre) + ']</p>' + legende;
  }
}

function echapperHtml_(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Crée un Google Docs à partir de HTML, par l'envoi multipartite de l'API Drive. */
function creerGoogleDoc_(nom, html, dossierId) {
  var frontiere = 'elodiatech' + Utilities.getUuid().replace(/-/g, '');
  var meta = JSON.stringify({ name: nom, mimeType: 'application/vnd.google-apps.document', parents: [dossierId] });
  var corps = '--' + frontiere + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta
    + '\r\n--' + frontiere + '\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n' + html
    + '\r\n--' + frontiere + '--';
  var rep = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'post', contentType: 'multipart/related; boundary=' + frontiere,
    payload: Utilities.newBlob(corps, 'text/plain').getBytes(),
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
  });
  if (rep.getResponseCode() !== 200) {
    throw new Error('Création du Google Docs impossible (' + rep.getResponseCode() + ').');
  }
  var f = JSON.parse(rep.getContentText());
  return { id: f.id, url: f.webViewLink || ('https://docs.google.com/document/d/' + f.id + '/edit') };
}

/* ==========================================================================
   ACTES ET DOCUMENTS GÉNÉRÉS — réservés à l'expert

   Les documents qu'un modèle type ne suffit pas à produire — statuts,
   charte, règlement de fonctionnement, conventions, contrats — sont rédigés
   par Claude sur le même circuit que les chapitres : le dossier du projet,
   les chapitres déjà rédigés et les sources officielles déposées dans
   « Sources officielles des actes / <document> » partent en lot ; le
   résultat devient un Google Docs dans le dossier de sa catégorie.
   Validé, il rejoint les documents du client et, s'il se signe, ses
   actes à signer.
   ========================================================================== */

var DOSSIER_SOURCES_ACTES = 'Sources officielles des actes';
var DOSSIER_SOURCES_COMMUN = '00 — Commun à tous les actes';
var CHAPITRES_MAX_CARACTERES = 40000;   // par chapitre joint
var CHAPITRES_TOTAL_CARACTERES = 160000;

/**
 * Documents générés. `types` / `modeles` : à quelles structures ils
 * s'appliquent (même règle que les prestations). `categorie` : dossier Drive.
 * `signature` : 'renforcee' (DocuSeal, WM Goodflag en secours), 'interne'
 * ou 'aucune'. `prestation` : étape soumise au client à la validation.
 * `plan` : ce que le document doit contenir, sans chiffre ni nom inventé.
 */
var ACTES_GENERES = [
  { id: 'statuts_sisa', titre: 'Statuts de la SISA', types: ['MSP'], modeles: ['sisa'], categorie: 'Juridique',
    signature: 'renforcee', prestation: 'P17', nature: 'acte juridique',
    plan: "Statuts d'une société interprofessionnelle de soins ambulatoires (articles L.4041-1 et suivants du Code de la santé publique) : "
        + "forme, dénomination, objet (mise en commun de moyens, exercice en commun des activités de coordination thérapeutique, d'éducation "
        + "thérapeutique et de coopération entre professionnels), siège, durée, apports et capital, associés (au moins deux médecins et un "
        + "auxiliaire médical), parts sociales, gérance, décisions collectives, activités exercées en commun et rémunérations perçues à ce "
        + "titre, répartition des résultats, cession de parts, retrait et exclusion, dissolution. Prendre pour base le modèle de statuts de "
        + "SISA de l'Ordre des médecins s'il est joint." },
  { id: 'ri_sisa', titre: 'Règlement intérieur de la SISA', types: ['MSP'], modeles: ['sisa'], categorie: 'Juridique',
    signature: 'interne', prestation: 'P17', nature: 'acte juridique',
    plan: "Règlement intérieur complétant les statuts : organisation de la gérance et des réunions, répartition des rémunérations perçues "
        + "en commun entre associés, engagements de chacun dans les missions du projet de santé, utilisation des moyens communs, "
        + "procédure d'entrée et de sortie, règlement des différends." },
  { id: 'statuts_assoc', titre: "Statuts de l'association gestionnaire", types: ['CDS'], modeles: ['assoc'], categorie: 'Juridique',
    signature: 'renforcee', prestation: 'P17', nature: 'acte juridique',
    plan: "Statuts d'une association déclarée (loi du 1er juillet 1901) gestionnaire d'un centre de santé (article L.6323-1 du Code de la "
        + "santé publique) : dénomination, objet (création et gestion du centre de santé, missions du projet de santé), siège, durée, "
        + "membres et cotisations, assemblée générale, conseil d'administration, bureau, ressources, gestion désintéressée, "
        + "absence de partage des excédents, dissolution." },
  { id: 'pacte_associes', titre: "Pacte d'associés", types: ['MSP'], categorie: 'Juridique',
    signature: 'renforcee', prestation: '', nature: 'acte juridique',
    plan: "Pacte entre les associés de la SISA : engagements de présence et de participation aux missions coordonnées, préemption et "
        + "agrément des cessions, sortie d'un associé, non-concurrence dans le respect de la déontologie, résolution des conflits." },
  { id: 'charte_interne', titre: 'Charte interne de la maison de santé', types: ['MSP'], categorie: 'Juridique',
    signature: 'interne', prestation: 'P35', nature: 'document de fonctionnement',
    plan: "Charte interne : valeurs et engagements de l'équipe, organisation du travail pluriprofessionnel (réunions, protocoles, "
        + "système d'information partagé), accueil des patients et continuité des soins, instances et prise de décision, accueil des "
        + "nouveaux professionnels et des étudiants, en cohérence avec les axes du projet de santé." },
  { id: 'reglement_fonctionnement', titre: 'Règlement de fonctionnement du centre de santé', types: ['CDS'], categorie: 'Juridique',
    signature: 'interne', prestation: 'P35', nature: 'document de fonctionnement',
    plan: "Règlement de fonctionnement suivant les rubriques du modèle annexé à l'arrêté du 27 février 2018 relatif aux centres de santé "
        + "(s'il est joint, en reprendre exactement l'ordre et les intitulés) : organisation du centre, horaires et accueil, droits et "
        + "obligations des usagers, hygiène et sécurité, gestion des dossiers et des informations, organisation des urgences et de la "
        + "continuité des soins." },
  { id: 'organigramme', titre: 'Organigramme et gouvernance', categorie: 'Projet',
    signature: 'aucune', prestation: '', nature: 'document de pilotage',
    plan: "Organigramme fonctionnel : instances de gouvernance, coordination, professionnels par pôle, fonctions support, "
        + "référents des axes du projet de santé. Présenter un tableau des rôles et une liste hiérarchisée, à partir du chapitre 2." },
  { id: 'adhesion_ancs', titre: "Demande d'adhésion à l'accord national des centres de santé", types: ['CDS'], categorie: 'Finances',
    signature: 'renforcee', prestation: 'P41', nature: 'courrier',
    plan: "Courrier du représentant légal à la caisse d'assurance maladie (CGSS dans les départements d'outre-mer) demandant l'adhésion "
        + "du centre de santé à l'accord national du 28 août 2025 (article 8 : demande par tout moyen donnant date certaine à sa "
        + "réception), avec la liste des pièces jointes (récépissé de l'engagement de conformité, numéro FINESS, projet de santé, "
        + "règlement de fonctionnement)." },
  { id: 'budget', titre: 'Budget prévisionnel et plan de financement', categorie: 'Finances',
    signature: 'aucune', prestation: '', nature: 'document financier',
    plan: "Budget prévisionnel sur trois ans (charges, produits, résultat) et plan de financement de l'investissement (emplois, "
        + "ressources), en tableaux. Seuls les montants figurant dans les pièces sont repris ; chaque autre montant est [à compléter]. "
        + "Ajouter les hypothèses retenues." },
  { id: 'convention_ccas', titre: 'Convention avec le CCAS ou la collectivité', categorie: 'Partenariats',
    signature: 'interne', prestation: 'P23', nature: 'convention',
    plan: "Convention de partenariat : parties, objet, engagements réciproques (repérage et orientation des publics, accès aux droits, "
        + "actions communes du projet de santé), coordination et référents, échanges d'informations dans le respect du secret "
        + "professionnel, durée, évaluation, résiliation." },
  { id: 'convention_hopital', titre: "Convention avec l'établissement de santé", categorie: 'Partenariats',
    signature: 'renforcee', prestation: 'P24', nature: 'convention',
    plan: "Convention de partenariat avec l'établissement hospitalier ou le groupement hospitalier de territoire : parcours entrée et "
        + "sortie d'hospitalisation, avis spécialisés et télé-expertise, consultations avancées, échanges d'informations, durée, évaluation." },
  { id: 'convention_domicile', titre: 'Convention avec un service à domicile (HAD, SSIAD)', categorie: 'Partenariats',
    signature: 'interne', prestation: 'P24', nature: 'convention',
    plan: "Convention de coordination avec l'HAD, le SSIAD ou le service à domicile : critères d'orientation, coordination des "
        + "interventions, transmissions, gestion des situations complexes, durée, évaluation." },
  { id: 'convention_plateau', titre: 'Convention avec un laboratoire, une pharmacie ou un cabinet de radiologie', categorie: 'Partenariats',
    signature: 'interne', prestation: 'P24', nature: 'convention',
    plan: "Convention de coopération : délais de rendu et circuits des résultats, protocoles partagés, sécurité des échanges, "
        + "respect du libre choix du patient, durée, évaluation." },
  { id: 'convention_cpts', titre: 'Convention avec la CPTS', categorie: 'Partenariats',
    signature: 'interne', prestation: 'P24', nature: 'convention',
    plan: "Convention avec la communauté professionnelle territoriale de santé : contribution de la structure aux missions de la CPTS "
        + "(accès aux soins, parcours, prévention, crises sanitaires), réciprocité, référents, durée, évaluation." },
  { id: 'convention_prevention', titre: 'Convention de partenariat de prévention', categorie: 'Partenariats',
    signature: 'interne', prestation: 'P25', nature: 'convention',
    plan: "Convention avec un acteur de prévention ou une association de patients : actions communes rattachées aux axes du projet "
        + "de santé, publics visés, moyens, indicateurs, durée, évaluation." },
  { id: 'contrat_medecin', titre: 'Contrat de travail du médecin salarié', types: ['CDS'], categorie: 'Équipe',
    signature: 'renforcee', prestation: '', nature: 'contrat de travail',
    plan: "Contrat de travail d'un médecin salarié du centre de santé : fonctions, indépendance professionnelle et respect de la "
        + "déontologie, participation aux missions du projet de santé, durée et temps de travail, rémunération [à compléter], "
        + "permanence et continuité des soins, formation continue, communication du contrat au conseil départemental de l'Ordre "
        + "(article L.4113-9 du Code de la santé publique)." },
  { id: 'contrats_salaries', titre: 'Contrat de travail d\'un professionnel de santé salarié', types: ['CDS'], categorie: 'Équipe',
    signature: 'renforcee', prestation: '', nature: 'contrat de travail',
    plan: "Contrat de travail d'un professionnel de santé non médecin (profession à préciser dans les consignes) : fonctions, "
        + "autonomie professionnelle, participation au projet de santé, durée, temps de travail, rémunération [à compléter], formation." },
  { id: 'mise_a_disposition', titre: 'Convention de mise à disposition des locaux', categorie: 'Immobilier',
    signature: 'renforcee', prestation: '', nature: 'convention',
    plan: "Convention de mise à disposition des locaux par la collectivité ou le propriétaire : désignation des locaux, destination, "
        + "durée, contrepartie [à compléter], charges, entretien, assurances, accessibilité et sécurité ERP, résiliation." },
  { id: 'cahier_locaux', titre: 'Cahier des charges des locaux', categorie: 'Immobilier',
    signature: 'aucune', prestation: '', nature: 'document technique',
    plan: "Cahier des charges des locaux à partir des informations du client : surfaces et pièces par fonction, flux patients, "
        + "accessibilité, normes ERP, confidentialité, salles de soins et de télémédecine, stockage, déchets d'activités de soins, "
        + "sécurité, réseau informatique, évolutivité." },
  { id: 'rapport_annuel', titre: "Rapport annuel d'activité", categorie: 'Projet',
    signature: 'interne', prestation: '', nature: 'document de pilotage',
    plan: "Rapport annuel : activité, réalisation des actions par axe du projet de santé, indicateurs (uniquement ceux des pièces), "
        + "fonctionnement de l'équipe, partenariats, difficultés et perspectives." },
  { id: 'avenant_pds', titre: 'Avenant au projet de santé', categorie: 'Projet',
    signature: 'interne', prestation: '', nature: 'avenant',
    plan: "Avenant d'actualisation du projet de santé : objet, éléments modifiés (équipe, organisation, axes, actions), justification, "
        + "date d'effet, signatures de l'équipe. Préciser les modifications dans les consignes." }
];

function acteGenere_(id) {
  for (var i = 0; i < ACTES_GENERES.length; i++) if (ACTES_GENERES[i].id === id) return ACTES_GENERES[i];
  return null;
}

function ligneActe_(projetId, acte) {
  return lireOnglet('Actes').filter(function (r) {
    return String(r.projet_id) === projetId && String(r.acte) === acte;
  })[0] || null;
}

function ecrireActe_(projetId, acte, champs) {
  assurerOnglet_('Actes');
  var conf = { onglet: 'Actes', cles: ['projet_id', 'acte'], champs: {} };
  ONGLETS['Actes'].slice(2).forEach(function (c) { conf.champs[c] = c; });
  champs.maj_le = new Date().toISOString();
  ecrireLigne(conf, [projetId, acte], champs);
}

function donneesActes_(projets) {
  var parProjet = {};
  projets.forEach(function (p) { parProjet[p.id] = {}; });
  lireOnglet('Actes').forEach(function (r) {
    var groupe = parProjet[r.projet_id];
    if (!groupe || !acteGenere_(String(r.acte))) return;
    groupe[r.acte] = {
      statut: String(r.statut || ''), docId: String(r.doc_id || ''), docUrl: String(r.doc_url || ''),
      version: Number(r.version) || 0, majLe: String(r.maj_le || ''), message: String(r.message || ''),
      consignes: String(r.consignes || ''), aCompleter: String(r.a_completer || ''),
      enCours: String(r.statut) === 'en_cours'
    };
  });
  return parProjet;
}

function etatActe_(projetId, acteId) {
  return donneesActes_([{ id: projetId }])[projetId][acteId] || null;
}

/** Dossier des sources officielles d'un acte (créé au besoin, vide). */
function dossierSourcesActe_(titre) {
  var racine = DriveApp.getFolderById(DOSSIER_RACINE);
  var trouver = function (parent, nom) {
    var it = parent.getFoldersByName(nom);
    return it.hasNext() ? it.next() : parent.createFolder(nom);
  };
  return trouver(trouver(racine, DOSSIER_SOURCES_ACTES), titre);
}

/** Menu : crée les dossiers où déposer les sources officielles de chaque acte. */
function creerDossiersSourcesActes() {
  dossierSourcesActe_(DOSSIER_SOURCES_COMMUN);
  ACTES_GENERES.forEach(function (a) { dossierSourcesActe_(a.titre); });
  SpreadsheetApp.getUi().alert('Dossiers prêts',
    'Dossier « ' + DOSSIER_SOURCES_ACTES + ' » : un sous-dossier par document. Déposez-y les modèles officiels '
    + '(PDF, Google Docs) que Claude doit suivre.', SpreadsheetApp.getUi().ButtonSet.OK);
}

/** Texte des chapitres rédigés, validés d'abord : les actes en reprennent les choix. */
function blocChapitres_(projetId) {
  var lignes = lireOnglet('Redaction').filter(function (r) {
    return String(r.projet_id) === projetId && r.doc_id && ['pret', 'valide'].indexOf(String(r.statut)) !== -1;
  }).sort(function (a, b) { return (String(b.statut) === 'valide') - (String(a.statut) === 'valide'); });
  var total = 0, parties = [];
  lignes.forEach(function (r) {
    if (total >= CHAPITRES_TOTAL_CARACTERES) return;
    var texte = '';
    try { texte = exporterTexteGoogle_(String(r.doc_id), 'text/plain'); } catch (e) { return; }
    texte = texte.slice(0, Math.min(CHAPITRES_MAX_CARACTERES, CHAPITRES_TOTAL_CARACTERES - total));
    total += texte.length;
    parties.push('[' + r.chapitre + (String(r.statut) === 'valide' ? ', validé' : ', brouillon') + ']\n' + texte);
  });
  return texteBloc_('<projet_de_sante>\n' + (parties.length ? parties.join('\n\n')
    : 'Aucun chapitre du projet de santé n\'est encore rédigé : signaler [à compléter] tout choix qui en dépend.')
    + '\n</projet_de_sante>');
}

function consigneSystemeActe_() {
  return [
    "Tu es juriste et consultant expert de l'exercice coordonné (maisons de santé pluriprofessionnelles, centres de santé), au sein du cabinet ElodiaTech.",
    "Tu rédiges un PROJET de document pour la structure décrite dans les pièces. Il sera relu par l'expert et, pour un acte juridique, par un professionnel du droit, avant toute signature.",
    "",
    "RÈGLES ABSOLUES",
    "- N'invente jamais un nom, une date, un montant, un capital, une adresse, un numéro (SIRET, FINESS, RPPS) ou un engagement : reprends-les des pièces, sinon écris [à compléter : <élément précis>].",
    "- Les choix d'organisation, les axes et les missions viennent du projet de santé et du fil conducteur fournis ; ne les modifie pas.",
    "- Une source officielle jointe (modèle de l'Ordre, arrêté, accord conventionnel) fait référence : suis sa structure et ses intitulés.",
    "- Ne cite que des références légales dont tu es certain ; sinon décris la règle sans numéro d'article, ou ajoute [à confirmer].",
    "- Style juridique et administratif précis, sans formule commerciale. Articles numérotés pour un acte ; clauses numérotées pour une convention ou un contrat.",
    "",
    "FORMAT DE SORTIE — respecte-le exactement",
    "1. Le document en HTML simple entre <document> et </document>. Balises permises : h1 (titre, une seule fois), h2, h3, h4, p, ul, ol, li, strong, em, table, thead, tbody, tr, th, td, blockquote, br. Aucun attribut de style.",
    "   Termine par un bloc de signatures en tableau (nom, qualité, date, signature) quand le document se signe.",
    "2. Entre <a_completer> et </a_completer>, la liste en texte simple, une ligne par élément, des informations à obtenir et des points à faire vérifier.",
    "Rien d'autre en dehors de ces deux blocs."
  ].join('\n');
}

/** Action « redigerActe » (expert). */
function redigerActe(requete) {
  var projetId = String(requete.projetId || '');
  var acte = acteGenere_(String(requete.acte || ''));
  if (!projetId) throw new Error('Projet non précisé.');
  if (!acte) throw new Error('Document inconnu.');

  var donnees = construireDonnees(projetId);
  if (!donnees.projets.length) throw new Error('Projet introuvable.');
  var p = donnees.projets[0];
  var cle = cleClaude_();
  var consignes = String(requete.consignes || '').slice(0, 8000);

  var existant = ligneActe_(projetId, acte.id);
  if (existant && String(existant.statut) === 'en_cours') throw new Error('Une rédaction de ce document est déjà en cours.');

  // Sources : modèles officiels de cet acte, sources communes, pièces du
  // dossier du client dans la catégorie (hors documents déjà générés).
  var generes = lireOnglet('Actes').filter(function (r) { return r.doc_id; }).map(function (r) { return String(r.doc_id); });
  var officielles = sourcesDuDossier_(dossierSourcesActe_(acte.titre), generes);
  var communes = sourcesDuDossier_(dossierSourcesActe_(DOSSIER_SOURCES_COMMUN), generes);
  var client = sourcesDuDossier_(sousDossierCategorie(dossierDuProjet(projetId), acte.categorie), generes);

  var blocs = blocsDossier_(projetId, donnees, '');
  blocs.push(blocChapitres_(projetId));
  var joindre = function (liste, etiquette) {
    liste.lus.forEach(function (s) {
      blocs.push(texteBloc_('<' + etiquette + ' nom="' + s.nom.replace(/"/g, "'") + '">'));
      blocs.push(s.bloc);
    });
  };
  joindre(officielles, 'source_officielle');
  joindre(communes, 'source_officielle');
  joindre(client, 'piece_du_dossier');
  if (!officielles.lus.length && !communes.lus.length) {
    blocs.push(texteBloc_('<sources_officielles>Aucune source officielle déposée pour ce document.</sources_officielles>'));
  }
  blocs.push(texteBloc_([
    'Rédige maintenant le projet de document suivant pour « ' + p.nom + ' » (' + (p.type === 'CDS' ? 'centre de santé' : 'maison de santé pluriprofessionnelle') + ').',
    '', 'DOCUMENT : ' + acte.titre + ' (' + acte.nature + ')', '', 'CONTENU ATTENDU :', acte.plan,
    consignes ? '\nCONSIGNES PARTICULIÈRES DE L\'EXPERT :\n' + consignes : ''
  ].join('\n')));

  var lot = envoyerLotClaude_(cle, projetId + '-' + acte.id, consigneSystemeActe_(), blocs);
  var noms = officielles.lus.concat(communes.lus, client.lus).map(function (s) { return s.nom; });
  var ignores = officielles.ignores.concat(communes.ignores, client.ignores);
  ecrireActe_(projetId, acte.id, {
    statut: 'en_cours', lot_id: lot.id, consignes: consignes,
    message: 'Rédaction demandée. Sources jointes : ' + (noms.length ? noms.join(', ') : 'aucune')
      + (ignores.length ? '. Non lues : ' + ignores.join(', ') : '') + '.'
  });
  return { statut: 'en_cours', lotId: lot.id, sources: noms, ignores: ignores };
}

/** Action « suivreActe » (expert) : crée le Google Docs quand le lot est terminé. */
function suivreActe(requete) {
  var projetId = String(requete.projetId || '');
  var acte = acteGenere_(String(requete.acte || ''));
  if (!projetId || !acte) throw new Error('Projet ou document non précisé.');

  var verrou = LockService.getScriptLock();
  verrou.waitLock(60000);
  try {
    var ligne = ligneActe_(projetId, acte.id);
    if (!ligne) throw new Error('Aucune rédaction demandée pour ce document.');
    if (String(ligne.statut) !== 'en_cours') return etatActe_(projetId, acte.id);

    var res = resultatLotClaude_(cleClaude_(), ligne.lot_id);
    if (res.etat === 'en_cours') return etatActe_(projetId, acte.id);
    if (res.etat === 'erreur') {
      ecrireActe_(projetId, acte.id, { statut: 'erreur', message: 'Rédaction non aboutie : ' + res.motif + '.' });
      return etatActe_(projetId, acte.id);
    }
    var html = extraireBloc_(res.texte, 'document');
    if (!html) {
      ecrireActe_(projetId, acte.id, { statut: 'erreur',
        message: 'Réponse inattendue : le document est absent' + (res.tronque ? ' (longueur maximale atteinte)' : '') + '.' });
      return etatActe_(projetId, acte.id);
    }

    var projet = lireOnglet('Projets').filter(function (r) { return r.id === projetId; })[0] || {};
    var version = (Number(ligne.version) || 0) + 1;
    var dossier = sousDossierCategorie(dossierDuProjet(projetId), acte.categorie);
    var doc = creerGoogleDoc_(acte.titre + ' — ' + (projet.nom || projetId) + ' — projet v' + version,
      mettreEnForme_(html, { titre: acte.titre, bandeau: 'Projet de document' }, projet), dossier.getId());

    ecrireActe_(projetId, acte.id, {
      statut: 'pret', doc_id: doc.id, doc_url: doc.url, version: version,
      a_completer: extraireBloc_(res.texte, 'a_completer').trim().slice(0, 20000),
      message: 'Version ' + version + ' rédigée' + (res.tronque ? ' — attention : longueur maximale atteinte, fin à vérifier' : '') + '.'
    });
    return etatActe_(projetId, acte.id);
  } finally {
    try { verrou.releaseLock(); } catch (ignore) { /* rien */ }
  }
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
