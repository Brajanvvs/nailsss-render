// 👉 dotenv solo en local
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const cors = require("cors");
const path = require("path");

// 🔥 Mongo + PQRS (deshabilitado temporalmente)
// const connectMongo = require("./mongo");
// const pqrsRoutes = require("./routes/pqrs");

// 🔹 Rutas existentes
const servicesRoutes = require("./routes/services");
const authRoutes = require("./routes/auth");
const appointmentsRoutes = require("./routes/appointments");
const clientsRoutes = require("./routes/clients");
const productsRoutes = require("./routes/products");
const salesRoutes = require("./routes/sales");
const balanceRoutes = require("./routes/balance");

const app = express();

/* =========================
    CONFIG
========================= */
app.set("trust proxy", 1);

const frontendPath = path.join(__dirname, "frontend");

/* =========================
    LOG INICIAL
========================= */
console.log("🚀 Iniciando servidor...");
console.log("🌍 NODE_ENV:", process.env.NODE_ENV);
console.log("🔌 PORT ENV:", process.env.PORT);
console.log("📂 Frontend path:", frontendPath);

/* =========================
    MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());

/* =========================
    🔥 HEALTH CHECK (CRÍTICO)
========================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

/* =========================
   API ROUTES
========================= */
app.use("/services", servicesRoutes);
app.use("/auth", authRoutes);
app.use("/appointments", appointmentsRoutes);
app.use("/clients", clientsRoutes);
app.use("/products", productsRoutes);
app.use("/sales", salesRoutes);
app.use("/balance", balanceRoutes);

// 🔥 PQRS (Mongo)
// app.use("/api/pqrs", pqrsRoutes); // PQRS deshabilitado

/* =========================
    FRONTEND
========================= */
app.use(express.static(frontendPath));

app.get("/home", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

/* =========================
   404
========================= */
app.use((req, res) => {
  res.status(404).json({ message: "Ruta no encontrada" });
});

/* =========================
   ERRORES
========================= */
app.use((err, req, res, next) => {
  console.error("❌ Error global:", err);
  res.status(500).json({
    message: "Error interno",
    error: err.message
  });
});

/* =========================
   🚀 PUERTO (RAILWAY)
========================= */
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🔥 Servidor corriendo en puerto ${PORT}`);

  // 🔥 MUY IMPORTANTE: conectar Mongo DESPUÉS
  // connectMongo(); // MongoDB deshabilitado temporalmente
});