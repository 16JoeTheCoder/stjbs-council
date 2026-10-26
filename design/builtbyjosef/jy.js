/* builtbyjosef behaviour: scroll reveal, counter roll, theme toggle. No dependencies.
   In <head>, before this file, add: <script>document.documentElement.classList.add("jy-js")</script> */
(() => {
  const root = document.documentElement;
  root.classList.add("jy-js");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const roll = (el) => {
    const end = parseFloat(el.dataset.jyCount);
    if (Number.isNaN(end)) return;
    const dec = parseInt(el.dataset.jyDecimals || "0", 10);
    const fmt = (v) =>
      new Intl.NumberFormat("en", { minimumFractionDigits: dec, maximumFractionDigits: dec })
        .format(v)
        .replace(/,/g, " ");
    if (reduce) { el.textContent = fmt(end); return; }
    const t0 = performance.now();
    const dur = 640;
    const tick = (now) => {
      const t = Math.min((now - t0) / dur, 1);
      el.textContent = fmt(t === 1 ? end : end * (1 - Math.pow(2, -10 * t)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("is-in");
      if (e.target.dataset.jyCount !== undefined) roll(e.target);
      io.unobserve(e.target);
    }
  }, { threshold: 0.15 });
  document.querySelectorAll("[data-jy-reveal],[data-jy-count]").forEach((el) => io.observe(el));

  const KEY = "jy-theme";
  try { const s = localStorage.getItem(KEY); if (s) root.dataset.theme = s; } catch (_) {}
  document.addEventListener("click", (ev) => {
    if (!ev.target.closest("[data-jy-theme-toggle]")) return;
    const dark = root.dataset.theme
      ? root.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem(KEY, root.dataset.theme); } catch (_) {}
  });
})();
