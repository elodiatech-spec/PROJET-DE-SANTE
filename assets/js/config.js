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
  bloque: {
    id: 'bloque', label: 'Bloqué', couleur: 'danger',
    icone: 'fa-solid fa-triangle-exclamation', poids: 0.2,
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
  LB: { id: 'LB', nom: 'Structuration juridique & dossier ARS', icone: 'fa-solid fa-scale-balanced', couleur: '#7c6bd4' },
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
   Catalogue des prestations (34)
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
    desc: "Création de l'espace de suivi, du coffre-fort documentaire et des accès de l'équipe.",
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

  /* --- LOT B : Structuration juridique & dossier ARS (F2, F3) --- */
  { id: 'P17', lot: 'LB', titre: 'Structuration SISA ou association 1901', acteur: 'expert', jours: 10,
    desc: "Choix du véhicule juridique, rédaction des statuts, règlement intérieur, formalités d'immatriculation.",
    livrable: 'Statuts & règlement intérieur' },
  { id: 'P18', lot: 'LB', titre: 'Préparation du dossier ARS', acteur: 'expert', jours: 8,
    desc: "Constitution du dossier complet, vérification des pièces obligatoires, cohérence avec le cahier des charges régional.",
    livrable: 'Dossier ARS complet' },
  { id: 'P19', lot: 'LB', titre: 'Accompagnement au dépôt', acteur: 'expert', jours: 4,
    desc: "Dépôt sur le portail dédié, suivi de l'instruction, réponses aux demandes de compléments.",
    livrable: 'Accusé de dépôt ARS' },
  { id: 'P20', lot: 'LB', titre: 'Démarches ACI applicables', acteur: 'expert', jours: 6,
    desc: "Vérification de l'éligibilité à l'ACI, montage du contrat tripartite et dépôt auprès de la CPAM.",
    livrable: 'Contrat ACI déposé' },

  /* --- LOT C : Financements & subventions (F2, F3) --- */
  { id: 'P21', lot: 'LC', titre: 'Identification des aides ARS', acteur: 'expert', jours: 5,
    desc: "Recensement des aides mobilisables (FIR, aides à l'installation, crédits d'amorçage) et montage des demandes.",
    livrable: 'Dossier de demande FIR' },
  { id: 'P22', lot: 'LC', titre: 'Opportunités FEDER si mobilisables', acteur: 'expert', jours: 8,
    desc: "Analyse d'éligibilité aux fonds européens, montage du dossier et dépôt sur le portail e-Synergie.",
    livrable: 'Dossier FEDER déposé' },

  /* --- LOT D : Conventions & partenariats (F2, F3) --- */
  { id: 'P23', lot: 'LD', titre: 'Conventions CCAS', acteur: 'expert', jours: 4,
    desc: "Conventionnement avec le centre communal d'action sociale et les collectivités du territoire.",
    livrable: 'Convention CCAS signée' },
  { id: 'P24', lot: 'LD', titre: 'Conventions partenaires médicaux', acteur: 'expert', jours: 5,
    desc: "Conventions avec les établissements hospitaliers, HAD, SSIAD, laboratoires et pharmacies partenaires.",
    livrable: 'Conventions partenaires' },
  { id: 'P25', lot: 'LD', titre: 'Partenariats prévention', acteur: 'expert', jours: 4,
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
    desc: "Conception du logo de la structure, propositions, itérations et livraison des fichiers sources.",
    livrable: 'Logo (SVG, PNG, sources)' },
  { id: 'P30', lot: 'LF', titre: 'Charte graphique', acteur: 'expert', jours: 5,
    desc: "Palette, typographies, règles d'usage et gabarits documentaires de la structure.",
    livrable: 'Charte graphique (PDF)' },
  { id: 'P31', lot: 'LF', titre: 'Identité visuelle & déclinaisons', acteur: 'expert', jours: 5,
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
  { id: 'guichets',  titre: 'Guichets & financements', icone: 'fa-solid fa-landmark' },
  { id: 'identite',  titre: 'Identité & déploiement',  icone: 'fa-solid fa-rocket' },
  { id: 'documents', titre: 'Documents & validation',  icone: 'fa-solid fa-folder-open' },
  { id: 'collab',    titre: 'Collaboration',           icone: 'fa-solid fa-users' },
  { id: 'support',   titre: 'Support',                 icone: 'fa-solid fa-circle-question' },
  { id: 'console',   titre: 'Console expert',          icone: 'fa-solid fa-user-gear' },
];

const MODULES = [
  { id: 'dashboard',    pole: 'pilotage',  label: "Vue d'ensemble",          icone: 'fa-solid fa-chart-pie',            formules: null },
  { id: 'feuille-route',pole: 'pilotage',  label: 'Feuille de route',        icone: 'fa-solid fa-list-check',           formules: null },

  { id: 'projet-sante', pole: 'ingenierie',label: 'Projet de santé',         icone: 'fa-solid fa-book-medical',         formules: null,               lot: 'LA' },
  { id: 'juridique',    pole: 'ingenierie',label: 'Structuration juridique', icone: 'fa-solid fa-scale-balanced',       formules: ['F2', 'F3'],       lot: 'LB' },
  { id: 'immobilier',   pole: 'ingenierie',label: 'Immobilier, locaux & ERP',icone: 'fa-solid fa-building-circle-check',formules: ['F2', 'F3'],       option: 'immobilier' },

  { id: 'ars',          pole: 'guichets',  label: 'Dossier ARS & guichets',  icone: 'fa-solid fa-landmark',             formules: ['F2', 'F3'],       lot: 'LB' },
  { id: 'financements', pole: 'guichets',  label: 'Financements',            icone: 'fa-solid fa-sack-dollar',          formules: ['F2', 'F3'],       lot: 'LC' },
  { id: 'partenariats', pole: 'guichets',  label: 'Conventions & partenaires',icone: 'fa-solid fa-handshake',           formules: ['F2', 'F3'],       lot: 'LD' },
  { id: 'prestataires', pole: 'guichets',  label: 'Prestataires & outils',   icone: 'fa-solid fa-screwdriver-wrench',   formules: ['F2', 'F3'],       lot: 'LE' },

  { id: 'identite',     pole: 'identite',  label: 'Identité visuelle & web', icone: 'fa-solid fa-palette',              formules: ['F3'],             lot: 'LF' },
  { id: 'deploiement',  pole: 'identite',  label: 'Déploiement',             icone: 'fa-solid fa-rocket',               formules: ['F3'],             lot: 'LG' },

  { id: 'documents',    pole: 'documents', label: 'Coffre-fort documentaire',icone: 'fa-solid fa-folder-open',          formules: null },
  { id: 'signatures',   pole: 'documents', label: 'Validation & signatures', icone: 'fa-solid fa-file-signature',       formules: null },
  { id: 'livrables',    pole: 'documents', label: 'Livrables',               icone: 'fa-solid fa-box-archive',          formules: null },

  { id: 'messagerie',   pole: 'collab',    label: 'Messagerie',              icone: 'fa-solid fa-comments',             formules: null },
  { id: 'planning',     pole: 'collab',    label: 'Planning & échéances',    icone: 'fa-solid fa-calendar-days',        formules: null },
  { id: 'comptes-rendus',pole:'collab',    label: 'Comptes rendus',          icone: 'fa-solid fa-clipboard-check',      formules: null },

  { id: 'faq',          pole: 'support',   label: 'FAQ réglementaire',       icone: 'fa-solid fa-circle-question',      formules: null },

  { id: 'admin-projets',pole: 'console',   label: 'Portefeuille clients',    icone: 'fa-solid fa-address-card',         formules: null, roles: ['expert'] },
  { id: 'admin-offres', pole: 'console',   label: 'Offres & périmètres',     icone: 'fa-solid fa-tags',                 formules: null, roles: ['expert'] },
  { id: 'admin-experts',pole: 'console',   label: 'Équipe ElodiaTech',       icone: 'fa-solid fa-user-tie',             formules: null, roles: ['expert'] },
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

/** Pièces obligatoires du dossier ARS / financeur. */
const PIECES_DOSSIER = [
  { id: 'D01', nom: 'Kbis ou récépissé de déclaration', cat: 'Juridique' },
  { id: 'D02', nom: 'Statuts signés de la structure', cat: 'Juridique' },
  { id: 'D03', nom: 'RIB professionnel de la structure', cat: 'Finances' },
  { id: 'D04', nom: 'Titre de propriété ou bail commercial', cat: 'Immobilier' },
  { id: 'D05', nom: 'Attestation RC professionnelle', cat: 'Juridique' },
  { id: 'D06', nom: 'Liste des professionnels (RPPS / ADELI)', cat: 'Équipe' },
  { id: 'D07', nom: 'Projet de santé validé', cat: 'Projet' },
  { id: 'D08', nom: 'Budget prévisionnel & plan de financement', cat: 'Finances' },
  { id: 'D09', nom: 'Devis prestataires (travaux, équipement, logiciel)', cat: 'Finances' },
  { id: 'D10', nom: 'Attestation de régularité fiscale et sociale', cat: 'Juridique' },
  { id: 'D11', nom: 'Diagnostic accessibilité PMR / attestation ERP', cat: 'Immobilier' },
  { id: 'D12', nom: "Lettre d'engagement de l'équipe", cat: 'Équipe' },
];

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

/** Liens vers les portails institutionnels. */
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
  { id: 'ameli', nom: 'Espace Pro Ameli (ACI)', desc: "Suivi du contrat ACI et des dotations conventionnelles de la CPAM.",
    couleur: '#a5c836', formules: ['F2', 'F3'], liens: [
      { label: 'Espace professionnel', url: 'https://www.ameli.fr/exercice-coordonne', primaire: true },
    ]},
];

/** Modèles juridiques proposés. */
const MODELES_JURIDIQUES = {
  sisa: {
    id: 'sisa', nom: 'SISA', libelle: 'Société interprofessionnelle de soins ambulatoires',
    cible: 'Maison de santé pluriprofessionnelle (MSP)', icone: 'fa-solid fa-building-user',
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
  { q: "Comment percevoir la dotation ACI ?", cat: 'Financement',
    r: "Il faut réunir au moins deux médecins généralistes et un auxiliaire médical, disposer d'un système d'information partagé labellisé Ségur, être constitué en SISA et disposer d'un projet de santé validé par l'ARS. Le contrat ACI est ensuite signé avec la CPAM et l'ARS." },
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
    r: "Les actes sont déposés sur un parapheur électronique. Chaque signataire s'authentifie, signe, puis reçoit le document horodaté et certifié eIDAS. L'original signé est archivé dans le coffre-fort documentaire du projet." },
  { q: "Quel logiciel médical choisir ?", cat: 'Outils',
    r: "Le logiciel doit être labellisé Ségur pour ouvrir droit aux financements et permettre le partage d'informations. La sélection s'appuie sur un comparatif fonctionnel et des démonstrations organisées avec l'équipe." },
  { q: "Que se passe-t-il après l'ouverture de la structure ?", cat: 'Déploiement',
    r: "Le projet de santé fait l'objet d'une évaluation annuelle, les indicateurs ACI sont déclarés chaque année et le projet doit être actualisé, généralement tous les cinq ans." },
];

/** Catégories de documents du coffre-fort. */
const CATEGORIES_DOC = ['Projet', 'Juridique', 'ARS', 'Finances', 'Immobilier', 'Équipe', 'Partenariats', 'Identité'];

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
    { chemin: 'client.tel',      label: 'Téléphone', type: 'text', placeholder: '0596 00 00 00' },
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
