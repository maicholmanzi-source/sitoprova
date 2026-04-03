const userLine = document.getElementById("account-user-line");
const form = document.getElementById("account-form");
const nameInput = document.getElementById("account-name");
const emailInput = document.getElementById("account-email");
const addressInput = document.getElementById("account-address");
const cityInput = document.getElementById("account-city");
const statusBox = document.getElementById("account-status");
const logoutBtn = document.getElementById("account-logout-btn");
const ordersBox = document.getElementById("account-orders");

const notificationBadge = document.getElementById("account-notification-badge");
const notificationList = document.getElementById("account-notification-list");
const readAllBtn = document.getElementById("account-read-all-btn");

let notifications = [];
let notificationsPollingId = null;

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function updateNotificationBadge(unreadCount) {
  if (!notificationBadge) return;

  const count = Number(unreadCount || 0);
  notificationBadge.textContent = String(count);
  notificationBadge.style.display = count > 0 ? "inline-flex" : "none";
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
        Stato: ${escapeHtml(order.status || "nuovo")}<br />
        Totale: ${formatPrice(order.total || 0)}
        ${order.shippingNote ? `<br />Nota spedizione: ${escapeHtml(order.shippingNote)}` : ""}
        ${order.cancelledAt ? `<br />Annullato il: ${formatDate(order.cancelledAt)}` : ""}
      </div>

      ${(order.status || "nuovo") === "nuovo"
        ? `
          <div class="card-actions">
            <button class="btn-outline" onclick="cancelUserOrder(${Number(order.id)})">
              Annulla ordine
            </button>
          </div>
        `
        : ""
      }
    </article>
  `).join("");
}

function renderNotifications() {
  if (!notificationList) return;

  updateNotificationBadge(
    notifications.filter((item) => !item.isRead).length
  );

  if (!notifications.length) {
    notificationList.innerHTML = `<div class="empty-box">Non hai notifiche.</div>`;
    return;
  }

  notificationList.innerHTML = notifications.map((notification) => `
    <article class="notification-card ${notification.isRead ? "" : "unread"}">
      <strong>${escapeHtml(notification.title || "Notifica")}</strong>
      <div class="notification-meta">
        ${escapeHtml(notification.message || "")}<br />
        Data: ${formatDate(notification.createdAt)}
      </div>

      <div class="card-actions">
        ${
          notification.link
            ? `<button class="btn-secondary" onclick="openNotification('${escapeHtml(notification.id)}', '${escapeHtml(notification.link)}')">Apri</button>`
            : ""
        }

        ${
          notification.isRead
            ? ""
            : `<button class="btn-outline" onclick="markNotificationAsRead('${escapeHtml(notification.id)}')">Segna come letta</button>`
        }

        <button class="btn-outline" onclick="deleteNotification('${escapeHtml(notification.id)}')">
          Elimina
        </button>
      </div>
    </article>
  `).join("");
}

async function loadMe() {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "include"
    });
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
    const response = await fetch("/api/auth/orders", {
      credentials: "include"
    });
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

async function loadNotifications() {
  try {
    const response = await fetch("/api/notifications", {
      credentials: "include"
    });
    const data = await response.json();

    if (!response.ok) {
      renderNotifications([]);
      return;
    }

    notifications = Array.isArray(data.notifications) ? data.notifications : [];
    renderNotifications();

    if (typeof data.unreadCount !== "undefined") {
      updateNotificationBadge(data.unreadCount);
    }
  } catch (error) {
    console.error("Errore caricamento notifiche account:", error);
    if (notificationList) {
      notificationList.innerHTML = `<div class="empty-box">Errore nel caricamento notifiche.</div>`;
    }
  }
}

async function markNotificationAsRead(notificationId) {
  try {
    const response = await fetch(`/api/notifications/${notificationId}/read`, {
      method: "POST",
      credentials: "include"
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Impossibile segnare la notifica come letta.");
      return;
    }

    await loadNotifications();
  } catch (error) {
    console.error("Errore lettura notifica:", error);
    alert("Errore di connessione al server.");
  }
}

async function markAllNotificationsAsRead() {
  try {
    const response = await fetch("/api/notifications/read-all", {
      method: "POST",
      credentials: "include"
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Impossibile aggiornare le notifiche.");
      return;
    }

    await loadNotifications();
  } catch (error) {
    console.error("Errore lettura notifiche:", error);
    alert("Errore di connessione al server.");
  }
}

async function deleteNotification(notificationId) {
  try {
    const response = await fetch(`/api/notifications/${notificationId}`, {
      method: "DELETE",
      credentials: "include"
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Impossibile eliminare la notifica.");
      return;
    }

    await loadNotifications();
  } catch (error) {
    console.error("Errore eliminazione notifica:", error);
    alert("Errore di connessione al server.");
  }
}

async function openNotification(notificationId, link) {
  await markNotificationAsRead(notificationId);

  if (link) {
    window.location.href = link;
  }
}

async function cancelUserOrder(orderId) {
  const confirmed = window.confirm(
    "Vuoi davvero annullare questo ordine? Puoi farlo solo finché è in stato nuovo."
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`/api/auth/orders/${orderId}/cancel`, {
      method: "POST",
      credentials: "include"
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Impossibile annullare l’ordine.");
      return;
    }

    alert("Ordine annullato con successo.");
    await Promise.all([loadOrders(), loadNotifications()]);
  } catch (error) {
    console.error("Errore annullamento ordine:", error);
    alert("Errore di connessione al server.");
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
      credentials: "include",
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
      method: "POST",
      credentials: "include"
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

if (readAllBtn) {
  readAllBtn.addEventListener("click", markAllNotificationsAsRead);
}

window.cancelUserOrder = cancelUserOrder;
window.markNotificationAsRead = markNotificationAsRead;
window.deleteNotification = deleteNotification;
window.openNotification = openNotification;

async function initAccountPage() {
  await Promise.all([loadMe(), loadOrders(), loadNotifications()]);

  if (notificationsPollingId) {
    clearInterval(notificationsPollingId);
  }

  notificationsPollingId = setInterval(loadNotifications, 25000);
}

initAccountPage();