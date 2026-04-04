let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentUser = null;

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

const ageCheckWrapper = document.getElementById("age-check-wrapper");
const birthDateInput = document.getElementById("birth-date");
const ageConfirmCheckbox = document.getElementById("age-confirm-checkbox");
const ageCheckMessage = document.getElementById("age-check-message");
const submitOrderBtn = form?.querySelector('button[type="submit"]');

const shippingLegalNoteBox = document.getElementById("shipping-legal-note-box");
const shippingLegalNoteText = document.getElementById("shipping-legal-note-text");

const nameField = document.getElementById("name");
const emailField = document.getElementById("email");
const addressField = document.getElementById("address");
const cityField = document.getElementById("city");
const notesField = document.getElementById("notes");

const headerAuthArea = document.getElementById("checkout-header-auth-area");

const AGE_RESTRICTED_CATEGORIES = ["vino", "alcol", "alcolici"];
const SHIPPING_LEGAL_NOTE =
  "Consegnare solo a maggiorenni previa verifica della maggiore età.";

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

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
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

function removeFromCart(productId) {
  cart = cart.filter((item) => Number(item.id) !== Number(productId));
  saveCart();
  resetCouponState(true);
  renderSummary();
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
  resetCouponState(true);
  renderSummary();
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

function cartRequiresAgeVerification() {
  return cart.some((item) =>
    AGE_RESTRICTED_CATEGORIES.includes(String(item.category || "").toLowerCase())
  );
}

function updateSensitiveShippingNoteUI() {
  const required = cartRequiresAgeVerification();

  if (!shippingLegalNoteBox || !shippingLegalNoteText) return;

  if (required) {
    shippingLegalNoteBox.style.display = "block";
    shippingLegalNoteText.textContent = SHIPPING_LEGAL_NOTE;
  } else {
    shippingLegalNoteBox.style.display = "none";
    shippingLegalNoteText.textContent = "";
  }
}

function renderSummary() {
  if (!summary) return;

  summary.innerHTML = "";

  if (!cart.length) {
    summary.innerHTML = `<p class="empty-message">Il carrello è vuoto.</p>`;

    if (subtotalEl) subtotalEl.textContent = "0.00";
    if (discountEl) discountEl.textContent = "0.00";
    if (totalEl) totalEl.textContent = "0.00";

    updateAgeCheckVisibility();
    return;
  }

  cart.forEach((item) => {
    const row = document.createElement("div");
    row.className = "order-item";

    row.innerHTML = `
      <div>
        <div class="order-item-name">${escapeHtml(item.name)}</div>
        <div class="order-item-meta">Categoria: ${escapeHtml(item.category || "-")}</div>

        <div class="order-quantity-controls" aria-label="Quantità ${escapeHtml(item.name)}">
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
      </div>

      <div class="order-item-side">
        <div class="order-item-price">€ ${formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</div>
        <button type="button" class="btn-outline order-item-remove" onclick="removeFromCart(${Number(item.id)})">
          Rimuovi
        </button>
      </div>
    `;

    summary.appendChild(row);
  });

  updateTotals();
  updateAgeCheckVisibility();
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

function calculateAge(birthDateValue) {
  if (!birthDateValue) return 0;

  const today = new Date();
  const birthDate = new Date(`${birthDateValue}T00:00:00`);

  if (Number.isNaN(birthDate.getTime())) return 0;

  let age = today.getFullYear() - birthDate.getFullYear();

  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
}

function getAgeVerificationData() {
  const birthDate = birthDateInput?.value || "";
  const confirmedMajority = Boolean(ageConfirmCheckbox?.checked);
  const age = calculateAge(birthDate);

  return {
    birthDate,
    confirmedMajority,
    age
  };
}

function validateAgeVerification(ageVerification) {
  if (!ageVerification.birthDate) {
    return {
      valid: false,
      message: "Inserisci la data di nascita."
    };
  }

  if (ageVerification.age < 18) {
    return {
      valid: false,
      message: "Devi essere maggiorenne per confermare l’ordine."
    };
  }

  if (!ageVerification.confirmedMajority) {
    return {
      valid: false,
      message: "Devi confermare di essere maggiorenne."
    };
  }

  return {
    valid: true,
    message: "Verifica età completata."
  };
}

function updateAgeVerificationUI() {
  const required = cartRequiresAgeVerification();

  if (!required) {
    if (ageCheckMessage) {
      ageCheckMessage.textContent = "";
      ageCheckMessage.style.color = "";
    }

    if (submitOrderBtn) {
      submitOrderBtn.disabled = false;
      submitOrderBtn.style.opacity = "1";
      submitOrderBtn.style.cursor = "pointer";
    }

    return;
  }

  const ageVerification = getAgeVerificationData();
  const validation = validateAgeVerification(ageVerification);

  if (ageCheckMessage) {
    ageCheckMessage.textContent = validation.message;
    ageCheckMessage.style.color = validation.valid ? "#15803d" : "#b91c1c";
  }

  if (submitOrderBtn) {
    submitOrderBtn.disabled = !validation.valid;
    submitOrderBtn.style.opacity = validation.valid ? "1" : "0.6";
    submitOrderBtn.style.cursor = validation.valid ? "pointer" : "not-allowed";
  }
}

function updateAgeCheckVisibility() {
  const required = cartRequiresAgeVerification();

  if (ageCheckWrapper) {
    ageCheckWrapper.style.display = required ? "block" : "none";
  }

  updateSensitiveShippingNoteUI();
  updateAgeVerificationUI();
}

function getCustomerData() {
  return {
    name: nameField?.value.trim() || "",
    email: emailField?.value.trim() || "",
    address: addressField?.value.trim() || "",
    city: cityField?.value.trim() || "",
    notes: notesField?.value.trim() || ""
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

async function prefillCheckoutFromAccount() {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "include"
    });
    const data = await response.json();

    if (!data.authenticated || !data.user) return;

    const user = data.user;

    if (nameField && !nameField.value) nameField.value = user.name || "";
    if (emailField && !emailField.value) emailField.value = user.email || "";
    if (addressField && !addressField.value) addressField.value = user.address || "";
    if (cityField && !cityField.value) cityField.value = user.city || "";
  } catch (error) {
    console.error("Errore prefill checkout:", error);
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
    <button id="checkout-header-logout-btn" class="header-link-btn">Logout</button>
  `;

  const logoutBtn = document.getElementById("checkout-header-logout-btn");
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

  const requiresAgeVerification = cartRequiresAgeVerification();

  if (requiresAgeVerification) {
    const ageVerification = getAgeVerificationData();
    const ageValidation = validateAgeVerification(ageVerification);

    if (!ageValidation.valid) {
      alert(ageValidation.message);
      return;
    }
  }

  const payload = {
    customer,
    items: cart,
    couponCode: appliedCoupon ? appliedCoupon.code : null,
    payment
  };

  if (requiresAgeVerification) {
    payload.ageVerification = getAgeVerificationData();
    payload.shippingNote = SHIPPING_LEGAL_NOTE;
  }

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(payload)
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

if (birthDateInput) {
  birthDateInput.addEventListener("change", updateAgeVerificationUI);
  birthDateInput.addEventListener("input", updateAgeVerificationUI);
}

if (ageConfirmCheckbox) {
  ageConfirmCheckbox.addEventListener("change", updateAgeVerificationUI);
}

if (form) {
  form.addEventListener("submit", submitOrder);
}

window.removeFromCart = removeFromCart;
window.setCartItemQuantity = setCartItemQuantity;
window.increaseCartQuantity = increaseCartQuantity;
window.decreaseCartQuantity = decreaseCartQuantity;

togglePaymentFields();
renderSummary();
updateAgeCheckVisibility();
prefillCheckoutFromAccount();
loadAuthState();