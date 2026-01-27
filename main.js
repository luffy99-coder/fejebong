/* ===============================
   FEJEB ONG — main.js (GLOBAL)
   Tous les fichiers à la racine
   JS dosé, propre, accessible
   =============================== */

(function () {
  // Year in footer
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Drawer (menu mobile)
  var body = document.body;
  var menuBtn = document.getElementById("menuBtn");
  var overlay = document.getElementById("overlay");
  var drawer = document.getElementById("drawer");
  var closeBtn = document.getElementById("closeBtn");

  function openDrawer(){
    if (!menuBtn || !overlay || !drawer) return;
    body.classList.add("is-open");
    menuBtn.setAttribute("aria-expanded", "true");
    overlay.setAttribute("aria-hidden", "false");
    var firstLink = drawer.querySelector("a");
    if (firstLink) firstLink.focus();
  }

  function closeDrawer(){
    if (!menuBtn || !overlay) return;
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

  // KPI count-up (if present)
  var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var counters = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));

  function animateCounter(el){
    var target = Number(el.getAttribute("data-count")) || 0;
    var duration = 900;
    var startTime = performance.now();

    function tick(now){
      var t = Math.min(1, (now - startTime) / duration);
      var eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      var value = Math.round(eased * target);
      el.textContent = value.toLocaleString("fr-FR");
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (!prefersReduced && counters.length){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting){
          animateCounter(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.35 });

    counters.forEach(function(c){ io.observe(c); });
  } else {
    counters.forEach(function(c){
      var target = Number(c.getAttribute("data-count")) || 0;
      c.textContent = target.toLocaleString("fr-FR");
    });
  }
})();
