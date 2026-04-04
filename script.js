let products = [];
let filteredProducts = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentUser = null;
let notifications = [];
let notificationsPollingId = null;

const productList = document.getElementById("product-list");
const cartBtn = document.getElementById("cart-btn");
const navCartLink = document.getElementById("nav-cart-link");
const cartSidebar = document.getElementById("cart-sidebar");
const closeCartBtn = document.getElementById("close-cart");
const cartItemsContainer = document.getElementById("cart-items");
const cartTotalElement = document.getElementById("cart-total");
const cartCountElement = document.getElementById("cart-count");
const clearCartBtn = document.getElementById("clear-cart");

const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const sortFilter = document.getElementById("sort-filter");
const headerAuthArea = document.getElementById("header-auth-area");

const homeNotificationPill = document.getElementById("home-notification-pill");
const homeNotificationBadge = document.getElementById("home-notification-badge");
const homeNotificationsBox = document.getElementById("home-notifications-box");
const homeNotificationList = document.getElementById("home-notification-list");
const homeReadAllBtn = document.getElementById("home-read-all-btn");

function formatPrice(value) {
  return Number(value || 0).toFixed(2);
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

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function getCartCount() {
  return cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function getCartTotal() {
  return cart.reduce((sum, item) => {
    return sum + Number(item.price || 0) * Number(item.quantity || 0);
  }, 0);
}

function updateCartBadge() {
  if (cartCountElement) {
    cartCountElement.textContent = String(getCartCount());
  }
}

function openCart() {
  if (cartSidebar) {
    cartSidebar.classList.remove("hidden");
  }
}

function closeCart() {
  if (cartSidebar) {
    cartSidebar.classList.add("hidden");
  }
}

function addToCart(productId) {
  const product = products.find((item) => Number(item.id) === Number(productId));
  if (!product) return;

  const existing = cart.find((item) => Number(item.id) === Number(productId));

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: Number(product.id),
      name: product.name,
      price: Number(product.price || 0),
      image: product.image || "",
      category: product.category || "",
      quantity: 1
    });
  }

  saveCart();
  renderCart();
  openCart();
}

function removeFromCart(productId) {
  cart = cart.filter((item) => Number(item.id) !== Number(productId));
  saveCart();
  renderCart();
}

function setCartItemQuantity(productId, quantity) {
  const item = cart.find((entry) => Number(entry.id) === Number(productId));
  if (!item) return;

  const nextQuantity = Math.max(0, Number(quantity || 0));

  if (nextQuantity <= 0) {
    removeFromCart(productId);
    return;
  }

  item.quantity = nextQuantity;
  saveCart();
  renderCart();
}

function increaseCartQuantity(productId) {
  const item = cart.find((entry) => Number(entry.id) === Number(productId));
  if (!item) return;

  setCartItemQuantity(productId, Number(item.quantity || 0) + 1);
}

function decreaseCartQuantity(productId) {
  const item = cart.find((entry) => Number(entry.id) === Number(productId));
  if (!item) return;

  setCartItemQuantity(productId, Number(item.quantity || 0) - 1);
}

function clearCart() {
  cart = [];
  saveCart();
  renderCart();
}

function renderCart() {
  if (!cartItemsContainer || !cartTotalElement) return;

  updateCartBadge();

  if (!cart.length) {
    cartItemsContainer.innerHTML = `<p class="empty-message">Il carrello è vuoto.</p>`;
    cartTotalElement.textContent = "0.00";
    return;
  }

  cartItemsContainer.innerHTML = cart
    .map((item) => {
      const lineTotal = Number(item.price || 0) * Number(item.quantity || 0);

      return `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-title">${escapeHtml(item.name)}</div>
            <div class="cart-item-meta">
              Quantità: ${Number(item.quantity || 0)}<br />
              Categoria: ${escapeHtml(item.category || "-")}<br />
              Totale: € ${formatPrice(lineTotal)}
            </div>
          </div>

          <div class="cart-item-actions">
            <strong>€ ${formatPrice(lineTotal)}</strong>

            <div class="cart-quantity-controls" aria-label="Quantità ${escapeHtml(item.name)}">
              <button type="button" class="cart-qty-btn" onclick="decreaseCartQuantity(${Number(item.id)})">-</button>
              <input
                type="number"
                min="1"
                inputmode="numeric"
                class="cart-qty-input"
                value="${Number(item.quantity || 0)}"
                aria-label="Quantità ${escapeHtml(item.name)}"
                onchange="setCartItemQuantity(${Number(item.id)}, this.value)"
              />
              <button type="button" class="cart-qty-btn" onclick="increaseCartQuantity(${Number(item.id)})">+</button>
            </div>

            <button class="cart-remove-btn" onclick="removeFromCart(${Number(item.id)})">
              Rimuovi
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  cartTotalElement.textContent = formatPrice(getCartTotal());
}

function populateCategoryFilter(items) {
  if (!categoryFilter) return;

  const uniqueCategories = [
    ...new Set(
      items
        .map((item) => String(item.category || "").trim())
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, "it"));

  categoryFilter.innerHTML = `
    <option value="Tutte">Tutte le categorie</option>
    ${uniqueCategories
      .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join("")}
  `;
}

function applyFilters() {
  const searchTerm = (searchInput?.value || "").trim().toLowerCase();
  const selectedCategory = categoryFilter?.value || "Tutte";
  const selectedSort = sortFilter?.value || "default";

  filteredProducts = products.filter((product) => {
    const name = String(product.name || "").toLowerCase();
    const description = String(product.description || "").toLowerCase();
    const category = String(product.category || "").toLowerCase();

    const matchesSearch =
      !searchTerm ||
      name.includes(searchTerm) ||
      description.includes(searchTerm) ||
      category.includes(searchTerm);

    const matchesCategory =
      selectedCategory === "Tutte" ||
      String(product.category || "") === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  if (selectedSort === "price-asc") {
    filteredProducts.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  }

  if (selectedSort === "price-desc") {
    filteredProducts.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  }

  if (selectedSort === "name-asc") {
    filteredProducts.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "it")
    );
  }

  if (selectedSort === "name-desc") {
    filteredProducts.sort((a, b) =>
      String(b.name || "").localeCompare(String(a.name || ""), "it")
    );
  }

  renderProducts();
}

function renderProducts() {
  if (!productList) return;

  if (!filteredProducts.length) {
    productList.innerHTML = `
      <div class="empty-message">
        Nessun prodotto trovato con i filtri selezionati.
      </div>
    `;
    return;
  }

  productList.innerHTML = filteredProducts
    .map((product) => {
      const imageHtml = product.image
        ? `<img class="product-image-real" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />`
        : `<div class="product-image-fallback">🛍️</div>`;

      return `
        <article class="product-card">
          <div class="product-image">
            ${imageHtml}
          </div>

          <div class="product-info">
            <span class="product-category">${escapeHtml(product.category || "Generale")}</span>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.description || "")}</p>
            <div class="price">€ ${formatPrice(product.price)}</div>

            <div class="product-buttons">
              <a href="product.html?id=${Number(product.id)}" class="btn-outline">Dettagli</a>
              <button class="btn-primary" onclick="addToCart(${Number(product.id)})">
                Aggiungi
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateNotificationBadge(unreadCount) {
  if (!homeNotificationBadge) return;

  const count = Number(unreadCount || 0);
  homeNotificationBadge.textContent = String(count);
  homeNotificationBadge.style.display = count > 0 ? "inline-flex" : "none";
}

function renderNotifications() {
  if (!homeNotificationList) return;

  updateNotificationBadge(
    notifications.filter((item) => !item.isRead).length
  );

  if (!notifications.length) {
    homeNotificationList.innerHTML = `<div class="empty-message">Non hai notifiche.</div>`;
    return;
  }

  homeNotificationList.innerHTML = notifications.map((notification) => `
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

function updateNotificationVisibility() {
  const isLoggedIn = Boolean(currentUser);

  if (homeNotificationPill) {
    homeNotificationPill.style.display = isLoggedIn ? "inline-flex" : "none";
  }

  if (homeNotificationsBox) {
    homeNotificationsBox.style.display = isLoggedIn ? "block" : "none";
  }
}

async function loadProducts() {
  try {
    const response = await fetch("/api/products");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Errore nel caricamento prodotti");
    }

    products = Array.isArray(data) ? data : [];
    populateCategoryFilter(products);
    filteredProducts = [...products];
    applyFilters();
  } catch (error) {
    console.error("Errore caricamento prodotti:", error);

    if (productList) {
      productList.innerHTML = `
        <div class="empty-message">
          Errore nel caricamento prodotti.
        </div>
      `;
    }
  }
}

async function loadAuthState() {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "include"
    });

    const data = await response.json();
    currentUser = data?.authenticated ? data.user : null;
    renderHeaderAuth();
    updateNotificationVisibility();

    if (currentUser) {
      await loadNotifications();
    } else {
      notifications = [];
      renderNotifications();
    }
  } catch (error) {
    console.error("Errore controllo sessione utente:", error);
    currentUser = null;
    renderHeaderAuth();
    updateNotificationVisibility();
  }
}

function renderHeaderAuth() {
  if (!headerAuthArea) return;

  if (!currentUser) {
    headerAuthArea.innerHTML = `
      <a href="login.html" class="header-link-btn">Accedi</a>
      <a href="register.html" class="header-link-btn primary">Registrati</a>
    `;
    return;
  }

  headerAuthArea.innerHTML = `
    <span class="header-user-greeting">Ciao, ${escapeHtml(currentUser.name || "Utente")}</span>
    <a href="account.html" class="header-link-btn">Account</a>
    <button id="header-logout-btn" class="header-link-btn">Logout</button>
  `;

  const logoutBtn = document.getElementById("header-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleUserLogout);
  }
}

async function loadNotifications() {
  if (!currentUser) return;

  try {
    const response = await fetch("/api/notifications", {
      credentials: "include"
    });

    const data = await response.json();

    if (!response.ok) {
      notifications = [];
      renderNotifications();
      return;
    }

    notifications = Array.isArray(data.notifications) ? data.notifications : [];
    renderNotifications();

    if (typeof data.unreadCount !== "undefined") {
      updateNotificationBadge(data.unreadCount);
    }
  } catch (error) {
    console.error("Errore caricamento notifiche home:", error);
    if (homeNotificationList) {
      homeNotificationList.innerHTML = `<div class="empty-message">Errore nel caricamento notifiche.</div>`;
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

async function handleUserLogout() {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error("Logout non riuscito");
    }

    currentUser = null;
    notifications = [];
    renderHeaderAuth();
    updateNotificationVisibility();
    renderNotifications();

    if (notificationsPollingId) {
      clearInterval(notificationsPollingId);
      notificationsPollingId = null;
    }

    window.location.href = "index.html";
  } catch (error) {
    console.error("Errore logout utente:", error);
    alert("Errore durante il logout.");
  }
}

if (cartBtn) {
  cartBtn.addEventListener("click", openCart);
}

if (navCartLink) {
  navCartLink.addEventListener("click", (event) => {
    event.preventDefault();
    openCart();
  });
}

if (closeCartBtn) {
  closeCartBtn.addEventListener("click", closeCart);
}

if (clearCartBtn) {
  clearCartBtn.addEventListener("click", clearCart);
}

if (searchInput) {
  searchInput.addEventListener("input", applyFilters);
}

if (categoryFilter) {
  categoryFilter.addEventListener("change", applyFilters);
}

if (sortFilter) {
  sortFilter.addEventListener("change", applyFilters);
}

if (homeReadAllBtn) {
  homeReadAllBtn.addEventListener("click", markAllNotificationsAsRead);
}

window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.setCartItemQuantity = setCartItemQuantity;
window.increaseCartQuantity = increaseCartQuantity;
window.decreaseCartQuantity = decreaseCartQuantity;
window.markNotificationAsRead = markNotificationAsRead;
window.deleteNotification = deleteNotification;
window.openNotification = openNotification;

async function initHomePage() {
  renderCart();
  await loadProducts();
  await loadAuthState();

  if (notificationsPollingId) {
    clearInterval(notificationsPollingId);
  }

  notificationsPollingId = setInterval(() => {
    if (currentUser) {
      loadNotifications();
    }
  }, 25000);
}

initHomePage();