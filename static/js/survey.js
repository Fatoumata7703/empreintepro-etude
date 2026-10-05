const form = document.getElementById("surveyForm");
const errorBox = document.getElementById("surveyError");
const submitBtn = document.getElementById("surveySubmit");

function values(name) {
  return [...form.querySelectorAll(`[name="${name}"]:checked`)].map((el) => el.value);
}

function value(name) {
  const picked = form.querySelector(`[name="${name}"]:checked`);
  if (picked) return picked.value;
  const field = form.elements[name];
  return field ? field.value : "";
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.add("show");
  errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function postResponse(payload, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch("/api/reponses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let data = {};
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      throw new Error(
        response.ok
          ? "Réponse serveur illisible."
          : "Le serveur a renvoyé une erreur. Réessayez."
      );
    }
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Envoi impossible.");
    }
    if (!data.id) {
      throw new Error("Envoi sans confirmation d’enregistrement.");
    }
    return data;
  } catch (err) {
    const retryable =
      attempt < 2 &&
      (err.name === "AbortError" ||
        /network|failed|fetch|timeout|illisible|Réessayez/i.test(String(err.message || "")));
    if (retryable) {
      await new Promise((r) => setTimeout(r, 1200));
      return postResponse(payload, attempt + 1);
    }
    if (err.name === "AbortError") {
      throw new Error("Délai dépassé. Vérifiez la connexion et réessayez.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.classList.remove("show");
  errorBox.textContent = "";

  const payload = {
    role: value("role"),
    org_type: value("type"),
    taille: "",
    zone: value("zone"),
    moyens: values("moyen"),
    portes: value("portes"),
    concurrents: values("concurrent"),
    douleurs: values("douleur"),
    incident: "",
    priorite: "",
    qui: [],
    decideur: value("decideur"),
    interet: value("interet"),
    freins: values("frein"),
    ailleurs: "",
    budget: values("budget"),
    abonnement: value("abonnement"),
    urgence: "",
    pilote: value("pilote"),
    nom: value("nom"),
    tel: value("tel"),
    fin: value("fin"),
  };

  if (!payload.org_type || !payload.interet) {
    showError("Indiquez au moins le type de lieu et si EmpreintePro vous parle.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Envoi…";

  try {
    const data = await postResponse(payload);
    window.location.href = data.redirect || `/merci?n=${data.id}`;
  } catch (err) {
    showError(err.message || "Envoi impossible.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Envoyer";
  }
});
