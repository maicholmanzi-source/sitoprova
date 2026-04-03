
const userLine = document.getElementById("account-user-line");
const form = document.getElementById("account-form");
const nameInput = document.getElementById("account-name");
const emailInput = document.getElementById("account-email");
const addressInput = document.getElementById("account-address");
const cityInput = document.getElementById("account-city");
const statusBox = document.getElementById("account-status");
const logoutBtn = document.getElementById("account-logout-btn");
const ordersBox = document.getElementById("account-orders");

function showStatus(message, type = "error") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.className = `account-status ${type}`;
}

function formatPrice(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function renderOrders(orders = []) {
  if (!ordersBox) return;

  if (!orders.length) {
    ordersBox.innerHTML = `<div class="empty-box">Non hai ancora ordini associati al tuo account.</div>`;
    return;
  }

  ordersBox.innerHTML = orders.map((order) => `
    <article class="order-card">
      <strong>Ordine #${order.id}</strong>
      <div class="order-meta">
        Data: ${formatDate(order.createdAt)}<br />
        Stato: ${order.status || "nuovo"}<br />
        Totale: ${formatPrice(order.total || 0)}
      </div>
    </article>
  `).join("");
}

async function loadMe() {
  try {
    const response = await fetch("/api/auth/me");
    const data = await response.json();

    if (!data.authenticated) {
      window.location.href = "login.html";
      return;
    }

    const user = data.user;

    if (userLine) {
      userLine.textContent = `Benvenuto, ${user.name}. Gestisci i tuoi dati e consulta i tuoi ordini.`;
    }

    if (nameInput) nameInput.value = user.name || "";
    if (emailInput) emailInput.value = user.email || "";
    if (addressInput) addressInput.value = user.address || "";
    if (cityInput) cityInput.value = user.city || "";
  } catch (error) {
    console.error("Errore caricamento profilo:", error);
    window.location.href = "login.html";
  }
}

async function loadOrders() {
  try {
    const response = await fetch("/api/auth/orders");
    const data = await response.json();

    if (!response.ok) {
      renderOrders([]);
      return;
    }

    renderOrders(Array.isArray(data.orders) ? data.orders : []);
  } catch (error) {
    console.error("Errore caricamento ordini account:", error);
    renderOrders([]);
  }
}

async function handleSaveProfile(event) {
  event.preventDefault();

  const payload = {
    name: nameInput?.value.trim() || "",
    address: addressInput?.value.trim() || "",
    city: cityInput?.value.trim() || ""
  };

  if (!payload.name) {
    showStatus("Il nome è obbligatorio.", "error");
    return;
  }

  try {
    const response = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      showStatus(data.message || "Salvataggio non riuscito.", "error");
      return;
    }

    showStatus("Profilo aggiornato con successo.", "success");
    await loadMe();
  } catch (error) {
    console.error("Errore salvataggio profilo:", error);
    showStatus("Errore di connessione al server.", "error");
  }
}

async function handleLogout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST"
    });

    window.location.href = "login.html";
  } catch (error) {
    console.error("Errore logout utente:", error);
    alert("Errore durante il logout.");
  }
}

if (form) {
  form.addEventListener("submit", handleSaveProfile);
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", handleLogout);
}

loadMe();
loadOrders();