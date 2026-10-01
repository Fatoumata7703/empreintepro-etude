/* Bleu de base + accents bien distincts (pas 6 bleus proches). */
const palette = [
  "#1d4ed8", // bleu fort
  "#0f766e", // teal
  "#d97706", // ambre
  "#2563eb", // bleu vif
  "#16a34a", // vert
  "#7c3aed", // violet
  "#0284c7", // bleu ciel
  "#b45309", // brun orangé
  "#64748b", // gris ardoise
  "#db2777", // rose
];

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
          padding: 12,
          font: { family: "Inter", size: 11 },
          color: "#334155",
        },
      },
      tooltip: {
        callbacks: {
          label(ctx) {
            const total = ctx.dataset.data.reduce((a, b) => a + Number(b || 0), 0) || 1;
            const n = Number(ctx.raw || 0);
            const pct = Math.round((n / total) * 100);
            return ` ${ctx.label} : ${n} réponse${n > 1 ? "s" : ""} (${pct} %)`;
          },
        },
      },
      ...(extra.plugins || {}),
    },
    ...extra,
  };
}

function nonzero(data) {
  const labels = [];
  const values = [];
  (data.labels || []).forEach((label, i) => {
    const n = Number((data.values || [])[i] || 0);
    if (n > 0) {
      labels.push(label);
      values.push(n);
    }
  });
  return { labels, values };
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

function doughnut(id, data, emptyText = "Aucune réponse pour ce graphique.") {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  const filtered = nonzero(data);
  if (!filtered.values.length) {
    setHint(id, emptyText);
    return;
  }
  const colors = filtered.labels.map((_, i) => palette[i % palette.length]);
  const top = filtered.labels[filtered.values.indexOf(Math.max(...filtered.values))];
  const n = filtered.values.reduce((a, b) => a + b, 0);
  setHint(id, n === 1 ? `Réponse : ${top}` : `Dominant : ${top} (${Math.max(...filtered.values)}/${n})`);
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: filtered.labels,
      datasets: [{ data: filtered.values, backgroundColor: colors, borderWidth: 2, borderColor: "#fff" }],
    },
    options: chartOptions(),
  });
}

function bars(id, data, emptyText = "Aucune réponse pour ce graphique.") {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  const labels = data.labels || [];
  const values = (data.values || []).map((v) => Number(v || 0));
  if (!values.some((v) => v > 0)) {
    setHint(id, emptyText);
    return;
  }
  const colors = labels.map((_, i) => palette[i % palette.length]);
  const topIdx = values.indexOf(Math.max(...values));
  setHint(id, `Plus cité : ${labels[topIdx]} (${values[topIdx]})`);
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderRadius: 8, maxBarThickness: 28 }],
    },
    options: chartOptions({
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { family: "Inter", size: 10 }, color: "#475569", maxRotation: 45 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0, color: "#64748b" }, grid: { color: "#f1f5f9" } },
      },
    }),
  });
}

function badge(key) {
  if (key === "oui") return '<span class="badge hot">Oui, clairement</span>';
  if (key === "peut") return '<span class="badge warm">Selon le prix</span>';
  if (key === "plus") return '<span class="badge warm">Plus tard</span>';
  if (key === "non") return '<span class="badge cold">Pas intéressé</span>';
  return '<span class="badge cold">—</span>';
}

function fillTable(id, rows) {
  const body = document.getElementById(id);
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">Aucune réponse pour le moment.</td></tr>';
    return;
  }
  body.innerHTML = rows
    .map((row) => {
      const who = row.nom || row.tel ? `${row.nom || "—"}<div class="hint">${row.tel || ""}</div>` : "Anonyme";
      return `<tr>
        <td>${who}</td>
        <td>${row.org_type}</td>
        <td>${row.zone}</td>
        <td>${badge(row.interet)}</td>
        <td>${row.pilote}</td>
        <td>${row.fin || row.incident || "—"}</td>
      </tr>`;
    })
    .join("");
}

async function loadStats() {
  const response = await fetch("/api/stats");
  if (response.status === 401) {
    window.location.href = "/admin";
    return;
  }
  const data = await response.json();
  document.getElementById("kpiTotal").textContent = data.total;
  document.getElementById("kpiYes").textContent = `${data.pct_yes} %`;
  document.getElementById("kpiWarm").textContent = `${data.pct_warm} %`;
  document.getElementById("kpiPilot").textContent = data.pilot_open;
  document.getElementById("kpiYesHint").textContent = `${data.interest_yes} « Oui, clairement » seulement`;
  document.getElementById("kpiWarmHint").textContent = `${data.interest_maybe} « oui » + « selon le prix »`;
  document.getElementById("kpiPilotHint").textContent = "uniquement « essayer chez moi » (pas la démo)";
  document.getElementById("kpiContact").textContent = data.with_contact;

  doughnut("chartInteret", data.charts.interet);
  doughnut("chartOrgs", data.charts.org_type);
  bars("chartMoyens", data.charts.moyens);
  bars("chartDouleurs", data.charts.douleurs);
  bars("chartFreins", data.charts.freins);
  bars("chartConcurrents", data.charts.concurrents);
  doughnut("chartBudget", data.charts.budget);
  doughnut("chartUrgence", data.charts.urgence);
  doughnut("chartDecideur", data.charts.decideur);
  doughnut("chartAilleurs", data.charts.ailleurs);
  doughnut("chartAbonnement", data.charts.abonnement);
  doughnut("chartPilote", data.charts.pilote);
  bars("chartZone", data.charts.zone);
  doughnut("chartTaille", data.charts.taille);
  doughnut("chartRole", data.charts.role);
  doughnut("chartPortes", data.charts.portes);
  doughnut("chartPriorite", data.charts.priorite);
  bars("chartQui", data.charts.qui);

  fillTable("leadRows", data.leads);
  fillTable("allRows", data.recent);
}

loadStats();
