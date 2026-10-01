const palette = ["#2563eb", "#1e40af", "#60a5fa", "#1d4ed8", "#93c5fd", "#0f766e", "#f59e0b"];

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 12, font: { family: "Inter", size: 12 } } },
    },
  };
}

function doughnut(id, data) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.labels,
      datasets: [{ data: data.values, backgroundColor: palette, borderWidth: 0 }],
    },
    options: chartOptions(),
  });
}

function bars(id, data) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [{ data: data.values, backgroundColor: "#2563eb", borderRadius: 8, maxBarThickness: 28 }],
    },
    options: {
      ...chartOptions(),
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { family: "Inter", size: 11 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#f3f4f6" } },
      },
    },
  });
}

function badge(key) {
  if (key === "oui") return '<span class="badge hot">Intéressé</span>';
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
  document.getElementById("kpiYesHint").textContent = `${data.interest_yes} oui clairement`;
  document.getElementById("kpiWarmHint").textContent = `${data.interest_maybe} oui + selon le prix`;
  document.getElementById("kpiPilotHint").textContent = "prêts à discuter 3 mois";
  document.getElementById("kpiContact").textContent = data.with_contact;

  doughnut("chartInteret", data.charts.interet);
  doughnut("chartOrgs", data.charts.org_type);
  bars("chartMoyens", data.charts.moyens);
  bars("chartDouleurs", data.charts.douleurs);
  bars("chartFreins", data.charts.freins);
  doughnut("chartPilote", data.charts.pilote);

  fillTable("leadRows", data.leads);
  fillTable("allRows", data.recent);
}

loadStats();
