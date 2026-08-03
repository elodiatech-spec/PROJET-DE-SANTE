/* ==========================================================================
   views.js — Rendu des vues
   Chaque vue renvoie une chaîne HTML. Toute donnée dynamique passe par esc()
   afin qu'un contenu saisi par un utilisateur ne puisse jamais être interprété
   comme du HTML.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Helpers de rendu
   -------------------------------------------------------------------------- */

/** Échappe le HTML. À utiliser pour TOUTE donnée non maîtrisée. */
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** N'autorise que des URL http(s) — neutralise javascript:, data:, etc. */
function urlSure(v) {
  const s = String(v || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

function initiales(nom) {
  return String(nom || '?')
    .replace(/^(Dr|Mme|M\.|Pr)\s+/i, '')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((m) => m[0]).join('').toUpperCase();
}

function euros(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

function badge(label, couleur, icone) {
  return `<span class="badge badge--${esc(couleur || 'neutre')}">${icone ? `<i class="${esc(icone)}"></i>` : ''}${esc(label)}</span>`;
}

function badgeStatut(idStatut) {
  const s = STATUTS[idStatut] || STATUTS.a_faire;
  return badge(s.label, s.couleur, s.icone);
}

function progressBar(pct, taille) {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const variante = p >= 100 ? 'ok' : p >= 50 ? '' : p >= 25 ? 'warn' : 'danger';
  return `<div class="progress ${taille ? 'progress--' + taille : ''}">
      <div class="progress__fill ${variante ? 'progress__fill--' + variante : ''}" style="width:${p}%"></div>
    </div>`;
}

function tint(hex, alpha) {
  return `color-mix(in srgb, ${hex} ${alpha}%, transparent)`;
}

/**
 * Bouton d'accès à un échange, selon son canal.
 * Une visio ouvre le lien, un téléphone compose le numéro, WhatsApp ouvre la
 * conversation. Renvoie une chaîne vide si rien n'est joignable.
 */
function boutonEchange(evt, taille = 'sm') {
  const canal = CANAUX[evt.canal] || null;
  const valeur = String(evt.lien || '').trim();
  if (!canal || !valeur || !canal.action) return '';

  let href = '';
  if (/^https?:\/\//i.test(valeur)) {
    href = valeur;
  } else if (evt.canal === 'whatsapp') {
    // wa.me attend un numéro international sans séparateur.
    const chiffres = valeur.replace(/[^0-9]/g, '').replace(/^0/, '596');
    href = chiffres.length >= 8 ? `https://wa.me/${chiffres}` : '';
  } else if (evt.canal === 'telephone') {
    const chiffres = valeur.replace(/[^0-9+]/g, '');
    href = chiffres.length >= 6 ? `tel:${chiffres}` : '';
  }

  if (!href) return '';

  const externe = href.startsWith('http');
  return `<a class="btn btn--primary${taille === 'sm' ? ' btn--sm' : ''}" href="${esc(href)}"
             ${externe ? 'target="_blank" rel="noopener noreferrer"' : ''}>
            <i class="${esc(canal.icone)}"></i> ${esc(canal.action)}
          </a>`;
}

function empty(titre, texte, icone) {
  return `<div class="empty">
      <i class="${esc(icone || 'fa-solid fa-inbox')}"></i>
      <div class="empty__title">${esc(titre)}</div>
      <div class="empty__text">${esc(texte || '')}</div>
    </div>`;
}

/** Bandeau indiquant que le module dépend de la formule souscrite. */
function bandeauFormule(idLot) {
  const projet = Store.projet();
  const f = FORMULES[projet.formule];
  const lot = LOTS[idLot];
  if (!lot) return '';
  return `<div class="row-tight text-xs text-muted">
      <span class="badge badge--brand"><i class="fa-solid fa-tag"></i> Formule ${esc(f.code)} — ${esc(f.nom)}</span>
      <span><i class="fa-solid fa-layer-group"></i> Lot : ${esc(lot.nom)}</span>
    </div>`;
}

/* --------------------------------------------------------------------------
   Fragment : sélecteur d'offre par clic (réservé à l'expert)
   -------------------------------------------------------------------------- */
function selecteurOffre(projet, options = {}) {
  const cartes = Object.values(FORMULES).map((f) => {
    const actif = f.code === projet.formule;
    const nbPrestations = PRESTATIONS.filter((p) => f.lots.includes(p.lot)).length;
    return `
      <button type="button"
              class="offre-choix ${actif ? 'is-active' : ''}"
              style="--teinte:${esc(f.couleur)}"
              data-action="appliquer-formule"
              data-formule="${esc(f.code)}"
              data-projet="${esc(projet.id)}"
              aria-pressed="${actif}">
        <span class="offre-choix__check" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
        ${f.recommandee ? '<span class="offre-choix__reco">★ Recommandée</span>' : ''}
        <span class="offre-choix__code">Formule ${esc(f.code)}</span>
        <span class="offre-choix__nom">${esc(f.nom)}</span>
        <span class="offre-choix__prix">${esc(euros(f.prixHT))} <small>HT</small></span>
        <span class="offre-choix__meta">
          ${f.lots.length} lots · ${nbPrestations} prestations · ${f.dureeMois} mois
        </span>
      </button>`;
  }).join('');

  return `
    <div class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title"><i class="fa-solid fa-tags"></i> Offre souscrite par le client</h3>
          <p class="card__subtitle">
            Cliquez sur la formule retenue : le périmètre du projet, les prestations à conduire
            et les modules visibles par le client s'ajustent immédiatement.
          </p>
        </div>
        ${options.lienDetail !== false
          ? `<button class="btn btn--sm" data-action="aller" data-route="admin-offres">
               <i class="fa-solid fa-table-list"></i> Comparer les périmètres
             </button>`
          : ''}
      </div>
      <div class="grid grid-3">${cartes}</div>
    </div>`;
}

/* --------------------------------------------------------------------------
   Fragment : carte d'une prestation
   -------------------------------------------------------------------------- */
function cartePrestation(p, index) {
  const expert = Store.estExpert();
  const st = STATUTS[p.etat.statut] || STATUTS.a_faire;
  const jours = Dates.daysUntil(p.etat.echeance);
  const retard = p.etat.statut !== 'valide' && jours !== null && jours < 0;

  const acteur = { expert: 'ElodiaTech', client: 'Vous', mixte: 'Co-construction' }[p.acteur] || '';

  const controle = expert
    ? `<select class="input" style="min-width:180px" data-action="changer-statut" data-id="${esc(p.id)}" aria-label="Statut de la prestation ${esc(p.titre)}">
         ${Object.values(STATUTS).map((s) => `<option value="${s.id}" ${s.id === p.etat.statut ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
       </select>`
    : badgeStatut(p.etat.statut);

  const actionClient = (!expert && p.etat.statut === 'a_valider')
    ? `<button class="btn btn--ok btn--sm" data-action="valider-prestation" data-id="${esc(p.id)}">
         <i class="fa-solid fa-check"></i> Valider
       </button>`
    : '';

  const boutonDetail = `<button class="btn btn--ghost btn--sm" data-action="detail-prestation" data-id="${esc(p.id)}">
      <i class="fa-solid fa-circle-info"></i> Détail
    </button>`;

  return `<article class="presta presta--${esc(p.etat.statut)}">
      <div class="presta__num">${esc(String(index).padStart(2, '0'))}</div>
      <div class="presta__body">
        <h4 class="presta__title">${esc(p.titre)}</h4>
        <p class="presta__desc">${esc(p.desc)}</p>
        <div class="presta__meta">
          <span><i class="fa-solid fa-file-lines"></i> ${esc(p.livrable)}</span>
          <span><i class="fa-solid fa-user"></i> ${esc(acteur)}</span>
          <span class="${retard ? 'text-danger fw-800' : ''}">
            <i class="fa-solid fa-calendar-day"></i>
            ${esc(Dates.format(p.etat.echeance))}${retard ? ` · en retard de ${Math.abs(jours)} j` : ''}
          </span>
          ${p.etat.note ? `<span><i class="fa-solid fa-note-sticky"></i> ${esc(p.etat.note)}</span>` : ''}
        </div>
      </div>
      <div class="presta__actions">
        ${controle}
        <div class="row-tight">${actionClient}${boutonDetail}</div>
      </div>
    </article>`;
}

/* --------------------------------------------------------------------------
   Les vues
   -------------------------------------------------------------------------- */
const Views = {

  /* ====================== VUE D'ENSEMBLE ====================== */
  dashboard() {
    const projet = Store.projet();
    const formule = Store.formule(projet);
    const pct = Store.avancement();
    const prestations = Store.prestations();
    const validees = prestations.filter((p) => p.etat.statut === 'valide').length;
    const aValider = Store.actionsClient();
    const sigs = Store.signaturesEnAttente();
    const retard = Store.enRetard();
    const echeances = Store.echeances(projet.id, 5);
    const expert = Store.estExpert();

    const prochaine = echeances[0];

    return `
    <section class="view stack">

      <div class="hero">
        <div>
          <div class="row-tight">
            <span class="badge badge--accent"><i class="fa-solid fa-tag"></i> Formule ${esc(formule.code)} — ${esc(formule.nom)}</span>
            <span class="badge badge--brand"><i class="fa-solid fa-${projet.type === 'MSP' ? 'house-medical' : 'hospital'}"></i> ${esc(projet.type)}</span>
          </div>
          <h1>${esc(projet.nom)} — ${esc(projet.ville)}</h1>
          <p>${expert
            ? `Vous pilotez ce dossier pour ${esc(projet.client.nom)}. Le périmètre d'intervention est défini par la formule souscrite : ${esc(formule.lots.length)} lots, ${esc(prestations.length)} prestations à conduire.`
            : `Bienvenue sur votre espace de suivi. Vous retrouvez ici l'avancement réel de votre projet, les livrables produits par ElodiaTech et les actions qui attendent votre validation.`}</p>
        </div>
        <div class="row">
          <div class="hero__stat">
            <span class="hero__stat-label">Avancement</span>
            <span class="hero__stat-value">${pct} %</span>
            <span class="text-xs" style="opacity:.8">${validees} / ${prestations.length} prestations validées</span>
          </div>
          <button class="btn btn--accent" data-action="aller" data-route="feuille-route">
            Feuille de route <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>

      ${expert ? selecteurOffre(projet) : ''}

      <div class="grid grid-4">
        <div class="card card--interactive" data-action="aller" data-route="feuille-route">
          <div class="kpi">
            <div class="kpi__head">
              <span class="kpi__label">Prestations validées</span>
              <i class="fa-solid fa-circle-check kpi__icon text-ok"></i>
            </div>
            <span class="kpi__value">${validees} / ${prestations.length}</span>
            ${progressBar(pct, 'sm')}
          </div>
        </div>

        <div class="card card--interactive" data-action="aller" data-route="feuille-route">
          <div class="kpi">
            <div class="kpi__head">
              <span class="kpi__label">${expert ? 'En attente client' : 'À valider par vous'}</span>
              <i class="fa-solid fa-hourglass-half kpi__icon text-warn"></i>
            </div>
            <span class="kpi__value">${aValider.length}</span>
            <span class="kpi__hint ${aValider.length ? 'text-warn' : 'text-muted'}">
              ${aValider.length ? esc(aValider[0].titre) : 'Aucune action en attente'}
            </span>
          </div>
        </div>

        <div class="card card--interactive" data-action="aller" data-route="signatures">
          <div class="kpi">
            <div class="kpi__head">
              <span class="kpi__label">Signatures en attente</span>
              <i class="fa-solid fa-file-signature kpi__icon" style="color:var(--purple-500)"></i>
            </div>
            <span class="kpi__value">${sigs.length}</span>
            <span class="kpi__hint ${sigs.length ? 'text-warn' : 'text-muted'}">
              ${sigs.length ? esc(sigs[0].titre) : 'Tous les actes sont signés'}
            </span>
          </div>
        </div>

        <div class="card card--interactive" data-action="aller" data-route="planning">
          <div class="kpi">
            <div class="kpi__head">
              <span class="kpi__label">Prochaine échéance</span>
              <i class="fa-solid fa-calendar-day kpi__icon text-brand"></i>
            </div>
            <span class="kpi__value" style="font-size:1.05rem">${prochaine ? esc(Dates.format(prochaine.date)) : '—'}</span>
            <span class="kpi__hint text-muted truncate">${prochaine ? esc(prochaine.titre) : 'Aucune échéance planifiée'}</span>
          </div>
        </div>
      </div>

      ${retard.length ? `
      <div class="card" style="border-color:color-mix(in srgb, var(--danger-500) 45%, transparent)">
        <div class="row">
          <i class="fa-solid fa-triangle-exclamation text-danger" style="font-size:1.2rem"></i>
          <div class="grow">
            <h3 class="text-sm fw-800 text-danger">${retard.length} prestation${retard.length > 1 ? 's' : ''} en retard</h3>
            <p class="text-xs text-muted">${esc(retard.map((r) => r.titre).join(' · '))}</p>
          </div>
          <button class="btn btn--sm" data-action="aller" data-route="feuille-route">Traiter</button>
        </div>
      </div>` : ''}

      <div class="grid grid-sidebar">
        <div class="card">
          <div class="card__head">
            <div>
              <h3 class="card__title"><i class="fa-solid fa-chart-simple"></i> Avancement par lot de travail</h3>
              <p class="card__subtitle">Chaque lot correspond à un bloc de prestations de votre formule.</p>
            </div>
          </div>
          <div class="stack-sm">
            ${Store.avancementParLot().map((l) => `
              <div>
                <div class="row-tight" style="justify-content:space-between;margin-bottom:5px">
                  <span class="text-sm fw-800"><i class="${esc(l.icone)}" style="color:${esc(l.couleur)}"></i> ${esc(l.nom)}</span>
                  <span class="text-xs text-muted">${l.valides}/${l.total} · <strong>${l.pct} %</strong></span>
                </div>
                <div class="progress">
                  <div class="progress__fill" style="width:${l.pct}%;background:linear-gradient(90deg, ${esc(l.couleur)}, ${tint(l.couleur, 65)})"></div>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card__head">
            <h3 class="card__title"><i class="fa-solid fa-chart-pie"></i> Répartition des prestations</h3>
          </div>
          <div class="chart-box chart-box--sm"><canvas id="chart-statuts"></canvas></div>
        </div>
      </div>

      <div class="grid grid-sidebar">
        <div class="card">
          <div class="card__head">
            <div>
              <h3 class="card__title"><i class="fa-solid fa-bolt"></i> ${expert ? 'Actions à conduire' : 'Vos actions'}</h3>
              <p class="card__subtitle">${expert
                ? 'Livrables déposés en attente de retour du client et points bloquants.'
                : 'Éléments produits par ElodiaTech qui attendent votre validation.'}</p>
            </div>
          </div>
          ${(aValider.length || sigs.length) ? `
            <div class="stack-sm">
              ${aValider.map((p) => `
                <div class="file-row">
                  <div class="file-icon" style="color:var(--warn-500)"><i class="fa-solid fa-hourglass-half"></i></div>
                  <div class="grow">
                    <div class="text-sm fw-800">${esc(p.titre)}</div>
                    <div class="text-xs text-muted">${esc(p.livrable)} · ${esc(LOTS[p.lot].nom)}</div>
                  </div>
                  ${Store.estExpert()
                    ? badge('En attente client', 'warn')
                    : `<button class="btn btn--ok btn--sm" data-action="valider-prestation" data-id="${esc(p.id)}"><i class="fa-solid fa-check"></i> Valider</button>`}
                </div>`).join('')}
              ${sigs.map((s) => `
                <div class="file-row">
                  <div class="file-icon" style="color:var(--purple-500)"><i class="fa-solid fa-file-signature"></i></div>
                  <div class="grow">
                    <div class="text-sm fw-800">${esc(s.titre)}</div>
                    <div class="text-xs text-muted">Signature électronique requise</div>
                  </div>
                  <button class="btn btn--sm" data-action="aller" data-route="signatures">Ouvrir</button>
                </div>`).join('')}
            </div>`
            : empty('Rien à traiter', 'Aucune action ne vous attend pour le moment.', 'fa-solid fa-mug-hot')}
        </div>

        <div class="card">
          <div class="card__head">
            <h3 class="card__title"><i class="fa-solid fa-calendar-days"></i> Prochaines échéances</h3>
          </div>
          ${echeances.length ? `
            <div class="timeline">
              ${echeances.map((e) => {
                const j = Dates.daysUntil(e.date);
                const ico = { reunion: 'fa-solid fa-video', jalon: 'fa-solid fa-flag', livrable: 'fa-solid fa-box',
                              formation: 'fa-solid fa-chalkboard-user', prestation: 'fa-solid fa-list-check' }[e.type] || 'fa-solid fa-circle';
                return `<div class="timeline__item">
                    <div class="timeline__dot"><i class="${ico}"></i></div>
                    <div class="grow">
                      <div class="timeline__date">${esc(Dates.format(e.date))}${j !== null && j >= 0 ? ` · J-${j}` : ''}</div>
                      <div class="timeline__title">${esc(e.titre)}</div>
                      <div class="timeline__desc">${esc(e.detail || '')}</div>
                    </div>
                  </div>`;
              }).join('')}
            </div>`
            : empty('Aucune échéance', 'Le planning est vide pour le moment.', 'fa-solid fa-calendar')}
        </div>
      </div>

      <div class="card">
        <div class="card__head">
          <div>
            <h3 class="card__title"><i class="fa-solid fa-tags"></i> Votre périmètre d'accompagnement</h3>
            <p class="card__subtitle">${esc(formule.pitch)}</p>
          </div>
          <div class="row-tight">
            <span class="badge badge--brand">${esc(formule.prixLabel)}</span>
            <span class="badge badge--neutre"><i class="fa-solid fa-clock"></i> ${formule.dureeMois} mois indicatifs</span>
            ${expert ? `<button class="btn btn--sm" data-action="aller" data-route="admin-offres"><i class="fa-solid fa-pen"></i> Gérer l'offre</button>` : ''}
          </div>
        </div>
        <div class="grid grid-4">
          ${Store.avancementParLot().map((l) => `
            <div class="card card--flat" style="border-left:3px solid ${esc(l.couleur)}">
              <div class="row-tight" style="margin-bottom:6px">
                <i class="${esc(l.icone)}" style="color:${esc(l.couleur)}"></i>
                <strong class="text-sm">${esc(l.nom)}</strong>
              </div>
              <div class="text-xs text-muted">${l.total} prestation${l.total > 1 ? 's' : ''} · ${l.pct} % réalisé</div>
            </div>`).join('')}
        </div>
      </div>

    </section>`;
  },

  /* ====================== FEUILLE DE ROUTE ====================== */
  'feuille-route'(filtres = {}) {
    const projet = Store.projet();
    const formule = Store.formule(projet);
    const expert = Store.estExpert();
    const pct = Store.avancement();
    const lots = Store.avancementParLot();
    let liste = Store.prestations();

    if (filtres.lot) liste = liste.filter((p) => p.lot === filtres.lot);
    if (filtres.statut) liste = liste.filter((p) => p.etat.statut === filtres.statut);
    if (filtres.q) {
      const q = filtres.q.toLowerCase();
      liste = liste.filter((p) => p.titre.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
    }

    const groupes = {};
    liste.forEach((p) => { (groupes[p.lot] = groupes[p.lot] || []).push(p); });

    let compteur = 0;

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-list-check"></i> Feuille de route du projet</h2>
            <p class="card__subtitle">
              ${expert
                ? "Pilotez chaque prestation du périmètre souscrit : faites évoluer le statut, l'échéance et les notes de suivi."
                : "Suivez en temps réel l'avancement de chaque prestation prévue par votre formule."}
            </p>
          </div>
          <div class="row-tight">
            <span class="badge badge--accent"><i class="fa-solid fa-tag"></i> Formule ${esc(formule.code)}</span>
            ${expert ? `<button class="btn btn--sm" data-action="planifier-echeances"><i class="fa-solid fa-wand-magic-sparkles"></i> Recalculer le rétroplanning</button>` : ''}
          </div>
        </div>

        <div class="card card--flat" style="margin-bottom:var(--sp-4)">
          <div class="spread" style="margin-bottom:10px">
            <div>
              <div class="text-xs text-muted fw-800" style="text-transform:uppercase;letter-spacing:.08em">Avancement global</div>
              <div style="font-size:1.8rem;font-weight:900;line-height:1.1">${pct} %</div>
            </div>
            <div class="text-xs text-muted text-center">
              ${Store.prestations().filter((p) => p.etat.statut === 'valide').length} prestations validées
              sur ${Store.prestations().length} · démarrage ${esc(Dates.format(projet.dateDebut))}
            </div>
          </div>
          ${progressBar(pct, 'lg')}
        </div>

        <div class="grid grid-4" style="margin-bottom:var(--sp-4)">
          ${lots.map((l) => `
            <button class="card card--flat card--interactive" data-action="filtrer-lot" data-lot="${esc(l.id)}" style="text-align:left;border-left:3px solid ${esc(l.couleur)}">
              <div class="row-tight" style="justify-content:space-between;margin-bottom:6px">
                <span class="text-xs fw-800 truncate"><i class="${esc(l.icone)}" style="color:${esc(l.couleur)}"></i> ${esc(l.nom)}</span>
                <span class="text-xs fw-800">${l.pct} %</span>
              </div>
              <div class="progress progress--sm">
                <div class="progress__fill" style="width:${l.pct}%;background:${esc(l.couleur)}"></div>
              </div>
              <div class="text-xs text-muted" style="margin-top:5px">${l.valides}/${l.total} validées</div>
            </button>`).join('')}
        </div>

        <div class="row" style="gap:var(--sp-2)">
          <div class="grow" style="max-width:320px">
            <input type="search" id="filtre-q" placeholder="Rechercher une prestation…" value="${esc(filtres.q || '')}" aria-label="Rechercher une prestation">
          </div>
          <select id="filtre-lot" style="max-width:260px" aria-label="Filtrer par lot">
            <option value="">Tous les lots</option>
            ${formule.lots.map((id) => `<option value="${id}" ${filtres.lot === id ? 'selected' : ''}>${esc(LOTS[id].nom)}</option>`).join('')}
          </select>
          <select id="filtre-statut" style="max-width:220px" aria-label="Filtrer par statut">
            <option value="">Tous les statuts</option>
            ${Object.values(STATUTS).map((s) => `<option value="${s.id}" ${filtres.statut === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
          </select>
          ${(filtres.lot || filtres.statut || filtres.q)
            ? `<button class="btn btn--ghost btn--sm" data-action="reset-filtres"><i class="fa-solid fa-xmark"></i> Réinitialiser</button>` : ''}
        </div>
      </div>

      ${Object.keys(groupes).length ? Object.keys(groupes).map((idLot) => {
        const lot = LOTS[idLot];
        const info = lots.find((l) => l.id === idLot) || { pct: 0, total: 0, valides: 0 };
        return `
        <div>
          <div class="lot-header">
            <div class="lot-header__icon" style="background:${tint(lot.couleur, 18)};color:${esc(lot.couleur)}">
              <i class="${esc(lot.icone)}"></i>
            </div>
            <div class="grow">
              <div class="lot-header__name">${esc(lot.nom)}</div>
              <div class="lot-header__meta">${info.valides} / ${info.total} prestations validées · ${info.pct} %</div>
            </div>
            <div style="width:120px">${progressBar(info.pct)}</div>
          </div>
          <div class="stack-sm">
            ${groupes[idLot].map((p) => cartePrestation(p, ++compteur)).join('')}
          </div>
        </div>`;
      }).join('') : empty('Aucune prestation', 'Aucune prestation ne correspond aux filtres sélectionnés.', 'fa-solid fa-filter')}
    </section>`;
  },

  /* ====================== PROJET DE SANTÉ ====================== */
  'projet-sante'() {
    const projet = Store.projet();
    const expert = Store.estExpert();
    const prestas = Store.prestations().filter((p) => p.lot === 'LA');
    const info = Store.avancementParLot().find((l) => l.id === 'LA') || { pct: 0 };
    const gdoc = urlSure(projet.gdocProjetSante);
    let n = 0;

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-book-medical"></i> Projet de santé</h2>
            <p class="card__subtitle">Document de référence attendu par l'ARS. Rédigé de façon collaborative, il structure l'ensemble de votre exercice coordonné.</p>
            ${bandeauFormule('LA')}
          </div>
          <div class="row-tight">
            <span class="badge badge--${info.pct >= 100 ? 'ok' : 'warn'}">${info.pct} % rédigé</span>
            <button class="btn btn--sm" data-action="imprimer"><i class="fa-solid fa-print"></i> Imprimer</button>
          </div>
        </div>

        <div class="card card--flat" style="border-color:color-mix(in srgb, var(--info-500) 40%, transparent)">
          <div class="row" style="margin-bottom:12px">
            <div class="file-icon file-icon--doc" style="width:44px;height:44px;font-size:1.1rem"><i class="fa-brands fa-google-drive"></i></div>
            <div class="grow">
              <h3 class="text-sm fw-800">Document collaboratif Google Docs</h3>
              <p class="text-xs text-muted">Version de travail partagée entre l'équipe et votre référent ElodiaTech.</p>
            </div>
          </div>
          ${expert ? `
            <div class="field">
              <label class="field__label" for="gdoc-url">Lien du document</label>
              <div class="input-group">
                <input type="url" id="gdoc-url" class="input input--mono" value="${esc(projet.gdocProjetSante)}" placeholder="https://docs.google.com/document/d/…">
                <button class="btn btn--primary" data-action="enregistrer-gdoc"><i class="fa-solid fa-floppy-disk"></i> Enregistrer</button>
              </div>
              <span class="field__hint">Ce lien est visible par le client depuis son espace.</span>
            </div>` : ''}
          <div class="row-tight" style="margin-top:12px">
            ${gdoc
              ? `<a class="btn btn--primary" href="${esc(gdoc)}" target="_blank" rel="noopener noreferrer">
                   <i class="fa-solid fa-arrow-up-right-from-square"></i> Ouvrir le projet de santé
                 </a>`
              : `<span class="badge badge--neutre"><i class="fa-solid fa-link-slash"></i> Aucun lien renseigné pour l'instant</span>`}
            ${urlSure(projet.driveUrl) ? `<a class="btn" href="${esc(urlSure(projet.driveUrl))}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-google-drive"></i> Dossier Drive</a>` : ''}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__head">
          <div>
            <h3 class="card__title"><i class="fa-solid fa-layer-group"></i> Les 5 chapitres structurants</h3>
            <p class="card__subtitle">Chaque chapitre est alimenté par les prestations correspondantes de la feuille de route.</p>
          </div>
        </div>
        <div class="grid grid-3">
          ${CHAPITRES_PDS.map((c) => {
            const liees = prestas.filter((p) => c.prestations.includes(p.id));
            const somme = liees.reduce((s, p) => s + (STATUTS[p.etat.statut]?.poids ?? 0), 0);
            const pctC = liees.length ? Math.round((somme / liees.length) * 100) : 0;
            return `<div class="card card--flat">
                <div class="row-tight" style="justify-content:space-between">
                  <span class="text-xs fw-800 text-brand">CHAPITRE ${esc(c.num)}</span>
                  <span class="badge badge--${pctC >= 100 ? 'ok' : pctC > 0 ? 'warn' : 'neutre'}">${pctC} %</span>
                </div>
                <h4 style="margin:6px 0 4px">${esc(c.titre)}</h4>
                <p class="text-xs text-muted">${esc(c.desc)}</p>
                <div style="margin-top:10px">${progressBar(pctC, 'sm')}</div>
              </div>`;
          }).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card__head">
          <h3 class="card__title"><i class="fa-solid fa-list-check"></i> Prestations du lot « Projet de santé »</h3>
        </div>
        <div class="stack-sm">
          ${prestas.map((p) => cartePrestation(p, ++n)).join('')}
        </div>
      </div>
    </section>`;
  },

  /* ====================== STRUCTURATION JURIDIQUE ====================== */
  juridique() {
    const projet = Store.projet();
    const expert = Store.estExpert();
    const modele = MODELES_JURIDIQUES[projet.modeleJuridique] || MODELES_JURIDIQUES.sisa;
    const prestas = Store.prestations().filter((p) => p.lot === 'LB');
    let n = 0;

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-scale-balanced"></i> Structuration juridique</h2>
            <p class="card__subtitle">Choix du véhicule juridique, rédaction des statuts et formalités d'immatriculation.</p>
            ${bandeauFormule('LB')}
          </div>
          ${expert ? `
            <div class="segmented" role="group" aria-label="Modèle juridique">
              ${Object.values(MODELES_JURIDIQUES).map((m) => `
                <button class="${projet.modeleJuridique === m.id ? 'is-active' : ''}" data-action="modele-juridique" data-modele="${esc(m.id)}">
                  <i class="${esc(m.icone)}"></i> ${esc(m.nom)}
                </button>`).join('')}
            </div>` : badge(modele.nom, 'purple', modele.icone)}
        </div>

        <div class="grid grid-sidebar">
          <div class="card card--flat">
            <div class="row" style="margin-bottom:10px">
              <div class="file-icon" style="color:var(--purple-500);width:44px;height:44px;font-size:1.1rem"><i class="${esc(modele.icone)}"></i></div>
              <div>
                <h3 class="text-sm fw-800">${esc(modele.libelle)}</h3>
                <p class="text-xs text-muted">Adapté à : ${esc(modele.cible)}</p>
              </div>
            </div>
            <ul class="offre__list">
              ${modele.points.map((pt) => `<li><i class="fa-solid fa-circle-check"></i> <span>${esc(pt)}</span></li>`).join('')}
            </ul>
          </div>

          <div class="card card--flat">
            <h3 class="section-title"><i class="fa-solid fa-circle-info"></i> Repère</h3>
            <p class="text-sm text-soft">
              ${projet.modeleJuridique === 'sisa'
                ? "La SISA est le seul véhicule permettant à une maison de santé de percevoir les rémunérations d'équipe versées au titre de l'accord conventionnel interprofessionnel (ACI)."
                : "L'association loi 1901 est la forme la plus courante pour porter un centre de santé, dont les professionnels sont salariés de la structure gestionnaire."}
            </p>
            <div class="row-tight" style="margin-top:12px">
              <button class="btn btn--sm" data-action="aller" data-route="signatures"><i class="fa-solid fa-file-signature"></i> Actes à signer</button>
              <button class="btn btn--sm" data-action="aller" data-route="documents"><i class="fa-solid fa-folder-open"></i> Pièces juridiques</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__head">
          <h3 class="card__title"><i class="fa-solid fa-list-check"></i> Prestations du lot juridique & ARS</h3>
        </div>
        <div class="stack-sm">${prestas.map((p) => cartePrestation(p, ++n)).join('')}</div>
      </div>
    </section>`;
  },

  /* ====================== FINANCEMENTS & AIDES ======================
     Guichets de dépôt, demandes en cours, pièces justificatives et
     prestations du lot : tout ce qui touche à l'argent au même endroit.
     ================================================================== */
  financements() {
    const expert = Store.estExpert();
    const projet = Store.projet();
    const formule = Store.formule(projet);
    const liste = Store.liste('financements');
    const prestas = Store.prestations().filter((p) => p.lot === 'LC');
    const pieces = Store.pieces();

    const total = liste.reduce((s, f) => s + f.montant, 0);
    const acquis = liste.filter((f) => f.statut === 'accorde').reduce((s, f) => s + f.montant, 0);
    const enCours = liste.filter((f) => ['depose', 'instruction'].includes(f.statut))
      .reduce((s, f) => s + f.montant, 0);

    const fournies = pieces.filter((p) => p.document).length;
    const manquantesClient = pieces.filter((p) => !p.document && p.par === 'client');
    let n = 0;

    return `
    <section class="view stack">

      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-sack-dollar"></i> Financements & aides</h2>
            <p class="card__subtitle">
              ${expert
                ? "Guichets de dépôt, demandes en cours et pièces du dossier, réunis sur un seul écran."
                : "Les aides sollicitées pour votre projet, et les pièces qu'il nous faut pour les obtenir."}
            </p>
            ${bandeauFormule('LC')}
          </div>
          ${expert ? `<button class="btn btn--primary btn--sm" data-action="ajouter-financement"><i class="fa-solid fa-plus"></i> Ajouter une demande</button>` : ''}
        </div>

        <div class="grid grid-4">
          <div class="card card--flat"><div class="kpi">
            <span class="kpi__label">Total sollicité</span>
            <span class="kpi__value">${esc(euros(total))}</span>
          </div></div>
          <div class="card card--flat"><div class="kpi">
            <span class="kpi__label">Accordé</span>
            <span class="kpi__value text-ok">${esc(euros(acquis))}</span>
          </div></div>
          <div class="card card--flat"><div class="kpi">
            <span class="kpi__label">En instruction</span>
            <span class="kpi__value text-warn">${esc(euros(enCours))}</span>
          </div></div>
          <div class="card card--flat"><div class="kpi">
            <span class="kpi__label">Pièces réunies</span>
            <span class="kpi__value">${fournies} / ${pieces.length}</span>
            ${progressBar((fournies / pieces.length) * 100, 'sm')}
          </div></div>
        </div>
      </div>

      <!-- Les portails par lesquels on dépose -->
      <div class="card">
        <div class="card__head">
          <div>
            <h3 class="card__title"><i class="fa-solid fa-landmark"></i> Guichets de dépôt</h3>
            <p class="card__subtitle">
              Les portails officiels sur lesquels les demandes sont déposées et suivies.
            </p>
          </div>
        </div>
        <div class="grid grid-3">
          ${PORTAILS.filter((p) => !p.formules || p.formules.includes(formule.code)).map((p) => `
            <div class="card card--flat" style="border-top:3px solid ${esc(p.couleur)}">
              <h4>${esc(p.nom)}</h4>
              <p class="text-xs text-muted" style="margin:6px 0 12px">${esc(p.desc)}</p>
              <div class="row-tight">
                ${p.liens.map((l) => `
                  <a class="btn btn--sm ${l.primaire ? 'btn--primary' : ''}" href="${esc(urlSure(l.url))}" target="_blank" rel="noopener noreferrer">
                    ${esc(l.label)} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:.65rem"></i>
                  </a>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Les demandes en cours -->
      <div class="card">
        <div class="card__head">
          <h3 class="card__title"><i class="fa-solid fa-file-invoice-dollar"></i> Demandes déposées</h3>
        </div>
        ${liste.length ? `
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Guichet / source</th><th>Montant</th><th>Statut</th><th>Échéance</th>${expert ? '<th></th>' : ''}</tr></thead>
            <tbody>
              ${liste.map((f) => {
                const st = STATUTS_FINANCEMENT[f.statut] || STATUTS_FINANCEMENT.etude;
                return `<tr>
                  <td class="table__strong">${esc(f.source)}</td>
                  <td class="mono">${esc(euros(f.montant))}</td>
                  <td>${badge(st.label, st.couleur)}</td>
                  <td class="table__muted">${esc(Dates.format(f.echeance))}</td>
                  ${expert ? `<td><button class="btn btn--ghost btn--sm" data-action="cycle-financement" data-id="${esc(f.id)}" title="Faire évoluer le statut"><i class="fa-solid fa-rotate"></i></button></td>` : ''}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : empty('Aucune demande enregistrée',
                        expert ? "Les demandes apparaîtront ici dès leur montage."
                               : "Votre référent déposera les demandes dès que le dossier sera complet.",
                        'fa-solid fa-sack-dollar')}
      </div>

      <!-- Les pièces à réunir -->
      <div class="card">
        <div class="card__head">
          <div>
            <h3 class="card__title"><i class="fa-solid fa-folder-tree"></i> Pièces du dossier</h3>
            <p class="card__subtitle">
              ${expert
                ? "Ce que réclament les financeurs. Les pièces marquées « à fournir » sont attendues du client."
                : "Ces documents nous sont demandés par les financeurs. Déposez ceux qui relèvent de votre structure."}
            </p>
          </div>
          <span class="badge badge--${fournies === pieces.length ? 'ok' : 'warn'}">
            ${fournies} / ${pieces.length} réunies
          </span>
        </div>

        ${!expert && manquantesClient.length ? `
          <div class="card card--flat" style="margin-bottom:var(--sp-4);border-left:3px solid var(--warn-500)">
            <p class="text-sm text-soft">
              <i class="fa-solid fa-circle-info text-warn"></i>
              <strong>${manquantesClient.length} document${manquantesClient.length > 1 ? 's' : ''} à nous transmettre.</strong>
              Déposez le fichier dans votre dossier Drive, puis rattachez-le à la ligne correspondante
              avec le bouton « Déposer ».
            </p>
          </div>` : ''}

        <div class="stack-xs">
          ${pieces.map((p) => {
            const fournie = !!p.document;
            const aMoi = p.par === 'client' ? !expert : expert;
            const lien = fournie ? urlSure(p.document.url) : '';

            return `
            <div class="file-row" style="border-left:3px solid ${fournie ? 'var(--ok-500)' : (p.par === 'client' ? 'var(--warn-500)' : 'var(--border-strong)')}">
              <div class="file-icon" style="color:${fournie ? 'var(--ok-500)' : 'var(--text-muted)'}">
                <i class="fa-solid ${fournie ? 'fa-circle-check' : 'fa-file-circle-question'}"></i>
              </div>

              <div class="grow" style="min-width:0">
                <div class="text-sm fw-800">${esc(p.nom)}</div>
                <div class="text-xs text-muted">${esc(p.aide)}</div>
                <div class="row-tight" style="margin-top:6px">
                  ${p.pour.map((d) => badge(DOSSIERS_AIDE[d]?.label || d, DOSSIERS_AIDE[d]?.couleur || 'neutre')).join('')}
                  ${fournie
                    ? `<span class="text-xs text-muted">${esc(p.document.nom)} · ${esc(Dates.format(p.document.date))}</span>`
                    : badge(p.par === 'client' ? 'À fournir par le client' : 'Produit par ElodiaTech',
                            p.par === 'client' ? 'warn' : 'neutre')}
                </div>
              </div>

              ${fournie && lien
                ? `<a class="btn btn--sm" href="${esc(lien)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-eye"></i> Voir</a>`
                : ''}
              ${fournie && expert
                ? `<button class="btn btn--ghost btn--sm" data-action="detacher-piece" data-piece="${esc(p.id)}" title="Détacher ce document"><i class="fa-solid fa-link-slash"></i></button>`
                : ''}
              ${!fournie && aMoi
                ? `<button class="btn btn--primary btn--sm" data-action="deposer-piece" data-piece="${esc(p.id)}">
                     <i class="fa-solid fa-file-arrow-up"></i> Déposer
                   </button>`
                : ''}
              ${!fournie && !aMoi ? badge('En attente', 'neutre') : ''}
            </div>`;
          }).join('')}
        </div>

        ${urlSure(projet.driveUrl) ? `
          <div class="row-tight" style="margin-top:var(--sp-4)">
            <a class="btn btn--sm" href="${esc(urlSure(projet.driveUrl))}" target="_blank" rel="noopener noreferrer">
              <i class="fa-brands fa-google-drive"></i> Ouvrir le Drive du projet
            </a>
            <span class="text-xs text-muted">Déposez-y vos fichiers avant de les rattacher ci-dessus.</span>
          </div>` : ''}
      </div>

      <div class="card">
        <div class="card__head"><h3 class="card__title"><i class="fa-solid fa-list-check"></i> Prestations du lot financements</h3></div>
        <div class="stack-sm">${prestas.map((p) => cartePrestation(p, ++n)).join('')}</div>
      </div>
    </section>`;
  },
  /* ====================== CONVENTIONS & PARTENARIATS ====================== */
  partenariats() {
    const expert = Store.estExpert();
    const liste = Store.liste('partenaires');
    const prestas = Store.prestations().filter((p) => p.lot === 'LD');
    let n = 0;

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-handshake"></i> Conventions & partenariats</h2>
            <p class="card__subtitle">Collectivités, établissements de santé et acteurs de la prévention du territoire.</p>
            ${bandeauFormule('LD')}
          </div>
          ${expert ? `<button class="btn btn--primary btn--sm" data-action="ajouter-partenaire"><i class="fa-solid fa-plus"></i> Ajouter un partenaire</button>` : ''}
        </div>

        ${liste.length ? `
        <div class="grid grid-2">
          ${liste.map((p) => {
            const st = STATUTS_PARTENAIRE[p.statut] || STATUTS_PARTENAIRE.a_faire;
            return `<div class="file-row">
                <div class="file-icon" style="color:var(--brand-500)"><i class="fa-solid fa-handshake-angle"></i></div>
                <div class="grow">
                  <div class="text-sm fw-800">${esc(p.nom)}</div>
                  <div class="text-xs text-muted">${esc(p.type)}</div>
                </div>
                ${badge(st.label, st.couleur)}
                ${expert ? `<button class="btn btn--ghost btn--sm" data-action="cycle-partenaire" data-id="${esc(p.id)}" title="Faire évoluer le statut"><i class="fa-solid fa-rotate"></i></button>` : ''}
              </div>`;
          }).join('')}
        </div>` : empty('Aucun partenaire', 'Les conventions apparaîtront ici au fil de leur signature.', 'fa-solid fa-handshake')}
      </div>

      <div class="card">
        <div class="card__head"><h3 class="card__title"><i class="fa-solid fa-list-check"></i> Prestations du lot partenariats</h3></div>
        <div class="stack-sm">${prestas.map((p) => cartePrestation(p, ++n)).join('')}</div>
      </div>
    </section>`;
  },

  /* ====================== PRESTATAIRES & OUTILS ====================== */
  prestataires() {
    const expert = Store.estExpert();
    const prestas = Store.prestations().filter((p) => p.lot === 'LE');
    const annuaire = Store.state.prestataires || [];
    let n = 0;

    // Tri par métier puis par nom : l'annuaire reste lisible en s'étoffant.
    const tries = annuaire.slice().sort((a, b) =>
      (a.metier || '').localeCompare(b.metier || '') || (a.nom || '').localeCompare(b.nom || ''));

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-screwdriver-wrench"></i> Prestataires & outils métier</h2>
            <p class="card__subtitle">
              ${expert
                ? "Votre annuaire de partenaires, partagé entre tous vos dossiers."
                : 'Les partenaires que votre référent ElodiaTech peut mobiliser sur votre projet.'}
            </p>
            ${bandeauFormule('LE')}
          </div>
          ${expert ? `
            <button class="btn btn--primary btn--sm" data-action="fiche-prestataire">
              <i class="fa-solid fa-plus"></i> Ajouter un prestataire
            </button>` : ''}
        </div>

        ${tries.length ? `
          <div class="grid grid-3">
            ${tries.map((v) => `
              <div class="card card--flat" style="display:flex;flex-direction:column">
                <div class="spread" style="margin-bottom:8px">
                  <span class="badge badge--${v.lot === 'LF' ? 'purple' : 'brand'}">${esc(v.metier || 'Prestataire')}</span>
                  ${expert ? `
                    <span class="row-tight" style="gap:2px">
                      <button class="btn btn--ghost btn--sm" data-action="fiche-prestataire" data-id="${esc(v.id)}" title="Modifier">
                        <i class="fa-solid fa-pen"></i>
                      </button>
                      <button class="btn btn--ghost btn--sm" data-action="supprimer-prestataire" data-id="${esc(v.id)}" title="Retirer de l'annuaire">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    </span>` : ''}
                </div>
                <h4>${esc(v.nom)}</h4>
                <p class="text-xs text-muted" style="margin-top:4px">${esc(v.specialite)}</p>
                ${v.contact ? `
                  <a class="text-xs mt-auto" href="mailto:${esc(v.contact)}" style="padding-top:10px">
                    <i class="fa-solid fa-envelope"></i> ${esc(v.contact)}
                  </a>` : ''}
              </div>`).join('')}
          </div>`
          : empty('Annuaire vide',
                  expert ? 'Ajoutez vos partenaires : expert-comptable, éditeurs, architectes…'
                         : 'Aucun prestataire référencé pour le moment.',
                  'fa-solid fa-screwdriver-wrench')}
      </div>

      <div class="card">
        <div class="card__head"><h3 class="card__title"><i class="fa-solid fa-list-check"></i> Prestations du lot prestataires</h3></div>
        <div class="stack-sm">${prestas.map((p) => cartePrestation(p, ++n)).join('')}</div>
      </div>
    </section>`;
  },

  /* ====================== IMMOBILIER (option) ====================== */
  immobilier() {
    const projet = Store.projet();
    const expert = Store.estExpert();

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-building-circle-check"></i> Immobilier, locaux & conformité ERP</h2>
            <p class="card__subtitle">Localisation, intervenants du chantier et cahier des charges d'aménagement.</p>
            <div class="row-tight text-xs text-muted">
              <span class="badge badge--neutre"><i class="fa-solid fa-puzzle-piece"></i> Module optionnel</span>
              <span><i class="fa-solid fa-ruler-combined"></i> ${esc(projet.surface || 0)} m²</span>
            </div>
          </div>
          ${expert ? `<button class="btn btn--sm btn--danger" data-action="desactiver-immobilier"><i class="fa-solid fa-eye-slash"></i> Désactiver le module</button>` : ''}
        </div>

        <div class="grid grid-sidebar">
          <div>
            <h3 class="section-title"><i class="fa-solid fa-location-dot"></i> Localisation du site</h3>
            <div id="map" role="img" aria-label="Carte de localisation du site du projet"></div>
            <p class="text-xs text-muted" style="margin-top:8px"><i class="fa-solid fa-map-pin"></i> ${esc(projet.adresse || 'Adresse non renseignée')}</p>
          </div>

          <div>
            <h3 class="section-title"><i class="fa-solid fa-users-gear"></i> Intervenants du projet</h3>
            <div class="stack-xs">
              ${Store.state.intervenantsImmo.map((i) => {
                const st = STATUTS[i.statut] || STATUTS.a_faire;
                return `<div class="file-row">
                    <div class="file-icon"><i class="${esc(i.icone)}"></i></div>
                    <div class="grow text-sm fw-800">${esc(i.etape)}</div>
                    ${badge(st.label, st.couleur)}
                  </div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__head">
          <div>
            <h3 class="card__title"><i class="fa-solid fa-clipboard-list"></i> Cahier des charges ElodiaTech</h3>
            <p class="card__subtitle">19 critères réglementaires et techniques applicables aux MSP et centres de santé.</p>
          </div>
          <span class="badge badge--brand">${CAHIER_ERP.reduce((s, g) => s + g.criteres.length, 0)} critères</span>
        </div>
        <div class="grid grid-4">
          ${CAHIER_ERP.map((g) => `
            <div class="card card--flat" style="border-top:3px solid ${esc(g.couleur)}">
              <div class="text-xs fw-800" style="color:${esc(g.couleur)};text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
                <i class="${esc(g.icone)}"></i> ${esc(g.groupe)}
              </div>
              <ul class="offre__list">
                ${g.criteres.map((c) => `<li><i class="fa-solid fa-square-check"></i> <span>${esc(c)}</span></li>`).join('')}
              </ul>
            </div>`).join('')}
        </div>
      </div>
    </section>`;
  },

  /* ====================== IDENTITÉ VISUELLE & WEB ====================== */
  identite() {
    const projet = Store.projet();
    const expert = Store.estExpert();
    const prestas = Store.prestations().filter((p) => p.lot === 'LF');
    let n = 0;

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-palette"></i> Identité visuelle & présence en ligne</h2>
            <p class="card__subtitle">Logo, charte graphique, déclinaisons et site internet professionnel de la structure.</p>
            ${bandeauFormule('LF')}
          </div>
        </div>

        <div class="stack-sm">
          <div class="card card--flat">
            <h3 class="section-title"><i class="fa-solid fa-globe"></i> Site internet</h3>
            ${expert ? `
              <div class="field">
                <label class="field__label" for="site-url">Adresse du site publié</label>
                <div class="input-group">
                  <input type="url" id="site-url" class="input input--mono" value="${esc(projet.siteUrl || '')}" placeholder="https://…">
                  <button class="btn btn--primary" data-action="enregistrer-site"><i class="fa-solid fa-floppy-disk"></i> Enregistrer</button>
                </div>
              </div>` : ''}
            <div class="row-tight" style="margin-top:12px">
              ${urlSure(projet.siteUrl)
                ? `<a class="btn btn--primary" href="${esc(urlSure(projet.siteUrl))}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Visiter le site</a>`
                : badge('Site non encore publié', 'neutre', 'fa-solid fa-hourglass-half')}
            </div>
          </div>

          <div class="card card--flat">
            <h3 class="section-title"><i class="fa-solid fa-swatchbook"></i> Livrables graphiques</h3>
            <p class="text-xs text-muted" style="margin:-6px 0 12px">
              ${expert
                ? 'Déposez le lien du fichier depuis le Drive, puis soumettez-le à la validation du client.'
                : 'Les fichiers sont consultables dès leur mise à disposition.'}
            </p>
            <div class="stack-xs">
              ${prestas.map((p) => {
                const lien = urlSure(p.etat.livrableUrl);
                return `
                <div class="file-row">
                  <div class="file-icon file-icon--img"><i class="fa-solid fa-image"></i></div>
                  <div class="grow" style="min-width:0">
                    <div class="text-sm fw-800">${esc(p.livrable)}</div>
                    <div class="text-xs text-muted">${esc(p.titre)}</div>
                  </div>
                  ${badgeStatut(p.etat.statut)}
                  ${lien
                    ? `<a class="btn btn--sm" href="${esc(lien)}" target="_blank" rel="noopener noreferrer">
                         <i class="fa-solid fa-download"></i> Ouvrir
                       </a>`
                    : ''}
                  ${expert
                    ? `<button class="btn btn--sm ${lien ? '' : 'btn--primary'}" data-action="deposer-livrable" data-id="${esc(p.id)}">
                         <i class="fa-solid fa-file-arrow-up"></i> ${lien ? 'Remplacer' : 'Déposer'}
                       </button>`
                    : ''}
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__head"><h3 class="card__title"><i class="fa-solid fa-list-check"></i> Prestations du lot identité</h3></div>
        <div class="stack-sm">${prestas.map((p) => cartePrestation(p, ++n)).join('')}</div>
      </div>
    </section>`;
  },

  /* ====================== DÉPLOIEMENT ====================== */
  deploiement() {
    const prestas = Store.prestations().filter((p) => p.lot === 'LG');
    const evts = Store.liste('evenements').filter((e) => ['formation', 'jalon'].includes(e.type));
    let n = 0;

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-rocket"></i> Déploiement & coordination</h2>
            <p class="card__subtitle">Installation des outils, formation de l'équipe et coordination jusqu'à l'ouverture.</p>
            ${bandeauFormule('LG')}
          </div>
        </div>
        ${evts.length ? `
          <div class="timeline">
            ${evts.map((e) => `
              <div class="timeline__item">
                <div class="timeline__dot"><i class="fa-solid fa-${e.type === 'formation' ? 'chalkboard-user' : 'flag'}"></i></div>
                <div>
                  <div class="timeline__date">${esc(Dates.format(e.date))}</div>
                  <div class="timeline__title">${esc(e.titre)}</div>
                  <div class="timeline__desc">${esc([e.heure, e.lieu].filter(Boolean).join(' · '))}</div>
                </div>
              </div>`).join('')}
          </div>` : empty('Aucun jalon de déploiement', 'Les formations et jalons apparaîtront ici.', 'fa-solid fa-rocket')}
      </div>

      <div class="card">
        <div class="card__head"><h3 class="card__title"><i class="fa-solid fa-list-check"></i> Prestations du lot déploiement</h3></div>
        <div class="stack-sm">${prestas.map((p) => cartePrestation(p, ++n)).join('')}</div>
      </div>
    </section>`;
  },

  /* ====================== COFFRE-FORT DOCUMENTAIRE ====================== */
  documents(filtres = {}) {
    const projet = Store.projet();
    const expert = Store.estExpert();
    let docs = Store.liste('documents');
    if (filtres.cat) docs = docs.filter((d) => d.cat === filtres.cat);
    if (filtres.q) docs = docs.filter((d) => d.nom.toLowerCase().includes(filtres.q.toLowerCase()));

    const iconeType = { pdf: 'fa-file-pdf', doc: 'fa-file-word', xls: 'fa-file-excel', zip: 'fa-file-zipper', img: 'fa-file-image' };
    const classeType = { pdf: 'file-icon--pdf', doc: 'file-icon--doc', xls: 'file-icon--xls', img: 'file-icon--img' };

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-folder-open"></i> Coffre-fort documentaire</h2>
            <p class="card__subtitle">Ensemble des pièces du dossier, synchronisées avec le dossier Drive du projet.</p>
          </div>
          <div class="row-tight">
            ${urlSure(projet.driveUrl)
              ? `<a class="btn btn--sm" href="${esc(urlSure(projet.driveUrl))}" target="_blank" rel="noopener noreferrer">
                   <i class="fa-brands fa-google-drive"></i> Ouvrir le Drive du projet
                 </a>`
              : ''}
            <button class="btn btn--primary btn--sm" data-action="ajouter-document">
              <i class="fa-solid fa-plus"></i> Déposer un document
            </button>
          </div>
        </div>

        <div class="card card--flat" style="margin-bottom:var(--sp-4);border-color:color-mix(in srgb, var(--info-500) 35%, transparent)">
          <div class="row">
            <i class="fa-brands fa-google-drive" style="font-size:1.3rem;color:var(--info-500)"></i>
            <p class="text-sm text-soft grow">
              ${urlSure(projet.driveUrl)
                ? `Déposez vos fichiers dans le dossier Drive du projet, dans le sous-dossier correspondant à leur catégorie,
                   puis référencez-les ici pour qu'ils apparaissent dans le suivi. ${expert ? 'Le client dispose des mêmes accès.' : "Votre référent ElodiaTech reçoit la notification du dépôt."}`
                : "Le dossier Drive de ce projet n'est pas encore renseigné. Vous pouvez déjà référencer un document en collant son lien de partage."}
            </p>
          </div>
        </div>

        <div class="row" style="margin-bottom:var(--sp-4)">
          <div class="grow" style="max-width:320px">
            <input type="search" id="doc-q" placeholder="Rechercher un document…" value="${esc(filtres.q || '')}" aria-label="Rechercher un document">
          </div>
          <select id="doc-cat" style="max-width:220px" aria-label="Filtrer par catégorie">
            <option value="">Toutes les catégories</option>
            ${CATEGORIES_DOC.map((c) => `<option value="${esc(c)}" ${filtres.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
        </div>

        ${docs.length ? `
          <div class="stack-xs">
            ${docs.map((d) => `
              <div class="file-row">
                <div class="file-icon ${classeType[d.type] || ''}"><i class="fa-solid ${iconeType[d.type] || 'fa-file'}"></i></div>
                <div class="grow">
                  <div class="text-sm fw-800 truncate">${esc(d.nom)}</div>
                  <div class="text-xs text-muted">${esc(d.cat)} · ${esc(d.taille || '')} · déposé le ${esc(Dates.format(d.date))} par ${esc(d.auteur || '—')}</div>
                </div>
                ${urlSure(d.url)
                  ? `<a class="btn btn--sm" href="${esc(urlSure(d.url))}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Ouvrir</a>`
                  : `<button class="btn btn--sm" data-action="apercu-document" data-id="${esc(d.id)}"><i class="fa-solid fa-eye"></i> Aperçu</button>`}
                ${expert ? `<button class="btn btn--ghost btn--sm" data-action="supprimer-document" data-id="${esc(d.id)}" aria-label="Supprimer ${esc(d.nom)}"><i class="fa-solid fa-trash"></i></button>` : ''}
              </div>`).join('')}
          </div>` : empty('Aucun document', "Aucun document ne correspond à votre recherche.", 'fa-solid fa-folder-open')}
      </div>
    </section>`;
  },

  /* ====================== SIGNATURES ====================== */
  signatures() {
    const expert = Store.estExpert();
    const liste = Store.liste('signatures');
    const enAttente = liste.filter((s) => s.statut === 'a_signer');
    const signes = liste.filter((s) => s.statut === 'signe');

    const carte = (s) => {
      const st = STATUTS_SIGNATURE[s.statut] || STATUTS_SIGNATURE.a_signer;
      const lien = urlSure(s.url);
      return `<div class="card card--flat" ${s.statut === 'a_signer' ? 'style="border-color:color-mix(in srgb, var(--warn-500) 45%, transparent)"' : ''}>
          <div class="row-tight" style="justify-content:space-between;margin-bottom:8px">
            ${badge(st.label, st.couleur, st.icone)}
            ${s.date ? `<span class="text-xs text-muted">${esc(Dates.format(s.date))}</span>` : ''}
          </div>
          <h4>${esc(s.titre)}</h4>
          <p class="text-xs text-muted" style="margin:4px 0 12px">${esc(s.desc)}</p>
          ${expert ? `
            <div class="field" style="margin-bottom:10px">
              <label class="field__label">Lien du parapheur électronique</label>
              <div class="input-group">
                <input type="url" class="input input--mono" data-sig-url="${esc(s.id)}" value="${esc(s.url || '')}" placeholder="https://…">
                <button class="btn btn--sm" data-action="enregistrer-signature" data-id="${esc(s.id)}"><i class="fa-solid fa-floppy-disk"></i></button>
              </div>
            </div>` : ''}
          <div class="row-tight">
            ${s.statut === 'a_signer'
              ? (lien
                  ? `<a class="btn btn--primary btn--sm" href="${esc(lien)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-pen-nib"></i> Signer le document</a>`
                  : badge('Parapheur en préparation', 'neutre', 'fa-solid fa-hourglass-half'))
              : (lien
                  ? `<a class="btn btn--sm" href="${esc(lien)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-eye"></i> Consulter l'original signé</a>`
                  : `<button class="btn btn--sm" data-action="apercu-signature" data-id="${esc(s.id)}"><i class="fa-solid fa-eye"></i> Consulter</button>`)}
            ${expert && s.statut === 'a_signer'
              ? `<button class="btn btn--ok btn--sm" data-action="marquer-signe" data-id="${esc(s.id)}"><i class="fa-solid fa-check"></i> Marquer comme signé</button>` : ''}
          </div>
        </div>`;
    };

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-file-signature"></i> Validation & signatures électroniques</h2>
            <p class="card__subtitle">
              ${expert
                ? "Déposez ici les liens des parapheurs créés pour chaque acte : le client y accède directement depuis son espace."
                : "Les actes de votre dossier sont signés électroniquement. Chaque document signé est horodaté puis archivé dans votre coffre-fort."}
            </p>
          </div>
          <div class="row-tight">
            ${badge(`${enAttente.length} en attente`, enAttente.length ? 'warn' : 'neutre')}
            ${badge(`${signes.length} signé${signes.length > 1 ? 's' : ''}`, 'ok')}
          </div>
        </div>

        <div class="card card--flat" style="border-color:color-mix(in srgb, var(--info-500) 35%, transparent);margin-bottom:var(--sp-4)">
          <div class="row">
            <i class="fa-solid fa-shield-halved" style="font-size:1.3rem;color:var(--info-500)"></i>
            <p class="text-sm text-soft grow">
              La signature s'effectue sur un parapheur électronique après authentification du signataire.
              Chaque acte signé fait l'objet d'un certificat d'horodatage conforme au règlement eIDAS,
              puis l'original est archivé dans le coffre-fort documentaire du projet.
            </p>
          </div>
        </div>

        ${enAttente.length ? `
          <h3 class="section-title"><i class="fa-solid fa-pen-nib"></i> En attente de signature</h3>
          <div class="grid grid-3" style="margin-bottom:var(--sp-5)">${enAttente.map(carte).join('')}</div>` : ''}

        ${signes.length ? `
          <h3 class="section-title"><i class="fa-solid fa-circle-check"></i> Actes signés & archivés</h3>
          <div class="grid grid-3">${signes.map(carte).join('')}</div>` : ''}

        ${!liste.length ? empty('Aucun acte', "Aucun document n'est encore soumis à signature.", 'fa-solid fa-file-signature') : ''}
      </div>
    </section>`;
  },

  /* ====================== LIVRABLES ====================== */
  livrables() {
    const prestas = Store.prestations();
    const lots = Store.avancementParLot();

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-box-archive"></i> Bibliothèque des livrables</h2>
            <p class="card__subtitle">Chaque prestation de votre formule donne lieu à un livrable identifié. Les livrables validés sont téléchargeables.</p>
          </div>
          <span class="badge badge--ok">${prestas.filter((p) => p.etat.statut === 'valide').length} / ${prestas.length} livrés</span>
        </div>

        ${lots.map((l) => {
          const items = prestas.filter((p) => p.lot === l.id);
          if (!items.length) return '';
          return `
          <div style="margin-bottom:var(--sp-5)">
            <h3 class="section-title"><i class="${esc(l.icone)}" style="color:${esc(l.couleur)}"></i> ${esc(l.nom)}</h3>
            <div class="stack-xs">
              ${items.map((p) => {
                const pret = p.etat.statut === 'valide';
                const lien = urlSure(p.etat.livrableUrl);
                return `<div class="file-row">
                    <div class="file-icon ${pret ? 'file-icon--pdf' : ''}" style="${pret ? '' : 'color:var(--text-muted)'}">
                      <i class="fa-solid ${pret ? 'fa-file-pdf' : 'fa-file-circle-plus'}"></i>
                    </div>
                    <div class="grow">
                      <div class="text-sm fw-800">${esc(p.livrable)}</div>
                      <div class="text-xs text-muted">${esc(p.titre)}</div>
                    </div>
                    ${badgeStatut(p.etat.statut)}
                    ${lien
                      ? `<a class="btn btn--sm" href="${esc(lien)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-download"></i> Ouvrir</a>`
                      : (pret && !Store.estExpert()
                          ? `<button class="btn btn--sm" data-action="telecharger-livrable" data-id="${esc(p.id)}"><i class="fa-solid fa-download"></i> Télécharger</button>`
                          : (!Store.estExpert() ? `<span class="text-xs text-muted nowrap">En production</span>` : ''))}
                    ${Store.estExpert()
                      ? `<button class="btn btn--sm ${lien ? '' : 'btn--primary'}" data-action="deposer-livrable" data-id="${esc(p.id)}">
                           <i class="fa-solid fa-file-arrow-up"></i> ${lien ? 'Remplacer' : 'Déposer'}
                         </button>`
                      : ''}
                  </div>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    </section>`;
  },

  /* ====================== MESSAGERIE ====================== */
  messagerie() {
    const projet = Store.projet();
    const expert = Store.estExpert();
    const msgs = Store.liste('messages');
    const interlocuteur = expert ? projet.client.nom : projet.consultant.nom;

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-comments"></i> Messagerie du projet</h2>
            <p class="card__subtitle">Échanges avec ${esc(interlocuteur)} — historique conservé dans le dossier.</p>
          </div>
          <span class="badge badge--ok"><span class="dot" style="background:var(--ok-500)"></span> En ligne</span>
        </div>

        <div class="chat" id="chat">
          ${msgs.length ? msgs.map((m) => {
            const sortant = (expert && m.role === 'expert') || (!expert && m.role === 'client');
            return `<div class="msg ${sortant ? 'msg--out' : ''}">
                <div class="avatar ${m.role === 'expert' ? 'avatar--admin' : ''}">${esc(initiales(m.auteur))}</div>
                <div>
                  ${!sortant ? `<div class="msg__author">${esc(m.auteur)}</div>` : ''}
                  <div class="msg__bubble">
                    ${esc(m.texte)}
                    <span class="msg__time">${esc(Dates.format(m.date.slice(0, 10)))}</span>
                  </div>
                </div>
              </div>`;
          }).join('') : `<div class="empty" style="margin:auto"><i class="fa-solid fa-comments"></i>
              <div class="empty__title">Aucun message</div>
              <div class="empty__text">Démarrez la conversation avec votre ${expert ? 'client' : 'référent'}.</div></div>`}
        </div>

        <form id="form-message" class="row" style="margin-top:var(--sp-3);flex-wrap:nowrap">
          <input type="text" id="message-input" class="grow" placeholder="Écrire un message…" required maxlength="1000" autocomplete="off" aria-label="Votre message">
          <button type="submit" class="btn btn--primary"><i class="fa-solid fa-paper-plane"></i> Envoyer</button>
        </form>
      </div>
    </section>`;
  },

  /* ====================== PLANNING ====================== */
  planning(filtres = {}) {
    const expert = Store.estExpert();

    // Vue consolidée du portefeuille, réservée à l'expert.
    if (expert && filtres.portee === 'tous') return Views._planningGlobal(filtres);

    const evts = Store.liste('evenements').slice().sort((a, b) => a.date.localeCompare(b.date));
    const prestas = Store.prestations()
      .filter((p) => p.etat.statut !== 'valide' && p.etat.echeance)
      .sort((a, b) => a.etat.echeance.localeCompare(b.etat.echeance))
      .slice(0, 8);

    const parMois = {};
    evts.forEach((e) => {
      const cle = e.date.slice(0, 7);
      (parMois[cle] = parMois[cle] || []).push(e);
    });


    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-calendar-days"></i> Planning & échéances</h2>
            <p class="card__subtitle">Rendez-vous, jalons réglementaires et dates de livraison.</p>
          </div>
          <div class="row-tight">
            ${expert ? Views._basculePortee('projet') : ''}
            ${expert ? `
              <button class="btn btn--primary btn--sm" data-action="programmer-echange">
                <i class="fa-solid fa-comments"></i> Programmer un échange
              </button>
              <button class="btn btn--sm" data-action="ajouter-evenement">
                <i class="fa-solid fa-flag"></i> Jalon ou livraison
              </button>` : ''}
          </div>
        </div>

        ${Object.keys(parMois).length ? Object.keys(parMois).sort().map((mois) => `
          <div style="margin-bottom:var(--sp-5)">
            <h3 class="section-title">
              <i class="fa-solid fa-calendar"></i>
              ${esc(new Date(mois + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))}
            </h3>
            <div class="stack-xs">
              ${parMois[mois].map((e) => {
                const j = Dates.daysUntil(e.date);
                const passe = j !== null && j < 0;
                const echange = estUnEchange(e.type);
                const canal = CANAUX[e.canal];
                const typeEvt = TYPES_EVENEMENT[e.type] || TYPES_EVENEMENT.jalon;

                return `<div class="file-row" ${passe ? 'style="opacity:.6"' : ''}>
                    <div class="file-icon" style="color:var(--brand-500)">
                      <i class="${esc(echange && canal ? canal.icone : typeEvt.icone)}"></i>
                    </div>
                    <div class="grow" style="min-width:0">
                      <div class="text-sm fw-800">${esc(e.titre)}</div>
                      <div class="text-xs text-muted">
                        ${echange && canal ? esc(canal.label) + ' · ' : ''}${esc(Dates.formatLong(e.date))}${e.heure ? ' · ' + esc(e.heure) : ''}${e.lieu ? ' · ' + esc(e.lieu) : ''}
                      </div>
                    </div>
                    ${passe ? '' : boutonEchange(e)}
                    ${passe ? badge('Passé', 'neutre') : badge(j === 0 ? "Aujourd'hui" : `J-${j}`, j <= 7 ? 'warn' : 'brand')}
                    ${expert && passe && echange
                      ? `<button class="btn btn--sm" data-action="cr-depuis-evenement" data-id="${esc(e.id)}">
                           <i class="fa-solid fa-pen"></i> Compte rendu
                         </button>` : ''}
                    ${expert ? `<button class="btn btn--ghost btn--sm" data-action="supprimer-evenement" data-id="${esc(e.id)}" aria-label="Supprimer ${esc(e.titre)}"><i class="fa-solid fa-trash"></i></button>` : ''}
                  </div>`;
              }).join('')}
            </div>
          </div>`).join('') : empty('Aucun événement', 'Le planning est vide.', 'fa-solid fa-calendar')}
      </div>

      <div class="card">
        <div class="card__head">
          <h3 class="card__title"><i class="fa-solid fa-hourglass-half"></i> Prochaines échéances de prestations</h3>
        </div>
        ${prestas.length ? `
          <div class="stack-xs">
            ${prestas.map((p) => {
              const j = Dates.daysUntil(p.etat.echeance);
              return `<div class="file-row">
                  <div class="file-icon" style="color:${esc(LOTS[p.lot].couleur)}"><i class="${esc(LOTS[p.lot].icone)}"></i></div>
                  <div class="grow">
                    <div class="text-sm fw-800">${esc(p.titre)}</div>
                    <div class="text-xs text-muted">${esc(LOTS[p.lot].nom)} · échéance ${esc(Dates.format(p.etat.echeance))}</div>
                  </div>
                  ${j < 0 ? badge(`Retard ${Math.abs(j)} j`, 'danger') : badge(`J-${j}`, j <= 7 ? 'warn' : 'neutre')}
                </div>`;
            }).join('')}
          </div>` : empty('Aucune échéance', 'Toutes les prestations sont validées.', 'fa-solid fa-circle-check')}
      </div>
    </section>`;
  },

  /** Bascule « ce projet » / « tous les projets » du planning. */
  _basculePortee(active) {
    return `
      <div class="segmented" role="group" aria-label="Portée du planning">
        <button class="${active === 'projet' ? 'is-active' : ''}" data-action="portee-planning" data-portee="projet">
          <i class="fa-solid fa-folder-open"></i> Ce projet
        </button>
        <button class="${active === 'tous' ? 'is-active' : ''}" data-action="portee-planning" data-portee="tous">
          <i class="fa-solid fa-layer-group"></i> Tous les projets
        </button>
      </div>`;
  },

  /** Planning consolidé du portefeuille. */
  _planningGlobal(filtres = {}) {
    let entrees = Store.planningGlobal();

    if (filtres.projet) entrees = entrees.filter((e) => e.projetId === filtres.projet);
    if (filtres.masquerPasse !== false) {
      const aujourdhui = Dates.today();
      entrees = entrees.filter((e) => e.date >= aujourdhui);
    }

    const parMois = {};
    entrees.forEach((e) => { (parMois[e.date.slice(0, 7)] = parMois[e.date.slice(0, 7)] || []).push(e); });

    const couleurProjet = {};
    Store.state.projets.forEach((p) => { couleurProjet[p.id] = FORMULES[p.formule].couleur; });

    const icones = { echange: 'fa-comments', reunion: 'fa-comments', jalon: 'fa-flag',
                     livrable: 'fa-box', formation: 'fa-chalkboard-user', prestation: 'fa-list-check' };

    const sept = Dates.addDays(Dates.today(), 7);
    const trente = Dates.addDays(Dates.today(), 30);

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-calendar-days"></i> Planning général du portefeuille</h2>
            <p class="card__subtitle">
              Rendez-vous, jalons et échéances de prestations de l'ensemble de vos clients,
              sur une seule frise.
            </p>
          </div>
          <div class="row-tight">
            ${Views._basculePortee('tous')}
            <button class="btn btn--primary btn--sm" data-action="ajouter-evenement"><i class="fa-solid fa-plus"></i> Ajouter un événement</button>
          </div>
        </div>

        <div class="grid grid-3" style="margin-bottom:var(--sp-4)">
          <div class="card card--flat"><div class="kpi">
            <span class="kpi__label">Dans les 7 jours</span>
            <span class="kpi__value">${entrees.filter((e) => e.date <= sept).length}</span>
          </div></div>
          <div class="card card--flat"><div class="kpi">
            <span class="kpi__label">Dans les 30 jours</span>
            <span class="kpi__value">${entrees.filter((e) => e.date <= trente).length}</span>
          </div></div>
          <div class="card card--flat"><div class="kpi">
            <span class="kpi__label">Clients concernés</span>
            <span class="kpi__value">${new Set(entrees.map((e) => e.projetId)).size} / ${Store.state.projets.length}</span>
          </div></div>
        </div>

        <div class="row" style="margin-bottom:var(--sp-4)">
          <select id="planning-projet" style="max-width:280px" aria-label="Filtrer par client">
            <option value="">Tous les clients</option>
            ${Store.state.projets.map((p) => `<option value="${esc(p.id)}" ${filtres.projet === p.id ? 'selected' : ''}>${esc(p.nom)} — ${esc(p.ville)}</option>`).join('')}
          </select>
          ${filtres.projet ? `<button class="btn btn--ghost btn--sm" data-action="reset-filtres"><i class="fa-solid fa-xmark"></i> Tout afficher</button>` : ''}
        </div>

        ${Object.keys(parMois).length ? Object.keys(parMois).sort().map((mois) => `
          <div style="margin-bottom:var(--sp-5)">
            <h3 class="section-title">
              <i class="fa-solid fa-calendar"></i>
              ${esc(new Date(mois + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))}
              <span class="text-xs text-muted" style="font-weight:600;text-transform:none;letter-spacing:0">
                — ${parMois[mois].length} échéance${parMois[mois].length > 1 ? 's' : ''}
              </span>
            </h3>
            <div class="stack-xs">
              ${parMois[mois].map((e) => {
                const j = Dates.daysUntil(e.date);
                return `
                <div class="file-row" style="border-left:3px solid ${esc(couleurProjet[e.projetId] || 'var(--border)')}">
                  <div class="file-icon" style="color:${esc(couleurProjet[e.projetId] || 'var(--brand-500)')}">
                    <i class="fa-solid ${icones[e.type] || 'fa-circle'}"></i>
                  </div>
                  <div class="grow" style="min-width:0">
                    <div class="text-sm fw-800 truncate">${esc(e.titre)}</div>
                    <div class="text-xs text-muted">
                      ${esc(Dates.format(e.date))}${e.heure ? ' · ' + esc(e.heure) : ''}${e.lieu ? ' · ' + esc(e.lieu) : ''}
                    </div>
                  </div>
                  <button class="badge badge--neutre" data-action="ouvrir-projet" data-id="${esc(e.projetId)}"
                          title="Ouvrir ${esc(e.projetNom)}" style="cursor:pointer;max-width:180px">
                    <i class="fa-solid fa-hospital"></i> <span class="truncate">${esc(e.projetNom)}</span>
                  </button>
                  ${boutonEchange(e)}
                  ${badge(j === 0 ? "Aujourd'hui" : `J-${j}`, j <= 7 ? 'warn' : 'brand')}
                </div>`;
              }).join('')}
            </div>
          </div>`).join('')
          : empty('Aucune échéance à venir', 'Le portefeuille n\'a pas d\'échéance planifiée.', 'fa-solid fa-calendar-check')}
      </div>
    </section>`;
  },

  /* ====================== COMPTES RENDUS ====================== */
  'comptes-rendus'() {
    const expert = Store.estExpert();
    const liste = Store.liste('comptesRendus');
    const projet = Store.projet();

    // Échanges déjà passés qui n'ont pas encore de compte rendu.
    const aujourdhui = Dates.today();
    const aConsigner = Store.liste('evenements')
      .filter((e) => estUnEchange(e.type)
        && e.date <= aujourdhui
        && !liste.some((cr) => cr.objet === e.titre))
      .sort((a, b) => b.date.localeCompare(a.date));

    return `
    <section class="view stack">
      ${expert && aConsigner.length ? `
      <div class="card" style="border-color:color-mix(in srgb, var(--warn-500) 40%, transparent)">
        <div class="card__head">
          <div>
            <h3 class="card__title"><i class="fa-solid fa-pen-to-square"></i> Échanges à consigner</h3>
            <p class="card__subtitle">
              Ces échanges ont eu lieu et n'ont pas encore de compte rendu.
              Le client les retrouvera dans son espace une fois rédigés.
            </p>
          </div>
          <span class="badge badge--warn">${aConsigner.length} en attente</span>
        </div>
        <div class="stack-xs">
          ${aConsigner.map((e) => {
            const canal = CANAUX[e.canal] || CANAUX.visio;
            return `<div class="file-row">
                <div class="file-icon" style="color:var(--warn-500)"><i class="${esc(canal.icone)}"></i></div>
                <div class="grow" style="min-width:0">
                  <div class="text-sm fw-800 truncate">${esc(e.titre)}</div>
                  <div class="text-xs text-muted">${esc(canal.label)} · ${esc(Dates.formatLong(e.date))}${e.heure ? ' · ' + esc(e.heure) : ''}</div>
                </div>
                <button class="btn btn--primary btn--sm" data-action="cr-depuis-evenement" data-id="${esc(e.id)}">
                  <i class="fa-solid fa-pen"></i> Rédiger
                </button>
              </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-clipboard-check"></i> Comptes rendus & relevés de décisions</h2>
            <p class="card__subtitle">
              ${expert
                ? 'Les échanges se programment dans le planning ; ils se consignent ici.'
                : 'Le relevé de chaque échange avec votre référent ElodiaTech.'}
            </p>
          </div>
          <div class="row-tight">
            <span class="badge badge--neutre">${liste.length} compte${liste.length > 1 ? 's' : ''} rendu${liste.length > 1 ? 's' : ''}</span>
            ${expert ? `
              <button class="btn btn--sm" data-action="ajouter-cr">
                <i class="fa-solid fa-plus"></i> Compte rendu libre
              </button>
              <button class="btn btn--sm" data-action="aller" data-route="planning">
                <i class="fa-solid fa-calendar-days"></i> Programmer un échange
              </button>` : ''}
          </div>
        </div>

        ${liste.length ? `
          <div class="stack-sm">
            ${liste.map((cr) => {
              const t = TYPES_ECHANGE[cr.type] || TYPES_ECHANGE.visio;
              const meet = urlSure(cr.lienMeet);
              const doc = urlSure(cr.lienDoc);
              return `
              <article class="card card--flat">
                <div class="spread" style="margin-bottom:8px">
                  <div class="row-tight">
                    ${badge(t.label, t.couleur, t.icone)}
                    <span class="text-xs text-muted">${esc(Dates.formatLong(cr.date))}</span>
                  </div>
                  <div class="row-tight">
                    ${doc ? `<a class="btn btn--sm" href="${esc(doc)}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-google-drive"></i> Google Doc</a>` : ''}
                    ${meet ? `<a class="btn btn--sm" href="${esc(meet)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-video"></i> Lien Meet</a>` : ''}
                    ${expert ? `
                      <button class="btn btn--ghost btn--sm" data-action="modifier-cr" data-id="${esc(cr.id)}" title="Modifier"><i class="fa-solid fa-pen"></i></button>
                      <button class="btn btn--ghost btn--sm" data-action="supprimer-cr" data-id="${esc(cr.id)}" title="Supprimer"><i class="fa-solid fa-trash"></i></button>` : ''}
                  </div>
                </div>
                <h4>${esc(cr.objet)}</h4>
                ${cr.participants ? `<p class="text-xs text-muted" style="margin-top:3px"><i class="fa-solid fa-users"></i> ${esc(cr.participants)}</p>` : ''}
                ${cr.decisions
                  ? `<p class="text-sm text-soft" style="margin-top:10px">${esc(cr.decisions)}</p>`
                  : `<p class="text-sm text-muted" style="margin-top:10px"><em>Décisions non encore saisies${doc ? ' — voir le Google Doc' : ''}.</em></p>`}
              </article>`;
            }).join('')}
          </div>`
          : empty('Aucun compte rendu',
                  expert ? 'Collez un lien Meet ci-dessus, ou créez un compte rendu manuel.' : 'Les relevés de décisions apparaîtront ici.',
                  'fa-solid fa-clipboard')}
      </div>
    </section>`;
  },

  /* ====================== FAQ ====================== */
  faq(filtres = {}) {
    const q = (filtres.q || '').toLowerCase();
    const liste = q ? FAQ.filter((f) => f.q.toLowerCase().includes(q) || f.r.toLowerCase().includes(q)) : FAQ;

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-circle-question"></i> FAQ réglementaire</h2>
            <p class="card__subtitle">Les réponses aux questions les plus fréquentes sur les MSP, les centres de santé et leurs financements.</p>
          </div>
        </div>

        <div style="max-width:420px;margin-bottom:var(--sp-4)">
          <input type="search" id="faq-q" placeholder="Rechercher une question (ACI, SISA, FEDER…)" value="${esc(filtres.q || '')}" aria-label="Rechercher dans la FAQ">
        </div>

        ${liste.length ? liste.map((f, i) => `
          <div class="accordion" data-accordion>
            <button class="accordion__head" data-action="toggle-accordion" aria-expanded="false">
              <span><span class="badge badge--neutre" style="margin-right:8px">${esc(f.cat)}</span>${esc(f.q)}</span>
              <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="accordion__body">${esc(f.r)}</div>
          </div>`).join('') : empty('Aucun résultat', 'Aucune question ne correspond à votre recherche.', 'fa-solid fa-magnifying-glass')}
      </div>
    </section>`;
  },

  /* ====================== CONSOLE : PORTEFEUILLE ====================== */
  'admin-projets'() {
    const projets = Store.state.projets;

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-diagram-project"></i> Portefeuille clients</h2>
            <p class="card__subtitle">Vue consolidée de tous les accompagnements en cours.</p>
          </div>
          <div class="row-tight">
            <button class="btn btn--sm" data-action="creer-dossiers-drive">
              <i class="fa-brands fa-google-drive"></i> Créer les dossiers Drive
            </button>
            <button class="btn btn--sm" data-action="aller" data-route="planning"><i class="fa-solid fa-calendar-days"></i> Planning général</button>
            <button class="btn btn--primary btn--sm" data-action="fiche-client"><i class="fa-solid fa-plus"></i> Nouveau client</button>
          </div>
        </div>

        <div class="grid grid-4" style="margin-bottom:var(--sp-5)">
          <div class="card card--flat"><div class="kpi">
            <span class="kpi__label">Projets accompagnés</span>
            <span class="kpi__value">${projets.length}</span>
          </div></div>
          <div class="card card--flat"><div class="kpi">
            <span class="kpi__label">Chiffre d'affaires engagé</span>
            <span class="kpi__value">${esc(euros(projets.reduce((s, p) => s + FORMULES[p.formule].prixHT, 0)))}</span>
            <span class="kpi__hint text-muted">Base tarifaire HT des formules</span>
          </div></div>
          <div class="card card--flat"><div class="kpi">
            <span class="kpi__label">Avancement moyen</span>
            <span class="kpi__value">${Math.round(projets.reduce((s, p) => s + Store.avancement(p.id), 0) / projets.length)} %</span>
          </div></div>
          <div class="card card--flat"><div class="kpi">
            <span class="kpi__label">Actions client en attente</span>
            <span class="kpi__value text-warn">${projets.reduce((s, p) => s + Store.actionsClient(p.id).length, 0)}</span>
          </div></div>
        </div>

        <h3 class="section-title"><i class="fa-solid fa-address-card"></i> Clients accompagnés</h3>
        <p class="text-xs text-muted" style="margin:-6px 0 14px">
          Cliquez sur une étiquette pour ouvrir la vue d'ensemble du projet et le piloter.
        </p>

        <div class="grid grid-3">
          ${projets.map((p) => {
            const f = FORMULES[p.formule];
            const pct = Store.avancement(p.id);
            const attente = Store.actionsClient(p.id).length + Store.signaturesEnAttente(p.id).length;
            const retard = Store.enRetard(p.id).length;
            const actif = p.id === Store.state.projetActifId;

            return `
            <article class="etiquette ${actif ? 'is-active' : ''}" style="--teinte:${esc(f.couleur)}">
              <button class="etiquette__zone" data-action="ouvrir-projet" data-id="${esc(p.id)}"
                      aria-label="Ouvrir le projet ${esc(p.nom)}">
                <span class="etiquette__entete">
                  <span class="etiquette__pastille"><i class="fa-solid fa-${p.type === 'MSP' ? 'house-medical' : 'hospital'}"></i></span>
                  <span class="grow" style="min-width:0">
                    <span class="etiquette__nom">${esc(p.nom)}</span>
                    <span class="etiquette__lieu">${esc(p.ville)} · ${esc(p.departement)}</span>
                  </span>
                  ${actif ? badge('En cours', 'brand') : ''}
                </span>

                <span class="etiquette__client">
                  <i class="fa-solid fa-user"></i> ${esc(p.client?.nom || 'Porteur non renseigné')}
                  ${p.client?.fonction ? `<span class="text-muted"> · ${esc(p.client.fonction)}</span>` : ''}
                </span>

                <span class="etiquette__offre">
                  <span class="badge badge--accent"><i class="fa-solid fa-tag"></i> ${esc(f.code)} — ${esc(f.nom)}</span>
                  ${attente ? badge(`${attente} en attente`, 'warn', 'fa-solid fa-hourglass-half') : ''}
                  ${retard ? badge(`${retard} en retard`, 'danger', 'fa-solid fa-triangle-exclamation') : ''}
                </span>

                <span class="etiquette__avancement">
                  <span class="row-tight" style="justify-content:space-between;margin-bottom:4px">
                    <span class="text-xs text-muted">${Store.prestations(p.id).filter((x) => x.etat.statut === 'valide').length} / ${Store.prestations(p.id).length} prestations</span>
                    <span class="text-xs fw-800">${pct} %</span>
                  </span>
                  ${progressBar(pct, 'sm')}
                </span>
              </button>

              <div class="etiquette__pied">
                ${!urlSure(p.driveUrl) || String(p.driveUrl).includes('EXEMPLE')
                  ? `<button class="btn btn--ghost btn--sm" data-action="creer-dossiers-drive" data-id="${esc(p.id)}"
                             title="Créer le dossier Drive de ce client">
                       <i class="fa-brands fa-google-drive"></i> Drive
                     </button>`
                  : `<a class="btn btn--ghost btn--sm" href="${esc(urlSure(p.driveUrl))}" target="_blank" rel="noopener noreferrer"
                        title="Ouvrir le dossier Drive">
                       <i class="fa-brands fa-google-drive"></i> Drive
                     </a>`}
                <div class="offre-pills" role="group" aria-label="Formule de ${esc(p.nom)}">
                  ${Object.values(FORMULES).map((x) => `
                    <button type="button" class="offre-pill ${x.code === p.formule ? 'is-active' : ''}"
                            style="--teinte:${esc(x.couleur)}"
                            data-action="appliquer-formule" data-formule="${esc(x.code)}" data-projet="${esc(p.id)}"
                            aria-pressed="${x.code === p.formule}"
                            title="${esc(x.nom)} — ${esc(x.prixLabel)}">${esc(x.code)}</button>`).join('')}
                </div>
                <div class="row-tight">
                  <button class="btn btn--ghost btn--sm" data-action="lien-client" data-id="${esc(p.id)}"
                          title="Copier le lien d'accès de ce client">
                    <i class="fa-solid fa-link"></i> Lien
                  </button>
                  <button class="btn btn--ghost btn--sm" data-action="fiche-client" data-id="${esc(p.id)}" title="Modifier la fiche client">
                    <i class="fa-solid fa-address-card"></i> Fiche
                  </button>
                  ${projets.length > 1
                    ? `<button class="btn btn--ghost btn--sm" data-action="supprimer-projet" data-id="${esc(p.id)}" aria-label="Supprimer ${esc(p.nom)}"><i class="fa-solid fa-trash"></i></button>`
                    : ''}
                </div>
              </div>
            </article>`;
          }).join('')}
        </div>
      </div>
    </section>`;
  },

  /* ====================== CONSOLE : OFFRES ====================== */
  'admin-offres'() {
    const projet = Store.projet();

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-tags"></i> Offres & périmètres d'intervention</h2>
            <p class="card__subtitle">
              La formule souscrite détermine les lots activés, les prestations à conduire et les modules visibles par le client.
              Modifier la formule d'un projet met immédiatement à jour son espace.
            </p>
          </div>
        </div>

        <div class="card card--flat" style="margin-bottom:var(--sp-5)">
          <div class="spread">
            <div>
              <div class="text-xs text-muted fw-800" style="text-transform:uppercase;letter-spacing:.08em">Projet en cours de pilotage</div>
              <h3>${esc(projet.nom)} — ${esc(projet.ville)}</h3>
              <div class="text-xs text-muted">Formule appliquée : <strong>${esc(projet.formule)} — ${esc(FORMULES[projet.formule].nom)}</strong></div>
            </div>
            <div class="field">
              <label class="field__label" for="opt-immo">Module immobilier</label>
              <select id="opt-immo" data-action="option-immobilier">
                <option value="1" ${projet.options?.immobilier ? 'selected' : ''}>Activé</option>
                <option value="0" ${!projet.options?.immobilier ? 'selected' : ''}>Désactivé</option>
              </select>
            </div>
          </div>
        </div>

        <div class="grid grid-3">
          ${Object.values(FORMULES).map((f) => {
            const actives = PRESTATIONS.filter((p) => f.lots.includes(p.lot));
            const inactives = PRESTATIONS.filter((p) => !f.lots.includes(p.lot));
            const estActive = f.code === projet.formule;
            return `
            <div class="offre ${estActive ? 'offre--active' : ''} ${f.recommandee ? 'offre--reco' : ''}">
              ${f.recommandee ? '<span class="offre__flag">★ Recommandée</span>' : ''}
              <div>
                <div class="offre__code">Formule ${esc(f.code)}</div>
                <div class="offre__name">${esc(f.nom)}</div>
              </div>
              <div class="offre__price">${esc(euros(f.prixHT))}<small>${esc(f.prixLabel)}</small></div>
              <p class="offre__pitch">${esc(f.pitch)}</p>
              <div class="row-tight">
                ${badge(`${f.lots.length} lots`, 'brand', 'fa-solid fa-layer-group')}
                ${badge(`${actives.length} prestations`, 'neutre', 'fa-solid fa-list-check')}
                ${badge(`${f.dureeMois} mois`, 'neutre', 'fa-solid fa-clock')}
              </div>
              <ul class="offre__list">
                ${f.lots.map((idLot) => `<li><i class="fa-solid fa-circle-check"></i> <span><strong>${esc(LOTS[idLot].nom)}</strong> — ${PRESTATIONS.filter((p) => p.lot === idLot).length} prestations</span></li>`).join('')}
              </ul>
              ${inactives.length ? `
                <ul class="offre__list offre__list--off">
                  ${[...new Set(inactives.map((p) => p.lot))].map((idLot) => `<li><i class="fa-solid fa-circle-minus"></i> <span>${esc(LOTS[idLot].nom)}</span></li>`).join('')}
                </ul>` : ''}
              <div class="mt-auto" style="padding-top:var(--sp-3)">
                ${estActive
                  ? `<button class="btn btn--block" disabled><i class="fa-solid fa-check"></i> Formule appliquée</button>`
                  : `<button class="btn btn--primary btn--block" data-action="appliquer-formule" data-formule="${esc(f.code)}">Appliquer à ce projet</button>`}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card__head">
          <div>
            <h3 class="card__title"><i class="fa-solid fa-table-list"></i> Détail du catalogue de prestations</h3>
            <p class="card__subtitle">Correspondance entre les prestations et les formules qui les incluent.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>#</th><th>Prestation</th><th>Lot</th><th>Livrable</th><th>F1</th><th>F2</th><th>F3</th></tr></thead>
            <tbody>
              ${PRESTATIONS.map((p, i) => `
                <tr>
                  <td class="mono">${String(i + 1).padStart(2, '0')}</td>
                  <td class="table__strong">${esc(p.titre)}</td>
                  <td class="table__muted">${esc(LOTS[p.lot].nom)}</td>
                  <td class="table__muted">${esc(p.livrable)}</td>
                  ${['F1', 'F2', 'F3'].map((code) => `
                    <td class="text-center">${FORMULES[code].lots.includes(p.lot)
                      ? '<i class="fa-solid fa-circle-check text-ok"></i>'
                      : '<i class="fa-solid fa-minus text-muted"></i>'}</td>`).join('')}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </section>`;
  },

  /* ====================== CONSOLE : ÉQUIPE ====================== */
  'admin-experts'() {
    const experts = Store.state.experts || [];
    const projets = Store.state.projets;

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-user-tie"></i> Équipe ElodiaTech</h2>
            <p class="card__subtitle">
              Les personnes qui accompagnent vos clients. Le référent d'un projet se choisit
              dans cette liste, depuis la fiche client.
            </p>
          </div>
          <button class="btn btn--primary btn--sm" data-action="fiche-expert">
            <i class="fa-solid fa-plus"></i> Ajouter un expert
          </button>
        </div>

        <div class="grid grid-2">
          ${experts.map((e) => {
            const suivis = projets.filter((p) => p.consultant?.nom === e.nom);
            return `
            <article class="card card--flat" style="border-left:3px solid ${e.principal === 'OUI' ? 'var(--accent-500)' : 'var(--border-strong)'}">
              <div class="row" style="align-items:flex-start">
                <span class="avatar avatar--lg avatar--admin">${esc(initiales(e.nom))}</span>
                <div class="grow" style="min-width:0">
                  <div class="row-tight" style="margin-bottom:2px">
                    <strong class="text-sm">${esc(e.nom)}</strong>
                    ${e.principal === 'OUI' ? badge('Administrateur', 'accent', 'fa-solid fa-star') : ''}
                  </div>
                  <div class="text-xs text-muted">${esc(e.fonction || 'Consultant ElodiaTech')}</div>
                  <div class="text-xs text-muted" style="margin-top:6px">
                    ${e.email ? `<i class="fa-solid fa-envelope"></i> ${esc(e.email)}` : ''}
                    ${e.tel ? ` · <i class="fa-solid fa-phone"></i> ${esc(e.tel)}` : ''}
                  </div>
                  <div class="text-xs" style="margin-top:8px">
                    ${suivis.length
                      ? badge(`${suivis.length} client${suivis.length > 1 ? 's' : ''} suivi${suivis.length > 1 ? 's' : ''}`, 'brand', 'fa-solid fa-address-card')
                      : badge('Aucun client rattaché', 'neutre')}
                  </div>
                </div>
              </div>
              <div class="row-tight" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
                <button class="btn btn--ghost btn--sm" data-action="fiche-expert" data-id="${esc(e.id)}">
                  <i class="fa-solid fa-pen"></i> Modifier
                </button>
                ${experts.length > 1 && !suivis.length
                  ? `<button class="btn btn--ghost btn--sm" data-action="supprimer-expert" data-id="${esc(e.id)}">
                       <i class="fa-solid fa-trash"></i> Supprimer
                     </button>`
                  : `<span class="text-xs text-muted">
                       ${experts.length <= 1 ? 'Dernier expert : non supprimable' : 'Des clients lui sont rattachés'}
                     </span>`}
              </div>
            </article>`;
          }).join('')}
        </div>

        <div class="card card--flat" style="margin-top:var(--sp-4);border-left:3px solid var(--info-500)">
          <p class="text-sm text-soft">
            <i class="fa-solid fa-circle-info text-brand"></i>
            Ajouter un expert lui permet d'être désigné référent d'un projet et d'apparaître
            comme interlocuteur dans l'espace du client.
          </p>
          <p class="text-sm text-muted" style="margin-top:8px">
            En revanche, <strong>le code d'accès reste unique</strong> : il est défini dans le script
            Google et partagé par toute l'équipe. Un code par personne demanderait un vrai serveur
            d'authentification.
          </p>
        </div>
      </div>
    </section>`;
  },

  /* ====================== CONSOLE : PARAMÈTRES ====================== */
  'admin-params'() {
    const r = Store.state.reglages;

    return `
    <section class="view stack">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title"><i class="fa-solid fa-sliders"></i> Paramètres & source de données</h2>
            <p class="card__subtitle">Configuration de la connexion Google Sheets et gestion des données locales.</p>
          </div>
          ${badge(r.source === 'sheets' ? 'Connecté à Google Sheets' : 'Jeu de démonstration local',
                  r.source === 'sheets' ? 'ok' : 'neutre',
                  r.source === 'sheets' ? 'fa-solid fa-plug-circle-check' : 'fa-solid fa-database')}
        </div>

        <div class="grid grid-sidebar">
          <div class="card card--flat">
            <h3 class="section-title"><i class="fa-brands fa-google"></i> Connexion Google Sheets</h3>
            <p class="text-sm text-muted" style="margin-bottom:12px">
              Renseignez l'URL de l'application web générée par le script Apps Script associé à votre feuille de calcul.
              La procédure complète figure dans <span class="mono">docs/connexion-google-sheets.md</span>.
            </p>
            <div class="field">
              <label class="field__label" for="sheets-url">URL de l'application web (/exec)</label>
              <input type="url" id="sheets-url" class="input input--mono" value="${esc(r.webAppUrl || '')}"
                     placeholder="https://script.google.com/macros/s/…/exec" ${WEB_APP_URL ? 'readonly' : ''}>
              <span class="field__hint">L'URL doit se terminer par <span class="mono">/exec</span> et le déploiement être accessible.</span>
            </div>

            ${WEB_APP_URL ? `
              <div class="card card--flat" style="margin-top:12px;border-left:3px solid var(--ok-500)">
                <p class="text-sm text-soft">
                  <i class="fa-solid fa-circle-check text-ok"></i>
                  Cette adresse est inscrite dans le code de l'application
                  (<span class="mono">WEB_APP_URL</span> dans <span class="mono">assets/js/config.js</span>).
                  Elle vaut pour tous les navigateurs : vos clients accèdent à leur dossier
                  sans aucun réglage de leur côté.
                </p>
              </div>`
            : `
              <div class="card card--flat" style="margin-top:12px;border-left:3px solid var(--warn-500)">
                <p class="text-sm text-soft">
                  <i class="fa-solid fa-triangle-exclamation text-warn"></i>
                  <strong>Cette adresse n'est enregistrée que dans ce navigateur.</strong>
                  Vos clients, eux, ne la connaissent pas : leurs liens transportent donc
                  l'adresse, ce qui les allonge et les rend fragiles.
                </p>
                <p class="text-sm text-muted" style="margin-top:8px">
                  Pour y remédier une fois pour toutes, reportez-la dans
                  <span class="mono">assets/js/config.js</span>, à la constante
                  <span class="mono">WEB_APP_URL</span>.
                </p>
              </div>`}
            <div class="row-tight" style="margin-top:12px">
              <button class="btn btn--primary" data-action="enregistrer-sheets"><i class="fa-solid fa-floppy-disk"></i> Enregistrer</button>
              <button class="btn" data-action="synchroniser" ${r.webAppUrl ? '' : 'disabled'}><i class="fa-solid fa-rotate"></i> Synchroniser maintenant</button>
            </div>
            ${r.derniereSync ? `<p class="text-xs text-muted" style="margin-top:10px">Dernière synchronisation : ${esc(new Date(r.derniereSync).toLocaleString('fr-FR'))}</p>` : ''}
          </div>

          <div class="card card--flat">
            <h3 class="section-title"><i class="fa-solid fa-database"></i> Données locales</h3>
            <p class="text-sm text-muted" style="margin-bottom:12px">
              Tant qu'aucune source externe n'est connectée, vos modifications sont conservées dans le navigateur.
              Elles restent disponibles d'une session à l'autre sur ce poste.
            </p>
            <div class="stack-xs">
              <button class="btn btn--block" data-action="exporter-json"><i class="fa-solid fa-file-export"></i> Exporter les données (JSON)</button>
              <button class="btn btn--block btn--danger" data-action="reinitialiser"><i class="fa-solid fa-arrow-rotate-left"></i> Réinitialiser le jeu de démonstration</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__head">
          <h3 class="card__title"><i class="fa-solid fa-circle-info"></i> À propos</h3>
        </div>
        <div class="grid grid-3 text-sm">
          <div><span class="text-muted">Application</span><br><strong>${esc(APP.produit)}</strong></div>
          <div><span class="text-muted">Version</span><br><strong class="mono">${esc(APP.version)}</strong></div>
          <div><span class="text-muted">Prestations au catalogue</span><br><strong>${PRESTATIONS.length}</strong></div>
        </div>
      </div>
    </section>`;
  },
};
