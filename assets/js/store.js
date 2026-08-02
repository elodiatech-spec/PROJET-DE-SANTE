/* ==========================================================================
   store.js — État applicatif, persistance et sélecteurs calculés
   Source de données : jeu de démonstration local, ou Google Sheets via
   un script Apps Script publié en application web (voir docs/).
   ========================================================================== */

const STORAGE_KEY = 'elodiatech.plateforme.v4';

/**
 * Identifiant unique pour un élément créé dans l'interface.
 * Le compteur est indispensable : deux créations dans la même milliseconde
 * produiraient sinon le même identifiant, et la seconde écraserait la première
 * dans la feuille Google Sheets.
 */
let _sequence = 0;
function idUnique(prefixe) {
  _sequence += 1;
  return prefixe + Date.now().toString(36) + _sequence.toString(36);
}

/* --------------------------------------------------------------------------
   Utilitaires de date
   -------------------------------------------------------------------------- */
const Dates = {
  /** Ajoute n jours à une date et renvoie une chaîne ISO (AAAA-MM-JJ). */
  addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  },
  today() {
    return new Date().toISOString().slice(0, 10);
  },
  /** Nombre de jours entre aujourd'hui et une date ISO (négatif = passé). */
  daysUntil(iso) {
    if (!iso) return null;
    const ms = new Date(iso + 'T00:00:00') - new Date(Dates.today() + 'T00:00:00');
    return Math.round(ms / 86400000);
  },
  format(iso, opts) {
    if (!iso) return '—';
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-FR', opts || { day: '2-digit', month: 'short', year: 'numeric' });
  },
  formatLong(iso) {
    return Dates.format(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  },
};

/* --------------------------------------------------------------------------
   Génération du jeu de démonstration
   -------------------------------------------------------------------------- */

/** Prestations actives pour une formule donnée. */
function prestationsDeFormule(codeFormule) {
  const formule = FORMULES[codeFormule];
  if (!formule) return [];
  return PRESTATIONS.filter((p) => formule.lots.includes(p.lot));
}

/**
 * Construit l'état des prestations d'un projet.
 * Les prestations validées reçoivent une échéance passée, calculée depuis le
 * démarrage ; les autres un rétroplanning à partir d'aujourd'hui.
 * @param {string} codeFormule
 * @param {string} dateDebut      date ISO de démarrage
 * @param {number} nbValidees     nombre de prestations déjà validées
 * @param {object} overrides      { P12: 'bloque', ... }
 * @param {string[]} retards      identifiants dont l'échéance est dépassée
 */
function seedPrestations(codeFormule, dateDebut, nbValidees, overrides = {}, retards = []) {
  const actives = prestationsDeFormule(codeFormule);
  const etat = {};
  let curseurPasse = 0;
  let curseurFutur = 0;

  actives.forEach((p, i) => {
    let statut;
    if (i < nbValidees) statut = 'valide';
    else if (i === nbValidees) statut = 'a_valider';
    else if (i <= nbValidees + 2) statut = 'en_cours';
    else statut = 'a_faire';

    if (overrides[p.id]) statut = overrides[p.id];

    let echeance;
    if (statut === 'valide') {
      curseurPasse += p.jours;
      echeance = Dates.addDays(dateDebut, curseurPasse);
    } else if (retards.includes(p.id)) {
      echeance = Dates.addDays(Dates.today(), -Math.max(5, p.jours));
    } else {
      curseurFutur += p.jours;
      echeance = Dates.addDays(Dates.today(), curseurFutur);
    }

    etat[p.id] = { statut, echeance, note: '', livrableUrl: '', majLe: Dates.today() };
  });

  return etat;
}

function demoProjets() {
  const t = new Date();
  const iso = (moisEcoules) => {
    const d = new Date(t);
    d.setMonth(d.getMonth() - moisEcoules);
    return d.toISOString().slice(0, 10);
  };

  return [
    {
      id: 'msp-fort-de-france',
      nom: 'MSP Santé Caraïbes',
      type: 'MSP',
      ville: 'Fort-de-France',
      departement: 'Martinique (972)',
      adresse: '124 avenue de la Liberté, 97232 Le Lamentin',
      coords: [14.615, -61.002],
      reference: 'MSP-972-0048',
      formule: 'F3',
      options: { immobilier: true },
      modeleJuridique: 'sisa',
      dateDebut: iso(9),
      client: { nom: 'Dr Marc Dubois', fonction: 'Médecin généraliste · porteur du projet', email: 'm.dubois@msp-caraibes.fr', tel: '0596 00 00 00' },
      consultant: { nom: 'ARNOBE Frédéric', email: 'elodiatech@gmail.com' },
      equipe: 9,
      surface: 280,
      gdocProjetSante: 'https://docs.google.com/document/d/EXEMPLE_MSP_CARAIBES/edit',
      driveUrl: 'https://drive.google.com/drive/folders/EXEMPLE_MSP_CARAIBES',
      siteUrl: '',
      notes: '',
      prestations: seedPrestations('F3', iso(9), 24, { P32: 'en_cours', P27: 'bloque' }, ['P27']),
    },
    {
      id: 'msp-pointe-a-pitre',
      nom: 'MSP Archipel',
      type: 'MSP',
      ville: 'Pointe-à-Pitre',
      departement: 'Guadeloupe (971)',
      adresse: '8 rue Frébault, 97110 Pointe-à-Pitre',
      coords: [16.2412, -61.5344],
      reference: 'MSP-971-0112',
      formule: 'F2',
      options: { immobilier: true },
      modeleJuridique: 'sisa',
      dateDebut: iso(5),
      client: { nom: 'Dr Aline Mercier', fonction: 'Médecin généraliste · coordinatrice', email: 'a.mercier@msp-archipel.fr', tel: '0590 00 00 00' },
      consultant: { nom: 'ARNOBE Frédéric', email: 'elodiatech@gmail.com' },
      equipe: 6,
      surface: 195,
      gdocProjetSante: 'https://docs.google.com/document/d/EXEMPLE_MSP_ARCHIPEL/edit',
      driveUrl: 'https://drive.google.com/drive/folders/EXEMPLE_MSP_ARCHIPEL',
      siteUrl: '',
      notes: '',
      prestations: seedPrestations('F2', iso(5), 15, {}, ['P21']),
    },
    {
      id: 'cds-gros-morne',
      nom: 'Centre de Santé Nord',
      type: 'CDS',
      ville: 'Gros-Morne',
      departement: 'Martinique (972)',
      adresse: '15 rue Schoelcher, 97213 Gros-Morne',
      coords: [14.7333, -61.0167],
      reference: 'CDS-972-0031',
      formule: 'F1',
      options: { immobilier: false },
      modeleJuridique: 'assoc',
      dateDebut: iso(2),
      client: { nom: 'Mme Sophie Rivière', fonction: 'Directrice · structure gestionnaire', email: 's.riviere@cds-nord.fr', tel: '0596 00 00 00' },
      consultant: { nom: 'ARNOBE Frédéric', email: 'elodiatech@gmail.com' },
      equipe: 12,
      surface: 240,
      gdocProjetSante: 'https://docs.google.com/document/d/EXEMPLE_CDS_NORD/edit',
      driveUrl: 'https://drive.google.com/drive/folders/EXEMPLE_CDS_NORD',
      siteUrl: '',
      notes: '',
      prestations: seedPrestations('F1', iso(2), 7),
    },
    {
      id: 'cds-cayenne',
      nom: 'Centre de Santé Amazonie',
      type: 'CDS',
      ville: 'Cayenne',
      departement: 'Guyane (973)',
      adresse: '42 avenue du Général de Gaulle, 97300 Cayenne',
      coords: [4.9224, -52.3135],
      reference: 'CDS-973-0007',
      formule: 'F2',
      options: { immobilier: false },
      modeleJuridique: 'assoc',
      dateDebut: iso(1),
      client: { nom: 'Dr Paul Anselme', fonction: 'Médecin coordonnateur', email: 'p.anselme@cds-amazonie.fr', tel: '0594 00 00 00' },
      consultant: { nom: 'ARNOBE Frédéric', email: 'elodiatech@gmail.com' },
      equipe: 8,
      surface: 310,
      gdocProjetSante: '',
      driveUrl: '',
      siteUrl: '',
      notes: '',
      prestations: seedPrestations('F2', iso(1), 4),
    },
  ];
}

function demoDonnees() {
  const projets = demoProjets();
  const j = (n) => Dates.addDays(Dates.today(), n);

  return {
    projets,
    documents: {
      'msp-fort-de-france': [
        { id: 'doc1', nom: 'Projet_de_sante_MSP_Caraibes_V4.pdf', cat: 'Projet', type: 'pdf', taille: '4,2 Mo', date: j(-26), auteur: 'ARNOBE Frédéric', url: '', piece: 'D07' },
        { id: 'doc2', nom: 'Statuts_SISA_signes.pdf', cat: 'Juridique', type: 'pdf', taille: '1,1 Mo', date: j(-61), auteur: 'ARNOBE Frédéric', url: '', piece: 'D02' },
        { id: 'doc3', nom: 'Dossier_ARS_depot.zip', cat: 'ARS', type: 'zip', taille: '18,4 Mo', date: j(-40), auteur: 'ARNOBE Frédéric', url: '' },
        { id: 'doc4', nom: 'Plan_financement_triennal.xlsx', cat: 'Finances', type: 'xls', taille: '286 Ko', date: j(-18), auteur: 'ARNOBE Frédéric', url: '', piece: 'D08' },
        { id: 'doc5', nom: 'Plans_execution_BPE.pdf', cat: 'Immobilier', type: 'pdf', taille: '12,7 Mo', date: j(-33), auteur: 'ArchiSanté Caraïbes', url: '' },
        { id: 'doc6', nom: 'Charte_graphique_MSP.pdf', cat: 'Identité', type: 'pdf', taille: '6,8 Mo', date: j(-9), auteur: 'Studio ElodiaTech', url: '' },
      ],
      'msp-pointe-a-pitre': [
        { id: 'doc7', nom: 'Diagnostic_territorial_971.pdf', cat: 'Projet', type: 'pdf', taille: '3,4 Mo', date: j(-52), auteur: 'ARNOBE Frédéric', url: '' },
        { id: 'doc8', nom: 'Projet_de_sante_V2_travail.docx', cat: 'Projet', type: 'doc', taille: '780 Ko', date: j(-6), auteur: 'ARNOBE Frédéric', url: '' },
      ],
      'cds-gros-morne': [
        { id: 'doc9', nom: 'Questionnaire_faisabilite.pdf', cat: 'Projet', type: 'pdf', taille: '520 Ko', date: j(-48), auteur: 'Sophie Rivière', url: '' },
        { id: 'doc10', nom: 'Analyse_besoins_sante_Nord.pdf', cat: 'Projet', type: 'pdf', taille: '2,9 Mo', date: j(-11), auteur: 'ARNOBE Frédéric', url: '' },
      ],
      'cds-cayenne': [
        { id: 'doc11', nom: 'Compte_rendu_cadrage.pdf', cat: 'Projet', type: 'pdf', taille: '410 Ko', date: j(-14), auteur: 'ARNOBE Frédéric', url: '' },
      ],
    },
    signatures: {
      'msp-fort-de-france': [
        { id: 'sig1', titre: "Mandat d'accompagnement ElodiaTech", desc: "Devis et mandat d'accompagnement Formule 3.", statut: 'signe', date: j(-255), url: '' },
        { id: 'sig2', titre: 'Statuts constitutifs SISA', desc: 'Acte constitutif à déposer au greffe du tribunal de commerce.', statut: 'signe', date: j(-190), url: '' },
        { id: 'sig3', titre: 'Projet de santé — validation équipe', desc: "Validation collégiale du projet de santé avant transmission à l'ARS.", statut: 'signe', date: j(-30), url: '' },
        { id: 'sig4', titre: 'Contrat ACI (CPAM)', desc: "Contrat tripartite d'engagement interprofessionnel.", statut: 'a_signer', date: '', url: '' },
        { id: 'sig5', titre: 'Convention CCAS Le Lamentin', desc: "Convention de partenariat avec le centre communal d'action sociale.", statut: 'a_signer', date: '', url: '' },
      ],
      'msp-pointe-a-pitre': [
        { id: 'sig6', titre: "Mandat d'accompagnement ElodiaTech", desc: 'Devis et mandat Formule 2.', statut: 'signe', date: j(-150), url: '' },
        { id: 'sig7', titre: 'Statuts constitutifs SISA', desc: 'Statuts en attente de signature des associés.', statut: 'a_signer', date: '', url: '' },
      ],
      'cds-gros-morne': [
        { id: 'sig8', titre: "Mandat d'accompagnement ElodiaTech", desc: 'Devis et mandat Formule 1.', statut: 'signe', date: j(-60), url: '' },
      ],
      'cds-cayenne': [
        { id: 'sig9', titre: "Mandat d'accompagnement ElodiaTech", desc: 'Devis et mandat Formule 2.', statut: 'signe', date: j(-28), url: '' },
      ],
    },
    messages: {
      'msp-fort-de-france': [
        { id: 'm1', auteur: 'ARNOBE Frédéric', role: 'expert', texte: "Bonjour Docteur, le dossier ARS a bien été déposé. Nous sommes en attente de l'accusé de réception.", date: j(-12) },
        { id: 'm2', auteur: 'Dr Marc Dubois', role: 'client', texte: "Parfait, merci. Où en est le contrat ACI ?", date: j(-11) },
        { id: 'm3', auteur: 'ARNOBE Frédéric', role: 'expert', texte: "Le contrat ACI est prêt et déposé sur le parapheur électronique. Il attend votre signature.", date: j(-10) },
      ],
      'msp-pointe-a-pitre': [
        { id: 'm4', auteur: 'ARNOBE Frédéric', role: 'expert', texte: "Le diagnostic territorial est finalisé, vous pouvez le consulter dans le coffre-fort documentaire.", date: j(-8) },
      ],
      'cds-gros-morne': [
        { id: 'm5', auteur: 'ARNOBE Frédéric', role: 'expert', texte: "Bonjour, l'analyse des besoins de santé est terminée. Je vous propose une visio la semaine prochaine.", date: j(-5) },
      ],
      'cds-cayenne': [
        { id: 'm6', auteur: 'ARNOBE Frédéric', role: 'expert', texte: "Bienvenue sur votre espace de suivi. Le questionnaire de faisabilité est disponible.", date: j(-14) },
      ],
    },
    evenements: {
      'msp-fort-de-france': [
        { id: 'e1', titre: 'Comité de pilotage mensuel', type: 'echange', canal: 'visio', date: j(4), heure: '14:30', lieu: '', lien: 'https://meet.google.com/exemple-copil' },
        { id: 'e2', titre: 'Commission ARS — instruction du dossier', type: 'jalon', canal: '', date: j(21), heure: '09:00', lieu: 'ARS Martinique', lien: '' },
        { id: 'e3', titre: 'Livraison de la maquette du site internet', type: 'livrable', canal: '', date: j(12), heure: '', lieu: '', lien: '' },
        { id: 'e4', titre: 'Formation équipe — logiciel métier', type: 'formation', canal: '', date: j(35), heure: '09:00', lieu: 'Sur site', lien: '' },
      ],
      'msp-pointe-a-pitre': [
        { id: 'e5', titre: 'Atelier rédaction — exercice coordonné', type: 'echange', canal: 'visio', date: j(6), heure: '18:00', lieu: '', lien: 'https://meet.google.com/exemple-atelier' },
        { id: 'e6', titre: 'Clôture du dépôt FEDER', type: 'jalon', canal: '', date: j(18), heure: '23:59', lieu: 'Portail e-Synergie', lien: '' },
      ],
      'cds-gros-morne': [
        { id: 'e7', titre: 'Restitution du diagnostic territorial', type: 'echange', canal: 'presentiel', date: j(9), heure: '10:00', lieu: 'Cabinet, Gros-Morne', lien: '' },
      ],
      'cds-cayenne': [
        { id: 'e8', titre: 'Rendez-vous découverte', type: 'echange', canal: 'visio', date: j(3), heure: '15:00', lieu: '', lien: 'https://meet.google.com/exemple-decouverte' },
      ],
    },
    comptesRendus: {
      'msp-fort-de-france': [
        { id: 'cr1', date: j(-12), objet: 'Comité de pilotage — juillet', type: 'visio', participants: "Dr Dubois, Jean-Philippe B., ArchiSanté", decisions: "Validation des plans d'exécution. Lancement de la charte graphique.", statut: 'valide', lienMeet: 'https://meet.google.com/exemple-copil', lienDoc: 'https://docs.google.com/document/d/EXEMPLE_CR_JUILLET/edit' },
        { id: 'cr2', date: j(-40), objet: 'Cadrage des statuts SISA', type: 'presentiel', participants: 'Associés, ARNOBE Frédéric, cabinet comptable', decisions: 'Modèle SISA approuvé à l\'unanimité des associés.', statut: 'valide', lienMeet: '', lienDoc: '' },
      ],
      'msp-pointe-a-pitre': [
        { id: 'cr3', date: j(-20), objet: 'Restitution du diagnostic territorial', type: 'visio', participants: 'Dr Mercier, équipe, ARNOBE Frédéric', decisions: "Priorisation de trois axes : diabète, santé mentale, prévention.", statut: 'valide', lienMeet: '', lienDoc: '' },
      ],
      'cds-gros-morne': [],
      'cds-cayenne': [
        { id: 'cr4', date: j(-14), objet: 'Point téléphonique de lancement', type: 'telephone', participants: 'Dr Anselme, ARNOBE Frédéric', decisions: 'Calendrier validé, démarrage du diagnostic territorial.', statut: 'valide', lienMeet: '', lienDoc: '' },
      ],
    },
    financements: {
      'msp-fort-de-france': [
        { id: 'f1', source: 'FIR — ARS Martinique', montant: 120000, statut: 'accorde', echeance: j(-60) },
        { id: 'f2', source: 'FEDER — programme régional', montant: 240000, statut: 'instruction', echeance: j(45) },
        { id: 'f3', source: 'ACI — CPAM', montant: 68000, statut: 'depose', echeance: j(30) },
        { id: 'f4', source: 'Collectivité territoriale', montant: 45000, statut: 'instruction', echeance: j(60) },
      ],
      'msp-pointe-a-pitre': [
        { id: 'f5', source: 'FIR — ARS Guadeloupe', montant: 85000, statut: 'depose', echeance: j(25) },
        { id: 'f6', source: 'FEDER — programme régional', montant: 150000, statut: 'etude', echeance: j(90) },
      ],
      'cds-gros-morne': [],
      'cds-cayenne': [
        { id: 'f7', source: 'FIR — ARS Guyane', montant: 95000, statut: 'etude', echeance: j(75) },
      ],
    },
    partenaires: {
      'msp-fort-de-france': [
        { id: 'pa1', nom: 'CCAS du Lamentin', type: 'Collectivité', statut: 'a_signer' },
        { id: 'pa2', nom: 'CHU de Martinique', type: 'Établissement hospitalier', statut: 'signe' },
        { id: 'pa3', nom: 'HAD Martinique', type: 'Hospitalisation à domicile', statut: 'signe' },
        { id: 'pa4', nom: 'Réseau prévention diabète 972', type: 'Prévention', statut: 'en_cours' },
      ],
      'msp-pointe-a-pitre': [
        { id: 'pa5', nom: 'CHU de Guadeloupe', type: 'Établissement hospitalier', statut: 'en_cours' },
      ],
      'cds-gros-morne': [],
      'cds-cayenne': [],
    },
    // Équipe ElodiaTech. Le référent d'un projet est choisi dans cette liste.
    experts: [
      { id: 'exp1', nom: 'ARNOBE Frédéric', fonction: 'Expert projets de santé · fondateur',
        email: 'elodiatech@gmail.com', tel: '', principal: 'OUI' },
    ],

    prestataires: [
      { id: 'v1', nom: 'ComptaSanté Antilles', metier: 'Expert-comptable', specialite: 'SISA, paie et fiscalité des structures de santé', contact: 'contact@comptasante.fr', lot: 'LE' },
      { id: 'v2', nom: 'WEDA', metier: 'Logiciel médical', specialite: 'Solution labellisée Ségur, lecteurs CPx', contact: 'commercial@weda.fr', lot: 'LE' },
      { id: 'v3', nom: 'Maiia / Cegedim', metier: 'Logiciel médical', specialite: 'Agenda partagé, téléconsultation, Ségur', contact: 'contact@maiia.com', lot: 'LE' },
      { id: 'v4', nom: 'ArchiSanté Caraïbes', metier: 'Architecte', specialite: 'ERP catégorie 5, accessibilité PMR', contact: 'agence@archisante.fr', lot: 'LE' },
      { id: 'v5', nom: 'BET Tropic Ingénierie', metier: "Bureau d'études", specialite: 'Fluides, thermique, acoustique en milieu tropical', contact: 'etudes@tropic-ing.fr', lot: 'LE' },
      { id: 'v6', nom: 'Studio ElodiaTech', metier: 'Identité visuelle', specialite: 'Logo, charte graphique, site internet', contact: 'studio@elodiatech.com', lot: 'LF' },
    ],
    intervenantsImmo: [
      { id: 'i1', etape: 'Recherche de local ou de terrain', icone: 'fa-solid fa-magnifying-glass', statut: 'valide' },
      { id: 'i2', etape: "Sélection de l'architecte", icone: 'fa-solid fa-compass-drafting', statut: 'valide' },
      { id: 'i3', etape: "Désignation du maître d'œuvre (AMO / MOE)", icone: 'fa-solid fa-helmet-safety', statut: 'valide' },
      { id: 'i4', etape: "Mandat des bureaux d'études (BET)", icone: 'fa-solid fa-calculator', statut: 'en_cours' },
      { id: 'i5', etape: 'Consultation des entreprises et artisans', icone: 'fa-solid fa-trowel-bricks', statut: 'a_faire' },
    ],
  };
}

/* --------------------------------------------------------------------------
   Adaptateur Google Sheets
   Le script Apps Script publié en application web doit exposer :
     GET  ?action=getAll                     → { projets, documents, ... }
     POST { action:'update', entite, id, payload }
   Voir docs/connexion-google-sheets.md
   -------------------------------------------------------------------------- */
const SheetsAdapter = {
  /**
   * Charge les données autorisées par le porte-clés fourni.
   * `porteCles` vaut { cle } pour l'expert, { jeton } pour un client.
   * Le serveur décide de ce qu'il renvoie : un jeton client ne rapporte
   * jamais que son propre projet.
   */
  async chargerTout(webAppUrl, porteCles) {
    const data = await this.envoyer(webAppUrl, { action: 'getAll', ...porteCles });
    if (!data || !Array.isArray(data.projets)) {
      throw new Error("Format inattendu : la clé 'projets' est absente");
    }
    return data;
  },

  /**
   * Envoie une écriture au script. `corps` suit l'un de ces formats :
   *   { action:'upsert', entite, id, payload }
   *   { action:'delete', entite, id }
   *   { action:'batch',  operations:[ … ] }
   */
  async envoyer(webAppUrl, corps) {
    // text/plain évite la requête préliminaire CORS refusée par Apps Script.
    const rep = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(corps),
    });
    if (!rep.ok) throw new Error(`réponse ${rep.status} du script Google`);
    const data = await rep.json();
    if (data && data.erreur) throw new Error(data.erreur);
    return data;
  },
};

/* --------------------------------------------------------------------------
   Store
   -------------------------------------------------------------------------- */
const Store = {
  state: null,
  _abonnes: [],

  /* ---- Cycle de vie ---- */

  init() {
    const sauvegarde = this._lire();
    const donnees = demoDonnees();

    this.state = {
      // Session — `cle` et `jeton` sont les porte-clés envoyés au serveur.
      session: { connecte: false, identifiant: '', cle: '', jeton: '', expire: 0 },
      chargement: false,
      role: 'client',            // 'client' | 'expert'
      theme: 'dark',
      projetActifId: donnees.projets[0].id,
      route: 'dashboard',
      // Réglages
      reglages: { source: 'demo', webAppUrl: '', derniereSync: '' },
      // Données
      ...donnees,
    };

    if (sauvegarde) {
      // On ne restaure que ce qui a du sens : réglages, session et données modifiées.
      Object.assign(this.state, {
        session: { ...this.state.session, ...(sauvegarde.session || {}) },
        role: sauvegarde.role || 'client',
        theme: sauvegarde.theme || 'dark',
        projetActifId: sauvegarde.projetActifId || this.state.projetActifId,
        reglages: { ...this.state.reglages, ...(sauvegarde.reglages || {}) },
      });
      ['projets', 'documents', 'signatures', 'messages', 'evenements',
       'comptesRendus', 'financements', 'partenaires', 'prestataires',
       'intervenantsImmo'].forEach((cle) => {
        if (sauvegarde[cle]) this.state[cle] = sauvegarde[cle];
      });
    }

    // Une session expirée ramène à la page de connexion.
    const s = this.state.session;
    if (s.connecte && s.expire && Date.now() > s.expire) {
      this.state.session = { connecte: false, identifiant: '', cle: '', jeton: '', expire: 0 };
      this.state.role = 'client';
    }

    // Sur source réelle les données n'ont pas été conservées : il faudra les
    // redemander au serveur avant d'afficher quoi que ce soit.
    this.state.chargement = this.estConnecte() && this.state.reglages.source === 'sheets';

    // Sécurité : le projet actif doit exister.
    if (!this.projet()) this.state.projetActifId = this.state.projets[0].id;
    return this.state;
  },

  /** Durée d'une session avant nouvelle authentification : 12 heures. */
  DUREE_SESSION_MS: 12 * 60 * 60 * 1000,

  _lire() {
    try {
      const brut = localStorage.getItem(STORAGE_KEY);
      return brut ? JSON.parse(brut) : null;
    } catch {
      return null;
    }
  },

  sauvegarder() {
    try {
      const aEnregistrer = { ...this.state };

      // Sur source réelle, le portefeuille ne doit pas rester en clair dans le
      // navigateur entre deux visites : il est redemandé au serveur à chaque
      // ouverture, avec le porte-clés. Seuls les réglages et la session restent.
      if (this.state.reglages.source === 'sheets') {
        ['projets', 'documents', 'signatures', 'messages', 'evenements',
         'comptesRendus', 'financements', 'partenaires',
         'experts', 'prestataires'].forEach((cle) => {
          delete aEnregistrer[cle];
        });
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(aEnregistrer));
    } catch {
      /* quota dépassé ou mode privé : la session reste fonctionnelle en mémoire */
    }
  },

  reinitialiser() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    const theme = this.state.theme;
    this.init();
    this.state.theme = theme;
    this.sauvegarder();
    this.emit();
  },

  /* ---- Abonnements ---- */

  subscribe(fn) { this._abonnes.push(fn); },
  emit() { this._abonnes.forEach((fn) => fn(this.state)); },

  /** Mutation + persistance + notification. */
  commit(fn) {
    fn(this.state);
    this.sauvegarder();
    this.emit();
  },

  /* ---- Sélecteurs ---- */

  projet(id) {
    return this.state.projets.find((p) => p.id === (id || this.state.projetActifId));
  },

  formule(projet) {
    return FORMULES[(projet || this.projet()).formule];
  },

  estExpert() { return this.state.role === 'expert'; },

  /** Prestations actives du projet, enrichies de leur état. */
  prestations(projetId) {
    const p = this.projet(projetId);
    if (!p) return [];
    return prestationsDeFormule(p.formule).map((presta) => ({
      ...presta,
      etat: p.prestations[presta.id] || { statut: 'a_faire', echeance: '', note: '', livrableUrl: '' },
    }));
  },

  /** Avancement 0-100 pondéré par le statut. */
  avancement(projetId) {
    const liste = this.prestations(projetId);
    if (!liste.length) return 0;
    const total = liste.reduce((s, p) => s + (STATUTS[p.etat.statut]?.poids ?? 0), 0);
    return Math.round((total / liste.length) * 100);
  },

  /** Avancement par lot : [{ lot, nom, couleur, icone, pct, total, valides }]. */
  avancementParLot(projetId) {
    const p = this.projet(projetId);
    if (!p) return [];
    const liste = this.prestations(projetId);
    return FORMULES[p.formule].lots.map((idLot) => {
      const items = liste.filter((x) => x.lot === idLot);
      const somme = items.reduce((s, x) => s + (STATUTS[x.etat.statut]?.poids ?? 0), 0);
      return {
        ...LOTS[idLot],
        pct: items.length ? Math.round((somme / items.length) * 100) : 0,
        total: items.length,
        valides: items.filter((x) => x.etat.statut === 'valide').length,
      };
    });
  },

  /** Répartition des prestations par statut. */
  repartitionStatuts(projetId) {
    const liste = this.prestations(projetId);
    const res = {};
    Object.keys(STATUTS).forEach((s) => { res[s] = 0; });
    liste.forEach((p) => { res[p.etat.statut] = (res[p.etat.statut] || 0) + 1; });
    return res;
  },

  /** Prestations en attente d'une action du client. */
  actionsClient(projetId) {
    return this.prestations(projetId).filter((p) => p.etat.statut === 'a_valider');
  },

  /** Prestations en retard (échéance dépassée et non validée). */
  enRetard(projetId) {
    return this.prestations(projetId).filter((p) => {
      if (p.etat.statut === 'valide') return false;
      const j = Dates.daysUntil(p.etat.echeance);
      return j !== null && j < 0;
    });
  },

  /** Modules visibles selon la formule du projet et le rôle courant. */
  modulesVisibles(projetId) {
    const p = this.projet(projetId);
    if (!p) return [];
    return MODULES.filter((m) => {
      if (m.roles && !m.roles.includes(this.state.role)) return false;
      if (m.formules && !m.formules.includes(p.formule)) return false;
      if (m.option && !p.options?.[m.option]) return false;
      return true;
    });
  },

  moduleAccessible(idModule, projetId) {
    return this.modulesVisibles(projetId).some((m) => m.id === idModule);
  },

  /** Documents, signatures, etc. du projet courant. */
  liste(entite, projetId) {
    const id = projetId || this.state.projetActifId;
    return this.state[entite]?.[id] || [];
  },

  /**
   * État des pièces justificatives d'un projet.
   * Une pièce est fournie dès qu'un document du coffre-fort lui est rattaché
   * (champ `piece`). Les pièces ne concernant aucun dossier ouvert restent
   * listées : elles seront demandées le moment venu.
   */
  pieces(projetId) {
    const docs = this.liste('documents', projetId);
    return PIECES_DOSSIER.map((p) => ({
      ...p,
      document: docs.find((d) => d.piece === p.id) || null,
    }));
  },

  /** Pièces que le client doit fournir et qui manquent encore. */
  piecesManquantes(projetId) {
    return this.pieces(projetId).filter((p) => !p.document && p.par === 'client');
  },

  /** Signatures en attente du client. */
  signaturesEnAttente(projetId) {
    return this.liste('signatures', projetId).filter((s) => s.statut === 'a_signer');
  },

  /**
   * Planning consolidé de tout le portefeuille, réservé à l'expert.
   * Chaque entrée porte le projet dont elle provient.
   */
  planningGlobal() {
    const entrees = [];

    this.state.projets.forEach((p) => {
      (this.state.evenements[p.id] || []).forEach((e) => {
        entrees.push({
          date: e.date, heure: e.heure || '', titre: e.titre, type: e.type,
          canal: e.canal || '', lieu: e.lieu || '', lien: e.lien || '',
          projetId: p.id, projetNom: p.nom, projetVille: p.ville,
        });
      });

      this.prestations(p.id)
        .filter((x) => x.etat.statut !== 'valide' && x.etat.echeance)
        .forEach((x) => {
          entrees.push({
            date: x.etat.echeance, heure: '', titre: x.titre, type: 'prestation',
            lieu: LOTS[x.lot].nom, lien: '',
            projetId: p.id, projetNom: p.nom, projetVille: p.ville,
          });
        });
    });

    return entrees.sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
  },

  /** Prochaines échéances à venir (événements + prestations), triées. */
  echeances(projetId, limite = 6) {
    const aujourdhui = Dates.today();
    const evts = this.liste('evenements', projetId).map((e) => ({
      type: e.type, titre: e.titre, date: e.date, detail: [e.heure, e.lieu].filter(Boolean).join(' · '),
    }));
    const prestas = this.prestations(projetId)
      .filter((p) => p.etat.statut !== 'valide' && p.etat.echeance)
      .map((p) => ({ type: 'prestation', titre: p.titre, date: p.etat.echeance, detail: LOTS[p.lot].nom }));

    return [...evts, ...prestas]
      .filter((x) => x.date && x.date >= aujourdhui)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, limite);
  },

  /** Notifications calculées à partir de l'état réel du projet. */
  notifications(projetId) {
    const n = [];
    const p = this.projet(projetId);
    if (!p) return n;

    const aValider = this.actionsClient(projetId);
    if (aValider.length) {
      n.push({
        ton: 'warn', icone: 'fa-solid fa-hourglass-half',
        titre: `${aValider.length} livrable${aValider.length > 1 ? 's' : ''} à valider`,
        texte: aValider.map((x) => x.titre).slice(0, 3).join(' · '),
        route: 'feuille-route',
      });
    }

    const sigs = this.signaturesEnAttente(projetId);
    if (sigs.length) {
      n.push({
        ton: 'warn', icone: 'fa-solid fa-file-signature',
        titre: `${sigs.length} document${sigs.length > 1 ? 's' : ''} à signer`,
        texte: sigs.map((s) => s.titre).join(' · '),
        route: 'signatures',
      });
    }

    // Pièces à fournir : seulement si le projet a des financements en jeu.
    const projetCourant = this.projet(projetId);
    if (projetCourant && FORMULES[projetCourant.formule]?.lots.includes('LC')) {
      const manquantes = this.piecesManquantes(projetId);
      if (manquantes.length) {
        n.push({
          ton: 'warn', icone: 'fa-solid fa-file-arrow-up',
          titre: `${manquantes.length} pièce${manquantes.length > 1 ? 's' : ''} à fournir`,
          texte: manquantes.map((p) => p.nom).slice(0, 3).join(' · '),
          route: 'financements',
        });
      }
    }

    const retard = this.enRetard(projetId);
    if (retard.length) {
      n.push({
        ton: 'danger', icone: 'fa-solid fa-triangle-exclamation',
        titre: `${retard.length} prestation${retard.length > 1 ? 's' : ''} en retard`,
        texte: retard.map((x) => x.titre).slice(0, 3).join(' · '),
        route: 'feuille-route',
      });
    }

    // Échanges programmés : le client doit savoir quand et par quel moyen.
    const aujourdhui = Dates.today();
    this.liste('evenements', projetId)
      .filter((e) => estUnEchange(e.type) && e.date >= aujourdhui)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3)
      .forEach((e) => {
        const j = Dates.daysUntil(e.date);
        if (j === null || j > 14) return;
        const canal = CANAUX[e.canal] || CANAUX.visio;
        n.push({
          ton: j <= 2 ? 'warn' : 'ok',
          icone: canal.icone,
          titre: e.titre,
          texte: `${canal.label} · ${j === 0 ? "aujourd'hui" : `dans ${j} jour${j > 1 ? 's' : ''}`}`
                 + `${e.heure ? ' à ' + e.heure : ''} · ${Dates.format(e.date)}`,
          route: 'planning',
        });
      });

    // Autres échéances du planning et des prestations.
    this.echeances(projetId, 3)
      .filter((e) => e.type !== 'echange' && e.type !== 'reunion')
      .forEach((e) => {
        const j = Dates.daysUntil(e.date);
        if (j !== null && j >= 0 && j <= 14) {
          n.push({
            ton: j <= 5 ? 'warn' : 'ok', icone: 'fa-solid fa-calendar-day',
            titre: e.titre,
            texte: j === 0 ? "Aujourd'hui" : `Dans ${j} jour${j > 1 ? 's' : ''} · ${Dates.format(e.date)}`,
            route: 'planning',
          });
        }
      });

    // Comptes rendus récents : le client retrouve ce qui a été dit.
    if (!this.estExpert()) {
      this.liste('comptesRendus', projetId)
        .filter((cr) => cr.date && Dates.daysUntil(cr.date) >= -14)
        .slice(0, 2)
        .forEach((cr) => {
          const canal = CANAUX[cr.type] || CANAUX.visio;
          n.push({
            ton: 'ok', icone: 'fa-solid fa-clipboard-check',
            titre: `Compte rendu — ${cr.objet}`,
            texte: `${canal.label} du ${Dates.format(cr.date)}`,
            route: 'comptes-rendus',
          });
        });
    }

    return n;
  },

  /* ---- Mutations ---- */

  /* ---- Session ---- */

  estConnecte() { return !!this.state.session?.connecte; },

  /**
   * Reconnaît une adresse parmi les référents et les porteurs de projet.
   * Il ne s'agit pas d'une authentification : aucun secret n'est vérifié.
   * Le contrôle d'accès réel devra être assuré par le serveur.
   */
  identifier(email) {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return null;

    const commeExpert = this.state.projets.find(
      (p) => String(p.consultant?.email || '').toLowerCase() === e);
    if (commeExpert) return { role: 'expert', projetId: commeExpert.id, nom: commeExpert.consultant.nom };

    const commeClient = this.state.projets.find(
      (p) => String(p.client?.email || '').toLowerCase() === e);
    if (commeClient) return { role: 'client', projetId: commeClient.id, nom: commeClient.client.nom };

    return null;
  },

  connecter({ role, projetId, identifiant, cle, jeton }) {
    this.commit((s) => {
      s.session = {
        connecte: true,
        identifiant: identifiant || '',
        cle: cle || '',
        jeton: jeton || '',
        expire: Date.now() + this.DUREE_SESSION_MS,
      };
      s.chargement = false;
      s.role = role === 'expert' ? 'expert' : 'client';
      if (projetId && s.projets.some((p) => p.id === projetId)) s.projetActifId = projetId;
      s.route = 'dashboard';
    });
  },

  deconnecter() {
    this.commit((s) => {
      s.session = { connecte: false, identifiant: '', cle: '', jeton: '', expire: 0 };
      s.role = 'client';
      s.route = 'dashboard';
      s.chargement = false;
      // Le portefeuille quitte la mémoire : l'écran suivant ne peut rien montrer.
      if (s.reglages.source === 'sheets') {
        const neuf = demoDonnees();
        Object.keys(neuf).forEach((cle) => { s[cle] = neuf[cle]; });
        s.projetActifId = neuf.projets[0].id;
      }
    });
  },

  /**
   * Redemande les données au serveur avec le porte-clés en mémoire.
   * Appelée à chaque ouverture : c'est ce qui garantit qu'un code révoqué
   * ferme réellement l'accès, et non seulement à la prochaine connexion.
   */
  async revalider() {
    const { webAppUrl } = this.state.reglages;
    const porteCles = this.porteCles();
    if (!webAppUrl || !Object.keys(porteCles).length) {
      throw new Error('session incomplète');
    }

    const data = await SheetsAdapter.chargerTout(webAppUrl, porteCles);

    this.commit((s) => {
      Object.keys(data).forEach((k) => { if (k in s) s[k] = data[k]; });
      s.reglages.derniereSync = new Date().toISOString();
      s.chargement = false;
      s.role = porteCles.cle ? 'expert' : 'client';
      if (!s.projets.some((p) => p.id === s.projetActifId)) {
        s.projetActifId = data.projets[0].id;
      }
      if (!this.moduleAccessible(s.route)) s.route = 'dashboard';
    });

    return data.projets.length;
  },

  /**
   * Ouvre une session serveur : le script vérifie le porte-clés et ne renvoie
   * que ce à quoi il donne droit. C'est lui qui décide du rôle, pas le
   * navigateur — un client ne peut pas se déclarer expert.
   */
  async connecterAuServeur({ cle, jeton, identifiant }) {
    const url = this.state.reglages.webAppUrl;
    if (!url) throw new Error("Aucune source Google Sheets n'est configurée.");

    const data = await SheetsAdapter.chargerTout(url, cle ? { cle } : { jeton });

    // Un jeton client ne rapporte qu'un projet : le serveur a filtré.
    const role = cle ? 'expert' : 'client';

    this.commit((s) => {
      Object.keys(data).forEach((k) => { if (k in s) s[k] = data[k]; });
      s.reglages.source = 'sheets';
      s.reglages.derniereSync = new Date().toISOString();
      s.session = {
        connecte: true, identifiant: identifiant || '',
        cle: cle || '', jeton: jeton || '',
        expire: Date.now() + this.DUREE_SESSION_MS,
      };
      s.chargement = false;
      s.role = role;
      s.projetActifId = data.projets[0].id;
      s.route = 'dashboard';
    });

    return { role, projets: data.projets.length };
  },

  setRole(role) {
    this.commit((s) => {
      s.role = role;
      // Un client ne doit jamais rester sur une route réservée à l'expert.
      if (!this.moduleAccessible(s.route)) s.route = 'dashboard';
    });
  },

  setTheme(theme) {
    this.commit((s) => { s.theme = theme; });
  },

  setProjet(id) {
    this.commit((s) => {
      s.projetActifId = id;
      if (!this.moduleAccessible(s.route, id)) s.route = 'dashboard';
    });
  },

  setRoute(route) {
    if (!this.moduleAccessible(route)) return;
    this.commit((s) => { s.route = route; });
  },

  majPrestation(idPrestation, champs) {
    this.commit((s) => {
      const p = s.projets.find((x) => x.id === s.projetActifId);
      if (!p) return;
      p.prestations[idPrestation] = {
        ...(p.prestations[idPrestation] || {}),
        ...champs,
        majLe: Dates.today(),
      };
    });
    this.pousser('prestations', `${this.state.projetActifId}:${idPrestation}`,
      this.projet().prestations[idPrestation]);
  },

  majProjet(champs, projetId) {
    const id = projetId || this.state.projetActifId;
    this.commit((s) => {
      const p = s.projets.find((x) => x.id === id);
      if (p) Object.assign(p, champs);
    });
    const p = this.projet(id);
    if (p) this.pousser('projets', p.id, this._ligneProjet(p));
  },

  /** Change la formule d'un projet et complète l'état des prestations ajoutées. */
  changerFormule(projetId, codeFormule) {
    const ajoutees = [];

    this.commit((s) => {
      const p = s.projets.find((x) => x.id === projetId);
      if (!p || !FORMULES[codeFormule]) return;
      p.formule = codeFormule;
      let curseur = 0;
      prestationsDeFormule(codeFormule).forEach((presta) => {
        curseur += presta.jours;
        if (!p.prestations[presta.id]) {
          p.prestations[presta.id] = {
            statut: 'a_faire',
            echeance: Dates.addDays(p.dateDebut, curseur),
            note: '', livrableUrl: '', majLe: Dates.today(),
          };
          ajoutees.push(presta.id);
        }
      });
      if (s.projetActifId === projetId && !this.moduleAccessible(s.route, projetId)) {
        s.route = 'dashboard';
      }
    });

    const p = this.projet(projetId);
    if (!p) return;

    // Une seule requête : la nouvelle formule et les prestations créées.
    this.pousserLot([
      { action: 'upsert', entite: 'projets', id: p.id, payload: this._ligneProjet(p) },
      ...ajoutees.map((idPresta) => ({
        action: 'upsert', entite: 'prestations',
        id: `${p.id}:${idPresta}`, payload: p.prestations[idPresta],
      })),
    ]);
  },

  /** Applique des valeurs en notation point\u00e9e (\u00ab client.nom \u00bb) \u00e0 un objet. */
  _appliquerChemins(cible, valeurs) {
    Object.keys(valeurs).forEach((chemin) => {
      const segments = chemin.split('.');
      let noeud = cible;
      segments.slice(0, -1).forEach((seg) => {
        if (typeof noeud[seg] !== 'object' || noeud[seg] === null) noeud[seg] = {};
        noeud = noeud[seg];
      });
      noeud[segments[segments.length - 1]] = valeurs[chemin];
    });
    return cible;
  },

  /** Enregistre la fiche client d'un projet existant. */
  majFicheClient(projetId, valeurs) {
    let formuleAvant = null;
    this.commit((s) => {
      const p = s.projets.find((x) => x.id === projetId);
      if (!p) return;
      formuleAvant = p.formule;
      const { formule, ...reste } = valeurs;
      this._appliquerChemins(p, reste);
      p.equipe = Number(p.equipe) || 0;
      p.surface = Number(p.surface) || 0;
    });

    // La formule passe par son propre chemin : elle cr\u00e9e des prestations.
    if (valeurs.formule && valeurs.formule !== formuleAvant) {
      this.changerFormule(projetId, valeurs.formule);
    } else {
      const p = this.projet(projetId);
      if (p) this.pousser('projets', p.id, this._ligneProjet(p));
    }
  },

  ajouterProjet(donnees) {
    const id = (donnees.nom || 'projet')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + idUnique('').slice(-5);

    this.commit((s) => {
      const debut = donnees.dateDebut || Dates.today();
      const type = donnees.type || 'MSP';
      const formule = donnees.formule || 'F1';

      const projet = {
        id,
        nom: donnees.nom,
        type,
        ville: '',
        departement: '',
        adresse: '',
        coords: [14.6415, -61.0242],
        reference: donnees.reference || `${type}-${Date.now().toString().slice(-6)}`,
        formule,
        options: { immobilier: formule === 'F3' },
        modeleJuridique: type === 'CDS' ? 'assoc' : 'sisa',
        dateDebut: debut,
        client: { nom: '', fonction: '', email: '', tel: '' },
        consultant: { nom: '', email: '' },
        equipe: 0,
        surface: 0,
        gdocProjetSante: '', driveUrl: '', siteUrl: '', notes: '',
        prestations: seedPrestations(formule, debut, 0),
      };

      // Les champs de la fiche arrivent en notation point\u00e9e.
      const { formule: _ignore, type: _ignore2, ...reste } = donnees;
      this._appliquerChemins(projet, reste);
      projet.equipe = Number(projet.equipe) || 0;
      projet.surface = Number(projet.surface) || 0;

      s.projets.push(projet);
      ['documents', 'signatures', 'messages', 'evenements', 'comptesRendus', 'financements', 'partenaires']
        .forEach((cle) => { s[cle][id] = []; });
      s.projetActifId = id;
      s.route = 'dashboard';
    });

    const p = this.projet(id);
    // Le projet et toutes ses prestations initiales, en une requête.
    this.pousserLot([
      { action: 'upsert', entite: 'projets', id, payload: this._ligneProjet(p) },
      ...Object.keys(p.prestations).map((idPresta) => ({
        action: 'upsert', entite: 'prestations',
        id: `${id}:${idPresta}`, payload: p.prestations[idPresta],
      })),
    ]);

    return id;
  },

  supprimerProjet(projetId) {
    let supprime = false;
    this.commit((s) => {
      if (s.projets.length <= 1) return;
      s.projets = s.projets.filter((p) => p.id !== projetId);
      ['documents', 'signatures', 'messages', 'evenements', 'comptesRendus', 'financements', 'partenaires']
        .forEach((cle) => { delete s[cle][projetId]; });
      if (s.projetActifId === projetId) s.projetActifId = s.projets[0].id;
      supprime = true;
    });
    // Le script retire aussi les lignes filles du projet dans les autres onglets.
    if (supprime) this.pousser('projets', projetId, null, 'delete');
  },

  /* --- Entités rattachées à un projet ---
     Chaque ajout ou modification est répercuté sous la clé « projet:id ». */

  _pousserItem(entite, item, mode) {
    this.pousser(entite, `${this.state.projetActifId}:${item.id}`, mode === 'delete' ? null : item, mode);
  },

  ajouterMessage(texte, auteur, role) {
    const msg = { id: idUnique('m'), auteur, role, texte, date: new Date().toISOString() };
    this.commit((s) => {
      const id = s.projetActifId;
      if (!s.messages[id]) s.messages[id] = [];
      s.messages[id].push(msg);
    });
    this._pousserItem('messages', { ...msg, date: msg.date.slice(0, 10) });
  },

  ajouterDocument(doc) {
    const item = { id: idUnique('doc'), date: Dates.today(), piece: '', ...doc };
    this.commit((s) => {
      const id = s.projetActifId;
      if (!s.documents[id]) s.documents[id] = [];
      s.documents[id].unshift(item);
    });
    this._pousserItem('documents', item);
  },

  majDocument(docId, champs) {
    this.commit((s) => {
      const d = (s.documents[s.projetActifId] || []).find((x) => x.id === docId);
      if (d) Object.assign(d, champs);
    });
    const d = this.liste('documents').find((x) => x.id === docId);
    if (d) this._pousserItem('documents', d);
  },

  supprimerDocument(docId) {
    this.commit((s) => {
      const id = s.projetActifId;
      s.documents[id] = (s.documents[id] || []).filter((d) => d.id !== docId);
    });
    this._pousserItem('documents', { id: docId }, 'delete');
  },

  majSignature(sigId, champs) {
    this.commit((s) => {
      const liste = s.signatures[s.projetActifId] || [];
      const sig = liste.find((x) => x.id === sigId);
      if (sig) Object.assign(sig, champs);
    });
    const sig = this.liste('signatures').find((x) => x.id === sigId);
    if (sig) this._pousserItem('signatures', sig);
  },

  ajouterEvenement(evt) {
    const item = {
      id: idUnique('e'),
      titre: '', type: 'echange', canal: 'visio', date: Dates.today(), heure: '', lieu: '', lien: '',
      ...evt,
    };
    this.commit((s) => {
      const id = s.projetActifId;
      if (!s.evenements[id]) s.evenements[id] = [];
      s.evenements[id].push(item);
      s.evenements[id].sort((a, b) => a.date.localeCompare(b.date));
    });
    this._pousserItem('evenements', item);
    return item;
  },

  ajouterCompteRendu(cr) {
    const item = {
      id: idUnique('cr'),
      date: Dates.today(), objet: '', type: 'visio', participants: '', decisions: '',
      statut: 'valide', lienMeet: '', lienDoc: '',
      ...cr,
    };
    this.commit((s) => {
      const id = s.projetActifId;
      if (!s.comptesRendus[id]) s.comptesRendus[id] = [];
      s.comptesRendus[id].unshift(item);
      s.comptesRendus[id].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    });
    this._pousserItem('comptesRendus', item);
    return item;
  },

  majCompteRendu(crId, champs) {
    this.commit((s) => {
      const cr = (s.comptesRendus[s.projetActifId] || []).find((x) => x.id === crId);
      if (cr) Object.assign(cr, champs);
    });
    const cr = this.liste('comptesRendus').find((x) => x.id === crId);
    if (cr) this._pousserItem('comptesRendus', cr);
  },

  supprimerCompteRendu(crId) {
    this.commit((s) => {
      const id = s.projetActifId;
      s.comptesRendus[id] = (s.comptesRendus[id] || []).filter((c) => c.id !== crId);
    });
    this._pousserItem('comptesRendus', { id: crId }, 'delete');
  },

  supprimerEvenement(evtId) {
    this.commit((s) => {
      const id = s.projetActifId;
      s.evenements[id] = (s.evenements[id] || []).filter((e) => e.id !== evtId);
    });
    this._pousserItem('evenements', { id: evtId }, 'delete');
  },

  ajouterFinancement(donnees) {
    const item = {
      id: idUnique('f'), source: donnees.source,
      montant: Number(donnees.montant) || 0,
      statut: donnees.statut || 'etude', echeance: donnees.echeance || '',
    };
    this.commit((s) => {
      const id = s.projetActifId;
      if (!s.financements[id]) s.financements[id] = [];
      s.financements[id].push(item);
    });
    this._pousserItem('financements', item);
  },

  majFinancement(finId, champs) {
    this.commit((s) => {
      const f = (s.financements[s.projetActifId] || []).find((x) => x.id === finId);
      if (f) Object.assign(f, champs);
    });
    const f = this.liste('financements').find((x) => x.id === finId);
    if (f) this._pousserItem('financements', f);
  },

  ajouterPartenaire(donnees) {
    const item = {
      id: idUnique('pa'), nom: donnees.nom, type: donnees.type,
      statut: donnees.statut || 'a_faire',
    };
    this.commit((s) => {
      const id = s.projetActifId;
      if (!s.partenaires[id]) s.partenaires[id] = [];
      s.partenaires[id].push(item);
    });
    this._pousserItem('partenaires', item);
  },

  majPartenaire(partId, champs) {
    this.commit((s) => {
      const p = (s.partenaires[s.projetActifId] || []).find((x) => x.id === partId);
      if (p) Object.assign(p, champs);
    });
    const p = this.liste('partenaires').find((x) => x.id === partId);
    if (p) this._pousserItem('partenaires', p);
  },

  /* ---- Recherche globale ---- */

  rechercher(terme) {
    const q = (terme || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const res = [];
    const ajoute = (type, icone, label, meta, route) => res.push({ type, icone, label, meta, route });

    this.modulesVisibles().forEach((m) => {
      if (m.label.toLowerCase().includes(q)) ajoute('Module', m.icone, m.label, 'Navigation', m.id);
    });

    this.prestations().forEach((p) => {
      if (p.titre.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)) {
        ajoute('Prestation', LOTS[p.lot].icone, p.titre, LOTS[p.lot].nom, 'feuille-route');
      }
    });

    this.liste('documents').forEach((d) => {
      if (d.nom.toLowerCase().includes(q)) ajoute('Document', 'fa-solid fa-file', d.nom, d.cat, 'documents');
    });

    this.liste('signatures').forEach((s) => {
      if (s.titre.toLowerCase().includes(q)) ajoute('Signature', 'fa-solid fa-file-signature', s.titre, STATUTS_SIGNATURE[s.statut]?.label || '', 'signatures');
    });

    this.state.prestataires.forEach((v) => {
      if (v.nom.toLowerCase().includes(q) || v.metier.toLowerCase().includes(q)) {
        ajoute('Prestataire', 'fa-solid fa-screwdriver-wrench', v.nom, v.metier, 'prestataires');
      }
    });

    FAQ.forEach((f) => {
      if (f.q.toLowerCase().includes(q) || f.r.toLowerCase().includes(q)) {
        ajoute('FAQ', 'fa-solid fa-circle-question', f.q, f.cat, 'faq');
      }
    });

    if (this.estExpert()) {
      this.state.projets.forEach((p) => {
        if (p.nom.toLowerCase().includes(q) || p.ville.toLowerCase().includes(q)) {
          ajoute('Projet', 'fa-solid fa-diagram-project', p.nom, `${p.ville} · ${FORMULES[p.formule].nom}`, 'admin-projets');
        }
      });
    }

    return res.slice(0, 12);
  },

  /* ---- Google Sheets ---- */

  /** Vrai lorsque les écritures doivent être répercutées vers la feuille. */
  ecritureActive() {
    const { source, webAppUrl } = this.state.reglages;
    return source === 'sheets' && !!webAppUrl;
  },

  /**
   * Répercute une modification vers Google Sheets si la source externe est active.
   * Sans effet en mode démonstration. L'échec n'interrompt jamais l'utilisateur :
   * la modification reste enregistrée localement et un message l'en informe.
   */
  /**
   * Obtient le lien d'accès d'un client, en le créant au besoin.
   * Sur source réelle c'est le serveur qui produit le jeton et l'inscrit dans
   * la feuille ; en démonstration on en fabrique un localement pour pouvoir
   * essayer la fonction.
   */
  async genererLienClient(projetId) {
    const projet = this.projet(projetId);
    if (!projet) throw new Error('projet introuvable');
    if (projet.jeton) return projet.jeton;

    let jeton;
    if (this.ecritureActive()) {
      const rep = await SheetsAdapter.envoyer(this.state.reglages.webAppUrl, {
        action: 'genererJeton', projetId, ...this.porteCles(),
      });
      jeton = rep.jeton;
      if (!jeton) throw new Error('le serveur n\'a pas renvoyé de lien');
    } else {
      jeton = 'demo' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    }

    this.commit((s) => {
      const p = s.projets.find((x) => x.id === projetId);
      if (p) p.jeton = jeton;
    });
    return jeton;
  },

  /**
   * Demande au serveur de créer l'arborescence Drive.
   * Sans identifiant de projet, tous ceux qui n'ont pas encore de dossier
   * sont traités. Réservé à l'expert par le script.
   */
  async creerDossiersDrive(projetId) {
    if (!this.ecritureActive()) {
      throw new Error('la source Google Sheets doit être connectée');
    }
    const rep = await SheetsAdapter.envoyer(this.state.reglages.webAppUrl, {
      action: 'creerDossiers', projetId: projetId || '', ...this.porteCles(),
    });

    // Le script renvoie les adresses créées : on les applique sans resynchroniser.
    this.commit((s) => {
      (rep.dossiers || []).forEach(({ id, url }) => {
        const p = s.projets.find((x) => x.id === id);
        if (p) p.driveUrl = url;
      });
    });

    return rep.dossiers || [];
  },

  /* ---- Équipe ElodiaTech ---- */

  /** Nom de tous les experts déclarés, pour les listes de choix. */
  nomsExperts() {
    return (this.state.experts || []).map((e) => e.nom).filter(Boolean);
  },

  expertParNom(nom) {
    return (this.state.experts || []).find((e) => e.nom === nom) || null;
  },

  ajouterExpert(donnees) {
    const item = {
      id: idUnique('exp'),
      nom: donnees.nom || '',
      fonction: donnees.fonction || '',
      email: donnees.email || '',
      tel: donnees.tel || '',
      principal: donnees.principal === 'OUI' ? 'OUI' : 'NON',
    };
    this.commit((s) => { s.experts.push(item); });
    this.pousser('experts', item.id, item);
    return item;
  },

  majExpert(id, champs) {
    this.commit((s) => {
      const e = s.experts.find((x) => x.id === id);
      if (e) Object.assign(e, champs);
    });
    const e = this.state.experts.find((x) => x.id === id);
    if (e) this.pousser('experts', e.id, e);
  },

  supprimerExpert(id) {
    // Un projet ne doit pas se retrouver sans référent identifiable.
    const expert = this.state.experts.find((x) => x.id === id);
    if (!expert) return { ok: false, raison: 'introuvable' };
    if (this.state.experts.length <= 1) {
      return { ok: false, raison: 'dernier' };
    }
    const rattaches = this.state.projets.filter((p) => p.consultant?.nom === expert.nom);
    if (rattaches.length) {
      return { ok: false, raison: 'rattache', projets: rattaches.map((p) => p.nom) };
    }

    this.commit((s) => { s.experts = s.experts.filter((x) => x.id !== id); });
    this.pousser('experts', id, null, 'delete');
    return { ok: true };
  },

  /* ---- Annuaire des prestataires ---- */

  ajouterPrestataire(donnees) {
    const item = {
      id: idUnique('v'),
      nom: donnees.nom || '',
      metier: donnees.metier || '',
      specialite: donnees.specialite || '',
      contact: donnees.contact || '',
      lot: donnees.lot || 'LE',
    };
    this.commit((s) => { s.prestataires.push(item); });
    this.pousser('prestataires', item.id, item);
    return item;
  },

  majPrestataire(id, champs) {
    this.commit((s) => {
      const v = s.prestataires.find((x) => x.id === id);
      if (v) Object.assign(v, champs);
    });
    const v = this.state.prestataires.find((x) => x.id === id);
    if (v) this.pousser('prestataires', v.id, v);
  },

  supprimerPrestataire(id) {
    this.commit((s) => { s.prestataires = s.prestataires.filter((x) => x.id !== id); });
    this.pousser('prestataires', id, null, 'delete');
  },

  /** Porte-clés à joindre à chaque requête : code expert ou jeton client. */
  porteCles() {
    const s = this.state.session || {};
    return s.cle ? { cle: s.cle } : (s.jeton ? { jeton: s.jeton } : {});
  },

  pousser(entite, id, payload, mode) {
    if (!this.ecritureActive()) return;
    SheetsAdapter.envoyer(this.state.reglages.webAppUrl, {
      action: mode || 'upsert', entite, id, payload, ...this.porteCles(),
    }).catch((err) => this._alerteEcriture(err));
  },

  /** Regroupe plusieurs écritures en une seule requête. */
  pousserLot(operations) {
    if (!this.ecritureActive() || !operations.length) return;
    SheetsAdapter.envoyer(this.state.reglages.webAppUrl,
      { action: 'batch', operations, ...this.porteCles() })
      .catch((err) => this._alerteEcriture(err));
  },

  _alerteEcriture(err) {
    if (typeof toast === 'function') {
      toast(`Écriture Google Sheets impossible (${err.message}). La modification est conservée localement.`, 'warn');
    }
  },

  /**
   * Représentation d'un projet sous forme de colonnes de la feuille.
   * On pousse toujours la ligne complète : plus sûr qu'un envoi partiel,
   * et idempotent si une écriture précédente s'est perdue.
   */
  _ligneProjet(projet) {
    return {
      nom: projet.nom,
      type: projet.type,
      ville: projet.ville,
      departement: projet.departement,
      adresse: projet.adresse,
      lat: projet.coords?.[0],
      lng: projet.coords?.[1],
      reference: projet.reference,
      formule: projet.formule,
      optionImmobilier: projet.options?.immobilier ? 'OUI' : 'NON',
      modeleJuridique: projet.modeleJuridique,
      dateDebut: projet.dateDebut,
      clientNom: projet.client?.nom,
      clientFonction: projet.client?.fonction,
      clientEmail: projet.client?.email,
      clientTel: projet.client?.tel,
      consultantNom: projet.consultant?.nom,
      consultantEmail: projet.consultant?.email,
      equipe: projet.equipe,
      surface: projet.surface,
      gdocProjetSante: projet.gdocProjetSante,
      driveUrl: projet.driveUrl,
      siteUrl: projet.siteUrl,
      notes: projet.notes,
    };
  },

  async synchroniser() {
    const { webAppUrl } = this.state.reglages;
    if (!webAppUrl) throw new Error("Aucune URL d'application web Google renseignée.");
    const data = await SheetsAdapter.chargerTout(webAppUrl, this.porteCles());
    this.commit((s) => {
      Object.keys(data).forEach((cle) => { if (cle in s) s[cle] = data[cle]; });
      s.reglages.derniereSync = new Date().toISOString();
      s.reglages.source = 'sheets';
      if (!s.projets.some((p) => p.id === s.projetActifId)) s.projetActifId = s.projets[0].id;
    });
    return data;
  },
};

/** Statuts spécifiques aux documents à signer. */
const STATUTS_SIGNATURE = {
  a_signer: { id: 'a_signer', label: 'À signer', couleur: 'warn', icone: 'fa-solid fa-pen-nib' },
  signe:    { id: 'signe',    label: 'Signé & archivé', couleur: 'ok', icone: 'fa-solid fa-circle-check' },
  refuse:   { id: 'refuse',   label: 'Refusé', couleur: 'danger', icone: 'fa-solid fa-ban' },
};

/** Statuts des demandes de financement. */
const STATUTS_FINANCEMENT = {
  etude:       { label: "À l'étude",     couleur: 'neutre' },
  depose:      { label: 'Déposé',        couleur: 'info' },
  instruction: { label: 'En instruction',couleur: 'warn' },
  accorde:     { label: 'Accordé',       couleur: 'ok' },
  refuse:      { label: 'Refusé',        couleur: 'danger' },
};

/** Statuts des conventions de partenariat. */
const STATUTS_PARTENAIRE = {
  a_faire:  { label: 'À initier',   couleur: 'neutre' },
  en_cours: { label: 'En cours',    couleur: 'info' },
  a_signer: { label: 'À signer',    couleur: 'warn' },
  signe:    { label: 'Signée',      couleur: 'ok' },
  valide:   { label: 'Validé',      couleur: 'ok' },
};
