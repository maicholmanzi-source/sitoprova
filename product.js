const params = new URLSearchParams(window.location.search);
const productId = Number(params.get("id"));

let product = null;
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentUser = null;

const productDetail = document.getElementById("product-detail");

const cartBtn = document.getElementById("product-cart-btn");
const cartCountElement = document.getElementById("product-cart-count");
const cartSidebar = document.getElementById("product-cart-sidebar");
const closeCartBtn = document.getElementById("close-product-cart");
const cartItemsContainer = document.getElementById("product-cart-items");
const cartTotalElement = document.getElementById("product-cart-total");
const clearCartBtn = document.getElementById("clear-product-cart");

const headerAuthArea = document.getElementById("product-header-auth-area");

function formatPrice(value) {
  return Number(value || 0).toFixed(2);
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

function addToCart(productToAdd) {
  if (!productToAdd) return;

  const existing = cart.find((item) => Number(item.id) === Number(productToAdd.id));

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: Number(productToAdd.id),
      name: productToAdd.name,
      price: Number(productToAdd.price || 0),
      image: productToAdd.image || "",
      category: productToAdd.category || "",
      quantity: 1
    });
  }

  saveCart();
  renderCart();
  openCart();
}

function removeFromCart(productIdToRemove) {
  cart = cart.filter((item) => Number(item.id) !== Number(productIdToRemove));
  saveCart();
  renderCart();
}

function setCartItemQuantity(productIdToUpdate, quantity) {
  const item = cart.find((entry) => Number(entry.id) === Number(productIdToUpdate));
  if (!item) return;

  const nextQuantity = Math.max(0, Number(quantity || 0));

  if (nextQuantity <= 0) {
    removeFromCart(productIdToUpdate);
    return;
  }

  item.quantity = nextQuantity;
  saveCart();
  renderCart();
}

function increaseCartQuantity(productIdToUpdate) {
  const item = cart.find((entry) => Number(entry.id) === Number(productIdToUpdate));
  if (!item) return;

  setCartItemQuantity(productIdToUpdate, Number(item.quantity || 0) + 1);
}

function decreaseCartQuantity(productIdToUpdate) {
  const item = cart.find((entry) => Number(entry.id) === Number(productIdToUpdate));
  if (!item) return;

  setCartItemQuantity(productIdToUpdate, Number(item.quantity || 0) - 1);
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

function renderProduct() {
  if (!productDetail) return;

  if (!product) {
    productDetail.innerHTML = `
      <div class="empty-message">
        Prodotto non trovato.
      </div>
    `;
    return;
  }

  const imageHtml = product.image
    ? `<img class="product-detail-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />`
    : `<div class="product-detail-image-fallback">🛍️</div>`;

  const longDescription = product.longDescription || product.description || "";

  productDetail.innerHTML = `
    <article class="product-detail-card">
      <div class="product-detail-image-box">
        ${imageHtml}
      </div>

      <div class="product-detail-info">
        <span class="product-tag">${escapeHtml(product.category || "Generale")}</span>
        <h1>${escapeHtml(product.name)}</h1>
        <p class="product-detail-description">${escapeHtml(longDescription)}</p>
        <div class="product-detail-price">€ ${formatPrice(product.price)}</div>

        <div class="product-detail-actions">
          <button id="add-product-to-cart-btn" class="btn-primary big-btn">
            Aggiungi al carrello
          </button>
          <a href="checkout.html" class="btn-outline big-btn">Vai al checkout</a>
        </div>
      </div>
    </article>
  `;

  const addBtn = document.getElementById("add-product-to-cart-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => addToCart(product));
  }

  document.title = `${product.name} - UrbanVibe`;
}

async function loadProduct() {
  if (!productId) {
    renderProduct();
    return;
  }

  try {
    const response = await fetch(`/api/products/${productId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Prodotto non trovato");
    }

    product = data;
    renderProduct();
  } catch (error) {
    console.error("Errore caricamento prodotto:", error);
    product = null;
    renderProduct();
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
  } catch (error) {
    console.error("Errore controllo sessione utente:", error);
    currentUser = null;
    renderHeaderAuth();
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
    <button id="product-header-logout-btn" class="header-link-btn">Logout</button>
  `;

  const logoutBtn = document.getElementById("product-header-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleUserLogout);
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
    renderHeaderAuth();
    window.location.href = "index.html";
  } catch (error) {
    console.error("Errore logout utente:", error);
    alert("Errore durante il logout.");
  }
}

if (cartBtn) {
  cartBtn.addEventListener("click", openCart);
}

if (closeCartBtn) {
  closeCartBtn.addEventListener("click", closeCart);
}

if (clearCartBtn) {
  clearCartBtn.addEventListener("click", clearCart);
}

window.removeFromCart = removeFromCart;
window.setCartItemQuantity = setCartItemQuantity;
window.increaseCartQuantity = increaseCartQuantity;
window.decreaseCartQuantity = decreaseCartQuantity;

renderCart();
loadProduct();
loadAuthState();