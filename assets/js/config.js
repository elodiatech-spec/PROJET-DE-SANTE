/* ==========================================================================
   config.js — Référentiels métier ElodiaTech
   Aucune donnée projet ici : uniquement le catalogue commercial et
   réglementaire. Les données projet vivent dans store.js.
   ========================================================================== */

const APP = {
  nom: 'ElodiaTech',
  produit: 'Plateforme Projets de Santé',
  version: '4.0.0',
  baseline: 'Pilotage des projets de santé — MSP & Centres de santé',
};

/**
 * Adresse de la passerelle Google Sheets (application web Apps Script,
 * terminée par /exec).
 *
 * ▸ À renseigner ici, une fois pour toutes.
 *
 * C'est l'adresse par laquelle l'application interroge la base. Tant qu'elle
 * reste vide, seuls les navigateurs où elle a été saisie à la main savent où
 * s'adresser : les liens envoyés aux clients ouvrent alors le jeu de
 * démonstration au lieu de leur dossier.
 *
 * La publier ici ne présente pas de risque : le script ne livre aucune donnée
 * sans code expert ni jeton client valide. C'est le porte-clés qui protège,
 * pas le secret de l'adresse.
 */
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwUO5M22-R5McLGVcUEByfZ3uC1h7GBDozAlotRfWvfUQpPGGSiRN7KVQnKYIUOQp2X6A/exec';

/* --------------------------------------------------------------------------
   Société émettrice
   Une seule fiche décrit la société qui émet les devis, factures, mandats
   et accords : les documents générés la reprennent tous. Le jour où la
   SASU ElodiaTech est immatriculée, on modifie cette fiche (console expert
   › Équipe & société) et rien d'autre.

   Ces valeurs par défaut sont publiques (mentions légales). Les
   coordonnées bancaires n'y figurent volontairement pas : ce dépôt est
   public. Elles se saisissent dans la fiche et ne vivent que dans la
   feuille Google « Emetteur », lue par l'expert seul.
   -------------------------------------------------------------------------- */
const EMETTEUR_DEFAUT = {
  denomination: 'SARL 17 OCTOBRE',
  nomCommercial: 'ElodiaTech',
  forme: 'Société à responsabilité limitée',
  capital: '1 000 €',
  adresse: 'Espace Cartesia, Belle Étoile Nord',
  codePostal: '97212',
  ville: 'Saint-Joseph',
  siret: '921 549 531 00017',
  ape: '82.11Z',
  rcs: '',
  tvaIntracom: '',
  representant: 'Frédéric ARNOBE',
  qualite: 'Gérant',
  telephone: '+596 696 41 22 55',
  courriel: 'contact@elodiatech.fr',
  site: 'www.elodiatech.com',
  tauxTva: '8,5 %',
  titulaireCompte: '',
  iban: '',
  bic: '',
  banque: '',
};

/** Formulaire de la fiche, par groupes. `requis` : manquant = signalé. */
const CHAMPS_EMETTEUR = [
  { groupe: 'Identité', champs: [
    { id: 'denomination', label: 'Dénomination sociale', requis: true, placeholder: 'SASU ElodiaTech' },
    { id: 'nomCommercial', label: 'Nom commercial', placeholder: 'ElodiaTech' },
    { id: 'forme', label: 'Forme juridique', requis: true, placeholder: 'Société par actions simplifiée unipersonnelle' },
    { id: 'capital', label: 'Capital social', requis: true, placeholder: '1 000 €' },
  ] },
  { groupe: 'Siège', champs: [
    { id: 'adresse', label: 'Adresse', requis: true },
    { id: 'codePostal', label: 'Code postal', requis: true },
    { id: 'ville', label: 'Ville', requis: true },
  ] },
  { groupe: 'Immatriculation', champs: [
    { id: 'siret', label: 'SIRET', requis: true },
    { id: 'ape', label: 'Code APE', requis: true },
    { id: 'rcs', label: 'RCS (ville et numéro)', requis: true, placeholder: 'RCS Fort-de-France 000 000 000' },
    { id: 'tvaIntracom', label: 'N° de TVA intracommunautaire', requis: true, placeholder: 'FR00 000000000' },
    { id: 'tauxTva', label: 'Taux de TVA appliqué', requis: true, placeholder: '8,5 %' },
  ] },
  { groupe: 'Représentant et contact', champs: [
    { id: 'representant', label: 'Représentant légal', requis: true },
    { id: 'qualite', label: 'Qualité', requis: true, placeholder: 'Président' },
    { id: 'telephone', label: 'Téléphone' },
    { id: 'courriel', label: 'Courriel', type: 'email' },
    { id: 'site', label: 'Site internet' },
  ] },
  { groupe: 'Coordonnées bancaires (factures)', champs: [
    { id: 'titulaireCompte', label: 'Titulaire du compte', requis: true },
    { id: 'iban', label: 'IBAN', requis: true },
    { id: 'bic', label: 'BIC', requis: true },
    { id: 'banque', label: 'Banque (nom et adresse)' },
  ] },
];

/* --------------------------------------------------------------------------
   Statuts d'avancement d'une prestation
   `poids` sert au calcul de l'avancement (0 → 1).
   -------------------------------------------------------------------------- */
const STATUTS = {
  a_faire: {
    id: 'a_faire', label: 'À faire', couleur: 'neutre',
    icone: 'fa-regular fa-circle', poids: 0,
  },
  en_cours: {
    id: 'en_cours', label: 'En cours', couleur: 'info',
    icone: 'fa-solid fa-circle-half-stroke', poids: 0.5,
  },
  a_valider: {
    id: 'a_valider', label: 'À valider par le client', couleur: 'warn',
    icone: 'fa-solid fa-hourglass-half', poids: 0.85,
  },
  valide: {
    id: 'valide', label: 'Validé', couleur: 'ok',
    icone: 'fa-solid fa-circle-check', poids: 1,
  },
  // Ni « à faire » ni « validée » : une prestation jugée non nécessaire pour
  // ce dossier. Exclue du calcul d'avancement — Store.prestationsApplicables()
  // filtre ce statut avant toute moyenne, elle ne pèse donc plus jamais à la
  // baisse. Elle reste visible dans la feuille de route, pour la traçabilité.
  bloque: {
    id: 'bloque', label: 'Non nécessaire', couleur: 'neutre',
    icone: 'fa-solid fa-ban', poids: 0,
  },
};

/** Cycle appliqué quand l'expert clique sur le statut d'une prestation. */
const CYCLE_STATUTS = ['a_faire', 'en_cours', 'a_valider', 'valide'];

/* --------------------------------------------------------------------------
   Lots de travail — regroupement des prestations
   -------------------------------------------------------------------------- */
/* Palette dérivée du logo : le bleu et le vert de la marque ouvrent la série,
   les autres teintes s'en écartent assez pour rester distinguables. */
const LOTS = {
  L0: { id: 'L0', nom: 'Cadrage & démarrage', icone: 'fa-solid fa-flag-checkered', couleur: '#1e95cb' },
  LA: { id: 'LA', nom: 'Projet de santé', icone: 'fa-solid fa-book-medical', couleur: '#a5c836' },
  // `reglementaire` : démarches sans lesquelles la structure ne peut ouvrir ;
  // hors formule, elles restent à la charge du client, et le lui dire importe.
  LB: { id: 'LB', nom: 'Structuration juridique & dossier ARS', icone: 'fa-solid fa-scale-balanced', couleur: '#7c6bd4', reglementaire: true },
  LC: { id: 'LC', nom: 'Financements & subventions', icone: 'fa-solid fa-sack-dollar', couleur: '#e8a33d' },
  LD: { id: 'LD', nom: 'Conventions & partenariats', icone: 'fa-solid fa-handshake', couleur: '#e0637e' },
  LE: { id: 'LE', nom: 'Prestataires & outils métier', icone: 'fa-solid fa-screwdriver-wrench', couleur: '#2aa79b' },
  LF: { id: 'LF', nom: 'Identité visuelle & digital', icone: 'fa-solid fa-palette', couleur: '#c86ed0' },
  LG: { id: 'LG', nom: 'Déploiement & coordination', icone: 'fa-solid fa-rocket', couleur: '#e4772e' },
};

/* --------------------------------------------------------------------------
   Les 3 offres commerciales
   `lots` définit le périmètre couvert, donc les prestations activées
   et les modules accessibles dans l'application.
   -------------------------------------------------------------------------- */
const FORMULES = {
  F1: {
    code: 'F1',
    nom: 'Projet de santé',
    prixHT: 5900,
    prixLabel: 'À partir de 5 900 € HT',
    pitch: "Pour les équipes disposant déjà de leur organisation juridique et souhaitant construire ou refondre leur projet de santé.",
    lots: ['L0', 'LA'],
    dureeMois: 4,
    recommandee: false,
    couleur: '#1e95cb',
  },
  F2: {
    code: 'F2',
    nom: 'Création complète',
    prixHT: 8900,
    prixLabel: 'À partir de 8 900 € HT',
    pitch: "Pour les équipes qui souhaitent être accompagnées dans la création et la structuration globale de leur MSP ou Centre de santé.",
    lots: ['L0', 'LA', 'LB', 'LC', 'LD', 'LE'],
    dureeMois: 8,
    recommandee: true,
    couleur: '#a5c836',
  },
  F3: {
    code: 'F3',
    nom: 'Création & déploiement Premium',
    prixHT: 12500,
    prixLabel: 'À partir de 12 500 € HT',
    pitch: "L'accompagnement de A à Z pour les porteurs de projets souhaitant bénéficier d'un accompagnement élargi, de la conception jusqu'au déploiement.",
    lots: ['L0', 'LA', 'LB', 'LC', 'LD', 'LE', 'LF', 'LG'],
    dureeMois: 12,
    recommandee: false,
    couleur: '#7c6bd4',
  },
};

/* --------------------------------------------------------------------------
   Catalogue des prestations
   acteur : qui produit — 'expert', 'client' ou 'mixte'
   jours  : charge indicative, sert à l'ordonnancement du rétroplanning
   -------------------------------------------------------------------------- */
const PRESTATIONS = [
  /* --- LOT 0 : Cadrage & démarrage (toutes formules) --- */
  { id: 'P01', lot: 'L0', titre: 'Questionnaire de faisabilité', acteur: 'client', jours: 3,
    desc: "Recueil des informations sur l'équipe, le territoire et la maturité du projet.",
    livrable: 'Questionnaire complété' },
  { id: 'P02', lot: 'L0', titre: 'Rendez-vous découverte (visio)', acteur: 'mixte', jours: 2,
    desc: "Échange de cadrage avec l'expert : ambitions, contraintes, calendrier cible.",
    livrable: 'Compte rendu de cadrage' },
  { id: 'P03', lot: 'L0', titre: 'Validation du périmètre & de l\'offre', acteur: 'mixte', jours: 2,
    desc: "Choix de la formule d'accompagnement et validation du périmètre d'intervention.",
    livrable: 'Proposition commerciale signée' },
  { id: 'P04', lot: 'L0', titre: 'Signature du mandat d\'accompagnement', acteur: 'client', jours: 3,
    desc: "Signature électronique du devis et du mandat d'accompagnement ElodiaTech.",
    livrable: 'Mandat signé (eIDAS)' },
  { id: 'P05', lot: 'L0', titre: 'Ouverture de l\'espace client & du Drive', acteur: 'expert', jours: 1,
    desc: "Création de l'espace de suivi, de l’espace Documents et des accès de l'équipe.",
    livrable: 'Accès plateforme & Drive' },

  /* --- LOT A : Projet de santé (toutes formules) --- */
  { id: 'P06', lot: 'LA', titre: 'Diagnostic territorial', acteur: 'expert', jours: 10,
    desc: "Démographie médicale, zonage ARS (ZIP/ZAC), QPV, offre de soins existante, données INSEE et CartoSanté.",
    livrable: 'Rapport de diagnostic territorial' },
  { id: 'P07', lot: 'LA', titre: 'Analyse des besoins de santé', acteur: 'expert', jours: 8,
    desc: "Prévalence des pathologies, populations cibles, besoins non couverts, priorités de santé publique du territoire.",
    livrable: 'Note d\'analyse des besoins' },
  { id: 'P08', lot: 'LA', titre: 'Construction du projet de santé', acteur: 'mixte', jours: 15,
    desc: "Rédaction structurée du projet de santé conforme aux attendus HAS et au cahier des charges ARS.",
    livrable: 'Projet de santé (version de travail)' },
  { id: 'P09', lot: 'LA', titre: 'Axes stratégiques & plan d\'actions', acteur: 'mixte', jours: 6,
    desc: "Définition des axes prioritaires, des actions opérationnelles, des porteurs et des indicateurs de suivi.",
    livrable: 'Plan d\'actions pluriannuel' },
  { id: 'P10', lot: 'LA', titre: 'Organisation de l\'exercice coordonné', acteur: 'mixte', jours: 5,
    desc: "Réunions de concertation pluriprofessionnelle (RCP), protocoles pluriprofessionnels, parcours patients complexes.",
    livrable: 'Protocoles & modalités RCP' },
  { id: 'P11', lot: 'LA', titre: 'Accès aux soins', acteur: 'mixte', jours: 4,
    desc: "Amplitude horaire, soins non programmés, articulation avec le SAS et la régulation, réponse aux demandes urgentes.",
    livrable: 'Volet accès aux soins' },
  { id: 'P12', lot: 'LA', titre: 'Prévention', acteur: 'mixte', jours: 4,
    desc: "Actions de prévention et de dépistage, éducation thérapeutique du patient (ETP), promotion de la santé.",
    livrable: 'Programme de prévention' },
  { id: 'P13', lot: 'LA', titre: 'Travail en équipe', acteur: 'mixte', jours: 4,
    desc: "Composition de l'équipe, gouvernance, réunions d'équipe, accueil des stagiaires et des nouveaux professionnels.",
    livrable: 'Volet organisation d\'équipe' },
  { id: 'P14', lot: 'LA', titre: 'Partage d\'informations', acteur: 'mixte', jours: 4,
    desc: "Système d'information partagé labellisé Ségur, messagerie sécurisée MSSanté, Mon espace santé, conformité RGPD.",
    livrable: 'Volet système d\'information' },
  { id: 'P15', lot: 'LA', titre: 'Qualité & évaluation', acteur: 'expert', jours: 5,
    desc: "Démarche qualité, indicateurs de suivi, modalités d'évaluation annuelle et d'amélioration continue.",
    livrable: 'Dispositif qualité & indicateurs' },
  { id: 'P16', lot: 'LA', titre: 'Document finalisé', acteur: 'expert', jours: 5,
    desc: "Mise en forme, relecture, validation par l'équipe et production du document définitif transmissible à l'ARS.",
    livrable: 'Projet de santé finalisé (PDF)' },

  /* --- LOT B : Structuration juridique & dossier ARS (F2, F3) ---
     Les prestations suivent l'ordre réel des formalités : on constitue la
     personne morale, on écrit ses règles, puis on se déclare à l'ARS et on
     obtient son immatriculation.

     `types` restreint une prestation à un type de structure. L'engagement de
     conformité est propre aux centres de santé : il n'a pas à encombrer le
     suivi d'une maison de santé. */
  { id: 'P17', lot: 'LB', titre: 'Structuration SISA ou association 1901', acteur: 'expert', jours: 10,
    actes: true,
    desc: "Choix du véhicule juridique, rédaction des statuts et du règlement intérieur, préparation du dossier d'immatriculation.",
    livrable: 'Statuts & règlement intérieur' },
  /* La personne morale n'existe qu'une fois immatriculée (SISA) ou déclarée
     (association) : aucun dossier ARS ou CGSS ne se dépose avant. Chacune a son
     guichet en ligne, référencé par `portail` (voir PORTAILS).
     `modeles` restreint à une forme juridique quand elle est connue ; à défaut,
     `types` s'applique (SISA pour une MSP, association pour un centre de santé). */
  { id: 'P39', lot: 'LB', titre: 'Immatriculation de la SISA', acteur: 'expert', jours: 5,
    types: ['MSP'], modeles: ['sisa'], portail: 'guichet-unique', categorieDoc: 'Juridique',
    desc: "Télédéclaration de la SISA sur le guichet unique des formalités d'entreprises (INPI), "
        + "suivi de l'immatriculation au registre du commerce et des sociétés.",
    livrable: 'Extrait Kbis de la SISA' },
  { id: 'P40', lot: 'LB', titre: "Déclaration de l'association", acteur: 'expert', jours: 5,
    types: ['CDS'], modeles: ['assoc'], portail: 'e-creation', categorieDoc: 'Juridique',
    desc: "Déclaration de création de l'association par le téléservice e-création, publication au Journal "
        + "officiel des associations (JOAFE) et obtention du récépissé portant le numéro RNA.",
    livrable: 'Récépissé de déclaration (n° RNA)' },
  { id: 'P35', lot: 'LB', titre: 'Règlement de fonctionnement', acteur: 'expert', jours: 5,
    actes: true,
    // Le même document ne porte pas le même nom des deux côtés : règlement de
    // fonctionnement pour un centre de santé, charte interne pour une MSP.
    variantes: {
      MSP: { titre: 'Charte interne', livrable: 'Charte interne',
             desc: "Rédaction de la charte interne de la maison de santé : engagements réciproques de l'équipe, "
                 + "organisation du travail pluriprofessionnel, fonctionnement des instances et vie de la structure." },
    },
    desc: "Rédaction du règlement de fonctionnement : organisation interne, droits et obligations des usagers, "
        + "fonctionnement des instances, modalités d'accueil et de prise en charge.",
    livrable: 'Règlement de fonctionnement' },
  { id: 'P36', lot: 'LB', titre: "Engagement de conformité d'un centre de santé", acteur: 'expert', jours: 6,
    types: ['CDS'], actes: true, categorieDoc: 'ARS', prerequis: ['P44'],
    desc: "Constitution et dépôt de l'engagement de conformité au référentiel national, préalable obligatoire "
        + "à l'ouverture d'un centre de santé, accompagné du projet de santé et du règlement de fonctionnement.",
    livrable: 'Engagement de conformité déposé' },
  /* Loi n° 2023-378 du 19 mai 2023 : un centre de santé ayant une activité
     dentaire, ophtalmologique ou orthoptique doit obtenir l'agrément du
     directeur général de l'ARS avant d'ouvrir. Sans objet pour les autres :
     la prestation naît « Non nécessaire » (`statutDefaut`). */
  { id: 'P43', lot: 'LB', titre: 'Agrément des activités dentaire, ophtalmologique ou orthoptique', acteur: 'expert', jours: 8,
    types: ['CDS'], statutDefaut: 'bloque', portail: 'agrement-cds', categorieDoc: 'ARS',
    // La réponse du client au questionnaire, rappelée sur la carte : elle dit
    // à l'expert s'il faut passer la prestation « À faire ».
    repere: { rubrique: 'structure', champ: 'activites_agrement' },
    desc: "Obligatoire pour un centre de santé exerçant l'une de ces activités : demande d'agrément provisoire "
        + "avant l'ouverture (projet de santé, règlement de fonctionnement, déclarations de liens d'intérêts des "
        + "dirigeants, contrats avec des sociétés tierces). L'agrément devient définitif un an après l'ouverture.",
    livrable: 'Agrément provisoire de l\'ARS' },
  /* Jalon : tant qu'il n'est pas validé, les étapes qui engagent l'équipe
     devant l'ARS ou l'Assurance Maladie (`prerequis`) ne peuvent pas être
     soumises ni validées. L'expert le passe « Non nécessaire » pour lever la
     contrainte, par exemple quand l'équipe est réunie depuis le départ. */
  { id: 'P44', lot: 'LB', titre: 'Équipe médicale minimale réunie', acteur: 'client', jours: 1, jalon: true,
    variantes: {
      MSP: { desc: "Au moins deux médecins généralistes et un auxiliaire médical engagés, condition d'une SISA "
                 + "(art. L.4041-2 du Code de la santé publique) et du contrat ACI." },
    },
    desc: "Professionnels de santé recrutés ou engagés, au premier rang desquels le ou les médecins : "
        + "l'équipe doit être constituée avant la signature du projet de santé et les démarches auprès de l'ARS "
        + "et de l'Assurance Maladie.",
    livrable: "Liste des professionnels engagés (RPPS)" },
  { id: 'P38', lot: 'LB', titre: 'Signatures du projet de santé en ligne', acteur: 'mixte', jours: 3,
    actes: true, prerequis: ['P44'],
    desc: "Mise en signature électronique du projet de santé par l'ensemble des professionnels de l'équipe, "
        + "puis archivage de l'exemplaire signé.",
    livrable: 'Projet de santé signé par l\'équipe' },
  { id: 'P19', lot: 'LB', titre: 'Dépôt du projet de santé', acteur: 'expert', jours: 4,
    courriel: 'ars-premier-recours', courrielAvecProjetSante: true, prerequis: ['P44'],
    desc: "Transmission du projet de santé signé à l'ARS, suivi de l'instruction et réponses aux demandes "
        + "de compléments.",
    livrable: 'Accusé de dépôt ARS' },
  { id: 'P37', lot: 'LB', titre: 'Immatriculation FINESS', acteur: 'expert', jours: 5,
    courriel: 'finess-cgss',
    desc: "Demande d'inscription au répertoire FINESS (labellisation établissement médico-social) auprès de "
        + "l'ARS et du pôle établissement de l'Assurance Maladie, puis suivi de l'attribution du numéro.",
    livrable: 'Numéro FINESS attribué' },
  /* --- LOT C : Financements & subventions (F2, F3) ---
     L'ACI est une rémunération d'équipe versée par l'Assurance Maladie :
     sa place est parmi les financements, non dans la structuration juridique. */
  { id: 'P20', lot: 'LC', titre: 'Démarches ACI applicables', acteur: 'expert', jours: 6,
    types: ['MSP'], prerequis: ['P44'], reglementaire: true,
    desc: "Vérification de l'éligibilité à l'ACI, montage du contrat tripartite et dépôt auprès de la caisse "
        + "d'assurance maladie (CGSS dans les départements d'outre-mer).",
    livrable: 'Contrat ACI signé',
    // Circuit d'instruction, affiché dans le détail : la prestation reste une,
    // la note de suivi dit où en est le dossier.
    etapes: [
      "Vérification de l'éligibilité : SISA immatriculée, projet de santé transmis à l'ARS, système d'information labellisé, équipe réunie",
      'Montage du contrat tripartite et dépôt du dossier auprès de la caisse',
      'Réception et examen du dossier par la caisse',
      'Examen conjoint caisse – ARS (DCGDR et ARS)',
      'Décision : signature du contrat, ou refus motivé ouvrant une voie de recours',
    ] },
  { id: 'P41', lot: 'LC', titre: "Adhésion à l'accord national des centres de santé", acteur: 'expert', jours: 6,
    types: ['CDS'], prerequis: ['P44'], reglementaire: true,
    desc: "Adhésion du centre de santé à l'accord national (ANCS) qui régit ses relations avec l'Assurance Maladie "
        + "et ouvre droit à la rémunération forfaitaire : constitution et dépôt du dossier auprès de la caisse "
        + "(CGSS dans les départements d'outre-mer), suivi de l'instruction.",
    livrable: "Adhésion à l'accord national signée",
    etapes: [
      'Vérification des prérequis : engagement de conformité déposé, numéro FINESS attribué, équipe réunie',
      "Constitution et dépôt du dossier d'adhésion auprès de la caisse",
      'Instruction du dossier par la caisse',
      "Décision : signature de l'adhésion, ou refus motivé ouvrant une voie de recours",
    ] },
  /* France Santé : réseau national labellisé par l'ARS. La déclaration
     d'intention se dépose en ligne ; pour une MSP ou un centre de santé
     conventionné, elle vaut contractualisation avec la caisse pour la
     rémunération France Santé. */
  { id: 'P42', lot: 'LC', titre: 'Déclaration d\'intention France Santé', acteur: 'expert', jours: 3,
    portail: 'france-sante',
    desc: "Vérification des critères du label (médecin traitant, offre infirmière, ouverture cinq jours sur sept, "
        + "tarifs opposables, participation aux soins non programmés), dépôt de la déclaration d'intention en ligne, "
        + "suivi de l'instruction par l'ARS jusqu'au courrier de labellisation.",
    livrable: 'Courrier de labellisation France Santé' },

  { id: 'P21', lot: 'LC', titre: 'Identification des aides ARS', acteur: 'expert', jours: 5,
    desc: "Recensement des aides mobilisables (FIR, aides à l'installation, crédits d'amorçage) et montage des demandes.",
    livrable: 'Dossier de demande FIR' },
  { id: 'P22', lot: 'LC', titre: 'Opportunités FEDER si mobilisables', acteur: 'expert', jours: 8,
    desc: "Analyse d'éligibilité aux fonds européens, montage du dossier et dépôt sur le portail e-Synergie.",
    livrable: 'Dossier FEDER déposé' },

  /* --- LOT D : Conventions & partenariats (F2, F3) ---
     Une convention se signe, se relit et se conserve : les trois prestations
     portent donc les mêmes gestes que les actes juridiques. */
  { id: 'P23', lot: 'LD', titre: 'Conventions CCAS', acteur: 'expert', jours: 4,
    actes: true,
    desc: "Conventionnement avec le centre communal d'action sociale et les collectivités du territoire.",
    livrable: 'Convention CCAS signée' },
  { id: 'P24', lot: 'LD', titre: 'Conventions partenaires médicaux', acteur: 'expert', jours: 5,
    actes: true,
    desc: "Conventions avec les établissements hospitaliers, HAD, SSIAD, laboratoires et pharmacies partenaires.",
    livrable: 'Conventions partenaires' },
  { id: 'P25', lot: 'LD', titre: 'Partenariats prévention', acteur: 'expert', jours: 4,
    actes: true,
    desc: "Partenariats avec les acteurs de la prévention, associations de patients et réseaux de santé publique.",
    livrable: 'Conventions prévention' },

  /* --- LOT E : Prestataires & outils métier (F2, F3) --- */
  { id: 'P26', lot: 'LE', titre: 'Mise en relation expert-comptable', acteur: 'expert', jours: 2,
    desc: "Sélection d'un cabinet spécialisé SISA / structure de santé, cadrage de la mission comptable et sociale.",
    livrable: 'Devis expert-comptable' },
  { id: 'P27', lot: 'LE', titre: 'Prestataires logiciels médicaux', acteur: 'expert', jours: 4,
    desc: "Analyse des solutions labellisées Ségur, comparatif fonctionnel et financier adapté à la structure.",
    livrable: 'Comparatif logiciels' },
  { id: 'P28', lot: 'LE', titre: 'Organisation des démonstrations', acteur: 'expert', jours: 3,
    desc: "Planification et animation des démonstrations éditeurs avec l'équipe, aide à la décision finale.",
    livrable: 'Grille de décision éditeur' },

  /* --- LOT F : Identité visuelle & digital (F3) --- */
  { id: 'P29', lot: 'LF', titre: 'Création du logo', acteur: 'expert', jours: 6,
    declinaisons: true,
    desc: "Conception du logo de la structure, propositions, itérations et livraison des fichiers sources.",
    livrable: 'Logo (SVG, PNG, sources)' },
  { id: 'P30', lot: 'LF', titre: 'Charte graphique', acteur: 'expert', jours: 5,
    // Rien à signer, mais un document que le client doit pouvoir consulter.
    lien: true,
    desc: "Palette, typographies, règles d'usage et gabarits documentaires de la structure.",
    livrable: 'Charte graphique (PDF)' },
  { id: 'P31', lot: 'LF', titre: 'Identité visuelle & déclinaisons', acteur: 'expert', jours: 5,
    declinaisons: true,
    desc: "Signalétique, papeterie, plaquette patients, supports d'affichage et déclinaisons réseaux.",
    livrable: 'Kit de déclinaisons' },
  { id: 'P32', lot: 'LF', titre: 'Site internet professionnel', acteur: 'expert', jours: 15,
    desc: "Conception, rédaction, mise en ligne du site de la structure, mentions légales et conformité RGPD.",
    livrable: 'Site internet en ligne' },

  /* --- LOT G : Déploiement & coordination (F3) --- */
  { id: 'P33', lot: 'LG', titre: 'Accompagnement au déploiement', acteur: 'expert', jours: 12,
    desc: "Installation des outils, formation de l'équipe, procédures d'accueil et accompagnement à l'ouverture.",
    livrable: 'Plan de déploiement & formations' },
  { id: 'P34', lot: 'LG', titre: 'Coordination globale du projet', acteur: 'expert', jours: 20,
    desc: "Pilotage transverse, comités de suivi, interface avec l'ensemble des intervenants jusqu'à l'ouverture.",
    livrable: 'Comptes rendus de comités' },
];

/* --------------------------------------------------------------------------
   Modules de navigation
   formules : null = toutes ; sinon liste de codes formule
   roles    : rôles autorisés
   option   : le module dépend d'une option activable par l'expert
   -------------------------------------------------------------------------- */
const POLES = [
  { id: 'pilotage',  titre: 'Pilotage',                icone: 'fa-solid fa-gauge-high' },
  { id: 'ingenierie',titre: 'Ingénierie du projet',    icone: 'fa-solid fa-compass-drafting' },
  { id: 'guichets',  titre: 'Financements & partenaires', icone: 'fa-solid fa-sack-dollar' },
  { id: 'identite',  titre: 'Identité & déploiement',  icone: 'fa-solid fa-rocket' },
  { id: 'documents', titre: 'Documents & validation',  icone: 'fa-solid fa-folder-open' },
  { id: 'collab',    titre: 'Collaboration',           icone: 'fa-solid fa-users' },
  { id: 'support',   titre: 'Support',                 icone: 'fa-solid fa-circle-question' },
  { id: 'console',   titre: 'Console expert',          icone: 'fa-solid fa-user-gear' },
];

/** Anciennes adresses de modules, redirigées vers celles qui les remplacent. */
const ALIAS_MODULES = { planning: 'reunions', 'comptes-rendus': 'reunions' };

const MODULES = [
  { id: 'dashboard',    pole: 'pilotage',  label: "Vue d'ensemble",          icone: 'fa-solid fa-chart-pie',            formules: null },
  { id: 'feuille-route',pole: 'pilotage',  label: 'Feuille de route',        icone: 'fa-solid fa-list-check',           formules: null },
  // Les informations que le client fournit pour la rédaction du projet de santé.
  { id: 'questionnaire',pole: 'pilotage',  label: 'Informations du projet',  icone: 'fa-solid fa-clipboard-list',       formules: null },

  // Espace de travail de l'expert : collecte, rédaction, document final.
  { id: 'atelier',      pole: 'ingenierie',label: 'Atelier projet de santé', icone: 'fa-solid fa-pen-ruler',            formules: null, roles: ['expert'] },
  { id: 'projet-sante', pole: 'ingenierie',label: 'Projet de santé',         icone: 'fa-solid fa-book-medical',         formules: null,               lot: 'LA' },
  { id: 'juridique',    pole: 'ingenierie',label: 'Structuration juridique', icone: 'fa-solid fa-scale-balanced',       formules: ['F2', 'F3'],       lot: 'LB' },
  { id: 'immobilier',   pole: 'ingenierie',label: 'Immobilier, locaux & ERP',icone: 'fa-solid fa-building-circle-check',formules: ['F2', 'F3'],       option: 'immobilier' },

  // Guichets de dépôt, demandes et pièces justificatives : un seul espace.
  // Les séparer entretenait la confusion — Stars FIR et e-Synergie ne sont
  // rien d'autre que les portails par lesquels on demande une subvention.
  { id: 'financements', pole: 'guichets',  label: 'Financements & aides',    icone: 'fa-solid fa-sack-dollar',          formules: ['F2', 'F3'],       lot: 'LC' },
  { id: 'partenariats', pole: 'guichets',  label: 'Conventions & partenaires',icone: 'fa-solid fa-handshake',           formules: ['F2', 'F3'],       lot: 'LD' },
  { id: 'prestataires', pole: 'guichets',  label: 'Prestataires & outils',   icone: 'fa-solid fa-screwdriver-wrench',   formules: ['F2', 'F3'],       lot: 'LE' },

  { id: 'identite',     pole: 'identite',  label: 'Identité visuelle & web', icone: 'fa-solid fa-palette',              formules: ['F3'],             lot: 'LF' },
  { id: 'deploiement',  pole: 'identite',  label: 'Déploiement',             icone: 'fa-solid fa-rocket',               formules: ['F3'],             lot: 'LG' },

  { id: 'documents',    pole: 'documents', label: 'Documents',               icone: 'fa-solid fa-folder-open',          formules: null },
  { id: 'signatures',   pole: 'documents', label: 'Validation & signatures', icone: 'fa-solid fa-file-signature',       formules: null },
  // « Livrables » retiré : la feuille de route porte déjà chaque livrable, son
  // statut et son lien. Deux écrans pour la même information entretenaient le
  // doute sur celui qui faisait foi.

  { id: 'messagerie',   pole: 'collab',    label: 'Messagerie',              icone: 'fa-solid fa-comments',             formules: null },
  // Réunions : rendez-vous (lien Meet) et comptes rendus avec leurs décisions,
  // en un seul écran. Les échéances du projet restent dans la Feuille de route.
  { id: 'reunions',     pole: 'collab',    label: 'Réunions',                icone: 'fa-solid fa-people-group',         formules: null },

  { id: 'faq',          pole: 'support',   label: 'FAQ réglementaire',       icone: 'fa-solid fa-circle-question',      formules: null },

  { id: 'admin-projets',pole: 'console',   label: 'Portefeuille clients',    icone: 'fa-solid fa-address-card',         formules: null, roles: ['expert'] },
  { id: 'admin-offres', pole: 'console',   label: 'Offres & périmètres',     icone: 'fa-solid fa-tags',                 formules: null, roles: ['expert'] },
  { id: 'admin-experts',pole: 'console',   label: 'Équipe & société',        icone: 'fa-solid fa-user-tie',             formules: null, roles: ['expert'] },
  { id: 'admin-params', pole: 'console',   label: 'Paramètres & données',    icone: 'fa-solid fa-sliders',              formules: null, roles: ['expert'] },
];

/* --------------------------------------------------------------------------
   Référentiels réglementaires
   -------------------------------------------------------------------------- */

/** Les 5 chapitres structurants du projet de santé, reliés aux prestations. */
const CHAPITRES_PDS = [
  { num: '01', titre: 'Diagnostic territorial & besoins', prestations: ['P06', 'P07'],
    desc: "Démographie médicale, besoins de santé, prévalence des pathologies, périmètre ZIP / QPV." },
  { num: '02', titre: 'Accès aux soins & soins non programmés', prestations: ['P11'],
    desc: "Amplitude horaire, permanence des soins, articulation SAS et régulation." },
  { num: '03', titre: 'Exercice coordonné & RCP', prestations: ['P10', 'P13'],
    desc: "Concertation pluriprofessionnelle, protocoles délégués, parcours patients complexes." },
  { num: '04', titre: "Partage d'informations & système d'information", prestations: ['P14'],
    desc: "SI partagé labellisé Ségur, MSSanté, Mon espace santé, conformité RGPD." },
  { num: '05', titre: 'Prévention, qualité & évaluation', prestations: ['P12', 'P15'],
    desc: "Actions de prévention, ETP, indicateurs, évaluation annuelle des pratiques." },
];

/**
 * Chapitres rédigés avec Claude, dans l'ordre du plan ARS du projet de santé.
 * Doit concorder avec CHAPITRES_REDACTION du script (contrôlé par
 * tests/redaction.mjs) : le plan détaillé et le chapitre modèle restent côté
 * serveur. `prestations` passent « à valider » chez le client à la validation.
 */
const CHAPITRES_REDACTION = [
  { id: 'intro', titre: 'Introduction et préambule', prestations: [],
    resume: "Objet du document, porteur, territoire, cadre réglementaire ; genèse et démarche du projet." },
  { id: 'ch1', titre: '1. Diagnostic territorial et contexte sanitaire', prestations: ['P06', 'P07'],
    resume: "Territoire, population, ZIP / QPV, offre de soins, besoins — comparés au département, à la région et à la France." },
  { id: 'ch2', titre: "2. Organisation de l'exercice coordonné", prestations: ['P08', 'P09', 'P10'],
    resume: "Professionnels et partenaires, pilotage, objectifs, axes, actions, moyens, projet immobilier." },
  { id: 'ch3', titre: "3. Organisation de l'accès aux soins", prestations: ['P11', 'P12'],
    resume: "Accès et continuité, gestion des crises, permanence des soins, hors les murs, santé publique, qualité." },
  { id: 'ch4', titre: '4. Organisation du travail en équipe', prestations: ['P13', 'P15'],
    resume: "Coordination, protocoles et conventions, DPC, évaluation et amélioration continue, accueil d'étudiants." },
  { id: 'ch5', titre: "5. Partage d'informations", prestations: ['P14'],
    resume: "Entre professionnels, vers l'extérieur, accès du patient à ses données, communication externe." },
  { id: 'ch6', titre: '6. Signature du projet de santé et conclusion', prestations: [],
    resume: "Tableau des signataires, engagement collectif, conclusion." },
];

/**
 * Plateformes officielles à consulter pour chaque chapitre (étape « Collecte »
 * de l'Atelier). Les exports se déposent dans « Sources — <chapitre> ».
 * `{commune}` est remplacé par la commune du projet.
 */
const PLATEFORMES_SOURCES = {
  intro: [
    { nom: 'Légifrance — Code de la santé publique', url: 'https://www.legifrance.gouv.fr/', quoi: 'Articles cités (L.6323-1, L.6323-3, L.1411-11-1)' },
  ],
  ch1: [
    { nom: 'INSEE — dossier complet de la commune', url: 'https://www.insee.fr/fr/recherche?q={commune}', quoi: 'Population, âge, ménages, emploi, revenus (exporter le dossier complet en PDF)' },
    { nom: 'CartoSanté', url: 'https://cartosante.atlasante.fr/', quoi: 'Portrait de territoire : offre de soins, APL, recours, ALD' },
    { nom: 'ODISSÉ — Santé publique France', url: 'https://odisse.santepubliquefrance.fr/', quoi: 'Indicateurs de santé (mortalité, pathologies, prévention)' },
    { nom: 'Observatoire des territoires', url: 'https://www.observatoire-des-territoires.gouv.fr/', quoi: 'Cartes et comparaisons territoriales' },
    { nom: 'SIG Ville — quartiers prioritaires', url: 'https://sig.ville.gouv.fr/', quoi: 'Présence ou non d\'un QPV' },
    { nom: 'Data Ameli — Assurance maladie', url: 'https://data.ameli.fr/', quoi: 'Pathologies, consommation de soins, effectifs de professionnels' },
    { nom: 'Santé publique France', url: 'https://www.santepubliquefrance.fr/', quoi: 'Baromètres, études régionales' },
    { nom: 'IEDOM', url: 'https://www.iedom.fr/', quoi: 'Contexte économique des outre-mer' },
  ],
  ch2: [
    { nom: 'Annuaire santé', url: 'https://annuaire.sante.fr/', quoi: 'RPPS et exercice des professionnels de l\'équipe' },
    { nom: 'FINESS', url: 'https://finess.esante.gouv.fr/', quoi: 'Établissements partenaires (CHU, SSIAD, EHPAD…)' },
    { nom: 'Ameli — exercice coordonné', url: 'https://www.ameli.fr/', quoi: 'Accord conventionnel interprofessionnel (ACI)' },
    { nom: 'AVECsanté', url: 'https://www.avecsante.fr/', quoi: 'Repères d\'organisation des MSP' },
    { nom: 'FNCS', url: 'https://www.fncs.org/', quoi: 'Repères des centres de santé' },
  ],
  ch3: [
    { nom: 'HAS', url: 'https://www.has-sante.fr/', quoi: 'Recommandations et protocoles de prise en charge' },
    { nom: 'Santé publique France', url: 'https://www.santepubliquefrance.fr/', quoi: 'Programmes de prévention et de dépistage' },
  ],
  ch4: [
    { nom: 'Agence nationale du DPC', url: 'https://www.agencedpc.fr/', quoi: 'Développement professionnel continu' },
    { nom: 'HAS', url: 'https://www.has-sante.fr/', quoi: 'Démarche qualité, indicateurs' },
    { nom: 'AVECsanté', url: 'https://www.avecsante.fr/', quoi: 'Protocoles pluriprofessionnels, coordination' },
  ],
  ch5: [
    { nom: 'Agence du numérique en santé', url: 'https://esante.gouv.fr/', quoi: 'Ségur, MSSanté, DMP / Mon espace santé' },
    { nom: 'CNIL', url: 'https://www.cnil.fr/', quoi: 'RGPD, données de santé' },
  ],
  ch6: [],
};

/** Site de l'ARS selon le département (zonage, permanence des soins). */
const ARS_SITES = {
  '971': 'https://www.guadeloupe.ars.sante.fr/', '972': 'https://www.martinique.ars.sante.fr/',
  '973': 'https://www.guyane.ars.sante.fr/', '974': 'https://www.lareunion.ars.sante.fr/', '976': 'https://www.mayotte.ars.sante.fr/',
};

/**
 * Document final : les chapitres validés réunis en un seul Google Docs
 * (page de garde, sommaire, pied de page). Validé, il devient le projet de
 * santé du client et soumet l'étape « Document finalisé ».
 */
const DOCUMENT_FINAL = { id: 'final', titre: 'Document final du projet de santé', prestations: ['P16'] };

/** Chapitre rédigé ou document final, par identifiant. */
function chapitreOuFinal(id) {
  return id === DOCUMENT_FINAL.id ? DOCUMENT_FINAL : CHAPITRES_REDACTION.find((c) => c.id === id);
}

/**
 * Actes et documents générés avec Claude à partir du projet de santé et des
 * sources officielles. Doit concorder avec ACTES_GENERES du script (contrôlé
 * par tests/actes.mjs) : le contenu attendu reste côté serveur.
 * `signature` : 'renforcee' (DocuSeal, WM Goodflag en secours), 'interne'
 * (outil ElodiaTech) ou 'aucune'. `types` / `modeles` : même règle que les
 * prestations.
 */
const ACTES_GENERES = [
  {id: "statuts_sisa",titre: "Statuts de la SISA",groupe: "Constitution",types: ["MSP"],modeles: ["sisa"],categorie: "Juridique",signature: "renforcee",prestation: "P17"},
  {id: "ri_sisa",titre: "Règlement intérieur de la SISA",groupe: "Constitution",types: ["MSP"],modeles: ["sisa"],categorie: "Juridique",signature: "interne",prestation: "P17"},
  {id: "statuts_assoc",titre: "Statuts de l'association gestionnaire",groupe: "Constitution",types: ["CDS"],modeles: ["assoc"],categorie: "Juridique",signature: "renforcee",prestation: "P17"},
  {id: "pacte_associes",titre: "Pacte d'associés",groupe: "Constitution",types: ["MSP"],categorie: "Juridique",signature: "renforcee",prestation: ""},
  {id: "charte_interne",titre: "Charte interne de la maison de santé",groupe: "Fonctionnement",types: ["MSP"],categorie: "Juridique",signature: "interne",prestation: "P35"},
  {id: "reglement_fonctionnement",titre: "Règlement de fonctionnement du centre de santé",groupe: "Fonctionnement",types: ["CDS"],categorie: "Juridique",signature: "interne",prestation: "P35"},
  {id: "organigramme",titre: "Organigramme et gouvernance",groupe: "Fonctionnement",categorie: "Projet",signature: "aucune",prestation: ""},
  {id: "adhesion_ancs",titre: "Demande d'adhésion à l'accord national des centres de santé",groupe: "Assurance Maladie et finances",types: ["CDS"],categorie: "Finances",signature: "renforcee",prestation: "P41"},
  {id: "budget",titre: "Budget prévisionnel et plan de financement",groupe: "Assurance Maladie et finances",categorie: "Finances",signature: "aucune",prestation: ""},
  {id: "convention_ccas",titre: "Convention avec le CCAS ou la collectivité",groupe: "Partenariats",categorie: "Partenariats",signature: "interne",prestation: "P23"},
  {id: "convention_hopital",titre: "Convention avec l'établissement de santé",groupe: "Partenariats",categorie: "Partenariats",signature: "renforcee",prestation: "P24"},
  {id: "convention_domicile",titre: "Convention avec un service à domicile (HAD, SSIAD)",groupe: "Partenariats",categorie: "Partenariats",signature: "interne",prestation: "P24"},
  {id: "convention_plateau",titre: "Convention avec un laboratoire, une pharmacie ou un cabinet de radiologie",groupe: "Partenariats",categorie: "Partenariats",signature: "interne",prestation: "P24"},
  {id: "convention_cpts",titre: "Convention avec la CPTS",groupe: "Partenariats",categorie: "Partenariats",signature: "interne",prestation: "P24"},
  {id: "convention_prevention",titre: "Convention de partenariat de prévention",groupe: "Partenariats",categorie: "Partenariats",signature: "interne",prestation: "P25"},
  {id: "contrat_medecin",titre: "Contrat de travail du médecin salarié",groupe: "Ressources humaines",types: ["CDS"],categorie: "Équipe",signature: "renforcee",prestation: ""},
  {id: "contrats_salaries",titre: "Contrat de travail d'un professionnel de santé salarié",groupe: "Ressources humaines",types: ["CDS"],categorie: "Équipe",signature: "renforcee",prestation: ""},
  {id: "mise_a_disposition",titre: "Convention de mise à disposition des locaux",groupe: "Locaux",categorie: "Immobilier",signature: "renforcee",prestation: ""},
  {id: "cahier_locaux",titre: "Cahier des charges des locaux",groupe: "Locaux",categorie: "Immobilier",signature: "aucune",prestation: ""},
  {id: "rapport_annuel",titre: "Rapport annuel d'activité",groupe: "Suivi",categorie: "Projet",signature: "interne",prestation: ""},
  {id: "avenant_pds",titre: "Avenant au projet de santé",groupe: "Suivi",categorie: "Projet",signature: "interne",prestation: ""},

];

const SIGNATURES_ACTE = {
  renforcee: { label: 'Signature renforcée', detail: 'DocuSeal, WM Goodflag en secours' },
  interne:   { label: 'Signature interne', detail: 'outil de signature ElodiaTech' },
  aucune:    { label: 'Sans signature', detail: '' },
};

/** États d'un chapitre en rédaction. */
const STATUTS_REDACTION = {
  '':       { label: 'À rédiger',          couleur: 'neutre', icone: 'fa-regular fa-circle' },
  en_cours: { label: 'Rédaction en cours', couleur: 'info',   icone: 'fa-solid fa-spinner fa-spin' },
  pret:     { label: 'Brouillon prêt',     couleur: 'warn',   icone: 'fa-solid fa-file-pen' },
  valide:   { label: 'Validé',             couleur: 'ok',     icone: 'fa-solid fa-circle-check' },
  erreur:   { label: 'Échec',              couleur: 'danger', icone: 'fa-solid fa-triangle-exclamation' },
};

/**
 * Pièces à réunir pour les demandes d'aides et le dossier ARS.
 *
 * `par` désigne qui fournit la pièce : le client détient les documents de sa
 * structure, ElodiaTech produit ceux qu'il rédige.
 * `pour` indique à quel dossier elle sert, ce qui évite de la redemander.
 */
const PIECES_DOSSIER = [
  { id: 'D01', nom: 'Kbis ou récépissé de déclaration', cat: 'Juridique', par: 'client', pour: ['ARS', 'FIR', 'FEDER', 'ACI', 'ANCS'],
    aide: "Extrait Kbis pour une SISA (guichet unique de l'INPI), récépissé portant le numéro RNA pour une association (téléservice e-création)." },
  { id: 'D02', nom: 'Statuts signés de la structure', cat: 'Juridique', par: 'expert', pour: ['ARS', 'FIR', 'FEDER'],
    aide: "Rédigés par ElodiaTech, signés par les associés." },
  { id: 'D03', nom: 'RIB professionnel de la structure', cat: 'Finances', par: 'client', pour: ['FIR', 'FEDER', 'ACI'],
    aide: "Au nom de la structure, pas d'un professionnel à titre personnel." },
  { id: 'D04', nom: 'Titre de propriété ou bail commercial', cat: 'Immobilier', par: 'client', pour: ['ARS', 'FEDER'],
    aide: "Le bail doit couvrir la durée d'engagement demandée par le financeur." },
  { id: 'D05', nom: 'Attestation RC professionnelle', cat: 'Juridique', par: 'client', pour: ['ARS'],
    aide: "Attestation en cours de validité, délivrée par votre assureur." },
  { id: 'D06', nom: 'Liste des professionnels (RPPS / ADELI)', cat: 'Équipe', par: 'client', pour: ['ARS', 'ACI', 'ANCS', 'FRANCE_SANTE'],
    aide: "Nom, profession et numéro d'identification de chaque professionnel associé." },
  { id: 'D07', nom: 'Projet de santé validé', cat: 'Projet', par: 'expert', pour: ['ARS', 'FIR', 'ACI', 'ANCS'],
    aide: "Produit par ElodiaTech, validé par votre équipe." },
  { id: 'D08', nom: 'Budget prévisionnel & plan de financement', cat: 'Finances', par: 'expert', pour: ['FIR', 'FEDER'],
    aide: "Monté par ElodiaTech à partir de vos devis." },
  { id: 'D09', nom: 'Devis des prestataires', cat: 'Finances', par: 'client', pour: ['FIR', 'FEDER'],
    aide: "Travaux, équipement médical, mobilier, logiciel métier." },
  { id: 'D10', nom: 'Attestation de régularité fiscale et sociale', cat: 'Juridique', par: 'client', pour: ['FIR', 'FEDER'],
    aide: "À demander à votre service des impôts et à l'URSSAF." },
  { id: 'D11', nom: 'Diagnostic accessibilité PMR / attestation ERP', cat: 'Immobilier', par: 'client', pour: ['ARS', 'FEDER'],
    aide: "Établi par le bureau de contrôle lors de la mise en conformité des locaux." },
  { id: 'D12', nom: "Lettre d'engagement de l'équipe", cat: 'Équipe', par: 'client', pour: ['ARS', 'ACI'],
    aide: "Signée par l'ensemble des professionnels engagés dans le projet." },
];

/**
 * Indicatifs proposés dans la fiche client.
 * Le premier de la liste sert de valeur par défaut.
 */
const INDICATIFS = [
  { code: '596', label: 'Martinique (+596)' },
  { code: '590', label: 'Guadeloupe, Saint-Martin, Saint-Barthélemy (+590)' },
  { code: '594', label: 'Guyane (+594)' },
  { code: '262', label: 'La Réunion, Mayotte (+262)' },
  { code: '33',  label: 'France métropolitaine (+33)' },
  { code: '1',   label: 'Amérique du Nord et Caraïbes (+1)' },
];

/**
 * Numéro au format international, sans séparateur, pour un lien wa.me.
 * Renvoie une chaîne vide si le numéro est inexploitable : mieux vaut ne rien
 * proposer qu'un lien qui aboutit chez un inconnu.
 */
function numeroInternational(numero, indicatif) {
  const brut = String(numero || '').trim();
  if (!brut) return '';

  // Déjà international : on le prend tel quel.
  if (/^(\+|00)/.test(brut)) {
    const chiffres = brut.replace(/^00/, '').replace(/[^0-9]/g, '');
    return chiffres.length >= 8 ? chiffres : '';
  }

  const pays = String(indicatif || INDICATIFS[0].code).replace(/[^0-9]/g, '');
  const national = brut.replace(/[^0-9]/g, '').replace(/^0+/, '');
  if (!pays || national.length < 6) return '';
  return pays + national;
}

/** Dossiers auxquels une pièce peut servir. */
const DOSSIERS_AIDE = {
  ARS:   { id: 'ARS',   label: "Autorisation ARS",       couleur: 'purple' },
  FIR:   { id: 'FIR',   label: 'Subvention FIR',         couleur: 'brand' },
  FEDER: { id: 'FEDER', label: 'Fonds européens FEDER',  couleur: 'info' },
  ACI:   { id: 'ACI',   label: 'Contrat ACI',            couleur: 'ok' },
  ANCS:  { id: 'ANCS',  label: 'Accord national CDS',    couleur: 'ok' },
  FRANCE_SANTE: { id: 'FRANCE_SANTE', label: 'Label France Santé', couleur: 'brand' },
};

/** Cahier des charges ERP — 19 critères en 4 groupes. */
const CAHIER_ERP = [
  { groupe: 'Flux, ERP & accessibilité', icone: 'fa-solid fa-route', couleur: '#1e95cb', criteres: [
    "Gestion des flux patients (marche en avant)",
    "Accessibilité PMR (rampes, portes 90 cm)",
    "Normes ERP catégorie 5",
    "Confidentialité acoustique (R'w 45 dB)",
    "Évolutivité des locaux (cloisons modulaires)",
  ]},
  { groupe: 'Espaces & salles médicales', icone: 'fa-solid fa-notes-medical', couleur: '#e8a33d', criteres: [
    "Boxes de pré-consultation",
    "Salle de soins d'urgence & pansements",
    "Salle de télémédecine équipée",
    "Salle du personnel / réunions RCP",
    "Local DASRI ventilé & sécurisé",
    "Local ménage & produits d'entretien",
    "Zones de stockage du matériel médical",
  ]},
  { groupe: 'Sécurité & protection', icone: 'fa-solid fa-shield-halved', couleur: '#e0637e', criteres: [
    "Vidéosurveillance des zones publiques",
    "Contrôle d'accès (badges / digicode)",
    "Sécurité incendie (extincteurs, BAES, SSI)",
  ]},
  { groupe: 'Infrastructure IT & télécom', icone: 'fa-solid fa-network-wired', couleur: '#7c6bd4', criteres: [
    "Baie informatique ventilée & ondulée",
    "Réseau RJ45 catégorie 6A",
    "Fibre professionnelle avec secours 4G",
    "Wi-Fi sécurisé (VLAN pro / patients)",
  ]},
];

/**
 * Liens vers les portails institutionnels.
 * `formules` : formules dont le module « Financements & aides » affiche le
 * portail ; un portail référencé par une prestation (`portail`) s'affiche
 * aussi sur sa carte, quelle que soit la page.
 */
const PORTAILS = [
  { id: 'stars-fir', nom: 'Stars FIR (ARS)', desc: "Dépôt des demandes de subvention au titre du Fonds d'intervention régional.",
    couleur: '#7c6bd4', formules: ['F2', 'F3'], liens: [
      { label: 'Créer un compte', url: 'https://www.stars-fir.fr/starsfir/servlet/creationComptePopup.html', primaire: true },
      { label: 'Se connecter', url: 'https://www.stars-fir.fr/starsfir/servlet/login.html' },
    ]},
  { id: 'e-synergie', nom: 'e-Synergie (FEDER)', desc: "Portail de dépôt des demandes de fonds européens (FEDER / FSE+).",
    couleur: '#1e95cb', formules: ['F2', 'F3'], liens: [
      { label: 'Compte association', url: 'https://synergie-europe.fr/e_synergie/inscription.do?typeTiers=association', primaire: true },
      { label: 'Compte entreprise / SISA', url: 'https://synergie-europe.fr/e_synergie/inscription.do?typeTiers=entreprise' },
    ]},
  { id: 'france-sante', nom: 'France Santé', desc: "Déclaration d'intention de participation à France Santé, instruite par l'ARS.",
    couleur: '#a5c836', formules: ['F2', 'F3'], liens: [
      { label: 'Déposer la déclaration', url: 'https://demarche.numerique.gouv.fr/commencer/declaration-d-intention-france-sante', primaire: true },
    ]},
  { id: 'guichet-unique', nom: "Guichet unique des formalités d'entreprises (INPI)",
    desc: "Immatriculation de la SISA au registre du commerce et des sociétés.",
    couleur: '#7c6bd4', formules: [], liens: [
      { label: 'Ouvrir le guichet unique', url: 'https://formalites.entreprises.gouv.fr/', primaire: true },
    ]},
  { id: 'e-creation', nom: 'e-création (service-public.gouv.fr)',
    desc: "Déclaration de création d'une association et demande de publication au JOAFE.",
    couleur: '#7c6bd4', formules: [], liens: [
      { label: 'Déclarer l\'association', url: 'https://demarches.service-public.gouv.fr/asso_mademarche/CR/demarche', primaire: true },
      { label: 'Fiche pratique', url: 'https://www.service-public.gouv.fr/associations/vosdroits/F1119' },
    ]},
  { id: 'agrement-cds', nom: 'Agrément des centres de santé', desc: "Demande d'agrément provisoire d'un centre de santé (activités dentaire, ophtalmologique, orthoptique).",
    couleur: '#7c6bd4', formules: [], liens: [
      { label: 'Déposer la demande', url: 'https://demarche.numerique.gouv.fr/commencer/agrement-centres-de-sante', primaire: true },
    ]},
];

/**
 * Étapes qui suivent la dernière prestation du catalogue, communes à toutes
 * les formules : l'ouverture, puis les obligations qui durent autant que la
 * structure. `types` limite une étape à un type de structure.
 */
const APRES_PERIMETRE = {
  ouverture: "Ouverture effective de la structure et démarrage de l'exercice coordonné",
  suivi: [
    { titre: 'Déclaration annuelle des indicateurs ACI', types: ['MSP'],
      detail: "Chaque année, auprès de la caisse : elle conditionne le versement de la rémunération d'équipe." },
    { titre: "Déclaration annuelle des indicateurs de l'accord national", types: ['CDS'],
      detail: "Chaque année, auprès de la caisse : elle conditionne le versement de la rémunération forfaitaire." },
    { titre: "Agrément définitif de l'ARS", types: ['CDS'],
      detail: "Pour une activité dentaire, ophtalmologique ou orthoptique : l'agrément provisoire devient définitif un an après l'ouverture." },
    { titre: 'Évaluation annuelle du projet de santé',
      detail: "Bilan des actions et des indicateurs, présenté à l'équipe et tenu à la disposition de l'ARS." },
    { titre: 'Actualisation du projet de santé',
      detail: "Mise à jour à chaque évolution de l'équipe ou de l'organisation, et révision d'ensemble périodique (généralement tous les cinq ans)." },
  ],
};

/**
 * Guichets qui reçoivent un dossier par courriel, référencés par la clé
 * `courriel` d'une prestation.
 *
 * Adresses valables pour la Martinique. Pour un autre territoire, ajoutez une
 * entrée ici et renseignez sa clé sur la prestation — l'interface suit, elle
 * ne devine rien.
 */
const GUICHETS_COURRIEL = {
  'ars-premier-recours': {
    libelle: 'ARS Martinique — pôle premier recours',
    adresse: 'ars-martinique-premier-recours@ars.sante.fr',
    aide: "Le projet de santé signé se dépose par courriel auprès de ce pôle.",
  },
  'finess-cgss': {
    libelle: 'CGSS Martinique — pôle établissement',
    adresse: 'jessica.ramanich@cgss-martinique.fr',
    aide: "La demande d'immatriculation FINESS se fait par courriel auprès de ce contact.",
  },
};

/**
 * Parapheur électronique d'ElodiaTech.
 * L'expert y prépare la demande de signature, puis colle le lien obtenu dans
 * l'acte correspondant ci-dessous : le client le voit alors dans son espace.
 * Réservé à l'expert — un client n'a jamais à connaître cet outil.
 *
 * Vérifié le 3 août 2026 : le site répond `x-frame-options: sameorigin`, donc
 * l'aperçu intégré (`boutonApercu`) ne peut pas l'afficher. Il s'ouvre en
 * onglet, et ce n'est pas un défaut à corriger côté application.
 */
const PARAPHEUR = {
  nom: 'WM Goodflag',
  url: 'https://wm.goodflag.community/#/home/',
  desc: "Espace de préparation des demandes de signature électronique : on y dépose l'acte, "
      + "on désigne les signataires, et l'on récupère le lien de signature à transmettre.",
  icone: 'fa-solid fa-file-signature',
};

/** Modèles juridiques proposés. */
const MODELES_JURIDIQUES = {
  sisa: {
    id: 'sisa', nom: 'SISA', libelle: 'Société interprofessionnelle de soins ambulatoires',
    cible: 'Maison de santé pluriprofessionnelle (MSP)', icone: 'fa-solid fa-building-user',
    repere: "La SISA est le seul véhicule permettant à une maison de santé de percevoir les "
          + "rémunérations d'équipe versées au titre de l'accord conventionnel interprofessionnel (ACI).",
    points: [
      "Permet de percevoir les rémunérations d'équipe (ACI)",
      "Au moins 2 médecins et 1 auxiliaire médical associés",
      "Immatriculation au RCS et dépôt des statuts à l'ARS",
      "Comptabilité commerciale et assemblée générale annuelle",
    ],
  },
  assoc: {
    id: 'assoc', nom: 'Association loi 1901', libelle: 'Association déclarée à but non lucratif',
    cible: 'Centre de santé (CDS)', icone: 'fa-solid fa-people-group',
    repere: "L'association loi 1901 est la forme la plus courante pour porter un centre de santé, "
          + "dont les professionnels sont salariés de la structure gestionnaire.",
    points: [
      "Structure gestionnaire employant des professionnels salariés",
      "Déclaration en préfecture et publication au JOAFE",
      "Engagement conventionnel avec l'Assurance Maladie",
      "Gouvernance associative : bureau, conseil d'administration",
    ],
  },
};

/** FAQ réglementaire. */
const FAQ = [
  { q: "Quelle formule choisir pour ma structure ?", cat: 'Offre',
    r: "La Formule 1 convient si votre structure juridique existe déjà et que seul le projet de santé est à produire. La Formule 2 couvre la création complète (juridique, ARS, financements, partenariats). La Formule 3 ajoute l'identité visuelle, le site internet et l'accompagnement au déploiement jusqu'à l'ouverture." },
  { q: "Mon centre de santé relève-t-il de l'ACI ?", cat: 'Financement',
    r: "Non : l'ACI concerne les maisons de santé constituées en SISA. Un centre de santé adhère à l'accord national des centres de santé (ANCS), auprès de la caisse d'assurance maladie (CGSS dans les départements d'outre-mer), qui ouvre droit à sa propre rémunération forfaitaire." },
  { q: "Qu'est-ce que le label France Santé ?", cat: 'Financement',
    r: "Un réseau national de structures de proximité labellisées par l'ARS. La participation se déclare en ligne (« Déclaration d'intention de participation à France Santé ») ; pour une MSP ou un centre de santé conventionné, cette déclaration vaut contractualisation avec la caisse pour la rémunération France Santé. Les critères comprennent notamment un médecin traitant, une offre infirmière, une ouverture cinq jours sur sept, des tarifs opposables et la participation aux soins non programmés." },
  { q: "Mon centre de santé a une activité dentaire ou ophtalmologique : que faut-il de plus ?", cat: 'ARS',
    r: "Depuis la loi n° 2023-378 du 19 mai 2023, un centre de santé ayant une activité dentaire, ophtalmologique ou orthoptique doit obtenir un agrément du directeur général de l'ARS avant d'ouvrir. Cet agrément est d'abord provisoire et devient définitif un an après l'ouverture." },
  { q: "Comment percevoir la dotation ACI ?", cat: 'Financement',
    r: "Il faut réunir au moins deux médecins généralistes et un auxiliaire médical, disposer d'un système d'information partagé labellisé Ségur, être constitué en SISA et disposer d'un projet de santé validé par l'ARS. Le contrat ACI est ensuite signé avec la caisse d'assurance maladie (CGSS dans les départements d'outre-mer) et l'ARS." },
  { q: "Quelle différence entre une MSP et un centre de santé ?", cat: 'Juridique',
    r: "La MSP regroupe des professionnels libéraux qui restent indépendants, généralement en SISA. Le centre de santé emploie des professionnels salariés et est porté par une structure gestionnaire (association, mutuelle, collectivité). Le mode de financement et la gouvernance diffèrent." },
  { q: "Combien de temps dure l'instruction du dossier ARS ?", cat: 'ARS',
    r: "Le délai varie selon les régions, généralement de 3 à 6 mois après un dépôt complet. Les demandes de compléments suspendent le délai : la qualité initiale du dossier est déterminante." },
  { q: "Qu'est-ce que le zonage ZIP / ZAC ?", cat: 'ARS',
    r: "Le zonage ARS identifie les zones d'intervention prioritaire (ZIP) et les zones d'action complémentaire (ZAC) selon la densité de l'offre de soins. Il conditionne l'accès à plusieurs aides à l'installation et aux financements." },
  { q: "Le FEDER est-il mobilisable pour mon projet ?", cat: 'Financement',
    r: "Le FEDER peut financer l'investissement immobilier et l'équipement dans certaines régions et selon le programme opérationnel en vigueur. L'éligibilité est analysée au cas par cas ; le dépôt s'effectue sur le portail e-Synergie." },
  { q: "Qu'attend l'ARS dans le projet de santé ?", cat: 'Projet',
    r: "Un diagnostic territorial étayé, des objectifs mesurables, l'organisation de l'exercice coordonné (RCP, protocoles), les modalités d'accès aux soins, le partage d'informations sécurisé et un dispositif d'évaluation." },
  { q: "Comment se déroule la signature électronique ?", cat: 'Signature',
    r: "Les actes sont déposés sur un parapheur électronique. Chaque signataire s'authentifie, signe, puis reçoit le document horodaté et certifié eIDAS. L'original signé est archivé dans l’espace Documents du projet." },
  { q: "Quel logiciel médical choisir ?", cat: 'Outils',
    r: "Le logiciel doit être labellisé Ségur pour ouvrir droit aux financements et permettre le partage d'informations. La sélection s'appuie sur un comparatif fonctionnel et des démonstrations organisées avec l'équipe." },
  { q: "Que se passe-t-il après l'ouverture de la structure ?", cat: 'Déploiement',
    r: "Le projet de santé fait l'objet d'une évaluation annuelle, les indicateurs ACI (MSP) ou de l'accord national (centre de santé) sont déclarés chaque année et le projet doit être actualisé, généralement tous les cinq ans. Ces étapes figurent en fin de feuille de route, quelle que soit la formule." },
];

/** Catégories de documents de l’espace Documents. */
const CATEGORIES_DOC = ['Projet', 'Juridique', 'ARS', 'Finances', 'Immobilier', 'Équipe', 'Partenariats', 'Identité'];

/**
 * Plafond du dépôt direct, en octets.
 * Doit rester égal à `TAILLE_MAX_OCTETS` dans `apps-script/Code.gs` : le script
 * refuse de toute façon au-delà, autant l'annoncer avant l'envoi. Un fichier
 * plus lourd se dépose dans le Drive, puis se référence par son lien.
 */
const TAILLE_MAX_DEPOT = 10 * 1024 * 1024;

/**
 * Canaux d'échange avec le client.
 * Un échange se programme dans le planning, puis se consigne dans les comptes
 * rendus : le canal est le même de bout en bout.
 *
 * `lien` décrit ce qu'on attend dans le champ adresse, `action` le libellé du
 * bouton proposé au client.
 */
const CANAUX = {
  visio: {
    id: 'visio', label: 'Visioconférence', court: 'Visio',
    icone: 'fa-solid fa-video', couleur: 'info', action: 'Rejoindre',
    lien: { requis: true, label: 'Lien Google Meet', exemple: 'https://meet.google.com/abc-defg-hij',
            aide: 'Depuis Google Agenda ou Meet : « Copier le lien de la visioconférence ».' },
  },
  telephone: {
    id: 'telephone', label: 'Entretien téléphonique', court: 'Téléphone',
    icone: 'fa-solid fa-phone', couleur: 'brand', action: 'Appeler',
    lien: { requis: false, label: 'Numéro à appeler', exemple: '0596 00 00 00',
            aide: 'Le client verra le numéro et pourra le composer d\'un clic depuis son téléphone.' },
  },
  whatsapp: {
    id: 'whatsapp', label: 'Échange WhatsApp', court: 'WhatsApp',
    icone: 'fa-brands fa-whatsapp', couleur: 'ok', action: 'Ouvrir WhatsApp',
    lien: { requis: false, label: 'Numéro WhatsApp', exemple: '0596 00 00 00',
            aide: 'Numéro au format local ou international : le lien wa.me est construit automatiquement.' },
  },
  presentiel: {
    id: 'presentiel', label: 'Rencontre sur site', court: 'Sur site',
    icone: 'fa-solid fa-users', couleur: 'accent', action: 'Voir le lieu',
    lien: { requis: false, label: 'Lien de la carte (facultatif)', exemple: 'https://maps.google.com/…',
            aide: 'Le lieu se saisit dans le champ précédent ; ce lien est optionnel.' },
  },
  ecrit: {
    id: 'ecrit', label: 'Échange écrit', court: 'Écrit',
    icone: 'fa-solid fa-envelope', couleur: 'neutre', action: '',
    lien: { requis: false, label: 'Lien (facultatif)', exemple: '', aide: '' },
  },
};

/** Conservé pour les comptes rendus : même référentiel que les canaux. */
const TYPES_ECHANGE = CANAUX;

/**
 * Nature d'une entrée du planning.
 * « echange » est le seul type qui porte un canal et concerne le client
 * directement ; les autres jalonnent le projet.
 */
const TYPES_EVENEMENT = {
  echange:   { id: 'echange',   label: 'Échange avec le client', icone: 'fa-solid fa-comments', avecCanal: true },
  jalon:     { id: 'jalon',     label: 'Jalon réglementaire',    icone: 'fa-solid fa-flag' },
  livrable:  { id: 'livrable',  label: 'Livraison',              icone: 'fa-solid fa-box' },
  formation: { id: 'formation', label: 'Formation',              icone: 'fa-solid fa-chalkboard-user' },
  // Ancien libellé, conservé pour les données déjà saisies.
  reunion:   { id: 'reunion',   label: 'Échange avec le client', icone: 'fa-solid fa-comments', avecCanal: true, ancien: true },
};

/** Un événement de ce type est un échange avec le client. */
function estUnEchange(type) {
  return type === 'echange' || type === 'reunion';
}

/**
 * Champs de la fiche client.
 * `groupe` structure le formulaire, `chemin` désigne l'emplacement de la
 * valeur dans l'objet projet (notation pointée pour les sous-objets).
 */
const FICHE_CLIENT = [
  { groupe: 'Structure', champs: [
    { chemin: 'nom',         label: 'Nom de la structure', type: 'text', requis: true, placeholder: 'MSP du Morne-Rouge' },
    { chemin: 'type',        label: 'Type', type: 'select', options: [
      { v: 'MSP', l: 'Maison de santé pluriprofessionnelle' },
      { v: 'CDS', l: 'Centre de santé' }] },
    { chemin: 'reference',   label: 'Référence interne', type: 'text', placeholder: 'MSP-972-0048' },
    { chemin: 'ville',       label: 'Commune', type: 'text', requis: true, placeholder: 'Le Morne-Rouge' },
    { chemin: 'departement', label: 'Territoire', type: 'text', placeholder: 'Martinique (972)' },
    { chemin: 'adresse',     label: 'Adresse', type: 'text', placeholder: '12 rue des Écoles, 97260…' },
  ]},
  { groupe: 'Porteur du projet', champs: [
    { chemin: 'client.nom',      label: 'Nom et prénom', type: 'text', requis: true, placeholder: 'Dr Marie Léger' },
    { chemin: 'client.fonction', label: 'Fonction', type: 'text', placeholder: 'Médecin généraliste · porteur du projet' },
    { chemin: 'client.email',    label: 'Courriel', type: 'email', placeholder: 'contact@exemple.fr' },
    // Sans indicatif, impossible de construire un lien WhatsApp valide :
    // un 06 métropolitain et un 0696 martiniquais ne se préfixent pas pareil.
    { chemin: 'client.indicatif', label: 'Indicatif pays', type: 'select', options: null },
    { chemin: 'client.tel',      label: 'Téléphone', type: 'text', placeholder: '0696 00 00 00' },
  ]},
  { groupe: 'Accompagnement', champs: [
    // Les options de ces deux listes sont remplies à l'ouverture du formulaire :
    // formules du catalogue, et experts déclarés dans l'équipe.
    { chemin: 'formule',        label: 'Formule souscrite', type: 'select', options: null },
    { chemin: 'consultant.nom', label: 'Référent ElodiaTech', type: 'select', options: null },
    { chemin: 'dateDebut',      label: 'Date de démarrage', type: 'date' },
  ]},
  { groupe: 'Cadrage', champs: [
    { chemin: 'equipe',  label: 'Professionnels dans l\'équipe', type: 'number', placeholder: '8' },
    { chemin: 'surface', label: 'Surface des locaux (m²)', type: 'number', placeholder: '240' },
    { chemin: 'notes',   label: 'Notes internes', type: 'textarea', placeholder: 'Contexte, points de vigilance, historique…' },
  ]},
];

/* ==========================================================================
   QUESTIONNAIRE — informations fournies par le client
   --------------------------------------------------------------------------
   Huit rubriques, renseignées par le client et complétables par l'expert.
   Les identifiants des rubriques et des champs doivent rester identiques à
   QUESTIONNAIRE_CHAMPS dans apps-script/Code.gs : le serveur refuse tout
   champ qu'il ne connaît pas.
   Types : texte, zone, choix, tableau (colonnes), fichiers (dépôt Drive).
   ========================================================================== */
const Q_OUI_NON = ['Oui', 'Non', 'En cours'];
const QUESTIONNAIRE = [
  {
    id: 'structure', titre: 'Votre structure', icone: 'fa-solid fa-hospital',
    aide: 'Le type de structure, sa forme juridique, le porteur du projet et le coordinateur.',
    champs: [
      { id: 'type', label: 'Type de structure', type: 'choix', requis: true,
        options: ['Maison de santé pluriprofessionnelle (MSP)', 'Centre de santé pluriprofessionnel', 'Centre de santé médical', 'Centre de santé dentaire', 'Centre de santé infirmier'] },
      { id: 'nom', label: 'Nom de la structure', type: 'texte', requis: true },
      { id: 'forme', label: 'Forme juridique', type: 'choix',
        options: ['SISA', 'SISA en cours de constitution', 'Association loi 1901', 'SCIC', 'Collectivité territoriale', 'Mutuelle', 'Autre', 'Je ne sais pas encore'] },
      { id: 'commune', label: "Commune d'implantation principale", type: 'texte', requis: true },
      { id: 'activites_agrement', label: 'Activité dentaire, ophtalmologique ou orthoptique prévue', type: 'choix',
        options: ['Oui', 'Non', 'Je ne sais pas'] },
      { id: 'porteur', label: 'Porteur du projet (nom, profession)', type: 'texte', requis: true },
      { id: 'coordinateur', label: 'Coordinateur pressenti (nom, fonction)', type: 'texte' },
      { id: 'coord_contact', label: 'Coordonnées du coordinateur (courriel, téléphone)', type: 'texte' },
    ],
  },
  {
    id: 'equipe', titre: 'Professionnels impliqués', icone: 'fa-solid fa-user-doctor',
    aide: 'Chaque professionnel engagé dans le projet, son statut et son rôle.',
    champs: [
      { id: 'pros', label: 'Professionnels', type: 'tableau', requis: true, ligne: 'Professionnel',
        colonnes: [
          { id: 'nom', label: 'Nom' }, { id: 'prenom', label: 'Prénom' },
          { id: 'email', label: 'Courriel' }, { id: 'tel', label: 'Téléphone' },
          { id: 'profession', label: 'Profession', options: ['Médecin généraliste', 'Médecin spécialiste', 'Infirmier(ère)', 'IPA', 'Pharmacien(ne)', 'Masseur-kinésithérapeute', 'Sage-femme', 'Chirurgien-dentiste', 'Orthophoniste', 'Podologue', 'Diététicien(ne)', 'Psychologue', 'Orthoptiste', 'Secrétaire médical(e)', 'Coordinateur(trice)', 'Autre'] },
          { id: 'site', label: 'Site' },
          { id: 'statut', label: 'Statut', options: ['Associé', 'Salarié', 'Collaborateur', 'Partenaire externe', 'En cours de recrutement'] },
          { id: 'etp', label: 'Temps (ETP)' },
          { id: 'role', label: 'Rôle dans le projet' },
          { id: 'engagement', label: 'Engagement', options: ['Confirmé', 'En cours', 'Pressenti'] },
        ] },
      { id: 'secretariat', label: 'Secrétariat et accueil (organisation, temps)', type: 'zone' },
    ],
  },
  {
    id: 'assistants', titre: 'Assistants médicaux', icone: 'fa-solid fa-user-nurse',
    aide: "La présence d'assistants médicaux, ou votre souhait d'en recruter.",
    champs: [
      { id: 'presence', label: "Des assistants médicaux travaillent-ils (ou travailleront-ils) dans la structure ?", type: 'choix', requis: true,
        options: ['Oui', 'Non', 'Recrutement souhaité'] },
      { id: 'liste', label: 'Assistants médicaux', type: 'tableau', ligne: 'Assistant(e)',
        colonnes: [{ id: 'nom', label: 'Nom' }, { id: 'medecin', label: 'Médecin(s) rattaché(s)' }, { id: 'etp', label: 'Temps (ETP)' },
          { id: 'date', label: "Date d'embauche" }, { id: 'aide', label: "Aide à l'emploi", options: ['Obtenue', 'Demandée', 'À demander', 'Je ne sais pas'] }] },
    ],
  },
  {
    id: 'locaux', titre: 'Adresses et locaux', icone: 'fa-solid fa-building',
    aide: "Vos sites d'exercice, le plan des locaux et, le cas échéant, votre projet immobilier.",
    champs: [
      { id: 'sites', label: "Sites d'exercice", type: 'tableau', requis: true, ligne: 'Site',
        colonnes: [{ id: 'nom', label: 'Nom du site' }, { id: 'adresse', label: 'Adresse' }, { id: 'cp', label: 'Code postal' },
          { id: 'commune', label: 'Commune' }, { id: 'acces', label: 'Étage, accès' }] },
      { id: 'plan', label: 'Plan des locaux', type: 'fichiers', categorie: 'Immobilier', requis: true },
      { id: 'occupation', label: "Mode d'occupation", type: 'choix', options: ['Propriété', 'Location', 'Mise à disposition par la collectivité', 'Mise à disposition (autre)', 'Mixte'] },
      { id: 'surface', label: 'Surface totale (m²)', type: 'texte' },
      { id: 'pieces', label: "Composition des locaux (cabinets, salle d'attente, salle de soins, salle de réunion…)", type: 'zone' },
      { id: 'pmr', label: 'Accessibilité aux personnes à mobilité réduite', type: 'choix', options: ['Conforme', 'Partiellement conforme', 'Non conforme', 'Je ne sais pas'] },
      { id: 'projet_immo', label: 'Projet immobilier (construction, extension, calendrier)', type: 'zone' },
    ],
  },
  {
    id: 'horaires', titre: "Horaires d'ouverture", icone: 'fa-solid fa-clock',
    aide: "Les horaires d'ouverture de chaque site, par exemple « 7 h – 12 h / 14 h – 19 h ».",
    champs: [
      { id: 'horaires', label: 'Horaires par site', type: 'tableau', requis: true, ligne: 'Site',
        colonnes: [{ id: 'site', label: 'Site' }, { id: 'lun', label: 'Lundi' }, { id: 'mar', label: 'Mardi' }, { id: 'mer', label: 'Mercredi' },
          { id: 'jeu', label: 'Jeudi' }, { id: 'ven', label: 'Vendredi' }, { id: 'sam', label: 'Samedi' }] },
      { id: 'precisions', label: 'Précisions (fermetures, consultations sans rendez-vous, gardes)', type: 'zone' },
    ],
  },
  {
    id: 'axes', titre: 'Axes du projet de santé', icone: 'fa-solid fa-bullseye',
    aide: 'Proposez les axes de votre projet, ou laissez ElodiaTech vous en proposer à partir du diagnostic du territoire.',
    champs: [
      { id: 'choix', label: 'Comment souhaitez-vous définir les axes ?', type: 'choix', requis: true,
        options: ['Je propose les axes de mon projet', "Je souhaite qu'ElodiaTech me propose des axes", 'Je propose des pistes, à compléter par ElodiaTech'] },
      { id: 'axes', label: 'Axes envisagés', type: 'tableau', ligne: 'Axe', long: true,
        colonnes: [{ id: 'intitule', label: "Intitulé de l'axe" }, { id: 'constat', label: 'Pourquoi cet axe (besoin constaté)', long: true },
          { id: 'actions', label: 'Actions envisagées', long: true }, { id: 'public', label: 'Patients concernés' }] },
      { id: 'valeurs', label: "Valeurs et principes de l'équipe", type: 'zone' },
    ],
  },
  {
    id: 'moyens', titre: 'Moyens financiers et matériels', icone: 'fa-solid fa-coins',
    aide: 'Votre plan de financement et vos équipements. Les montants non confirmés seront signalés comme tels.',
    champs: [
      { id: 'plan_fin', label: 'Plan de financement', type: 'tableau', requis: true, ligne: 'Financement',
        colonnes: [{ id: 'financeur', label: 'Financeur' }, { id: 'dispositif', label: 'Dispositif' }, { id: 'montant', label: 'Montant (€)' },
          { id: 'objet', label: 'Objet' }, { id: 'statut', label: 'Statut', options: ['Obtenu', 'Demandé', 'À solliciter', 'À confirmer'] }] },
      { id: 'aci', label: 'ACI (maison de santé) ou accord national des centres de santé', type: 'choix', options: ['Signé', 'Signature prévue', 'Non concerné', 'Je ne sais pas'] },
      { id: 'france_sante', label: 'Label France Santé', type: 'choix', options: ['Label obtenu', 'Déclaration déposée', 'Non engagé', 'Je ne sais pas'] },
      { id: 'apports', label: 'Apports des associés, de la collectivité ou de partenaires', type: 'zone' },
      { id: 'docs_fin', label: 'Budget prévisionnel, plan de financement, bilans', type: 'fichiers', categorie: 'Finances' },
      { id: 'equipements', label: 'Équipements (acquis ou à acquérir)', type: 'tableau', requis: true, ligne: 'Équipement',
        colonnes: [{ id: 'equipement', label: 'Équipement' }, { id: 'quantite', label: 'Quantité' }, { id: 'site', label: 'Site' },
          { id: 'statut', label: 'Statut', options: ['Acquis', 'À acquérir'] }] },
      { id: 'materiel_note', label: 'Précisions sur le matériel (mutualisation, télémédecine…)', type: 'zone' },
    ],
  },
  {
    id: 'logiciel', titre: 'Logiciel médical', icone: 'fa-solid fa-laptop-medical',
    aide: 'Votre logiciel métier et vos outils numériques.',
    champs: [
      { id: 'logiciel', label: 'Logiciel médical (dossier patient)', type: 'texte', requis: true },
      { id: 'rdv', label: 'Prise de rendez-vous en ligne (plateforme)', type: 'texte' },
      { id: 'telemed', label: 'Solution de téléconsultation', type: 'texte' },
      { id: 'outils', label: "Autres outils (messagerie sécurisée, agenda partagé, outil de coordination)", type: 'zone' },
    ],
  },
];
