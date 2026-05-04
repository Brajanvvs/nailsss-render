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
    🔧 TEMPORAL: CREAR TABLAS
========================= */
const pool = require("./db");

app.get("/setup", async (req, res) => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100) UNIQUE,
                password TEXT,
                role VARCHAR(20) DEFAULT 'user',
                reset_token TEXT,
                reset_expires TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS services (
                id SERIAL PRIMARY KEY,
                title VARCHAR(100),
                price NUMERIC,
                image TEXT
            );
            
            CREATE TABLE IF NOT EXISTS appointments (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                service_id INTEGER REFERENCES services(id),
                day VARCHAR(20),
                time VARCHAR(20),
                status VARCHAR(20) DEFAULT 'active'
            );
            
            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                document_type VARCHAR(20) DEFAULT 'CC',
                document_number VARCHAR(30) UNIQUE,
                email VARCHAR(100),
                phone VARCHAR(20),
                address TEXT,
                rut_pdf TEXT,
                balance NUMERIC DEFAULT 0,
                user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                category VARCHAR(50),
                stock INTEGER DEFAULT 0,
                price NUMERIC,
                unit VARCHAR(20) DEFAULT 'unidades',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS sales (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES clients(id),
                client_name VARCHAR(100),
                client_document VARCHAR(30),
                client_phone VARCHAR(20),
                total NUMERIC,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS sales_items (
                id SERIAL PRIMARY KEY,
                sale_id INTEGER REFERENCES sales(id),
                product_id INTEGER REFERENCES products(id),
                product_name VARCHAR(100),
                quantity INTEGER,
                unit_price NUMERIC,
                subtotal NUMERIC
            );
            
            CREATE TABLE IF NOT EXISTS balance_requests (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES clients(id),
                amount NUMERIC NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                approved_at TIMESTAMP
            );
        `);
        
        res.json({ message: "Tablas creadas correctamente" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para probar SMTP
app.get("/test-email", async (req, res) => {
    const nodemailer = require("nodemailer");
    const SMTP_HOST = process.env.SMTP_HOST || "smtp-relay.brevo.com";
    const SMTP_PORT = parseInt(process.env.SMTP_PORT) || 587;
    const SMTP_USER = process.env.SMTP_USER || "aa05e4001@smtp-brevo.com";
    const SMTP_PASS = process.env.SMTP_PASS;
    
    res.json({ 
        SMTP_HOST, 
        SMTP_PORT, 
        SMTP_USER, 
        SMTP_PASS_SET: !!SMTP_PASS 
    });
});

// Debug: ver errores de request-reset
app.get("/debug-reset", async (req, res) => {
    try {
        const pool = require("./db");
        const result = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
        res.json({ columns: result.rows.map(r => r.column_name) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para hacer admin
app.get("/make-admin", async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ error: "Email requerido" });
        
        await pool.query("UPDATE users SET role='admin' WHERE email=$1", [email]);
        res.json({ message: "Usuario ahora es admin" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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