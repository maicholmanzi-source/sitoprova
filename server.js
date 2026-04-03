const express = require("express");
const path = require("path");
const fs = require("node:fs/promises");
const session = require("express-session");
const multer = require("multer");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

const rootDir = __dirname;
const storageRoot = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : rootDir;

const productsPath = path.join(storageRoot, "products.json");
const dataDir = path.join(storageRoot, "data");
const ordersPath = path.join(dataDir, "orders.json");
const imagesDir = path.join(storageRoot, "images");
const uploadDir = path.join(imagesDir, "uploads");

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1234admin";
const DEMO_AGE_VERIFICATION =
  String(process.env.DEMO_AGE_VERIFICATION || "true").toLowerCase() === "true";

const MAIL_FROM = process.env.MAIL_FROM || "no-reply@example.com";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

const COUPONS = [
  { code: "SHOP10", type: "percent", value: 10 },
  { code: "WELCOME20", type: "percent", value: 20 },
  { code: "SAVE5", type: "fixed", value: 5 }
];

const AGE_RESTRICTED_CATEGORIES = ["vino", "alcol", "alcolici"];

app.disable("x-powered-by");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: "urbanvibe.sid",
    secret: process.env.SESSION_SECRET || "urbanvibe-super-secret-demo-123456789",
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

function createMailTransporter() {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

function formatPrice(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value || 0));
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

function buildOrderConfirmationHtml(order) {
  const itemsHtml = (order.items || [])
    .map((item) => {
      const lineTotal = Number(item.price || 0) * Number(item.quantity || 0);

      return `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${Number(item.quantity || 0)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatPrice(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#111827;">
      <h1 style="margin-bottom:8px;">Ordine confermato 🎉</h1>
      <p style="color:#4b5563;line-height:1.6;">
        Ciao ${escapeHtml(order.customer?.name || "cliente")}, grazie per il tuo acquisto su <strong>UrbanVibe</strong>.
      </p>

      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 8px;"><strong>ID ordine:</strong> ${escapeHtml(order.id)}</p>
        <p style="margin:0 0 8px;"><strong>Data:</strong> ${new Date(order.createdAt).toLocaleString("it-IT")}</p>
        <p style="margin:0 0 8px;"><strong>Cliente:</strong> ${escapeHtml(order.customer?.name || "-")}</p>
        <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(order.customer?.email || "-")}</p>
        <p style="margin:0 0 8px;"><strong>Pagamento:</strong> ${escapeHtml(getPaymentLabel(order.payment?.method))}</p>
        <p style="margin:0;"><strong>Totale:</strong> ${formatPrice(order.total || 0)}</p>
      </div>

      <h2 style="margin:24px 0 12px;">Riepilogo prodotti</h2>

      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:10px 8px;border-bottom:2px solid #d1d5db;">Prodotto</th>
            <th style="text-align:center;padding:10px 8px;border-bottom:2px solid #d1d5db;">Qtà</th>
            <th style="text-align:right;padding:10px 8px;border-bottom:2px solid #d1d5db;">Totale</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="margin-top:20px;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:16px;">
        <p style="margin:0 0 8px;"><strong>Subtotale:</strong> ${formatPrice(order.subtotal || 0)}</p>
        <p style="margin:0 0 8px;"><strong>Sconto:</strong> ${formatPrice(order.discount || 0)}</p>
        <p style="margin:0;"><strong>Totale finale:</strong> ${formatPrice(order.total || 0)}</p>
      </div>

      <p style="margin-top:24px;color:#6b7280;line-height:1.6;">
        Ti contatteremo se serviranno ulteriori dettagli sulla consegna.
      </p>
    </div>
  `;
}

async function sendOrderConfirmationEmail(order) {
  const transporter = createMailTransporter();

  if (!transporter) {
    console.warn("SMTP non configurato: email conferma non inviata.");
    return;
  }

  const to = order.customer?.email;
  if (!to) {
    console.warn("Email cliente mancante: conferma non inviata.");
    return;
  }

  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject: `Conferma ordine #${order.id} - UrbanVibe`,
    html: buildOrderConfirmationHtml(order),
    text: [
      "Ordine confermato",
      `ID ordine: ${order.id}`,
      `Cliente: ${order.customer?.name || "-"}`,
      `Totale: ${formatPrice(order.total || 0)}`,
      `Pagamento: ${getPaymentLabel(order.payment?.method)}`
    ].join("\n")
  });
}

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

  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ message: "Errore durante il logout" });
    }

    res.clearCookie("urbanvibe.sid");
    return res.json({ message: "Logout completato" });
  });
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

    const totals = calculateDiscount(subtotal, appliedCoupon);
    const orders = await readOrders();

    const newOrder = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      status: "nuovo",
      customer: {
        name: customer.name,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        notes: customer.notes || ""
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

    try {
      await sendOrderConfirmationEmail(newOrder);
    } catch (mailError) {
      console.error("Errore invio email conferma ordine:", mailError);
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
        "Cliente",
        "Email",
        "Indirizzo",
        "Città",
        "Note",
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
        "Verifica età"
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
        order.customer?.name || "",
        order.customer?.email || "",
        order.customer?.address || "",
        order.customer?.city || "",
        order.customer?.notes || "",
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
        order.ageVerification?.mode || ""
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
      "completato"
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
    await writeOrders(orders);

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

  app.listen(PORT, () => {
    console.log(`Server avviato su http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Errore avvio server:", error);
});