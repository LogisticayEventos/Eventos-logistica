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
        const esAdmin = (rango === "Administrador"), esCGeneral = (rango === "Coordinador General"), esCoordinador = (rango === "Coordinador"), esRecreador = (rango === "Recreador");
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
        document.querySelectorAll('.col-gestion').forEach(el => el.style.display = (esAdmin || esCGeneral) ? 'table-cell' : 'none');
        document.querySelectorAll('.col-rango-admin').forEach(el => el.style.display = esAdmin ? 'table-cell' : 'none');
        document.querySelectorAll('.col-rango-permiso').forEach(el => el.style.display = (!esRecreador) ? 'table-cell' : 'none');
        listenData();
        if(!esRecreador) loadAllUsers();
        showSection('comunicados');
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
    const esAdmin = (r === "Administrador"), esCGeneral = (r === "Coordinador General"), esCoordinador = (r === "Coordinador");
    const userColor = currentUserData.color || "Gris";
    const filterCol = document.getElementById('filter-color').value, filterEst = document.getElementById('filter-estado').value;

    db.collection("boletas").orderBy("creado", "desc").onSnapshot(async snap => {
        const body = document.getElementById('lista-boletas-body'); body.innerHTML = ""; 
        const uSnap = await db.collection("usuarios").get();
        const mapa = {}; uSnap.forEach(u => mapa[u.id] = u.data().color || 'Gris');
        
        let contadorTotal = 0, activas = 0, pendientes = 0;
        let boletasPorEquipo = {};

        snap.forEach(doc => {
            const b = doc.data(); const col = mapa[b.vendedor] || 'Gris';
            
            contadorTotal++;
            if(b.estado === 'Activa') activas++; else pendientes++;
            if(!boletasPorEquipo[col]) boletasPorEquipo[col] = { total: 0, activas: 0, pendientes: 0 };
            boletasPorEquipo[col].total++;
            if(b.estado === 'Activa') boletasPorEquipo[col].activas++; else boletasPorEquipo[col].pendientes++;

            if(!(esAdmin || esCGeneral || esCoordinador) && b.vendedor !== email) return;
            if(filterCol !== "Todos" && col !== filterCol) return;
            if(filterEst !== "Todos" && b.estado !== filterEst) return;
            const fObj = new Date(b.creado), fStr = fObj.toLocaleDateString('es-CO', {day:'2-digit', month:'2-digit'}) + " " + fObj.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit', hour12: false});
            let waBtn = b.t ? `<a href="https://wa.me/57${b.t}" target="_blank" class="wa-quick-btn">💬</a>` : "";
            let accionHtml = "";
            if(esAdmin || esCGeneral) {
                const btnB = esAdmin ? `<button class="btn-status btn-delete" onclick="eliminarBoleta('${doc.id}')">🗑️</button>` : "";
                accionHtml = `<td class="col-gestion"><div style="display:flex; gap:2px; justify-content:center;"><button class="btn-status btn-approve" onclick="cambiarEstado('${doc.id}', 'Activa')">✓</button><button class="btn-status btn-pending" onclick="cambiarEstado('${doc.id}', 'Pendiente')">⏳</button>${btnB}</div></td>`;
            }
            body.innerHTML += `<tr><td style="font-weight:800;">${contadorTotal}</td><td style="font-weight:800;">${b.n || '---'}</td><td><span class="team-dot" style="background:${col.toLowerCase()}"></span> ${col}</td><td>${b.recreador || '---'}</td><td>${b.c || '---'}</td><td>${b.t || '---'} ${waBtn}</td><td style="font-weight:800; color:${b.estado === 'Activa' ? '#10b981' : '#f59e0b'}">${b.estado}</td><td style="font-size:0.55rem;">${fStr}</td>${accionHtml}</tr>`;
        });

        document.getElementById('conteo-boletas-total').innerText = "Total registros: " + contadorTotal;
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

function loadAllUsers() {
    const email = auth.currentUser.email;
    const userRango = (email === ADMIN_EMAIL) ? "Administrador" : (currentUserData ? currentUserData.rango : "Recreador");
    const esAdmin = (userRango === "Administrador");
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
    snapBoletas.forEach(b => { if(b.data().estado === 'Activa') activas++; else if(b.data().estado === 'Pendiente') pendientes++; });
    const lastLoginStr = u.lastLogin ? new Date(u.lastLogin).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "---";
    const render = document.getElementById('carnet-detalle-render');
    render.innerHTML = `<div class="id-card-mini" style="margin-bottom:0;"><div class="avatar-circle">${u.nombre ? u.nombre[0] : "S"}</div><h3>${(u.nombre + " " + (u.apellido || "")).toUpperCase()}</h3><p class="badge-rango-perfil">${(u.rango || "Recreador").toUpperCase()}</p><div class="id-card-details"><div class="id-detail-item"><span class="detail-label">EQUIPO</span><span class="detail-value">${(u.color || "---").toUpperCase()}</span></div><div class="id-detail-item"><span class="detail-label">DOCUMENTO</span><span class="detail-value">${u.doc || "---"}</span></div><div class="id-detail-item"><span class="detail-label">WHATSAPP</span><span class="detail-value">${u.tel || "---"}</span></div><div class="id-detail-item"><span class="detail-label">EDAD</span><span class="detail-value">${calcularEdad(u.nacimiento).toUpperCase()}</span></div><div class="id-detail-item" style="grid-column: span 2;"><span class="detail-label">ÚLTIMA CONEXIÓN</span><span class="detail-value">${lastLoginStr}</span></div><div class="id-detail-item" style="grid-column: span 2; background: rgba(255,255,255,0.1); padding: 10px; border-radius: 10px; margin-top: 10px; display: flex; flex-direction: row; justify-content: space-around; text-align: center;"><div><span class="detail-label">ACTIVAS</span><br><span class="detail-value" style="color:#10b981; font-size:1.2rem;">${activas}</span></div><div><span class="detail-label">PENDIENTES</span><br><span class="detail-value" style="color:#f59e0b; font-size:1.2rem;">${pendientes}</span></div></div></div><p class="card-brand-footer">LOGISTICA & EVENTOS</p></div>`;
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