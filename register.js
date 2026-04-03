const form = document.getElementById("register-form");
const nameInput = document.getElementById("register-name");
const emailInput = document.getElementById("register-email");
const passwordInput = document.getElementById("register-password");
const statusBox = document.getElementById("register-status");

function showStatus(message, type = "error") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.className = `auth-status ${type}`;
}

async function handleRegister(event) {
  event.preventDefault();

  const name = nameInput?.value.trim() || "";
  const email = emailInput?.value.trim() || "";
  const password = passwordInput?.value.trim() || "";

  if (!name || !email || !password) {
    showStatus("Compila tutti i campi.", "error");
    return;
  }

  if (password.length < 6) {
    showStatus("La password deve avere almeno 6 caratteri.", "error");
    return;
  }

  showStatus("Registrazione in corso...", "success");

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, email, password })
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

if (form) {
  form.addEventListener("submit", handleRegister);
}