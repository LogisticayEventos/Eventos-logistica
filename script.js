const firebaseConfig = {
    apiKey: "AIzaSyAD_FPhpmmbuvnXUxKVlNpENdViPTIBaYU",
    authDomain: "sentinels-web.firebaseapp.com",
    projectId: "sentinels-web",
    storageBucket: "sentinels-web.firebasestorage.app",
    messagingSenderId: "565758042156",
    appId: "1:565758042156:web:2f63fe53f974acc43af189"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const ADMIN_EMAIL = "franboy1221@gmail.com";

let currentUserData = null;
let listadoCodigosInvitacion = [];
let listadoEquipos = [];

auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('view-auth').style.display = 'none';
        document.getElementById('view-home').style.display = 'flex';
        db.collection("usuarios").doc(user.email).update({ lastLogin: Date.now() }).catch(() => {});
        loadUser();
    } else {
        document.getElementById('view-auth').style.display = 'block';
        document.getElementById('view-home').style.display = 'none';
        listenInviteCodes();
        listenEquipos();
    }
});

function listenEquipos() {
    db.collection("configuracion").doc("equipos").onSnapshot(doc => {
        listadoEquipos = doc.exists ? doc.data().lista : ["Verde", "Naranja", "Morado", "Azul"];
        actualizarDesplegablesEquipos();
        actualizarPanelAdminEquipos();
    });
}

function actualizarDesplegablesEquipos() {
    const selects = document.querySelectorAll('.dynamic-colors');
    selects.forEach(sel => {
        const currentVal = sel.value;
        const isFilter = sel.id.includes('filter');
        const isReg = sel.id === 'reg-color';
        sel.innerHTML = "";
        if(isFilter) sel.innerHTML = `<option value="Todos">Todos los Equipos</option>`;
        if(isReg) sel.innerHTML = `<option value="" disabled ${!currentVal ? 'selected' : ''}>Color de Equipo</option>`;
        listadoEquipos.forEach(col => {
            sel.innerHTML += `<option value="${col}">${col}</option>`;
        });
        if(currentVal) sel.value = currentVal;
    });
    const container = document.getElementById('com-destinatarios-list');
    if(container) {
        container.innerHTML = `<label><input type="checkbox" name="dest-color" value="Todos" checked><span>TODOS</span></label>`;
        listadoEquipos.forEach(col => {
            container.innerHTML += `<label><input type="checkbox" name="dest-color" value="${col}"><span>${col.toUpperCase()}</span></label>`;
        });
    }
}

function actualizarPanelAdminEquipos() {
    const listDiv = document.getElementById('admin-teams-list');
    if(!listDiv) return;
    listDiv.innerHTML = "";
    listadoEquipos.forEach(col => {
        listDiv.innerHTML += `<div class="team-mini-badge">${col} <span onclick="eliminarEquipo('${col}')">✕</span></div>`;
    });
}

function agregarEquipo() {
    const input = document.getElementById('new-team-name');
    const valor = input.value.trim();
    if(!valor) return;
    if(listadoEquipos.includes(valor)) return notify("⚠️ El equipo ya existe");
    const nuevaLista = [...listadoEquipos, valor];
    db.collection("configuracion").doc("equipos").set({ lista: nuevaLista }).then(() => { input.value = ""; notify("✅ Equipo añadido"); });
}

function eliminarEquipo(col) {
    if(!confirm(`¿Eliminar el equipo ${col}?`)) return;
    const nuevaLista = listadoEquipos.filter(c => c !== col);
    db.collection("configuracion").doc("equipos").set({ lista: nuevaLista }).then(() => notify("🗑️ Equipo eliminado"));
}

function listenInviteCodes() {
    db.collection("configuracion").doc("seguridad").onSnapshot(doc => {
        listadoCodigosInvitacion = (doc.exists && doc.data().listaCodigos) ? doc.data().listaCodigos : ["LOGISTICA001"];
        actualizarPanelAdminCodigos();
    });
}

function actualizarPanelAdminCodigos() {
    const listDiv = document.getElementById('admin-invite-codes-list');
    if(!listDiv) return;
    listDiv.innerHTML = "";
    listadoCodigosInvitacion.forEach(cod => {
        listDiv.innerHTML += `<div class="team-mini-badge" style="background:#fef9c3; border: 1px solid #fde047;">${cod} <span onclick="eliminarCodigoInvitacion('${cod}')">✕</span></div>`;
    });
}

function agregarCodigoInvitacion() {
    const input = document.getElementById('new-invite-code');
    const nuevoCodigo = input.value.trim();
    if(nuevoCodigo.length < 4) return notify("⚠️ El código debe ser más largo");
    if(listadoCodigosInvitacion.includes(nuevoCodigo)) return notify("⚠️ El código ya existe");
    
    const nuevaLista = [...listadoCodigosInvitacion, nuevoCodigo];
    db.collection("configuracion").doc("seguridad").set({
        listaCodigos: nuevaLista,
        actualizadoPor: auth.currentUser.email,
        fechaCambio: Date.now()
    }).then(() => { 
        notify("✅ Código añadido"); 
        input.value = ""; 
    });
}

function eliminarCodigoInvitacion(cod) {
    if(listadoCodigosInvitacion.length <= 1) return notify("⚠️ Debe haber al menos un código");
    if(!confirm(`¿Eliminar el código "${cod}"?`)) return;
    const nuevaLista = listadoCodigosInvitacion.filter(c => c !== cod);
    db.collection("configuracion").doc("seguridad").update({
        listaCodigos: nuevaLista
    }).then(() => notify("🗑️ Código eliminado"));
}

function loadUser() {
    const email = auth.currentUser.email;
    db.collection("usuarios").doc(email).onSnapshot(doc => {
        const d = doc.data() || {};
        currentUserData = d;
        currentUserData.email = email;
        listenInviteCodes();
        listenEquipos();
        let rango = (email === ADMIN_EMAIL) ? "Administrador" : (d.rango || "Recreador");
        document.getElementById('p-full-name').innerText = (d.nombre + " " + (d.apellido || "")).toUpperCase();
        document.getElementById('p-rango-view').innerText = rango.toUpperCase();
        document.getElementById('p-initials').innerText = d.nombre ? d.nombre[0] : "S";
        document.getElementById('p-equipo-view').innerText = (d.color || "---").toUpperCase();
        document.getElementById('p-doc-view').innerText = d.doc || "---";
        document.getElementById('p-tel-view').innerText = d.tel || "---";
        document.getElementById('p-nac-view').innerText = d.nacimiento || "---";
        document.getElementById('p-edad-view').innerText = calcularEdad(d.nacimiento).toUpperCase();
        const lastLoginStr = d.lastLogin ? new Date(d.lastLogin).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "---";
        document.getElementById('p-conexion-view').innerText = lastLoginStr;
        document.getElementById('user-rank-badge').innerText = rango.toUpperCase();
        const formEdit = document.getElementById('perfil-edit-form');
        if (d.doc && d.tel && d.nacimiento) { formEdit.style.display = 'none'; } else { formEdit.style.display = 'flex'; }
        const esAdmin = (email === ADMIN_EMAIL), esCGeneral = (rango === "Coordinador General"), esCoordinador = (rango === "Coordinador"), esRecreador = (rango === "Recreador");
        
        document.getElementById('container-buscador-global').style.display = esAdmin ? 'block' : 'none';

        document.getElementById('nav-usuarios-adm').style.display = (!esRecreador) ? 'block' : 'none';
        const navAdmin = document.getElementById('nav-administracion');
        if (esAdmin || esCGeneral || esCoordinador) {
            navAdmin.style.display = 'block';
            document.getElementById('admin-edit-panel-code').style.display = esAdmin ? 'block' : 'none';
            document.getElementById('admin-edit-panel-teams').style.display = esAdmin ? 'block' : 'none';
            document.getElementById('admin-delete-range-panel').style.display = esAdmin ? 'block' : 'none';
            document.getElementById('admin-delete-boletas-panel').style.display = esAdmin ? 'block' : 'none';
        } else {
            navAdmin.style.display = 'none';
        }
        document.getElementById('admin-com-form').style.display = (esAdmin || esCGeneral) ? 'flex' : 'none';
        document.getElementById('filter-color').style.display = (esRecreador) ? 'none' : 'block';
        const canExport = (esAdmin || esCGeneral);
        document.getElementById('btn-rep-ventas').style.display = canExport ? 'block' : 'none';
        document.getElementById('btn-rep-personal').style.display = canExport ? 'block' : 'none';
        document.querySelectorAll('.col-rango-admin').forEach(el => el.style.display = esAdmin ? 'table-cell' : 'none');
        document.querySelectorAll('.col-rango-permiso').forEach(el => el.style.display = (!esRecreador) ? 'table-cell' : 'none');
        listenData();
        if(!esRecreador) loadAllUsers();
        showSection('comunicados');
        actualizarListaEntregadasVisual();
    });
}

function showSection(id) {
    document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const target = document.getElementById('sec-' + id);
    if(target) target.style.display = 'block';
    const nav = document.getElementById('nav-' + id);
    if(nav) nav.classList.add('active');
}

function registrarConCodigo() {
    const n = document.getElementById('reg-nombre').value, a = document.getElementById('reg-apellido').value, e = document.getElementById('reg-email').value, p = document.getElementById('reg-pass').value, col = document.getElementById('reg-color').value, c = document.getElementById('reg-invite').value.trim();
    if(!listadoCodigosInvitacion.includes(c)) return notify("❌ Código Incorrecto o Expirado");
    auth.createUserWithEmailAndPassword(e, p).then(() => db.collection("usuarios").doc(e).set({ nombre: n, apellido: a, color: col, creado: Date.now(), rango: 'Recreador', inscripcion: 'NO', codigoUsado: c }).then(() => location.reload())).catch(err => notify(err.message));
}

function listenData() {
    const email = auth.currentUser.email;
    const r = (email === ADMIN_EMAIL) ? "Administrador" : (currentUserData.rango || "Recreador");
    const esAdmin = (email === ADMIN_EMAIL), esCGeneral = (r === "Coordinador General"), esCoordinador = (r === "Coordinador");
    const filterCol = document.getElementById('filter-color').value, filterEst = document.getElementById('filter-estado').value;

    db.collection("boletas").orderBy("creado", "desc").onSnapshot(async snap => {
        const body = document.getElementById('lista-boletas-body'); body.innerHTML = ""; 
        const uSnap = await db.collection("usuarios").get();
        const mapaColor = {}; 
        const mapaEntregadas = {};
        const mapaRecreadores = {}; 

        uSnap.forEach(u => {
            const data = u.data();
            mapaColor[u.id] = data.color || 'Gris';
            mapaEntregadas[u.id] = data.boletasEntregadas || [];
        });
        
        let contadorTotal = 0, activas = 0, pendientes = 0;
        let boletasPorEquipo = {};
        let setBoletasVendidasGlobal = new Set();

        snap.forEach(doc => {
            const b = doc.data(); 
            const col = mapaColor[b.vendedor] || 'Gris';
            if(b.n) setBoletasVendidasGlobal.add(b.n.toString());

            const recKey = b.recreador || 'Sin Nombre';
            if(!mapaRecreadores[recKey]) {
                mapaRecreadores[recKey] = { 
                    color: col, 
                    total: 0, 
                    activas: 0, 
                    pendientes: 0, 
                    ids: [], 
                    emailVendedor: b.vendedor,
                    entregadas: mapaEntregadas[b.vendedor] ? mapaEntregadas[b.vendedor].length : 0,
                    fechaVenta: b.creado ? new Date(b.creado).toLocaleDateString() : '---'
                };
            }

            contadorTotal++;
            if(b.estado === 'Activa') { activas++; mapaRecreadores[recKey].activas++; } 
            else { pendientes++; mapaRecreadores[recKey].pendientes++; }
            
            mapaRecreadores[recKey].total++;
            mapaRecreadores[recKey].ids.push({ id: doc.id, ...b });

            if(!boletasPorEquipo[col]) boletasPorEquipo[col] = { total: 0, activas: 0, pendientes: 0 };
            boletasPorEquipo[col].total++;
            if(b.estado === 'Activa') boletasPorEquipo[col].activas++; else boletasPorEquipo[col].pendientes++;
        });

        let index = 1;
        for (let nombre in mapaRecreadores) {
            const data = mapaRecreadores[nombre];
            if(!(esAdmin || esCGeneral || esCoordinador) && data.emailVendedor !== email) continue;
            if(filterCol !== "Todos" && data.color !== filterCol) continue;
            
            if(filterEst === "Activa" && data.activas === 0) continue;
            if(filterEst === "Pendiente" && data.pendientes === 0) continue;

            const accionHtml = (esAdmin) 
                ? `<td><button class="btn-status btn-delete" style="padding: 4px 8px; font-size: 0.5rem;" onclick="eliminarTodosRegistrosRecreador('${nombre}')">ELIMINAR</button></td>`
                : `<td><span class="badge-rango" style="background:#e2e8f0; font-size:0.5rem;">${data.emailVendedor === email ? 'MIS VENTAS' : 'REGISTRO'}</span></td>`;

            body.innerHTML += `
                <tr>
                    <td style="font-weight:800;">${index++}</td>
                    <td><span class="team-dot" style="background:${data.color.toLowerCase()}"></span> ${data.color}</td>
                    <td style="font-weight:800; color:var(--primary); cursor:pointer; text-decoration:underline;" onclick="abrirGestionBoletas('${nombre}')">
                        ${nombre.toUpperCase()}
                    </td>
                    <td style="font-weight:800; color:#6366f1;">${data.entregadas}</td>
                    <td><b>${data.total}</b> (A:${data.activas} | P:${data.pendientes})</td>
                    <td style="font-size:0.55rem;">${data.fechaVenta}</td>
                    ${accionHtml}
                </tr>`;
        }

        document.getElementById('conteo-boletas-total').innerText = "Recreadores activos: " + (index - 1);
        actualizarListaEntregadasVisual(setBoletasVendidasGlobal);

        if(esAdmin || esCGeneral || esCoordinador) {
            document.getElementById('resumen-boletas-total').innerText = contadorTotal;
            document.getElementById('resumen-boletas-activas').innerText = activas;
            document.getElementById('resumen-boletas-pendientes').innerText = pendientes;
            let htmlBoletasE = "<p class='mini-title'>BOLETAS POR EQUIPO</p>";
            for(let eq in boletasPorEquipo) {
                htmlBoletasE += `<div class='summary-row'><span>${eq}</span><b>${boletasPorEquipo[eq].total} (A:${boletasPorEquipo[eq].activas})</b></div>`;
            }
            document.getElementById('resumen-boletas-equipos').innerHTML = htmlBoletasE;
        }
    });

    db.collection("comunicados").orderBy("fecha", "desc").onSnapshot(snap => {
        const list = document.getElementById('comunicados-list'); list.innerHTML = "";
        const userColor = currentUserData ? currentUserData.color : "Gris";
        snap.forEach(doc => { 
            const c = doc.data(); 
            if (!(esAdmin || esCGeneral)) {
                const destinatarios = c.destinatarios || ["Todos"];
                if (!destinatarios.includes("Todos") && !destinatarios.includes(userColor)) return;
            }
            const del = esAdmin ? `<button class="del-com-btn" onclick="db.collection('comunicados').doc('${doc.id}').delete()">✕</button>` : '';
            let extraInfo = "", countdownHtml = "", docBtn = "";
            if(c.linkDoc) docBtn = `<a href="${c.linkDoc}" target="_blank" class="com-doc-link">📁 DOCUMENTO</a>`;
            if(c.fechaEv) {
                const fEv = new Date(c.fechaEv + "T" + (c.horaEv || "00:00")), hoy = new Date();
                const dias = Math.ceil((fEv - hoy) / (1000 * 60 * 60 * 24));
                extraInfo = `<div class="com-meta-box"><span>📅 ${c.fechaEv}</span>${c.horaEv ? `<span>⏰ ${c.horaEv}</span>` : ''}${c.lugarEv ? `<span>📍 ${c.lugarEv}</span>` : ''}</div>`;
                if(dias > 0) countdownHtml = `<div class="com-countdown">Faltan <b>${dias}</b> días</div>`;
                else if (dias === 0) countdownHtml = `<div class="com-countdown today">¡Es Hoy!</div>`;
            }
            list.innerHTML += `<div class="com-card">${del}<div class="com-header"><span class="com-tag">INFO</span><h3>${c.titulo}</h3></div><p class="com-body">${c.mensaje}</p>${extraInfo}${docBtn}${countdownHtml}<div class="com-footer">Publicado: ${new Date(c.fecha).toLocaleDateString()}</div></div>`;
        });
    });
}

async function buscarDuenioBoleta() {
    const numero = document.getElementById('search-n-boleta').value.trim();
    const resultDiv = document.getElementById('resultado-busqueda-boleta');
    if(!numero) return notify("⚠️ Ingresa un número de boleta");

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<p style="font-size:0.6rem; color:var(--primary); font-weight:800;">Buscando...</p>`;

    const snapVentas = await db.collection("boletas").where("n", "==", numero).get();
    if(!snapVentas.empty) {
        const b = snapVentas.docs[0].data();
        const uDoc = await db.collection("usuarios").doc(b.vendedor).get();
        const u = uDoc.data() || { nombre: "Desconocido" };
        const colorEstado = b.estado === 'Activa' ? '#10b981' : '#f59e0b';
        
        resultDiv.innerHTML = `
            <div style="background: white; border: 2px solid ${colorEstado}; padding: 10px; border-radius: 12px; text-align: left;">
                <p style="margin:0; font-size:0.5rem; font-weight:800; color:${colorEstado};">ESTADO: VENDIDA (${b.estado})</p>
                <p style="margin:2px 0; font-size:0.8rem; font-weight:900;">RECREADOR: ${(u.nombre + " " + (u.apellido || "")).toUpperCase()}</p>
                <p style="margin:0; font-size:0.6rem; font-weight:700; color:#64748b;">EQUIPO: ${(u.color || "---").toUpperCase()}</p>
                <p style="margin:5px 0 0 0; font-size:0.55rem; color:var(--primary);">Comprador: <b>${b.c}</b></p>
            </div>`;
        return;
    }

    const snapUsers = await db.collection("usuarios").get();
    let recreadorEncontrado = null;
    snapUsers.forEach(doc => {
        const u = doc.data();
        if(u.boletasEntregadas && u.boletasEntregadas.includes(numero)) {
            recreadorEncontrado = { ...u, email: doc.id };
        }
    });

    if(recreadorEncontrado) {
        resultDiv.innerHTML = `
            <div style="background: #fee2e2; border: 2px solid #ef4444; padding: 10px; border-radius: 12px; text-align: left;">
                <p style="margin:0; font-size:0.5rem; font-weight:800; color:#ef4444;">ESTADO: FÍSICA (SIN VENTA REGISTRADA)</p>
                <p style="margin:2px 0; font-size:0.8rem; font-weight:900;">RECREADOR: ${(recreadorEncontrado.nombre + " " + (recreadorEncontrado.apellido || "")).toUpperCase()}</p>
                <p style="margin:0; font-size:0.6rem; font-weight:700; color:#64748b;">EQUIPO: ${(recreadorEncontrado.color || "---").toUpperCase()}</p>
            </div>`;
    } else {
        resultDiv.innerHTML = `<p style="font-size:0.6rem; color:#ef4444; font-weight:800; background:#fee2e2; padding:10px; border-radius:10px;">❌ BOLETA NO REGISTRADA EN EL SISTEMA</p>`;
    }
}

async function eliminarTodosRegistrosRecreador(nombreRecreador) {
    if (!confirm(`¿Estás seguro de eliminar TODOS los registros de boletas para: ${nombreRecreador}?`)) return;
    const snap = await db.collection("boletas").where("recreador", "==", nombreRecreador).get();
    let batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    batch.commit().then(() => notify(`🗑️ Registros de ${nombreRecreador} eliminados`));
}

async function abrirGestionBoletas(nombreRecreador) {
    const email = auth.currentUser.email;
    const r = (email === ADMIN_EMAIL) ? "Administrador" : (currentUserData.rango || "Recreador");
    const esAdmin = (email === ADMIN_EMAIL);
    const puedeEditar = (r === "Administrador" || r === "Coordinador General");
    
    const snap = await db.collection("boletas").where("recreador", "==", nombreRecreador).get();
    
    let entregadasHtml = "";
    if (snap.docs.length > 0) {
        const vEmail = snap.docs[0].data().vendedor;
        const uDoc = await db.collection("usuarios").doc(vEmail).get();
        const bEntregadas = uDoc.exists ? (uDoc.data().boletasEntregadas || []) : [];
        const setVendidas = new Set(snap.docs.map(d => d.data().n.toString()));
        
        entregadasHtml = `<p class="label-hint" style="margin-top:10px;">FÍSICAS REGISTRADAS:</p><div class="teams-flex-container" style="margin-bottom:15px;">`;
        bEntregadas.forEach(num => {
            const isSold = setVendidas.has(num.toString());
            const colB = isSold ? "#dcfce7" : "#fee2e2";
            const colS = isSold ? "#10b981" : "#ef4444";
            
            const delBtn = esAdmin ? `<span onclick="eliminarBoletaEntregadaDeOtro('${vEmail}', '${num}')" style="color:#ef4444; cursor:pointer; margin-left:4px;">✕</span>` : "";
            entregadasHtml += `<div class="team-mini-badge" style="background:${colB}; border:1px solid ${colS};">${num}${delBtn}</div>`;
        });
        entregadasHtml += `</div>`;
    }

    const render = document.getElementById('gestion-boletas-render');
    render.innerHTML = `<h3 style="font-size:0.9rem; color:var(--primary); margin-bottom:5px; border-bottom:2px solid var(--accent); padding-bottom:5px;">GESTIÓN: ${nombreRecreador.toUpperCase()}</h3>`;
    render.innerHTML += entregadasHtml;
    
    let htmlTable = `
        <div class="table-container" style="min-width:100%;">
            <table style="min-width:400px;">
                <thead>
                    <tr>
                        <th>N°</th>
                        <th>Comprador</th>
                        <th>Estado</th>
                        ${puedeEditar ? '<th>Acción</th>' : ''}
                    </tr>
                </thead>
                <tbody>`;
    
    snap.forEach(doc => {
        const b = doc.data();
        const colorEstado = b.estado === 'Activa' ? '#10b981' : '#f59e0b';
        let botones = "";
        if(puedeEditar) {
            const nuevoEstado = b.estado === 'Activa' ? 'Pendiente' : 'Activa';
            const icon = b.estado === 'Activa' ? '⏳' : '✓';
            botones = `
                <td style="display:flex; gap:5px; justify-content:center;">
                    <button class="btn-status" style="background:#e2e8f0;" onclick="cambiarEstado('${doc.id}', '${nuevoEstado}'); cerrarModalGestion();"> ${icon} </button>
                    <button class="btn-status btn-delete" onclick="eliminarBoleta('${doc.id}'); cerrarModalGestion();"> 🗑️ </button>
                </td>`;
        }
        htmlTable += `
            <tr>
                <td style="font-weight:800;">${b.n || '--'}</td>
                <td style="font-size:0.6rem;">${b.c || '--'}<br><small>${b.t || ''}</small></td>
                <td style="font-weight:800; color:${colorEstado}">${b.estado}</td>
                ${botones}
            </tr>`;
    });
    
    htmlTable += `</tbody></table></div>`;
    render.innerHTML += htmlTable;
    document.getElementById('modal-gestion-boletas').style.display = 'flex';
}

function cerrarModalGestion() { document.getElementById('modal-gestion-boletas').style.display = 'none'; }

function registrarBoletaEntregada() {
    const input = document.getElementById('input-boleta-entregada');
    const valor = input.value.trim();
    if(!valor) return;
    const entregadas = currentUserData.boletasEntregadas || [];
    if(entregadas.includes(valor)) return notify("⚠️ Esta boleta ya está registrada");
    entregadas.push(valor);
    db.collection("usuarios").doc(auth.currentUser.email).update({ boletasEntregadas: entregadas }).then(() => {
        input.value = "";
        notify("✅ Boleta registrada");
    });
}

function eliminarBoletaEntregada(num) {
    if(auth.currentUser.email !== ADMIN_EMAIL) return notify("⚠️ Solo el administrador puede borrar boletas físicas");
    const entregadas = currentUserData.boletasEntregadas.filter(n => n !== num);
    db.collection("usuarios").doc(auth.currentUser.email).update({ boletasEntregadas: entregadas }).then(() => notify("🗑️ Eliminada"));
}

async function eliminarBoletaEntregadaDeOtro(vEmail, num) {
    if(auth.currentUser.email !== ADMIN_EMAIL) return;
    if(!confirm("¿Eliminar registro físico de esta boleta?")) return;
    const uDoc = await db.collection("usuarios").doc(vEmail).get();
    const list = uDoc.data().boletasEntregadas || [];
    const nuevaLista = list.filter(n => n !== num);
    db.collection("usuarios").doc(vEmail).update({ boletasEntregadas: nuevaLista }).then(() => {
        notify("🗑️ Registro físico eliminado");
        cerrarModalGestion();
    });
}

function actualizarListaEntregadasVisual(setVendidas = null) {
    const container = document.getElementById('lista-entregadas-tags');
    if(!container || !currentUserData) return;
    container.innerHTML = "";
    const entregadas = currentUserData.boletasEntregadas || [];
    const esAdmin = (auth.currentUser.email === ADMIN_EMAIL);
    
    entregadas.forEach(num => {
        let isSold = false;
        if(setVendidas && setVendidas.has(num.toString())) isSold = true;
        const colorBg = isSold ? "#dcfce7" : "#fee2e2";
        const colorBorder = isSold ? "#10b981" : "#ef4444";
        
        const delBtn = esAdmin ? `<span onclick="eliminarBoletaEntregada('${num}')">✕</span>` : "";
        container.innerHTML += `<div class="team-mini-badge" style="background:${colorBg}; border: 1px solid ${colorBorder};">${num} ${delBtn}</div>`;
    });
}

function loadAllUsers() {
    const email = auth.currentUser.email;
    const userRango = (email === ADMIN_EMAIL) ? "Administrador" : (currentUserData ? currentUserData.rango : "Recreador");
    const esAdmin = (email === ADMIN_EMAIL);
    const search = document.getElementById('search-user').value.toLowerCase(), filterColor = document.getElementById('filter-user-color').value;

    db.collection("usuarios").orderBy("creado", "desc").onSnapshot(snap => {
        const body = document.getElementById('lista-usuarios-body'); body.innerHTML = "";
        let personalPorEquipo = {};
        let contadorVisual = 0;
        let totalUsuariosSistema = 0;

        snap.forEach(doc => {
            const u = doc.data(); if(doc.id === ADMIN_EMAIL) return;
            totalUsuariosSistema++;
            const eq = u.color || "Gris";
            const ins = u.inscripcion === "SI" ? "SI" : "NO";
            
            if(!personalPorEquipo[eq]) personalPorEquipo[eq] = { total: 0, si: 0, no: 0 };
            personalPorEquipo[eq].total++;
            if(ins === "SI") personalPorEquipo[eq].si++; else personalPorEquipo[eq].no++;

            const nom = (u.nombre + " " + (u.apellido || "")).toLowerCase();
            const rango = u.rango || "Recreador";
            const esRangoAlto = (rango === "Administrador" || rango === "Coordinador General" || rango === "Coordinador");
            if (!esAdmin && esRangoAlto) return;
            if((nom.includes(search) || (u.doc && u.doc.includes(search))) && (filterColor === "Todos" || u.color === filterColor)) {
                contadorVisual++;
                let colPermisos = "";
                const esCGeneral = (userRango === "Coordinador General"), esCoordinador = (userRango === "Coordinador");
                if(esAdmin || esCGeneral || esCoordinador) {
                    const statusIns = u.inscripcion === "SI" ? "SI" : "NO";
                    const classIns = u.inscripcion === "SI" ? "btn-approve" : "btn-delete";
                    const attrClick = (esAdmin || esCGeneral) ? `onclick="toggleInscripcion('${doc.id}', '${statusIns}')"` : `style="cursor:default; opacity:0.8;"`;
                    colPermisos += `<td><button class="btn-status ${classIns}" ${attrClick}>${statusIns}</button></td>`;
                }
                let colAdminOnly = "";
                if(esAdmin) {
                    colAdminOnly = `<td><select class="select-rango" onchange="asignarRango('${doc.id}', this.value)"><option value="" disabled selected>Cambiar</option><option value="Administrador">Admin</option><option value="Coordinador General">C. Gral</option><option value="Coordinador">Coord</option><option value="Recreador">Rec</option></select></td><td><button class="btn-status btn-delete" onclick="eliminarUsuario('${doc.id}')">🗑️</button></td>`;
                }
                let btnVer = `<td><button class="btn-status" style="background:#e2e8f0;" onclick="verCarnet('${doc.id}')">👁️</button></td>`;
                body.innerHTML += `<tr><td style="font-weight:800;">${contadorVisual}</td><td style="font-weight:700;">${u.nombre}<br><small>${doc.id}</small></td><td><span class="badge-rango">${rango}</span></td><td>${calcularEdad(u.nacimiento)}</td><td>${u.doc || '---'}</td><td>${u.tel || '---'} ${u.tel ? `<a href="https://wa.me/57${u.tel}" target="_blank" class="wa-quick-btn">💬</a>` : ""}</td><td>${u.color}</td><td style="font-size:0.6rem;">${u.creado ? new Date(u.creado).toLocaleDateString() : '---'}</td>${btnVer}${colPermisos}${colAdminOnly}</tr>`;
            }
        });

        document.getElementById('conteo-personal-total').innerText = "Total integrantes: " + contadorVisual;
        
        if(userRango !== "Recreador") {
            const resTotalAdmin = document.getElementById('resumen-personal-total-admin');
            if(resTotalAdmin) resTotalAdmin.innerText = totalUsuariosSistema;

            let htmlPersE = "<p class='mini-title'>EQUIPO (INSCRITOS)</p>";
            for(let eq in personalPorEquipo) {
                htmlPersE += `<div class='summary-row'><span>${eq}</span><b>${personalPorEquipo[eq].total} (SI:${personalPorEquipo[eq].si})</b></div>`;
            }
            document.getElementById('resumen-personal-equipos').innerHTML = htmlPersE;
        }
    });
}

function calcularEdad(fecha) { if(!fecha) return "---"; const hoy = new Date(); const cumple = new Date(fecha); let edad = hoy.getFullYear() - cumple.getFullYear(); const m = hoy.getMonth() - cumple.getMonth(); if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) { edad--; } return edad + " años"; }
function notify(m) { const c = document.getElementById('toast-container'); const t = document.createElement('div'); t.className = 'toast'; t.innerText = m; c.appendChild(t); setTimeout(() => t.remove(), 3000); }
function toggleAuth(v) { document.getElementById('auth-login').style.display = v === 'reg' ? 'none' : 'flex'; document.getElementById('auth-register').style.display = v === 'reg' ? 'flex' : 'none'; }
function handleLogin() { auth.signInWithEmailAndPassword(document.getElementById('login-email').value, document.getElementById('login-pass').value).catch(err => notify(err.message)); }
function handleLogout() { auth.signOut().then(() => location.reload()); }
function guardarPerfil() { const d = document.getElementById('edit-doc').value, t = document.getElementById('edit-tel').value, c = document.getElementById('edit-color').value, n = document.getElementById('edit-nacimiento').value; if(!d || !t || !n) return notify("⚠️ Completa todos los campos"); db.collection("usuarios").doc(auth.currentUser.email).update({ doc: d, tel: t, color: c, nacimiento: n }).then(() => notify("✅ Datos guardados")); }
function toggleInscripcion(email, estadoActual) { const nuevoEstado = estadoActual === "SI" ? "NO" : "SI"; db.collection("usuarios").doc(email).update({ inscripcion: nuevoEstado }).then(() => notify("📝 Inscripción: " + nuevoEstado)); }
function asignarRango(email, nuevoRango) { db.collection("usuarios").doc(email).update({ rango: nuevoRango }).then(() => notify("🎖️ Rango actualizado")); }
function cambiarEstado(id, nuevoEstado) { db.collection("boletas").doc(id).update({ estado: nuevoEstado }).then(() => notify("✅ Estado actualizado")); }
function eliminarBoleta(id) { if(confirm("¿Eliminar boleta?")) db.collection("boletas").doc(id).delete().then(() => notify("🗑️ Eliminada")); }
function eliminarUsuario(email) { if(confirm("¿Eliminar usuario?")) db.collection("usuarios").doc(email).delete().then(() => notify("🗑️ Usuario eliminado")); }
function cerrarModal() { document.getElementById('modal-carnet').style.display = 'none'; }
function inscribirBoleta() {
    const r = document.getElementById('ins-rec-nom').value, n = document.getElementById('ins-n-boleta').value, c = document.getElementById('ins-com-nom').value, t = document.getElementById('ins-com-tel').value;
    if(!n || !c) return notify("⚠️ Datos incompletos");
    db.collection("boletas").add({ recreador: r, n: n, c: c, t: t, vendedor: auth.currentUser.email, estado: 'Pendiente', creado: Date.now() }).then(() => { notify("🎫 Registrada"); ['ins-rec-nom','ins-n-boleta','ins-com-nom','ins-com-tel'].forEach(id => document.getElementById(id).value=""); });
}
function publicarComunicado() { 
    const t = document.getElementById('com-titulo').value, m = document.getElementById('com-mensaje').value, f = document.getElementById('com-fecha-ev').value, h = document.getElementById('com-hora-ev').value, l = document.getElementById('com-lugar-ev').value, ld = document.getElementById('com-link-doc').value;
    const checkboxes = document.querySelectorAll('input[name="dest-color"]:checked');
    const coloresSeleccionados = Array.from(checkboxes).map(cb => cb.value);
    if(!t || !m) return notify("⚠️ Título y mensaje obligatorios");
    db.collection("comunicados").add({ titulo: t, mensaje: m, destinatarios: coloresSeleccionados, fechaEv: f || null, horaEv: h || null, lugarEv: l || null, linkDoc: ld || null, fecha: Date.now() }).then(() => { ['com-titulo','com-mensaje','com-fecha-ev','com-hora-ev','com-lugar-ev','com-link-doc'].forEach(id => document.getElementById(id).value=""); notify("📣 Publicado"); }); 
}

async function verCarnet(email) {
    const docUser = await db.collection("usuarios").doc(email).get();
    const u = docUser.data();
    const snapBoletas = await db.collection("boletas").where("vendedor", "==", email).get();
    let activas = 0, pendientes = 0;
    const setVendidas = new Set();
    snapBoletas.forEach(b => { 
        const bd = b.data();
        if(bd.estado === 'Activa') activas++; else if(bd.estado === 'Pendiente') pendientes++; 
        if(bd.n) setVendidas.add(bd.n.toString());
    });

    const entregadas = u.boletasEntregadas || [];
    const esAdmin = (auth.currentUser.email === ADMIN_EMAIL);
    let tagsEntregadasHtml = "";
    entregadas.forEach(num => {
        const isSold = setVendidas.has(num.toString());
        const colorBg = isSold ? "#dcfce7" : "#fee2e2";
        const colorBorder = isSold ? "#10b981" : "#ef4444";
        const delBtn = esAdmin ? `<span onclick="eliminarBoletaEntregadaDeOtro('${email}', '${num}')" style="margin-left:3px; cursor:pointer;">✕</span>` : "";
        tagsEntregadasHtml += `<div class="team-mini-badge" style="background:${colorBg}; border: 1px solid ${colorBorder}; font-size: 0.45rem;">${num}${delBtn}</div>`;
    });

    const lastLoginStr = u.lastLogin ? new Date(u.lastLogin).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "---";
    const render = document.getElementById('carnet-detalle-render');
    render.innerHTML = `
        <div class="id-card-mini" style="margin-bottom:0;">
            <div class="avatar-circle">${u.nombre ? u.nombre[0] : "S"}</div>
            <h3>${(u.nombre + " " + (u.apellido || "")).toUpperCase()}</h3>
            <p class="badge-rango-perfil">${(u.rango || "Recreador").toUpperCase()}</p>
            <div class="id-card-details">
                <div class="id-detail-item"><span class="detail-label">EQUIPO</span><span class="detail-value">${(u.color || "---").toUpperCase()}</span></div>
                <div class="id-detail-item"><span class="detail-label">DOCUMENTO</span><span class="detail-value">${u.doc || "---"}</span></div>
                <div class="id-detail-item"><span class="detail-label">WHATSAPP</span><span class="detail-value">${u.tel || "---"}</span></div>
                <div class="id-detail-item"><span class="detail-label">EDAD</span><span class="detail-value">${calcularEdad(u.nacimiento).toUpperCase()}</span></div>
                <div class="id-detail-item" style="grid-column: span 2;"><span class="detail-label">ÚLTIMA CONEXIÓN</span><span class="detail-value">${lastLoginStr}</span></div>
                
                <div class="id-detail-item" style="grid-column: span 2; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 15px; margin-top: 5px;">
                    <span class="detail-label" style="margin-bottom:5px;">BOLETAS ENTREGADAS</span>
                    <div class="teams-flex-container" style="justify-content:center;">${tagsEntregadasHtml || '<span style="font-size:0.5rem; opacity:0.5;">NINGUNA</span>'}</div>
                </div>

                <div class="id-detail-item" style="grid-column: span 2; background: rgba(255,255,255,0.1); padding: 10px; border-radius: 10px; margin-top: 10px; display: flex; flex-direction: row; justify-content: space-around; text-align: center;">
                    <div><span class="detail-label">ACTIVAS</span><br><span class="detail-value" style="color:#10b981; font-size:1.2rem;">${activas}</span></div>
                    <div><span class="detail-label">PENDIENTES</span><br><span class="detail-value" style="color:#f59e0b; font-size:1.2rem;">${pendientes}</span></div>
                </div>
            </div>
            <p class="card-brand-footer">LOGISTICA & EVENTOS</p>
        </div>`;
    document.getElementById('modal-carnet').style.display = 'flex';
}

function eliminarPersonalPorCodigoInvitacion() {
    const codigo = document.getElementById('del-invite-code').value.trim();
    if (!codigo) return notify("⚠️ Ingresa un código de invitación");
    if (!confirm(`¿Seguro que deseas eliminar TODOS los usuarios registrados con el código "${codigo}"? Esta acción no se puede deshacer.`)) return;
    
    db.collection("usuarios").where("codigoUsado", "==", codigo).get().then(snap => {
        if (snap.empty) return notify("No se encontraron usuarios con ese código");
        let batch = db.batch();
        let count = 0;
        snap.forEach(doc => { 
            if (doc.id !== ADMIN_EMAIL) { 
                batch.delete(doc.ref); 
                count++; 
            } 
        });
        batch.commit().then(() => { 
            notify(`🗑️ Se eliminaron ${count} registros de personal`); 
            document.getElementById('del-invite-code').value = ""; 
        });
    }).catch(err => notify("Error: " + err.message));
}

function eliminarBoletasPorRango() {
    const inicio = document.getElementById('del-bol-inicio').value;
    const fin = document.getElementById('del-bol-fin').value;
    if (!inicio || !fin) return notify("⚠️ Selecciona ambas fechas");
    const tsInicio = new Date(inicio + "T00:00:00").getTime();
    const tsFin = new Date(fin + "T23:59:59").getTime();
    if (!confirm(`¿Seguro que deseas eliminar TODAS las boletas registradas entre ${inicio} y ${fin}? Esta acción es permanente.`)) return;
    db.collection("boletas").where("creado", ">=", tsInicio).where("creado", "<=", tsFin).get().then(snap => {
        if (snap.empty) return notify("No se encontraron boletas en ese rango");
        let batch = db.batch();
        let count = 0;
        snap.forEach(doc => { batch.delete(doc.ref); count++; });
        batch.commit().then(() => { notify(`🗑️ Se eliminaron ${count} registros de boletas`); document.getElementById('del-bol-inicio').value = ""; document.getElementById('del-bol-fin').value = ""; });
    }).catch(err => notify("Error: " + err.message));
}

function exportarPersonalExcel() {
    const search = document.getElementById('search-user').value.toLowerCase(), filterColor = document.getElementById('filter-user-color').value;
    db.collection("usuarios").get().then(snap => {
        const rows = [["N°", "NOMBRE", "APELLIDO", "RANGO", "EDAD", "CORREO", "DOC", "TEL", "EQUIPO", "INSCRIPCION"]];
        let exportContador = 0;
        snap.forEach(doc => { 
            const u = doc.data(); if(doc.id === ADMIN_EMAIL) return; 
            const nom = (u.nombre + " " + (u.apellido || "")).toLowerCase();
            if((nom.includes(search) || (u.doc && u.doc.includes(search))) && (filterColor === "Todos" || u.color === filterColor)) {
                exportContador++;
                rows.push([exportContador, u.nombre, u.apellido || "", u.rango || "Recreador", calcularEdad(u.nacimiento), doc.id, u.doc || "", u.tel || "", u.color, u.inscripcion || "NO"]); 
            }
        });
        const ws = XLSX.utils.aoa_to_sheet(rows), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Personal"); XLSX.writeFile(wb, "Reporte_Personal.xlsx");
    });
}
function exportarVentasExcel() {
    const filterCol = document.getElementById('filter-color').value, filterEst = document.getElementById('filter-estado').value;
    db.collection("boletas").orderBy("creado", "desc").get().then(async snap => {
        const rows = [["ITEM", "BOLETA", "EQUIPO", "RECREADOR", "COMPRADOR", "WHATSAPP", "ESTADO", "FECHA"]];
        const uSnap = await db.collection("usuarios").get();
        const mapaColores = {}; uSnap.forEach(u => mapaColores[u.id] = u.data().color || 'Gris');
        let exportContador = 0;
        snap.forEach(doc => {
            const b = doc.data(); const col = mapaColores[b.vendedor] || 'Gris';
            if(filterCol !== "Todos" && col !== filterCol) return;
            if(filterEst !== "Todos" && b.estado !== filterEst) return;
            exportContador++;
            rows.push([exportContador, b.n, col, b.recreador || '---', b.c || '---', b.t || '---', b.estado, new Date(b.creado).toLocaleString()]);
        });
        const ws = XLSX.utils.aoa_to_sheet(rows), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Ventas"); XLSX.writeFile(wb, "Reporte_Ventas.xlsx");
    });
}