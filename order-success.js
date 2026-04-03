function formatPrice(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("it-IT", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

const orderMeta = document.getElementById("order-meta");
const orderItems = document.getElementById("order-items");
const subtotalEl = document.getElementById("success-subtotal");
const discountEl = document.getElementById("success-discount");
const totalEl = document.getElementById("success-total");

function renderOrder() {
  const raw = localStorage.getItem("lastOrderSummary");

  if (!raw) {
    if (orderMeta) {
      orderMeta.innerHTML = `
        <div>Nessun ordine recente trovato.</div>
        <div><a href="index.html" class="btn-primary" style="margin-top:12px;">Torna al negozio</a></div>
      `;
    }
    if (orderItems) {
      orderItems.innerHTML = `<div class="empty-message">Nessun prodotto da mostrare.</div>`;
    }
    return;
  }

  const order = JSON.parse(raw);

  if (orderMeta) {
    orderMeta.innerHTML = `
      <div><strong>ID ordine:</strong> ${escapeHtml(order.id)}</div>
      <div><strong>Data:</strong> ${escapeHtml(formatDate(order.createdAt))}</div>
      <div><strong>Cliente:</strong> ${escapeHtml(order.customer?.name || "-")}</div>
      <div><strong>Email:</strong> ${escapeHtml(order.customer?.email || "-")}</div>
      <div><strong>Città:</strong> ${escapeHtml(order.customer?.city || "-")}</div>
      <div><strong>Indirizzo:</strong> ${escapeHtml(order.customer?.address || "-")}</div>
      <div><strong>Pagamento:</strong> ${escapeHtml(order.paymentLabel || order.payment?.method || "-")}</div>
    `;
  }

  if (orderItems) {
    const items = Array.isArray(order.items) ? order.items : [];

    if (!items.length) {
      orderItems.innerHTML = `<div class="empty-message">Nessun prodotto da mostrare.</div>`;
    } else {
      orderItems.innerHTML = items.map((item) => `
        <div class="success-item">
          <div>
            <div class="success-item-name">${escapeHtml(item.name)}</div>
            <div class="success-item-meta">Quantità: ${Number(item.quantity || 0)}</div>
          </div>
          <div class="success-item-price">${formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</div>
        </div>
      `).join("");
    }
  }

  if (subtotalEl) subtotalEl.textContent = formatPrice(order.subtotal || 0);
  if (discountEl) discountEl.textContent = formatPrice(order.discount || 0);
  if (totalEl) totalEl.textContent = formatPrice(order.total || 0);
}

renderOrder();