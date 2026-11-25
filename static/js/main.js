/* ==========================================================================
   OS-Omni — page behaviour
   Starfield, nav, reveal-on-scroll, copy-to-clipboard, and chart wiring.
   ========================================================================== */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------- 0. theme
     The initial value is set by the inline boot script in <head> so the page
     never flashes the wrong theme. This only handles the toggle afterwards. */
  function theme() {
    var btn = document.getElementById("themeToggle");
    var root = document.documentElement;

    function label() {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      if (btn) btn.setAttribute("aria-label", "Switch to " + next + " theme");
    }
    label();

    if (!btn) return;
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("osomni-theme", next); } catch (e) { /* private mode */ }
      label();
      window.dispatchEvent(new CustomEvent("osomni:theme", { detail: next }));
    });
  }

  /* ---------------------------------------------------------- 1. starfield
     A slow drift of small stars with a few gold ones, echoing the cover.
     Paused when the tab is hidden and skipped entirely under reduced motion. */
  function starfield() {
    var cv = document.getElementById("starfield");
    if (!cv) return;
    var ctx = cv.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var stars = [], w = 0, h = 0, raf = null, t = 0;

    function build() {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(240, (w * h) / 7000));
      stars = [];
      for (var i = 0; i < n; i++) {
        var gold = Math.random() < 0.22;
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * (gold ? 1.5 : 1.1) + 0.25,
          a: Math.random() * 0.55 + 0.12,
          tw: Math.random() * 0.9 + 0.25,
          ph: Math.random() * Math.PI * 2,
          vy: (Math.random() * 0.05 + 0.012),
          gold: gold
        });
      }
    }

    function frame() {
      t += 0.0125;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.y -= s.vy;
        if (s.y < -2) { s.y = h + 2; s.x = Math.random() * w; }
        var a = s.a * (0.62 + 0.38 * Math.sin(t * s.tw + s.ph));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.2832);
        ctx.fillStyle = s.gold
          ? "rgba(238, 198, 116, " + a.toFixed(3) + ")"
          : "rgba(196, 224, 250, " + (a * 0.85).toFixed(3) + ")";
        ctx.fill();
        if (s.gold && s.r > 1.05) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 3.4, 0, 6.2832);
          ctx.fillStyle = "rgba(226, 170, 60, " + (a * 0.07).toFixed(3) + ")";
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(frame);
    }

    function start() { if (!raf) frame(); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    function lightTheme() { return document.documentElement.getAttribute("data-theme") === "light"; }

    build();
    if (reduced) {
      /* one static pass, no animation loop */
      t = 1; ctx.clearRect(0, 0, w, h);
      stars.forEach(function (s) {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832);
        ctx.fillStyle = s.gold ? "rgba(238,198,116,.4)" : "rgba(196,224,250,.32)";
        ctx.fill();
      });
    } else {
      if (!lightTheme()) start();
      document.addEventListener("visibilitychange", function () {
        (document.hidden || lightTheme()) ? stop() : start();
      });
      /* the canvas is hidden in the light theme, so do not burn frames on it */
      window.addEventListener("osomni:theme", function () {
        lightTheme() ? stop() : start();
      });
    }
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { build(); }, 180);
    });
  }

  /* ---------------------------------------------------------------- 2. nav */
  function nav() {
    var el = document.getElementById("nav");
    var toggle = document.getElementById("navToggle");
    var links = document.getElementById("navLinks");
    if (!el) return;
    var more = document.getElementById("navMore");
    var moreBtn = more && more.querySelector("button");
    var compact = window.matchMedia("(max-width: 1040px)");

    function onScroll() { el.classList.toggle("stuck", window.scrollY > 40); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    function setResearchOpen(open) {
      if (!more || !moreBtn) return;
      more.setAttribute("data-open", String(open));
      moreBtn.setAttribute("aria-expanded", String(open));
    }

    function setMenuOpen(open) {
      if (!open) setResearchOpen(false);
      if (!toggle || !links) return;
      links.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    }

    if (toggle && links) {
      toggle.addEventListener("click", function (e) {
        var open = !links.classList.contains("open");
        setMenuOpen(open);
        if (open && e.detail === 0) links.querySelector("button, a[href]").focus();
      });
      links.addEventListener("click", function (e) {
        if (e.target.closest("a")) {
          if (more && more.contains(e.target)) {
            (compact.matches ? toggle : moreBtn).focus();
          }
          setMenuOpen(false);
        }
      });
    }
    if (moreBtn) {
      moreBtn.addEventListener("click", function () {
        setResearchOpen(more.getAttribute("data-open") !== "true");
      });
    }

    function dismissOutside(e) {
      if (more && !more.contains(e.target)) setResearchOpen(false);
      if (!el.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("click", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (more && more.getAttribute("data-open") === "true") {
        setResearchOpen(false);
        moreBtn.focus();
        e.preventDefault();
      } else if (links && links.classList.contains("open")) {
        setMenuOpen(false);
        toggle.focus();
        e.preventDefault();
      }
    });

    function onLayoutChange() {
      var active = document.activeElement;
      setMenuOpen(false);
      if (compact.matches && links && links.contains(active)) toggle.focus();
      else if (!compact.matches && active === toggle) el.querySelector(".nav-brand").focus();
      else if (!compact.matches && more && more.contains(active)) moreBtn.focus();
    }
    if (compact.addEventListener) compact.addEventListener("change", onLayoutChange);
    else compact.addListener(onLayoutChange);

    /* highlight the section in view */
    var ids = ["abstract", "playground-section", "benchmark", "leaderboard", "resources"];
    var map = {};
    ids.forEach(function (id) {
      var a = document.querySelector('.nav-links a[href="#' + id + '"]');
      var s = document.getElementById(id);
      if (a && s) map[id] = { a: a, s: s };
    });
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var m = map[en.target.id];
        if (m && en.isIntersecting) {
          Object.keys(map).forEach(function (k) {
            map[k].a.classList.remove("active");
            map[k].a.removeAttribute("aria-current");
          });
          m.a.classList.add("active");
          m.a.setAttribute("aria-current", "location");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(map).forEach(function (k) { io.observe(map[k].s); });
  }

  /* ------------------------------------------------------------ 3. reveal */
  function reveal() {
    var items = document.querySelectorAll(".rise");
    if (!("IntersectionObserver" in window) || reduced) {
      Array.prototype.forEach.call(items, function (n) { n.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    Array.prototype.forEach.call(items, function (n) { io.observe(n); });
  }

  /* -------------------------------------------------------------- 4. copy */
  function copyBib() {
    var btn = document.getElementById("copyBib");
    var pre = document.getElementById("bibtex");
    if (!btn || !pre) return;
    btn.addEventListener("click", function () {
      var text = pre.textContent;
      var done = function () {
        btn.classList.add("done");
        btn.querySelector("span").textContent = "Copied";
        setTimeout(function () {
          btn.classList.remove("done");
          btn.querySelector("span").textContent = "Copy";
        }, 1800);
      };
      var legacy = function () {
        var ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); done(); } catch (e) { /* noop */ }
        document.body.removeChild(ta);
      };
      if (navigator.clipboard && window.isSecureContext) {
        /* the async API rejects without transient user activation or when the
           permission is denied — fall back rather than fail silently */
        navigator.clipboard.writeText(text).then(done, legacy);
      } else {
        legacy();
      }
    });
  }

  function charts() {
    if (window.OSOmniPaperResults) window.OSOmniPaperResults.render();
  }

  /* --------------------------------------------------------------- 8. init */
  function init() {
    theme();
    starfield();
    nav();
    reveal();
    copyBib();
    charts();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
