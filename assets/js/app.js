/* ==========================================================================
   app.js — Coque applicative : navigation, interactions, modales, graphiques
   ========================================================================== */

const App = {
  filtres: {},        // filtres de la vue courante
  charts: {},         // instances Chart.js
  map: null,          // instance Leaflet

  /* ---------------------------------------------------------------------- */
  init() {
    Store.init();
    Store.subscribe(() => this.render());

    this.brancherEvenements();
    this.appliquerTheme();
    this.render();
  },

  /* ======================================================================
     RENDU
     ====================================================================== */
  render() {
    const projet = Store.projet();
    if (!projet) return;

    this.appliquerTheme();

    // Hors session, l'application n'est pas rendue du tout : rien à voir,
    // rien à inspecter dans le DOM.
    const connecte = Store.estConnecte();
    document.body.classList.toggle('non-connecte', !connecte);
    if (!connecte) { this.renderConnexion(); return; }

    this.renderTopbar();
    this.renderSidebar();
    this.renderBreadcrumb();
    this.renderVue();
    this.renderNotifications();
  },

  /** Liste des profils proposés sur l'écran de connexion. */
  renderConnexion() {
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

    // Identité affichée
    const identite = expert
      ? { nom: projet.consultant.nom || 'Expert ElodiaTech', role: 'Consultant ElodiaTech' }
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
  connexionParEmail() {
    const champ = document.getElementById('connexion-email');
    const zoneErreur = document.getElementById('connexion-erreur');
    const profil = Store.identifier(champ.value);

    if (!profil) {
      zoneErreur.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> '
        + "Cette adresse n'est rattachée à aucun dossier. Choisissez un profil ci-dessous "
        + 'ou contactez votre référent ElodiaTech.';
      zoneErreur.hidden = false;
      champ.focus();
      return;
    }

    zoneErreur.hidden = true;
    Store.connecter({ role: profil.role, projetId: profil.projetId, identifiant: champ.value.trim() });
    toast(`Bienvenue, ${profil.nom}.`, 'ok');
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
              <div class="field">
                <label class="field__label" for="pd-echeance">Échéance</label>
                <input type="date" id="pd-echeance" value="${esc(p.etat.echeance || '')}">
              </div>
              <div class="field">
                <label class="field__label" for="pd-lien">Lien du livrable</label>
                <input type="url" id="pd-lien" class="input--mono" value="${esc(p.etat.livrableUrl || '')}" placeholder="https://…">
              </div>
              <div class="field">
                <label class="field__label" for="pd-note">Note de suivi</label>
                <textarea id="pd-note" placeholder="Point d'avancement, blocage, prochaine étape…">${esc(p.etat.note || '')}</textarea>
              </div>
            </div>` : `
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
      Store.majPrestation(el.dataset.id, {
        echeance: document.getElementById('pd-echeance')?.value || '',
        livrableUrl: document.getElementById('pd-lien')?.value.trim() || '',
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

    'ajouter-financement'() {
      Modal.formulaire({
        titre: 'Nouvelle demande de financement',
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

    'telecharger-livrable'(el) {
      const p = Store.prestations().find((x) => x.id === el.dataset.id);
      toast(`Aucun fichier n'est encore rattaché au livrable « ${p?.livrable || ''} ».`, 'warn');
    },

    /* --- Planning --- */
    'portee-planning'(el) {
      App.filtres = { ...App.filtres, portee: el.dataset.portee, projet: '' };
      App.renderVue();
    },

    'ajouter-evenement'() {
      Modal.formulaire({
        titre: 'Nouvel événement',
        soustitre: "Un lien de visioconférence rend l'événement rejoignable d'un clic, pour vous comme pour le client.",
        champs: [
          { id: 'titre', label: 'Intitulé', type: 'text', requis: true, placeholder: 'Comité de pilotage' },
          { id: 'date', label: 'Date', type: 'date', requis: true, valeur: Dates.today() },
          { id: 'heure', label: 'Heure', type: 'text', placeholder: '14:30' },
          { id: 'lieu', label: 'Lieu', type: 'text', placeholder: 'Visioconférence' },
          { id: 'type', label: 'Type', type: 'select',
            options: Object.values(TYPES_EVENEMENT).map((t) => ({ v: t.id, l: t.label })) },
          { id: 'lien', label: 'Lien Google Meet (facultatif)', type: 'url', placeholder: 'https://meet.google.com/…' },
        ],
        onSubmit: (v) => { Store.ajouterEvenement(v); toast('Événement ajouté au planning.', 'ok'); },
      });
    },

    'supprimer-evenement'(el) {
      const evt = Store.liste('evenements').find((e) => e.id === el.dataset.id);
      Modal.confirmer({
        titre: 'Retirer du planning',
        texte: `« ${evt?.titre || 'Cet événement'} » sera supprimé du planning du projet.`,
        libelle: 'Retirer',
        danger: true,
        onConfirm: () => { Store.supprimerEvenement(el.dataset.id); toast('Événement retiré.', 'ok'); },
      });
    },

    /* --- Comptes rendus --- */

    /** Crée un compte rendu à partir du lien Meet saisi dans la vue. */
    'enregistrer-meet'() {
      const lien = document.getElementById('meet-lien').value.trim();
      const objet = document.getElementById('meet-objet').value.trim();
      const doc = document.getElementById('meet-doc').value.trim();
      const date = document.getElementById('meet-date').value || Dates.today();

      if (!lien) { toast('Collez d\'abord le lien de la réunion.', 'warn'); return; }
      if (!/^https?:\/\//i.test(lien)) { toast('Le lien doit commencer par https://', 'warn'); return; }

      Store.ajouterCompteRendu({
        date, type: 'visio',
        objet: objet || `Réunion du ${Dates.format(date)}`,
        participants: '',
        decisions: '',
        lienMeet: lien,
        lienDoc: doc,
      });

      ['meet-lien', 'meet-objet', 'meet-doc'].forEach((id) => {
        const champ = document.getElementById(id);
        if (champ) champ.value = '';
      });
      toast('Compte rendu de réunion créé.', 'ok');
    },

    /** Prépare un compte rendu à partir d'une réunion déjà planifiée. */
    'cr-depuis-evenement'(el) {
      const evt = Store.liste('evenements').find((e) => e.id === el.dataset.id);
      if (!evt) return;
      App.actions['ajouter-cr'].call(App, null, null, {
        date: evt.date, objet: evt.titre, lienMeet: evt.lien || '',
        type: evt.lien ? 'visio' : 'presentiel',
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

      // La liste des formules est construite ici pour rester à jour.
      const groupes = FICHE_CLIENT.map((g) => ({
        ...g,
        champs: g.champs.map((c) => (c.chemin === 'formule'
          ? { ...c, options: Object.values(FORMULES).map((f) => ({ v: f.code, l: `${f.code} — ${f.nom} · ${f.prixLabel}` })) }
          : c)),
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

  open({ titre, soustitre, corps, actions, large }) {
    this.close(true);
    const racine = document.getElementById('modal-root');
    racine.innerHTML = `
      <div class="modal-backdrop" data-modal-backdrop>
        <div class="modal ${large ? 'modal--lg' : ''}" role="dialog" aria-modal="true" aria-label="${esc(titre)}">
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
   Utilitaire
   ========================================================================== */
function debounce(fn, delai) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delai);
  };
}

/* ========================================================================== */
document.addEventListener('DOMContentLoaded', () => App.init());
