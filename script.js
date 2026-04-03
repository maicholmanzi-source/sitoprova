let products = [];
let filteredProducts = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentUser = null;

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
    <button id="header-logout-btn" class="header-link-btn">Logout</button>
  `;

  const logoutBtn = document.getElementById("header-logout-btn");
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

window.addToCart = addToCart;
window.removeFromCart = removeFromCart;

renderCart();
loadProducts();
loadAuthState();