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

// Variables de Estado (Manejo en Memoria RAM Local)
let currentUserData = null;
let allUsers = [];
let allBoletas = [];
let allComunicados = [];

let currentInviteCode = "CARGANDO...";
let listadoCodigos = [];
let listadoEquipos = [];
let sesionIniciada = false;
let listenersActivos = false;

let timerBusquedaPersonal;
let filtroCodigoGlobal = "Todos";

auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('view-auth').style.display = 'none';
        document.getElementById('view-home').style.display = 'flex';
        db.collection("usuarios").doc(user.email).update({ lastLogin: Date.now() }).catch(() => {});
        sesionIniciada = false; 
        loadUser();
    } else {
        document.getElementById('view-auth').style.display = 'block';
        document.getElementById('view-home').style.display = 'none';
        listenInviteCode();
        listenEquipos();
    }
});

function listenEquipos() {
    db.collection("configuracion").doc("equipos").onSnapshot(doc => {
        listadoEquipos = doc.exists ? doc.data().lista : ["Verde", "Naranja", "Morado", "Azul"];
        actualizarDesplegablesEquipos();
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

function listenInviteCode() {
    db.collection("configuracion").doc("seguridad").onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            listadoCodigos = data.listaCodigos ? data.listaCodigos : (data.codigoInvitacion ? [data.codigoInvitacion] : ["LOGISTICA001"]);
            currentInviteCode = listadoCodigos[listadoCodigos.length - 1]; 
            actualizarPanelCodigosMultiples();
            actualizarFiltroGlobalCodigos();
        } else {
            currentInviteCode = "LOGISTICA001";
            listadoCodigos = ["LOGISTICA001"];
            actualizarFiltroGlobalCodigos();
        }
    });
}

function actualizarFiltroGlobalCodigos() {
    const sel = document.getElementById('global-code-filter');
    if(!sel) return;
    const prev = sel.value;
    sel.innerHTML = `<option value="Todos">★ TODOS LOS GRUPOS</option>`;
    listadoCodigos.forEach(cod => {
        sel.innerHTML += `<option value="${cod}">GRUPO: ${cod}</option>`;
    });
    if(prev && (listadoCodigos.includes(prev) || prev === "Todos")) {
        sel.value = prev;
    }
}

function aplicarFiltroCodigoGlobal() {
    filtroCodigoGlobal = document.getElementById('global-code-filter').value;
    renderUsuarios();
    renderBoletas();
}

function actualizarPanelCodigosMultiples() {
    const listDiv = document.getElementById('admin-invite-codes-list');
    if(listDiv) {
        listDiv.innerHTML = "";
        listadoCodigos.forEach(cod => {
            listDiv.innerHTML += `<div class="team-mini-badge" style="background:rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; color:#fcd34d;">${cod} <span onclick="eliminarCodigoInvitacion('${cod}')"><i class="fa-solid fa-xmark"></i></span></div>`;
        });
    }

    const delSelect = document.getElementById('del-staff-code-select');
    if (delSelect) {
        delSelect.innerHTML = `<option value="" disabled selected>Selecciona un código</option>`;
        listadoCodigos.forEach(cod => {
            delSelect.innerHTML += `<option value="${cod}">${cod}</option>`;
        });
    }
}

function agregarCodigoInvitacion() {
    const input = document.getElementById('new-invite-code');
    const nuevoCodigo = input.value.trim();
    if(nuevoCodigo.length < 4) return notify("⚠️ El código debe ser más largo");
    if(listadoCodigos.includes(nuevoCodigo)) return notify("⚠️ El código ya existe");
    
    const nuevaLista = [...listadoCodigos, nuevoCodigo];
    db.collection("configuracion").doc("seguridad").set({
        listaCodigos: nuevaLista,
        actualizadoPor: auth.currentUser.email,
        fechaCambio: Date.now()
    }, {merge: true}).then(() => { 
        notify("✅ Código añadido"); 
        input.value = ""; 
    });
}

function actualizarCodigoInvitacion() {
    agregarCodigoInvitacion();
}

function eliminarCodigoInvitacion(cod) {
    if(listadoCodigos.length <= 1) return notify("⚠️ Debe haber al menos un código");
    if(!confirm(`¿Eliminar el código "${cod}"?`)) return;
    const nuevaLista = listadoCodigos.filter(c => c !== cod);
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
        listenInviteCode();
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
        
        const esAdmin = (rango === "Administrador"), esCGeneral = (rango === "Coordinador General"), esCoordinador = (rango === "Coordinador"), esRecreador = (rango === "Recreador");
        const buscadorGlobal = document.getElementById('container-buscador-global');
        if(buscadorGlobal) buscadorGlobal.style.display = esAdmin ? 'block' : 'none';

        document.getElementById('nav-usuarios-adm').style.display = (!esRecreador) ? 'block' : 'none';
        
        const panelEntregadas = document.getElementById('panel-boletas-entregadas');
        if (panelEntregadas) panelEntregadas.style.display = esRecreador ? 'block' : 'none';

        const navAdmin = document.getElementById('nav-administracion');
        if (esAdmin || esCGeneral || esCoordinador) {
            navAdmin.style.display = 'block';
            document.getElementById('admin-edit-panel-code').style.display = esAdmin ? 'block' : 'none';
            document.getElementById('admin-delete-range-panel').style.display = esAdmin ? 'block' : 'none';
            document.getElementById('admin-delete-staff-code-panel').style.display = esAdmin ? 'block' : 'none';
            document.getElementById('global-code-filter').style.display = 'block';
        } else {
            navAdmin.style.display = 'none';
            document.getElementById('global-code-filter').style.display = 'none';
        }
        document.getElementById('admin-com-form').style.display = (esAdmin || esCGeneral) ? 'flex' : 'none';
        document.getElementById('filter-color').style.display = (esRecreador) ? 'none' : 'block';
        const canExport = (esAdmin || esCGeneral);
        document.getElementById('btn-rep-ventas').style.display = canExport ? 'block' : 'none';
        document.getElementById('btn-rep-personal').style.display = canExport ? 'block' : 'none';

        const formEdit = document.getElementById('perfil-edit-form');
        const faltanDatos = !(d.doc && d.tel && d.nacimiento);

        if (faltanDatos) {
            formEdit.style.display = 'flex';
            document.querySelectorAll('.nav-item').forEach(btn => {
                if (btn.id !== 'nav-perfil') {
                    btn.style.pointerEvents = 'none';
                    btn.style.opacity = '0.3';
                }
            });
            showSection('perfil');
            if (!sesionIniciada) notify("⚠️ Completa tu perfil para acceder al sistema");
            sesionIniciada = true;
        } else {
            formEdit.style.display = 'none';
            
            const estabaBloqueado = document.getElementById('nav-comunicados').style.pointerEvents === 'none';
            
            document.querySelectorAll('.nav-item').forEach(btn => {
                btn.style.pointerEvents = 'auto';
                btn.style.opacity = '1';
            });
            
            if (!listenersActivos) {
                initDataListeners();
                listenersActivos = true;
            } else {
                renderBoletas();
                renderUsuarios();
                renderComunicados();
            }
            
            if (!sesionIniciada || estabaBloqueado) {
                showSection('comunicados');
                if (estabaBloqueado) notify("✅ Perfil completado. Sistema desbloqueado.");
            }
            sesionIniciada = true;
        }
    });
}

function initDataListeners() {
    db.collection("usuarios").orderBy("creado", "desc").onSnapshot(snap => {
        allUsers = [];
        snap.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));
        renderUsuarios();
        renderBoletas(); 
    });

    db.collection("boletas").orderBy("creado", "desc").onSnapshot(snap => {
        allBoletas = [];
        snap.forEach(doc => allBoletas.push({ id: doc.id, ...doc.data() }));
        renderBoletas();
    });

    db.collection("comunicados").orderBy("fecha", "desc").onSnapshot(snap => {
        allComunicados = [];
        snap.forEach(doc => allComunicados.push({ id: doc.id, ...doc.data() }));
        renderComunicados();
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
    if(!listadoCodigos.includes(c)) return notify("❌ Código Incorrecto o Expirado");
    auth.createUserWithEmailAndPassword(e, p).then(() => db.collection("usuarios").doc(e).set({ nombre: n, apellido: a, color: col, creado: Date.now(), rango: 'Recreador', inscripcion: 'NO', codigoInvitacion: c }).then(() => location.reload())).catch(err => notify(err.message));
}

function renderBoletas() {
    if(!currentUserData) return;
    const email = auth.currentUser.email;
    const r = (email === ADMIN_EMAIL) ? "Administrador" : (currentUserData.rango || "Recreador");
    const esAdmin = (r === "Administrador"), esCGeneral = (r === "Coordinador General"), esCoordinador = (r === "Coordinador");
    
    const filterCol = document.getElementById('filter-color').value;
    const filterEst = document.getElementById('filter-estado').value;

    const mapaColor = {}; 
    const mapaEntregadas = {};
    const mapaRecreadores = {}; 
    const mapaCodigos = {};

    allUsers.forEach(u => {
        mapaColor[u.id] = u.color || 'Gris';
        mapaEntregadas[u.id] = u.boletasEntregadas || [];
        mapaCodigos[u.id] = u.codigoInvitacion || '---';
    });
    
    let contadorTotal = 0, activas = 0, pendientes = 0;
    let boletasPorEquipo = {};
    let setBoletasVendidasGlobal = new Set();

    allBoletas.forEach(b => {
        const codigoVendedor = mapaCodigos[b.vendedor] || '---';
        
        if (filtroCodigoGlobal !== "Todos" && codigoVendedor !== filtroCodigoGlobal) return;

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
        mapaRecreadores[recKey].ids.push(b);

        if(!boletasPorEquipo[col]) boletasPorEquipo[col] = { total: 0, activas: 0, pendientes: 0 };
        boletasPorEquipo[col].total++;
        if(b.estado === 'Activa') boletasPorEquipo[col].activas++; else boletasPorEquipo[col].pendientes++;
    });

    let index = 1;
    let htmlBoletas = "";
    
    for (let nombre in mapaRecreadores) {
        const data = mapaRecreadores[nombre];
        if(!(esAdmin || esCGeneral || esCoordinador) && data.emailVendedor !== email) continue;
        if(filterCol !== "Todos" && data.color !== filterCol) continue;
        
        if(filterEst === "Activa" && data.activas === 0) continue;
        if(filterEst === "Pendiente" && data.pendientes === 0) continue;

        const accionHtml = (esAdmin) 
            ? `<td><button class="btn-status btn-delete" style="padding: 4px 8px; font-size: 0.5rem;" onclick="eliminarTodosRegistrosRecreador('${nombre}')"><i class="fa-solid fa-trash"></i></button></td>`
            : `<td><span class="badge-rango" style="background:rgba(255,255,255,0.05); font-size:0.5rem;">${data.emailVendedor === email ? 'MIS VENTAS' : 'REGISTRO'}</span></td>`;

        htmlBoletas += `
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

    document.getElementById('lista-boletas-body').innerHTML = htmlBoletas;

    if(document.getElementById('conteo-boletas-total')) document.getElementById('conteo-boletas-total').innerText = "Recreadores activos: " + (index - 1);
    actualizarListaEntregadasVisual(setBoletasVendidasGlobal);

    if(esAdmin || esCGeneral || esCoordinador) {
        if(document.getElementById('admin-tot-boletas')) document.getElementById('admin-tot-boletas').innerText = contadorTotal;
        if(document.getElementById('admin-tot-activas')) document.getElementById('admin-tot-activas').innerText = activas;
        if(document.getElementById('admin-tot-pendientes')) document.getElementById('admin-tot-pendientes').innerText = pendientes;
        
        let htmlBoletasE = "<p class='mini-title'>BOLETAS POR EQUIPO</p>";
        for(let eq in boletasPorEquipo) {
            htmlBoletasE += `<div class='summary-row'><span>${eq}</span><b>${boletasPorEquipo[eq].total} (A:${boletasPorEquipo[eq].activas})</b></div>`;
        }
        if(document.getElementById('resumen-boletas-equipos')) document.getElementById('resumen-boletas-equipos').innerHTML = htmlBoletasE;
    }
}

function renderComunicados() {
    if(!currentUserData) return;
    const email = auth.currentUser.email;
    const r = (email === ADMIN_EMAIL) ? "Administrador" : (currentUserData.rango || "Recreador");
    const esAdmin = (r === "Administrador"), esCGeneral = (r === "Coordinador General");
    const userColor = currentUserData.color || "Gris";

    let htmlComunicados = "";
    allComunicados.forEach(c => { 
        if (!(esAdmin || esCGeneral)) {
            const destinatarios = c.destinatarios || ["Todos"];
            if (!destinatarios.includes("Todos") && !destinatarios.includes(userColor)) return;
        }
        const del = esAdmin ? `<button class="del-com-btn" onclick="db.collection('comunicados').doc('${c.id}').delete()">✕</button>` : '';
        let extraInfo = "", countdownHtml = "", docBtn = "";
        if(c.linkDoc) docBtn = `<a href="${c.linkDoc}" target="_blank" class="com-doc-link">📁 DOCUMENTO</a>`;
        if(c.fechaEv) {
            const fEv = new Date(c.fechaEv + "T" + (c.horaEv || "00:00")), hoy = new Date();
            const dias = Math.ceil((fEv - hoy) / (1000 * 60 * 60 * 24));
            extraInfo = `<div class="com-meta-box"><span>📅 ${c.fechaEv}</span>${c.horaEv ? `<span>⏰ ${c.horaEv}</span>` : ''}${c.lugarEv ? `<span>📍 ${c.lugarEv}</span>` : ''}</div>`;
            if(dias > 0) countdownHtml = `<div class="com-countdown">Faltan <b>${dias}</b> días</div>`;
            else if (dias === 0) countdownHtml = `<div class="com-countdown today">¡Es Hoy!</div>`;
        }
        htmlComunicados += `<div class="com-card">${del}<div class="com-header"><span class="com-tag">INFO</span><h3>${c.titulo}</h3></div><p class="com-body">${c.mensaje}</p>${extraInfo}${docBtn}${countdownHtml}<div class="com-footer">Publicado: ${new Date(c.fecha).toLocaleDateString()}</div></div>`;
    });
    document.getElementById('comunicados-list').innerHTML = htmlComunicados;
}

function renderUsuarios() {
    if(!currentUserData) return;
    const email = auth.currentUser.email;
    const r = (email === ADMIN_EMAIL) ? "Administrador" : (currentUserData.rango || "Recreador");
    const esAdmin = (r === "Administrador"), esCGeneral = (r === "Coordinador General"), esCoordinador = (r === "Coordinador");
    
    if(r === "Recreador") return;

    let equipoCounts = {}, totalP = 0;
    let htmlUsuarios = "";

    allUsers.forEach(u => {
        const codigoUsuario = u.codigoInvitacion || '---';

        if (filtroCodigoGlobal !== "Todos" && codigoUsuario !== filtroCodigoGlobal) return;

        totalP++;
        const col = u.color || 'Gris';
        if(!equipoCounts[col]) equipoCounts[col] = 0;
        equipoCounts[col]++;

        const rangoTxt = (u.rango || 'Recreador').toUpperCase();
        const nombreCompleto = (u.nombre + " " + (u.apellido || "")).toUpperCase();
        const edadTxt = calcularEdad(u.nacimiento);
        const docTxt = u.doc || '---';
        const telTxt = u.tel || '---';
        
        const btnWa = u.tel ? `<a href="https://wa.me/57${u.tel}" target="_blank" style="color:#25D366; font-size:1.1rem; margin-left:5px; text-decoration:none;"><i class="fa-brands fa-whatsapp"></i></a>` : '';
        const fechaReg = u.creado ? new Date(u.creado).toLocaleDateString('es-CO') : '---';

        let btnValidar = u.inscripcion === 'SI' 
            ? `<button class="btn-status btn-approve" onclick="cambiarInscripcion('${u.id}', 'NO')">✓ SI</button>` 
            : `<button class="btn-status btn-pending" onclick="cambiarInscripcion('${u.id}', 'SI')">⏳ NO</button>`;
            
        let btnAdminHTML = "", btnRolHTML = "";
        
        if(esAdmin) {
            btnRolHTML = `<td class="col-rango-admin"><select onchange="cambiarRol('${u.id}', this.value)" style="padding:4px; font-size:0.55rem; background:rgba(0,0,0,0.5); border:1px solid rgba(0,240,255,0.3); color:white; border-radius:4px;"><option value="Recreador" ${u.rango==='Recreador'?'selected':''}>Recreador</option><option value="Coordinador" ${u.rango==='Coordinador'?'selected':''}>Coordinador</option><option value="Coordinador General" ${u.rango==='Coordinador General'?'selected':''}>C. General</option><option value="Administrador" ${u.rango==='Administrador'?'selected':''}>Administrador</option></select></td>`;
            btnAdminHTML = `<td class="col-rango-admin"><button class="btn-status btn-delete" style="padding:6px 10px;" onclick="eliminarUsuario('${u.id}')"><i class="fa-solid fa-trash"></i></button></td>`;
        }
        
        let validacionCol = (esAdmin || esCGeneral || esCoordinador) ? `<td class="col-rango-permiso">${btnValidar}</td>` : '';
        
        htmlUsuarios += `
        <tr class="user-row" data-name="${nombreCompleto.toLowerCase()}" data-doc="${docTxt}" data-color="${col}">
            <td><span class="badge-rango" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);">${rangoTxt}</span></td>
            <td style="font-weight:800; font-size:0.65rem; color:var(--accent); cursor:pointer; text-decoration:underline;" onclick="abrirCarnet('${u.id}')" title="Ver Carnet de Datos">${nombreCompleto}</td>
            <td>${edadTxt}</td>
            <td>${docTxt}</td>
            <td style="white-space: nowrap; display:flex; align-items:center; justify-content:center; gap:5px; border-bottom:none;">${telTxt} ${btnWa}</td>
            <td style="white-space: nowrap;"><span class="team-dot" style="background:${col.toLowerCase()}; border: 1px solid rgba(255,255,255,0.3);"></span> ${col.toUpperCase()}</td>
            <td style="font-size:0.6rem;">${fechaReg}</td>
            ${validacionCol}
            ${btnRolHTML}
            ${btnAdminHTML}
        </tr>`;
    });
    
    document.getElementById('lista-usuarios-body').innerHTML = htmlUsuarios;

    if(document.getElementById('conteo-personal-total')) document.getElementById('conteo-personal-total').innerText = "Total personal: " + totalP;
    
    if(esAdmin || esCGeneral || esCoordinador) {
        if(document.getElementById('admin-tot-personal')) document.getElementById('admin-tot-personal').innerText = totalP;
        
        let htmlPersonalE = "<p class='mini-title'>PERSONAL POR EQUIPO</p>";
        for(let eq in equipoCounts) htmlPersonalE += `<div class='summary-row'><span>${eq}</span><b>${equipoCounts[eq]}</b></div>`;
        if(document.getElementById('resumen-personal-equipos')) document.getElementById('resumen-personal-equipos').innerHTML = htmlPersonalE;
    }
    
    aplicarFiltrosUsuarios();
}

function listenUsuariosAdm() {
    clearTimeout(timerBusquedaPersonal);
    timerBusquedaPersonal = setTimeout(() => {
        aplicarFiltrosUsuarios();
    }, 250); 
}

function aplicarFiltrosUsuarios() {
    const s = document.getElementById('search-user').value.toLowerCase();
    const c = document.getElementById('filter-user-color').value;
    document.querySelectorAll('.user-row').forEach(row => {
        const n = row.getAttribute('data-name'), d = row.getAttribute('data-doc'), col = row.getAttribute('data-color');
        const matchT = n.includes(s) || d.includes(s);
        const matchC = (c === "Todos" || col === c);
        row.style.display = (matchT && matchC) ? '' : 'none';
    });
}

function actualizarListaEntregadasVisual(setBoletasVendidasGlobal = new Set()) {
    const container = document.getElementById('lista-entregadas-tags');
    if(!container) return;
    
    const entregadas = currentUserData?.boletasEntregadas || [];
    if(entregadas.length === 0) {
        container.innerHTML = `<p style="font-size:0.6rem; color:#94a3b8; width:100%; text-align:center;">No hay boletas físicas registradas</p>`;
        return;
    }
    
    let htmlContent = "";
    entregadas.forEach(num => {
        const vendida = setBoletasVendidasGlobal.has(num.toString());
        const bg = vendida ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
        const border = vendida ? '#10b981' : '#ef4444';
        const icon = vendida ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>';
        htmlContent += `<div class="team-mini-badge" style="background:${bg}; border:1px solid ${border};">${num} ${icon} <span onclick="eliminarBoletaEntregada('${num}')"><i class="fa-solid fa-trash"></i></span></div>`;
    });
    container.innerHTML = htmlContent;
}

function buscarDuenioBoleta() {
    const numero = document.getElementById('search-n-boleta').value.trim();
    const resultDiv = document.getElementById('resultado-busqueda-boleta');
    if(!numero) return notify("⚠️ Ingresa un número de boleta");

    resultDiv.style.display = 'block';
    
    const boletaEncontrada = allBoletas.find(b => b.n == numero);
    if(boletaEncontrada) {
        const u = allUsers.find(user => user.id === boletaEncontrada.vendedor) || { nombre: "Desconocido" };
        const colorEstado = boletaEncontrada.estado === 'Activa' ? '#10b981' : '#f59e0b';
        const colorBg = boletaEncontrada.estado === 'Activa' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)';
        
        resultDiv.innerHTML = `
            <div style="background: ${colorBg}; border: 1px solid ${colorEstado}; padding: 10px; border-radius: 12px; text-align: left;">
                <p style="margin:0; font-size:0.5rem; font-weight:800; color:${colorEstado};">ESTADO: VENDIDA (${boletaEncontrada.estado})</p>
                <p style="margin:2px 0; font-size:0.8rem; font-weight:900; color:white;">RECREADOR: ${(u.nombre + " " + (u.apellido || "")).toUpperCase()}</p>
                <p style="margin:0; font-size:0.6rem; font-weight:700; color:#cbd5e1;">EQUIPO: ${(u.color || "---").toUpperCase()}</p>
                <p style="margin:5px 0 0 0; font-size:0.55rem; color:var(--accent);">Comprador: <b>${boletaEncontrada.c || boletaEncontrada.comprador || '---'}</b></p>
            </div>`;
        return;
    }

    let recreadorEncontrado = null;
    allUsers.forEach(u => {
        if(u.boletasEntregadas && u.boletasEntregadas.includes(numero)) {
            recreadorEncontrado = u;
        }
    });

    if(recreadorEncontrado) {
        resultDiv.innerHTML = `
            <div style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; padding: 10px; border-radius: 12px; text-align: left;">
                <p style="margin:0; font-size:0.5rem; font-weight:800; color:#ef4444;">ESTADO: FÍSICA (SIN VENTA REGISTRADA)</p>
                <p style="margin:2px 0; font-size:0.8rem; font-weight:900; color:white;">RECREADOR: ${(recreadorEncontrado.nombre + " " + (recreadorEncontrado.apellido || "")).toUpperCase()}</p>
                <p style="margin:0; font-size:0.6rem; font-weight:700; color:#cbd5e1;">EQUIPO: ${(recreadorEncontrado.color || "---").toUpperCase()}</p>
            </div>`;
    } else {
        resultDiv.innerHTML = `<p style="font-size:0.6rem; color:#ef4444; font-weight:800; background:rgba(239, 68, 68, 0.2); border:1px solid #ef4444; padding:10px; border-radius:10px;"><i class="fa-solid fa-xmark"></i> BOLETA NO REGISTRADA EN EL SISTEMA</p>`;
    }
}

async function eliminarTodosRegistrosRecreador(nombreRecreador) {
    if (!confirm(`¿Estás seguro de eliminar TODOS los registros de boletas para: ${nombreRecreador}?`)) return;
    
    const boletasABorrar = allBoletas.filter(b => b.recreador === nombreRecreador);
    if(boletasABorrar.length === 0) return notify("No hay registros para este recreador");

    let batch = db.batch();
    boletasABorrar.forEach(b => {
        batch.delete(db.collection("boletas").doc(b.id));
    });
    batch.commit().then(() => notify(`🗑️ Registros de ${nombreRecreador} eliminados`));
}

function abrirGestionBoletas(nombreRecreador) {
    const email = auth.currentUser.email;
    const r = (email === ADMIN_EMAIL) ? "Administrador" : (currentUserData.rango || "Recreador");
    const esAdmin = (r === "Administrador" || r === "Coordinador General");
    const render = document.getElementById('gestion-boletas-render');
    document.getElementById('modal-gestion-boletas').style.display = 'flex';

    const boletasRecreador = allBoletas.filter(b => b.recreador === nombreRecreador);
    
    if(boletasRecreador.length === 0) {
        render.innerHTML = `<h3 style="color:var(--accent); text-align:center; margin-bottom:15px;">BOLETAS: ${nombreRecreador.toUpperCase()}</h3><p style="text-align:center; font-size:0.7rem;">No hay boletas registradas.</p>`;
        return;
    }

    render.innerHTML = `<h3 style="color:var(--accent); text-align:center; margin-bottom:15px;">BOLETAS: ${nombreRecreador.toUpperCase()}</h3>`;
    let htmlTable = `<div class="table-container" style="max-height: 400px; overflow-y: auto;">
                        <table>
                            <thead>
                                <tr>
                                    <th>N°</th>
                                    <th>Comprador</th>
                                    <th>WhatsApp</th>
                                    <th>Estado</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>`;
                            
    boletasRecreador.forEach(b => {
        const colorEstado = b.estado === 'Activa' ? '#10b981' : '#f59e0b';
        let botones = "<td>--</td>";
        if (esAdmin) {
            const nuevoEstado = b.estado === 'Activa' ? 'Pendiente' : 'Activa';
            const icon = b.estado === 'Activa' ? '<i class="fa-solid fa-hourglass-half"></i>' : '<i class="fa-solid fa-check-double"></i>';
            botones = `
                <td style="display:flex; gap:5px; justify-content:center;">
                    <button class="btn-status" style="background:rgba(255,255,255,0.1); color:var(--text-main); border:1px solid rgba(255,255,255,0.2);" onclick="cambiarEstado('${b.id}', '${nuevoEstado}'); cerrarModalGestion();">
                        ${icon}
                    </button>
                    <button class="btn-status btn-delete" onclick="eliminarBoleta('${b.id}'); cerrarModalGestion();">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>`;
        }
        
        const numBoleta = b.n || '--';
        const nomComprador = b.c || b.comprador || '--';
        const telComprador = b.t || b.whatsapp || '--';
        
        const btnWa = (telComprador !== '--') ? `<a href="https://wa.me/57${telComprador}" target="_blank" style="color:#25D366; font-size:1.1rem; margin-left:5px; text-decoration:none;"><i class="fa-brands fa-whatsapp"></i></a>` : '';

        htmlTable += `
            <tr>
                <td style="font-weight:800; color:white;">${numBoleta}</td>
                <td style="font-size:0.6rem; font-weight:800; color:#cbd5e1;">${nomComprador}</td>
                <td style="font-size:0.6rem; white-space: nowrap; display:flex; align-items:center; justify-content:center; gap:5px; border-bottom:none;">${telComprador} ${btnWa}</td>
                <td style="font-weight:800; color:${colorEstado}">${b.estado}</td>
                ${botones}
            </tr>`;
    });
    
    htmlTable += `</tbody></table></div>`;
    render.innerHTML += htmlTable;
}

function cerrarModalGestion() {
    document.getElementById('modal-gestion-boletas').style.display = 'none';
}

function registrarBoletaEntregada() {
    const input = document.getElementById('input-boleta-entregada');
    const valor = input.value.trim();
    if(!valor) return;
    const entregadas = currentUserData.boletasEntregadas || [];
    if(entregadas.includes(valor)) return notify("⚠️ Esta boleta ya está registrada");
    entregadas.push(valor);
    db.collection("usuarios").doc(auth.currentUser.email).update({ boletasEntregadas: entregadas }).then(() => {
        input.value = ""; notify("✅ Boleta registrada");
    });
}

function eliminarBoletaEntregada(num) {
    if(auth.currentUser.email !== ADMIN_EMAIL) return notify("⚠️ Solo el administrador puede borrar boletas físicas");
    const entregadas = currentUserData.boletasEntregadas.filter(n => n !== num);
    db.collection("usuarios").doc(auth.currentUser.email).update({ boletasEntregadas: entregadas }).then(() => notify("🗑️ Eliminada de entregadas"));
}

function publicarComunicado() {
    const t = document.getElementById('com-titulo').value, m = document.getElementById('com-mensaje').value, fE = document.getElementById('com-fecha-ev').value, hE = document.getElementById('com-hora-ev').value, lE = document.getElementById('com-lugar-ev').value, linkD = document.getElementById('com-link-doc').value;
    const destCheckboxes = document.querySelectorAll('input[name="dest-color"]:checked');
    let destinatarios = Array.from(destCheckboxes).map(cb => cb.value);
    if(destinatarios.length === 0) return notify("⚠️ Selecciona al menos un destinatario");
    if(destinatarios.includes("Todos")) destinatarios = ["Todos"];
    if(!t || !m) return notify("⚠️ Título y mensaje obligatorios");
    db.collection("comunicados").add({ titulo: t, mensaje: m, destinatarios: destinatarios, fechaEv: fE, horaEv: hE, lugarEv: lE, linkDoc: linkD, fecha: Date.now() }).then(() => { document.getElementById('com-titulo').value = ""; document.getElementById('com-mensaje').value = ""; document.getElementById('com-fecha-ev').value = ""; document.getElementById('com-hora-ev').value = ""; document.getElementById('com-lugar-ev').value = ""; document.getElementById('com-link-doc').value = ""; document.querySelectorAll('input[name="dest-color"]').forEach(cb => cb.checked = (cb.value === "Todos")); notify("🚀 Publicado"); });
}

function inscribirBoleta() {
    const r = document.getElementById('ins-rec-nom').value, n = document.getElementById('ins-n-boleta').value, c = document.getElementById('ins-com-nom').value, t = document.getElementById('ins-com-tel').value;
    if(!n || !c) return notify("⚠️ Datos incompletos");
    db.collection("boletas").add({ recreador: r, n: n, c: c, t: t, vendedor: auth.currentUser.email, estado: 'Pendiente', creado: Date.now() }).then(() => {
        document.getElementById('ins-rec-nom').value = ""; document.getElementById('ins-n-boleta').value = ""; document.getElementById('ins-com-nom').value = ""; document.getElementById('ins-com-tel').value = "";
        notify("✅ Registrada");
    });
}

function cambiarEstado(id, est) { db.collection("boletas").doc(id).update({ estado: est }); }
function eliminarBoleta(id) { if(confirm("¿Eliminar registro?")) db.collection("boletas").doc(id).delete().then(() => notify("🗑️ Eliminado")); }

function guardarPerfil() {
    const doc = document.getElementById('edit-doc').value, tel = document.getElementById('edit-tel').value, nac = document.getElementById('edit-nacimiento').value, col = document.getElementById('edit-color').value;
    if(!doc || !tel || !nac) return notify("⚠️ Completa los datos");
    db.collection("usuarios").doc(auth.currentUser.email).update({ doc: doc, tel: tel, nacimiento: nac, color: col }).then(() => notify("✅ Guardado"));
}

function abrirCarnet(id) {
    const u = allUsers.find(user => user.id === id);
    if (!u) return;
    
    let foto = "S"; if(u.nombre) foto = u.nombre[0];
    
    let boletasHtml = '';
    if (u.boletasEntregadas && u.boletasEntregadas.length > 0) {
        boletasHtml = `<div style="margin-top:15px; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px; width:100%; text-align:center;">
            <span class="detail-label" style="display:block; margin-bottom:8px;">BOLETAS FÍSICAS ENTREGADAS (${u.boletasEntregadas.length})</span>
            <div style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center;">
                ${u.boletasEntregadas.map(b => `<span style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.2); color:white; font-size:0.55rem; padding:4px 8px; border-radius:6px; font-weight:800;">${b}</span>`).join('')}
            </div>
        </div>`;
    } else {
        boletasHtml = `<div style="margin-top:15px; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px; width:100%; text-align:center;">
            <span class="detail-label" style="display:block; margin-bottom:5px;">BOLETAS FÍSICAS ENTREGADAS (0)</span>
            <span style="font-size:0.55rem; color:#94a3b8;">Ninguna boleta registrada</span>
        </div>`;
    }

    document.getElementById('carnet-detalle-render').innerHTML = `
    <div class="id-card-mini" style="margin:0;">
        <div class="avatar-circle" style="width:70px; height:70px; font-size:2rem;">${foto}</div>
        <h3 style="font-size:1.2rem;">${(u.nombre+" "+(u.apellido||"")).toUpperCase()}</h3>
        <p class="badge-rango-perfil" style="margin-bottom:15px;">${u.rango||'RECREADOR'}</p>
        <div class="id-card-details">
            <div class="id-detail-item"><span class="detail-label">EQUIPO</span><span class="detail-value">${(u.color||'---').toUpperCase()}</span></div>
            <div class="id-detail-item"><span class="detail-label">DOCUMENTO</span><span class="detail-value">${u.doc||'---'}</span></div>
            <div class="id-detail-item"><span class="detail-label">WHATSAPP</span><span class="detail-value">${u.tel||'---'}</span></div>
            <div class="id-detail-item"><span class="detail-label">EDAD</span><span class="detail-value">${calcularEdad(u.nacimiento).toUpperCase()}</span></div>
            <div class="id-detail-item" style="grid-column: span 2;"><span class="detail-label">INSCRITO</span><span class="detail-value" style="color:${u.inscripcion==='SI'?'#10b981':'#ef4444'};">${u.inscripcion||'NO'}</span></div>
        </div>
        ${boletasHtml}
        <div class="card-brand-footer" style="margin-top:25px; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">LOGISTICA & EVENTOS</div>
    </div>`;
    
    document.getElementById('modal-carnet').style.display = 'flex';
}

function cerrarModal() { document.getElementById('modal-carnet').style.display = 'none'; }
function cambiarInscripcion(id, est) { db.collection("usuarios").doc(id).update({ inscripcion: est }); }
function cambiarRol(id, rol) { db.collection("usuarios").doc(id).update({ rango: rol }).then(() => notify("✅ Rango actualizado")); }
function eliminarUsuario(id) { if(confirm("¿Eliminar usuario permanentemente?")) db.collection("usuarios").doc(id).delete().then(() => notify("🗑️ Usuario eliminado")); }

async function eliminarPersonalPorCodigo() {
    const code = document.getElementById('del-staff-code-select').value;
    if(!code) return notify("⚠️ Selecciona un código de invitación primero");
    if(!confirm(`⚠️ PELIGRO: ¿Estás seguro de eliminar a TODO el personal que se registró usando el código "${code}"?`)) return;

    const usuariosABorrar = allUsers.filter(u => u.codigoInvitacion === code);
    if(usuariosABorrar.length === 0) return notify(`ℹ️ No hay usuarios registrados con el código ${code}`);

    let batch = db.batch();
    usuariosABorrar.forEach(u => {
        batch.delete(db.collection("usuarios").doc(u.id));
    });
    batch.commit().then(() => {
        document.getElementById('del-staff-code-select').value = "";
        notify(`🗑️ ${usuariosABorrar.length} usuarios eliminados`);
    }).catch(err => notify("❌ Error al eliminar: " + err.message));
}

async function eliminarBoletasPorRango() {
    const fInicio = document.getElementById('del-bol-inicio').value;
    const fFin = document.getElementById('del-bol-fin').value;
    
    if(!fInicio || !fFin) return notify("⚠️ Ingresa el rango de fechas");
    if(!confirm(`⚠️ ¿Eliminar todas las boletas registradas entre ${fInicio} y ${fFin}?`)) return;

    const tInicio = new Date(fInicio + "T00:00:00").getTime();
    const tFin = new Date(fFin + "T23:59:59").getTime();

    const boletasABorrar = allBoletas.filter(b => b.creado >= tInicio && b.creado <= tFin);
    
    if(boletasABorrar.length === 0) return notify("ℹ️ No se encontraron boletas en ese rango");

    let batch = db.batch();
    boletasABorrar.forEach(b => {
        batch.delete(db.collection("boletas").doc(b.id));
    });
    batch.commit().then(() => {
        document.getElementById('del-bol-inicio').value = "";
        document.getElementById('del-bol-fin').value = "";
        notify(`🗑️ ${boletasABorrar.length} boletas eliminadas`);
    });
}

function handleLogin() { const e = document.getElementById('login-email').value, p = document.getElementById('login-pass').value; auth.signInWithEmailAndPassword(e, p).catch(err => notify("❌ Error: " + err.message)); }
function handleLogout() { auth.signOut(); location.reload(); }
function toggleAuth(view) { if(view === 'reg') { document.getElementById('auth-login').style.display = 'none'; document.getElementById('auth-register').style.display = 'flex'; } else { document.getElementById('auth-register').style.display = 'none'; document.getElementById('auth-login').style.display = 'flex'; } }

function calcularEdad(fecha) {
    if(!fecha) return "---";
    const fNac = new Date(fecha), fHoy = new Date();
    let e = fHoy.getFullYear() - fNac.getFullYear();
    if(fHoy.getMonth() < fNac.getMonth() || (fHoy.getMonth() === fNac.getMonth() && fHoy.getDate() < fNac.getDate())) e--;
    return e + " Años";
}

function notify(msg) {
    const c = document.getElementById('toast-container');
    const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = msg;
    c.appendChild(d); setTimeout(() => d.remove(), 3000);
}

function exportarPersonalExcel() {
    const c = document.getElementById('filter-user-color').value;
    const rows = [["NOMBRE", "RANGO", "EDAD", "CORREO", "DOCUMENTO", "WHATSAPP", "EQUIPO", "INSCRITO"]];
    allUsers.forEach(u => {
        const codigoUsuario = u.codigoInvitacion || '---';
        if (filtroCodigoGlobal !== "Todos" && codigoUsuario !== filtroCodigoGlobal) return;
        
        if(c === "Todos" || u.color === c) {
            rows.push([(u.nombre+" "+(u.apellido||"")).toUpperCase(), u.rango || "Recreador", calcularEdad(u.nacimiento), u.id, u.doc || "", u.tel || "", u.color, u.inscripcion || "NO"]); 
        }
    });
    const ws = XLSX.utils.aoa_to_sheet(rows), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Personal"); XLSX.writeFile(wb, "Reporte_Personal.xlsx");
}

function exportarVentasExcel() {
    const filterCol = document.getElementById('filter-color').value, filterEst = document.getElementById('filter-estado').value;
    const rows = [["ITEM", "BOLETA", "EQUIPO", "RECREADOR", "COMPRADOR", "WHATSAPP", "ESTADO", "FECHA"]];
    
    const mapaColores = {}; 
    const mapaCodigos = {};
    allUsers.forEach(u => { 
        mapaColores[u.id] = u.color || 'Gris'; 
        mapaCodigos[u.id] = u.codigoInvitacion || '---'; 
    });
    
    let exportContador = 0;
    allBoletas.forEach(b => {
        const codigoVendedor = mapaCodigos[b.vendedor] || '---';
        if (filtroCodigoGlobal !== "Todos" && codigoVendedor !== filtroCodigoGlobal) return;
        
        const col = mapaColores[b.vendedor] || 'Gris';
        if(filterCol !== "Todos" && col !== filterCol) return;
        if(filterEst !== "Todos" && b.estado !== filterEst) return;
        
        exportContador++;
        rows.push([exportContador, b.n, col.toUpperCase(), b.recreador.toUpperCase(), b.c || b.comprador || '---', b.t || b.whatsapp || '---', b.estado, new Date(b.creado).toLocaleDateString()]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Ventas"); XLSX.writeFile(wb, "Reporte_Ventas.xlsx");
}

// ==========================================
// NUEVO CÓDIGO - SISTEMA DE ANUNCIO FLOTANTE (ACTUALIZADO PRIORI)
// ==========================================

let anuncioFlotanteData = null;
let anuncioTimer = null;

// Escuchador en tiempo real para todos los usuarios
db.collection("configuracion").doc("anuncio_flotante").onSnapshot(doc => {
    if (doc.exists) {
        anuncioFlotanteData = doc.data();
        evaluarAnuncioCiclo(); // Evaluamos de inmediato al recibir los datos
    } else {
        anuncioFlotanteData = null;
        if(anuncioTimer) clearTimeout(anuncioTimer);
    }
});

// Lógica inteligente para evaluar si corresponde mostrar el anuncio
function evaluarAnuncioCiclo() {
    if (anuncioTimer) clearTimeout(anuncioTimer);
    if (!anuncioFlotanteData) return;

    const data = anuncioFlotanteData;
    
    // 1. Verificamos si ya pasó la fecha y hora límite general
    if (data.fechaLimite && Date.now() > data.fechaLimite) return;

    // 2. Usamos LocalStorage para saber cuántas veces ha visto ESTE anuncio el usuario actual
    let stats = JSON.parse(localStorage.getItem('anuncio_stats_' + data.timestamp)) || { count: 0, lastShow: 0 };

    // 3. Verificamos si ya vio el anuncio la cantidad máxima de veces indicada por el admin
    if (data.cantidad && stats.count >= data.cantidad) return;

    const now = Date.now();
    const timeSinceLast = now - stats.lastShow;
    const intervalMs = (data.intervaloMin || 1) * 60 * 1000;

    // 4. Verificamos si ya pasó el intervalo de tiempo necesario o si es la primera vez (count 0)
    if (timeSinceLast >= intervalMs || stats.count === 0) {
        // Mostramos el anuncio
        mostrarAnuncioFlotante(data.texto, data.color, data.duracion);
        
        // Actualizamos los contadores locales del usuario
        stats.count++;
        stats.lastShow = Date.now();
        localStorage.setItem('anuncio_stats_' + data.timestamp, JSON.stringify(stats));

        // 5. Programar el siguiente anuncio automáticamente si aún faltan reproducciones
        if (stats.count < data.cantidad) {
            anuncioTimer = setTimeout(evaluarAnuncioCiclo, intervalMs);
        }
    } else {
        // Aún no pasa el intervalo de espera, lo programamos para el tiempo que falte
        const timeLeft = intervalMs - timeSinceLast;
        anuncioTimer = setTimeout(evaluarAnuncioCiclo, timeLeft);
    }
}

// Función que el administrador usa para enviar y programar el anuncio
function publicarAnuncioFlotante() {
    const texto = document.getElementById('admin-anuncio-texto').value.trim();
    const color = document.getElementById('admin-anuncio-color').value;
    
    let duracion = parseInt(document.getElementById('admin-anuncio-duracion').value);
    let intervalo = parseInt(document.getElementById('admin-anuncio-intervalo').value);
    let cantidad = parseInt(document.getElementById('admin-anuncio-cantidad').value);
    let fechaInput = document.getElementById('admin-anuncio-fecha').value;
    
    if (!texto) {
        if(typeof notify === "function") return notify("⚠️ Escribe un texto corto para el anuncio");
        else return alert("⚠️ Escribe un texto corto para el anuncio");
    }
    
    // Valores por defecto seguros si el admin deja espacios en blanco
    if (isNaN(duracion) || duracion < 1) duracion = 10; // 10 segundos 
    if (isNaN(intervalo) || intervalo < 1) intervalo = 1; // 1 minuto
    if (isNaN(cantidad) || cantidad < 1) cantidad = 1; // 1 vez
    
    let fechaLimite = 0;
    if (fechaInput) {
        fechaLimite = new Date(fechaInput).getTime();
    } else {
        // Si no se pone fecha, por defecto se destruirá en 24 horas exactas
        fechaLimite = Date.now() + (24 * 60 * 60 * 1000); 
    }

    db.collection("configuracion").doc("anuncio_flotante").set({
        texto: texto,
        color: color,
        duracion: duracion,
        intervaloMin: intervalo,
        cantidad: cantidad,
        fechaLimite: fechaLimite,
        timestamp: Date.now(),
        lanzadoPor: auth.currentUser.email
    }).then(() => {
        if(typeof notify === "function") notify("🚀 Anuncio programado con éxito");
        document.getElementById('admin-anuncio-texto').value = ""; 
    }).catch(err => {
        if(typeof notify === "function") notify("❌ Error: " + err.message);
    });
}

// Función visual (Render)
function mostrarAnuncioFlotante(texto, color, duracionSecs) {
    let el = document.getElementById('floating-announcement');
    if (!el) {
        el = document.createElement('div');
        el.id = 'floating-announcement';
        document.body.appendChild(el);
    }
    
    const newEl = el.cloneNode(true);
    el.parentNode.replaceChild(newEl, el);
    el = newEl;

    el.style.display = 'block';
    el.style.backgroundColor = color;
    el.style.color = (color === '#00f0ff' || color === '#10b981') ? '#000000' : '#ffffff';
    
    el.innerHTML = `<i class="fa-solid fa-bolt"></i> &nbsp; ${texto}`;
    el.style.setProperty('--anim-duration', `${duracionSecs}s`);
    
    setTimeout(() => {
        el.style.display = 'none';
    }, (duracionSecs * 1000) + 500);
}
