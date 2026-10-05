/* Bleus différenciés + turquoise / indigo / magenta. */
const palette = [
  "#1e3a8a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#0f766e",
  "#0284c7",
  "#4f46e5",
  "#0369a1",
  "#9333ea",
  "#1d4ed8",
  "#155e75",
];

const chartColorOffset = {
  chartInteret: 0,
  chartOrgs: 3,
  chartMoyens: 1,
  chartDouleurs: 4,
  chartFreins: 6,
  chartFreinsRadar: 6,
  chartDouleursRadar: 4,
  chartConcurrents: 2,
  chartBudget: 5,
  chartDecideur: 8,
  chartAbonnement: 10,
  chartPilote: 11,
  chartZone: 1,
  chartRole: 6,
  chartPortes: 9,
  chartPriorite: 4,
  chartFunnel: 0,
  chartTimeline: 0,
  chartInterestTrend: 2,
};

const chartRegistry = {};

function colorsFor(id, count) {
  const offset = chartColorOffset[id] || 0;
  return Array.from({ length: count }, (_, i) => palette[(i + offset) % palette.length]);
}

function withAlpha(hex, alpha) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function chartOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          boxWidth: 12,
          boxHeight: 12,
          padding: 10,
          font: { family: "Inter", size: 11 },
          color: "#334155",
          filter: () => true,
        },
      },
      tooltip: {
        callbacks: {
          label(ctx) {
            const data = ctx.dataset.data || [];
            const total = data.reduce((a, b) => a + Number(b || 0), 0) || 1;
            const n = Number(ctx.raw || 0);
            const pct = Math.round((n / total) * 100);
            const name = ctx.dataset.label ? `${ctx.dataset.label} — ` : "";
            if (ctx.chart.config.type === "line") {
              return ` ${name}${ctx.label || ""} : ${n}`;
            }
            return ` ${name}${ctx.label || ""} : ${n} (${pct} %)`;
          },
        },
      },
      ...(extra.plugins || {}),
    },
    ...extra,
  };
}

function setHint(canvasId, text) {
  const box = document.getElementById(canvasId)?.closest(".card");
  if (!box) return;
  let hint = box.querySelector(".chart-hint");
  if (!hint) {
    hint = document.createElement("p");
    hint.className = "chart-hint";
    box.appendChild(hint);
  }
  hint.textContent = text || "";
}

function destroyChart(id) {
  if (chartRegistry[id]) {
    chartRegistry[id].destroy();
    delete chartRegistry[id];
  }
}

function makeChart(id, config) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  destroyChart(id);
  chartRegistry[id] = new Chart(ctx, config);
  return chartRegistry[id];
}

function nonempty(data) {
  const labels = data?.labels || [];
  const values = (data?.values || []).map((v) => Number(v || 0));
  return { labels, values, total: values.reduce((a, b) => a + b, 0) };
}

function doughnut(id, data, emptyText = "Aucune réponse pour ce graphique.") {
  const { labels, values, total } = nonempty(data);
  if (!labels.length) {
    setHint(id, emptyText);
    return;
  }
  if (!total) setHint(id, emptyText);
  else {
    const topIdx = values.indexOf(Math.max(...values));
    setHint(id, total === 1 ? `Réponse : ${labels[topIdx]}` : `Dominant : ${labels[topIdx]} (${values[topIdx]}/${total})`);
  }
  makeChart(id, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colorsFor(id, labels.length),
        borderWidth: 2,
        borderColor: "#fff",
        hoverOffset: 6,
      }],
    },
    options: chartOptions({ cutout: "58%" }),
  });
}

function polar(id, data, emptyText = "Aucune réponse pour ce graphique.") {
  const { labels, values, total } = nonempty(data);
  if (!labels.length || !total) {
    setHint(id, emptyText);
    return;
  }
  const topIdx = values.indexOf(Math.max(...values));
  setHint(id, `Dominant : ${labels[topIdx]} (${values[topIdx]})`);
  makeChart(id, {
    type: "polarArea",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colorsFor(id, labels.length).map((c) => withAlpha(c, 0.72)),
        borderWidth: 1,
        borderColor: "#fff",
      }],
    },
    options: chartOptions({
      scales: {
        r: {
          beginAtZero: true,
          ticks: { precision: 0, backdrop: false, color: "#94a3b8" },
          grid: { color: "#e2e8f0" },
        },
      },
    }),
  });
}

function bars(id, data, { horizontal = false, emptyText = "Aucune réponse pour ce graphique." } = {}) {
  const { labels, values, total } = nonempty(data);
  if (!labels.length) {
    setHint(id, emptyText);
    return;
  }
  if (!total) setHint(id, emptyText);
  else {
    const topIdx = values.indexOf(Math.max(...values));
    setHint(id, `Plus cité : ${labels[topIdx]} (${values[topIdx]})`);
  }
  const axis = {
    ticks: { font: { family: "Inter", size: 10 }, color: "#475569", maxRotation: horizontal ? 0 : 45 },
    grid: { display: false },
  };
  const valueAxis = {
    beginAtZero: true,
    ticks: { precision: 0, color: "#64748b" },
    grid: { color: "#f1f5f9" },
  };
  makeChart(id, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colorsFor(id, labels.length),
        borderRadius: 8,
        maxBarThickness: horizontal ? 22 : 36,
      }],
    },
    options: chartOptions({
      indexAxis: horizontal ? "y" : "x",
      plugins: { legend: { display: false } },
      scales: horizontal
        ? { x: valueAxis, y: axis }
        : { x: axis, y: valueAxis },
    }),
  });
}

function radar(id, data, emptyText = "Aucune réponse pour ce graphique.") {
  const { labels, values, total } = nonempty(data);
  if (!labels.length || !total) {
    setHint(id, emptyText);
    return;
  }
  const color = palette[chartColorOffset[id] || 0];
  setHint(id, `Total mentions : ${total}`);
  makeChart(id, {
    type: "radar",
    data: {
      labels,
      datasets: [{
        label: "Mentions",
        data: values,
        backgroundColor: withAlpha(color, 0.22),
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: color,
        pointRadius: 3,
      }],
    },
    options: chartOptions({
      plugins: { legend: { display: false } },
      scales: {
        r: {
          beginAtZero: true,
          ticks: { precision: 0, backdrop: false, color: "#94a3b8" },
          grid: { color: "#e2e8f0" },
          pointLabels: { font: { family: "Inter", size: 10 }, color: "#334155" },
        },
      },
    }),
  });
}

function timeline(id, data) {
  const labels = data?.labels || [];
  if (!labels.length) {
    setHint(id, "Pas encore assez de dates pour tracer une courbe.");
    return;
  }
  const last = labels[labels.length - 1];
  const cum = data.cumulative || [];
  setHint(id, `${cum[cum.length - 1] || 0} réponses cumulées · dernier jour : ${last}`);
  makeChart(id, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Cumul",
          data: data.cumulative || [],
          borderColor: "#1e3a8a",
          backgroundColor: withAlpha("#1e3a8a", 0.12),
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 5,
          yAxisID: "y",
        },
        {
          label: "Par jour",
          data: data.daily || [],
          borderColor: "#0891b2",
          backgroundColor: withAlpha("#0891b2", 0.15),
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 3,
          yAxisID: "y1",
        },
      ],
    },
    options: chartOptions({
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          ticks: { font: { family: "Inter", size: 10 }, color: "#64748b", maxRotation: 40 },
          grid: { color: "#f1f5f9" },
        },
        y: {
          beginAtZero: true,
          position: "left",
          title: { display: true, text: "Cumul", color: "#64748b", font: { size: 11 } },
          ticks: { precision: 0, color: "#64748b" },
          grid: { color: "#f1f5f9" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          title: { display: true, text: "Par jour", color: "#64748b", font: { size: 11 } },
          ticks: { precision: 0, color: "#64748b" },
          grid: { drawOnChartArea: false },
        },
      },
    }),
  });
}

function interestTrend(id, data) {
  const labels = data?.labels || [];
  if (!labels.length) {
    setHint(id, "Pas encore assez de dates pour tracer l’intérêt.");
    return;
  }
  setHint(id, "Évolution quotidienne de l’intérêt");
  makeChart(id, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Oui",
          data: data.oui || [],
          borderColor: "#16a34a",
          backgroundColor: withAlpha("#16a34a", 0.12),
          fill: true,
          tension: 0.35,
          borderWidth: 2.2,
          pointRadius: 3,
        },
        {
          label: "Selon le prix",
          data: data.peut || [],
          borderColor: "#d97706",
          backgroundColor: withAlpha("#d97706", 0.1),
          fill: true,
          tension: 0.35,
          borderWidth: 2.2,
          pointRadius: 3,
        },
        {
          label: "Non",
          data: data.non || [],
          borderColor: "#dc2626",
          backgroundColor: withAlpha("#dc2626", 0.08),
          fill: true,
          tension: 0.35,
          borderWidth: 2.2,
          pointRadius: 3,
        },
      ],
    },
    options: chartOptions({
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          ticks: { font: { family: "Inter", size: 10 }, color: "#64748b", maxRotation: 40 },
          grid: { color: "#f1f5f9" },
        },
        y: {
          beginAtZero: true,
          stacked: false,
          ticks: { precision: 0, color: "#64748b" },
          grid: { color: "#f1f5f9" },
        },
      },
    }),
  });
}

function funnel(id, data) {
  const { labels, values, total } = nonempty(data);
  if (!labels.length || !total) {
    setHint(id, "Pas encore de funnel à afficher.");
    return;
  }
  const base = values[0] || 1;
  setHint(id, `Conversion finale : ${Math.round((values[values.length - 1] / base) * 100)} % des réponses → essai`);
  makeChart(id, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [
          withAlpha("#1e3a8a", 0.95),
          withAlpha("#2563eb", 0.9),
          withAlpha("#0891b2", 0.9),
          withAlpha("#16a34a", 0.9),
        ],
        borderRadius: 10,
        maxBarThickness: 42,
      }],
    },
    options: chartOptions({
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx) {
              const n = Number(ctx.raw || 0);
              const pct = Math.round((n / base) * 100);
              return ` ${n} (${pct} % du sommet)`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0, color: "#64748b" },
          grid: { color: "#f1f5f9" },
        },
        y: {
          ticks: { font: { family: "Inter", size: 12 }, color: "#334155" },
          grid: { display: false },
        },
      },
    }),
  });
}

function badge(key) {
  if (key === "oui") return '<span class="badge hot">Oui</span>';
  if (key === "peut") return '<span class="badge warm">Selon le prix</span>';
  if (key === "plus") return '<span class="badge warm">Plus tard</span>';
  if (key === "non") return '<span class="badge cold">Pas intéressé</span>';
  return '<span class="badge cold">—</span>';
}

function joinList(items) {
  if (!items || !items.length) return "—";
  return items.join(" · ");
}

function field(label, value) {
  return `<div class="person-field"><dt>${label}</dt><dd>${value || "—"}</dd></div>`;
}

let peopleById = {};

function openPerson(id) {
  const row = peopleById[id];
  if (!row) return;
  const modal = document.getElementById("personModal");
  const title = document.getElementById("personTitle");
  const body = document.getElementById("personBody");
  title.textContent = row.nom || row.tel || "Répondant anonyme";
  body.innerHTML = `
    <p class="person-resume">${row.resume || ""}</p>
    <dl class="person-grid">
      ${field("Contact", [row.nom, row.tel].filter(Boolean).join(" · ") || "Anonyme")}
      ${field("Rôle", row.role)}
      ${field("Organisation", row.org_type)}
      ${field("Zone", row.zone)}
      ${field("Taille du site", row.taille)}
      ${field("Portes", row.portes)}
      ${field("Accès aujourd’hui", joinList(row.moyens))}
      ${field("Problèmes", joinList(row.douleurs))}
      ${field("Priorité", row.priorite)}
      ${field("Qui doit ouvrir", joinList(row.qui))}
      ${field("Qui décide", row.decideur)}
      ${field("Intérêt EmpreintePro", row.interet_label)}
      ${field("Vu ailleurs", row.ailleurs)}
      ${field("Freins", joinList(row.freins))}
      ${field("Concurrents", joinList(row.concurrents))}
      ${field("Tarifs installation", row.budget)}
      ${field("Paiement abonnement plateforme", row.abonnement)}
      ${field("Urgence", row.urgence)}
      ${field("Démo / essai", row.pilote)}
      ${field("Cas concret", row.incident || "—")}
      ${field("Mot libre", row.fin || "—")}
    </dl>
  `;
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closePerson() {
  const modal = document.getElementById("personModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

function fillTable(id, rows) {
  const body = document.getElementById(id);
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">Aucune réponse pour le moment.</td></tr>';
    return;
  }
  body.innerHTML = rows
    .map((row) => {
      peopleById[row.id] = row;
      const who = row.nom || row.tel ? `${row.nom || "—"}<div class="hint">${row.tel || ""}</div>` : "Anonyme";
      const preview = row.fin || row.incident || "Cliquer pour le résumé complet";
      return `<tr class="click-row" tabindex="0" data-id="${row.id}" title="Voir le résumé">
        <td>${who}</td>
        <td>${row.org_type}</td>
        <td>${row.zone}</td>
        <td>${badge(row.interet)}</td>
        <td>${row.pilote}</td>
        <td class="preview-cell">${preview}</td>
      </tr>`;
    })
    .join("");

  body.querySelectorAll(".click-row").forEach((tr) => {
    const open = () => openPerson(Number(tr.dataset.id));
    tr.addEventListener("click", open);
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
}

async function loadStats() {
  const response = await fetch(`/api/stats?_=${Date.now()}`, { cache: "no-store" });
  if (response.status === 401) {
    window.location.href = "/admin";
    return;
  }
  const data = await response.json();
  document.getElementById("kpiTotal").textContent = data.total;
  const stamp = document.getElementById("kpiStamp");
  if (stamp) {
    const when = data.generated_at ? new Date(data.generated_at) : new Date();
    stamp.textContent = `${data.total} au total · maj ${when.toLocaleTimeString("fr-FR")} · ${data.storage || "?"}`;
  }
  document.getElementById("kpiYes").textContent = `${data.pct_yes} %`;
  document.getElementById("kpiWarm").textContent = `${data.pct_warm} %`;
  document.getElementById("kpiPilot").textContent = data.pilot_open;
  document.getElementById("kpiContact").textContent = data.with_contact;
  document.getElementById("kpiContactPct").textContent = `${data.pct_contact || 0} %`;
  document.getElementById("kpiYesHint").textContent = `${data.interest_yes} « Oui » seulement`;
  document.getElementById("kpiWarmHint").textContent = `${data.interest_maybe} « Oui » + « Selon le prix »`;
  document.getElementById("kpiPilotHint").textContent = "uniquement « essayer chez moi » (pas la démo)";

  timeline("chartTimeline", data.timeline);
  interestTrend("chartInterestTrend", data.timeline);
  funnel("chartFunnel", data.funnel);

  doughnut("chartRole", data.charts.role);
  polar("chartOrgs", data.charts.org_type);
  bars("chartZone", data.charts.zone, { horizontal: true });
  doughnut("chartPortes", data.charts.portes);
  doughnut("chartDecideur", data.charts.decideur);

  bars("chartMoyens", data.charts.moyens, { horizontal: true });
  bars("chartConcurrents", data.charts.concurrents, { horizontal: true });
  bars("chartDouleurs", data.charts.douleurs);
  radar("chartDouleursRadar", data.charts.douleurs);

  doughnut("chartInteret", data.charts.interet);
  doughnut("chartPilote", data.charts.pilote);
  bars("chartFreins", data.charts.freins, { horizontal: true });
  radar("chartFreinsRadar", data.charts.freins);
  bars("chartBudget", data.charts.budget);
  doughnut("chartAbonnement", data.charts.abonnement);

  fillTable("leadRows", data.leads);
  fillTable("allRows", data.recent);
}

document.getElementById("personClose")?.addEventListener("click", closePerson);
document.getElementById("personBackdrop")?.addEventListener("click", closePerson);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePerson();
});
document.getElementById("btnRefreshDash")?.addEventListener("click", (e) => {
  e.preventDefault();
  // Recharge la page pour éviter des graphiques Chart.js en double.
  window.location.reload();
});

loadStats();
