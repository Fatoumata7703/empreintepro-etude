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
    budget: value("budget"),
    abonnement: value("abonnement"),
    urgence: "",
    pilote: value("pilote"),
    nom: value("nom"),
    tel: value("tel"),
    fin: value("fin"),
  };

  if (!payload.org_type || !payload.interet) {
    errorBox.textContent = "Indiquez au moins le type de site et votre intérêt pour EmpreintePro.";
    errorBox.classList.add("show");
    errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Envoi…";

  try {
    const response = await fetch("/api/reponses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Envoi impossible.");
    }
    window.location.href = data.redirect;
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add("show");
    submitBtn.disabled = false;
    submitBtn.textContent = "Envoyer";
  }
});
