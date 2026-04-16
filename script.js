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

// AQUÍ SE AGREGÓ LA VARIABLE PARA EL RETRASO (DEBOUNCE)
let timerBusquedaPersonal;

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

// ESTA ES LA FUNCIÓN NUEVA QUE EVITA EL CONGELAMIENTO
function debounceLoadAllUsers() {
    clearTimeout(timerBusquedaPersonal);
    timerBusquedaPersonal = setTimeout(() => {
        loadAllUsers();
    }, 500); // Espera 500 milisegundos para buscar todo
}

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
        listDiv.innerHTML += `<div class="team-mini-badge">${col} <span onclick="eliminarEquipo('${col}')"><i class="fa-solid fa-xmark"></i></span></div>`;
    });
}

function agregarEquipo() {
    const input = document.getElementById('new-team-name');
    const valor = input.value.trim();
    if(!valor) return;
    if(listadoEquipos.includes(valor)) return notify("<i class='fa-solid fa-triangle-exclamation'></i> El equipo ya existe");
    const nuevaLista = [...listadoEquipos, valor];
    db.collection("configuracion").doc("equipos").set({ lista: nuevaLista }).then(() => { input.value = ""; notify("<i class='fa-solid fa-check'></i> Equipo añadido"); });
}

function eliminarEquipo(col) {
    if(!confirm(`¿Eliminar el equipo ${col}?`)) return;
    const nuevaLista = listadoEquipos.filter(c => c !== col);
    db.collection("configuracion").doc("equipos").set({ lista: nuevaLista }).then(() => notify("<i class='fa-solid fa-trash'></i> Equipo eliminado"));
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
        listDiv.innerHTML += `<div class="team-mini-badge" style="background:rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; color:#fcd34d;">${cod} <span onclick="eliminarCodigoInvitacion('${cod}')"><i class="fa-solid fa-xmark"></i></span></div>`;
    });
}

function agregarCodigoInvitacion() {
    const input = document.getElementById('new-invite-code');
    const nuevoCodigo = input.value.trim();
    if(nuevoCodigo.length < 4) return notify("<i class='fa-solid fa-triangle-exclamation'></i> El código debe ser más largo");
    if(listadoCodigosInvitacion.includes(nuevoCodigo)) return notify("<i class='fa-solid fa-triangle-exclamation'></i> El código ya existe");
    
    const nuevaLista = [...listadoCodigosInvitacion, nuevoCodigo];
    db.collection("configuracion").doc("seguridad").set({
        listaCodigos: nuevaLista,
        actualizadoPor: auth.currentUser.email,
        fechaCambio: Date.now()
    }).then(() => { 
        notify("<i class='fa-solid fa-check'></i> Código añadido"); 
        input.value = ""; 
    });
}

function eliminarCodigoInvitacion(cod) {
    if(listadoCodigosInvitacion.length <= 1) return notify("<i class='fa-solid fa-triangle-exclamation'></i> Debe haber al menos un código");
    if(!confirm(`¿Eliminar el código "${cod}"?`)) return;
    const nuevaLista = listadoCodigosInvitacion.filter(c => c !== cod);
    db.collection("configuracion").doc("seguridad").update({
        listaCodigos: nuevaLista
    }).then(() => notify("<i class='fa-solid fa-trash'></i> Código eliminado"));
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
    if(!listadoCodigosInvitacion.includes(c)) return notify("<i class='fa-solid fa-xmark'></i> Código Incorrecto o Expirado");
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
                ? `<td><button class="btn-status btn-delete" style="padding: 4px 8px; font-size: 0.5rem;" onclick="eliminarTodosRegistrosRecreador('${nombre}')"><i class="fa-solid fa-trash"></i></button></td>`
                : `<td><span class="badge-rango" style="background:rgba(255,255,255,0.05); font-size:0.5rem;">${data.emailVendedor === email ? 'MIS VENTAS' : 'REGISTRO'}</span></td>`;

            body.innerHTML += `
                <tr>
                    <td style="font-weight:800;">${index++}</td>
                    <td><span class="team-dot" style="background:${data.color.toLowerCase()}"></span> ${data.color}</td>
                    <td style="font-weight:800; color:var(--accent); cursor:pointer; text-decoration:underline;" onclick="abrirGestionBoletas('${nombre}')">
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
            const del = esAdmin ? `<button class="del-com-btn" onclick="db.collection('comunicados').doc('${doc.id}').delete()"><i class="fa-solid fa-xmark"></i></button>` : '';
            let extraInfo = "", countdownHtml = "", docBtn = "";
            if(c.linkDoc) docBtn = `<a href="${c.linkDoc}" target="_blank" class="com-doc-link"><i class="fa-solid fa-folder-open"></i> DOCUMENTO</a>`;
            if(c.fechaEv) {
                const fEv = new Date(c.fechaEv + "T" + (c.horaEv || "00:00")), hoy = new Date();
                const dias = Math.ceil((fEv - hoy) / (1000 * 60 * 60 * 24));
                extraInfo = `<div class="com-meta-box"><span><i class="fa-solid fa-calendar-days"></i> ${c.fechaEv}</span>${c.horaEv ? `<span><i class="fa-solid fa-clock"></i> ${c.horaEv}</span>` : ''}${c.lugarEv ? `<span><i class="fa-solid fa-location-dot"></i> ${c.lugarEv}</span>` : ''}</div>`;
                if(dias > 0) countdownHtml = `<div class="com-countdown">Faltan <b>${dias}</b> días</div>`;
                else if (dias === 0) countdownHtml = `<div class="com-countdown today">¡Es Hoy!</div>`;
            }
            list.innerHTML += `<div class="com-card">${del}<div class="com-header"><span class="com-tag">INFO</span><h3>${c.titulo}</h3></div><p class="com-body">${c.mensaje}</p>${extraInfo}${docBtn}${countdownHtml}<div class="com-footer">Publicado: ${new Date(c.fecha).toLocaleDateString()}</div></div>`;
        });
    });
}

function handleLogin() {
    const e = document.getElementById('login-email').value, p = document.getElementById('login-pass').value;
    auth.signInWithEmailAndPassword(e, p).catch(err => notify(err.message));
}

function handleLogout() {
    auth.signOut();
}

function toggleAuth(view) {
    document.getElementById('auth-login').style.display = view === 'login' ? 'flex' : 'none';
    document.getElementById('auth-register').style.display = view === 'reg' ? 'flex' : 'none';
}

function notify(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function publicarComunicado() {
    const tit = document.getElementById('com-titulo').value, msg = document.getElementById('com-mensaje').value, fL = document.getElementById('com-fecha-ev').value, hL = document.getElementById('com-hora-ev').value, lug = document.getElementById('com-lugar-ev').value, link = document.getElementById('com-link-doc').value;
    const dest = Array.from(document.querySelectorAll('input[name="dest-color"]:checked')).map(cb => cb.value);
    if(!tit || !msg || dest.length === 0) return notify("Completa título, mensaje y destinatario");
    db.collection("comunicados").add({ titulo: tit, mensaje: msg, destinatarios: dest, fechaEv: fL, horaEv: hL, lugarEv: lug, linkDoc: link, fecha: Date.now() }).then(() => {
        document.getElementById('com-titulo').value = ""; document.getElementById('com-mensaje').value = ""; document.getElementById('com-fecha-ev').value = ""; document.getElementById('com-hora-ev').value = ""; document.getElementById('com-lugar-ev').value = ""; document.getElementById('com-link-doc').value = "";
        notify("<i class='fa-solid fa-check'></i> Publicado");
    });
}

function inscribirBoleta() {
    const rec = document.getElementById('ins-rec-nom').value.trim(), num = document.getElementById('ins-n-boleta').value.trim(), com = document.getElementById('ins-com-nom').value.trim(), tel = document.getElementById('ins-com-tel').value.trim();
    if(!rec || !num || !com || !tel) return notify("<i class='fa-solid fa-triangle-exclamation'></i> Completa todos los campos");
    if(isNaN(num)) return notify("<i class='fa-solid fa-triangle-exclamation'></i> La boleta debe ser un número");
    
    db.collection("boletas").where("n", "==", num).get().then(snap => {
        if(!snap.empty) return notify("<i class='fa-solid fa-triangle-exclamation'></i> Esta boleta ya fue registrada");
        
        db.collection("boletas").add({
            vendedor: auth.currentUser.email,
            recreador: rec.toLowerCase(),
            n: num, comprador: com, tel: tel,
            estado: 'Activa', creado: Date.now()
        }).then(() => {
            document.getElementById('ins-n-boleta').value = ""; document.getElementById('ins-com-nom').value = ""; document.getElementById('ins-com-tel').value = "";
            notify("<i class='fa-solid fa-check'></i> Boleta Registrada");
        });
    });
}

function buscarDuenioBoleta() {
    const input = document.getElementById('search-n-boleta').value.trim();
    const resDiv = document.getElementById('resultado-busqueda-boleta');
    if(!input) {
        resDiv.style.display = 'none';
        return notify("<i class='fa-solid fa-triangle-exclamation'></i> Ingresa un número de boleta");
    }

    db.collection("boletas").where("n", "==", input).get().then(async snap => {
        if(snap.empty) {
            resDiv.style.display = 'block';
            resDiv.innerHTML = `<div style="padding: 15px; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 12px; color: #ef4444; font-weight: 800;"><i class="fa-solid fa-circle-xmark"></i> LA BOLETA N° ${input} NO EXISTE O NO HA SIDO VENDIDA</div>`;
            return;
        }

        const b = snap.docs[0].data();
        const uDoc = await db.collection("usuarios").doc(b.vendedor).get();
        const uData = uDoc.exists ? uDoc.data() : { color: 'Desconocido', nombre: 'Desconocido', tel: '---' };
        
        let estadoHtml = b.estado === 'Activa' ? `<span class="status-Activa">ACTIVA</span>` : `<span class="status-Pendiente">PENDIENTE</span>`;

        resDiv.style.display = 'block';
        resDiv.innerHTML = `
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 15px; padding: 15px; text-align: left;">
                <p style="text-align: center; color: #10b981; font-weight: 900; margin-top: 0; font-size: 0.9rem;"><i class="fa-solid fa-circle-check"></i> BOLETA ENCONTRADA</p>
                <div style="display: grid; grid-template-columns: 1fr; gap: 8px; font-size: 0.75rem;">
                    <div><span class="detail-label">NÚMERO DE BOLETA:</span> <b style="color:white; font-size: 1rem;">${b.n}</b></div>
                    <div><span class="detail-label">ESTADO ACTUAL:</span> ${estadoHtml}</div>
                    <hr style="border: 0; border-top: 1px dashed rgba(16, 185, 129, 0.3); width: 100%;">
                    <div><span class="detail-label">NOMBRE DEL COMPRADOR:</span> <b style="color:white;">${b.comprador.toUpperCase()}</b></div>
                    <div><span class="detail-label">WHATSAPP DEL COMPRADOR:</span> <b style="color:white;">${b.tel}</b></div>
                    <hr style="border: 0; border-top: 1px dashed rgba(16, 185, 129, 0.3); width: 100%;">
                    <div><span class="detail-label">RECREADOR QUE LA VENDIÓ:</span> <b style="color:var(--accent);">${b.recreador.toUpperCase()}</b></div>
                    <div><span class="detail-label">EQUIPO DEL RECREADOR:</span> <b style="color:white;">${uData.color.toUpperCase()}</b></div>
                    <div><span class="detail-label">USUARIO DE REGISTRO:</span> <b style="color:white;">${(uData.nombre + " " + (uData.apellido||"")).toUpperCase()}</b></div>
                    <div><span class="detail-label">FECHA DE REGISTRO:</span> <b style="color:white;">${new Date(b.creado).toLocaleString()}</b></div>
                </div>
            </div>
        `;
    }).catch(err => {
        notify("Error en la búsqueda");
        console.error(err);
    });
}

function registrarBoletaEntregada() {
    const num = document.getElementById('input-boleta-entregada').value.trim();
    if(!num) return notify("<i class='fa-solid fa-triangle-exclamation'></i> Ingresa el número");
    if(isNaN(num)) return notify("<i class='fa-solid fa-triangle-exclamation'></i> Debe ser un número válido");

    const email = auth.currentUser.email;
    const currentEntregadas = currentUserData.boletasEntregadas || [];
    
    if(currentEntregadas.includes(num)) {
        return notify("<i class='fa-solid fa-triangle-exclamation'></i> Esta boleta ya la tienes asignada");
    }

    const nuevasEntregadas = [...currentEntregadas, num];
    db.collection("usuarios").doc(email).update({
        boletasEntregadas: nuevasEntregadas
    }).then(() => {
        document.getElementById('input-boleta-entregada').value = "";
        notify("<i class='fa-solid fa-check'></i> Boleta física asignada");
    });
}

function eliminarBoletaEntregada(numStr) {
    if(!confirm(`¿Devolver/Eliminar la boleta física N° ${numStr} de tu responsabilidad?`)) return;
    const email = auth.currentUser.email;
    const currentEntregadas = currentUserData.boletasEntregadas || [];
    const nuevasEntregadas = currentEntregadas.filter(n => n !== numStr);
    
    db.collection("usuarios").doc(email).update({
        boletasEntregadas: nuevasEntregadas
    }).then(() => {
        notify("<i class='fa-solid fa-trash'></i> Boleta removida de tus entregadas");
    });
}

function actualizarListaEntregadasVisual(setVendidasGlobal = new Set()) {
    const listDiv = document.getElementById('lista-entregadas-tags');
    if(!listDiv) return;
    listDiv.innerHTML = "";
    
    if(!currentUserData || !currentUserData.boletasEntregadas || currentUserData.boletasEntregadas.length === 0) {
        listDiv.innerHTML = "<p style='font-size:0.6rem; color:#64748b; width:100%; text-align:center;'>No has registrado boletas físicas entregadas.</p>";
        return;
    }

    let countVendidas = 0;
    currentUserData.boletasEntregadas.forEach(num => {
        const estaVendida = setVendidasGlobal.has(num.toString());
        if(estaVendida) countVendidas++;
        const colorBorder = estaVendida ? "#10b981" : "rgba(0,240,255,0.3)";
        const bg = estaVendida ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)";
        const iconoVendida = estaVendida ? `<i class="fa-solid fa-check" style="color:#10b981; font-size:0.5rem; margin-right:3px;"></i>` : '';
        
        listDiv.innerHTML += `
            <div class="team-mini-badge" style="border-color:${colorBorder}; background:${bg};">
                ${iconoVendida}N° ${num} 
                <span onclick="eliminarBoletaEntregada('${num}')"><i class="fa-solid fa-xmark"></i></span>
            </div>
        `;
    });
    
    listDiv.innerHTML = `<div style="width: 100%; text-align: center; font-size: 0.6rem; color: var(--accent); margin-bottom: 5px; font-weight: 800;">TOTAL ASIGNADAS: ${currentUserData.boletasEntregadas.length} | YA VENDIDAS: ${countVendidas}</div>` + listDiv.innerHTML;
}

function eliminarTodosRegistrosRecreador(recreadorNombre) {
    if(!confirm(`⚠️ ATENCIÓN: ¿Estás seguro de eliminar TODO EL REGISTRO DE VENTAS del recreador "${recreadorNombre.toUpperCase()}"? Esta acción no se puede deshacer.`)) return;

    db.collection("boletas").where("recreador", "==", recreadorNombre).get().then(snap => {
        const batch = db.batch();
        snap.forEach(doc => {
            batch.delete(doc.ref);
        });
        batch.commit().then(() => {
            notify("<i class='fa-solid fa-trash'></i> Registros eliminados");
        }).catch(err => notify("Error: " + err.message));
    });
}

function calcularEdad(fecha) {
    if (!fecha) return "---";
    const hoy = new Date(), nac = new Date(fecha);
    let e = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) e--;
    return e + " años";
}

function guardarPerfil() {
    const docu = document.getElementById('edit-doc').value.trim(), tel = document.getElementById('edit-tel').value.trim(), nac = document.getElementById('edit-nacimiento').value, col = document.getElementById('edit-color').value;
    if(!docu || !tel || !nac || !col) return notify("<i class='fa-solid fa-triangle-exclamation'></i> Faltan datos");
    if(confirm("¿Guardar datos permanentes? No podrás editarlos después.")) {
        db.collection("usuarios").doc(auth.currentUser.email).update({ doc: docu, tel: tel, nacimiento: nac, color: col }).then(() => {
            document.getElementById('perfil-edit-form').style.display = 'none';
            notify("<i class='fa-solid fa-check'></i> Perfil actualizado");
        });
    }
}

function abrirGestionBoletas(recreadorNombre) {
    const email = auth.currentUser.email;
    const esAdmin = (email === ADMIN_EMAIL || currentUserData.rango === "Coordinador General" || currentUserData.rango === "Coordinador");

    db.collection("boletas").where("recreador", "==", recreadorNombre).get().then(snap => {
        let html = `<h3 style="margin-top:0; font-size:1rem;">VENTAS DE ${recreadorNombre.toUpperCase()}</h3>
                    <div style="max-height: 50vh; overflow-y: auto; padding-right:5px; margin-top:15px; display:flex; flex-direction:column; gap:8px;">`;
        let count = 0;
        snap.forEach(doc => {
            const b = doc.data();
            const esMio = b.vendedor === email;
            if(!esAdmin && !esMio) return;
            count++;
            
            const btnEst = esAdmin ? `<button class="btn-status ${b.estado === 'Activa' ? 'btn-active' : 'btn-pending'}" onclick="toggleEstadoBoleta('${doc.id}', '${b.estado}')">${b.estado.toUpperCase()}</button>` : `<span class="status-${b.estado}">${b.estado.toUpperCase()}</span>`;
            const btnDel = (esAdmin || esMio) ? `<button class="btn-status btn-delete" onclick="eliminarBoleta('${doc.id}')"><i class="fa-solid fa-trash"></i></button>` : '';
            
            html += `
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(0,240,255,0.2); border-radius: 12px; padding: 12px; text-align: left; font-size: 0.7rem; position: relative;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; align-items:center;">
                        <b style="color:var(--accent); font-size:0.9rem;">N° ${b.n}</b>
                        <div style="display:flex; gap:5px;">${btnEst}${btnDel}</div>
                    </div>
                    <p style="margin: 2px 0;"><b>Comprador:</b> <span style="color:#f1f5f9;">${b.comprador}</span></p>
                    <p style="margin: 2px 0;"><b>WhatsApp:</b> <span style="color:#f1f5f9;">${b.tel}</span></p>
                    <p style="margin: 2px 0; font-size:0.55rem; color:#64748b;">${new Date(b.creado).toLocaleString()}</p>
                </div>
            `;
        });
        html += `</div>`;
        if(count === 0) html = `<h3 style="margin-top:0; font-size:1rem;">VENTAS DE ${recreadorNombre.toUpperCase()}</h3><p>No tienes permiso o no hay registros.</p>`;
        
        document.getElementById('gestion-boletas-render').innerHTML = html;
        document.getElementById('modal-gestion-boletas').style.display = 'flex';
    });
}

function cerrarModalGestion() { document.getElementById('modal-gestion-boletas').style.display = 'none'; }
function cerrarModal() { document.getElementById('modal-carnet').style.display = 'none'; }

function toggleEstadoBoleta(id, actual) {
    const nuevo = actual === 'Activa' ? 'Pendiente' : 'Activa';
    db.collection("boletas").doc(id).update({ estado: nuevo }).then(() => { cerrarModalGestion(); notify("<i class='fa-solid fa-rotate'></i> Estado actualizado"); });
}

function eliminarBoleta(id) {
    if(confirm("¿Eliminar boleta?")) { db.collection("boletas").doc(id).delete().then(() => { cerrarModalGestion(); notify("<i class='fa-solid fa-trash'></i> Boleta eliminada"); }); }
}

function loadAllUsers() {
    const search = document.getElementById('search-user').value.toLowerCase();
    const filterColor = document.getElementById('filter-user-color').value;
    const tbody = document.getElementById('lista-usuarios-body');
    const miRango = (auth.currentUser.email === ADMIN_EMAIL) ? "Administrador" : currentUserData.rango;
    const esSuperAdmin = (auth.currentUser.email === ADMIN_EMAIL);
    const esAdmin = (esSuperAdmin || miRango === "Coordinador General");
    
    db.collection("usuarios").orderBy("creado", "desc").onSnapshot(snap => {
        tbody.innerHTML = "";
        let count = 0;
        let boletasMap = {};
        
        db.collection("boletas").get().then(bSnap => {
            bSnap.forEach(b => {
                const vendor = b.data().vendedor;
                boletasMap[vendor] = (boletasMap[vendor] || 0) + 1;
            });

            let resumenEquipos = {};

            snap.forEach(doc => {
                const u = doc.data();
                const nomCom = ((u.nombre || "") + " " + (u.apellido || "")).toLowerCase();
                const col = u.color || "Gris";
                const r = u.rango || "Recreador";
                
                if (filterColor !== "Todos" && col !== filterColor) return;
                if (search && !nomCom.includes(search) && !(u.doc || "").includes(search)) return;

                if(!resumenEquipos[col]) resumenEquipos[col] = 0;
                resumenEquipos[col]++;

                count++;
                const isIns = u.inscripcion === "SI";
                const insBtn = isIns ? `<button class="btn-status btn-active" onclick="toggleInscripcion('${doc.id}', 'NO')">SI</button>` : `<button class="btn-status btn-pending" onclick="toggleInscripcion('${doc.id}', 'SI')">NO</button>`;
                
                let rangoSelect = `<span>${r.toUpperCase()}</span>`;
                if(esAdmin) {
                    rangoSelect = `
                    <select class="dynamic-colors" style="width:100px; padding:4px; font-size:0.55rem;" onchange="cambiarRango('${doc.id}', this.value)">
                        <option value="Recreador" ${r==='Recreador'?'selected':''}>Recreador</option>
                        <option value="Coordinador" ${r==='Coordinador'?'selected':''}>Coordinador</option>
                        <option value="Coordinador General" ${r==='Coordinador General'?'selected':''}>Coord. General</option>
                    </select>`;
                }

                const delBtn = esSuperAdmin ? `<button class="btn-status btn-delete" style="padding: 4px 8px;" onclick="eliminarUsuario('${doc.id}')"><i class="fa-solid fa-trash"></i></button>` : '';

                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight:800;">${count}</td>
                        <td style="font-weight:800; color:var(--accent); cursor:pointer; text-decoration:underline;" onclick="verCarnet('${doc.id}')">${(u.nombre + " " + (u.apellido||"")).toUpperCase()}</td>
                        <td style="font-size:0.55rem; color:#94a3b8;">${r.toUpperCase()}</td>
                        <td>${calcularEdad(u.nacimiento)}</td>
                        <td>${u.doc || "---"}</td>
                        <td>${u.tel || "---"}</td>
                        <td><span class="team-dot" style="background:${col.toLowerCase()}"></span> ${col}</td>
                        <td style="font-size:0.55rem;">${new Date(u.creado).toLocaleDateString()}</td>
                        <td><span class="badge-rango" style="background:rgba(255,255,255,0.05); font-size:0.5rem; border:1px solid rgba(0,240,255,0.2);">V:${boletasMap[doc.id]||0} | E:${(u.boletasEntregadas||[]).length}</span></td>
                        <td class="col-rango-permiso" style="display:${esAdmin ? 'table-cell' : 'none'};">${insBtn}</td>
                        <td class="col-rango-admin" style="display:${esAdmin ? 'table-cell' : 'none'};">${rangoSelect}</td>
                        <td class="col-rango-admin" style="display:${esSuperAdmin ? 'table-cell' : 'none'};">${delBtn}</td>
                    </tr>`;
            });
            document.getElementById('conteo-personal-total').innerText = "Total integrantes: " + count;
            
            if(esAdmin) {
                document.getElementById('resumen-personal-total-admin').innerText = count;
                let htmlPerE = "<p class='mini-title'>PERSONAL POR EQUIPO</p>";
                for(let eq in resumenEquipos) {
                    htmlPerE += `<div class='summary-row'><span>${eq}</span><b>${resumenEquipos[eq]} integrantes</b></div>`;
                }
                document.getElementById('resumen-personal-equipos').innerHTML = htmlPerE;
            }
        });
    });
}

function cambiarRango(email, nuevoRango) {
    db.collection("usuarios").doc(email).update({ rango: nuevoRango }).then(() => notify("<i class='fa-solid fa-check'></i> Rango actualizado"));
}

function toggleInscripcion(email, estado) {
    db.collection("usuarios").doc(email).update({ inscripcion: estado }).then(() => notify("<i class='fa-solid fa-check'></i> Inscripción actualizada"));
}

function eliminarUsuario(email) {
    if(confirm("¿Eliminar usuario por completo? Esto no borra sus ventas, pero le quita el acceso.")) {
        db.collection("usuarios").doc(email).delete().then(() => notify("<i class='fa-solid fa-trash'></i> Usuario eliminado de la BD"));
    }
}

function verCarnet(email) {
    db.collection("usuarios").doc(email).get().then(doc => {
        const u = doc.data();
        document.getElementById('carnet-detalle-render').innerHTML = `
            <div class="id-card-mini" style="margin-bottom:0; background:transparent; border:none; box-shadow:none;">
                <div class="avatar-circle">${u.nombre ? u.nombre[0] : 'S'}</div>
                <h3>${(u.nombre + " " + (u.apellido || "")).toUpperCase()}</h3>
                <p class="badge-rango-perfil">${(u.rango || 'RECREADOR').toUpperCase()}</p>
                <div class="id-card-details">
                    <div class="id-detail-item"><span class="detail-label">EQUIPO</span><span class="detail-value">${(u.color||'---').toUpperCase()}</span></div>
                    <div class="id-detail-item"><span class="detail-label">DOCUMENTO</span><span class="detail-value">${u.doc||'---'}</span></div>
                    <div class="id-detail-item"><span class="detail-label">WHATSAPP</span><span class="detail-value">${u.tel||'---'}</span></div>
                    <div class="id-detail-item"><span class="detail-label">EDAD</span><span class="detail-value">${calcularEdad(u.nacimiento).toUpperCase()}</span></div>
                </div>
                <p class="card-brand-footer" style="margin-top:30px;">LOGISTICA & EVENTOS<br><span style="font-size:0.4rem; color:#64748b; font-weight:400; letter-spacing:0;">${email}</span></p>
            </div>
        `;
        document.getElementById('modal-carnet').style.display = 'flex';
    });
}

function eliminarPersonalPorCodigoInvitacion() {
    const cod = document.getElementById('del-invite-code').value.trim();
    if(!cod) return notify("<i class='fa-solid fa-triangle-exclamation'></i> Ingresa el código de invitación a eliminar");
    if(!confirm(`⚠️ ATENCIÓN: Se eliminará todo el personal que se haya registrado utilizando el código "${cod}". ¿Proceder?`)) return;

    db.collection("usuarios").where("codigoUsado", "==", cod).get().then(snap => {
        if(snap.empty) return notify("No se encontró personal con este código.");
        const batch = db.batch();
        let cuenta = 0;
        snap.forEach(doc => { batch.delete(doc.ref); cuenta++; });
        batch.commit().then(() => {
            document.getElementById('del-invite-code').value = "";
            notify(`<i class='fa-solid fa-trash'></i> ${cuenta} usuarios eliminados`);
        }).catch(err => notify("Error: " + err.message));
    });
}

function eliminarBoletasPorRango() {
    const ini = document.getElementById('del-bol-inicio').value;
    const fin = document.getElementById('del-bol-fin').value;
    if(!ini || !fin) return notify("<i class='fa-solid fa-triangle-exclamation'></i> Selecciona ambas fechas");
    
    const dIni = new Date(ini + "T00:00:00").getTime();
    const dFin = new Date(fin + "T23:59:59").getTime();

    if(dIni > dFin) return notify("<i class='fa-solid fa-triangle-exclamation'></i> La fecha inicial debe ser menor");
    if(!confirm(`⚠️ ATENCIÓN: Eliminarás TODAS las boletas creadas entre ${ini} y ${fin}. Esto es irreversible. ¿Confirmar?`)) return;

    db.collection("boletas").where("creado", ">=", dIni).where("creado", "<=", dFin).get().then(snap => {
        if(snap.empty) return notify("No hay boletas en ese rango");
        const batch = db.batch();
        let cuenta = 0;
        snap.forEach(doc => { batch.delete(doc.ref); cuenta++; });
        batch.commit().then(() => {
            document.getElementById('del-bol-inicio').value = ""; document.getElementById('del-bol-fin').value = "";
            notify(`<i class='fa-solid fa-trash'></i> ${cuenta} boletas eliminadas`);
        }).catch(err => notify("Error: " + err.message));
    });
}

function exportarPersonalExcel() {
    db.collection("usuarios").orderBy("creado", "desc").get().then(snap => {
        const rows = [["ITEM", "NOMBRES", "RANGO", "EDAD", "CORREO", "DOCUMENTO", "WHATSAPP", "EQUIPO", "INSCRITO"]];
        let c = 0;
        snap.forEach(doc => {
            const u = doc.data();
            const filterColor = document.getElementById('filter-user-color').value;
            if(filterColor === "Todos" || u.color === filterColor) {
                c++; rows.push([c, (u.nombre + " " + (u.apellido||"")).toUpperCase(), u.rango || "Recreador", calcularEdad(u.nacimiento), doc.id, u.doc || "", u.tel || "", u.color, u.inscripcion || "NO"]); 
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
            rows.push([exportContador, b.n, col.toUpperCase(), b.recreador.toUpperCase(), b.comprador.toUpperCase(), b.tel, b.estado.toUpperCase(), new Date(b.creado).toLocaleDateString()]);
        });
        const ws = XLSX.utils.aoa_to_sheet(rows), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Ventas"); XLSX.writeFile(wb, "Reporte_Ventas.xlsx");
    });
}