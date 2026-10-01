(() => {
  const board = document.getElementById("storyBoard");
  if (!board) return;

  const tabs = [...board.querySelectorAll(".story-tab")];
  const panels = [...board.querySelectorAll(".story-panel")];
  const progress = document.getElementById("storyProgress");
  const total = panels.length;
  let step = 0;
  let timer = null;
  const DURATION = 4200;

  function show(next) {
    step = ((next % total) + total) % total;
    tabs.forEach((tab, i) => {
      const on = i === step;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach((panel, i) => {
      panel.classList.toggle("is-active", i === step);
    });
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
