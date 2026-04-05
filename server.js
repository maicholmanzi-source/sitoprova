const express = require("express");
const path = require("path");
const fs = require("node:fs/promises");
const syncFs = require("node:fs");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const envPath = path.join(__dirname, ".env");

if (syncFs.existsSync(envPath)) {
  const envLines = syncFs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

const rootDir = __dirname;
const storageRoot = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : rootDir;

const productsPath = path.join(storageRoot, "products.json");
const dataDir = path.join(storageRoot, "data");
const ordersPath = path.join(dataDir, "orders.json");
const usersPath = path.join(dataDir, "users.json");
const notificationsPath = path.join(dataDir, "notifications.json");
const imagesDir = path.join(storageRoot, "images");
const uploadDir = path.join(imagesDir, "uploads");

const SESSION_SECRET = process.env.SESSION_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DEMO_AGE_VERIFICATION =
  String(process.env.DEMO_AGE_VERIFICATION || "true").toLowerCase() === "true";

if (!SESSION_SECRET) {
  throw new Error("Variabile ambiente obbligatoria mancante: SESSION_SECRET");
}

if (!ADMIN_USERNAME) {
  throw new Error("Variabile ambiente obbligatoria mancante: ADMIN_USERNAME");
}

if (!ADMIN_PASSWORD) {
  throw new Error("Variabile ambiente obbligatoria mancante: ADMIN_PASSWORD");
}


const COUPONS = [
  { code: "SHOP10", type: "percent", value: 10 },
  { code: "WELCOME20", type: "percent", value: 20 },
  { code: "SAVE5", type: "fixed", value: 5 }
];

const AGE_RESTRICTED_CATEGORIES = ["vino", "alcol", "alcolici"];
const SENSITIVE_SHIPPING_NOTE =
  "Consegnare solo a maggiorenni previa verifica della maggiore età.";

app.disable("x-powered-by");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: "urbanvibe.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 4
    }
  })
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const baseName = path
      .basename(file.originalname || "image", extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    cb(null, `${Date.now()}-${baseName || "image"}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      return cb(null, true);
    }

    cb(new Error("Puoi caricare solo file immagine."));
  }
});

async function ensureProjectFiles() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(imagesDir, { recursive: true });
  await fs.mkdir(uploadDir, { recursive: true });

  try {
    await fs.access(productsPath);
  } catch {
    const defaultProductsPath = path.join(rootDir, "products.json");

    try {
      await fs.copyFile(defaultProductsPath, productsPath);
    } catch {
      await fs.writeFile(productsPath, "[]");
    }
  }

  try {
    await fs.access(ordersPath);
  } catch {
    await fs.writeFile(ordersPath, "[]");
  }

  try {
    await fs.access(usersPath);
  } catch {
    await fs.writeFile(usersPath, "[]");
  }

  try {
    await fs.access(notificationsPath);
  } catch {
    await fs.writeFile(notificationsPath, "[]");
  }
}

async function readProducts() {
  const data = await fs.readFile(productsPath, "utf-8");
  return JSON.parse(data);
}

async function writeProducts(products) {
  await fs.writeFile(productsPath, JSON.stringify(products, null, 2));
}

async function readOrders() {
  const data = await fs.readFile(ordersPath, "utf-8");
  return JSON.parse(data);
}

async function writeOrders(orders) {
  await fs.writeFile(ordersPath, JSON.stringify(orders, null, 2));
}

async function readUsers() {
  const data = await fs.readFile(usersPath, "utf-8");
  return JSON.parse(data);
}

async function writeUsers(users) {
  await fs.writeFile(usersPath, JSON.stringify(users, null, 2));
}

async function readNotifications() {
  const data = await fs.readFile(notificationsPath, "utf-8");
  return JSON.parse(data);
}

async function writeNotifications(notifications) {
  await fs.writeFile(notificationsPath, JSON.stringify(notifications, null, 2));
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeVatNumber(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function isValidVatNumber(vatNumber) {
  return /^\d{11}$/.test(String(vatNumber || ""));
}

function sanitizeAccountType(value) {
  return value === "business" ? "business" : "private";
}

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    accountType: sanitizeAccountType(user.accountType),
    name: user.name,
    email: user.email,
    address: user.address || "",
    city: user.city || "",
    companyName: user.companyName || "",
    vatNumber: user.vatNumber || "",
    contactPerson: user.contactPerson || "",
    createdAt: user.createdAt
  };
}

function requireAdminPage(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }

  return res.redirect("/admin-login.html");
}

function requireAdminApi(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }

  return res.status(401).json({ message: "Non autorizzato" });
}

function requireUserApi(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  return res.status(401).json({ message: "Non autenticato" });
}

function requireAnyAuthenticated(req, res, next) {
  if (req.session?.isAdmin || req.session?.userId) {
    return next();
  }

  return res.status(401).json({ message: "Non autenticato" });
}

function uploadedImageUrl(filename) {
  return `/images/uploads/${filename}`;
}

function isUploadedImage(imagePath) {
  return typeof imagePath === "string" && imagePath.startsWith("/images/uploads/");
}

async function deleteUploadedImage(imagePath) {
  if (!isUploadedImage(imagePath)) return;

  const absolutePath = path.join(storageRoot, imagePath.replace(/^\//, ""));

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Errore eliminazione immagine:", error);
    }
  }
}

function calculateDiscount(subtotal, coupon) {
  if (!coupon) {
    return {
      discount: 0,
      finalTotal: Number(subtotal.toFixed(2))
    };
  }

  let discount = 0;

  if (coupon.type === "percent") {
    discount = subtotal * (coupon.value / 100);
  }

  if (coupon.type === "fixed") {
    discount = coupon.value;
  }

  if (discount > subtotal) {
    discount = subtotal;
  }

  const finalTotal = subtotal - discount;

  return {
    discount: Number(discount.toFixed(2)),
    finalTotal: Number(finalTotal.toFixed(2))
  };
}

function sanitizePayment(payment) {
  if (!payment) {
    return {
      method: "card",
      cardName: "",
      cardNumberLast4: "",
      cardExpiry: ""
    };
  }

  return {
    method: payment.method || "card",
    cardName: payment.cardName || "",
    cardNumberLast4: payment.cardNumber
      ? String(payment.cardNumber).replace(/\s+/g, "").slice(-4)
      : "",
    cardExpiry: payment.cardExpiry || ""
  };
}

function calculateAgeFromBirthDate(birthDateValue) {
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

function orderRequiresAgeVerification(items = []) {
  return items.some((item) =>
    AGE_RESTRICTED_CATEGORIES.includes(String(item.category || "").toLowerCase())
  );
}


function formatPrice(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value || 0));
}

function formatInvoiceDate(value) {
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

function getPaymentLabel(method) {
  const labels = {
    card: "Carta",
    cash: "Pagamento alla consegna",
    bank: "Bonifico"
  };

  return labels[method] || method || "-";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


function buildInvoiceText(order) {
  const lines = [];
  const separator = "========================================";

  lines.push("URBANVIBE");
  lines.push("FATTURA / RICEVUTA DEMO");
  lines.push(separator);
  lines.push(`Numero ordine: ${order.id}`);
  lines.push(`Data: ${formatInvoiceDate(order.createdAt)}`);
  lines.push(`Stato: ${order.status || "nuovo"}`);
  lines.push("");

  lines.push("DATI CLIENTE");
  lines.push(`Tipo account: ${order.customer?.accountType || "private"}`);
  lines.push(`Nome: ${order.customer?.name || "-"}`);

  if (order.customer?.accountType === "business") {
    lines.push(`Ragione sociale: ${order.customer?.companyName || "-"}`);
    lines.push(`Partita IVA: ${order.customer?.vatNumber || "-"}`);
    lines.push(`Referente: ${order.customer?.contactPerson || "-"}`);
  }

  lines.push(`Email: ${order.customer?.email || "-"}`);
  lines.push(`Indirizzo: ${order.customer?.address || "-"}`);
  lines.push(`Città: ${order.customer?.city || "-"}`);
  lines.push(`Note: ${order.customer?.notes || "-"}`);

  if (order.shippingNote) {
    lines.push(`Nota spedizione: ${order.shippingNote}`);
  }

  lines.push("");
  lines.push("PRODOTTI");

  (order.items || []).forEach((item, index) => {
    const quantity = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    const lineTotal = quantity * price;

    lines.push(
      `${index + 1}. ${item.name} | Qtà: ${quantity} | Prezzo: ${formatPrice(price)} | Totale: ${formatPrice(lineTotal)}`
    );
  });

  lines.push("");
  lines.push("RIEPILOGO");
  lines.push(`Subtotale: ${formatPrice(order.subtotal || 0)}`);
  lines.push(`Sconto: ${formatPrice(order.discount || 0)}`);
  lines.push(`Totale: ${formatPrice(order.total || 0)}`);
  lines.push(`Pagamento: ${getPaymentLabel(order.payment?.method)}`);
  lines.push(`Coupon: ${order.coupon?.code || "-"}`);

  if (order.ageVerification?.verifiedAge) {
    lines.push(`Età verificata: ${order.ageVerification.verifiedAge}`);
  }

  lines.push(separator);
  lines.push("Documento generato automaticamente dal pannello admin.");

  return lines.join("\n");
}

async function createNotification({
  scope,
  userId = null,
  title,
  message,
  link = "",
  type = "generic"
}) {
  const notifications = await readNotifications();

  const newNotification = {
    id: uuidv4(),
    scope,
    userId,
    title,
    message,
    link,
    type,
    isRead: false,
    createdAt: new Date().toISOString()
  };

  notifications.unshift(newNotification);

  const trimmedNotifications = notifications.slice(0, 1000);
  await writeNotifications(trimmedNotifications);

  return newNotification;
}

function getVisibleNotificationsForSession(req, notifications) {
  if (req.session?.isAdmin) {
    return notifications.filter((item) => item.scope === "admin");
  }

  if (req.session?.userId) {
    return notifications.filter(
      (item) => item.scope === "user" && item.userId === req.session.userId
    );
  }

  return [];
}

function canAccessNotification(req, notification) {
  if (!notification) return false;

  if (req.session?.isAdmin) {
    return notification.scope === "admin";
  }

  if (req.session?.userId) {
    return notification.scope === "user" && notification.userId === req.session.userId;
  }

  return false;
}

/* =========================
   AUTH ADMIN
========================= */

/* =========================
   AUTH ADMIN
========================= */

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.session.adminUser = username;

    return res.json({
      message: "Login effettuato con successo"
    });
  }

  return res.status(401).json({
    message: "Username o password non validi"
  });
});

app.get("/api/admin/session", (req, res) => {
  res.json({
    authenticated: Boolean(req.session && req.session.isAdmin),
    username: req.session?.adminUser || null
  });
});

app.post("/api/admin/logout", (req, res) => {
  if (!req.session) {
    return res.json({ message: "Logout completato" });
  }

  req.session.isAdmin = false;
  req.session.adminUser = null;

  return req.session.save((error) => {
    if (error) {
      return res.status(500).json({ message: "Errore durante il logout" });
    }

    return res.json({ message: "Logout completato" });
  });
});

/* =========================
   AUTH UTENTE
========================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      accountType,
      name,
      email,
      password,
      address,
      city,
      companyName,
      vatNumber,
      contactPerson
    } = req.body;

    const safeAccountType = sanitizeAccountType(accountType);
    const safeName = String(name || "").trim();
    const safeEmail = normalizeEmail(email);
    const safePassword = String(password || "");
    const safeAddress = String(address || "").trim();
    const safeCity = String(city || "").trim();
    const safeCompanyName = String(companyName || "").trim();
    const safeVatNumber = normalizeVatNumber(vatNumber);
    const safeContactPerson = String(contactPerson || "").trim();

    if (!safeName || !safeEmail || !safePassword) {
      return res.status(400).json({ message: "Compila tutti i campi obbligatori" });
    }

    if (safePassword.length < 6) {
      return res.status(400).json({ message: "La password deve avere almeno 6 caratteri" });
    }

    if (safeAccountType === "business") {
      if (!safeCompanyName || !safeVatNumber || !safeContactPerson) {
        return res.status(400).json({ message: "Compila tutti i campi azienda" });
      }

      if (!isValidVatNumber(safeVatNumber)) {
        return res.status(400).json({ message: "La partita IVA deve contenere 11 cifre" });
      }
    }

    const users = await readUsers();
    const existingUser = users.find((user) => user.email === safeEmail);

    if (existingUser) {
      return res.status(409).json({ message: "Esiste già un account con questa email" });
    }

    const passwordHash = await bcrypt.hash(safePassword, 10);

    const newUser = {
      id: uuidv4(),
      accountType: safeAccountType,
      name: safeName,
      email: safeEmail,
      passwordHash,
      address: safeAddress,
      city: safeCity,
      companyName: safeAccountType === "business" ? safeCompanyName : "",
      vatNumber: safeAccountType === "business" ? safeVatNumber : "",
      contactPerson: safeAccountType === "business" ? safeContactPerson : "",
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await writeUsers(users);

    req.session.userId = newUser.id;
    req.session.userEmail = newUser.email;
    req.session.userName = newUser.name;

    await createNotification({
      scope: "admin",
      title: "Nuovo utente registrato",
      message:
        safeAccountType === "business"
          ? `Nuovo account azienda registrato: ${newUser.companyName} (${newUser.email})`
          : `Si è registrato un nuovo utente: ${newUser.email}`,
      link: "/admin.html",
      type: "user"
    });

    await createNotification({
      scope: "user",
      userId: newUser.id,
      title: "Account creato",
      message:
        safeAccountType === "business"
          ? "Il tuo account azienda è stato creato con successo."
          : "Il tuo account è stato creato con successo.",
      link: "/account.html",
      type: "account"
    });

    res.status(201).json({
      message: "Registrazione completata",
      user: sanitizeUser(newUser)
    });
  } catch (error) {
    console.error("Errore registrazione utente:", error);
    res.status(500).json({ message: "Errore nella registrazione" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const safeEmail = normalizeEmail(email);
    const safePassword = String(password || "");

    if (!safeEmail || !safePassword) {
      return res.status(400).json({ message: "Inserisci email e password" });
    }

    const users = await readUsers();
    const user = users.find((item) => item.email === safeEmail);

    if (!user) {
      return res.status(401).json({ message: "Credenziali non valide" });
    }

    const isValid = await bcrypt.compare(safePassword, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ message: "Credenziali non valide" });
    }

    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userName = user.name;

    res.json({
      message: "Login effettuato con successo",
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error("Errore login utente:", error);
    res.status(500).json({ message: "Errore nel login" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.json({
        authenticated: false,
        user: null
      });
    }

    const users = await readUsers();
    const user = users.find((item) => item.id === req.session.userId);

    if (!user) {
      return res.json({
        authenticated: false,
        user: null
      });
    }

    res.json({
      authenticated: true,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error("Errore sessione utente:", error);
    res.status(500).json({ message: "Errore nel recupero sessione utente" });
  }
});

app.put("/api/auth/profile", requireUserApi, async (req, res) => {
  try {
    const {
      name,
      address,
      city,
      companyName,
      vatNumber,
      contactPerson
    } = req.body;

    const safeName = String(name || "").trim();
    const safeAddress = String(address || "").trim();
    const safeCity = String(city || "").trim();
    const safeCompanyName = String(companyName || "").trim();
    const safeVatNumber = normalizeVatNumber(vatNumber);
    const safeContactPerson = String(contactPerson || "").trim();

    if (!safeName) {
      return res.status(400).json({ message: "Il nome è obbligatorio" });
    }

    const users = await readUsers();
    const index = users.findIndex((item) => item.id === req.session.userId);

    if (index === -1) {
      return res.status(404).json({ message: "Utente non trovato" });
    }

    const existingUser = users[index];
    const accountType = sanitizeAccountType(existingUser.accountType);

    if (accountType === "business") {
      if (!safeCompanyName || !safeVatNumber || !safeContactPerson) {
        return res.status(400).json({ message: "Compila tutti i campi azienda" });
      }

      if (!isValidVatNumber(safeVatNumber)) {
        return res.status(400).json({ message: "La partita IVA deve contenere 11 cifre" });
      }
    }

    users[index] = {
      ...existingUser,
      name: safeName,
      address: safeAddress,
      city: safeCity,
      companyName: accountType === "business" ? safeCompanyName : "",
      vatNumber: accountType === "business" ? safeVatNumber : "",
      contactPerson: accountType === "business" ? safeContactPerson : ""
    };

    await writeUsers(users);
    req.session.userName = users[index].name;

    res.json({
      message: "Profilo aggiornato con successo",
      user: sanitizeUser(users[index])
    });
  } catch (error) {
    console.error("Errore aggiornamento profilo utente:", error);
    res.status(500).json({ message: "Errore aggiornamento profilo" });
  }
});

app.get("/api/auth/orders", requireUserApi, async (req, res) => {
  try {
    const orders = await readOrders();
    const userOrders = orders
      .filter((order) => {
        return normalizeEmail(order.customer?.email || "") ===
          normalizeEmail(req.session.userEmail || "");
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ orders: userOrders });
  } catch (error) {
    console.error("Errore caricamento ordini utente:", error);
    res.status(500).json({ message: "Errore nel caricamento ordini utente" });
  }
});

app.post("/api/auth/orders/:id/cancel", requireUserApi, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const orders = await readOrders();

    const index = orders.findIndex((order) => Number(order.id) === orderId);

    if (index === -1) {
      return res.status(404).json({ message: "Ordine non trovato" });
    }

    const order = orders[index];
    const orderEmail = normalizeEmail(order.customer?.email || "");
    const sessionEmail = normalizeEmail(req.session.userEmail || "");

    if (orderEmail !== sessionEmail) {
      return res.status(403).json({ message: "Non puoi annullare questo ordine" });
    }

    if ((order.status || "nuovo") !== "nuovo") {
      return res.status(400).json({
        message: "Puoi annullare solo ordini in stato nuovo"
      });
    }

    orders[index].status = "annullato";
    orders[index].cancelledAt = new Date().toISOString();

    await writeOrders(orders);

    await createNotification({
      scope: "admin",
      title: "Ordine annullato",
      message: `L'ordine #${orders[index].id} è stato annullato dall'utente.`,
      link: "/admin.html",
      type: "order"
    });

    if (orders[index].userId) {
      await createNotification({
        scope: "user",
        userId: orders[index].userId,
        title: "Ordine annullato",
        message: `Hai annullato correttamente l'ordine #${orders[index].id}.`,
        link: "/account.html",
        type: "order"
      });
    }

    return res.json({
      message: "Ordine annullato con successo",
      order: orders[index]
    });
  } catch (error) {
    console.error("Errore annullamento ordine utente:", error);
    return res.status(500).json({ message: "Errore annullamento ordine" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  if (!req.session) {
    return res.json({ message: "Logout completato" });
  }

  req.session.userId = null;
  req.session.userEmail = null;
  req.session.userName = null;

  return req.session.save((error) => {
    if (error) {
      return res.status(500).json({ message: "Errore durante il logout" });
    }

    return res.json({ message: "Logout completato" });
  });
});

/* =========================
   NOTIFICHE
========================= */

app.get("/api/notifications", requireAnyAuthenticated, async (req, res) => {
  try {
    const notifications = await readNotifications();
    const visibleNotifications = getVisibleNotificationsForSession(req, notifications)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const unreadCount = visibleNotifications.filter((item) => !item.isRead).length;

    res.json({
      notifications: visibleNotifications,
      unreadCount
    });
  } catch (error) {
    console.error("Errore caricamento notifiche:", error);
    res.status(500).json({ message: "Errore nel caricamento notifiche" });
  }
});

app.post("/api/notifications/:id/read", requireAnyAuthenticated, async (req, res) => {
  try {
    const notifications = await readNotifications();
    const index = notifications.findIndex((item) => item.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ message: "Notifica non trovata" });
    }

    if (!canAccessNotification(req, notifications[index])) {
      return res.status(403).json({ message: "Notifica non accessibile" });
    }

    notifications[index].isRead = true;
    await writeNotifications(notifications);

    res.json({
      message: "Notifica letta",
      notification: notifications[index]
    });
  } catch (error) {
    console.error("Errore lettura notifica:", error);
    res.status(500).json({ message: "Errore lettura notifica" });
  }
});

app.post("/api/notifications/read-all", requireAnyAuthenticated, async (req, res) => {
  try {
    const notifications = await readNotifications();
    let updatedCount = 0;

    const updatedNotifications = notifications.map((item) => {
      if (canAccessNotification(req, item) && !item.isRead) {
        updatedCount += 1;
        return {
          ...item,
          isRead: true
        };
      }

      return item;
    });

    await writeNotifications(updatedNotifications);

    res.json({
      message: "Notifiche aggiornate",
      updatedCount
    });
  } catch (error) {
    console.error("Errore lettura notifiche:", error);
    res.status(500).json({ message: "Errore lettura notifiche" });
  }
});

app.delete("/api/notifications/:id", requireAnyAuthenticated, async (req, res) => {
  try {
    const notifications = await readNotifications();
    const notification = notifications.find((item) => item.id === req.params.id);

    if (!notification) {
      return res.status(404).json({ message: "Notifica non trovata" });
    }

    if (!canAccessNotification(req, notification)) {
      return res.status(403).json({ message: "Notifica non accessibile" });
    }

    const filteredNotifications = notifications.filter((item) => item.id !== req.params.id);
    await writeNotifications(filteredNotifications);

    res.json({ message: "Notifica eliminata" });
  } catch (error) {
    console.error("Errore eliminazione notifica:", error);
    res.status(500).json({ message: "Errore eliminazione notifica" });
  }
});

/* =========================
   API PUBBLICHE PRODOTTI
========================= */

app.get("/api/products", async (req, res) => {
  try {
    const products = await readProducts();
    res.json(products);
  } catch (error) {
    console.error("Errore caricamento prodotti:", error);
    res.status(500).json({ message: "Errore nel caricamento prodotti" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const products = await readProducts();
    const product = products.find((p) => p.id === Number(req.params.id));

    if (!product) {
      return res.status(404).json({ message: "Prodotto non trovato" });
    }

    res.json(product);
  } catch (error) {
    console.error("Errore caricamento prodotto:", error);
    res.status(500).json({ message: "Errore nel caricamento prodotto" });
  }
});

/* =========================
   COUPON
========================= */

app.post("/api/coupons/validate", (req, res) => {
  const { code, subtotal } = req.body;

  if (!code) {
    return res.status(400).json({ message: "Inserisci un codice coupon" });
  }

  const normalizedCode = String(code).trim().toUpperCase();
  const numericSubtotal = Number(subtotal || 0);

  const coupon = COUPONS.find((item) => item.code === normalizedCode);

  if (!coupon) {
    return res.status(404).json({ message: "Coupon non valido" });
  }

  const result = calculateDiscount(numericSubtotal, coupon);

  res.json({
    valid: true,
    coupon,
    discount: result.discount,
    finalTotal: result.finalTotal
  });
});

/* =========================
   ORDINI PUBBLICI
========================= */

app.post("/api/orders", async (req, res) => {
  try {
    const { customer, items, couponCode, payment, ageVerification } = req.body;

    if (!customer || !items || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "Dati ordine non validi" });
    }

    if (!customer.name || !customer.email || !customer.address || !customer.city) {
      return res.status(400).json({ message: "Dati cliente incompleti" });
    }

    const requiresAgeCheck = orderRequiresAgeVerification(items);
    const automaticShippingNote = requiresAgeCheck ? SENSITIVE_SHIPPING_NOTE : null;

    let verifiedAge = null;

    if (requiresAgeCheck) {
      if (DEMO_AGE_VERIFICATION) {
        if (
          !ageVerification ||
          !ageVerification.birthDate ||
          !ageVerification.confirmedMajority
        ) {
          return res.status(400).json({
            message: "Verifica età mancante"
          });
        }

        verifiedAge = calculateAgeFromBirthDate(ageVerification.birthDate);

        if (verifiedAge < 18) {
          return res.status(403).json({
            message: "Ordine non consentito ai minori"
          });
        }
      } else {
        return res.status(403).json({
          message: "Verifica età reale non ancora configurata"
        });
      }
    }

    const subtotal = items.reduce((sum, item) => {
      return sum + Number(item.price || 0) * Number(item.quantity || 0);
    }, 0);

    let appliedCoupon = null;

    if (couponCode) {
      const normalizedCode = String(couponCode).trim().toUpperCase();
      appliedCoupon = COUPONS.find((item) => item.code === normalizedCode);

      if (!appliedCoupon) {
        return res.status(400).json({ message: "Coupon non valido" });
      }
    }

    let userData = null;

    if (req.session?.userId) {
      const users = await readUsers();
      userData = users.find((item) => item.id === req.session.userId) || null;
    }

    const totals = calculateDiscount(subtotal, appliedCoupon);
    const orders = await readOrders();

    const newOrder = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      status: "nuovo",
      userId: req.session?.userId || null,
      customer: {
        accountType: userData ? sanitizeAccountType(userData.accountType) : "private",
        name: customer.name,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        companyName: userData?.companyName || "",
        vatNumber: userData?.vatNumber || "",
        contactPerson: userData?.contactPerson || "",
        notes: [customer.notes || "", automaticShippingNote || ""]
          .filter(Boolean)
          .join("\n\n")
      },
      items: items.map((item) => ({
        id: Number(item.id),
        name: item.name,
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 0),
        image: item.image || "",
        category: item.category || ""
      })),
      subtotal: Number(subtotal.toFixed(2)),
      discount: totals.discount,
      total: totals.finalTotal,
      coupon: appliedCoupon
        ? {
            code: appliedCoupon.code,
            type: appliedCoupon.type,
            value: appliedCoupon.value
          }
        : null,
      payment: sanitizePayment(payment),
      shippingNote: automaticShippingNote,
      ageVerification: requiresAgeCheck
        ? {
            mode: "demo",
            birthDate: ageVerification.birthDate,
            confirmedMajority: true,
            verifiedAge
          }
        : null
    };

    orders.push(newOrder);
    await writeOrders(orders);

    await createNotification({
      scope: "admin",
      title: "Nuovo ordine ricevuto",
      message: `È arrivato un nuovo ordine #${newOrder.id}.`,
      link: "/admin.html",
      type: "order"
    });

    if (newOrder.userId) {
      await createNotification({
        scope: "user",
        userId: newOrder.userId,
        title: "Ordine confermato",
        message: `Il tuo ordine #${newOrder.id} è stato registrato correttamente.`,
        link: "/account.html",
        type: "order"
      });
    }

    res.status(201).json({
      message: "Ordine salvato con successo",
      order: newOrder
    });
  } catch (error) {
    console.error("Errore salvataggio ordine:", error);
    res.status(500).json({ message: "Errore nel salvataggio ordine" });
  }
});

/* =========================
   PAGINE ADMIN PROTETTE
========================= */

app.get("/admin.html", requireAdminPage, (req, res) => {
  res.sendFile(path.join(rootDir, "admin.html"));
});

app.get("/admin.js", requireAdminPage, (req, res) => {
  res.sendFile(path.join(rootDir, "admin.js"));
});

/* =========================
   API ADMIN PRODOTTI
========================= */

app.post("/api/admin/products", requireAdminApi, upload.single("imageFile"), async (req, res) => {
  try {
    const { name, category, description, longDescription, price } = req.body;

    if (!name || !category || !description || !longDescription || Number(price) <= 0) {
      return res.status(400).json({ message: "Dati prodotto non validi" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Seleziona un'immagine per il prodotto" });
    }

    const products = await readProducts();

    const newProduct = {
      id: products.length ? Math.max(...products.map((p) => p.id)) + 1 : 1,
      name,
      category,
      description,
      longDescription,
      price: Number(price),
      image: uploadedImageUrl(req.file.filename)
    };

    products.push(newProduct);
    await writeProducts(products);

    res.status(201).json({
      message: "Prodotto creato con successo",
      product: newProduct
    });
  } catch (error) {
    console.error("Errore creazione prodotto:", error);
    res.status(500).json({ message: "Errore nella creazione prodotto" });
  }
});

app.put("/api/admin/products/:id", requireAdminApi, upload.single("imageFile"), async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const { name, category, description, longDescription, price, existingImage } = req.body;

    if (!name || !category || !description || !longDescription || Number(price) <= 0) {
      return res.status(400).json({ message: "Dati prodotto non validi" });
    }

    const products = await readProducts();
    const index = products.findIndex((p) => p.id === productId);

    if (index === -1) {
      return res.status(404).json({ message: "Prodotto non trovato" });
    }

    const oldImage = products[index].image;
    const nextImage = req.file ? uploadedImageUrl(req.file.filename) : existingImage;

    if (!nextImage) {
      return res.status(400).json({ message: "Immagine prodotto mancante" });
    }

    const updatedProduct = {
      ...products[index],
      name,
      category,
      description,
      longDescription,
      price: Number(price),
      image: nextImage
    };

    products[index] = updatedProduct;
    await writeProducts(products);

    if (req.file && oldImage !== nextImage) {
      await deleteUploadedImage(oldImage);
    }

    res.json({
      message: "Prodotto aggiornato con successo",
      product: updatedProduct
    });
  } catch (error) {
    console.error("Errore aggiornamento prodotto:", error);
    res.status(500).json({ message: "Errore nell'aggiornamento prodotto" });
  }
});

app.delete("/api/admin/products/:id", requireAdminApi, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const products = await readProducts();

    const existing = products.find((p) => p.id === productId);

    if (!existing) {
      return res.status(404).json({ message: "Prodotto non trovato" });
    }

    const filteredProducts = products.filter((p) => p.id !== productId);
    await writeProducts(filteredProducts);
    await deleteUploadedImage(existing.image);

    res.json({ message: "Prodotto eliminato con successo" });
  } catch (error) {
    console.error("Errore eliminazione prodotto:", error);
    res.status(500).json({ message: "Errore nell'eliminazione prodotto" });
  }
});

/* =========================
   API ADMIN ORDINI
========================= */

app.get("/api/admin/orders", requireAdminApi, async (req, res) => {
  try {
    const orders = await readOrders();

    const sortedOrders = orders.sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(sortedOrders);
  } catch (error) {
    console.error("Errore caricamento ordini:", error);
    res.status(500).json({ message: "Errore nel caricamento ordini" });
  }
});

app.get("/api/admin/orders/:id/invoice", requireAdminApi, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const orders = await readOrders();
    const order = orders.find((item) => Number(item.id) === orderId);

    if (!order) {
      return res.status(404).json({ message: "Ordine non trovato" });
    }

    const invoiceText = buildInvoiceText(order);

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="fattura-ordine-${order.id}.txt"`
    );

    return res.send(invoiceText);
  } catch (error) {
    console.error("Errore generazione fattura TXT:", error);
    return res.status(500).json({ message: "Errore generazione fattura" });
  }
});

app.get("/api/admin/orders/export/csv", requireAdminApi, async (req, res) => {
  try {
    const orders = await readOrders();

    const escapeCsv = (value) => {
      const stringValue = String(value ?? "");
      return `"${stringValue.replace(/"/g, '""')}"`;
    };

    const rows = [
      [
        "ID Ordine",
        "Data",
        "Stato",
        "User ID",
        "Tipo account",
        "Cliente",
        "Email",
        "Ragione sociale",
        "Partita IVA",
        "Referente",
        "Indirizzo",
        "Città",
        "Note",
        "Nota spedizione",
        "Prodotti",
        "Subtotale",
        "Sconto",
        "Totale",
        "Coupon",
        "Pagamento",
        "Carta Nome",
        "Carta Ultime 4",
        "Scadenza",
        "Età verificata",
        "Data nascita",
        "Verifica età",
        "Data annullamento"
      ]
    ];

    orders.forEach((order) => {
      const productsText = (order.items || [])
        .map((item) => `${item.name} x ${item.quantity}`)
        .join(" | ");

      rows.push([
        order.id,
        order.createdAt || "",
        order.status || "nuovo",
        order.userId || "",
        order.customer?.accountType || "private",
        order.customer?.name || "",
        order.customer?.email || "",
        order.customer?.companyName || "",
        order.customer?.vatNumber || "",
        order.customer?.contactPerson || "",
        order.customer?.address || "",
        order.customer?.city || "",
        order.customer?.notes || "",
        order.shippingNote || "",
        productsText,
        order.subtotal || order.total || 0,
        order.discount || 0,
        order.total || 0,
        order.coupon?.code || "",
        order.payment?.method || "",
        order.payment?.cardName || "",
        order.payment?.cardNumberLast4 || "",
        order.payment?.cardExpiry || "",
        order.ageVerification?.verifiedAge || "",
        order.ageVerification?.birthDate || "",
        order.ageVerification?.mode || "",
        order.cancelledAt || ""
      ]);
    });

    const csvContent = rows
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="ordini-urbanvibe.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error("Errore esportazione CSV:", error);
    res.status(500).json({ message: "Errore esportazione CSV" });
  }
});

app.put("/api/admin/orders/:id/status", requireAdminApi, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { status } = req.body;

    const allowedStatuses = [
      "nuovo",
      "in lavorazione",
      "spedito",
      "completato",
      "annullato"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Stato ordine non valido" });
    }

    const orders = await readOrders();
    const index = orders.findIndex((order) => order.id === orderId);

    if (index === -1) {
      return res.status(404).json({ message: "Ordine non trovato" });
    }

    orders[index].status = status;

    if (status === "annullato" && !orders[index].cancelledAt) {
      orders[index].cancelledAt = new Date().toISOString();
    }

    await writeOrders(orders);

    if (orders[index].userId) {
      await createNotification({
        scope: "user",
        userId: orders[index].userId,
        title: "Stato ordine aggiornato",
        message: `Il tuo ordine #${orders[index].id} è ora in stato "${status}".`,
        link: "/account.html",
        type: "order"
      });
    }

    res.json({
      message: "Stato ordine aggiornato con successo",
      order: orders[index]
    });
  } catch (error) {
    console.error("Errore aggiornamento stato ordine:", error);
    res.status(500).json({ message: "Errore aggiornamento stato ordine" });
  }
});

/* =========================
   ERRORI UPLOAD
========================= */

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: error.message });
  }

  if (error) {
    return res.status(400).json({ message: error.message || "Errore upload file" });
  }

  next();
});

/* =========================
   FILE STATICI + HOME
========================= */

app.use("/images", express.static(imagesDir));
app.use(express.static(rootDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

/* =========================
   AVVIO SERVER
========================= */

async function startServer() {
  await ensureProjectFiles();

  const HOST = "0.0.0.0";

  app.listen(PORT, HOST, () => {
    console.log(`Server avviato su http://${HOST}:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Errore avvio server:", error);
});