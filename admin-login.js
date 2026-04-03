const form = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const statusBox = document.getElementById("login-status");

function showStatus(message, type = "error") {
  if (!statusBox) return;

  statusBox.textContent = message;
  statusBox.className = `login-status ${type}`;
}

async function checkExistingSession() {
  try {
    const response = await fetch("/api/admin/session");
    const data = await response.json();

    if (data.authenticated) {
      window.location.href = "admin.html";
    }
  } catch (error) {
    console.error("Errore controllo sessione admin:", error);
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const username = usernameInput?.value.trim() || "";
  const password = passwordInput?.value.trim() || "";

  if (!username || !password) {
    showStatus("Inserisci username e password.", "error");
    return;
  }

  showStatus("Accesso in corso...", "success");

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showStatus(data.message || "Credenziali non valide.", "error");
      return;
    }

    showStatus("Login effettuato. Reindirizzamento...", "success");

    setTimeout(() => {
      window.location.href = "admin.html";
    }, 700);
  } catch (error) {
    console.error("Errore login admin:", error);
    showStatus("Errore di connessione al server.", "error");
  }
}

if (form) {
  form.addEventListener("submit", handleLogin);
}

checkExistingSession();