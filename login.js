const form = document.getElementById("login-form");
const emailInput = document.getElementById("login-email");
const passwordInput = document.getElementById("login-password");
const statusBox = document.getElementById("login-status");

function showStatus(message, type = "error") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.className = `auth-status ${type}`;
}

async function checkExistingSession() {
  try {
    const response = await fetch("/api/auth/me");
    const data = await response.json();

    if (data.authenticated) {
      window.location.href = "account.html";
    }
  } catch (error) {
    console.error("Errore controllo sessione utente:", error);
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const email = emailInput?.value.trim() || "";
  const password = passwordInput?.value.trim() || "";

  if (!email || !password) {
    showStatus("Inserisci email e password.", "error");
    return;
  }

  showStatus("Accesso in corso...", "success");

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showStatus(data.message || "Credenziali non valide.", "error");
      return;
    }

    showStatus("Login effettuato. Reindirizzamento...", "success");

    setTimeout(() => {
      window.location.href = "account.html";
    }, 700);
  } catch (error) {
    console.error("Errore login utente:", error);
    showStatus("Errore di connessione al server.", "error");
  }
}

if (form) {
  form.addEventListener("submit", handleLogin);
}

checkExistingSession();