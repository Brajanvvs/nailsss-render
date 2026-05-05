document.addEventListener("DOMContentLoaded", () => {
    const user = JSON.parse(localStorage.getItem("user"));
    
    if (!user || user.role !== "admin") {
        alert("Acceso denegado");
        window.location.href = "login.html";
        return;
    }

    loadUsers();
    loadServices();
    loadClients();
    loadProducts();
    loadSales();
    loadCashBox();
    loadRechargeRequests();
    loadPQRS();
});

// --- RECARGAS DE SALDO ---
function loadRechargeRequests() {
    fetch("/balance/requests")
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById("rechargeRequests");
            
            if (!data || data.length === 0) {
                container.innerHTML = "<p style='color: #666;'>No hay solicitudes de recarga pendientes</p>";
                return;
            }
            
            container.innerHTML = `
                <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background:#3498db; color:white;">
                            <th style="padding:10px;">Cliente</th>
                            <th style="padding:10px;">Documento</th>
                            <th style="padding:10px;">Teléfono</th>
                            <th style="padding:10px;">Monto</th>
                            <th style="padding:10px;">Fecha</th>
                            <th style="padding:10px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(r => `
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:10px;">${r.client_name}</td>
                                <td style="padding:10px;">${r.document_number}</td>
                                <td style="padding:10px;">${r.phone || "-"}</td>
                                <td style="padding:10px; font-weight:bold; color: #27ae60;">$${parseFloat(r.amount).toLocaleString()}</td>
                                <td style="padding:10px;">${new Date(r.created_at).toLocaleString()}</td>
                                <td style="padding:10px;">
                                    <button onclick="approveRecharge(${r.id})" style="background:#27ae60; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; margin-right: 5px;">✅ Aprobar</button>
                                    <button onclick="rejectRecharge(${r.id})" style="background:#e74c3c; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">❌ Rechazar</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        })
        .catch(err => {
            console.error(err);
            document.getElementById("rechargeRequests").innerHTML = "<p style='color:red'>Error cargando solicitudes</p>";
        });
}

function approveRecharge(id) {
    if (!confirm("¿Aprobar esta recarga de saldo?")) return;
    
    fetch(`/balance/approve/${id}`, { method: "POST" })
        .then(res => res.json())
        .then(data => {
            alert("✅ Recarga aprobada");
            loadRechargeRequests();
        })
        .catch(err => alert("Error aprobando"));
}

function rejectRecharge(id) {
    if (!confirm("¿Rechazar esta recarga?")) return;
    
    fetch(`/balance/reject/${id}`, { method: "POST" })
        .then(res => res.json())
        .then(data => {
            alert("Recarga rechazada");
            loadRechargeRequests();
        })
        .catch(err => alert("Error rechazando"));
}

// --- LÓGICA DE VENTAS ---
function loadSales() {
    fetch("/sales")
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById("salesList");
            
            if (!data || data.length === 0) {
                container.innerHTML = "<p style='color: #666;'>No hay ventas registradas</p>";
                return;
            }
            
            const totalVentas = data.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);
            
            container.innerHTML = `
                <div style="background: #d63384; color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <strong>Total Ventas: $${totalVentas.toLocaleString()}</strong>
                    <br><small>${data.length} ventas registradas</small>
                </div>
                <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background:#ffb3c1; color:white;">
                            <th style="padding:10px; text-align:left;">#</th>
                            <th style="padding:10px; text-align:left;">Fecha</th>
                            <th style="padding:10px; text-align:left;">Cliente</th>
                            <th style="padding:10px; text-align:left;">Documento</th>
                            <th style="padding:10px; text-align:left;">Total</th>
                            <th style="padding:10px; text-align:left;">Items</th>
                            <th style="padding:10px; text-align:left;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(s => `
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:10px;">${s.id}</td>
                                <td style="padding:10px;">${new Date(s.created_at).toLocaleDateString()}</td>
                                <td style="padding:10px;">${s.client_name || "Sin cliente"}</td>
                                <td style="padding:10px;">${s.client_document || "-"}</td>
                                <td style="padding:10px; font-weight:bold;">$${parseFloat(s.total).toLocaleString()}</td>
                                <td style="padding:10px;">
                                    <span style="background:#3498db; color:white; padding:3px 8px; border-radius:10px; font-size:12px;">
                                        ${s.items ? s.items.length : 0} productos
                                    </span>
                                </td>
                                <td style="padding:10px;">
                                    <button onclick="printInvoice(${s.id})" style="background:#27ae60; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">📄 Factura</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        })
        .catch(err => {
            console.error(err);
            document.getElementById("salesList").innerHTML = "<p style='color:red'>Error cargando ventas</p>";
        });
}

async function printInvoice(saleId) {
    try {
        const res = await fetch(`/sales/${saleId}`);
        const sale = await res.json();
        
        if (!res.ok || sale.error) {
            alert("Error cargando la venta");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(22);
        doc.setTextColor(214, 51, 132);
        doc.text("NAIL SALON", 105, 20, { align: "center" });

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text("Factura de Venta", 105, 28, { align: "center" });

        doc.setDrawColor(214, 51, 132);
        doc.line(20, 32, 190, 32);

        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(`Factura #${sale.id}`, 20, 42);
        doc.text(`Fecha: ${new Date(sale.created_at).toLocaleDateString("es-CO")}`, 140, 42);
        doc.text(`Cliente: ${sale.client_name || "Sin cliente"}`, 20, 50);
        doc.text(`Documento: ${sale.client_document || "-"}`, 20, 58);
        doc.text(`Teléfono: ${sale.client_phone || "-"}`, 140, 50);

        doc.line(20, 63, 190, 63);

        const items = sale.items || [];
        const tableData = items.map(item => [
            item.product_name || "Producto",
            item.quantity.toString(),
            `$${parseFloat(item.unit_price || 0).toLocaleString()}`,
            `$${parseFloat(item.subtotal || 0).toLocaleString()}`
        ]);

        doc.autoTable({
            startY: 68,
            head: [["Producto", "Cant.", "Precio Unit.", "Subtotal"]],
            body: tableData,
            headStyles: { fillColor: [214, 51, 132] },
            styles: { fontSize: 10 },
            columnStyles: {
                0: { cellWidth: 70 },
                1: { cellWidth: 25, halign: "center" },
                2: { cellWidth: 35, halign: "right" },
                3: { cellWidth: 40, halign: "right" }
            }
        });

        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(14);
        doc.setFont(undefined, "bold");
        doc.text(`Total: $${parseFloat(sale.total || 0).toLocaleString()}`, 190, finalY, { align: "right" });

        doc.setDrawColor(214, 51, 132);
        doc.line(20, finalY + 5, 190, finalY + 5);

        doc.setFontSize(8);
        doc.setFont(undefined, "normal");
        doc.setTextColor(150);
        doc.text("Gracias por su compra - Nail Salon", 105, finalY + 15, { align: "center" });

        doc.save(`Factura_${sale.id}_${sale.client_name || "cliente"}.pdf`);
    } catch (err) {
        console.error(err);
        alert("Error generando la factura");
    }
}

async function generateSalesPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    try {
        const res = await fetch("/sales");
        const sales = await res.json();
        
        if (sales.length === 0) return alert("No hay ventas para exportar");
        
        const totalVentas = sales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);
        
        doc.setFontSize(18);
        doc.setTextColor(214, 51, 132);
        doc.text("Reporte de Ventas - Nail Salon", 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28);
        doc.text(`Total de ventas: $${totalVentas.toLocaleString()}`, 14, 34);
        doc.text(`Número de ventas: ${sales.length}`, 14, 40);
        
        const rows = sales.map(s => [
            s.id,
            new Date(s.created_at).toLocaleDateString(),
            s.client_name || "Sin cliente",
            s.client_document || "-",
            `$${parseFloat(s.total).toLocaleString()}`
        ]);
        
        doc.autoTable({
            startY: 50,
            head: [['#', 'Fecha', 'Cliente', 'Documento', 'Total']],
            body: rows,
            headStyles: { fillColor: [255, 105, 180] },
            styles: { fontSize: 9 }
        });
        
        doc.save("Reporte_Ventas_NailSalon.pdf");
        
    } catch (error) {
        alert("Error generando el PDF");
        console.error(error);
    }
}

// --- LÓGICA DE PRODUCTOS (INVENTARIO) ---
function loadProducts() {
    fetch("/products")
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById("productsList");
            
            if (!data || data.length === 0) {
                container.innerHTML = "<p style='color: #666;'>No hay productos en inventario</p>";
                return;
            }
            
            container.innerHTML = `
                <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background:#ffb3c1; color:white;">
                            <th style="padding:10px; text-align:left;">Producto</th>
                            <th style="padding:10px; text-align:left;">Categoría</th>
                            <th style="padding:10px; text-align:left;">Stock</th>
                            <th style="padding:10px; text-align:left;">Precio</th>
                            <th style="padding:10px; text-align:left;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(p => `
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:10px;">
                                    <strong>${p.name}</strong><br>
                                    <small style="color:#666;">${p.description || ""}</small>
                                </td>
                                <td style="padding:10px;">${p.category || "-"}</td>
                                <td style="padding:10px;">
                                    <span style="color: ${p.stock <= 5 ? '#e74c3c' : '#27ae60'}; font-weight:bold;">
                                        ${p.stock} ${p.unit}
                                    </span>
                                </td>
                                <td style="padding:10px;">$${parseFloat(p.price).toLocaleString()}</td>
                                <td style="padding:10px;">
                                    <button onclick="updateStock(${p.id}, ${p.stock}, 'add')" style="background:#27ae60; color:white; border:none; padding:5px 8px; border-radius:3px; cursor:pointer;">+</button>
                                    <button onclick="updateStock(${p.id}, ${p.stock}, 'subtract')" style="background:#e74c3c; color:white; border:none; padding:5px 8px; border-radius:3px; cursor:pointer;">-</button>
                                    <button onclick="editProduct(${p.id}, '${p.name}', '${p.category || ''}', ${p.stock}, ${p.price}, '${p.unit}', '${p.description || ''}')" style="background:#3498db; color:white; border:none; padding:5px 8px; border-radius:3px; cursor:pointer;">✏️</button>
                                    <button onclick="deleteProduct(${p.id})" style="background:#e74c3c; color:white; border:none; padding:5px 8px; border-radius:3px; cursor:pointer;">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        })
        .catch(err => {
            console.error(err);
            document.getElementById("productsList").innerHTML = "<p style='color:red'>Error cargando inventario</p>";
        });
}

function createProduct() {
    const data = {
        name: document.getElementById("prodName").value,
        category: document.getElementById("prodCategory").value,
        unit: document.getElementById("prodUnit").value,
        price: document.getElementById("prodPrice").value,
        stock: document.getElementById("prodStock").value,
        description: document.getElementById("prodDesc").value
    };

    if (!data.name || !data.price || data.stock === "") {
        alert("Nombre, precio y stock son obligatorios");
        return;
    }

    fetch("/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(result => {
        alert("Producto agregado");
        document.getElementById("prodName").value = "";
        document.getElementById("prodCategory").value = "";
        document.getElementById("prodUnit").value = "";
        document.getElementById("prodPrice").value = "";
        document.getElementById("prodStock").value = "";
        document.getElementById("prodDesc").value = "";
        loadProducts();
    })
    .catch(err => alert("Error creando producto"));
}

function updateStock(id, currentStock, operation) {
    fetch(`/products/${id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: currentStock, operation })
    })
    .then(() => loadProducts())
    .catch(err => alert("Error actualizando stock"));
}

function editProduct(id, name, category, stock, price, unit, description) {
    const newName = prompt("Nombre:", name);
    if (newName === null) return;
    
    const newCategory = prompt("Categoría:", category);
    const newStock = prompt("Stock:", stock);
    const newPrice = prompt("Precio:", price);
    const newUnit = prompt("Unidad:", unit);
    const newDesc = prompt("Descripción:", description);

    fetch(`/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: newName,
            category: newCategory,
            stock: parseInt(newStock),
            price: parseFloat(newPrice),
            unit: newUnit,
            description: newDesc
        })
    })
    .then(() => loadProducts())
    .catch(err => alert("Error actualizando producto"));
}

function deleteProduct(id) {
    if (!confirm("¿Eliminar este producto?")) return;
    
    fetch(`/products/${id}`, { method: "DELETE" })
        .then(() => loadProducts())
        .catch(err => alert("Error eliminando producto"));
}

// --- LÓGICA DE CLIENTES ---
function loadClients() {
    fetch("/clients")
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById("clientsList");
            
            if (!data || data.length === 0) {
                container.innerHTML = "<p style='color: #666;'>No hay clientes registrados</p>";
                return;
            }
            
            container.innerHTML = `
                <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background:#ffb3c1; color:white;">
                            <th style="padding:10px; text-align:left;">Nombre</th>
                            <th style="padding:10px; text-align:left;">Documento</th>
                            <th style="padding:10px; text-align:left;">Contacto</th>
                            <th style="padding:10px; text-align:left;">RUT</th>
                            <th style="padding:10px; text-align:left;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(c => `
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:10px;">${c.name}</td>
                                <td style="padding:10px;">${c.document_type} ${c.document_number}</td>
                                <td style="padding:10px;">${c.email || "-"}<br>${c.phone || "-"}</td>
                                <td style="padding:10px;">
                                    ${c.rut_pdf ? '<span style="color: #27ae60;">✓ Adjunto</span>' : '<span style="color: #999;">Sin archivo</span>'}
                                </td>
                                <td style="padding:10px;">
                                    ${c.rut_pdf ? `<a href="/clients/${c.id}/rut" target="_blank" style="background:#3498db; color:white; padding:5px 10px; border-radius:5px; text-decoration:none; margin-right:5px;">Ver RUT</a>` : ''}
                                    <button onclick="deleteClient(${c.id})" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Eliminar</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        })
        .catch(err => {
            console.error(err);
            document.getElementById("clientsList").innerHTML = "<p style='color:red'>Error cargando clientes</p>";
        });
}

function deleteClient(id) {
    if (!confirm("¿Eliminar este cliente?")) return;
    
    fetch(`/clients/${id}`, { method: "DELETE" })
        .then(() => loadClients())
        .catch(err => alert("Error eliminando cliente"));
}

// --- LÓGICA DE USUARIOS ---
function loadUsers() {
    const user = JSON.parse(localStorage.getItem("user"));
    
    fetch(`/auth/users?adminEmail=${encodeURIComponent(user.email)}`)
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById("usersList");
            if (data.error) {
                container.innerHTML = `<p style="color:red">${data.error}</p>`;
                return;
            }
            container.innerHTML = `
                <table style="width:100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background:#ffb3c1; color:white;">
                            <th style="padding:10px; text-align:left;">Nombre</th>
                            <th style="padding:10px; text-align:left;">Email</th>
                            <th style="padding:10px; text-align:left;">Rol</th>
                            <th style="padding:10px; text-align:left;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(u => `
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:10px;">${u.name}</td>
                                <td style="padding:10px;">${u.email}</td>
                                <td style="padding:10px;">
                                    <span style="background:${u.role === 'admin' ? '#d63384' : '#6c757d'}; color:white; padding:3px 8px; border-radius:10px; font-size:12px;">
                                        ${u.role}
                                    </span>
                                </td>
                                <td style="padding:10px;">
                                    ${u.email !== user.email ? `
                                        <button onclick="deleteUser(${u.id})" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Eliminar</button>
                                    ` : '<span style="color:#999;">(tú)</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        })
        .catch(err => {
            console.error(err);
            document.getElementById("usersList").innerHTML = "<p style='color:red'>Error cargando usuarios</p>";
        });
}

function createUser() {
    const user = JSON.parse(localStorage.getItem("user"));
    const name = document.getElementById("newUserName").value;
    const email = document.getElementById("newUserEmail").value;
    const password = document.getElementById("newUserPassword").value;
    const role = document.getElementById("newUserRole").value;

    if (!name || !email || !password) {
        alert("Todos los campos son obligatorios");
        return;
    }

    fetch("/auth/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, adminEmail: user.email })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
        } else {
            alert("Usuario creado exitosamente");
            document.getElementById("newUserName").value = "";
            document.getElementById("newUserEmail").value = "";
            document.getElementById("newUserPassword").value = "";
            loadUsers();
        }
    })
    .catch(err => alert("Error creando usuario"));
}

function deleteUser(id) {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!confirm("¿Estás seguro de eliminar este usuario?")) return;

    fetch(`/auth/users/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail: user.email })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
        } else {
            loadUsers();
        }
    })
    .catch(err => alert("Error eliminando usuario"));
}

// --- LÓGICA DE SERVICIOS (PostgreSQL) ---
function loadServices() {
    fetch("/services")
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById("services");
            container.innerHTML = "";
            data.forEach(s => {
                container.innerHTML += `
                    <div class="item-service">
                        <span><strong>${s.title}</strong> - $${s.price}</span>
                        <button onclick="deleteService(${s.id})" style="color:red; background:none; border:none; cursor:pointer; font-weight:bold;">Eliminar</button>
                    </div>`;
            });
        });
}

function createService() {
    const user = JSON.parse(localStorage.getItem("user"));
    const title = document.getElementById("title").value;
    const price = document.getElementById("price").value;
    const image = document.getElementById("image").value;

    fetch("/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, price, image, role: user.role })
    }).then(() => {
        alert("Servicio creado");
        location.reload();
    });
}

function deleteService(id) {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!confirm("¿Eliminar este servicio?")) return;
    fetch(`/services/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: user.role })
    }).then(() => loadServices());
}

// --- LÓGICA DE PQRS (MongoDB - deshabilitado temporalmente) ---
function loadPQRS() {
    const container = document.getElementById("pqrsList");
    const section = document.getElementById("admin-pqrs-section");
    
    // Ocultar sección de PQRS ya que MongoDB está deshabilitado
    if (section) section.style.display = "none";
    container.innerHTML = "<p style='color:#999;'>PQRS temporalmente deshabilitado</p>";
    return;

    fetch("/api/pqrs")
        .then(res => res.json())
        .then(data => {
            container.innerHTML = "";
            if (data.length === 0) {
                container.innerHTML = "<p>No hay mensajes en el buzón.</p>";
                return;
            }

            data.forEach(item => {
                // Definir color según el estado
                let colorBadge = "#f39c12"; // Naranja (Pendiente)
                if (item.estado === "completada") colorBadge = "#27ae60"; // Verde
                if (item.estado === "cancelada") colorBadge = "#e74c3c"; // Rojo

                container.innerHTML += `
                    <div class="pqrs-box">
                        <div class="pqrs-header">
                            <span class="badge" style="background: ${colorBadge}">${item.estado.toUpperCase()}</span>
                            <span>${new Date(item.fecha).toLocaleString()}</span>
                        </div>
                        <p style="margin: 5px 0;"><strong>${item.nombre}</strong> (${item.email})</p>
                        <p style="font-style: italic; color: #444;">"${item.mensaje}"</p>
                        
                        <div style="margin-top: 10px; display: flex; gap: 10px;">
                            <button onclick="updateStatus('${item._id}', 'completada')" 
                                style="background:#27ae60; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:12px;">
                                ✅ Completar
                            </button>
                            <button onclick="updateStatus('${item._id}', 'cancelada')" 
                                style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:12px;">
                                ❌ Cancelar
                            </button>
                        </div>
                    </div>`;
            });
        })
        .catch(err => {
            console.error("Error cargando PQRS:", err);
            container.innerHTML = "<p style='color:red;'>Error al conectar con MongoDB.</p>";
        });
}

// Función para actualizar el estado en MongoDB
function updateStatus(id, nuevoEstado) {
    fetch(`/api/pqrs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado })
    })
    .then(res => {
        if (!res.ok) throw new Error("Error al actualizar");
        loadPQRS(); // Recargar la lista para ver los cambios
    })
    .catch(err => alert("Error: " + err.message));
}

// --- GENERAR REPORTE PDF ---
async function generarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    try {
        const response = await fetch("/api/pqrs");
        const data = await response.json();

        if (data.length === 0) return alert("No hay datos para exportar.");

        doc.setFontSize(18);
        doc.setTextColor(214, 51, 132); 
        doc.text("Reporte de PQRS Recibidas", 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28);

        const rows = data.map(item => [
            new Date(item.fecha).toLocaleDateString(),
            item.tipo.toUpperCase(),
            item.nombre,
            item.mensaje,
            item.estado.toUpperCase()
        ]);

        doc.autoTable({
            startY: 35,
            head: [['Fecha', 'Tipo', 'Cliente', 'Mensaje', 'Estado']],
            body: rows,
            headStyles: { fillColor: [255, 105, 180] }, 
            styles: { fontSize: 8, overflow: 'linebreak' },
            columnStyles: { 3: { cellWidth: 80 } } 
        });

        doc.save("Reporte_NailsBar_PQRS.pdf");

    } catch (error) {
        alert("Error generando el PDF");
        console.error(error);
    }
}

// --- SALDO EN CAJA ---
function loadCashBox() {
    fetch("/sales")
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById("cashBox");
            
            if (!data || data.length === 0) {
                container.innerHTML = `
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; text-align: center;">
                        <h3 style="color: #666;">💰 Saldo en Caja: $0</h3>
                        <p style="color: #999;">No hay ventas realizadas aún</p>
                    </div>
                `;
                return;
            }
            
            const total = data.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);
            
            container.innerHTML = `
                <div style="background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; padding: 30px; border-radius: 15px; text-align: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; font-size: 36px;">$${total.toLocaleString()}</h2>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Saldo acumulado en caja</p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; text-align: center;">
                        <strong style="color: #d63384; font-size: 24px;">${data.length}</strong>
                        <p style="margin: 5px 0 0 0; color: #666;">Ventas realizadas</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; text-align: center;">
                        <strong style="color: #3498db; font-size: 24px;">${new Date(data[0].created_at).toLocaleDateString()}</strong>
                        <p style="margin: 5px 0 0 0; color: #666;">Última venta</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; text-align: center;">
                        <strong style="color: #9b59b6; font-size: 24px;">$${Math.round(total / data.length).toLocaleString()}</strong>
                        <p style="margin: 5px 0 0 0; color: #666;">Promedio por venta</p>
                    </div>
                </div>
                <h3 style="color: #27ae60;">Historial de Ventas</h3>
                <table style="width:100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background:#27ae60; color:white;">
                            <th style="padding:10px;"># Venta</th>
                            <th style="padding:10px;">Fecha</th>
                            <th style="padding:10px;">Cliente</th>
                            <th style="padding:10px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.slice(0, 10).map(s => `
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:10px;">${s.id}</td>
                                <td style="padding:10px;">${new Date(s.created_at).toLocaleString()}</td>
                                <td style="padding:10px;">${s.client_name || "Sin cliente"}</td>
                                <td style="padding:10px; font-weight:bold; color: #27ae60;">$${parseFloat(s.total).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${data.length > 10 ? `<p style="color: #666; text-align: center; margin-top: 10px;">... y ${data.length - 10} ventas más</p>` : ''}
            `;
        })
        .catch(err => {
            console.error(err);
            document.getElementById("cashBox").innerHTML = "<p style='color:red'>Error cargando saldo</p>";
        });
}

async function generateCashReportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    try {
        const res = await fetch("/sales");
        const sales = await res.json();
        
        if (sales.length === 0) return alert("No hay ventas para exportar");
        
        const total = sales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);
        
        doc.setFontSize(20);
        doc.setTextColor(39, 174, 96);
        doc.text("💰 Saldo en Caja - Nail Salon", 14, 20);
        
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(`Saldo Total: $${total.toLocaleString()}`, 14, 32);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 40);
        doc.text(`Total de ventas: ${sales.length}`, 14, 46);
        doc.text(`Promedio por venta: $${Math.round(total / sales.length).toLocaleString()}`, 14, 52);
        
        const rows = sales.map(s => [
            s.id,
            new Date(s.created_at).toLocaleString(),
            s.client_name || "Sin cliente",
            s.client_document || "-",
            `$${parseFloat(s.total).toLocaleString()}`
        ]);
        
        doc.autoTable({
            startY: 60,
            head: [['#', 'Fecha', 'Cliente', 'Documento', 'Total']],
            body: rows,
            headStyles: { fillColor: [39, 174, 96] },
            styles: { fontSize: 9 }
        });
        
        doc.save("Saldo_Caja_NailSalon.pdf");
        
    } catch (error) {
        alert("Error generando el PDF");
        console.error(error);
    }
}