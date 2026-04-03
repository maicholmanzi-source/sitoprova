let cart = JSON.parse(localStorage.getItem("cart")) || [];

const params = new URLSearchParams(window.location.search);
const productId = Number(params.get("id"));

const productDetail = document.getElementById("product-detail");
const productCartCount = document.getElementById("product-cart-count");
const productCartBtn = document.getElementById("product-cart-btn");

let product = null;

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

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  if (productCartCount) {
    productCartCount.textContent = String(count);
  }
}

function showError(message) {
  if (!productDetail) return;

  productDetail.innerHTML = `
    <div class="empty-message">
      ${escapeHtml(message)}
    </div>
  `;
}

function addToCart() {
  if (!product) return;

  const existingItem = cart.find((item) => Number(item.id) === Number(product.id));

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      ...product,
      quantity: 1
    });
  }

  saveCart();
  updateCartCount();
  alert("Prodotto aggiunto al carrello.");
}

function buyNow() {
  addToCart();
  window.location.href = "checkout.html";
}

function renderProduct() {
  if (!productDetail || !product) return;

  document.title = `${product.name} - UrbanVibe`;

  productDetail.innerHTML = `
    <div class="product-detail-card">
      <div class="product-detail-image-box">
        <img
          src="${escapeHtml(product.image)}"
          alt="${escapeHtml(product.name)}"
          class="product-detail-image"
        />
      </div>

      <div class="product-detail-info">
        <span class="product-tag">${escapeHtml(product.category || "Prodotto")}</span>
        <h1>${escapeHtml(product.name)}</h1>
        <p class="product-detail-description">
          ${escapeHtml(product.longDescription || product.description || "")}
        </p>
        <div class="product-detail-price">€ ${formatPrice(product.price)}</div>

        <div class="product-detail-actions">
          <button class="btn-outline big-btn" onclick="addToCart()">
            Aggiungi al carrello
          </button>
          <button class="btn-primary big-btn" onclick="buyNow()">
            Compra ora
          </button>
        </div>
      </div>
    </div>
  `;
}

async function loadProduct() {
  if (!productId) {
    showError("Prodotto non valido.");
    return;
  }

  try {
    const response = await fetch(`/api/products/${productId}`);

    if (!response.ok) {
      showError("Prodotto non trovato.");
      return;
    }

    product = await response.json();
    updateCartCount();
    renderProduct();
  } catch (error) {
    console.error("Errore nel caricamento del prodotto:", error);
    showError("Errore nel caricamento del prodotto.");
  }
}

if (productCartBtn) {
  productCartBtn.addEventListener("click", () => {
    window.location.href = "checkout.html";
  });
}

window.addToCart = addToCart;
window.buyNow = buyNow;

updateCartCount();
loadProduct();