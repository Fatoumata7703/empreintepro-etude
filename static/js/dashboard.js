/* Bleus différenciés + turquoise / indigo / magenta (bleu-rouge). */
const palette = [
  "#1e3a8a", // navy
  "#0891b2", // turquoise
  "#2563eb", // bleu vif
  "#7c3aed", // indigo-violet
  "#db2777", // bleu-rouge / magenta
  "#0f766e", // teal
  "#0284c7", // ciel
  "#4f46e5", // indigo
  "#0369a1", // cyan profond
  "#9333ea", // violet
  "#1d4ed8", // royal
  "#155e75", // pétrole
];

/* Décalage de couleur par graphique → chaque carte n’a pas le même bleu dominant. */
const chartColorOffset = {
  chartInteret: 0,
  chartOrgs: 3,
  chartMoyens: 1,
  chartDouleurs: 4,
  chartFreins: 6,
  chartConcurrents: 2,
  chartBudget: 5,
  chartUrgence: 7,
  chartDecideur: 8,
  chartAilleurs: 9,
  chartAbonnement: 10,
  chartPilote: 11,
  chartZone: 1,
  chartTaille: 3,
  chartRole: 6,
  chartPortes: 9,
  chartPriorite: 4,
  chartQui: 7,
};

function colorsFor(id, count) {
  const offset = chartColorOffset[id] || 0;
  return Array.from({ length: count }, (_, i) => palette[(i + offset) % palette.length]);
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
          // Toujours afficher toutes les catégories (même à 0).
          filter: () => true,
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
  const labels = data.labels || [];
  const values = (data.values || []).map((v) => Number(v || 0));
  if (!labels.length) {
    setHint(id, emptyText);
    return;
  }
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) {
    setHint(id, emptyText);
  } else {
    const topIdx = values.indexOf(Math.max(...values));
    setHint(id, total === 1 ? `Réponse : ${labels[topIdx]}` : `Dominant : ${labels[topIdx]} (${values[topIdx]}/${total})`);
  }
  // Toutes les cases de légende restent visibles, y compris les 0.
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colorsFor(id, labels.length),
        borderWidth: 2,
        borderColor: "#fff",
      }],
    },
    options: chartOptions(),
  });
}

function bars(id, data, emptyText = "Aucune réponse pour ce graphique.") {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  const labels = data.labels || [];
  const values = (data.values || []).map((v) => Number(v || 0));
  if (!labels.length) {
    setHint(id, emptyText);
    return;
  }
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) {
    setHint(id, emptyText);
  } else {
    const topIdx = values.indexOf(Math.max(...values));
    setHint(id, `Plus cité : ${labels[topIdx]} (${values[topIdx]})`);
  }
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colorsFor(id, labels.length),
        borderRadius: 8,
        maxBarThickness: 28,
      }],
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
      ${field("Budget installation", row.budget)}
      ${field("Abo plateforme (enrôlement / droits)", row.abonnement)}
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
      const preview = (row.fin || row.incident || "Cliquer pour le résumé complet");
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

document.getElementById("personClose")?.addEventListener("click", closePerson);
document.getElementById("personBackdrop")?.addEventListener("click", closePerson);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePerson();
});

loadStats();
