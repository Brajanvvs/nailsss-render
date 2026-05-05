const router = require("express").Router();
const pool = require("../db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const nodemailer = require("nodemailer");

async function sendEmail(to, subject, html) {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (RESEND_API_KEY) {
        console.log("📧 Enviando con Resend...");
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: "Nail Salon <onboarding@resend.dev>",
                to: [to],
                subject: subject,
                html: html
            })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Error Resend");
        console.log("✅ Email enviado con Resend:", data.id);
        return { id: data.id };
    }
    
    // Fallback a nodemailer
    console.log("📧 Fallback a nodemailer...");
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;

    if (!SMTP_PASS) {
        throw new Error("SMTP_PASS no configurada");
    }

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });

    const info = await transporter.sendMail({
        from: `Nail Salon <${SMTP_USER}>`,
        to: to,
        subject: subject,
        html: html
    });

    console.log("✅ Email enviado:", info.messageId);
    return { id: info.messageId };
}

/* =========================
ADMIN: CREAR USUARIO
========================= */

router.post("/create-user", async (req, res) => {
    try {
        const { name, email, password, role, adminEmail } = req.body;

        const adminCheck = await pool.query(
            "SELECT * FROM users WHERE email=$1 AND role='admin'",
            [adminEmail]
        );

        if (adminCheck.rows.length === 0) {
            return res.status(403).json({ error: "Solo administradores pueden crear usuarios" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await pool.query(
            "INSERT INTO users(name, email, password, role) VALUES($1, $2, $3, $4) RETURNING id, name, email, role",
            [name, email, hashedPassword, role || "user"]
        );

        res.json({ message: "Usuario creado exitosamente", user: newUser.rows[0] });

    } catch (err) {
        if (err.code === "23505") {
            return res.status(400).json({ error: "El email ya está registrado" });
        }
        console.error(err);
        res.status(500).json({ error: "Error creando usuario" });
    }
});

/* =========================
ADMIN: LISTAR USUARIOS
========================= */

router.get("/users", async (req, res) => {
    try {
        const { adminEmail } = req.query;

        const adminCheck = await pool.query(
            "SELECT * FROM users WHERE email=$1 AND role='admin'",
            [adminEmail]
        );

        if (adminCheck.rows.length === 0) {
            return res.status(403).json({ error: "Acceso denegado" });
        }

        const users = await pool.query(
            "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC"
        );

        res.json(users.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error obteniendo usuarios" });
    }
});

/* =========================
ADMIN: ELIMINAR USUARIO
========================= */

router.delete("/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { adminEmail } = req.body;

        const adminCheck = await pool.query(
            "SELECT * FROM users WHERE email=$1 AND role='admin'",
            [adminEmail]
        );

        if (adminCheck.rows.length === 0) {
            return res.status(403).json({ error: "Acceso denegado" });
        }

        await pool.query("DELETE FROM users WHERE id=$1", [id]);

        res.json({ message: "Usuario eliminado" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error eliminando usuario" });
    }
});

/* =========================
REGISTER
========================= */

router.post("/register", async (req,res)=>{

try{

const {name,email,password} = req.body;

const hashedPassword = await bcrypt.hash(password,10);

const newUser = await pool.query(
"INSERT INTO users(name,email,password,role) VALUES($1,$2,$3,'user') RETURNING id,name,email,role",
[name,email,hashedPassword]
);

res.json(newUser.rows[0]);

}catch(err){

console.log(err);
res.status(500).json({error:"Error registrando usuario"});

}

});


/* =========================
LOGIN
========================= */

router.post("/login", async (req,res)=>{

try{

const {email,password} = req.body;

const user = await pool.query(
"SELECT * FROM users WHERE email=$1",
[email]
);

if(user.rows.length === 0){
return res.status(401).json({error:"Usuario no existe"});
}

const validPassword = await bcrypt.compare(
password,
user.rows[0].password
);

if(!validPassword){
return res.status(401).json({error:"Contraseña incorrecta"});
}

res.json({
id:user.rows[0].id,
name:user.rows[0].name,
email:user.rows[0].email,
role:user.rows[0].role
});

}catch(err){

console.log(err);
res.status(500).json({error:"Error login"});

}

});

/* =========================
SOLICITAR RESET DE CONTRASEÑA
========================= */

router.post("/request-reset", async (req, res) => {
    try {
        const { email } = req.body;
        console.log("📧 Request reset para:", email);

        const user = await pool.query(
            "SELECT * FROM users WHERE email=$1",
            [email]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ error: "Email no encontrado" });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetExpires = new Date(Date.now() + 3600000).toISOString();

        await pool.query(
            "UPDATE users SET reset_token=$1, reset_expires=$2 WHERE email=$3",
            [resetToken, resetExpires, email]
        );
        console.log("✅ Token actualizado");

        const FRONTEND_URL = process.env.FRONTEND_URL || "https://nailsss-render.onrender.com";
        const resetUrl = `${FRONTEND_URL}/reset-password.html?token=${resetToken}&email=${email}`;

        console.log("📧 SMTP_CHECK:", {
            SMTP_HOST: process.env.SMTP_HOST,
            SMTP_USER: process.env.SMTP_USER,
            SMTP_PASS_SET: !!process.env.SMTP_PASS
        });

        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
            try {
                console.log("📧 Enviando email a:", email);
                
                await sendEmail(
                    email,
                    "Recuperación de contraseña - Nail Salon",
                    `
                    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px;">
                        <h2 style="color: #d63384;">Nail Salon</h2>
                        <p>Has solicitado restablecer tu contraseña.</p>
                        <p>Haz clic en el siguiente botón:</p>
                        <a href="${resetUrl}" style="background: #d63384; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
                            Restablecer Contraseña
                        </a>
                        <p style="color: #666; font-size: 12px;">
                            Este link expira en 1 hora.<br>
                            Si no solicitaste esto, ignora este correo.
                        </p>
                    </div>
                    `
                );
                
                console.log("✅ Email enviado");
                res.json({ message: "Email de recuperación enviado" });
            } catch (emailError) {
                console.error("❌ Error email:", emailError.message);
                res.status(500).json({ error: "Error enviando email: " + emailError.message });
            }
        } else {
            console.log("🔗 Link de reset:", resetUrl);
            res.json({ 
                message: "Link de recuperación enviado (revisar consola)",
                debug: resetUrl 
            });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error solicitando reset" });
    }
});

/* =========================
RESETEAR CONTRASEÑA
========================= */

router.post("/reset-password", async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;

        const user = await pool.query(
            "SELECT * FROM users WHERE email=$1 AND reset_token=$2",
            [email, token]
        );

        if (user.rows.length === 0) {
            return res.status(400).json({ error: "Token inválido" });
        }

        const now = new Date();
        const expires = new Date(user.rows[0].reset_expires);

        if (now > expires) {
            return res.status(400).json({ error: "Token expirado" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query(
            "UPDATE users SET password=$1, reset_token=NULL, reset_expires=NULL WHERE email=$2",
            [hashedPassword, email]
        );

        res.json({ message: "Contraseña actualizada correctamente" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error reseteando contraseña" });
    }
});

/* =========================
CAMBIO DE PROPIA CONTRASEÑA
========================= */

router.post("/change-password", async (req, res) => {
    try {
        const { email, currentPassword, newPassword } = req.body;

        const user = await pool.query(
            "SELECT * FROM users WHERE email=$1",
            [email]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const validPassword = await bcrypt.compare(currentPassword, user.rows[0].password);

        if (!validPassword) {
            return res.status(401).json({ error: "Contraseña actual incorrecta" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query(
            "UPDATE users SET password=$1 WHERE email=$2",
            [hashedPassword, email]
        );

        res.json({ message: "Contraseña actualizada correctamente" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cambiando contraseña" });
    }
});

module.exports = router;