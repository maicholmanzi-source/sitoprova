const cart = JSON.parse(localStorage.getItem("cart")) || [];

const summary = document.getElementById("order-summary");
const subtotalEl = document.getElementById("order-subtotal");
const discountEl = document.getElementById("order-discount");
const totalEl = document.getElementById("order-total");
const form = document.getElementById("checkout-form");

const couponCodeInput = document.getElementById("coupon-code");
const applyCouponBtn = document.getElementById("apply-coupon-btn");
const couponMessage = document.getElementById("coupon-message");

const paymentMethodRadios = document.querySelectorAll('input[name="payment-method"]');
const cardPaymentFields = document.getElementById("card-payment-fields");
const cardNameInput = document.getElementById("card-name");
const cardNumberInput = document.getElementById("card-number");
const cardExpiryInput = document.getElementById("card-expiry");
const cardCvvInput = document.getElementById("card-cvv");

let appliedCoupon = null;
let discountAmount = 0;
let finalTotal = 0;

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

function getSubtotal() {
  return cart.reduce((sum, item) => {
    return sum + Number(item.price || 0) * Number(item.quantity || 0);
  }, 0);
}

function updateTotals() {
  const subtotal = getSubtotal();

  if (!appliedCoupon) {
    discountAmount = 0;
    finalTotal = subtotal;
  }

  if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
  if (discountEl) discountEl.textContent = formatPrice(discountAmount);
  if (totalEl) totalEl.textContent = formatPrice(finalTotal);
}

function clearCouponMessage() {
  if (!couponMessage) return;
  couponMessage.textContent = "";
  couponMessage.style.color = "";
}

function showCouponMessage(message, type = "success") {
  if (!couponMessage) return;
  couponMessage.textContent = message;
  couponMessage.style.color = type === "error" ? "#b91c1c" : "#15803d";
}

function resetCouponState(clearMessage = false) {
  appliedCoupon = null;
  discountAmount = 0;
  finalTotal = getSubtotal();

  if (clearMessage) {
    clearCouponMessage();
  }

  updateTotals();
}

function renderSummary() {
  if (!summary) return;

  summary.innerHTML = "";

  if (!cart.length) {
    summary.innerHTML = `<p class="empty-message">Il carrello è vuoto.</p>`;

    if (subtotalEl) subtotalEl.textContent = "0.00";
    if (discountEl) discountEl.textContent = "0.00";
    if (totalEl) totalEl.textContent = "0.00";
    return;
  }

  cart.forEach((item) => {
    const row = document.createElement("div");
    row.className = "order-item";

    row.innerHTML = `
      <div>
        <div class="order-item-name">${escapeHtml(item.name)}</div>
        <div class="order-item-meta">Quantità: ${Number(item.quantity || 0)}</div>
      </div>
      <div class="order-item-price">€ ${formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</div>
    `;

    summary.appendChild(row);
  });

  updateTotals();
}

async function applyCoupon() {
  const code = couponCodeInput?.value.trim() || "";
  const subtotal = getSubtotal();

  if (!cart.length) {
    showCouponMessage("Il carrello è vuoto.", "error");
    return;
  }

  if (!code) {
    resetCouponState(true);
    showCouponMessage("Inserisci un codice coupon.", "error");
    return;
  }

  try {
    const response = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code,
        subtotal
      })
    });

    const data = await response.json();

    if (!response.ok) {
      resetCouponState(false);
      showCouponMessage(data.message || "Coupon non valido.", "error");
      return;
    }

    appliedCoupon = data.coupon || null;
    discountAmount = Number(data.discount || 0);
    finalTotal = Number(data.finalTotal || subtotal);

    showCouponMessage(
      `Coupon applicato: ${data.coupon?.code || code.toUpperCase()}`,
      "success"
    );

    updateTotals();
  } catch (error) {
    console.error("Errore verifica coupon:", error);
    resetCouponState(false);
    showCouponMessage("Errore nella verifica del coupon.", "error");
  }
}

function getSelectedPaymentMethod() {
  const selected = document.querySelector('input[name="payment-method"]:checked');
  return selected ? selected.value : "card";
}

function getPaymentData() {
  return {
    method: getSelectedPaymentMethod(),
    cardName: cardNameInput?.value.trim() || "",
    cardNumber: cardNumberInput?.value.trim() || "",
    cardExpiry: cardExpiryInput?.value.trim() || "",
    cardCvv: cardCvvInput?.value.trim() || ""
  };
}

function validatePayment(payment) {
  if (payment.method !== "card") {
    return { valid: true };
  }

  if (!cardNameInput || !cardNumberInput || !cardExpiryInput || !cardCvvInput) {
    return {
      valid: false,
      message: "Mancano i campi carta nel checkout."
    };
  }

  if (!payment.cardName || !payment.cardNumber || !payment.cardExpiry || !payment.cardCvv) {
    return {
      valid: false,
      message: "Compila tutti i campi della carta."
    };
  }

  const cleanCardNumber = payment.cardNumber.replace(/\s+/g, "");

  if (!/^\d{13,19}$/.test(cleanCardNumber)) {
    return {
      valid: false,
      message: "Numero carta non valido."
    };
  }

  if (!/^\d{2}\/\d{2}$/.test(payment.cardExpiry)) {
    return {
      valid: false,
      message: "Scadenza carta non valida. Usa formato MM/AA."
    };
  }

  if (!/^\d{3,4}$/.test(payment.cardCvv)) {
    return {
      valid: false,
      message: "CVV non valido."
    };
  }

  return { valid: true };
}

function togglePaymentFields() {
  if (!cardPaymentFields) return;

  const method = getSelectedPaymentMethod();
  cardPaymentFields.style.display = method === "card" ? "grid" : "none";
}

function getCustomerData() {
  return {
    name: document.getElementById("name")?.value.trim() || "",
    email: document.getElementById("email")?.value.trim() || "",
    address: document.getElementById("address")?.value.trim() || "",
    city: document.getElementById("city")?.value.trim() || "",
    notes: document.getElementById("notes")?.value.trim() || ""
  };
}

function isValidCustomer(customer) {
  return Boolean(
    customer.name &&
    customer.email &&
    customer.address &&
    customer.city
  );
}

function formatCardNumberInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiryInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function getPaymentLabel(method) {
  const labels = {
    card: "Carta",
    cash: "Pagamento alla consegna",
    bank: "Bonifico"
  };

  return labels[method] || method;
}

async function submitOrder(event) {
  event.preventDefault();

  if (!cart.length) {
    alert("Il carrello è vuoto.");
    return;
  }

  const customer = getCustomerData();

  if (!isValidCustomer(customer)) {
    alert("Compila tutti i campi obbligatori.");
    return;
  }

  const payment = getPaymentData();
  const paymentValidation = validatePayment(payment);

  if (!paymentValidation.valid) {
    alert(paymentValidation.message);
    return;
  }

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customer,
        items: cart,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        payment
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Errore durante il salvataggio ordine.");
      return;
    }

    localStorage.setItem(
      "lastOrderSummary",
      JSON.stringify({
        ...data.order,
        paymentLabel: getPaymentLabel(payment.method)
      })
    );

    localStorage.removeItem("cart");
    window.location.href = `order-success.html?id=${data.order.id}`;
  } catch (error) {
    console.error("Errore invio ordine:", error);
    alert("Errore di connessione al server.");
  }
}

if (applyCouponBtn) {
  applyCouponBtn.addEventListener("click", applyCoupon);
}

if (couponCodeInput) {
  couponCodeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyCoupon();
    }
  });

  couponCodeInput.addEventListener("input", () => {
    if (!couponCodeInput.value.trim()) {
      resetCouponState(true);
    }
  });
}

if (cardNumberInput) {
  cardNumberInput.addEventListener("input", () => {
    cardNumberInput.value = formatCardNumberInput(cardNumberInput.value);
  });
}

if (cardExpiryInput) {
  cardExpiryInput.addEventListener("input", () => {
    cardExpiryInput.value = formatExpiryInput(cardExpiryInput.value);
  });
}

if (cardCvvInput) {
  cardCvvInput.addEventListener("input", () => {
    cardCvvInput.value = String(cardCvvInput.value || "")
      .replace(/\D/g, "")
      .slice(0, 4);
  });
}

if (paymentMethodRadios.length) {
  paymentMethodRadios.forEach((radio) => {
    radio.addEventListener("change", togglePaymentFields);
  });
}

if (form) {
  form.addEventListener("submit", submitOrder);
}

togglePaymentFields();
renderSummary();