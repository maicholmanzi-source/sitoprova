let products = [];
let orders = [];
let editingProductId = null;

const statProducts = document.getElementById("stat-products");
const statOrders = document.getElementById("stat-orders");
const statNewOrders = document.getElementById("stat-new-orders");
const statRevenue = document.getElementById("stat-revenue");

const productForm = document.getElementById("product-form");
const productIdInput = document.getElementById("product-id");
const productNameInput = document.getElementById("product-name");
const productCategoryInput = document.getElementById("product-category");
const productPriceInput = document.getElementById("product-price");
const productDescriptionInput = document.getElementById("product-description");
const productLongDescriptionInput = document.getElementById("product-long-description");
const productImageFileInput = document.getElementById("product-image-file");
const existingImageInput = document.getElementById("existing-image");

const productSubmitBtn = document.getElementById("product-submit-btn");
const productCancelBtn = document.getElementById("product-cancel-btn");
const productStatus = document.getElementById("product-status");

const imagePreviewBox = document.getElementById("image-preview-box");
const imagePreview = document.getElementById("image-preview");

const productsAdminList = document.getElementById("products-admin-list");
const ordersAdminList = document.getElementById("orders-admin-list");

const logoutBtn = document.getElementById("logout-btn");
const exportOrdersBtn = document.getElementById("export-orders-btn");

const ORDER_STATUSES = [
  "nuovo",
  "in lavorazione",
  "spedito",
  "completato",
  "annullato"
];

function formatPrice(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

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

function showProductStatus(message, type = "success") {
  if (!productStatus) return;

  productStatus.textContent = message;
  productStatus.className = `admin-status ${type}`;
}

function clearProductStatus() {
  if (!productStatus) return;

  productStatus.textContent = "";
  productStatus.className = "admin-status";
}

function updateImagePreview(src = "") {
  if (!imagePreviewBox || !imagePreview) return;

  if (src) {
    imagePreview.src = src;
    imagePreviewBox.style.display = "block";
  } else {
    imagePreview.src = "";
    imagePreviewBox.style.display = "none";
  }
}

function resetProductForm() {
  editingProductId = null;

  if (productForm) {
    productForm.reset();
  }

  if (productIdInput) productIdInput.value = "";
  if (existingImageInput) existingImageInput.value = "";

  if (productSubmitBtn) {
    productSubmitBtn.textContent = "Salva prodotto";
  }

  updateImagePreview("");
  clearProductStatus();
}

function fillProductForm(product) {
  editingProductId = Number(product.id);

  if (productIdInput) productIdInput.value = String(product.id);
  if (productNameInput) productNameInput.value = product.name || "";
  if (productCategoryInput) productCategoryInput.value = product.category || "";
  if (productPriceInput) productPriceInput.value = product.price ?? "";
  if (productDescriptionInput) productDescriptionInput.value = product.description || "";
  if (productLongDescriptionInput) {
    productLongDescriptionInput.value = product.longDescription || "";
  }
  if (existingImageInput) existingImageInput.value = product.image || "";

  if (productSubmitBtn) {
    productSubmitBtn.textContent = "Aggiorna prodotto";
  }

  updateImagePreview(product.image || "");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function adminFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options
  });

  let data = null;
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (response.status === 401) {
    window.location.href = "admin-login.html";
    return { response, data, unauthorized: true };
  }

  return { response, data, unauthorized: false };
}

async function checkAdminSession() {
  try {
    const { response, data } = await adminFetch("/api/admin/session");

    if (!response.ok || !data?.authenticated) {
      window.location.href = "admin-login.html";
    }
  } catch (error) {
    console.error("Errore controllo sessione admin:", error);
    window.location.href = "admin-login.html";
  }
}

function updateStats() {
  if (statProducts) {
    statProducts.textContent = String(products.length);
  }

  if (statOrders) {
    statOrders.textContent = String(orders.length);
  }

  if (statNewOrders) {
    const newOrders = orders.filter((order) => (order.status || "nuovo") === "nuovo");
    statNewOrders.textContent = String(newOrders.length);
  }

  if (statRevenue) {
    const totalRevenue = orders.reduce((sum, order) => {
      return sum + Number(order.total || 0);
    }, 0);

    statRevenue.textContent = formatPrice(totalRevenue);
  }
}

function renderProducts() {
  if (!productsAdminList) return;

  if (!products.length) {
    productsAdminList.innerHTML = `
      <div class="muted-box">Nessun prodotto disponibile.</div>
    `;
    return;
  }

  productsAdminList.innerHTML = products
    .map((product) => {
      return `
        <article class="admin-card">
          <div class="admin-card-head">
            <div>
              <h3>${escapeHtml(product.name)}</h3>
              <div class="admin-meta">
                Categoria: <strong>${escapeHtml(product.category)}</strong><br />
                ID prodotto: ${Number(product.id)}
              </div>
            </div>

            <div class="admin-price">${formatPrice(product.price)}</div>
          </div>

          ${
            product.image
              ? `<img
                  src="${escapeHtml(product.image)}"
                  alt="${escapeHtml(product.name)}"
                  style="width:100%;max-width:180px;height:140px;object-fit:cover;border-radius:14px;margin-bottom:14px;border:1px solid #e5e7eb;"
                />`
              : ""
          }

          <div class="admin-meta">
            ${escapeHtml(product.description || "")}
          </div>

          <div class="admin-card-actions">
            <button class="btn-secondary" onclick="editProduct(${Number(product.id)})">
              Modifica
            </button>
            <button class="btn-outline" onclick="deleteProduct(${Number(product.id)})">
              Elimina
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderOrders() {
  if (!ordersAdminList) return;

  if (!orders.length) {
    ordersAdminList.innerHTML = `
      <div class="muted-box">Nessun ordine ricevuto.</div>
    `;
    return;
  }

  ordersAdminList.innerHTML = orders
    .map((order) => {
      const itemsHtml = (order.items || [])
        .map((item) => {
          return `
            <div class="order-item-row">
              <span>${escapeHtml(item.name)} x ${Number(item.quantity || 0)}</span>
              <strong>${formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</strong>
            </div>
          `;
        })
        .join("");

      return `
        <article class="admin-card">
          <div class="admin-card-head">
            <div>
              <h3>Ordine #${Number(order.id)}</h3>
              <div class="admin-meta">
                Data: ${formatDate(order.createdAt)}<br />
                Cliente: <strong>${escapeHtml(order.customer?.name || "-")}</strong><br />
                Email: ${escapeHtml(order.customer?.email || "-")}<br />
                Città: ${escapeHtml(order.customer?.city || "-")}<br />
                Indirizzo: ${escapeHtml(order.customer?.address || "-")}
              </div>
            </div>

            <div>
              <span class="status-badge">${escapeHtml(order.status || "nuovo")}</span>
            </div>
          </div>

          ${
            order.customer?.notes
              ? `<div class="admin-meta" style="margin-bottom:12px;"><strong>Note:</strong> ${escapeHtml(order.customer.notes)}</div>`
              : ""
          }

          ${
            order.shippingNote
              ? `<div class="admin-meta" style="margin-bottom:12px;"><strong>Nota spedizione:</strong> ${escapeHtml(order.shippingNote)}</div>`
              : ""
          }

          ${
            order.cancelledAt
              ? `<div class="admin-meta" style="margin-bottom:12px;"><strong>Data annullamento:</strong> ${formatDate(order.cancelledAt)}</div>`
              : ""
          }

          <div class="order-items">
            ${itemsHtml}
          </div>

          <div class="order-footer">
            <div class="admin-meta">
              Subtotale: <strong>${formatPrice(order.subtotal || 0)}</strong><br />
              Sconto: <strong>${formatPrice(order.discount || 0)}</strong><br />
              Totale: <strong>${formatPrice(order.total || 0)}</strong><br />
              Coupon: <strong>${escapeHtml(order.coupon?.code || "-")}</strong><br />
              Pagamento: <strong>${escapeHtml(order.payment?.method || "-")}</strong><br />
              ${
                order.ageVerification?.verifiedAge
                  ? `Età verificata: <strong>${escapeHtml(order.ageVerification.verifiedAge)}</strong><br />`
                  : ""
              }
            </div>

            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <button
                class="btn-outline"
                onclick="downloadInvoice(${Number(order.id)})"
              >
                Scarica fattura TXT
              </button>

              <select
                class="inline-select"
                onchange="updateOrderStatus(${Number(order.id)}, this.value)"
              >
                ${ORDER_STATUSES.map((status) => {
                  const selected = (order.status || "nuovo") === status ? "selected" : "";
                  return `<option value="${status}" ${selected}>${status}</option>`;
                }).join("")}
              </select>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadProducts() {
  try {
    const response = await fetch("/api/products", {
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error("Errore caricamento prodotti");
    }

    const data = await response.json();
    products = Array.isArray(data) ? data : [];
    renderProducts();
    updateStats();
  } catch (error) {
    console.error(error);
    if (productsAdminList) {
      productsAdminList.innerHTML = `<div class="muted-box">Errore nel caricamento prodotti.</div>`;
    }
  }
}

async function loadOrders() {
  try {
    const { response, data, unauthorized } = await adminFetch("/api/admin/orders");

    if (unauthorized) return;

    if (!response.ok) {
      throw new Error(data?.message || "Errore caricamento ordini");
    }

    orders = Array.isArray(data) ? data : [];
    renderOrders();
    updateStats();
  } catch (error) {
    console.error(error);
    if (ordersAdminList) {
      ordersAdminList.innerHTML = `<div class="muted-box">Errore nel caricamento ordini.</div>`;
    }
  }
}

async function handleProductSubmit(event) {
  event.preventDefault();
  clearProductStatus();

  const formData = new FormData();
  formData.append("name", productNameInput?.value.trim() || "");
  formData.append("category", productCategoryInput?.value.trim() || "");
  formData.append("price", productPriceInput?.value.trim() || "");
  formData.append("description", productDescriptionInput?.value.trim() || "");
  formData.append("longDescription", productLongDescriptionInput?.value.trim() || "");
  formData.append("existingImage", existingImageInput?.value || "");

  const file = productImageFileInput?.files?.[0];
  if (file) {
    formData.append("imageFile", file);
  }

  const isEditing = Boolean(editingProductId);
  const url = isEditing
    ? `/api/admin/products/${editingProductId}`
    : "/api/admin/products";

  const method = isEditing ? "PUT" : "POST";

  try {
    if (productSubmitBtn) {
      productSubmitBtn.disabled = true;
      productSubmitBtn.textContent = isEditing ? "Aggiornamento..." : "Salvataggio...";
    }

    const { response, data, unauthorized } = await adminFetch(url, {
      method,
      body: formData
    });

    if (unauthorized) return;

    if (!response.ok) {
      showProductStatus(data?.message || "Operazione non riuscita.", "error");
      return;
    }

    showProductStatus(
      isEditing ? "Prodotto aggiornato con successo." : "Prodotto creato con successo.",
      "success"
    );

    resetProductForm();
    await loadProducts();
  } catch (error) {
    console.error(error);
    showProductStatus("Errore di connessione al server.", "error");
  } finally {
    if (productSubmitBtn) {
      productSubmitBtn.disabled = false;
      productSubmitBtn.textContent = editingProductId ? "Aggiorna prodotto" : "Salva prodotto";
    }
  }
}

function editProduct(productId) {
  const product = products.find((item) => Number(item.id) === Number(productId));
  if (!product) return;

  fillProductForm(product);
}

async function deleteProduct(productId) {
  const confirmed = window.confirm("Vuoi davvero eliminare questo prodotto?");
  if (!confirmed) return;

  try {
    const { response, data, unauthorized } = await adminFetch(`/api/admin/products/${productId}`, {
      method: "DELETE"
    });

    if (unauthorized) return;

    if (!response.ok) {
      alert(data?.message || "Errore eliminazione prodotto.");
      return;
    }

    if (editingProductId === Number(productId)) {
      resetProductForm();
    }

    await loadProducts();
    alert("Prodotto eliminato con successo.");
  } catch (error) {
    console.error(error);
    alert("Errore di connessione al server.");
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    const { response, data, unauthorized } = await adminFetch(`/api/admin/orders/${orderId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    if (unauthorized) return;

    if (!response.ok) {
      alert(data?.message || "Errore aggiornamento stato ordine.");
      await loadOrders();
      return;
    }

    await loadOrders();
  } catch (error) {
    console.error(error);
    alert("Errore di connessione al server.");
  }
}

function downloadInvoice(orderId) {
  window.location.href = `/api/admin/orders/${orderId}/invoice`;
}

async function handleLogout() {
  try {
    const { response } = await adminFetch("/api/admin/logout", {
      method: "POST"
    });

    if (response.ok) {
      window.location.href = "admin-login.html";
    }
  } catch (error) {
    console.error(error);
    alert("Errore durante il logout.");
  }
}

function handleExportOrders() {
  window.location.href = "/api/admin/orders/export/csv";
}

if (productImageFileInput) {
  productImageFileInput.addEventListener("change", () => {
    const file = productImageFileInput.files?.[0];

    if (!file) {
      updateImagePreview(existingImageInput?.value || "");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => updateImagePreview(reader.result);
    reader.readAsDataURL(file);
  });
}

if (productForm) {
  productForm.addEventListener("submit", handleProductSubmit);
}

if (productCancelBtn) {
  productCancelBtn.addEventListener("click", resetProductForm);
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", handleLogout);
}

if (exportOrdersBtn) {
  exportOrdersBtn.addEventListener("click", handleExportOrders);
}

window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.updateOrderStatus = updateOrderStatus;
window.downloadInvoice = downloadInvoice;

async function initAdminDashboard() {
  await checkAdminSession();
  resetProductForm();
  await Promise.all([loadProducts(), loadOrders()]);
}

initAdminDashboard();