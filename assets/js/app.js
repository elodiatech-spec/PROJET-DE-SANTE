/* ==========================================================================
   app.js — Coque applicative : navigation, interactions, modales, graphiques
   ========================================================================== */

const App = {
  filtres: {},        // filtres de la vue courante
  charts: {},         // instances Chart.js
  map: null,          // instance Leaflet

  /* ---------------------------------------------------------------------- */
  async init() {
    // Repéré avant le premier rendu : sans quoi les profils de démonstration
    // apparaîtraient une fraction de seconde devant un client venu par lien.
    this.lienPresente = new URLSearchParams(window.location.search).has('c');

    Store.init();
    Store.subscribe(() => this.render());

    this.brancherEvenements();
    this.appliquerTheme();
    this.render();

    // Un lien client dans l'adresse ouvre directement la session.
    if (await this.connexionParLien()) return;

    // Session en cours sur source réelle : les données n'ont pas été
    // conservées localement, on les redemande au serveur.
    if (Store.state.chargement) {
      try {
        await Store.revalider();
      } catch (err) {
        Store.deconnecter();
        this.erreurConnexion(`Votre session a expiré (${err.message}). Reconnectez-vous.`);
      }
    }
  },

  /* ======================================================================
     RENDU
     ====================================================================== */
  render() {
    const projet = Store.projet();
    if (!projet) return;

    this.appliquerTheme();

    // Hors session, l'application n'est pas rendue du tout : rien à voir,
    // rien à inspecter dans le DOM. Idem pendant la revalidation, tant que
    // le serveur n'a pas confirmé les droits.
    const connecte = Store.estConnecte() && !Store.state.chargement;
    document.body.classList.toggle('non-connecte', !connecte);
    document.body.classList.toggle('en-chargement', !!Store.state.chargement);
    if (!connecte) { this.renderConnexion(); return; }

    this.renderTopbar();
    this.renderSidebar();
    this.renderBreadcrumb();
    this.renderVue();
    this.renderNotifications();
  },

  /**
   * Liste des profils proposés sur l'écran de connexion.
   *
   * Cette liste nomme les porteurs de projet et leurs structures : elle ne doit
   * apparaître que sur le jeu de démonstration. Dès qu'une source Google Sheets
   * est branchée, les données sont réelles et la liste divulguerait le
   * portefeuille à quiconque ouvre la page. Seule la saisie de l'adresse reste
   * alors possible, et elle ne révèle rien.
   */
  renderConnexion() {
    const demo = Store.state.reglages.source !== 'sheets';

    // Le champ « code expert » n'a de sens qu'avec une source réelle.
    document.getElementById('connexion-champ-code').hidden = demo;

    // Les profils de démonstration nomment des clients : ils ne s'affichent
    // qu'en démonstration, et jamais devant quelqu'un venu par un lien.
    const bloc = document.getElementById('connexion-bloc-profils');
    bloc.hidden = !demo || this.lienPresente;
    if (bloc.hidden) return;

    const profils = [];

    // Un référent peut suivre plusieurs projets : on ne le propose qu'une fois.
    const referents = new Map();
    Store.state.projets.forEach((p) => {
      if (p.consultant?.nom && !referents.has(p.consultant.nom)) {
        referents.set(p.consultant.nom, { ...p.consultant, projetId: p.id });
      }
    });

    referents.forEach((c) => profils.push({
      role: 'expert', projetId: c.projetId, nom: c.nom,
      detail: 'Consultant ElodiaTech — espace expert', email: c.email || '',
    }));

    Store.state.projets.forEach((p) => profils.push({
      role: 'client', projetId: p.id, nom: p.client?.nom || p.nom,
      detail: `${p.nom} — espace client`, email: p.client?.email || '',
    }));

    document.getElementById('connexion-profils').innerHTML = profils.map((p) => `
      <button type="button" class="profil-connexion"
              data-action="connexion-profil"
              data-role="${esc(p.role)}" data-projet="${esc(p.projetId)}" data-email="${esc(p.email)}">
        <span class="avatar ${p.role === 'expert' ? 'avatar--admin' : ''}">${esc(initiales(p.nom))}</span>
        <span class="grow" style="min-width:0">
          <span class="profil-connexion__nom truncate">${esc(p.nom)}</span>
          <span class="profil-connexion__role truncate">${esc(p.detail)}</span>
        </span>
        <i class="fa-solid fa-chevron-right text-muted text-xs"></i>
      </button>`).join('');
  },

  renderTopbar() {
    const projet = Store.projet();
    const expert = Store.estExpert();
    const notifs = Store.notifications();

    // Sélecteur de projet : réservé à l'expert (le client n'a qu'un dossier).
    const selecteur = document.getElementById('project-selector-wrap');
    if (expert) {
      selecteur.hidden = false;
      const sel = document.getElementById('project-selector');
      sel.innerHTML = Store.state.projets
        .map((p) => `<option value="${esc(p.id)}" ${p.id === projet.id ? 'selected' : ''}>${esc(p.nom)} — ${esc(p.ville)}</option>`)
        .join('');
    } else {
      selecteur.hidden = true;
    }

    // Identité affichée — la fonction vient de la fiche de l'expert s'il est déclaré.
    const fiche = expert ? Store.expertParNom(projet.consultant?.nom) : null;
    const identite = expert
      ? {
          nom: projet.consultant?.nom || 'Expert ElodiaTech',
          role: fiche?.fonction || 'Consultant ElodiaTech',
        }
      : { nom: projet.client.nom, role: projet.client.fonction };

    document.getElementById('user-name').textContent = identite.nom;
    const av = document.getElementById('user-avatar');
    av.textContent = initiales(identite.nom);
    av.className = 'avatar' + (expert ? ' avatar--admin' : '');

    document.getElementById('sidebar-user-name').textContent = identite.nom;
    document.getElementById('sidebar-user-role').textContent = identite.role;
    const savatar = document.getElementById('sidebar-avatar');
    savatar.textContent = initiales(identite.nom);
    savatar.className = 'avatar avatar--lg' + (expert ? ' avatar--admin' : '');

    // Badge de rôle
    const badgeRole = document.getElementById('role-badge');
    badgeRole.innerHTML = expert
      ? '<i class="fa-solid fa-user-gear"></i><span class="hide-sm">Espace expert</span>'
      : '<i class="fa-solid fa-user"></i><span class="hide-sm">Espace client</span>';
    badgeRole.className = 'btn btn--sm ' + (expert ? 'btn--accent' : '');

    // Avancement global
    const pct = Store.avancement();
    document.getElementById('topbar-progress-value').textContent = pct + ' %';
    document.getElementById('topbar-progress-fill').style.width = pct + '%';

    // Compteur de notifications
    const badge = document.getElementById('notif-count');
    if (notifs.length) {
      badge.textContent = notifs.length;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }

    // Thème
    const iTheme = document.querySelector('#btn-theme i');
    iTheme.className = Store.state.theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    document.getElementById('btn-theme').setAttribute(
      'aria-label', Store.state.theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre');
  },

  renderSidebar() {
    const modules = Store.modulesVisibles();
    const projet = Store.projet();
    const route = Store.state.route;

    const compteurs = {
      'feuille-route': Store.actionsClient().length,
      signatures: Store.signaturesEnAttente().length,
    };

    const html = POLES.map((pole) => {
      const items = modules.filter((m) => m.pole === pole.id);
      if (!items.length) return '';
      return `
      <div class="nav-group">
        <div class="nav-group__title"><i class="${esc(pole.icone)}"></i> ${esc(pole.titre)}</div>
        ${items.map((m) => {
          const n = compteurs[m.id] || 0;
          return `<button class="nav-item ${m.id === route ? 'is-active' : ''} ${pole.id === 'console' ? 'nav-item--admin' : ''}"
                    data-action="aller" data-route="${esc(m.id)}" ${m.id === route ? 'aria-current="page"' : ''}>
              <i class="${esc(m.icone)}"></i>
              <span>${esc(m.label)}</span>
              ${n ? `<span class="nav-item__count">${n}</span>` : ''}
            </button>`;
        }).join('')}
      </div>`;
    }).join('');

    document.getElementById('sidebar-nav').innerHTML = html;

    // Encart référent / client
    const expert = Store.estExpert();
    document.getElementById('sidebar-footer').innerHTML = expert
      ? `<div class="card card--flat" style="padding:12px">
           <div class="text-xs text-muted fw-800">Client suivi</div>
           <strong class="text-sm">${esc(projet.client.nom)}</strong>
           <div class="text-xs text-muted">${esc(projet.client.fonction)}</div>
           <button class="btn btn--sm btn--block" style="margin-top:10px" data-action="aller" data-route="messagerie">
             <i class="fa-solid fa-paper-plane"></i> Écrire au client
           </button>
         </div>`
      : `<div class="card card--flat" style="padding:12px">
           <div class="text-xs text-muted fw-800">Votre référent</div>
           <strong class="text-sm">${esc(projet.consultant.nom)}</strong>
           <div class="text-xs text-muted">Consultant ElodiaTech</div>
           <button class="btn btn--sm btn--block" style="margin-top:10px" data-action="aller" data-route="messagerie">
             <i class="fa-solid fa-paper-plane"></i> Envoyer un message
           </button>
         </div>`;
  },

  renderBreadcrumb() {
    const route = Store.state.route;
    const mod = MODULES.find((m) => m.id === route);
    const pole = POLES.find((p) => p.id === mod?.pole);
    const projet = Store.projet();

    document.getElementById('breadcrumb').innerHTML = `
      <span><i class="fa-solid fa-house"></i> ${Store.estExpert() ? 'Espace expert' : 'Espace client'}</span>
      <span class="sep">/</span>
      <span class="hide-sm">${esc(projet.nom)}</span>
      <span class="sep hide-sm">/</span>
      <span>${esc(pole?.titre || '')}</span>
      <span class="sep">/</span>
      <strong>${esc(mod?.label || '')}</strong>`;
  },

  renderVue() {
    const route = Store.state.route;
    const racine = document.getElementById('view-root');

    // Garde-fou : le rendu ne doit jamais afficher un module hors périmètre
    // (formule non souscrite) ou réservé à l'expert.
    if (!Store.moduleAccessible(route) || !Views[route]) {
      racine.innerHTML = empty(
        'Module indisponible',
        "Ce module n'est pas accessible avec la formule souscrite ou avec votre profil.",
        'fa-solid fa-lock');
      return;
    }
    const vue = Views[route];

    racine.innerHTML = vue(this.filtres);
    document.title = `${MODULES.find((m) => m.id === route)?.label || ''} · ${APP.nom} ${APP.produit}`;

    // Post-traitements dépendant du DOM fraîchement injecté
    this.detruireCharts();
    if (document.getElementById('chart-statuts')) this.chartStatuts();
    if (document.getElementById('map')) this.initCarte();
    const chat = document.getElementById('chat');
    if (chat) chat.scrollTop = chat.scrollHeight;

    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  },

  renderNotifications() {
    const notifs = Store.notifications();
    const corps = document.getElementById('drawer-body');
    corps.innerHTML = notifs.length
      ? notifs.map((n) => `
          <button class="notif notif--${esc(n.ton)}" data-action="aller" data-route="${esc(n.route)}" data-close-drawer="1">
            <i class="${esc(n.icone)}" style="margin-top:2px"></i>
            <span class="grow">
              <span class="notif__title">${esc(n.titre)}</span>
              <span class="notif__text">${esc(n.texte)}</span>
            </span>
          </button>`).join('')
      : empty('Aucune notification', 'Vous êtes à jour.', 'fa-solid fa-bell-slash');
  },

  /* ======================================================================
     THÈME
     ====================================================================== */
  appliquerTheme() {
    document.documentElement.setAttribute('data-theme', Store.state.theme);
  },

  /* ======================================================================
     GRAPHIQUES
     ====================================================================== */
  detruireCharts() {
    Object.values(this.charts).forEach((c) => { try { c.destroy(); } catch { /* ignore */ } });
    this.charts = {};
  },

  couleurCss(nom) {
    return getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
  },

  chartStatuts() {
    if (typeof Chart === 'undefined') return;
    const rep = Store.repartitionStatuts();
    const cles = Object.keys(rep).filter((k) => rep[k] > 0);
    if (!cles.length) return;

    const couleurs = {
      a_faire: this.couleurCss('--border-strong') || '#94a3b8',
      en_cours: this.couleurCss('--info-500'),
      a_valider: this.couleurCss('--warn-500'),
      valide: this.couleurCss('--ok-500'),
      bloque: this.couleurCss('--danger-500'),
    };

    this.charts.statuts = new Chart(document.getElementById('chart-statuts'), {
      type: 'doughnut',
      data: {
        labels: cles.map((k) => STATUTS[k].label),
        datasets: [{
          data: cles.map((k) => rep[k]),
          backgroundColor: cles.map((k) => couleurs[k]),
          borderColor: this.couleurCss('--surface'),
          borderWidth: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: this.couleurCss('--text-soft'),
              boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle',
              font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" },
              padding: 14,
            },
          },
          tooltip: {
            callbacks: {
              label: (c) => ` ${c.label} : ${c.parsed} prestation${c.parsed > 1 ? 's' : ''}`,
            },
          },
        },
      },
    });
  },

  /* ======================================================================
     CARTE
     ====================================================================== */
  initCarte() {
    if (typeof L === 'undefined') return;
    const projet = Store.projet();
    const el = document.getElementById('map');
    if (!el) return;

    if (this.map) { try { this.map.remove(); } catch { /* ignore */ } this.map = null; }

    this.map = L.map(el, { scrollWheelZoom: false }).setView(projet.coords, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);
    L.marker(projet.coords).addTo(this.map)
      .bindPopup(`<strong>${esc(projet.nom)}</strong><br>${esc(projet.adresse || projet.ville)}`)
      .openPopup();

    setTimeout(() => this.map && this.map.invalidateSize(), 120);
  },

  /* ======================================================================
     NAVIGATION
     ====================================================================== */
  aller(route) {
    if (!Store.moduleAccessible(route)) {
      toast("Ce module n'est pas accessible avec la formule souscrite.", 'warn');
      return;
    }
    this.filtres = {};
    this.fermerSidebar();
    Store.setRoute(route);
  },

  ouvrirSidebar() {
    document.getElementById('sidebar').classList.add('is-open');
    document.getElementById('sidebar-backdrop').classList.add('is-open');
  },

  fermerSidebar() {
    document.getElementById('sidebar').classList.remove('is-open');
    document.getElementById('sidebar-backdrop').classList.remove('is-open');
  },

  basculerDrawer(forcer) {
    const d = document.getElementById('drawer');
    const ouvert = forcer !== undefined ? forcer : !d.classList.contains('is-open');
    d.classList.toggle('is-open', ouvert);
    d.setAttribute('aria-hidden', String(!ouvert));
  },

  /* ======================================================================
     ÉVÉNEMENTS
     ====================================================================== */
  brancherEvenements() {
    // --- Délégation des clics ---
    document.addEventListener('click', (e) => {
      const cible = e.target.closest('[data-action]');
      if (!cible || cible.tagName === 'SELECT') return;
      const action = cible.dataset.action;
      if (this.actions[action]) {
        e.preventDefault();
        this.actions[action].call(this, cible, e);
      }
      if (cible.dataset.closeDrawer) this.basculerDrawer(false);
    });

    // --- Délégation des changements (selects) ---
    document.addEventListener('change', (e) => {
      const cible = e.target.closest('[data-action]');
      if (cible && this.actions[cible.dataset.action]) {
        this.actions[cible.dataset.action].call(this, cible, e);
        return;
      }
      if (e.target.id === 'project-selector') Store.setProjet(e.target.value);
      if (['filtre-lot', 'filtre-statut'].includes(e.target.id)) this.majFiltres();
      if (['doc-cat'].includes(e.target.id)) this.majFiltresDocs();
      if (e.target.id === 'planning-projet') {
        this.filtres = { ...this.filtres, projet: e.target.value };
        this.renderVue();
      }
    });

    // --- Saisies filtrantes ---
    document.addEventListener('input', debounce((e) => {
      if (e.target.id === 'filtre-q') this.majFiltres();
      if (e.target.id === 'doc-q') this.majFiltresDocs();
      if (e.target.id === 'faq-q') this.majFiltresFaq();
      if (e.target.id === 'global-search') this.rechercheGlobale(e.target.value);
    }, 220));

    // --- Formulaires ---
    document.addEventListener('submit', (e) => {
      if (e.target.id === 'form-message') {
        e.preventDefault();
        this.envoyerMessage();
      }
      if (e.target.id === 'form-connexion') {
        e.preventDefault();
        this.connexionParEmail();
      }
    });

    // --- Bascule de thème depuis l'écran de connexion ---
    document.getElementById('connexion-theme')?.addEventListener('click', () => {
      Store.setTheme(Store.state.theme === 'dark' ? 'light' : 'dark');
    });

    // --- Clavier ---
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        Modal.close();
        this.basculerDrawer(false);
        this.fermerSidebar();
        this.fermerRecherche();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    });

    // --- Fermeture de la recherche au clic extérieur ---
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.topbar__search')) this.fermerRecherche();
    });

    // --- Redimensionnement : la carte doit se recalculer ---
    window.addEventListener('resize', debounce(() => {
      if (this.map) this.map.invalidateSize();
      if (window.innerWidth > 1024) this.fermerSidebar();
    }, 200));
  },

  /* ---- Filtres ---- */
  majFiltres() {
    this.filtres = {
      q: document.getElementById('filtre-q')?.value || '',
      lot: document.getElementById('filtre-lot')?.value || '',
      statut: document.getElementById('filtre-statut')?.value || '',
    };
    this.renderVue();
    document.getElementById('filtre-q')?.focus();
  },

  majFiltresDocs() {
    this.filtres = {
      q: document.getElementById('doc-q')?.value || '',
      cat: document.getElementById('doc-cat')?.value || '',
    };
    this.renderVue();
    document.getElementById('doc-q')?.focus();
  },

  majFiltresFaq() {
    this.filtres = { q: document.getElementById('faq-q')?.value || '' };
    this.renderVue();
    const champ = document.getElementById('faq-q');
    if (champ) { champ.focus(); champ.setSelectionRange(champ.value.length, champ.value.length); }
  },

  /* ---- Recherche globale ---- */
  rechercheGlobale(terme) {
    const boite = document.getElementById('search-results');
    const res = Store.rechercher(terme);

    if (!terme || terme.trim().length < 2) {
      boite.hidden = true;
      return;
    }

    boite.hidden = false;
    boite.innerHTML = res.length
      ? res.map((r) => `
          <button class="search-result" data-action="aller" data-route="${esc(r.route)}">
            <span class="search-result__icon"><i class="${esc(r.icone)}"></i></span>
            <span class="grow" style="text-align:left">
              <span class="search-result__label">${esc(r.label)}</span>
              <span class="search-result__meta">${esc(r.type)} · ${esc(r.meta)}</span>
            </span>
          </button>`).join('')
      : `<div class="search-empty">Aucun résultat pour « ${esc(terme)} »</div>`;
  },

  fermerRecherche() {
    const boite = document.getElementById('search-results');
    if (boite) boite.hidden = true;
  },

  /* ---- Connexion ---- */

  erreurConnexion(message) {
    const zone = document.getElementById('connexion-erreur');
    zone.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${esc(message)}`;
    zone.hidden = false;
  },

  /**
   * Un client arrive par son lien personnel : …/?c=JETON
   * Le jeton est retiré de l'adresse aussitôt lu, pour qu'il ne traîne pas
   * dans l'historique ni dans une capture d'écran.
   */
  async connexionParLien() {
    const params = new URLSearchParams(window.location.search);
    const jeton = params.get('c');
    if (!jeton) return false;

    // L'adresse de la passerelle peut voyager dans le lien lui-même.
    const passerelle = params.get('s');
    if (passerelle && /^https:\/\/script\.google\.com\//.test(passerelle)) {
      Store.commit((s) => {
        s.reglages.webAppUrl = passerelle;
        s.reglages.source = 'sheets';
      });
    }

    // Le jeton quitte la barre d'adresse aussitôt lu.
    history.replaceState(null, '', window.location.pathname);

    // Un lien a été présenté : la liste des profils de démonstration n'a plus
    // lieu d'être, même si la suite échoue.
    this.lienPresente = true;

    if (!Store.state.reglages.webAppUrl) {
      this.erreurConnexion(
        "Votre espace n'a pas pu être ouvert : l'application n'est pas reliée à sa base. "
        + 'Signalez-le à votre référent ElodiaTech, il vous renverra un lien valide.');
      return false;
    }

    try {
      await Store.connecterAuServeur({ jeton });
      toast('Bienvenue sur votre espace de suivi.', 'ok');
      return true;
    } catch (err) {
      this.erreurConnexion(
        `Ce lien ne fonctionne plus (${err.message}). `
        + 'Demandez-en un nouveau à votre référent ElodiaTech.');
      return false;
    }
  },

  async connexionParEmail() {
    const champEmail = document.getElementById('connexion-email');
    const champCode = document.getElementById('connexion-code');
    const zone = document.getElementById('connexion-erreur');
    const bouton = document.querySelector('#form-connexion button[type="submit"]');
    const code = champCode?.value.trim() || '';
    const surSheets = Store.state.reglages.source === 'sheets';

    zone.hidden = true;

    // --- Source réelle : c'est le serveur qui décide ---
    if (surSheets) {
      if (!code) {
        this.erreurConnexion("Saisissez votre code expert. Un client accède à son espace par son lien personnel.");
        champCode?.focus();
        return;
      }

      const libelle = bouton.innerHTML;
      bouton.disabled = true;
      bouton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Vérification…';

      try {
        const res = await Store.connecterAuServeur({ cle: code, identifiant: champEmail.value.trim() });
        toast(`Portefeuille chargé — ${res.projets} client${res.projets > 1 ? 's' : ''}.`, 'ok');
      } catch (err) {
        bouton.disabled = false;
        bouton.innerHTML = libelle;
        this.erreurConnexion(`Code refusé (${err.message}).`);
        champCode.value = '';
        champCode.focus();
      }
      return;
    }

    // --- Jeu de démonstration : identification locale, sans secret ---
    const profil = Store.identifier(champEmail.value);
    if (!profil) {
      this.erreurConnexion(this.lienPresente
        ? "L'application n'est pas reliée à sa base : votre dossier ne peut pas être ouvert "
          + 'depuis ce navigateur. Signalez-le à votre référent ElodiaTech.'
        : "Cette adresse n'est rattachée à aucun dossier. "
          + 'Choisissez un profil ci-dessous ou contactez votre référent ElodiaTech.');
      champEmail.focus();
      return;
    }

    Store.connecter({ role: profil.role, projetId: profil.projetId, identifiant: champEmail.value.trim() });
    toast(`Bienvenue, ${profil.nom}.`, 'ok');
  },

  /* ---- Lien d'accès client ---- */

  /**
   * Prépare les moyens de transmission. Rien n'est envoyé d'ici : le courriel
   * s'ouvre dans votre logiciel de messagerie, prêt à être relu puis expédié
   * par vous.
   */
  afficherLienClient(projet) {
    const base = window.location.origin + window.location.pathname;

    // Tant que WEB_APP_URL n'est pas renseignée dans config.js, le lien
    // transporte l'adresse de la passerelle : sans quoi le navigateur du
    // client ne saurait pas où interroger la base.
    const passerelle = Store.state.reglages.webAppUrl || '';
    const complement = (!WEB_APP_URL && passerelle)
      ? `&s=${encodeURIComponent(passerelle)}` : '';
    const lien = `${base}?c=${projet.jeton}${complement}`;
    const formule = FORMULES[projet.formule];
    const referent = projet.consultant?.nom || 'votre référent ElodiaTech';

    const objet = `Votre espace de suivi — ${projet.nom}`;
    const corpsMail =
      `Bonjour${projet.client?.nom ? ' ' + projet.client.nom : ''},\n\n`
      + `Votre espace de suivi en ligne est ouvert. Vous y retrouverez à tout moment :\n\n`
      + `  • l'avancement de votre projet de santé, prestation par prestation ;\n`
      + `  • les livrables produits par ElodiaTech ;\n`
      + `  • les documents de votre dossier ;\n`
      + `  • les rendez-vous à venir et les comptes rendus de nos échanges.\n\n`
      + `Votre accès personnel :\n${lien}\n\n`
      + `Ce lien vous est propre : conservez-le et ne le diffusez pas. `
      + `Il ne donne accès qu'à votre dossier.\n\n`
      + `Formule souscrite : ${formule.code} — ${formule.nom}.\n\n`
      + `Je reste à votre disposition.\n\n`
      + `${referent}\nElodiaTech — Ingénierie médicale`;

    const destinataire = projet.client?.email || '';
    const mailto = `mailto:${encodeURIComponent(destinataire)}`
      + `?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corpsMail)}`;

    // Gmail permet de désigner le compte expéditeur : l'invitation part bien
    // de l'adresse professionnelle, pas du compte personnel du navigateur.
    const expediteur = Store.expertParNom(projet.consultant?.nom)?.email
      || projet.consultant?.email || '';
    const gmail = 'https://mail.google.com/mail/'
      + (expediteur ? `?authuser=${encodeURIComponent(expediteur)}&` : '?')
      + `view=cm&fs=1&to=${encodeURIComponent(destinataire)}`
      + `&su=${encodeURIComponent(objet)}&body=${encodeURIComponent(corpsMail)}`;

    // Sans indicatif fiable, aucun lien : mieux vaut rien qu'un mauvais numéro.
    const numero = numeroInternational(projet.client?.tel, projet.client?.indicatif);
    const texteWa = `Bonjour, voici votre espace de suivi ElodiaTech pour ${projet.nom} : ${lien}`;
    const whatsapp = numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texteWa)}` : '';

    Modal.open({
      titre: `Accès de ${projet.client?.nom || projet.nom}`,
      soustitre: 'Ce lien ouvre son dossier, et lui seul.',
      corps: `
        <div class="field">
          <label class="field__label" for="lien-client-champ">Lien personnel</label>
          <div class="input-group">
            <input type="text" id="lien-client-champ" class="input--mono" readonly value="${esc(lien)}">
            <button class="btn btn--primary" data-action="copier-lien"><i class="fa-solid fa-copy"></i> Copier</button>
          </div>
        </div>

        <h4 class="section-title" style="margin:18px 0 10px"><i class="fa-solid fa-paper-plane"></i> Le lui transmettre</h4>
        <div class="stack-xs">
          <a class="file-row" href="${esc(gmail)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">
            <span class="file-icon" style="color:var(--danger-500)"><i class="fa-solid fa-envelope-open-text"></i></span>
            <span class="grow">
              <span class="text-sm fw-800" style="display:block">Par Gmail${expediteur ? '' : ' (compte par défaut)'}</span>
              <span class="text-xs text-muted">
                ${expediteur ? `Depuis ${esc(expediteur)}` : 'Aucune adresse dans votre fiche expert'}
                ${destinataire ? ` vers ${esc(destinataire)}` : ''}
              </span>
            </span>
            <i class="fa-solid fa-arrow-up-right-from-square text-muted text-xs"></i>
          </a>

          <a class="file-row" href="${esc(mailto)}" style="text-decoration:none">
            <span class="file-icon" style="color:var(--brand-500)"><i class="fa-solid fa-envelope"></i></span>
            <span class="grow">
              <span class="text-sm fw-800" style="display:block">Par votre logiciel de messagerie</span>
              <span class="text-xs text-muted">${destinataire
                ? `Message pré-rédigé à ${esc(destinataire)}`
                : "Aucune adresse dans la fiche — le message s'ouvrira sans destinataire"}</span>
            </span>
            <i class="fa-solid fa-arrow-up-right-from-square text-muted text-xs"></i>
          </a>

          ${whatsapp ? `
          <a class="file-row" href="${esc(whatsapp)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">
            <span class="file-icon" style="color:var(--ok-500)"><i class="fa-brands fa-whatsapp"></i></span>
            <span class="grow">
              <span class="text-sm fw-800" style="display:block">Par WhatsApp</span>
              <span class="text-xs text-muted">Message pré-rédigé au +${esc(numero)}</span>
            </span>
            <i class="fa-solid fa-arrow-up-right-from-square text-muted text-xs"></i>
          </a>`
          : `
          <div class="file-row" style="opacity:.7">
            <span class="file-icon" style="color:var(--text-muted)"><i class="fa-brands fa-whatsapp"></i></span>
            <span class="grow">
              <span class="text-sm fw-800" style="display:block">Par WhatsApp — indisponible</span>
              <span class="text-xs text-muted">
                ${projet.client?.tel
                  ? "Le numéro est incomplet. Vérifiez l'indicatif pays dans la fiche client."
                  : 'Aucun téléphone dans la fiche client.'}
              </span>
            </span>
            <button class="btn btn--sm" data-action="fiche-client" data-id="${esc(projet.id)}">Ouvrir la fiche</button>
          </div>`}
        </div>

        <div class="card card--flat" style="margin-top:16px;border-left:3px solid var(--warn-500)">
          <p class="text-sm text-soft">
            Ce lien tient lieu de mot de passe : toute personne qui l'obtient accède au dossier.
            Ne le publiez pas et ne le mettez pas dans un message collectif.
          </p>
          <p class="text-sm text-muted" style="margin-top:8px">
            Pour l'invalider : videz la cellule « jeton » de ce projet dans la feuille,
            puis rouvrez cette fenêtre — un nouveau lien sera créé et l'ancien cessera de fonctionner.
          </p>
        </div>`,
      actions: '<button class="btn" data-action="fermer-modal">Fermer</button>',
    });
  },

  /* ---- Messagerie ---- */
  envoyerMessage() {
    const champ = document.getElementById('message-input');
    const texte = champ.value.trim();
    if (!texte) return;

    const projet = Store.projet();
    const expert = Store.estExpert();
    Store.ajouterMessage(texte, expert ? projet.consultant.nom : projet.client.nom, expert ? 'expert' : 'client');
    champ.value = '';
    setTimeout(() => document.getElementById('message-input')?.focus(), 30);
  },

  /* ======================================================================
     ACTIONS (data-action="…")
     ====================================================================== */
  actions: {

    /* --- Navigation & coque --- */
    aller(el) { App.aller(el.dataset.route); },

    'toggle-sidebar'() {
      const ouvert = document.getElementById('sidebar').classList.contains('is-open');
      ouvert ? App.fermerSidebar() : App.ouvrirSidebar();
    },

    'fermer-sidebar'() { App.fermerSidebar(); },

    'toggle-theme'() {
      Store.setTheme(Store.state.theme === 'dark' ? 'light' : 'dark');
    },

    'toggle-drawer'() { App.basculerDrawer(); },

    imprimer() { window.print(); },

    /* --- Rôles --- */
    'changer-role'() {
      const projet = Store.projet();

      // Une session cliente réelle n'a qu'un espace : rien à choisir, pas de
      // bouton qui suggérerait le contraire. Juste son compte et la sortie.
      if (Store.estClientReel()) {
        Modal.open({
          titre: projet.client.nom,
          soustitre: projet.client.fonction || 'Votre espace de suivi',
          corps: `
            <div class="file-row">
              <div class="avatar avatar--lg">${esc(initiales(projet.client.nom))}</div>
              <div class="grow">
                <div class="text-sm fw-800">${esc(projet.nom)}</div>
                <div class="text-xs text-muted">${esc(projet.ville)}</div>
              </div>
            </div>`,
          actions: `<button class="btn btn--danger" data-action="se-deconnecter">
                      <i class="fa-solid fa-arrow-right-from-bracket"></i> Se déconnecter
                    </button>`,
        });
        return;
      }

      Modal.open({
        titre: 'Changer d\'espace',
        soustitre: 'Cette bascule permet de visualiser la plateforme telle que la voit chaque profil.',
        corps: `
          <div class="stack-xs">
            <button class="file-row" style="width:100%;text-align:left" data-action="definir-role" data-role="client">
              <div class="avatar avatar--lg">${esc(initiales(projet.client.nom))}</div>
              <div class="grow">
                <div class="text-sm fw-800">${esc(projet.client.nom)}</div>
                <div class="text-xs text-muted">${esc(projet.client.fonction)} — espace client</div>
              </div>
              ${Store.state.role === 'client' ? badge('Actif', 'ok', 'fa-solid fa-check') : '<i class="fa-solid fa-chevron-right text-muted"></i>'}
            </button>
            <button class="file-row" style="width:100%;text-align:left" data-action="definir-role" data-role="expert">
              <div class="avatar avatar--lg avatar--admin">${esc(initiales(projet.consultant.nom))}</div>
              <div class="grow">
                <div class="text-sm fw-800">${esc(projet.consultant.nom)}</div>
                <div class="text-xs text-muted">Consultant ElodiaTech — espace expert</div>
              </div>
              ${Store.state.role === 'expert' ? badge('Actif', 'ok', 'fa-solid fa-check') : '<i class="fa-solid fa-chevron-right text-muted"></i>'}
            </button>
          </div>
          <p class="text-xs text-muted" style="margin-top:14px">
            <i class="fa-solid fa-circle-info"></i>
            L'espace client masque la console de gestion, les champs d'administration et les autres dossiers du portefeuille.
          </p>`,
        actions: `<button class="btn btn--danger" data-action="se-deconnecter">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i> Se déconnecter
                  </button>`,
      });
    },

    'definir-role'(el) {
      Modal.close();
      App.filtres = {};
      Store.setRole(el.dataset.role);
      toast(el.dataset.role === 'expert' ? 'Espace expert activé.' : 'Espace client activé.', 'ok');
    },

    'connexion-profil'(el) {
      App.filtres = {};
      Store.connecter({
        role: el.dataset.role,
        projetId: el.dataset.projet,
        identifiant: el.dataset.email,
      });
    },

    'se-deconnecter'() {
      Modal.close();
      App.filtres = {};
      Store.deconnecter();
      const champ = document.getElementById('connexion-email');
      if (champ) champ.value = '';
      const erreur = document.getElementById('connexion-erreur');
      if (erreur) erreur.hidden = true;
    },

    /* --- Prestations --- */
    'changer-statut'(el) {
      Store.majPrestation(el.dataset.id, { statut: el.value });
      toast(`Statut mis à jour : ${STATUTS[el.value].label}.`, 'ok');
    },

    'valider-prestation'(el) {
      Store.majPrestation(el.dataset.id, { statut: 'valide' });
      const p = PRESTATIONS.find((x) => x.id === el.dataset.id);
      toast(`« ${p?.titre || 'Prestation'} » validée. Merci !`, 'ok');
    },

    'detail-prestation'(el) {
      const p = Store.prestations().find((x) => x.id === el.dataset.id);
      if (!p) return;
      const expert = Store.estExpert();
      const lot = LOTS[p.lot];

      Modal.open({
        titre: p.titre,
        soustitre: `${lot.nom} · livrable : ${p.livrable}`,
        corps: `
          <p class="text-sm text-soft">${esc(p.desc)}</p>
          <div class="grid grid-2" style="margin-top:16px">
            <div><span class="text-xs text-muted">Statut</span><br>${badgeStatut(p.etat.statut)}</div>
            <div><span class="text-xs text-muted">Charge indicative</span><br><strong class="text-sm">${p.jours} jours</strong></div>
            <div><span class="text-xs text-muted">Intervenant</span><br><strong class="text-sm">${esc({ expert: 'ElodiaTech', client: 'Le client', mixte: 'Co-construction' }[p.acteur])}</strong></div>
            <div><span class="text-xs text-muted">Dernière mise à jour</span><br><strong class="text-sm">${esc(Dates.format(p.etat.majLe))}</strong></div>
          </div>
          ${expert ? `
            <div class="stack-sm" style="margin-top:18px">
              <div class="grid grid-2">
                <div class="field">
                  <label class="field__label" for="pd-echeance">Échéance prévisionnelle</label>
                  <input type="date" id="pd-echeance" value="${esc(p.etat.echeance || '')}">
                </div>
                <div class="field">
                  <label class="field__label" for="pd-realisation">Date de réalisation</label>
                  <input type="date" id="pd-realisation" value="${esc(p.etat.dateRealisation || '')}">
                  <span class="field__hint">La date où le travail a réellement été fait — distincte de l'échéance visée.</span>
                </div>
              </div>
              <!-- Le « Lien du livrable » a été retiré : les pièces se déposent
                   désormais depuis la prestation ou le coffre-fort, et le fichier
                   part dans le bon sous-dossier Drive. Coller une adresse à la
                   main ne rangeait rien. -->
              <div class="field">
                <label class="field__label" for="pd-note">Note de suivi</label>
                <textarea id="pd-note" placeholder="Point d'avancement, blocage, prochaine étape…">${esc(p.etat.note || '')}</textarea>
              </div>
            </div>` : `
            <div class="grid grid-2" style="margin-top:16px">
              ${p.etat.dateRealisation ? `<div><span class="text-xs text-muted">Réalisée le</span><br><strong class="text-sm">${esc(Dates.format(p.etat.dateRealisation))}</strong></div>` : ''}
            </div>
            ${p.etat.note ? `<div class="card card--flat" style="margin-top:16px">
                <div class="text-xs text-muted fw-800">Note de votre référent</div>
                <p class="text-sm">${esc(p.etat.note)}</p>
              </div>` : ''}
            ${urlSure(p.etat.livrableUrl) ? `<a class="btn btn--primary" style="margin-top:14px" href="${esc(urlSure(p.etat.livrableUrl))}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Consulter le livrable</a>` : ''}
          `}`,
        actions: expert
          ? `<button class="btn" data-action="fermer-modal">Annuler</button>
             <button class="btn btn--primary" data-action="enregistrer-prestation" data-id="${esc(p.id)}"><i class="fa-solid fa-floppy-disk"></i> Enregistrer</button>`
          : `<button class="btn" data-action="fermer-modal">Fermer</button>`,
      });
    },

    'enregistrer-prestation'(el) {
      // `livrableUrl` n'est plus saisissable ici, et n'est donc pas écrit :
      // l'envoyer à vide effacerait les adresses déjà enregistrées.
      Store.majPrestation(el.dataset.id, {
        echeance: document.getElementById('pd-echeance')?.value || '',
        dateRealisation: document.getElementById('pd-realisation')?.value || '',
        note: document.getElementById('pd-note')?.value.trim() || '',
      });
      Modal.close();
      toast('Prestation mise à jour.', 'ok');
    },

    'filtrer-lot'(el) {
      App.filtres = { ...App.filtres, lot: App.filtres.lot === el.dataset.lot ? '' : el.dataset.lot };
      App.renderVue();
    },

    'reset-filtres'() { App.filtres = {}; App.renderVue(); },

    'planifier-echeances'() {
      const projet = Store.projet();
      Modal.confirmer({
        titre: 'Recalculer le rétroplanning',
        texte: `Les échéances de toutes les prestations non validées seront recalculées à partir d'aujourd'hui, en suivant la charge indicative de chaque prestation. Les prestations déjà validées ne sont pas modifiées.`,
        libelle: 'Recalculer',
        onConfirm: () => {
          let curseur = 0;
          Store.commit((s) => {
            const p = s.projets.find((x) => x.id === projet.id);
            Store.prestations(projet.id).forEach((presta) => {
              if (presta.etat.statut === 'valide') return;
              curseur += presta.jours;
              p.prestations[presta.id] = {
                ...p.prestations[presta.id],
                echeance: Dates.addDays(Dates.today(), curseur),
              };
            });
          });
          toast('Rétroplanning recalculé.', 'ok');
        },
      });
    },

    /* --- Projet de santé / identité --- */
    'enregistrer-gdoc'() {
      const url = document.getElementById('gdoc-url').value.trim();
      Store.majProjet({ gdocProjetSante: url });
      toast(url ? 'Lien du projet de santé enregistré.' : 'Lien supprimé.', 'ok');
    },

    /**
     * Enregistre le lien du document et la date de livraison d'un chapitre.
     *
     * Le chapitre est porté par l'entité documents sous « CHAP01 », et sa date
     * de livraison par le champ `date` de cette ligne. Une date peut donc être
     * annoncée avant que le document n'existe. Vider les deux champs retire la
     * ligne : un chapitre sans lien ni date n'a rien à dire.
     */
    'enregistrer-chapitre'(el) {
      const num = el.dataset.num;
      const champUrl = document.querySelector(`[data-chapitre-url="${num}"]`);
      if (!champUrl) return;

      const url = champUrl.value.trim();
      const date = document.querySelector(`[data-chapitre-date="${num}"]`)?.value || '';
      const existant = documentDeChapitre(num);

      if (url && !urlSure(url)) {
        toast('Adresse invalide : elle doit commencer par http:// ou https://', 'warn');
        return;
      }

      if (!url && !date) {
        if (existant) {
          Store.supprimerDocument(existant.id);
          toast(`Chapitre ${num} : lien et date retirés.`, 'ok');
        }
        return;
      }

      const chapitre = CHAPITRES_PDS.find((c) => c.num === num);
      const nom = `Chapitre ${num} — ${chapitre?.titre || ''}`;

      if (existant) {
        Store.majDocument(existant.id, { url, nom, date, type: formatFichier(url) || 'doc' });
      } else {
        Store.ajouterDocument({
          nom, url, date, cat: 'Projet',
          type: formatFichier(url) || 'doc',
          taille: '—',
          piece: `CHAP${num}`,
          auteur: Store.projet().consultant?.nom || '',
        });
      }

      toast(`Chapitre ${num} enregistré${date ? ` — livraison le ${Dates.format(date)}` : ''}.`, 'ok');
    },

    'enregistrer-site'() {
      const url = document.getElementById('site-url').value.trim();
      Store.majProjet({ siteUrl: url });
      toast('Adresse du site enregistrée.', 'ok');
    },

    'modele-juridique'(el) {
      Store.majProjet({ modeleJuridique: el.dataset.modele });
      toast(`Modèle juridique : ${MODELES_JURIDIQUES[el.dataset.modele].nom}.`, 'ok');
    },

    'desactiver-immobilier'() {
      Modal.confirmer({
        titre: 'Désactiver le module immobilier',
        texte: "Le module disparaîtra de la navigation du client. Vous pourrez le réactiver depuis « Offres & périmètres ».",
        libelle: 'Désactiver',
        onConfirm: () => {
          const projet = Store.projet();
          Store.majProjet({ options: { ...projet.options, immobilier: false } });
          App.aller('dashboard');
          toast('Module immobilier désactivé.', 'ok');
        },
      });
    },

    /* --- Financements --- */
    'cycle-financement'(el) {
      const cycle = ['etude', 'depose', 'instruction', 'accorde'];
      const f = Store.liste('financements').find((x) => x.id === el.dataset.id);
      if (!f) return;
      Store.majFinancement(el.dataset.id, {
        statut: cycle[(cycle.indexOf(f.statut) + 1) % cycle.length],
      });
    },

    'ajouter-financement'(el) {
      Modal.formulaire({
        titre: el?.dataset.autre ? 'Autres sources de financements' : 'Nouvelle demande de financement',
        soustitre: el?.dataset.autre
          ? "Une source repérée en dehors des guichets habituels : elle rejoint le même suivi ci-dessous."
          : undefined,
        champs: [
          { id: 'source', label: 'Guichet / source', type: 'text', requis: true, placeholder: 'FIR — ARS Martinique' },
          { id: 'montant', label: 'Montant sollicité (€)', type: 'number', requis: true, placeholder: '120000' },
          { id: 'echeance', label: 'Échéance', type: 'date' },
          { id: 'statut', label: 'Statut', type: 'select', options: Object.entries(STATUTS_FINANCEMENT).map(([v, o]) => ({ v, l: o.label })) },
        ],
        onSubmit: (v) => {
          Store.ajouterFinancement(v);
          toast('Demande de financement ajoutée.', 'ok');
        },
      });
    },

    /* --- Partenaires --- */
    'cycle-partenaire'(el) {
      const cycle = ['a_faire', 'en_cours', 'a_signer', 'signe'];
      const p = Store.liste('partenaires').find((x) => x.id === el.dataset.id);
      if (!p) return;
      Store.majPartenaire(el.dataset.id, {
        statut: cycle[(cycle.indexOf(p.statut) + 1) % cycle.length],
      });
    },

    'ajouter-partenaire'() {
      Modal.formulaire({
        titre: 'Nouveau partenaire',
        champs: [
          { id: 'nom', label: 'Nom du partenaire', type: 'text', requis: true, placeholder: 'CCAS du Lamentin' },
          { id: 'type', label: 'Type', type: 'text', requis: true, placeholder: 'Collectivité, établissement hospitalier…' },
          { id: 'statut', label: 'Statut', type: 'select', options: Object.entries(STATUTS_PARTENAIRE).map(([v, o]) => ({ v, l: o.label })) },
        ],
        onSubmit: (v) => {
          Store.ajouterPartenaire(v);
          toast('Partenaire ajouté.', 'ok');
        },
      });
    },

    /* --- Documents --- */
    /**
     * Dépôt direct : le fichier choisi sur le poste part dans le sous-dossier
     * Drive de sa catégorie, et son nom, son format et sa taille sont lus sur
     * le fichier lui-même — plus rien à ressaisir à la main.
     */
    'televerser-documents'() {
      const projet = Store.projet();
      Modal.televersement({
        categorie: App.filtres.cat || 'Projet',
        onFichier: (reference, categorie) => {
          Store.ajouterDocument({
            nom: reference.nom,
            cat: categorie,
            type: formatFichier(reference.nom),
            url: reference.url,
            taille: reference.taille,
            auteur: Store.estExpert() ? projet.consultant?.nom : projet.client?.nom,
          });
        },
      });
    },

    'ajouter-document'() {
      Modal.formulaire({
        titre: 'Référencer un document',
        soustitre: "Le fichier reste hébergé sur votre Drive : seule sa référence est enregistrée ici.",
        champs: [
          { id: 'nom', label: 'Nom du fichier', type: 'text', requis: true, placeholder: 'Projet_de_sante_V1.pdf' },
          { id: 'cat', label: 'Catégorie', type: 'select', options: CATEGORIES_DOC.map((c) => ({ v: c, l: c })) },
          { id: 'type', label: 'Format', type: 'select', options: [
            { v: 'pdf', l: 'PDF' }, { v: 'doc', l: 'Document texte' }, { v: 'xls', l: 'Tableur' },
            { v: 'img', l: 'Image' }, { v: 'zip', l: 'Archive' }] },
          { id: 'url', label: 'Lien du fichier (facultatif)', type: 'url', placeholder: 'https://drive.google.com/…' },
          { id: 'taille', label: 'Taille (facultatif)', type: 'text', placeholder: '2,4 Mo' },
        ],
        onSubmit: (v) => {
          const projet = Store.projet();
          Store.ajouterDocument({
            nom: v.nom, cat: v.cat || 'Projet', type: v.type || 'pdf',
            url: v.url || '', taille: v.taille || '—',
            auteur: Store.estExpert() ? projet.consultant.nom : projet.client.nom,
          });
          toast('Document référencé.', 'ok');
        },
      });
    },

    /**
     * Rattache un document à une pièce du dossier.
     * Le fichier reste sur le Drive : on n'enregistre que sa référence, et
     * l'identifiant de la pièce qu'il satisfait.
     */
    /**
     * Téléverse une pièce du dossier depuis le poste, directement dans le
     * sous-dossier Drive de sa catégorie. C'est le chemin que suit le client :
     * il n'a rien à ranger lui-même, ni aucun droit Drive à recevoir.
     */
    'televerser-piece'(el) {
      const piece = Store.pieces().find((p) => p.id === el.dataset.piece);
      if (!piece) return;

      if (!Store.ecritureActive()) {
        toast('Le téléversement demande la connexion Google Sheets. '
          + 'Sans elle, utilisez « Référencer ».', 'warn');
        return;
      }

      const projet = Store.projet();

      Modal.televersement({
        categorie: piece.cat,
        titre: `Téléverser — ${piece.nom}`,
        soustitre: `${piece.aide ? piece.aide + ' ' : ''}Le fichier part dans le sous-dossier `
                 + `« ${piece.cat} » du Drive du projet. ${formaterOctets(TAILLE_MAX_DEPOT)} au maximum par fichier.`,
        onFichier: (reference, categorieChoisie) => {
          Store.ajouterDocument({
            nom: reference.nom,
            cat: categorieChoisie,
            type: formatFichier(reference.nom),
            url: reference.url,
            taille: reference.taille,
            piece: piece.id,
            auteur: Store.estExpert() ? projet.consultant?.nom : projet.client?.nom,
          });
        },
      });
    },

    /**
     * Demande de pièce propre à un dossier : création si aucun identifiant,
     * modification sinon. Le socle du catalogue n'est pas modifiable ici — il
     * vaut pour tous les clients.
     */
    'fiche-piece'(el) {
      const pieceId = el.dataset.piece;
      const piece = pieceId ? Store.pieces().find((p) => p.id === pieceId) : null;

      if (piece && !piece.sur_mesure) {
        toast('Cette pièce fait partie du socle commun : elle ne se modifie pas dossier par dossier.', 'warn');
        return;
      }

      Modal.formulaire({
        titre: piece ? `Modifier — ${piece.nom}` : 'Demander une pièce',
        soustitre: piece
          ? 'Cette demande ne concerne que ce dossier.'
          : "La pièce apparaîtra dans le dossier du client, qui pourra la téléverser directement.",
        champs: [
          { id: 'nom', label: 'Pièce demandée', type: 'text', requis: true,
            valeur: piece?.nom || '', placeholder: 'Attestation URSSAF de vigilance' },
          { id: 'aide', label: 'Précision pour le client', type: 'textarea',
            valeur: piece?.aide || '',
            placeholder: 'À demander sur votre espace URSSAF, datée de moins de six mois.' },
          { id: 'cat', label: 'Catégorie — décide du sous-dossier Drive', type: 'select',
            valeur: piece?.cat || 'Juridique',
            options: CATEGORIES_DOC.map((c) => ({ v: c, l: c })) },
          { id: 'par', label: 'Qui la fournit', type: 'select',
            valeur: piece?.par || 'client',
            options: [
              { v: 'client', l: 'Le client' },
              { v: 'expert', l: 'ElodiaTech' },
            ] },
          { id: 'pour', label: 'Dossiers concernés (facultatif)', type: 'text',
            valeur: (piece?.pour || []).join(', '),
            placeholder: 'ARS, FIR, FEDER' },
        ],
        libelle: piece ? 'Enregistrer' : 'Ajouter la demande',
        onSubmit: (v) => {
          const donnees = {
            ...v,
            pour: v.pour.split(',').map((x) => x.trim()).filter(Boolean),
          };
          if (piece) {
            Store.majPiece(piece.id, donnees);
            toast('Demande mise à jour.', 'ok');
          } else {
            Store.ajouterPiece(donnees);
            toast(`« ${donnees.nom} » demandée au dossier.`, 'ok');
          }
        },
      });
    },

    'supprimer-piece'(el) {
      const piece = Store.pieces().find((p) => p.id === el.dataset.piece);
      if (!piece || !piece.sur_mesure) return;

      Modal.confirmer({
        titre: 'Retirer la demande',
        texte: `« ${piece.nom} » ne sera plus demandée dans ce dossier.`
             + (piece.document
                 ? ` Le document déjà fourni reste dans le coffre-fort, simplement détaché.`
                 : ''),
        libelle: 'Retirer',
        danger: true,
        onConfirm: () => {
          Store.supprimerPiece(piece.id);
          toast('Demande retirée.', 'ok');
        },
      });
    },

    'deposer-piece'(el) {
      const piece = Store.pieces().find((p) => p.id === el.dataset.piece);
      if (!piece) return;

      const projet = Store.projet();
      const dejaLa = Store.liste('documents').filter((d) => !d.piece);

      Modal.formulaire({
        titre: `Déposer — ${piece.nom}`,
        soustitre: piece.aide,
        champs: [
          { id: 'existant', label: 'Un document déjà présent dans le coffre-fort ?', type: 'select',
            options: [{ v: '', l: '— Non, je référence un nouveau fichier —' }]
              .concat(dejaLa.map((d) => ({ v: d.id, l: d.nom }))) },
          { id: 'nom', label: 'Nom du fichier', type: 'text',
            placeholder: 'RIB_structure.pdf' },
          { id: 'url', label: 'Lien du fichier sur le Drive', type: 'url',
            placeholder: 'https://drive.google.com/…' },
          { id: 'type', label: 'Format', type: 'select', valeur: 'pdf', options: [
            { v: 'pdf', l: 'PDF' }, { v: 'doc', l: 'Document texte' }, { v: 'xls', l: 'Tableur' },
            { v: 'img', l: 'Image' }, { v: 'zip', l: 'Archive' }] },
        ],
        libelle: 'Rattacher',
        onSubmit: (v) => {
          // Soit on marque un document déjà référencé, soit on en crée un.
          if (v.existant) {
            Store.majDocument(v.existant, { piece: piece.id, cat: piece.cat });
          } else {
            if (!v.nom.trim()) { toast('Indiquez au moins le nom du fichier.', 'warn'); return; }
            Store.ajouterDocument({
              nom: v.nom, cat: piece.cat, type: v.type || 'pdf',
              url: v.url || '', taille: '—', piece: piece.id,
              auteur: Store.estExpert() ? projet.consultant?.nom : projet.client?.nom,
            });
          }
          toast(`« ${piece.nom} » enregistrée.`, 'ok');
        },
      });
    },

    'detacher-piece'(el) {
      const doc = Store.liste('documents').find((d) => d.piece === el.dataset.piece);
      if (!doc) return;
      Store.majDocument(doc.id, { piece: '' });
      toast('Document détaché — il reste dans le coffre-fort.', 'ok');
    },

    'supprimer-document'(el) {
      const doc = Store.liste('documents').find((d) => d.id === el.dataset.id);
      Modal.confirmer({
        titre: 'Supprimer la référence',
        texte: `« ${doc?.nom || 'Ce document'} » sera retiré de la liste. Le fichier d'origine sur le Drive n'est pas supprimé.`,
        libelle: 'Supprimer',
        danger: true,
        onConfirm: () => { Store.supprimerDocument(el.dataset.id); toast('Référence supprimée.', 'ok'); },
      });
    },

    /**
     * Dépose le justificatif d'une prestation dans le sous-dossier Drive de sa
     * catégorie, et le rattache à la prestation par le champ « piece » de
     * l'entité documents. La pièce apparaît alors sous la prestation et dans
     * le coffre-fort, sans double saisie.
     */
    'deposer-justificatif'(el) {
      const presta = Store.prestations().find((x) => x.id === el.dataset.id);
      if (!presta) return;

      if (!Store.ecritureActive()) {
        toast('Le dépôt direct demande la connexion Google Sheets. '
          + 'Sans elle, référencez le lien depuis le coffre-fort.', 'warn');
        return;
      }

      const projet = Store.projet();
      const categorie = categorieDePrestation(presta);

      Modal.televersement({
        categorie,
        titre: `Justificatif — ${presta.titre}`,
        soustitre: `Le fichier part dans le sous-dossier « ${categorie} » du Drive du projet `
                 + `et reste rattaché à cette prestation. ${formaterOctets(TAILLE_MAX_DEPOT)} au maximum par fichier.`,
        onFichier: (reference, categorieChoisie) => {
          Store.ajouterDocument({
            nom: reference.nom,
            cat: categorieChoisie,
            type: formatFichier(reference.nom),
            url: reference.url,
            taille: reference.taille,
            piece: presta.id,
            auteur: Store.estExpert() ? projet.consultant?.nom : projet.client?.nom,
          });
        },
      });
    },

    /**
     * Dépose un visuel — post réseaux sociaux, support, déclinaison — rattaché
     * à la prestation graphique dont il relève.
     */
    'deposer-declinaison'(el) {
      const presta = Store.prestations().find((x) => x.id === el.dataset.id);
      if (!presta) return;

      if (!Store.ecritureActive()) {
        toast('Le dépôt direct demande la connexion Google Sheets. '
          + 'Sans elle, référencez le lien depuis le coffre-fort.', 'warn');
        return;
      }

      const projet = Store.projet();

      Modal.televersement({
        categorie: categorieDePrestation(presta),
        titre: `Visuels — ${presta.titre}`,
        soustitre: `Posts réseaux sociaux, supports et déclinaisons. Les fichiers partent dans le `
                 + `sous-dossier « Identité » du Drive et restent rattachés à cette prestation. `
                 + `${formaterOctets(TAILLE_MAX_DEPOT)} au maximum par fichier.`,
        onFichier: (reference, categorieChoisie) => {
          Store.ajouterDocument({
            nom: reference.nom,
            cat: categorieChoisie,
            type: formatFichier(reference.nom),
            url: reference.url,
            taille: reference.taille,
            piece: presta.id,
            auteur: Store.estExpert() ? projet.consultant?.nom : projet.client?.nom,
          });
        },
      });
    },

    /**
     * Dépose la convention d'un partenaire dans le sous-dossier « Partenariats »
     * du Drive, rattachée au partenaire par « PART:<id> ».
     */
    'deposer-convention'(el) {
      const partenaire = Store.liste('partenaires').find((p) => p.id === el.dataset.id);
      if (!partenaire) return;

      if (!Store.ecritureActive()) {
        toast('Le dépôt direct demande la connexion Google Sheets. '
          + 'Sans elle, référencez le lien depuis le coffre-fort.', 'warn');
        return;
      }

      const projet = Store.projet();

      Modal.televersement({
        categorie: 'Partenariats',
        titre: `Convention — ${partenaire.nom}`,
        soustitre: `Le fichier part dans le sous-dossier « Partenariats » du Drive du projet `
                 + `et reste rattaché à ce partenaire. ${formaterOctets(TAILLE_MAX_DEPOT)} au maximum par fichier.`,
        onFichier: (reference, categorieChoisie) => {
          Store.ajouterDocument({
            nom: reference.nom,
            cat: categorieChoisie,
            type: formatFichier(reference.nom),
            url: reference.url,
            taille: reference.taille,
            piece: `PART:${partenaire.id}`,
            auteur: Store.estExpert() ? projet.consultant?.nom : projet.client?.nom,
          });
        },
      });
    },

    /** Aperçu d'un lien dans l'application, sans ouvrir d'onglet. */
    'apercu-lien'(el) {
      Modal.apercuLien({
        titre: el.dataset.titre || 'Aperçu',
        url: el.dataset.url,
        soustitre: el.dataset.soustitre || '',
      });
    },

    'apercu-document'(el) {
      const doc = Store.liste('documents').find((d) => d.id === el.dataset.id);
      if (!doc) return;
      Modal.open({
        titre: doc.nom,
        soustitre: `${doc.cat} · déposé le ${Dates.format(doc.date)} par ${doc.auteur}`,
        corps: `<div class="empty" style="border-style:solid">
            <i class="fa-solid fa-file-pdf" style="color:var(--danger-500)"></i>
            <div class="empty__title">Aucun aperçu disponible</div>
            <div class="empty__text">Aucun lien de fichier n'est associé à ce document. Renseignez-le depuis le coffre-fort pour permettre sa consultation.</div>
          </div>`,
        actions: `<button class="btn" data-action="fermer-modal">Fermer</button>`,
      });
    },

    /* --- Signatures --- */
    'enregistrer-signature'(el) {
      const champ = document.querySelector(`[data-sig-url="${CSS.escape(el.dataset.id)}"]`);
      Store.majSignature(el.dataset.id, { url: champ?.value.trim() || '' });
      toast('Lien du parapheur enregistré.', 'ok');
    },

    'marquer-signe'(el) {
      Store.majSignature(el.dataset.id, { statut: 'signe', date: Dates.today() });
      toast('Acte marqué comme signé et archivé.', 'ok');
    },

    'apercu-signature'(el) {
      const sig = Store.liste('signatures').find((s) => s.id === el.dataset.id);
      if (!sig) return;
      Modal.open({
        titre: sig.titre,
        soustitre: sig.date ? `Signé le ${Dates.formatLong(sig.date)}` : '',
        corps: `<div class="empty" style="border-style:solid">
            <i class="fa-solid fa-file-shield" style="color:var(--ok-500)"></i>
            <div class="empty__title">Document signé et horodaté</div>
            <div class="empty__text">${esc(sig.desc)}<br><br>Aucun lien de consultation n'est encore renseigné pour cet acte.</div>
          </div>`,
        actions: `<button class="btn" data-action="fermer-modal">Fermer</button>`,
      });
    },

    /* « telecharger-livrable » et « deposer-livrable » ont été retirés avec la
       vue Livrables et le champ « Lien du livrable » : plus aucun bouton ne les
       appelait. Le dépôt passe désormais par la prestation ou le coffre-fort,
       qui rangent le fichier dans le bon sous-dossier Drive. */

    /* --- Planning --- */
    'portee-planning'(el) {
      App.filtres = { ...App.filtres, portee: el.dataset.portee, projet: '' };
      App.renderVue();
    },

    /**
     * Programmer un échange avec le client : visio, téléphone, WhatsApp ou
     * sur site. C'est le point d'entrée unique — le compte rendu se rédige
     * ensuite, une fois l'échange passé.
     */
    'programmer-echange'() {
      Modal.formulaire({
        titre: 'Programmer un échange',
        soustitre: "Le client verra le rendez-vous dans son planning et sera prévenu à l'approche.",
        champs: [
          { id: 'titre', label: 'Objet de l\'échange', type: 'text', requis: true, placeholder: 'Point d\'avancement mensuel' },
          { id: 'canal', label: 'Moyen', type: 'select', valeur: 'visio',
            options: Object.values(CANAUX).filter((c) => c.action)
              .map((c) => ({ v: c.id, l: c.label })) },
          { id: 'date', label: 'Date', type: 'date', requis: true, valeur: Dates.today() },
          { id: 'heure', label: 'Heure', type: 'text', placeholder: '14:30' },
          { id: 'lieu', label: 'Lieu ou précision', type: 'text', placeholder: 'Visioconférence, cabinet, …' },
          { id: 'lien', label: 'Lien ou numéro', type: 'text',
            placeholder: 'https://meet.google.com/… ou 0596 00 00 00' },
        ],
        libelle: 'Programmer',
        onSubmit: (v) => {
          Store.ajouterEvenement({ ...v, type: 'echange' });
          const canal = CANAUX[v.canal] || CANAUX.visio;
          toast(`${canal.label} programmée le ${Dates.format(v.date)}.`, 'ok');
        },
      });
    },

    'ajouter-evenement'() {
      Modal.formulaire({
        titre: 'Jalon ou livraison',
        soustitre: "Pour une échéance qui n'appelle pas de rendez-vous : commission, dépôt, livraison, formation.",
        champs: [
          { id: 'titre', label: 'Intitulé', type: 'text', requis: true, placeholder: 'Commission ARS' },
          { id: 'type', label: 'Nature', type: 'select', valeur: 'jalon',
            options: Object.values(TYPES_EVENEMENT)
              .filter((t) => !t.avecCanal && !t.ancien)
              .map((t) => ({ v: t.id, l: t.label })) },
          { id: 'date', label: 'Date', type: 'date', requis: true, valeur: Dates.today() },
          { id: 'heure', label: 'Heure', type: 'text', placeholder: '09:00' },
          { id: 'lieu', label: 'Lieu', type: 'text', placeholder: 'ARS Martinique' },
        ],
        onSubmit: (v) => { Store.ajouterEvenement({ ...v, canal: '' }); toast('Ajouté au planning.', 'ok'); },
      });
    },

    'supprimer-evenement'(el) {
      // `data-projet` n'est présent que depuis le planning général : l'événement
      // peut y appartenir à un autre projet que celui actuellement ouvert.
      const projetId = el.dataset.projet || undefined;
      const evt = Store.liste('evenements', projetId).find((e) => e.id === el.dataset.id);
      Modal.confirmer({
        titre: 'Retirer du planning',
        texte: `« ${evt?.titre || 'Cet événement'} » sera supprimé du planning du projet.`,
        libelle: 'Retirer',
        danger: true,
        onConfirm: () => {
          Store.supprimerEvenement(el.dataset.id, projetId);
          toast('Événement retiré.', 'ok');
        },
      });
    },

    /* --- Comptes rendus --- */

    /** Rédige le compte rendu d'un échange déjà programmé, pré-rempli. */
    'cr-depuis-evenement'(el) {
      const evt = Store.liste('evenements').find((e) => e.id === el.dataset.id);
      if (!evt) return;
      App.actions['ajouter-cr'].call(App, null, null, {
        date: evt.date,
        objet: evt.titre,
        type: evt.canal || 'visio',
        lienMeet: /^https?:\/\//i.test(evt.lien || '') ? evt.lien : '',
      });
    },

    'ajouter-cr'(el, e, prefill) {
      const v = prefill || {};
      Modal.formulaire({
        titre: prefill ? 'Compte rendu de réunion' : 'Nouveau compte rendu',
        soustitre: 'Pour une visio, un entretien téléphonique ou une réunion sur site.',
        champs: [
          { id: 'date', label: 'Date de l\'échange', type: 'date', requis: true, valeur: v.date || Dates.today() },
          { id: 'objet', label: 'Objet', type: 'text', requis: true, valeur: v.objet || '', placeholder: 'Comité de pilotage — septembre' },
          { id: 'type', label: 'Nature de l\'échange', type: 'select', valeur: v.type || 'visio',
            options: Object.values(TYPES_ECHANGE).map((t) => ({ v: t.id, l: t.label })) },
          { id: 'participants', label: 'Participants', type: 'text', placeholder: 'Dr Dubois, Jean-Philippe B.' },
          { id: 'decisions', label: 'Décisions et points retenus', type: 'textarea' },
          { id: 'lienMeet', label: 'Lien de la réunion (facultatif)', type: 'url', valeur: v.lienMeet || '', placeholder: 'https://meet.google.com/…' },
          { id: 'lienDoc', label: 'Google Doc du compte rendu (facultatif)', type: 'url', placeholder: 'https://docs.google.com/document/d/…' },
        ],
        onSubmit: (valeurs) => { Store.ajouterCompteRendu(valeurs); toast('Compte rendu enregistré.', 'ok'); },
      });
    },

    'modifier-cr'(el) {
      const cr = Store.liste('comptesRendus').find((c) => c.id === el.dataset.id);
      if (!cr) return;
      Modal.formulaire({
        titre: 'Modifier le compte rendu',
        champs: [
          { id: 'date', label: 'Date', type: 'date', requis: true, valeur: cr.date },
          { id: 'objet', label: 'Objet', type: 'text', requis: true, valeur: cr.objet },
          { id: 'type', label: 'Nature de l\'échange', type: 'select', valeur: cr.type || 'visio',
            options: Object.values(TYPES_ECHANGE).map((t) => ({ v: t.id, l: t.label })) },
          { id: 'participants', label: 'Participants', type: 'text', valeur: cr.participants || '' },
          { id: 'decisions', label: 'Décisions et points retenus', type: 'textarea', valeur: cr.decisions || '' },
          { id: 'lienMeet', label: 'Lien de la réunion', type: 'url', valeur: cr.lienMeet || '' },
          { id: 'lienDoc', label: 'Google Doc du compte rendu', type: 'url', valeur: cr.lienDoc || '' },
        ],
        libelle: 'Enregistrer',
        onSubmit: (v) => { Store.majCompteRendu(cr.id, v); toast('Compte rendu mis à jour.', 'ok'); },
      });
    },

    'supprimer-cr'(el) {
      const cr = Store.liste('comptesRendus').find((c) => c.id === el.dataset.id);
      Modal.confirmer({
        titre: 'Supprimer le compte rendu',
        texte: `« ${cr?.objet || 'Ce compte rendu'} » sera définitivement supprimé.`,
        libelle: 'Supprimer',
        danger: true,
        onConfirm: () => { Store.supprimerCompteRendu(el.dataset.id); toast('Compte rendu supprimé.', 'ok'); },
      });
    },

    /* --- FAQ --- */
    'toggle-accordion'(el) {
      const acc = el.closest('[data-accordion]');
      const ouvert = acc.classList.toggle('is-open');
      el.setAttribute('aria-expanded', String(ouvert));
    },

    /* --- Console : projets --- */
    /** Donne le lien d'accès d'un client et les moyens de le lui transmettre. */
    async 'lien-client'(el) {
      const projet = Store.projet(el.dataset.id);
      if (!projet) return;

      if (!projet.jeton) {
        try {
          await Store.genererLienClient(projet.id);
        } catch (err) {
          Modal.open({
            titre: `Lien d'accès — ${projet.nom}`,
            corps: `<div class="empty" style="border-style:solid">
                <i class="fa-solid fa-link-slash"></i>
                <div class="empty__title">Lien impossible à créer</div>
                <div class="empty__text">${esc(err.message)}<br><br>
                  Depuis la feuille Google Sheets : <strong>ElodiaTech → Mettre à jour la structure</strong>,
                  puis <strong>Générer les liens clients</strong>.</div>
              </div>`,
            actions: '<button class="btn" data-action="fermer-modal">Fermer</button>',
          });
          return;
        }
      }

      App.afficherLienClient(Store.projet(el.dataset.id));
    },

    'copier-lien'() {
      const champ = document.getElementById('lien-client-champ');
      champ.select();
      navigator.clipboard?.writeText(champ.value)
        .then(() => toast('Lien copié.', 'ok'))
        .catch(() => toast('Copie impossible — sélectionnez le lien et copiez-le à la main.', 'warn'));
    },

    /**
     * Crée l'arborescence Drive : un projet précis si un identifiant est
     * fourni, sinon tous ceux qui n'en ont pas encore.
     */
    async 'creer-dossiers-drive'(el) {
      const projetId = el.dataset.id || '';
      const projet = projetId ? Store.projet(projetId) : null;

      if (!Store.ecritureActive()) {
        toast("Connectez d'abord la source Google Sheets — la création se fait sur votre Drive.", 'warn');
        return;
      }

      const libelle = el.innerHTML;
      el.disabled = true;
      el.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Création…';

      try {
        const crees = await Store.creerDossiersDrive(projetId);
        if (!crees.length) {
          toast(projet
            ? `« ${projet.nom} » dispose déjà de son dossier.`
            : 'Tous les clients disposent déjà de leur dossier.', 'ok');
        } else {
          toast(`${crees.length} dossier${crees.length > 1 ? 's' : ''} créé${crees.length > 1 ? 's' : ''}, `
                + 'avec les huit sous-dossiers.', 'ok');
        }
      } catch (err) {
        toast(`Création impossible : ${err.message}`, 'danger');
      } finally {
        el.disabled = false;
        el.innerHTML = libelle;
      }
    },

    /* --- Équipe ElodiaTech --- */

    'fiche-expert'(el) {
      const expert = el.dataset.id ? Store.state.experts.find((e) => e.id === el.dataset.id) : null;

      Modal.formulaire({
        titre: expert ? `Modifier — ${expert.nom}` : 'Nouvel expert',
        soustitre: expert
          ? "Ces informations apparaissent dans l'espace des clients qu'il accompagne."
          : "Il pourra ensuite être désigné référent d'un projet depuis la fiche client.",
        champs: [
          { id: 'nom', label: 'Nom et prénom', type: 'text', requis: true,
            valeur: expert?.nom || '', placeholder: 'ARNOBE Frédéric' },
          { id: 'fonction', label: 'Fonction', type: 'text',
            valeur: expert?.fonction || '', placeholder: 'Expert projets de santé' },
          { id: 'email', label: 'Courriel', type: 'email',
            valeur: expert?.email || '', placeholder: 'prenom@elodiatech.com' },
          { id: 'tel', label: 'Téléphone', type: 'text', valeur: expert?.tel || '' },
          { id: 'principal', label: 'Rôle', type: 'select', valeur: expert?.principal || 'NON',
            options: [{ v: 'NON', l: 'Consultant' }, { v: 'OUI', l: 'Administrateur' }] },
        ],
        libelle: expert ? 'Enregistrer' : 'Ajouter',
        onSubmit: (v) => {
          if (expert) {
            const ancienNom = expert.nom;
            Store.majExpert(expert.id, v);
            // Le référent est stocké par son nom dans les projets : on suit le renommage.
            if (v.nom !== ancienNom) {
              Store.state.projets
                .filter((p) => p.consultant?.nom === ancienNom)
                .forEach((p) => Store.majProjet({ consultant: { nom: v.nom, email: v.email } }, p.id));
            }
            toast('Fiche enregistrée.', 'ok');
          } else {
            Store.ajouterExpert(v);
            toast(`${v.nom} rejoint l'équipe.`, 'ok');
          }
        },
      });
    },

    'supprimer-expert'(el) {
      const expert = Store.state.experts.find((e) => e.id === el.dataset.id);
      if (!expert) return;

      Modal.confirmer({
        titre: 'Retirer de l\'équipe',
        texte: `${expert.nom} sera retiré de l'équipe ElodiaTech. Les dossiers restent intacts.`,
        libelle: 'Retirer',
        danger: true,
        onConfirm: () => {
          const res = Store.supprimerExpert(el.dataset.id);
          if (res.ok) { toast('Expert retiré.', 'ok'); return; }
          if (res.raison === 'dernier') {
            toast("Impossible : il doit rester au moins un expert.", 'warn');
          } else if (res.raison === 'rattache') {
            toast(`Impossible : référent de ${res.projets.join(', ')}. Changez d'abord leur référent.`, 'warn');
          }
        },
      });
    },

    /* --- Annuaire des prestataires --- */

    'fiche-prestataire'(el) {
      const presta = el.dataset.id
        ? Store.state.prestataires.find((v) => v.id === el.dataset.id)
        : null;

      Modal.formulaire({
        titre: presta ? `Modifier — ${presta.nom}` : 'Nouveau prestataire',
        soustitre: 'Cet annuaire est commun à tous vos dossiers et visible par vos clients.',
        champs: [
          { id: 'nom', label: 'Nom du prestataire', type: 'text', requis: true,
            valeur: presta?.nom || '', placeholder: 'ComptaSanté Antilles' },
          { id: 'metier', label: 'Métier', type: 'text', requis: true,
            valeur: presta?.metier || '', placeholder: 'Expert-comptable, logiciel médical, architecte…' },
          { id: 'specialite', label: 'Spécialité', type: 'text',
            valeur: presta?.specialite || '', placeholder: 'SISA, paie et fiscalité des structures de santé' },
          { id: 'contact', label: 'Courriel de contact', type: 'email',
            valeur: presta?.contact || '', placeholder: 'contact@exemple.fr' },
          { id: 'tel', label: 'Téléphone', type: 'text',
            valeur: presta?.tel || '', placeholder: '0596 00 00 00' },
          { id: 'lot', label: 'Rattachement', type: 'select', valeur: presta?.lot || 'LE',
            options: [
              { v: 'LE', l: LOTS.LE.nom },
              { v: 'LF', l: LOTS.LF.nom },
            ] },
        ],
        libelle: presta ? 'Enregistrer' : 'Ajouter',
        onSubmit: (v) => {
          if (presta) { Store.majPrestataire(presta.id, v); toast('Prestataire mis à jour.', 'ok'); }
          else { Store.ajouterPrestataire(v); toast(`« ${v.nom} » ajouté à l'annuaire.`, 'ok'); }
        },
      });
    },

    'supprimer-prestataire'(el) {
      const presta = Store.state.prestataires.find((v) => v.id === el.dataset.id);
      Modal.confirmer({
        titre: 'Retirer de l\'annuaire',
        texte: `« ${presta?.nom || 'Ce prestataire'} » sera retiré de l'annuaire, pour tous vos dossiers.`,
        libelle: 'Retirer',
        danger: true,
        onConfirm: () => { Store.supprimerPrestataire(el.dataset.id); toast('Prestataire retiré.', 'ok'); },
      });
    },

    'ouvrir-projet'(el) {
      Store.setProjet(el.dataset.id);
      App.aller('dashboard');
      toast(`Projet « ${Store.projet(el.dataset.id).nom} » chargé.`, 'ok');
    },

    /**
     * Enregistre l'offre choisie par le client, en un clic.
     * Une confirmation n'est demandée que lorsque le changement *retire* des lots :
     * dans ce cas des modules disparaissent de l'espace du client.
     */
    'appliquer-formule'(el) {
      const projet = Store.projet(el.dataset.projet);
      const nouvelle = el.dataset.formule;
      if (!projet || !FORMULES[nouvelle] || projet.formule === nouvelle) return;

      const ancienne = projet.formule;
      const retires = FORMULES[ancienne].lots.filter((l) => !FORMULES[nouvelle].lots.includes(l));

      const appliquer = () => {
        Store.changerFormule(projet.id, nouvelle);
        const ajoutes = FORMULES[nouvelle].lots.length - FORMULES[ancienne].lots.length;
        toast(
          `« ${projet.nom} » : formule ${nouvelle} — ${FORMULES[nouvelle].nom}. `
          + (ajoutes > 0 ? `${ajoutes} lot${ajoutes > 1 ? 's' : ''} ouvert${ajoutes > 1 ? 's' : ''}.` : 'Périmètre réduit.'),
          'ok');
      };

      if (!retires.length) { appliquer(); return; }

      Modal.confirmer({
        titre: `Réduire le périmètre à la formule ${nouvelle} ?`,
        texte: `« ${projet.nom} » passerait de « ${FORMULES[ancienne].nom} » à « ${FORMULES[nouvelle].nom} ». `
             + `${retires.length} lot${retires.length > 1 ? 's' : ''} disparaîtrai${retires.length > 1 ? 'ent' : 't'} de l'espace du client : `
             + `${retires.map((l) => LOTS[l].nom).join(', ')}. L'historique des prestations concernées est conservé.`,
        libelle: 'Appliquer la formule',
        danger: true,
        onConfirm: appliquer,
      });
    },

    'option-immobilier'(el) {
      const projet = Store.projet();
      Store.majProjet({ options: { ...projet.options, immobilier: el.value === '1' } });
      toast(el.value === '1' ? 'Module immobilier activé.' : 'Module immobilier désactivé.', 'ok');
    },

    /**
     * Fiche client — création si aucun identifiant n'est fourni, modification sinon.
     * Les mêmes champs servent dans les deux cas.
     */
    'fiche-client'(el) {
      const projetId = el.dataset.id;
      const projet = projetId ? Store.projet(projetId) : null;

      // Formules du catalogue et experts déclarés : listes construites à
      // l'ouverture, pour rester en phase avec l'équipe du moment.
      const optionsExperts = Store.nomsExperts().map((nom) => ({ v: nom, l: nom }));

      const groupes = FICHE_CLIENT.map((g) => ({
        ...g,
        champs: g.champs.map((c) => {
          if (c.chemin === 'formule') {
            return { ...c, options: Object.values(FORMULES)
              .map((f) => ({ v: f.code, l: `${f.code} — ${f.nom} · ${f.prixLabel}` })) };
          }
          if (c.chemin === 'consultant.nom') {
            return { ...c, options: optionsExperts };
          }
          if (c.chemin === 'client.indicatif') {
            return { ...c, options: INDICATIFS.map((i) => ({ v: i.code, l: i.label })) };
          }
          return c;
        }),
      }));

      Modal.fiche({
        titre: projet ? `Fiche client — ${projet.nom}` : 'Nouveau client',
        soustitre: projet
          ? "Toute modification est enregistrée dans la feuille Google Sheets."
          : "La formule choisie détermine immédiatement le périmètre de l'accompagnement et les modules visibles par le client.",
        groupes,
        valeurs: projet || { dateDebut: Dates.today(), type: 'MSP', formule: 'F1' },
        libelle: projet ? 'Enregistrer la fiche' : 'Créer le client',
        onSubmit: (v) => {
          // Le courriel du référent suit son nom, pris dans l'équipe.
          const referent = Store.expertParNom(v['consultant.nom']);
          if (referent) v['consultant.email'] = referent.email || '';

          if (projet) {
            Store.majFicheClient(projet.id, v);
            toast('Fiche client enregistrée.', 'ok');
          } else {
            Store.ajouterProjet(v);
            toast(`Client « ${v.nom} » créé. Son espace est prêt.`, 'ok');
          }
        },
      });
    },

    'supprimer-projet'(el) {
      const projet = Store.projet(el.dataset.id);
      Modal.confirmer({
        titre: 'Supprimer le projet',
        texte: `« ${projet.nom} » et toutes ses données de suivi seront définitivement retirés de la plateforme.`,
        libelle: 'Supprimer définitivement',
        danger: true,
        onConfirm: () => { Store.supprimerProjet(el.dataset.id); toast('Projet supprimé.', 'ok'); },
      });
    },

    /* --- Console : paramètres --- */
    'enregistrer-sheets'() {
      const url = document.getElementById('sheets-url').value.trim();
      Store.commit((s) => { s.reglages.webAppUrl = url; });
      toast(url ? 'URL enregistrée. Lancez une synchronisation pour charger les données.' : 'URL effacée.', 'ok');
    },

    async synchroniser(el) {
      const label = el.innerHTML;
      el.disabled = true;
      el.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Synchronisation…';
      try {
        await Store.synchroniser();
        toast('Données synchronisées depuis Google Sheets.', 'ok');
      } catch (err) {
        el.disabled = false;
        el.innerHTML = label;
        toast(`Échec de la synchronisation : ${err.message}`, 'danger');
      }
    },

    'exporter-json'() {
      const blob = new Blob([JSON.stringify(Store.state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `elodiatech-projets-${Dates.today()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Export JSON téléchargé.', 'ok');
    },

    reinitialiser() {
      Modal.confirmer({
        titre: 'Réinitialiser les données',
        texte: "Toutes vos modifications locales seront perdues et le jeu de démonstration sera restauré.",
        libelle: 'Réinitialiser',
        danger: true,
        onConfirm: () => { Store.reinitialiser(); App.filtres = {}; toast('Données réinitialisées.', 'ok'); },
      });
    },

    /* --- Modale --- */
    'fermer-modal'() { Modal.close(); },
  },
};

/* ==========================================================================
   Modales
   ========================================================================== */
const Modal = {
  _onCancel: null,

  open({ titre, soustitre, corps, actions, large, viewer }) {
    this.close(true);
    const racine = document.getElementById('modal-root');
    racine.innerHTML = `
      <div class="modal-backdrop" data-modal-backdrop>
        <div class="modal ${large ? 'modal--lg' : ''} ${viewer ? 'modal--viewer' : ''}" role="dialog" aria-modal="true" aria-label="${esc(titre)}">
          <button class="modal__close" data-action="fermer-modal" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button>
          <h3 class="modal__title">${esc(titre)}</h3>
          ${soustitre ? `<p class="modal__subtitle">${esc(soustitre)}</p>` : ''}
          <div style="margin-top:18px">${corps}</div>
          ${actions ? `<div class="modal__foot">${actions}</div>` : ''}
        </div>
      </div>`;

    racine.querySelector('[data-modal-backdrop]').addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-modal-backdrop')) this.close();
    });

    const premier = racine.querySelector('input, textarea, select, button:not(.modal__close)');
    if (premier) setTimeout(() => premier.focus(), 60);
  },

  close(silencieux) {
    const racine = document.getElementById('modal-root');
    if (!racine.innerHTML) return;
    racine.innerHTML = '';
    if (!silencieux && this._onCancel) {
      const cb = this._onCancel;
      this._onCancel = null;
      cb();
    }
    this._onCancel = null;
  },

  confirmer({ titre, texte, libelle, danger, onConfirm, onCancel }) {
    this.open({
      titre,
      corps: `<p class="text-sm text-soft">${esc(texte)}</p>`,
      actions: `
        <button class="btn" data-action="fermer-modal">Annuler</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" id="modal-confirm">${esc(libelle || 'Confirmer')}</button>`,
    });
    // Après open() : celui-ci réinitialise _onCancel en fermant la modale précédente.
    this._onCancel = onCancel || null;
    document.getElementById('modal-confirm').addEventListener('click', () => {
      this._onCancel = null;
      this.close(true);
      onConfirm && onConfirm();
    });
  },

  formulaire({ titre, soustitre, champs, libelle, onSubmit }) {
    const corps = `<form id="modal-form" class="stack-sm">
        ${champs.map((c) => {
          const id = `mf-${c.id}`;
          let controle;
          if (c.type === 'select') {
            controle = `<select id="${id}" name="${esc(c.id)}">${c.options.map((o) => `<option value="${esc(o.v)}" ${String(o.v) === String(c.valeur) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
          } else if (c.type === 'textarea') {
            controle = `<textarea id="${id}" name="${esc(c.id)}" ${c.requis ? 'required' : ''} placeholder="${esc(c.placeholder || '')}">${esc(c.valeur || '')}</textarea>`;
          } else {
            controle = `<input type="${esc(c.type || 'text')}" id="${id}" name="${esc(c.id)}" ${c.requis ? 'required' : ''}
                          value="${esc(c.valeur || '')}" placeholder="${esc(c.placeholder || '')}">`;
          }
          return `<div class="field">
              <label class="field__label" for="${id}">${esc(c.label)}${c.requis ? ' *' : ''}</label>
              ${controle}
            </div>`;
        }).join('')}
      </form>`;

    this.open({
      titre, soustitre, corps,
      actions: `
        <button class="btn" data-action="fermer-modal">Annuler</button>
        <button class="btn btn--primary" id="modal-submit">${esc(libelle || 'Enregistrer')}</button>`,
    });

    const form = document.getElementById('modal-form');
    const valider = () => {
      if (!form.reportValidity()) return;
      const valeurs = Object.fromEntries(new FormData(form).entries());
      this.close(true);
      onSubmit(valeurs);
    };
    document.getElementById('modal-submit').addEventListener('click', valider);
    form.addEventListener('submit', (e) => { e.preventDefault(); valider(); });
  },

  /**
   * Visionneuse intégrée : affiche un lien dans l'application, sans ouvrir
   * d'onglet.
   *
   * Aucun navigateur ne permet de savoir de façon fiable si un site distant
   * refuse d'être affiché dans un cadre : `onload` se déclenche dans les deux
   * cas et le contenu est inaccessible depuis une autre origine. Plutôt que
   * de prétendre le détecter, la visionneuse annonce le repli d'emblée et
   * garde « Ouvrir dans un nouvel onglet » sous la main.
   */
  apercuLien({ titre, url, soustitre }) {
    const direct = urlSure(url);
    if (!direct) { toast('Aucune adresse exploitable pour ce lien.', 'warn'); return; }
    const integrable = lienIntegrable(direct);

    this.open({
      titre: titre || 'Aperçu',
      soustitre,
      viewer: true,
      corps: `
        <div class="viewer">
          <div class="viewer__barre">
            <span class="viewer__url mono" title="${esc(direct)}">${esc(direct)}</span>
            <a class="btn btn--sm" href="${esc(direct)}" target="_blank" rel="noopener noreferrer">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Nouvel onglet
            </a>
          </div>
          <iframe class="viewer__cadre" src="${esc(integrable)}" title="${esc(titre || 'Aperçu du lien')}"
                  referrerpolicy="no-referrer" loading="eager"></iframe>
          <p class="viewer__aide">
            <i class="fa-solid fa-circle-info"></i>
            Cadre vide ? Certains sites — portails officiels, dossiers Drive — interdisent
            l'affichage intégré. Utilisez « Nouvel onglet ».
          </p>
        </div>`,
      actions: `<button class="btn" data-action="fermer-modal">Fermer</button>`,
    });
  },

  /**
   * Dépôt de fichiers pris sur le poste — explorateur natif ou glisser-déposer —
   * vers le sous-dossier Drive de la catégorie choisie.
   *
   * Les envois sont séquentiels et chacun rend compte de son sort dans la liste :
   * l'échec de l'un n'empêche pas les suivants. `onFichier(reference, categorie)`
   * est appelé après chaque succès.
   */
  televersement({ categorie, onFichier, titre, soustitre }) {
    this.open({
      titre: titre || 'Déposer des fichiers',
      soustitre: soustitre
        || `Les fichiers partent dans le dossier Drive du projet, puis sont référencés `
         + `dans le coffre-fort. ${formaterOctets(TAILLE_MAX_DEPOT)} au maximum par fichier.`,
      corps: `
        <div class="stack-sm">
          <div class="field">
            <label class="field__label" for="tv-cat">Catégorie</label>
            <select id="tv-cat">
              ${CATEGORIES_DOC.map((c) => `<option value="${esc(c)}" ${c === categorie ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
            <span class="field__hint">Détermine le sous-dossier Drive de destination.</span>
          </div>

          <input type="file" id="tv-champ" multiple hidden>
          <button type="button" class="dropzone" id="tv-zone">
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span class="dropzone__titre">Parcourir cet ordinateur</span>
            <span class="dropzone__aide">ou glissez vos fichiers dans ce cadre</span>
          </button>

          <div class="stack-xs" id="tv-liste"></div>
        </div>`,
      actions: `
        <button class="btn" data-action="fermer-modal" id="tv-fermer">Annuler</button>
        <button class="btn btn--primary" id="tv-envoyer" disabled>
          <i class="fa-solid fa-cloud-arrow-up"></i> Déposer
        </button>`,
    });

    const champ = document.getElementById('tv-champ');
    const zone = document.getElementById('tv-zone');
    const liste = document.getElementById('tv-liste');
    const envoyer = document.getElementById('tv-envoyer');
    const fermer = document.getElementById('tv-fermer');
    let fichiers = [];

    const rendre = () => {
      liste.innerHTML = fichiers.map((f, i) => {
        const format = formatFichier(f.name);
        return `
        <div class="file-row" data-ligne="${i}">
          <div class="file-icon ${CLASSES_FICHIER[format] || ''}"><i class="fa-solid ${iconeFichier(format)}"></i></div>
          <div class="grow" style="min-width:0">
            <div class="text-sm fw-800 truncate">${esc(f.name)}</div>
            <div class="text-xs text-muted" data-etat>${esc(formaterOctets(f.size))}</div>
          </div>
          <button class="btn btn--ghost btn--sm" data-retirer="${i}" aria-label="Retirer ${esc(f.name)}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>`;
      }).join('');

      envoyer.disabled = !fichiers.length;
      envoyer.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Déposer'
        + (fichiers.length ? ` ${fichiers.length} fichier${fichiers.length > 1 ? 's' : ''}` : '');
    };

    // Le plafond est annoncé avant l'envoi plutôt que subi après : inutile de
    // faire monter treize méga-octets pour s'entendre dire non.
    const ajouter = (nouveaux) => {
      const trop = [];
      Array.from(nouveaux).forEach((f) => {
        if (f.size > TAILLE_MAX_DEPOT) { trop.push(f.name); return; }
        if (!fichiers.some((d) => d.name === f.name && d.size === f.size)) fichiers.push(f);
      });
      if (trop.length) {
        toast(`Trop volumineux pour le dépôt direct : ${trop.join(', ')}. `
          + 'À placer dans le Drive, puis à référencer par son lien.', 'warn');
      }
      rendre();
    };

    zone.addEventListener('click', () => champ.click());
    champ.addEventListener('change', () => { ajouter(champ.files); champ.value = ''; });

    ['dragenter', 'dragover'].forEach((nom) => zone.addEventListener(nom, (ev) => {
      ev.preventDefault();
      zone.classList.add('is-active');
    }));
    ['dragleave', 'drop'].forEach((nom) => zone.addEventListener(nom, (ev) => {
      ev.preventDefault();
      zone.classList.remove('is-active');
    }));
    zone.addEventListener('drop', (ev) => {
      if (ev.dataTransfer?.files?.length) ajouter(ev.dataTransfer.files);
    });

    liste.addEventListener('click', (ev) => {
      const bouton = ev.target.closest('[data-retirer]');
      if (!bouton) return;
      fichiers.splice(Number(bouton.dataset.retirer), 1);
      rendre();
    });

    envoyer.addEventListener('click', async () => {
      const categorieChoisie = document.getElementById('tv-cat').value;
      [envoyer, fermer, zone, champ].forEach((el) => { el.disabled = true; });
      envoyer.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Dépôt en cours…';

      let reussis = 0;
      const echecs = [];

      for (let i = 0; i < fichiers.length; i++) {
        const f = fichiers[i];
        // La modale a pu être fermée entre-temps : on n'écrit que si la ligne est là.
        const etat = liste.querySelector(`[data-ligne="${i}"] [data-etat]`);
        const marquer = (html) => { if (etat) etat.innerHTML = html; };

        marquer('<i class="fa-solid fa-circle-notch fa-spin"></i> envoi…');
        try {
          const reference = await Store.televerserFichier({
            nom: f.name,
            mimeType: f.type || 'application/octet-stream',
            categorie: categorieChoisie,
            base64: await lireEnBase64(f),
          });
          marquer(`<span class="text-ok"><i class="fa-solid fa-circle-check"></i> déposé dans ${esc(reference.dossier)}</span>`);
          onFichier(reference, categorieChoisie);
          reussis += 1;
        } catch (err) {
          marquer(`<span class="text-danger"><i class="fa-solid fa-circle-xmark"></i> ${esc(err.message)}</span>`);
          echecs.push(f.name);
        }
      }

      if (echecs.length) {
        // La modale reste ouverte : le motif de chaque échec doit rester lisible.
        fermer.disabled = false;
        fermer.textContent = 'Fermer';
        envoyer.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Déposer';
        toast(`${echecs.length} fichier${echecs.length > 1 ? 's' : ''} non déposé${echecs.length > 1 ? 's' : ''}`
          + (reussis ? `, ${reussis} réussi${reussis > 1 ? 's' : ''}.` : '.'), 'warn');
        return;
      }

      this.close(true);
      toast(`${reussis} fichier${reussis > 1 ? 's' : ''} déposé${reussis > 1 ? 's' : ''} dans le Drive `
        + `et référencé${reussis > 1 ? 's' : ''} dans le coffre-fort.`, 'ok');
    });
  },

  /**
   * Formulaire structuré en sections, alimenté par des chemins pointés
   * (« client.nom »). Sert à la fiche client, en création comme en modification.
   */
  fiche({ titre, soustitre, groupes, valeurs, libelle, onSubmit }) {
    const lire = (chemin) => chemin.split('.')
      .reduce((noeud, seg) => (noeud == null ? undefined : noeud[seg]), valeurs);

    const corps = `<form id="modal-form" class="stack">
        ${groupes.map((g) => `
          <fieldset style="border:0">
            <legend class="section-title" style="margin-bottom:10px">
              <i class="fa-solid fa-circle-dot"></i> ${esc(g.groupe)}
            </legend>
            <div class="grid grid-2">
              ${g.champs.map((c) => {
                const id = `fc-${c.chemin.replace(/\./g, '-')}`;
                const val = lire(c.chemin);
                let controle;

                if (c.type === 'select') {
                  controle = `<select id="${id}" name="${esc(c.chemin)}">
                      ${(c.options || []).map((o) => `<option value="${esc(o.v)}" ${String(o.v) === String(val ?? '') ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}
                    </select>`;
                } else if (c.type === 'textarea') {
                  controle = `<textarea id="${id}" name="${esc(c.chemin)}" placeholder="${esc(c.placeholder || '')}">${esc(val || '')}</textarea>`;
                } else {
                  controle = `<input type="${esc(c.type || 'text')}" id="${id}" name="${esc(c.chemin)}"
                                ${c.requis ? 'required' : ''} value="${esc(val ?? '')}"
                                placeholder="${esc(c.placeholder || '')}">`;
                }

                return `<div class="field" ${c.type === 'textarea' ? 'style="grid-column:1 / -1"' : ''}>
                    <label class="field__label" for="${id}">${esc(c.label)}${c.requis ? ' *' : ''}</label>
                    ${controle}
                  </div>`;
              }).join('')}
            </div>
          </fieldset>`).join('')}
      </form>`;

    this.open({
      titre, soustitre, corps, large: true,
      actions: `
        <button class="btn" data-action="fermer-modal">Annuler</button>
        <button class="btn btn--primary" id="modal-submit">${esc(libelle || 'Enregistrer')}</button>`,
    });

    const form = document.getElementById('modal-form');
    const valider = () => {
      if (!form.reportValidity()) return;
      const saisies = Object.fromEntries(new FormData(form).entries());
      this.close(true);
      onSubmit(saisies);
    };
    document.getElementById('modal-submit').addEventListener('click', valider);
    form.addEventListener('submit', (e) => { e.preventDefault(); valider(); });
  },
};

/* ==========================================================================
   Notifications éphémères
   ========================================================================== */
function toast(message, ton = 'info') {
  const racine = document.getElementById('toast-root');
  const icones = { ok: 'fa-circle-check', warn: 'fa-triangle-exclamation', danger: 'fa-circle-xmark', info: 'fa-circle-info' };

  const el = document.createElement('div');
  el.className = `toast toast--${ton}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<i class="fa-solid ${icones[ton] || icones.info}"></i><span>${esc(message)}</span>`;
  racine.appendChild(el);

  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  }, 3600);
}

/* ==========================================================================
   Utilitaires
   ========================================================================== */

/**
 * Lit un fichier du poste et renvoie son contenu encodé en base64, débarrassé
 * du préfixe « data:…;base64, » que le script Google n'attend pas.
 */
function lireEnBase64(fichier) {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result).split(',')[1] || '');
    lecteur.onerror = () => rejeter(new Error('fichier illisible'));
    lecteur.readAsDataURL(fichier);
  });
}

function debounce(fn, delai) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delai);
  };
}

/* ========================================================================== */
document.addEventListener('DOMContentLoaded', () => App.init());
