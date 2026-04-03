let cart = JSON.parse(localStorage.getItem("cart")) || [];
let products = [];

const productList = document.getElementById("product-list");
const cartItems = document.getElementById("cart-items");
const cartCount = document.getElementById("cart-count");
const cartTotal = document.getElementById("cart-total");
const cartSidebar = document.getElementById("cart-sidebar");
const cartBtn = document.getElementById("cart-btn");
const closeCart = document.getElementById("close-cart");
const clearCart = document.getElementById("clear-cart");
const navCartLink = document.getElementById("nav-cart-link");

const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const sortFilter = document.getElementById("sort-filter");

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

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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

function openCart() {
  if (cartSidebar) {
    cartSidebar.classList.remove("hidden");
  }
}

function hideCart() {
  if (cartSidebar) {
    cartSidebar.classList.add("hidden");
  }
}

async function loadProducts() {
  try {
    const response = await fetch("/api/products");

    if (!response.ok) {
      throw new Error("Errore nel caricamento prodotti");
    }

    const data = await response.json();
    products = Array.isArray(data) ? data : [];

    populateCategories();
    renderProducts(getFilteredProducts());
    renderCart();
  } catch (error) {
    console.error(error);

    if (productList) {
      productList.innerHTML = `
        <p class="empty-message">
          Errore nel caricamento dei prodotti. Riprova tra poco.
        </p>
      `;
    }
  }
}

function populateCategories() {
  if (!categoryFilter) return;

  const categories = [...new Set(products.map((product) => product.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "it"));

  categoryFilter.innerHTML = `<option value="Tutte">Tutte le categorie</option>`;

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

function getFilteredProducts() {
  const searchValue = normalizeText(searchInput?.value || "");
  const selectedCategory = categoryFilter?.value || "Tutte";
  const selectedSort = sortFilter?.value || "default";

  let filtered = products.filter((product) => {
    const searchableText = normalizeText(
      `${product.name} ${product.description} ${product.category}`
    );

    const matchesSearch = searchableText.includes(searchValue);
    const matchesCategory =
      selectedCategory === "Tutte" || product.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  if (selectedSort === "price-asc") {
    filtered.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (selectedSort === "price-desc") {
    filtered.sort((a, b) => Number(b.price) - Number(a.price));
  } else if (selectedSort === "name-asc") {
    filtered.sort((a, b) => String(a.name).localeCompare(String(b.name), "it"));
  } else if (selectedSort === "name-desc") {
    filtered.sort((a, b) => String(b.name).localeCompare(String(a.name), "it"));
  }

  return filtered;
}

function renderProducts(filteredProducts = products) {
  if (!productList) return;

  productList.innerHTML = "";

  if (!filteredProducts.length) {
    productList.innerHTML = `
      <p class="empty-message">
        Nessun prodotto trovato con i filtri selezionati.
      </p>
    `;
    return;
  }

  filteredProducts.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";

    card.innerHTML = `
      <img
        src="${escapeHtml(product.image)}"
        alt="${escapeHtml(product.name)}"
        class="product-image"
      />

      <div class="product-info">
        <span class="product-category">${escapeHtml(product.category)}</span>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description)}</p>
        <div class="price">€ ${formatPrice(product.price)}</div>

        <div class="product-buttons">
          <button class="btn-outline" onclick="viewProduct(${Number(product.id)})">
            Dettagli
          </button>
          <button onclick="addToCart(${Number(product.id)})">
            Aggiungi
          </button>
        </div>
      </div>
    `;

    productList.appendChild(card);
  });
}

function renderCart() {
  if (!cartItems || !cartCount || !cartTotal) return;

  cartItems.innerHTML = "";

  if (!cart.length) {
    cartItems.innerHTML = `<p class="empty-message">Il carrello è vuoto.</p>`;
  } else {
    cart.forEach((item) => {
      const row = document.createElement("div");
      row.className = "cart-item";

      row.innerHTML = `
        <div class="cart-item-info">
          <strong>${escapeHtml(item.name)}</strong>
          <span>€ ${formatPrice(item.price)} x ${Number(item.quantity)}</span>
        </div>

        <div class="cart-actions">
          <button onclick="decreaseQuantity(${Number(item.id)})">-</button>
          <button onclick="increaseQuantity(${Number(item.id)})">+</button>
          <button onclick="removeFromCart(${Number(item.id)})">🗑</button>
        </div>
      `;

      cartItems.appendChild(row);
    });
  }

  cartTotal.textContent = formatPrice(getCartTotal());
  cartCount.textContent = String(getCartCount());
}

function addToCart(productId) {
  const product = products.find((item) => Number(item.id) === Number(productId));
  if (!product) return;

  const existingItem = cart.find((item) => Number(item.id) === Number(productId));

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      ...product,
      quantity: 1
    });
  }

  saveCart();
  renderCart();
  openCart();
}

function increaseQuantity(productId) {
  const item = cart.find((product) => Number(product.id) === Number(productId));
  if (!item) return;

  item.quantity += 1;
  saveCart();
  renderCart();
}

function decreaseQuantity(productId) {
  const item = cart.find((product) => Number(product.id) === Number(productId));
  if (!item) return;

  item.quantity -= 1;

  if (item.quantity <= 0) {
    cart = cart.filter((product) => Number(product.id) !== Number(productId));
  }

  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter((item) => Number(item.id) !== Number(productId));
  saveCart();
  renderCart();
}

function clearEntireCart() {
  cart = [];
  saveCart();
  renderCart();
}

function viewProduct(productId) {
  window.location.href = `product.html?id=${productId}`;
}

function applyFilters() {
  renderProducts(getFilteredProducts());
}

if (cartBtn) {
  cartBtn.addEventListener("click", openCart);
}

if (closeCart) {
  closeCart.addEventListener("click", hideCart);
}

if (clearCart) {
  clearCart.addEventListener("click", clearEntireCart);
}

if (navCartLink) {
  navCartLink.addEventListener("click", (event) => {
    event.preventDefault();
    openCart();
  });
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

window.viewProduct = viewProduct;
window.addToCart = addToCart;
window.increaseQuantity = increaseQuantity;
window.decreaseQuantity = decreaseQuantity;
window.removeFromCart = removeFromCart;

renderCart();
loadProducts();