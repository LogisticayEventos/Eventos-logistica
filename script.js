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
const INVITE_CODE = "LOGISTICA001";

let currentUserData = null;

auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('view-auth').style.display = 'none';
        document.getElementById('view-home').style.display = 'flex';
        loadUser();
    } else {
        document.getElementById('view-auth').style.display = 'block';
        document.getElementById('view-home').style.display = 'none';
    }
});

function showSection(id) {
    document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-' + id).style.display = 'block';
    document.getElementById('nav-' + id).classList.add('active');
}

function calcularEdad(fecha) {
    if(!fecha) return "---";
    const hoy = new Date();
    const cumple = new Date(fecha);
    let edad = hoy.getFullYear() - cumple.getFullYear();
    const m = hoy.getMonth() - cumple.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) { edad--; }
    return edad + " años";
}

function loadUser() {
    const email = auth.currentUser.email;
    db.collection("usuarios").doc(email).onSnapshot(doc => {
        const d = doc.data() || {};
        currentUserData = d;
        currentUserData.email = email;
        
        let rango = (email === ADMIN_EMAIL) ? "Administrador" : (d.rango || "Recreador");

        document.getElementById('p-full-name').innerText = (d.nombre + " " + (d.apellido || "")).toUpperCase();
        document.getElementById('p-equipo-view').innerText = "EQUIPO: " + (d.color || "---");
        document.getElementById('p-rango-view').innerText = rango.toUpperCase();
        document.getElementById('p-initials').innerText = d.nombre ? d.nombre[0] : "S";
        document.getElementById('user-rank-badge').innerText = rango.toUpperCase();
        
        const docI = document.getElementById('edit-doc'), telI = document.getElementById('edit-tel'), colI = document.getElementById('edit-color'), nacI = document.getElementById('edit-nacimiento'), btnG = document.getElementById('btn-guardar-perfil');
        if (d.doc) { docI.value = d.doc; docI.disabled = true; }
        if (d.tel) { telI.value = d.tel; telI.disabled = true; }
        if (d.color) { colI.value = d.color; colI.disabled = true; }
        if (d.nacimiento) { nacI.value = d.nacimiento; nacI.disabled = true; }
        if (d.doc && d.tel && d.nacimiento) { btnG.style.display = 'none'; }

        const esAdmin = (rango === "Administrador"), esCGeneral = (rango === "Coordinador General"), esCoordinador = (rango === "Coordinador"), esRecreador = (rango === "Recreador");

        document.getElementById('nav-usuarios-adm').style.display = (!esRecreador) ? 'block' : 'none';
        document.getElementById('admin-com-form').style.display = (esAdmin || esCGeneral) ? 'flex' : 'none';
        document.getElementById('filter-color').style.display = (esRecreador) ? 'none' : 'block';

        const canExport = (esAdmin || esCGeneral);
        document.getElementById('btn-rep-ventas').style.display = canExport ? 'block' : 'none';
        document.getElementById('btn-rep-personal').style.display = canExport ? 'block' : 'none';

        document.querySelectorAll('.col-gestion').forEach(el => el.style.display = (esAdmin || esCGeneral) ? 'table-cell' : 'none');
        document.querySelectorAll('.col-rango-admin').forEach(el => el.style.display = esAdmin ? 'table-cell' : 'none');

        listenData();
        if(!esRecreador) loadAllUsers();
        showSection('comunicados');
    });
}

function guardarPerfil() {
    const d = document.getElementById('edit-doc').value, t = document.getElementById('edit-tel').value, c = document.getElementById('edit-color').value, n = document.getElementById('edit-nacimiento').value;
    if(!d || !t || !n) return notify("⚠️ Completa todos los campos");
    db.collection("usuarios").doc(auth.currentUser.email).update({ doc: d, tel: t, color: c, nacimiento: n }).then(() => notify("✅ Datos guardados permanentemente"));
}

function listenData() {
    const email = auth.currentUser.email;
    const r = (email === ADMIN_EMAIL) ? "Administrador" : (currentUserData.rango || "Recreador");
    const esAdmin = (r === "Administrador"), esCGeneral = (r === "Coordinador General"), esCoordinador = (r === "Coordinador");
    
    const filterCol = document.getElementById('filter-color').value, filterEst = document.getElementById('filter-estado').value;

    db.collection("boletas").orderBy("creado", "desc").onSnapshot(async snap => {
        const body = document.getElementById('lista-boletas-body'); body.innerHTML = ""; 
        const uSnap = await db.collection("usuarios").get();
        const mapa = {}; uSnap.forEach(u => mapa[u.id] = u.data().color || 'Gris');
        
        snap.forEach(doc => {
            const b = doc.data(); const col = mapa[b.vendedor] || 'Gris';
            if(!(esAdmin || esCGeneral || esCoordinador) && b.vendedor !== email) return;
            if(filterCol !== "Todos" && col !== filterCol) return;
            if(filterEst !== "Todos" && b.estado !== filterEst) return;
            
            const fObj = new Date(b.creado), fStr = fObj.toLocaleDateString('es-CO', {day:'2-digit', month:'2-digit'}) + " " + fObj.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit', hour12: false});
            let accionHtml = "";
            if(esAdmin || esCGeneral) {
                const btnB = esAdmin ? `<button class="btn-status btn-delete" onclick="eliminarBoleta('${doc.id}')">🗑️</button>` : "";
                accionHtml = `<td class="col-gestion"><div style="display:flex; gap:2px; justify-content:center;"><button class="btn-status btn-approve" onclick="cambiarEstado('${doc.id}', 'Activa')">✓</button><button class="btn-status btn-pending" onclick="cambiarEstado('${doc.id}', 'Pendiente')">⏳</button>${btnB}</div></td>`;
            }
            body.innerHTML += `<tr><td style="font-weight:800;">#${b.n}</td><td><span class="team-dot bg-${col}"></span> ${col}</td><td>${b.recreador || '---'}</td><td>${b.c || '---'}</td><td>${b.t || '---'}</td><td style="font-weight:800; color:${b.estado === 'Activa' ? '#10b981' : '#f59e0b'}">${b.estado}</td><td style="font-size:0.55rem;">${fStr}</td>${accionHtml}</tr>`;
        });
    });

    db.collection("comunicados").orderBy("fecha", "desc").onSnapshot(snap => {
        const list = document.getElementById('comunicados-list'); list.innerHTML = "";
        snap.forEach(doc => { 
            const c = doc.data(); 
            const del = (esAdmin || esCGeneral) ? `<button class="del-com-btn" onclick="db.collection('comunicados').doc('${doc.id}').delete()">✕</button>` : '';
            let extraInfo = "", countdownHtml = "";

            if(c.fechaEv) {
                const fEv = new Date(c.fechaEv + "T" + (c.horaEv || "00:00")), hoy = new Date();
                const dias = Math.ceil((fEv - hoy) / (1000 * 60 * 60 * 24));
                extraInfo = `<div class="com-meta-box"><span>📅 ${c.fechaEv}</span>${c.horaEv ? `<span>⏰ ${c.horaEv}</span>` : ''}${c.lugarEv ? `<span>📍 ${c.lugarEv}</span>` : ''}</div>`;
                if(dias > 0) countdownHtml = `<div class="com-countdown">Faltan <b>${dias}</b> días</div>`;
                else if (dias === 0) countdownHtml = `<div class="com-countdown today">¡Es Hoy!</div>`;
            }

            list.innerHTML += `<div class="com-card">${del}<div class="com-header"><span class="com-tag">COMUNICADO</span><h3>${c.titulo}</h3></div><p class="com-body">${c.mensaje}</p>${extraInfo}${countdownHtml}<div class="com-footer">Publicado: ${new Date(c.fecha).toLocaleDateString()}</div></div>`;
        });
    });
}

function loadAllUsers() {
    const email = auth.currentUser.email, esAdmin = (email === ADMIN_EMAIL || (currentUserData && currentUserData.rango === "Administrador"));
    const search = document.getElementById('search-user').value.toLowerCase(), filterColor = document.getElementById('filter-user-color').value;

    db.collection("usuarios").onSnapshot(snap => {
        const body = document.getElementById('lista-usuarios-body'); body.innerHTML = "";
        snap.forEach(doc => {
            const u = doc.data(); if(doc.id === ADMIN_EMAIL) return;
            const nom = (u.nombre + " " + (u.apellido || "")).toLowerCase();
            const rango = u.rango || "Recreador";
            const esRangoAlto = (rango === "Administrador" || rango === "Coordinador General" || rango === "Coordinador");
            
            const edadDisplay = esRangoAlto ? "<span class='priv-tag'>Privado</span>" : calcularEdad(u.nacimiento);
            const docDisplay = esRangoAlto ? "<span class='priv-tag'>Privado</span>" : (u.doc || '---');
            const telDisplay = esRangoAlto ? "<span class='priv-tag'>Privado</span>" : (u.tel || '---');

            if((nom.includes(search) || (u.doc && u.doc.includes(search))) && (filterColor === "Todos" || u.color === filterColor)) {
                let colAsignar = esAdmin ? `<td><select class="select-rango" onchange="asignarRango('${doc.id}', this.value)"><option value="" disabled selected>Cambiar</option><option value="Administrador">Admin</option><option value="Coordinador General">C. Gral</option><option value="Coordinador">Coord</option><option value="Recreador">Rec</option></select></td><td><button class="btn-status btn-delete" onclick="eliminarUsuario('${doc.id}')">🗑️</button></td>` : "";
                body.innerHTML += `<tr><td style="font-weight:700;">${u.nombre}<br><small>${doc.id}</small></td><td><span class="badge-rango">${rango}</span></td><td>${edadDisplay}</td><td>${docDisplay}</td><td>${telDisplay}</td><td>${u.color}</td><td style="font-size:0.6rem;">${u.creado ? new Date(u.creado).toLocaleDateString() : '---'}</td>${colAsignar}</tr>`;
            }
        });
    });
}

function asignarRango(email, nuevoRango) { db.collection("usuarios").doc(email).update({ rango: nuevoRango }).then(() => notify("🎖️ Rango actualizado")); }
function cambiarEstado(id, nuevoEstado) { db.collection("boletas").doc(id).update({ estado: nuevoEstado }).then(() => notify("✅ Estado actualizado")); }
function eliminarBoleta(id) { if(confirm("¿Eliminar boleta?")) db.collection("boletas").doc(id).delete().then(() => notify("🗑️ Eliminada")); }
function eliminarUsuario(email) { if(confirm("¿Eliminar usuario?")) db.collection("usuarios").doc(email).delete().then(() => notify("🗑️ Usuario eliminado")); }

function registrarConCodigo() {
    const n = document.getElementById('reg-nombre').value, a = document.getElementById('reg-apellido').value, e = document.getElementById('reg-email').value, p = document.getElementById('reg-pass').value, col = document.getElementById('reg-color').value, c = document.getElementById('reg-invite').value.trim();
    if(c !== INVITE_CODE) return notify("❌ Código Incorrecto");
    auth.createUserWithEmailAndPassword(e, p).then(() => db.collection("usuarios").doc(e).set({ nombre: n, apellido: a, color: col, creado: Date.now(), rango: 'Recreador' }).then(() => location.reload())).catch(err => notify(err.message));
}

function inscribirBoleta() {
    const r = document.getElementById('ins-rec-nom').value, n = document.getElementById('ins-n-boleta').value, c = document.getElementById('ins-com-nom').value, t = document.getElementById('ins-com-tel').value;
    if(!n || !c) return notify("⚠️ Datos incompletos");
    db.collection("boletas").add({ recreador: r, n: n, c: c, t: t, vendedor: auth.currentUser.email, estado: 'Pendiente', creado: Date.now() }).then(() => { notify("🎫 Registrada"); ['ins-rec-nom','ins-n-boleta','ins-com-nom','ins-com-tel'].forEach(id => document.getElementById(id).value=""); });
}

function exportarPersonalExcel() {
    db.collection("usuarios").get().then(snap => {
        const rows = [["NOMBRE", "APELLIDO", "RANGO", "EDAD", "CORREO", "DOC", "TEL", "EQUIPO"]];
        snap.forEach(doc => { const u = doc.data(); if(doc.id === ADMIN_EMAIL) return; rows.push([u.nombre, u.apellido || "", u.rango || "Recreador", calcularEdad(u.nacimiento), doc.id, u.doc || "", u.tel || "", u.color]); });
        const ws = XLSX.utils.aoa_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Personal"); XLSX.writeFile(wb, "Logistica_Personal.xlsx");
    });
}

function exportarVentasExcel() {
    db.collection("boletas").orderBy("creado", "desc").get().then(async snap => {
        const rows = [["#", "RECREADOR", "COMPRADOR", "WHATSAPP", "ESTADO", "FECHA"]];
        snap.forEach(doc => { const b = doc.data(); rows.push([b.n, b.recreador || '---', b.c || '---', b.t || '---', b.estado, new Date(b.creado).toLocaleString()]); });
        const ws = XLSX.utils.aoa_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Ventas"); XLSX.writeFile(wb, "Logistica_Ventas.xlsx");
    });
}

function handleLogin() { auth.signInWithEmailAndPassword(document.getElementById('login-email').value, document.getElementById('login-pass').value).catch(err => notify(err.message)); }
function handleLogout() { auth.signOut().then(() => location.reload()); }
function toggleAuth(v) { document.getElementById('auth-login').style.display = v === 'reg' ? 'none' : 'flex'; document.getElementById('auth-register').style.display = v === 'reg' ? 'flex' : 'none'; }
function notify(m) { const c = document.getElementById('toast-container'); const t = document.createElement('div'); t.className = 'toast'; t.innerText = m; c.appendChild(t); setTimeout(() => t.remove(), 3000); }

function publicarComunicado() { 
    const t = document.getElementById('com-titulo').value, m = document.getElementById('com-mensaje').value, f = document.getElementById('com-fecha-ev').value, h = document.getElementById('com-hora-ev').value, l = document.getElementById('com-lugar-ev').value;
    if(!t || !m) return notify("⚠️ Título y mensaje obligatorios");
    db.collection("comunicados").add({ titulo: t, mensaje: m, fechaEv: f || null, horaEv: h || null, lugarEv: l || null, fecha: Date.now() }).then(() => { ['com-titulo','com-mensaje','com-fecha-ev','com-hora-ev','com-lugar-ev'].forEach(id => document.getElementById(id).value=""); notify("📣 Publicado"); }); 
}