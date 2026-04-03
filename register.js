const form = document.getElementById("register-form");
const accountTypeInput = document.getElementById("register-account-type");
const nameInput = document.getElementById("register-name");
const emailInput = document.getElementById("register-email");
const passwordInput = document.getElementById("register-password");
const addressInput = document.getElementById("register-address");
const cityInput = document.getElementById("register-city");

const businessFieldsBox = document.getElementById("business-fields");
const companyNameInput = document.getElementById("register-company-name");
const vatNumberInput = document.getElementById("register-vat-number");
const contactPersonInput = document.getElementById("register-contact-person");

const statusBox = document.getElementById("register-status");

function showStatus(message, type = "error") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.className = `auth-status ${type}`;
}

function normalizeVatNumber(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function updateAccountTypeUI() {
  const isBusiness = accountTypeInput?.value === "business";

  if (businessFieldsBox) {
    businessFieldsBox.style.display = isBusiness ? "block" : "none";
  }

  if (companyNameInput) companyNameInput.required = isBusiness;
  if (vatNumberInput) vatNumberInput.required = isBusiness;
  if (contactPersonInput) contactPersonInput.required = isBusiness;
}

function validateForm(payload) {
  if (!payload.name || !payload.email || !payload.password) {
    return "Compila tutti i campi obbligatori.";
  }

  if (payload.password.length < 6) {
    return "La password deve avere almeno 6 caratteri.";
  }

  if (payload.accountType === "business") {
    if (!payload.companyName || !payload.vatNumber || !payload.contactPerson) {
      return "Compila tutti i campi azienda.";
    }

    if (!/^\d{11}$/.test(payload.vatNumber)) {
      return "La partita IVA deve contenere 11 cifre.";
    }
  }

  return "";
}

async function handleRegister(event) {
  event.preventDefault();

  const payload = {
    accountType: accountTypeInput?.value || "private",
    name: nameInput?.value.trim() || "",
    email: emailInput?.value.trim() || "",
    password: passwordInput?.value.trim() || "",
    address: addressInput?.value.trim() || "",
    city: cityInput?.value.trim() || "",
    companyName: companyNameInput?.value.trim() || "",
    vatNumber: normalizeVatNumber(vatNumberInput?.value || ""),
    contactPerson: contactPersonInput?.value.trim() || ""
  };

  const validationMessage = validateForm(payload);

  if (validationMessage) {
    showStatus(validationMessage, "error");
    return;
  }

  showStatus("Registrazione in corso...", "success");

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      showStatus(data.message || "Registrazione non riuscita.", "error");
      return;
    }

    showStatus("Account creato con successo. Reindirizzamento...", "success");

    setTimeout(() => {
      window.location.href = "account.html";
    }, 700);
  } catch (error) {
    console.error("Errore registrazione:", error);
    showStatus("Errore di connessione al server.", "error");
  }
}

if (accountTypeInput) {
  accountTypeInput.addEventListener("change", updateAccountTypeUI);
}

if (form) {
  form.addEventListener("submit", handleRegister);
}

updateAccountTypeUI();