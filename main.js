/* ===============================
   script.js — FEJEB ONG (Global)
   Menu mobile + année + KPI count-up
   =============================== */
(function () {
  // Year
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Drawer (menu mobile) — accessible & unique FEJEB
  const body = document.body;
  const menuBtn = document.getElementById("menuBtn");
  const overlay = document.getElementById("overlay");
  const drawer = document.getElementById("drawer");
  const closeBtn = document.getElementById("closeBtn");

  function openDrawer(){
    if (!menuBtn || !overlay || !drawer) return;
    body.classList.add("is-open");
    menuBtn.setAttribute("aria-expanded", "true");
    overlay.setAttribute("aria-hidden", "false");
    // focus first nav link
    const firstLink = drawer.querySelector("a");
    if (firstLink) firstLink.focus();
  }

  function closeDrawer(){
    if (!menuBtn || !overlay || !drawer) return;
    body.classList.remove("is-open");
    menuBtn.setAttribute("aria-expanded", "false");
    overlay.setAttribute("aria-hidden", "true");
    menuBtn.focus();
  }

  if (menuBtn) menuBtn.addEventListener("click", openDrawer);
  if (overlay) overlay.addEventListener("click", closeDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && body.classList.contains("is-open")) closeDrawer();
  });

  // KPI count-up (léger, dosé)
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const counters = Array.from(document.querySelectorAll("[data-count]"));

  function animateCounter(el){
    const target = Number(el.getAttribute("data-count")) || 0;
    const duration = 900; // ms
    const startTime = performance.now();

    function tick(now){
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const value = Math.round(eased * target);
      el.textContent = value.toLocaleString("fr-FR");
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (!prefersReduced && counters.length){
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          animateCounter(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.35 });

    counters.forEach(c => io.observe(c));
  } else {
    counters.forEach(c => {
      const target = Number(c.getAttribute("data-count")) || 0;
      c.textContent = target.toLocaleString("fr-FR");
    });
  }
})();
/* ===============================
   script.js — FEJEB ONG (Global)
   - Header drawer mobile (menu)
   - Année footer
   - KPI count-up (si présent)
   - ÉQUIPE : Google Sheet CSV -> grille + filtre + recherche + modal profil
   =============================== */

(() => {
  "use strict";

  // ===============================
  // Helpers
  // ===============================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function safeText(v) {
    return (v ?? "").toString().trim();
  }

  function clampStr(s, max = 140) {
    const t = safeText(s);
    if (!t) return "";
    return t.length > max ? t.slice(0, max - 1).trim() + "…" : t;
  }

  function initialsFromName(name) {
    const parts = safeText(name).split(/\s+/).filter(Boolean);
    if (!parts.length) return "FE";
    const a = parts[0][0] || "";
    const b = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] || "");
    return (a + b).toUpperCase();
  }

  function normalizeHeader(h) {
    return safeText(h)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // accents
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, "_");
  }

  function uniq(arr) {
    return Array.from(new Set(arr.filter(Boolean)));
  }

  function toTelHref(phone) {
    const p = safeText(phone).replace(/[^\d+]/g, "");
    return p ? `tel:${p}` : "";
  }

  function toMailHref(email) {
    const e = safeText(email);
    return e ? `mailto:${e}` : "";
  }

  function toWaHref(phone, text) {
    const p = safeText(phone).replace(/[^\d]/g, "");
    if (!p) return "";
    const msg = encodeURIComponent(text || "Bonjour, je vous contacte via FEJEB ONG.");
    return `https://wa.me/${p}?text=${msg}`;
  }

  function safeUrl(u) {
    const url = safeText(u);
    if (!url) return "";
    // ajoute https:// si l'utilisateur met juste "facebook.com/.."
    if (/^https?:\/\//i.test(url)) return url;
    if (/^[a-z0-9.-]+\.[a-z]{2,}\/?/i.test(url)) return `https://${url}`;
    return url;
  }

  // CSV parser (supporte guillemets, virgules dans champs)
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (ch === "," && !inQuotes) {
        row.push(cur);
        cur = "";
        continue;
      }

      if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cur);
        cur = "";
        // évite ligne vide
        if (row.some(cell => safeText(cell) !== "")) rows.push(row);
        row = [];
        continue;
      }

      cur += ch;
    }

    // last
    row.push(cur);
    if (row.some(cell => safeText(cell) !== "")) rows.push(row);

    return rows;
  }

  function mapCSVToObjects(csvText) {
    const rows = parseCSV(csvText);
    if (!rows.length) return [];
    const headers = rows[0].map(h => normalizeHeader(h));
    const data = rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, idx) => (obj[h] = safeText(r[idx] ?? "")));
      return obj;
    });
    return data;
  }

  function pick(obj, keys) {
    for (const k of keys) {
      if (obj[k] && safeText(obj[k])) return safeText(obj[k]);
    }
    return "";
  }

  function splitTags(v) {
    const t = safeText(v);
    if (!t) return [];
    return t
      .split(/[,;/|]+/)
      .map(s => safeText(s))
      .filter(Boolean)
      .slice(0, 8);
  }

  // ===============================
  // Global: Year
  // ===============================
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ===============================
  // Global: Drawer (menu mobile)
  // ===============================
  const body = document.body;
  const menuBtn = $("#menuBtn");
  const overlay = $("#overlay");
  const drawer = $("#drawer");
  const closeBtn = $("#closeBtn");

  function openDrawer() {
    if (!menuBtn || !overlay || !drawer) return;
    body.classList.add("is-open");
    menuBtn.setAttribute("aria-expanded", "true");
    overlay.setAttribute("aria-hidden", "false");
    const firstLink = drawer.querySelector("a");
    if (firstLink) firstLink.focus();
  }

  function closeDrawer() {
    if (!menuBtn || !overlay || !drawer) return;
    body.classList.remove("is-open");
    menuBtn.setAttribute("aria-expanded", "false");
    overlay.setAttribute("aria-hidden", "true");
    menuBtn.focus();
  }

  if (menuBtn && overlay && drawer && closeBtn) {
    menuBtn.addEventListener("click", openDrawer);
    overlay.addEventListener("click", closeDrawer);
    closeBtn.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && body.classList.contains("is-open")) closeDrawer();
    });
  }

  // ===============================
  // Global: KPI count-up (si présent)
  // ===============================
  const counters = $$("[data-count]");
  function animateCounter(el) {
    const target = Number(el.getAttribute("data-count")) || 0;
    const duration = 900;
    const start = performance.now();

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(eased * target);
      el.textContent = value.toLocaleString("fr-FR");
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (counters.length) {
    if (!prefersReduced) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.35 });
      counters.forEach(c => io.observe(c));
    } else {
      counters.forEach(c => {
        const target = Number(c.getAttribute("data-count")) || 0;
        c.textContent = target.toLocaleString("fr-FR");
      });
    }
  }

  // ===============================
  // ÉQUIPE (page equipe.html)
  // ===============================
  const teamGrid = $("#teamGrid");
  if (!teamGrid) return; // pas la page équipe => stop ici

  // --- Config CSV (ton lien)
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRh4rQ6mAYpcU5UJM2PCY_u9pq6h6cRTdTnQczQzk35nsyVMiM64wtfrtmM0geDgL16-D5hJgULSKeI/pub?gid=0&single=true&output=csv";

  // --- UI refs
  const teamState = $("#teamState");
  const teamSearch = $("#teamSearch");
  const teamRole = $("#teamRole");
  const teamReset = $("#teamReset");
  const teamCount = $("#teamCount");

  // Modal refs
  const modal = $("#teamModal");
  const modalOverlay = $("#teamModalOverlay");
  const modalClose = $("#teamModalClose");
  const modalName = $("#teamModalName");
  const modalRole = $("#teamModalRole");
  const modalAvatar = $("#teamModalAvatar");
  const modalBadges = $("#teamModalBadges");
  const modalBio = $("#teamModalBio");
  const modalInfo = $("#teamModalInfo");
  const modalLinks = $("#teamModalLinks");
  const modalActions = $("#teamModalActions");

  // Data
  let members = [];
  let filtered = [];

  function showState(html) {
    if (!teamState) return;
    teamState.innerHTML = html;
  }

  function clearState() {
    if (!teamState) return;
    teamState.innerHTML = "";
  }

  function setCount(n, total) {
    if (!teamCount) return;
    const t = typeof total === "number" ? total : n;
    teamCount.textContent = `${n} membre${n > 1 ? "s" : ""} affiché${n > 1 ? "s" : ""} / ${t}`;
  }

  function buildMember(raw, idx) {
    // Columns flexibles: tu peux nommer dans le sheet différemment,
    // on tente plusieurs variantes.
    const nom = pick(raw, ["nom", "name", "full_name", "prenom_nom", "prenom", "identite", "membre"]);
    const role = pick(raw, ["role", "poste", "fonction", "responsabilite", "position"]);
    const ville = pick(raw, ["ville", "localite", "commune", "zone", "departement"]);
    const pays = pick(raw, ["pays", "country"]);
    const photo = safeUrl(pick(raw, ["photo", "photo_url", "image", "image_url", "avatar", "profil_photo"]));
    const bio = pick(raw, ["bio", "presentation", "profil", "description", "a_propos", "apropos"]);
    const competences = pick(raw, ["competences", "competence", "skills", "specialites", "domaines"]);
    const programmes = pick(raw, ["programme", "programmes", "axes", "intervention", "interventions"]);
    const email = pick(raw, ["email", "mail"]);
    const telephone = pick(raw, ["telephone", "tel", "phone", "whatsapp", "contact"]);
    const whatsapp = pick(raw, ["whatsapp", "wa", "numero_whatsapp"]);
    const facebook = safeUrl(pick(raw, ["facebook", "fb", "facebook_url"]));
    const instagram = safeUrl(pick(raw, ["instagram", "ig", "instagram_url"]));
    const linkedin = safeUrl(pick(raw, ["linkedin", "linkedin_url"]));
    const site = safeUrl(pick(raw, ["site", "website", "url", "lien"]));

    const tags = uniq([
      role,
      ville,
      pays,
      ...splitTags(competences),
      ...splitTags(programmes),
    ]).slice(0, 10);

    // ID stable (mieux si une colonne id existe)
    const id = pick(raw, ["id", "uuid", "slug"]) || `m${idx + 1}`;

    return {
      id,
      nom: nom || "Membre FEJEB",
      role: role || "Membre",
      ville,
      pays,
      photo,
      bio,
      competences,
      programmes,
      email,
      telephone,
      whatsapp,
      facebook,
      instagram,
      linkedin,
      site,
      tags,
      raw
    };
  }

  function memberMatches(m, q) {
    if (!q) return true;
    const hay = [
      m.nom, m.role, m.ville, m.pays, m.bio, m.competences, m.programmes,
      ...(m.tags || [])
    ].join(" ").toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function renderRoleOptions() {
    if (!teamRole) return;
    const roles = uniq(members.map(m => m.role)).sort((a, b) => a.localeCompare(b, "fr"));
    // reset options keeping first
    teamRole.innerHTML = `<option value="">Tous les rôles</option>` + roles.map(r => {
      const v = r.replace(/"/g, "&quot;");
      return `<option value="${v}">${r}</option>`;
    }).join("");
  }

  function renderGrid(list) {
    if (!teamGrid) return;

    if (!list.length) {
      teamGrid.innerHTML = `<div class="team-empty">Aucun membre ne correspond à votre recherche. Essayez un autre mot-clé ou réinitialisez les filtres.</div>`;
      return;
    }

    teamGrid.innerHTML = list.map(m => {
      const initials = initialsFromName(m.nom);
      const smallBio = clampStr(m.bio, 160) || "Profil en cours de mise à jour. Cliquez sur “Voir le profil” pour afficher les informations disponibles.";
      const badge1 = m.ville ? `<span class="team-badge">${m.ville}</span>` : "";
      const badge2 = m.programmes ? `<span class="team-badge">${splitTags(m.programmes)[0] || "Programme"}</span>` : "";
      const badge3 = m.competences ? `<span class="team-badge">${splitTags(m.competences)[0] || "Compétence"}</span>` : "";

      const avatar = m.photo
        ? `<div class="team-avatar"><img src="${m.photo}" alt="Photo de ${m.nom}" loading="lazy" /></div>`
        : `<div class="team-avatar" aria-hidden="true">${initials}</div>`;

      return `
        <article class="team-card" data-id="${m.id}">
          <div class="team-top">
            ${avatar}
            <div>
              <div class="team-name">${m.nom}</div>
              <div class="team-role">${m.role}</div>
            </div>
          </div>

          <div class="team-badges">
            ${badge1}${badge2}${badge3}
          </div>

          <p class="team-bio">${smallBio}</p>

          <div class="team-card-actions">
            <button class="btn btn-primary team-btn" type="button" data-action="view" data-id="${m.id}">
              Voir le profil
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  function applyFilters() {
    const q = safeText(teamSearch ? teamSearch.value : "");
    const role = safeText(teamRole ? teamRole.value : "");

    filtered = members
      .filter(m => (role ? m.role === role : true))
      .filter(m => memberMatches(m, q));

    setCount(filtered.length, members.length);
    renderGrid(filtered);
  }

  function openModal(member) {
    if (!modal || !modalOverlay) return;

    // Title
    if (modalName) modalName.textContent = member.nom;
    if (modalRole) modalRole.textContent = member.role;

    // Avatar XL
    if (modalAvatar) {
      modalAvatar.innerHTML = "";
      if (member.photo) {
        const img = document.createElement("img");
        img.src = member.photo;
        img.alt = `Photo de ${member.nom}`;
        img.loading = "lazy";
        modalAvatar.appendChild(img);
      } else {
        modalAvatar.textContent = initialsFromName(member.nom);
      }
    }

    // Badges
    if (modalBadges) {
      const badges = uniq([
        member.role,
        member.ville ? `📍 ${member.ville}` : "",
        member.pays ? `🌍 ${member.pays}` : "",
        ...splitTags(member.programmes).map(t => `Programme: ${t}`),
        ...splitTags(member.competences).map(t => t)
      ]).slice(0, 10);

      modalBadges.innerHTML = badges.map(b => `<span class="team-badge">${b}</span>`).join("");
    }

    // Bio
    if (modalBio) {
      modalBio.textContent = safeText(member.bio) || "Présentation non renseignée pour le moment.";
    }

    // Info rows (institutionnel)
    if (modalInfo) {
      const rows = [];
      if (member.ville) rows.push(["Localité", member.ville]);
      if (member.pays) rows.push(["Pays", member.pays]);
      if (member.programmes) rows.push(["Programmes", splitTags(member.programmes).join(" · ")]);
      if (member.competences) rows.push(["Compétences", splitTags(member.competences).join(" · ")]);

      // fallback: affiche au moins rôle
      if (!rows.length) rows.push(["Rôle", member.role]);

      modalInfo.innerHTML = rows.map(([k, v]) => `
        <div class="team-info-row">
          <b>${k}</b>
          <span>${v}</span>
        </div>
      `).join("");
    }

    // Links (réseaux)
    if (modalLinks) {
      const links = [];
      if (member.site) links.push({ label: "Site", href: member.site });
      if (member.facebook) links.push({ label: "Facebook", href: member.facebook });
      if (member.instagram) links.push({ label: "Instagram", href: member.instagram });
      if (member.linkedin) links.push({ label: "LinkedIn", href: member.linkedin });

      modalLinks.innerHTML = links.map(l => `
        <a class="team-link" href="${l.href}" target="_blank" rel="noopener">${l.label}</a>
      `).join("");
    }

    // Actions (contact)
    if (modalActions) {
      const actions = [];
      const phone = member.whatsapp || member.telephone;

      if (phone) actions.push({ cls: "btn btn-primary", label: "WhatsApp", href: toWaHref(phone, `Bonjour ${member.nom}, je vous contacte via FEJEB ONG.`), blank: true });
      if (member.telephone) actions.push({ cls: "btn btn-ghost", label: "Appeler", href: toTelHref(member.telephone), blank: false });
      if (member.email) actions.push({ cls: "btn btn-ghost", label: "E-mail", href: toMailHref(member.email), blank: false });

      if (!actions.length) {
        modalActions.innerHTML = `<div class="team-muted">Contact non affiché (non autorisé / non renseigné).</div>`;
      } else {
        modalActions.innerHTML = actions.map(a => `
          <a class="${a.cls}" href="${a.href}" ${a.blank ? `target="_blank" rel="noopener"` : ""}>${a.label}</a>
        `).join("");
      }
    }

    // Open
    modalOverlay.classList.add("is-open");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    modalOverlay.setAttribute("aria-hidden", "false");

    // Focus close button
    if (modalClose) modalClose.focus();

    // Lock scroll
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (!modal || !modalOverlay) return;

    modalOverlay.classList.remove("is-open");
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    modalOverlay.setAttribute("aria-hidden", "true");

    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  // Close modal events
  if (modalOverlay) modalOverlay.addEventListener("click", closeModal);
  if (modalClose) modalClose.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // Click "Voir le profil"
  teamGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='view']");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const m = members.find(x => x.id === id);
    if (m) openModal(m);
  });

  // Search / Filter
  if (teamSearch) teamSearch.addEventListener("input", applyFilters);
  if (teamRole) teamRole.addEventListener("change", applyFilters);
  if (teamReset) {
    teamReset.addEventListener("click", () => {
      if (teamSearch) teamSearch.value = "";
      if (teamRole) teamRole.value = "";
      applyFilters();
      if (teamSearch) teamSearch.focus();
    });
  }

  async function loadMembers() {
    showState(`
      <div class="team-loading">
        <div class="team-spinner" aria-hidden="true"></div>
        <div>
          <b>Chargement des membres…</b>
          <div class="team-muted">Synchronisation avec la base FEJEB</div>
        </div>
      </div>
    `);

    try {
      const res = await fetch(CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const csv = await res.text();
      const objects = mapCSVToObjects(csv);

      // ignore lignes sans nom (si sheet contient des titres ou séparateurs)
      const built = objects
        .map((o, i) => buildMember(o, i))
        .filter(m => safeText(m.nom) !== "");

      // tri institutionnel (rôle, puis nom)
      built.sort((a, b) => {
        const r = a.role.localeCompare(b.role, "fr");
        if (r !== 0) return r;
        return a.nom.localeCompare(b.nom, "fr");
      });

      members = built;
      clearState();
      renderRoleOptions();
      applyFilters();

      // si aucun membre
      if (!members.length) {
        showState(`<div class="team-empty">Aucun membre trouvé dans la base. Vérifiez la publication du Google Sheet (CSV).</div>`);
        setCount(0, 0);
      }
    } catch (err) {
      showState(`
        <div class="team-empty">
          <b>Impossible de charger l’équipe.</b><br/>
          <span class="team-muted">Vérifiez le lien CSV ou la connexion Internet, puis réessayez.</span>
        </div>
      `);
      setCount(0, 0);
      // eslint-disable-next-line no-console
      console.error("FEJEB Team CSV error:", err);
    }
  }

  // Init
  loadMembers();
})();
