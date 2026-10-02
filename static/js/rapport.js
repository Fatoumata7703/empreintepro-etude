/* Graphiques propres pour l’étude de marché (figures numérotées). */
Chart.register(ChartDataLabels);

const COLORS = [
  "#1d4ed8",
  "#0f766e",
  "#7c3aed",
  "#c2410c",
  "#0369a1",
  "#be185d",
  "#15803d",
  "#4338ca",
  "#b45309",
  "#0e7490",
];

function colors(n, offset = 0) {
  return Array.from({ length: n }, (_, i) => COLORS[(i + offset) % COLORS.length]);
}

function alpha(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function pack(data) {
  const labels = (data && data.labels) || [];
  const values = ((data && data.values) || []).map((v) => Number(v || 0));
  return { labels, values, total: values.reduce((s, v) => s + v, 0) };
}

function basePlugins(showPctOnSlice = false) {
  return {
    legend: {
      position: "bottom",
      labels: {
        boxWidth: 12,
        padding: 12,
        font: { family: "Inter", size: 12, weight: "500" },
        color: "#1e293b",
      },
    },
    datalabels: showPctOnSlice
      ? {
          color: "#fff",
          font: { family: "Inter", weight: "700", size: 12 },
          formatter(value, ctx) {
            const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + Number(b || 0), 0) || 1;
            const pct = Math.round((Number(value) / total) * 100);
            return pct >= 8 ? `${pct}%` : "";
          },
        }
      : { display: false },
    tooltip: {
      callbacks: {
        label(ctx) {
          const data = ctx.dataset.data || [];
          const total = data.reduce((a, b) => a + Number(b || 0), 0) || 1;
          const n = Number(ctx.raw || 0);
          const pct = Math.round((n / total) * 100);
          const name = ctx.label || ctx.dataset.label || "";
          return ` ${name} : ${n} (${pct} %)`;
        },
      },
    },
  };
}

function empty(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  const box = el.closest(".fig") || el.closest(".card");
  if (!box) return;
  let p = box.querySelector(".chart-hint");
  if (!p) {
    p = document.createElement("p");
    p.className = "chart-hint";
    box.appendChild(p);
  }
  p.textContent = text;
}

function doughnut(id, data, offset = 0) {
  const { labels, values, total } = pack(data);
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (!total) {
    empty(id, "Pas encore de réponses pour cette figure.");
    return;
  }
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors(labels.length, offset),
        borderColor: "#fff",
        borderWidth: 3,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "55%",
      plugins: basePlugins(true),
    },
  });
}

function hbar(id, data, offset = 0) {
  const { labels, values, total } = pack(data);
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (!total) {
    empty(id, "Pas encore de réponses pour cette figure.");
    return;
  }
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors(labels.length, offset),
        borderRadius: 8,
        maxBarThickness: 28,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        ...basePlugins(false),
        legend: { display: false },
        datalabels: {
          anchor: "end",
          align: "right",
          color: "#0f172a",
          font: { family: "Inter", weight: "700", size: 11 },
          formatter(v) {
            return v > 0 ? v : "";
          },
          clamp: true,
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0, color: "#64748b", font: { family: "Inter", size: 11 } },
          grid: { color: "#f1f5f9" },
        },
        y: {
          ticks: { color: "#1e293b", font: { family: "Inter", size: 11 } },
          grid: { display: false },
        },
      },
    },
  });
}

function vbar(id, data, offset = 0) {
  const { labels, values, total } = pack(data);
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (!total) {
    empty(id, "Pas encore de réponses pour cette figure.");
    return;
  }
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors(labels.length, offset),
        borderRadius: 10,
        maxBarThickness: 48,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        ...basePlugins(false),
        legend: { display: false },
        datalabels: {
          anchor: "end",
          align: "top",
          color: "#0f172a",
          font: { family: "Inter", weight: "700", size: 11 },
          formatter(v) {
            return v > 0 ? v : "";
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#334155", font: { family: "Inter", size: 11 }, maxRotation: 35 },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: "#64748b" },
          grid: { color: "#f1f5f9" },
        },
      },
    },
  });
}

function funnel(id, data) {
  const { labels, values, total } = pack(data);
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (!total) {
    empty(id, "Pas encore de funnel.");
    return;
  }
  const base = values[0] || 1;
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ["#1e3a8a", "#2563eb", "#0891b2", "#16a34a"],
        borderRadius: 12,
        maxBarThickness: 46,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          color: "#fff",
          font: { family: "Inter", weight: "700", size: 12 },
          formatter(v) {
            const pct = Math.round((Number(v) / base) * 100);
            return `${v}  (${pct}%)`;
          },
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const n = Number(ctx.raw || 0);
              return ` ${n} (${Math.round((n / base) * 100)} % du sommet)`;
            },
          },
        },
      },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0, color: "#64748b" }, grid: { color: "#f1f5f9" } },
        y: { ticks: { color: "#0f172a", font: { family: "Inter", size: 12, weight: "600" } }, grid: { display: false } },
      },
    },
  });
}

function timeline(id, data) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  const labels = data?.labels || [];
  if (!labels.length) {
    empty(id, "Pas assez de dates pour une courbe.");
    return;
  }
  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Cumul",
          data: data.cumulative || [],
          borderColor: "#1e3a8a",
          backgroundColor: alpha("#1e3a8a", 0.12),
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: "#1e3a8a",
          yAxisID: "y",
        },
        {
          label: "Par jour",
          data: data.daily || [],
          borderColor: "#0f766e",
          backgroundColor: alpha("#0f766e", 0.1),
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: "#0f766e",
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        ...basePlugins(false),
        datalabels: { display: false },
      },
      scales: {
        x: {
          ticks: { color: "#64748b", font: { family: "Inter", size: 10 }, maxRotation: 40 },
          grid: { color: "#f8fafc" },
        },
        y: {
          beginAtZero: true,
          position: "left",
          title: { display: true, text: "Cumul", color: "#64748b" },
          ticks: { precision: 0, color: "#64748b" },
          grid: { color: "#f1f5f9" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          title: { display: true, text: "Par jour", color: "#64748b" },
          ticks: { precision: 0, color: "#64748b" },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
}

function interestTrend(id, data) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  const labels = data?.labels || [];
  if (!labels.length) {
    empty(id, "Pas assez de dates pour cette courbe.");
    return;
  }
  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Oui",
          data: data.oui || [],
          borderColor: "#16a34a",
          backgroundColor: alpha("#16a34a", 0.12),
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
        },
        {
          label: "Selon le prix",
          data: data.peut || [],
          borderColor: "#d97706",
          backgroundColor: alpha("#d97706", 0.1),
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
        },
        {
          label: "Non",
          data: data.non || [],
          borderColor: "#dc2626",
          backgroundColor: alpha("#dc2626", 0.08),
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        ...basePlugins(false),
        datalabels: { display: false },
      },
      scales: {
        x: {
          ticks: { color: "#64748b", font: { family: "Inter", size: 10 }, maxRotation: 40 },
          grid: { color: "#f8fafc" },
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: "#64748b" },
          grid: { color: "#f1f5f9" },
        },
      },
    },
  });
}

async function load() {
  const response = await fetch("/api/stats");
  if (response.status === 401) {
    window.location.href = "/admin";
    return;
  }
  const data = await response.json();
  const meta = document.getElementById("rapportMeta");
  if (meta) {
    const today = new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    meta.textContent = `${data.total} réponse${data.total > 1 ? "s" : ""} · ${data.pct_warm || 0} % ouverts · ${data.with_contact || 0} contact(s) · exporté le ${today}`;
  }

  doughnut("figInteret", data.charts.interet, 0);
  doughnut("figPilote", data.charts.pilote, 2);
  funnel("figFunnel", data.funnel);
  doughnut("figOrgs", data.charts.org_type, 1);
  doughnut("figRole", data.charts.role, 4);
  hbar("figZone", data.charts.zone, 3);
  doughnut("figPortes", data.charts.portes, 5);
  doughnut("figDecideur", data.charts.decideur, 6);
  hbar("figMoyens", data.charts.moyens, 0);
  vbar("figDouleurs", data.charts.douleurs, 2);
  hbar("figConcurrents", data.charts.concurrents, 4);
  hbar("figFreins", data.charts.freins, 1);
  vbar("figBudget", data.charts.budget, 3);
  doughnut("figAbonnement", data.charts.abonnement, 7);
  timeline("figTimeline", data.timeline);
  interestTrend("figInterestTrend", data.timeline);
}

document.getElementById("btnPrint")?.addEventListener("click", () => window.print());
load();
