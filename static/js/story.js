(() => {
  const board = document.getElementById("storyBoard");
  if (!board) return;

  const shots = [...board.querySelectorAll(".film-shot")];
  const tabs = [...board.querySelectorAll(".film-tab, .story-tab")];
  const panels = [...board.querySelectorAll(".story-panel")];
  const progress = document.getElementById("storyProgress");
  const title = document.getElementById("filmTitle");
  const text = document.getElementById("filmText");
  const kicker = document.getElementById("filmKicker");
  const total = shots.length || panels.length || tabs.length;
  if (!total) return;

  let step = 0;
  let timer = null;
  const DURATION = 5200;

  function show(next) {
    step = ((next % total) + total) % total;
    tabs.forEach((tab, i) => {
      const on = i === step;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    shots.forEach((shot, i) => shot.classList.toggle("is-active", i === step));
    panels.forEach((panel, i) => panel.classList.toggle("is-active", i === step));
    const active = tabs[step];
    if (active && title) title.textContent = active.dataset.title || title.textContent;
    if (active && text) text.textContent = active.dataset.text || text.textContent;
    if (active && kicker) kicker.textContent = active.dataset.kicker || kicker.textContent;
    if (progress) {
      progress.style.transition = "none";
      progress.style.width = "0%";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          progress.style.transition = `width ${DURATION}ms linear`;
          progress.style.width = "100%";
        });
      });
    }
  }

  function play() {
    clearInterval(timer);
    show(step);
    timer = setInterval(() => show(step + 1), DURATION);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      show(Number(tab.dataset.step) || 0);
      play();
    });
  });

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    show(0);
    return;
  }

  play();
})();
