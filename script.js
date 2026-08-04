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

function fechaServidor() {
    return firebase.firestore.FieldValue.serverTimestamp();
}

function convertirFechaFirestore(valor) {
    if(!valor) return null;
    if(typeof valor.toDate === "function") return valor.toDate();
    if(typeof valor.toMillis === "function") return new Date(valor.toMillis());

    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function obtenerMilisegundosFecha(valor) {
    const fecha = convertirFechaFirestore(valor);
    return fecha ? fecha.getTime() : 0;
}

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caracter]);
}

function codificarDatoEvento(valor) {
    return encodeURIComponent(String(valor ?? "")).replace(/'/g, "%27");
}

function obtenerUrlHttpSegura(valor) {
    const texto = String(valor ?? "").trim();
    if(!texto) return "";

    try {
        const url = new URL(texto);
        return (url.protocol === "http:" || url.protocol === "https:") ? url.href : "";
    } catch(error) {
        return "";
    }
}

function obtenerColorSeguro(valor, respaldo = "#64748b") {
    const color = String(valor ?? "").trim();
    return window.CSS && window.CSS.supports("color", color) ? color : respaldo;
}

function esComprobanteSeguro(valor) {
    return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(valor ?? ""));
}

let ultimoBotonAccion = null;
let momentoUltimoBoton = 0;

document.addEventListener("click", evento => {
    const objetivo = evento.target instanceof Element ? evento.target : null;
    const boton = objetivo ? objetivo.closest("button") : null;
    if(boton) {
        ultimoBotonAccion = boton;
        momentoUltimoBoton = Date.now();
    }
}, true);

function bloquearBotonActual(texto = "PROCESANDO...") {
    const activo = document.activeElement;
    const botonActivo = activo && activo.tagName === "BUTTON" ? activo : null;
    const botonReciente = Date.now() - momentoUltimoBoton < 1500 ? ultimoBotonAccion : null;
    const boton = botonActivo || botonReciente;

    if(!boton || boton.disabled) return () => {};

    const contenidoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.setAttribute("aria-busy", "true");
    boton.textContent = texto;

    return () => {
        if(!document.body.contains(boton)) return;
        boton.disabled = false;
        boton.removeAttribute("aria-busy");
        boton.innerHTML = contenidoOriginal;
    };
}

function obtenerMensajeError(error) {
    const codigo = String(error?.code || "").toLowerCase();

    if(codigo.includes("permission-denied")) return "No tienes permisos para realizar esta acción.";
    if(codigo.includes("unavailable") || codigo.includes("network-request-failed")) return "No hay conexión con Firebase. Revisa tu internet.";
    if(codigo.includes("unauthenticated") || codigo.includes("user-token-expired") || codigo.includes("id-token-expired")) return "Tu sesión venció. Cierra sesión e ingresa nuevamente.";
    if(codigo.includes("wrong-password") || codigo.includes("user-not-found") || codigo.includes("invalid-credential")) return "Correo o contraseña incorrectos.";
    if(codigo.includes("invalid-email")) return "El correo electrónico no es válido.";
    if(codigo.includes("email-already-in-use")) return "Este correo ya está registrado.";
    if(codigo.includes("weak-password")) return "La contraseña debe tener al menos 6 caracteres.";
    if(codigo.includes("too-many-requests")) return "Demasiados intentos. Espera unos minutos antes de volver a intentar.";

    return String(error?.message || "Ocurrió un error inesperado en el servidor.");
}

function manejarError(error, contexto = "No se pudo completar la acción") {
    console.error(contexto, error);
    notify(`❌ ${contexto}: ${obtenerMensajeError(error)}`);
}

function mostrarEstadoLista(id, mensaje, tipo = "carga", columnas = 1) {
    const contenedor = document.getElementById(id);
    if(!contenedor) return;

    const color = tipo === "error" ? "#ef4444" : "#94a3b8";
    contenedor.replaceChildren();

    if(contenedor.tagName === "TBODY") {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = columnas;
        celda.textContent = mensaje;
        celda.style.cssText = `text-align:center; color:${color}; padding:20px;`;
        fila.appendChild(celda);
        contenedor.appendChild(fila);
        return;
    }

    const texto = document.createElement("p");
    texto.textContent = mensaje;
    texto.style.cssText = `text-align:center; font-size:0.65rem; color:${color}; padding:10px;`;
    contenedor.appendChild(texto);
}

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

let unsubscribeEquipos = null;
let unsubscribeSeguridad = null;
let unsubscribeUsuarioActual = null;
let unsubscribeUsuarios = null;
let unsubscribeBoletas = null;
let unsubscribeComunicados = null;
let unsubscribeAnuncioFlotante = null;
let unsubscribePagosPendientes = null;
let listenerHistorialPagos = null;
let comprobantesTemp = {};
let alcanceDatosActivo = null;

function obtenerRangoActual() {
    const email = auth.currentUser ? auth.currentUser.email : "";
    if(email === ADMIN_EMAIL) return "Administrador";
    return currentUserData?.rango || "Recreador";
}

function esAdministradorActual() {
    return obtenerRangoActual() === "Administrador";
}

function puedeGestionarPagosActual() {
    const rango = obtenerRangoActual();
    return rango === "Administrador" || rango === "Coordinador General";
}

function detenerEscuchadoresDatos() {
    if(unsubscribeUsuarios) unsubscribeUsuarios();
    if(unsubscribeBoletas) unsubscribeBoletas();
    if(unsubscribeComunicados) unsubscribeComunicados();

    unsubscribeUsuarios = null;
    unsubscribeBoletas = null;
    unsubscribeComunicados = null;
    alcanceDatosActivo = null;
    listenersActivos = false;

    allUsers = [];
    allBoletas = [];
    allComunicados = [];
}

function detenerEscuchadorHistorialPagos() {
    if(listenerHistorialPagos) listenerHistorialPagos();
    listenerHistorialPagos = null;

    const historial = document.getElementById('admin-pagos-historial-wrapper');
    if(historial) historial.style.display = 'none';
}

function detenerEscuchadoresPagosAdministracion() {
    if(unsubscribePagosPendientes) unsubscribePagosPendientes();
    unsubscribePagosPendientes = null;
    detenerEscuchadorHistorialPagos();
    comprobantesTemp = {};
}

function detenerEscuchadoresPrivados() {
    if(unsubscribeSeguridad) unsubscribeSeguridad();
    if(unsubscribeUsuarioActual) unsubscribeUsuarioActual();
    if(unsubscribeAnuncioFlotante) unsubscribeAnuncioFlotante();

    detenerEscuchadoresPagosAdministracion();

    detenerEscuchadoresDatos();

    unsubscribeSeguridad = null;
    unsubscribeUsuarioActual = null;
    unsubscribeAnuncioFlotante = null;
}

auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('view-auth').style.display = 'none';
        document.getElementById('view-home').style.display = 'flex';
        db.collection("usuarios").doc(user.email).update({ lastLogin: fechaServidor() }).catch(error => {
            manejarError(error, "No se pudo actualizar la hora de conexión");
        });
        sesionIniciada = false; 
        loadUser();
    } else {
        detenerEscuchadoresPrivados();
        document.getElementById('view-auth').style.display = 'block';
        document.getElementById('view-home').style.display = 'none';
        listenEquipos();
    }
});

function listenEquipos() {
    if(unsubscribeEquipos) return;

    unsubscribeEquipos = db.collection("configuracion").doc("equipos").onSnapshot(doc => {
        listadoEquipos = doc.exists ? doc.data().lista : ["Verde", "Naranja", "Morado", "Azul", "Rojo"];
        actualizarDesplegablesEquipos();
    }, error => {
        listadoEquipos = ["Verde", "Naranja", "Morado", "Azul", "Rojo"];
        actualizarDesplegablesEquipos();
        manejarError(error, "No se pudieron cargar los equipos");
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
            const colSegura = escaparHTML(col);
            sel.innerHTML += `<option value="${colSegura}">${colSegura}</option>`;
        });
        if(currentVal) sel.value = currentVal;
    });
    const container = document.getElementById('com-destinatarios-list');
    if(container) {
        container.innerHTML = `<label><input type="checkbox" name="dest-color" value="Todos" checked><span>TODOS</span></label>`;
        listadoEquipos.forEach(col => {
            const colSegura = escaparHTML(col);
            container.innerHTML += `<label><input type="checkbox" name="dest-color" value="${colSegura}"><span>${escaparHTML(String(col).toUpperCase())}</span></label>`;
        });
    }
}

function listenInviteCode() {
    if(unsubscribeSeguridad) return;

    unsubscribeSeguridad = db.collection("configuracion").doc("seguridad").onSnapshot(doc => {
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
    }, error => {
        manejarError(error, "No se pudieron cargar los códigos de acceso");
    });
}

function actualizarFiltroGlobalCodigos() {
    const sel = document.getElementById('global-code-filter');
    if(!sel) return;
    const prev = sel.value;
    sel.innerHTML = `<option value="Todos">★ TODOS LOS GRUPOS</option>`;
    listadoCodigos.forEach(cod => {
        const codigoSeguro = escaparHTML(cod);
        sel.innerHTML += `<option value="${codigoSeguro}">GRUPO: ${codigoSeguro}</option>`;
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
            const codigoSeguro = escaparHTML(cod);
            const codigoEvento = codificarDatoEvento(cod);
            listDiv.innerHTML += `<div class="team-mini-badge" style="background:rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; color:#fcd34d;">${codigoSeguro} <span onclick="eliminarCodigoInvitacion(decodeURIComponent('${codigoEvento}'))"><i class="fa-solid fa-xmark"></i></span></div>`;
        });
    }

    const delSelect = document.getElementById('del-staff-code-select');
    if (delSelect) {
        delSelect.innerHTML = `<option value="" disabled selected>Selecciona un código</option>`;
        listadoCodigos.forEach(cod => {
            const codigoSeguro = escaparHTML(cod);
            delSelect.innerHTML += `<option value="${codigoSeguro}">${codigoSeguro}</option>`;
        });
    }
}

async function agregarCodigoInvitacion() {
    const input = document.getElementById('new-invite-code');
    const nuevoCodigo = input.value.trim();
    if(nuevoCodigo.length < 4) return notify("⚠️ El código debe ser más largo");
    if(listadoCodigos.includes(nuevoCodigo)) return notify("⚠️ El código ya existe");
    
    const nuevaLista = [...listadoCodigos, nuevoCodigo];
    const liberarBoton = bloquearBotonActual("GUARDANDO...");

    try {
        await db.collection("configuracion").doc("seguridad").set({
            listaCodigos: nuevaLista,
            actualizadoPor: auth.currentUser.email,
            fechaCambio: fechaServidor()
        }, {merge: true});
        notify("✅ Código añadido"); 
        input.value = ""; 
    } catch(error) {
        manejarError(error, "No se pudo agregar el código");
    } finally {
        liberarBoton();
    }
}

function actualizarCodigoInvitacion() {
    agregarCodigoInvitacion();
}

async function eliminarCodigoInvitacion(cod) {
    if(listadoCodigos.length <= 1) return notify("⚠️ Debe haber al menos un código");
    if(!confirm(`¿Eliminar el código "${cod}"?`)) return;
    const nuevaLista = listadoCodigos.filter(c => c !== cod);
    const liberarBoton = bloquearBotonActual("ELIMINANDO...");

    try {
        await db.collection("configuracion").doc("seguridad").update({
            listaCodigos: nuevaLista,
            actualizadoPor: auth.currentUser.email,
            fechaCambio: fechaServidor()
        });
        notify("🗑️ Código eliminado");
    } catch(error) {
        manejarError(error, "No se pudo eliminar el código");
    } finally {
        liberarBoton();
    }
}

function loadUser() {
    const email = auth.currentUser.email;
    if(unsubscribeUsuarioActual) unsubscribeUsuarioActual();

    unsubscribeUsuarioActual = db.collection("usuarios").doc(email).onSnapshot(doc => {
        const d = doc.data() || {};
        currentUserData = d;
        currentUserData.email = email;
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
        const fechaUltimoIngreso = convertirFechaFirestore(d.lastLogin);
        const lastLoginStr = fechaUltimoIngreso ? fechaUltimoIngreso.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "---";
        document.getElementById('p-conexion-view').innerText = lastLoginStr;
        document.getElementById('user-rank-badge').innerText = rango.toUpperCase();
        
        const esAdmin = (rango === "Administrador"), esCGeneral = (rango === "Coordinador General"), esCoordinador = (rango === "Coordinador"), esRecreador = (rango === "Recreador");
        const nuevoAlcanceDatos = esRecreador ? "propio" : "global";

        if(listenersActivos && alcanceDatosActivo !== nuevoAlcanceDatos) {
            detenerEscuchadoresDatos();
        }

        if(!esRecreador) listenInviteCode();
        listenAnuncioFlotante();

        if(esCGeneral || esAdmin) {
            const seccionAdministracion = document.getElementById('sec-administracion');
            if(seccionAdministracion && seccionAdministracion.style.display === 'block') {
                listenPagosPendientes();
            }
        } else {
            detenerEscuchadoresPagosAdministracion();
        }

        if(esRecreador) {
            allUsers = [{ id: email, ...currentUserData }];
        }

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
        document.getElementById('admin-floating-announcement').style.display = esAdmin ? 'block' : 'none';

        const panelPagos = document.getElementById('admin-pagos-list')?.closest('.admin-card');
        if(panelPagos) panelPagos.style.display = (esAdmin || esCGeneral) ? 'block' : 'none';

        const botonVaciarHistorial = document.querySelector('button[onclick="borrarTodoHistorialPagos()"]');
        if(botonVaciarHistorial) botonVaciarHistorial.style.display = esAdmin ? 'flex' : 'none';

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
    }, error => {
        manejarError(error, "No se pudo cargar tu perfil");
    });
}

function initDataListeners() {
    const email = auth.currentUser.email;
    const rango = obtenerRangoActual();
    const puedeVerTodo = rango === "Administrador" || rango === "Coordinador General" || rango === "Coordinador";

    alcanceDatosActivo = puedeVerTodo ? "global" : "propio";

    if(puedeVerTodo) {
        mostrarEstadoLista("lista-usuarios-body", "Cargando personal...", "carga", 10);
        unsubscribeUsuarios = db.collection("usuarios").orderBy("creado", "desc").onSnapshot(snap => {
            allUsers = [];
            snap.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));
            allUsers.sort((a, b) => obtenerMilisegundosFecha(b.creado) - obtenerMilisegundosFecha(a.creado));
            renderUsuarios();
            renderBoletas();
        }, error => {
            mostrarEstadoLista("lista-usuarios-body", "No fue posible cargar el personal.", "error", 10);
            manejarError(error, "No se pudo cargar el personal");
        });
    } else {
        allUsers = [{ id: email, ...currentUserData }];
    }

    const consultaBoletas = puedeVerTodo
        ? db.collection("boletas").orderBy("creado", "desc")
        : db.collection("boletas").where("vendedor", "==", email);

    mostrarEstadoLista("lista-boletas-body", "Cargando boletas...", "carga", 7);
    unsubscribeBoletas = consultaBoletas.onSnapshot(snap => {
        allBoletas = [];
        snap.forEach(doc => allBoletas.push({ id: doc.id, ...doc.data() }));
        allBoletas.sort((a, b) => obtenerMilisegundosFecha(b.creado) - obtenerMilisegundosFecha(a.creado));
        renderBoletas();
    }, error => {
        mostrarEstadoLista("lista-boletas-body", "No fue posible cargar las boletas.", "error", 7);
        manejarError(error, "No se pudieron cargar las boletas");
    });

    mostrarEstadoLista("comunicados-list", "Cargando comunicados...");
    unsubscribeComunicados = db.collection("comunicados").orderBy("fecha", "desc").onSnapshot(snap => {
        allComunicados = [];
        snap.forEach(doc => allComunicados.push({ id: doc.id, ...doc.data() }));
        allComunicados.sort((a, b) => obtenerMilisegundosFecha(b.fecha) - obtenerMilisegundosFecha(a.fecha));
        renderComunicados();
    }, error => {
        mostrarEstadoLista("comunicados-list", "No fue posible cargar los comunicados.", "error");
        manejarError(error, "No se pudieron cargar los comunicados");
    });
}

function showSection(id) {
    document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const target = document.getElementById('sec-' + id);
    if(target) target.style.display = 'block';
    const nav = document.getElementById('nav-' + id);
    if(nav) nav.classList.add('active');

    if(id === 'administracion' && puedeGestionarPagosActual()) {
        listenPagosPendientes();
    } else {
        detenerEscuchadoresPagosAdministracion();
    }
}

async function registrarConCodigo() {
    const n = document.getElementById('reg-nombre').value.trim();
    const a = document.getElementById('reg-apellido').value.trim();
    const e = document.getElementById('reg-email').value.trim().toLowerCase();
    const p = document.getElementById('reg-pass').value;
    const col = document.getElementById('reg-color').value;
    const c = document.getElementById('reg-invite').value.trim();

    if(!n || !a || !e || !p || !col || !c) return notify("⚠️ Completa todos los datos del registro");

    let credencial = null;
    const liberarBoton = bloquearBotonActual("REGISTRANDO...");

    try {
        credencial = await auth.createUserWithEmailAndPassword(e, p);
        await db.collection("usuarios").doc(credencial.user.email).set({
            nombre: n,
            apellido: a,
            color: col,
            creado: fechaServidor(),
            rango: 'Recreador',
            inscripcion: 'NO',
            codigoInvitacion: c
        });
        location.reload();
    } catch(err) {
        if(credencial?.user) {
            await credencial.user.delete().catch(errorLimpieza => {
                console.error("No se pudo revertir el usuario incompleto:", errorLimpieza);
            });
        }

        if(err.code === 'permission-denied') notify("❌ Código incorrecto, vencido o sin autorización");
        else manejarError(err, "No se pudo completar el registro");
    } finally {
        liberarBoton();
    }
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
    const mapaRecreadores = Object.create(null); 
    const mapaCodigos = {};
    const mapaNombres = {}; // NUEVO: Mapa para guardar los nombres del perfil

    allUsers.forEach(u => {
        mapaColor[u.id] = u.color || 'Gris';
        mapaEntregadas[u.id] = u.boletasEntregadas || [];
        mapaCodigos[u.id] = u.codigoInvitacion || '---';
        // NUEVO: Guardamos el nombre y apellido registrado en el perfil
        mapaNombres[u.id] = (u.nombre + " " + (u.apellido || "")).trim() || 'Sin Nombre'; 
    });
    
    let contadorTotal = 0, activas = 0, pendientes = 0;
    let boletasPorEquipo = Object.create(null);
    let setBoletasVendidasGlobal = new Set();

    allBoletas.forEach(b => {
        const codigoVendedor = mapaCodigos[b.vendedor] || '---';
        
        if (filtroCodigoGlobal !== "Todos" && codigoVendedor !== filtroCodigoGlobal) return;

        const col = mapaColor[b.vendedor] || 'Gris';
        if(b.n) setBoletasVendidasGlobal.add(b.n.toString());

        // MODIFICACIÓN APLICADA: Agrupa usando el nombre del perfil (mapaNombres) o 'Sin Nombre' si no hay.
        const recKey = mapaNombres[b.vendedor] || b.recreador || 'Sin Nombre';
        
        if(!mapaRecreadores[recKey]) {
            mapaRecreadores[recKey] = { 
                color: col, 
                total: 0, 
                activas: 0, 
                pendientes: 0, 
                ids: [], 
                emailVendedor: b.vendedor,
                entregadas: mapaEntregadas[b.vendedor] ? mapaEntregadas[b.vendedor].length : 0,
                fechaVenta: convertirFechaFirestore(b.creado)?.toLocaleDateString() || '---'
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

        const nombreSeguro = escaparHTML(String(nombre).toUpperCase());
        const nombreEvento = codificarDatoEvento(nombre);
        const colorTextoSeguro = escaparHTML(data.color);
        const colorVisualSeguro = obtenerColorSeguro(data.color);
        const fechaVentaSegura = escaparHTML(data.fechaVenta);

        const accionHtml = (esAdmin) 
            ? `<td><button class="btn-status btn-delete" style="padding: 4px 8px; font-size: 0.5rem;" onclick="eliminarTodosRegistrosRecreador(decodeURIComponent('${nombreEvento}'))"><i class="fa-solid fa-trash"></i></button></td>`
            : `<td><span class="badge-rango" style="background:rgba(255,255,255,0.05); font-size:0.5rem;">${data.emailVendedor === email ? 'MIS VENTAS' : 'REGISTRO'}</span></td>`;

        htmlBoletas += `
            <tr>
                <td style="font-weight:800;">${index++}</td>
                <td><span class="team-dot" style="background:${colorVisualSeguro}"></span> ${colorTextoSeguro}</td>
                <td style="font-weight:800; color:var(--accent); cursor:pointer; text-decoration:underline;" onclick="abrirGestionBoletas(decodeURIComponent('${nombreEvento}'))">
                    ${nombreSeguro}
                </td>
                <td style="font-weight:800; color:#6366f1;">${data.entregadas}</td>
                <td><b>${data.total}</b> (A:${data.activas} | P:${data.pendientes})</td>
                <td style="font-size:0.55rem;">${fechaVentaSegura}</td>
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
            htmlBoletasE += `<div class='summary-row'><span>${escaparHTML(eq)}</span><b>${boletasPorEquipo[eq].total} (A:${boletasPorEquipo[eq].activas})</b></div>`;
        }
        if(document.getElementById('resumen-boletas-equipos')) document.getElementById('resumen-boletas-equipos').innerHTML = htmlBoletasE;
    
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
            htmlBoletasE += `<div class='summary-row'><span>${escaparHTML(eq)}</span><b>${boletasPorEquipo[eq].total} (A:${boletasPorEquipo[eq].activas})</b></div>`;
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
        const comunicadoIdEvento = codificarDatoEvento(c.id);
        const del = esAdmin ? `<button class="del-com-btn" onclick="eliminarComunicado(decodeURIComponent('${comunicadoIdEvento}'))">✕</button>` : '';
        let extraInfo = "", countdownHtml = "", docBtn = "";
        const enlaceSeguro = obtenerUrlHttpSegura(c.linkDoc);
        if(enlaceSeguro) docBtn = `<a href="${escaparHTML(enlaceSeguro)}" target="_blank" rel="noopener noreferrer" class="com-doc-link">📁 CLICK AQUI</a>`;
        if(c.fechaEv) {
            const fEv = new Date(c.fechaEv + "T" + (c.horaEv || "00:00")), hoy = new Date();
            const dias = Math.ceil((fEv - hoy) / (1000 * 60 * 60 * 24));
            extraInfo = `<div class="com-meta-box"><span>📅 ${escaparHTML(c.fechaEv)}</span>${c.horaEv ? `<span>⏰ ${escaparHTML(c.horaEv)}</span>` : ''}${c.lugarEv ? `<span>📍 ${escaparHTML(c.lugarEv)}</span>` : ''}</div>`;
            if(dias > 0) countdownHtml = `<div class="com-countdown">Faltan <b>${dias}</b> días</div>`;
            else if (dias === 0) countdownHtml = `<div class="com-countdown today">¡Es Hoy!</div>`;
        }
        const fechaPublicacion = convertirFechaFirestore(c.fecha);
        htmlComunicados += `<div class="com-card">${del}<div class="com-header"><span class="com-tag">INFO</span><h3>${escaparHTML(c.titulo)}</h3></div><p class="com-body">${escaparHTML(c.mensaje)}</p>${extraInfo}${docBtn}${countdownHtml}<div class="com-footer">Publicado: ${fechaPublicacion ? fechaPublicacion.toLocaleDateString() : '---'}</div></div>`;
    });
    document.getElementById('comunicados-list').innerHTML = htmlComunicados;
}

function renderUsuarios() {
    if(!currentUserData) return;
    const email = auth.currentUser.email;
    const r = (email === ADMIN_EMAIL) ? "Administrador" : (currentUserData.rango || "Recreador");
    const esAdmin = (r === "Administrador"), esCGeneral = (r === "Coordinador General"), esCoordinador = (r === "Coordinador");
    
    if(r === "Recreador") return;

    let equipoCounts = Object.create(null), totalP = 0;
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
        const usuarioIdEvento = codificarDatoEvento(u.id);
        const nombreSeguro = escaparHTML(nombreCompleto);
        const documentoSeguro = escaparHTML(docTxt);
        const telefonoSeguro = escaparHTML(telTxt);
        const colorTextoSeguro = escaparHTML(String(col).toUpperCase());
        const colorVisualSeguro = obtenerColorSeguro(col);
        const rangoSeguro = escaparHTML(rangoTxt);
        
        const btnWa = /^\d{10}$/.test(String(u.tel || "")) ? `<a href="https://wa.me/57${u.tel}" target="_blank" rel="noopener noreferrer" style="color:#25D366; font-size:1.1rem; margin-left:5px; text-decoration:none;"><i class="fa-brands fa-whatsapp"></i></a>` : '';
        const fechaRegistroUsuario = convertirFechaFirestore(u.creado);
        const fechaReg = fechaRegistroUsuario ? fechaRegistroUsuario.toLocaleDateString('es-CO') : '---';

        let btnValidar = u.inscripcion === 'SI' 
            ? `<button class="btn-status btn-approve" onclick="cambiarInscripcion(decodeURIComponent('${usuarioIdEvento}'), 'NO')">✓ SI</button>` 
            : `<button class="btn-status btn-pending" onclick="cambiarInscripcion(decodeURIComponent('${usuarioIdEvento}'), 'SI')">⏳ NO</button>`;
            
        let btnAdminHTML = "", btnRolHTML = "";
        
        if(esAdmin) {
            btnRolHTML = `<td class="col-rango-admin"><select onchange="cambiarRol(decodeURIComponent('${usuarioIdEvento}'), this.value)" style="padding:4px; font-size:0.55rem; background:rgba(0,0,0,0.5); border:1px solid rgba(0,240,255,0.3); color:white; border-radius:4px;"><option value="Recreador" ${u.rango==='Recreador'?'selected':''}>Recreador</option><option value="Coordinador" ${u.rango==='Coordinador'?'selected':''}>Coordinador</option><option value="Coordinador General" ${u.rango==='Coordinador General'?'selected':''}>C. General</option><option value="Administrador" ${u.rango==='Administrador'?'selected':''}>Administrador</option></select></td>`;
            btnAdminHTML = `<td class="col-rango-admin"><button class="btn-status btn-delete" style="padding:6px 10px;" onclick="eliminarUsuario(decodeURIComponent('${usuarioIdEvento}'))"><i class="fa-solid fa-trash"></i></button></td>`;
        }
        
        let validacionCol = (esAdmin || esCGeneral || esCoordinador) ? `<td class="col-rango-permiso">${btnValidar}</td>` : '';
        
        htmlUsuarios += `
        <tr class="user-row" data-name="${escaparHTML(nombreCompleto.toLowerCase())}" data-doc="${documentoSeguro}" data-color="${escaparHTML(col)}">
            <td><span class="badge-rango" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);">${rangoSeguro}</span></td>
            <td style="font-weight:800; font-size:0.65rem; color:var(--accent); cursor:pointer; text-decoration:underline;" onclick="abrirCarnet(decodeURIComponent('${usuarioIdEvento}'))" title="Ver Carnet de Datos">${nombreSeguro}</td>
            <td>${edadTxt}</td>
            <td>${documentoSeguro}</td>
            <td style="white-space: nowrap; display:flex; align-items:center; justify-content:center; gap:5px; border-bottom:none;">${telefonoSeguro} ${btnWa}</td>
            <td style="white-space: nowrap;"><span class="team-dot" style="background:${colorVisualSeguro}; border: 1px solid rgba(255,255,255,0.3);"></span> ${colorTextoSeguro}</td>
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
        for(let eq in equipoCounts) htmlPersonalE += `<div class='summary-row'><span>${escaparHTML(eq)}</span><b>${equipoCounts[eq]}</b></div>`;
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
        const numeroSeguro = escaparHTML(num);
        const numeroEvento = codificarDatoEvento(num);
        htmlContent += `<div class="team-mini-badge" style="background:${bg}; border:1px solid ${border};">${numeroSeguro} ${icon} <span onclick="eliminarBoletaEntregada(decodeURIComponent('${numeroEvento}'))"><i class="fa-solid fa-trash"></i></span></div>`;
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
                <p style="margin:0; font-size:0.5rem; font-weight:800; color:${colorEstado};">ESTADO: VENDIDA (${escaparHTML(boletaEncontrada.estado)})</p>
                <p style="margin:2px 0; font-size:0.8rem; font-weight:900; color:white;">RECREADOR: ${escaparHTML((u.nombre + " " + (u.apellido || "")).toUpperCase())}</p>
                <p style="margin:0; font-size:0.6rem; font-weight:700; color:#cbd5e1;">EQUIPO: ${escaparHTML((u.color || "---").toUpperCase())}</p>
                <p style="margin:5px 0 0 0; font-size:0.55rem; color:var(--accent);">Comprador: <b>${escaparHTML(boletaEncontrada.c || boletaEncontrada.comprador || '---')}</b></p>
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
                <p style="margin:2px 0; font-size:0.8rem; font-weight:900; color:white;">RECREADOR: ${escaparHTML((recreadorEncontrado.nombre + " " + (recreadorEncontrado.apellido || "")).toUpperCase())}</p>
                <p style="margin:0; font-size:0.6rem; font-weight:700; color:#cbd5e1;">EQUIPO: ${escaparHTML((recreadorEncontrado.color || "---").toUpperCase())}</p>
            </div>`;
    } else {
        resultDiv.innerHTML = `<p style="font-size:0.6rem; color:#ef4444; font-weight:800; background:rgba(239, 68, 68, 0.2); border:1px solid #ef4444; padding:10px; border-radius:10px;"><i class="fa-solid fa-xmark"></i> BOLETA NO REGISTRADA EN EL SISTEMA</p>`;
    }
}

async function eliminarTodosRegistrosRecreador(nombreRecreador) {
    if (!confirm(`¿Estás seguro de eliminar TODOS los registros de boletas para: ${nombreRecreador}?`)) return;
    
    const boletasABorrar = allBoletas.filter(b => b.recreador === nombreRecreador);
    if(boletasABorrar.length === 0) return notify("No hay registros para este recreador");

    const liberarBoton = bloquearBotonActual("ELIMINANDO...");
    try {
        let batch = db.batch();
        boletasABorrar.forEach(b => {
            batch.delete(db.collection("boletas").doc(b.id));
        });
        await batch.commit();
        notify(`🗑️ Registros de ${nombreRecreador} eliminados`);
    } catch(error) {
        manejarError(error, "No se pudieron eliminar las boletas del recreador");
    } finally {
        liberarBoton();
    }
}

function abrirGestionBoletas(nombreRecreador) {
    const email = auth.currentUser.email;
    const r = (email === ADMIN_EMAIL) ? "Administrador" : (currentUserData.rango || "Recreador");
    const esAdmin = (r === "Administrador" || r === "Coordinador General");
    const render = document.getElementById('gestion-boletas-render');
    const nombreTituloSeguro = escaparHTML(String(nombreRecreador).toUpperCase());
    document.getElementById('modal-gestion-boletas').style.display = 'flex';

    // REGLA PRIORI: Filtro lógico ajustado para coincidir el nombre del perfil con el vendedor (correo)
    const boletasRecreador = allBoletas.filter(b => {
        const perfilVendedor = allUsers.find(u => u.id === b.vendedor);
        let nombreMapeado = b.recreador || 'Sin Nombre';
        if (perfilVendedor) {
            nombreMapeado = (perfilVendedor.nombre + " " + (perfilVendedor.apellido || "")).trim() || 'Sin Nombre';
        }
        return nombreMapeado === nombreRecreador || b.recreador === nombreRecreador;
    });
    
    if(boletasRecreador.length === 0) {
        render.innerHTML = `<h3 style="color:var(--accent); text-align:center; margin-bottom:15px;">BOLETAS: ${nombreTituloSeguro}</h3><p style="text-align:center; font-size:0.7rem;">No hay boletas registradas.</p>`;
        return;
    }

    render.innerHTML = `<h3 style="color:var(--accent); text-align:center; margin-bottom:15px;">BOLETAS: ${nombreTituloSeguro}</h3>`;
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
        const boletaIdEvento = codificarDatoEvento(b.id);
        let botones = "<td>--</td>";
        if (esAdmin) {
            const nuevoEstado = b.estado === 'Activa' ? 'Pendiente' : 'Activa';
            const icon = b.estado === 'Activa' ? '<i class="fa-solid fa-hourglass-half"></i>' : '<i class="fa-solid fa-check-double"></i>';
            botones = `
                <td style="display:flex; gap:5px; justify-content:center;">
                    <button class="btn-status" style="background:rgba(255,255,255,0.1); color:var(--text-main); border:1px solid rgba(255,255,255,0.2);" onclick="cambiarEstado(decodeURIComponent('${boletaIdEvento}'), '${nuevoEstado}'); cerrarModalGestion();">
                        ${icon}
                    </button>
                    <button class="btn-status btn-delete" onclick="eliminarBoleta(decodeURIComponent('${boletaIdEvento}')); cerrarModalGestion();">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>`;
        }
        
        const numBoleta = b.n || '--';
        const nomComprador = b.c || b.comprador || '--';
        const telComprador = b.t || b.whatsapp || '--';
        
        const btnWa = /^\d{10}$/.test(String(telComprador)) ? `<a href="https://wa.me/57${telComprador}" target="_blank" rel="noopener noreferrer" style="color:#25D366; font-size:1.1rem; margin-left:5px; text-decoration:none;"><i class="fa-brands fa-whatsapp"></i></a>` : '';

        htmlTable += `
            <tr>
                <td style="font-weight:800; color:white;">${escaparHTML(numBoleta)}</td>
                <td style="font-size:0.6rem; font-weight:800; color:#cbd5e1;">${escaparHTML(nomComprador)}</td>
                <td style="font-size:0.6rem; white-space: nowrap; display:flex; align-items:center; justify-content:center; gap:5px; border-bottom:none;">${escaparHTML(telComprador)} ${btnWa}</td>
                <td style="font-weight:800; color:${colorEstado}">${escaparHTML(b.estado)}</td>
                ${botones}
            </tr>`;
    });
    
    htmlTable += `</tbody></table></div>`;
    render.innerHTML += htmlTable;
}

function cerrarModalGestion() {
    document.getElementById('modal-gestion-boletas').style.display = 'none';
}

async function registrarBoletaEntregada() {
    const input = document.getElementById('input-boleta-entregada');
    const valor = input.value.trim();
    if(!valor) return;
    if(!/^\d{3}$/.test(valor)) return notify("⚠️ La boleta debe tener exactamente 3 dígitos");
    const entregadas = [...(currentUserData.boletasEntregadas || [])];
    if(entregadas.includes(valor)) return notify("⚠️ Esta boleta ya está registrada");
    entregadas.push(valor);
    const liberarBoton = bloquearBotonActual("GUARDANDO...");

    try {
        await db.collection("usuarios").doc(auth.currentUser.email).update({ boletasEntregadas: entregadas });
        input.value = "";
        notify("✅ Boleta registrada");
    } catch(error) {
        manejarError(error, "No se pudo registrar la boleta entregada");
    } finally {
        liberarBoton();
    }
}

async function eliminarBoletaEntregada(num) {
    if(auth.currentUser.email !== ADMIN_EMAIL) return notify("⚠️ Solo el administrador puede borrar boletas físicas");
    const entregadas = currentUserData.boletasEntregadas.filter(n => n !== num);
    const liberarBoton = bloquearBotonActual("ELIMINANDO...");

    try {
        await db.collection("usuarios").doc(auth.currentUser.email).update({ boletasEntregadas: entregadas });
        notify("🗑️ Eliminada de entregadas");
    } catch(error) {
        manejarError(error, "No se pudo eliminar la boleta entregada");
    } finally {
        liberarBoton();
    }
}

async function eliminarComunicado(id) {
    const liberarBoton = bloquearBotonActual("...");

    try {
        await db.collection("comunicados").doc(id).delete();
        notify("🗑️ Comunicado eliminado");
    } catch(error) {
        manejarError(error, "No se pudo eliminar el comunicado");
    } finally {
        liberarBoton();
    }
}

async function publicarComunicado() {
    const t = document.getElementById('com-titulo').value.trim();
    const m = document.getElementById('com-mensaje').value.trim();
    const fE = document.getElementById('com-fecha-ev').value;
    const hE = document.getElementById('com-hora-ev').value;
    const lE = document.getElementById('com-lugar-ev').value.trim();
    const linkOriginal = document.getElementById('com-link-doc').value.trim();
    const linkD = obtenerUrlHttpSegura(linkOriginal);
    const destCheckboxes = document.querySelectorAll('input[name="dest-color"]:checked');
    let destinatarios = Array.from(destCheckboxes).map(cb => cb.value);
    if(destinatarios.length === 0) return notify("⚠️ Selecciona al menos un destinatario");
    if(destinatarios.includes("Todos")) destinatarios = ["Todos"];
    if(!t || !m) return notify("⚠️ Título y mensaje obligatorios");
    if(linkOriginal && !linkD) return notify("⚠️ El enlace debe comenzar con http:// o https://");
    const liberarBoton = bloquearBotonActual("PUBLICANDO...");

    try {
        await db.collection("comunicados").add({ titulo: t, mensaje: m, destinatarios: destinatarios, fechaEv: fE, horaEv: hE, lugarEv: lE, linkDoc: linkD, fecha: fechaServidor() });
        document.getElementById('com-titulo').value = "";
        document.getElementById('com-mensaje').value = "";
        document.getElementById('com-fecha-ev').value = "";
        document.getElementById('com-hora-ev').value = "";
        document.getElementById('com-lugar-ev').value = "";
        document.getElementById('com-link-doc').value = "";
        document.querySelectorAll('input[name="dest-color"]').forEach(cb => cb.checked = (cb.value === "Todos"));
        notify("🚀 Publicado");
    } catch(error) {
        manejarError(error, "No se pudo publicar el comunicado");
    } finally {
        liberarBoton();
    }
}

async function inscribirBoleta() {
    const r = document.getElementById('ins-rec-nom').value.trim();
    const n = document.getElementById('ins-n-boleta').value.trim();
    const c = document.getElementById('ins-com-nom').value.trim();
    const t = document.getElementById('ins-com-tel').value.trim();

    if(!/^\d{3}$/.test(n)) return notify("⚠️ El número de boleta debe tener exactamente 3 dígitos");
    if(!c) return notify("⚠️ El nombre del comprador es obligatorio");
    if(!/^\d{10}$/.test(t)) return notify("⚠️ El WhatsApp del comprador debe tener exactamente 10 dígitos");

    const liberarBoton = bloquearBotonActual("REGISTRANDO...");

    try {
        await db.collection("boletas").add({ recreador: r, n: n, c: c, t: t, vendedor: auth.currentUser.email, estado: 'Pendiente', creado: fechaServidor() });
        document.getElementById('ins-rec-nom').value = ""; document.getElementById('ins-n-boleta').value = ""; document.getElementById('ins-com-nom').value = ""; document.getElementById('ins-com-tel').value = "";
        notify("✅ Registrada");
    } catch(error) {
        manejarError(error, "No se pudo registrar la venta");
    } finally {
        liberarBoton();
    }
}

async function cambiarEstado(id, est) {
    const liberarBoton = bloquearBotonActual("GUARDANDO...");
    try {
        await db.collection("boletas").doc(id).update({ estado: est });
    } catch(error) {
        manejarError(error, "No se pudo cambiar el estado de la boleta");
    } finally {
        liberarBoton();
    }
}

async function eliminarBoleta(id) {
    if(!confirm("¿Eliminar registro?")) return;
    const liberarBoton = bloquearBotonActual("ELIMINANDO...");
    try {
        await db.collection("boletas").doc(id).delete();
        notify("🗑️ Eliminado");
    } catch(error) {
        manejarError(error, "No se pudo eliminar la boleta");
    } finally {
        liberarBoton();
    }
}

async function guardarPerfil() {
    const doc = document.getElementById('edit-doc').value.trim();
    const tel = document.getElementById('edit-tel').value.trim();
    const nac = document.getElementById('edit-nacimiento').value;
    const col = document.getElementById('edit-color').value;

    if(!doc || !tel || !nac) return notify("⚠️ Completa los datos");
    if(!/^\d{10}$/.test(doc)) return notify("⚠️ El documento debe tener exactamente 10 dígitos");
    if(!/^\d{10}$/.test(tel)) return notify("⚠️ El WhatsApp debe tener exactamente 10 dígitos");

    const liberarBoton = bloquearBotonActual("GUARDANDO...");
    try {
        await db.collection("usuarios").doc(auth.currentUser.email).update({ doc: doc, tel: tel, nacimiento: nac, color: col });
        notify("✅ Guardado");
    } catch(error) {
        manejarError(error, "No se pudo guardar el perfil");
    } finally {
        liberarBoton();
    }
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
                ${u.boletasEntregadas.map(b => `<span style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.2); color:white; font-size:0.55rem; padding:4px 8px; border-radius:6px; font-weight:800;">${escaparHTML(b)}</span>`).join('')}
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
        <div class="avatar-circle" style="width:70px; height:70px; font-size:2rem;">${escaparHTML(foto)}</div>
        <h3 style="font-size:1.2rem;">${escaparHTML((u.nombre+" "+(u.apellido||"")).toUpperCase())}</h3>
        <p class="badge-rango-perfil" style="margin-bottom:15px;">${escaparHTML(u.rango||'RECREADOR')}</p>
        <div class="id-card-details">
            <div class="id-detail-item"><span class="detail-label">EQUIPO</span><span class="detail-value">${escaparHTML((u.color||'---').toUpperCase())}</span></div>
            <div class="id-detail-item"><span class="detail-label">DOCUMENTO</span><span class="detail-value">${escaparHTML(u.doc||'---')}</span></div>
            <div class="id-detail-item"><span class="detail-label">WHATSAPP</span><span class="detail-value">${escaparHTML(u.tel||'---')}</span></div>
            <div class="id-detail-item"><span class="detail-label">EDAD</span><span class="detail-value">${calcularEdad(u.nacimiento).toUpperCase()}</span></div>
            <div class="id-detail-item" style="grid-column: span 2;"><span class="detail-label">INSCRITO</span><span class="detail-value" style="color:${u.inscripcion==='SI'?'#10b981':'#ef4444'};">${escaparHTML(u.inscripcion||'NO')}</span></div>
        </div>
        ${boletasHtml}
        <div class="card-brand-footer" style="margin-top:25px; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">LOGISTICA & EVENTOS</div>
    </div>`;
    
    document.getElementById('modal-carnet').style.display = 'flex';
}

function cerrarModal() { document.getElementById('modal-carnet').style.display = 'none'; }
async function cambiarInscripcion(id, est) {
    const liberarBoton = bloquearBotonActual("GUARDANDO...");
    try {
        await db.collection("usuarios").doc(id).update({ inscripcion: est });
    } catch(error) {
        manejarError(error, "No se pudo cambiar la inscripción");
    } finally {
        liberarBoton();
    }
}

async function cambiarRol(id, rol) {
    const liberarBoton = bloquearBotonActual("GUARDANDO...");
    try {
        await db.collection("usuarios").doc(id).update({ rango: rol });
        notify("✅ Rango actualizado");
    } catch(error) {
        manejarError(error, "No se pudo actualizar el rango");
    } finally {
        liberarBoton();
    }
}

async function eliminarUsuario(id) {
    if(!confirm("¿Eliminar usuario permanentemente?")) return;
    const liberarBoton = bloquearBotonActual("ELIMINANDO...");
    try {
        await db.collection("usuarios").doc(id).delete();
        notify("🗑️ Usuario eliminado");
    } catch(error) {
        manejarError(error, "No se pudo eliminar el usuario");
    } finally {
        liberarBoton();
    }
}

async function eliminarPersonalPorCodigo() {
    const code = document.getElementById('del-staff-code-select').value;
    if(!code) return notify("⚠️ Selecciona un código de invitación primero");
    if(!confirm(`⚠️ PELIGRO: ¿Estás seguro de eliminar a TODO el personal que se registró usando el código "${code}"?`)) return;

    const usuariosABorrar = allUsers.filter(u => u.codigoInvitacion === code);
    if(usuariosABorrar.length === 0) return notify(`ℹ️ No hay usuarios registrados con el código ${code}`);

    const liberarBoton = bloquearBotonActual("ELIMINANDO...");
    try {
        let batch = db.batch();
        usuariosABorrar.forEach(u => {
            batch.delete(db.collection("usuarios").doc(u.id));
        });
        await batch.commit();
        document.getElementById('del-staff-code-select').value = "";
        notify(`🗑️ ${usuariosABorrar.length} usuarios eliminados`);
    } catch(error) {
        manejarError(error, "No se pudo eliminar el personal");
    } finally {
        liberarBoton();
    }
}

async function eliminarBoletasPorRango() {
    const fInicio = document.getElementById('del-bol-inicio').value;
    const fFin = document.getElementById('del-bol-fin').value;
    
    if(!fInicio || !fFin) return notify("⚠️ Ingresa el rango de fechas");
    if(!confirm(`⚠️ ¿Eliminar todas las boletas registradas entre ${fInicio} y ${fFin}?`)) return;

    const tInicio = new Date(fInicio + "T00:00:00").getTime();
    const tFin = new Date(fFin + "T23:59:59").getTime();

    const boletasABorrar = allBoletas.filter(b => {
        const fechaBoleta = obtenerMilisegundosFecha(b.creado);
        return fechaBoleta >= tInicio && fechaBoleta <= tFin;
    });
    
    if(boletasABorrar.length === 0) return notify("ℹ️ No se encontraron boletas en ese rango");

    const liberarBoton = bloquearBotonActual("ELIMINANDO...");
    try {
        let batch = db.batch();
        boletasABorrar.forEach(b => {
            batch.delete(db.collection("boletas").doc(b.id));
        });
        await batch.commit();
        document.getElementById('del-bol-inicio').value = "";
        document.getElementById('del-bol-fin').value = "";
        notify(`🗑️ ${boletasABorrar.length} boletas eliminadas`);
    } catch(error) {
        manejarError(error, "No se pudieron eliminar las boletas del rango");
    } finally {
        liberarBoton();
    }
}

async function handleLogin() {
    const e = document.getElementById('login-email').value.trim();
    const p = document.getElementById('login-pass').value;
    if(!e || !p) return notify("⚠️ Ingresa tu correo y contraseña");

    const liberarBoton = bloquearBotonActual("INGRESANDO...");
    try {
        await auth.signInWithEmailAndPassword(e, p);
    } catch(error) {
        manejarError(error, "No se pudo iniciar sesión");
    } finally {
        liberarBoton();
    }
}

async function handleLogout() {
    const liberarBoton = bloquearBotonActual("SALIENDO...");
    try {
        await auth.signOut();
        location.reload();
    } catch(error) {
        manejarError(error, "No se pudo cerrar la sesión");
        liberarBoton();
    }
}
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
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = String(msg ?? "");
    c.appendChild(d); setTimeout(() => d.remove(), 3000);
}

function exportarPersonalExcel() {
    if (!allUsers || allUsers.length === 0) {
        if(typeof notify === "function") notify("⚠️ No hay personal registrado.");
        else alert("⚠️ No hay personal registrado.");
        return;
    }

    const data = allUsers.map(u => ({
        "NOMBRES": u.nombre || "---",
        "APELLIDOS": u.apellido || "---",
        "DOCUMENTO": u.doc || "---",
        "EDAD": u.nacimiento ? calcularEdad(u.nacimiento).replace(" Años", "") : "---",
        "WHATSAPP": u.tel || "---",
        "EQUIPO": u.color || "Gris",
        "BOLETAS ENTREGADAS": Array.isArray(u.boletasEntregadas) ? u.boletasEntregadas.length : 0,
        "FECHA DE REGISTRO": convertirFechaFirestore(u.creado)?.toLocaleDateString('es-CO') || "---"
    }));

    data.sort((a, b) => {
        const comparacionNombres = a.NOMBRES.localeCompare(b.NOMBRES, 'es', { sensitivity: 'base' });
        if (comparacionNombres !== 0) return comparacionNombres;
        return a.APELLIDOS.localeCompare(b.APELLIDOS, 'es', { sensitivity: 'base' });
    });

    try {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Personal");
        XLSX.writeFile(workbook, "Reporte_Personal_Organizado.xlsx");
        
        if(typeof notify === "function") notify("✅ Reporte organizado descargado");
    } catch (err) {
        if(typeof notify === "function") notify("❌ Error al exportar: " + err.message);
        else alert("❌ Error al exportar: " + err.message);
    }
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
        rows.push([exportContador, b.n, col.toUpperCase(), b.recreador.toUpperCase(), b.c || b.comprador || '---', b.t || b.whatsapp || '---', b.estado, convertirFechaFirestore(b.creado)?.toLocaleDateString() || '---']);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Ventas"); XLSX.writeFile(wb, "Reporte_Ventas.xlsx");
}

// ==========================================
// NUEVO CÓDIGO - SISTEMA DE ANUNCIO FLOTANTE (ACTUALIZADO PRIORI)
// ==========================================

let anuncioFlotanteData = null;
let anuncioTimer = null;

// Escuchador en tiempo real para usuarios autenticados
function listenAnuncioFlotante() {
    if(unsubscribeAnuncioFlotante || !auth.currentUser) return;

    unsubscribeAnuncioFlotante = db.collection("configuracion").doc("anuncio_flotante").onSnapshot(doc => {
        if (doc.exists) {
            anuncioFlotanteData = doc.data();
            evaluarAnuncioCiclo(); // Evaluamos de inmediato al recibir los datos
        } else {
            anuncioFlotanteData = null;
            if(anuncioTimer) clearTimeout(anuncioTimer);
        }
    }, error => {
        manejarError(error, "No se pudo cargar el anuncio flotante");
    });
}

// Lógica inteligente para evaluar si corresponde mostrar el anuncio
function evaluarAnuncioCiclo() {
    if (anuncioTimer) clearTimeout(anuncioTimer);
    if (!anuncioFlotanteData) return;

    const data = anuncioFlotanteData;
    
    // 1. Verificamos si ya pasó la fecha y hora límite general
    if (data.fechaLimite && Date.now() > data.fechaLimite) return;

    // 2. Usamos LocalStorage para saber cuántas veces ha visto ESTE anuncio el usuario actual
    const identificadorAnuncio = obtenerMilisegundosFecha(data.timestamp) || 'actual';
    let stats = JSON.parse(localStorage.getItem('anuncio_stats_' + identificadorAnuncio)) || { count: 0, lastShow: 0 };

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
        localStorage.setItem('anuncio_stats_' + identificadorAnuncio, JSON.stringify(stats));

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
async function publicarAnuncioFlotante() {
    if(!esAdministradorActual()) {
        if(typeof notify === "function") return notify("⛔ Solo el administrador puede publicar anuncios flotantes");
        return alert("⛔ Solo el administrador puede publicar anuncios flotantes");
    }

    const texto = document.getElementById('admin-anuncio-texto').value.trim();
    const color = obtenerColorSeguro(document.getElementById('admin-anuncio-color').value, "");
    
    let duracion = parseInt(document.getElementById('admin-anuncio-duracion').value);
    let intervalo = parseInt(document.getElementById('admin-anuncio-intervalo').value);
    let cantidad = parseInt(document.getElementById('admin-anuncio-cantidad').value);
    let fechaInput = document.getElementById('admin-anuncio-fecha').value;
    
    if (!texto) {
        if(typeof notify === "function") return notify("⚠️ Escribe un texto corto para el anuncio");
        else return alert("⚠️ Escribe un texto corto para el anuncio");
    }
    if (!color) {
        if(typeof notify === "function") return notify("⚠️ Selecciona un color válido");
        else return alert("⚠️ Selecciona un color válido");
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

    const liberarBoton = bloquearBotonActual("PUBLICANDO...");
    try {
        await db.collection("configuracion").doc("anuncio_flotante").set({
            texto: texto,
            color: color,
            duracion: duracion,
            intervaloMin: intervalo,
            cantidad: cantidad,
            fechaLimite: fechaLimite,
            timestamp: fechaServidor(),
            lanzadoPor: auth.currentUser.email
        });
        if(typeof notify === "function") notify("🚀 Anuncio programado con éxito");
        document.getElementById('admin-anuncio-texto').value = ""; 
    } catch(error) {
        manejarError(error, "No se pudo publicar el anuncio");
    } finally {
        liberarBoton();
    }
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
    const colorSeguro = obtenerColorSeguro(color);
    el.style.backgroundColor = colorSeguro;
    el.style.color = (colorSeguro === '#00f0ff' || colorSeguro === '#10b981') ? '#000000' : '#ffffff';
    
    el.innerHTML = '<i class="fa-solid fa-bolt"></i> &nbsp; ';
    el.appendChild(document.createTextNode(String(texto ?? "")));
    el.style.setProperty('--anim-duration', `${duracionSecs}s`);
    
    setTimeout(() => {
        el.style.display = 'none';
    }, (duracionSecs * 1000) + 500);
}
// ==========================================
// NUEVO CÓDIGO - SISTEMA DE VERIFICACIÓN DE PAGOS E HISTORIAL (SOLO OPCIÓN 2 - PRIORI)
// ==========================================

// 1. Modificada: Abrir el modal de pago directamente sin lógica del enlace viejo
function gestionarEnlacePago() {
    const modal = document.getElementById('modal-pago');
    renderBoletasParaPagar();
    modal.style.display = 'flex';
}

function renderBoletasParaPagar() {
    const email = auth.currentUser.email;
    const container = document.getElementById('lista-boletas-pendientes-pago');
    container.innerHTML = '';
    
    let misPendientes = allBoletas.filter(b => b.vendedor === email && b.estado === 'Pendiente');
    
    if(misPendientes.length === 0) {
        container.innerHTML = '<p style="font-size:0.65rem; color:#94a3b8; text-align:center;">No tienes boletas pendientes de pago.</p>';
        return;
    }
    
    let html = '<div style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center; max-height:120px; overflow-y:auto; padding:5px; background:rgba(0,0,0,0.3); border-radius:8px; border:1px solid rgba(0,240,255,0.2);">';
    misPendientes.forEach(b => {
        html += `<label style="font-size:0.6rem; background:rgba(255,255,255,0.05); padding:6px 10px; border-radius:6px; cursor:pointer; display:flex; align-items:center; gap:5px; border:1px solid rgba(255,255,255,0.1);"><input type="checkbox" class="chk-boleta-pago" value="${escaparHTML(b.id)}" data-n="${escaparHTML(b.n)}"> N° ${escaparHTML(b.n)}</label>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

// 2. Lógica para capturar y subir todos los datos
function enviarComprobantePago() {
    const checkboxes = document.querySelectorAll('.chk-boleta-pago:checked');
    if(checkboxes.length === 0) {
        if(typeof notify === "function") return notify("⚠️ Selecciona al menos una boleta para pagar");
        else return alert("⚠️ Selecciona al menos una boleta para pagar");
    }
    
    const monto = document.getElementById('pago-monto').value;
    const metodo = document.getElementById('pago-metodo').value;
    const receptor = document.getElementById('pago-receptor').value.trim();
    const capacitacion = document.getElementById('pago-capacitacion').value;
    
    if(!monto || !metodo || !receptor || !capacitacion) {
        if(typeof notify === "function") return notify("⚠️ Completa todos los datos de la entrega");
        else return alert("⚠️ Completa todos los datos de la entrega");
    }

    const fileInput = document.getElementById('input-comprobante-pago');
    const file = fileInput.files[0];
    if(!file) {
        if(typeof notify === "function") return notify("⚠️ Sube la foto del comprobante");
        else return alert("⚠️ Sube la foto del comprobante");
    }
    if(!file.type || !file.type.startsWith("image/")) {
        if(typeof notify === "function") return notify("⚠️ El comprobante debe ser una imagen válida");
        else return alert("⚠️ El comprobante debe ser una imagen válida");
    }
    
    const btn = document.getElementById('btn-enviar-pago');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PROCESANDO...';
    btn.disabled = true;
    
    let boletasSeleccionadas = [];
    checkboxes.forEach(chk => boletasSeleccionadas.push({ id: chk.value, n: chk.getAttribute('data-n') }));
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(event) {
        const img = new Image();
        img.src = event.target.result;
        img.onload = async function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 600; 
            let width = img.width;
            let height = img.height;
            
            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const base64Url = canvas.toDataURL('image/jpeg', 0.5); 
            
            try {
                await db.collection("solicitudes_pago").add({
                    recreadorEmail: auth.currentUser.email,
                    recreadorNombre: currentUserData.nombre + " " + (currentUserData.apellido || ""),
                    equipo: currentUserData.color || "Gris",
                    boletas: boletasSeleccionadas,
                    monto: monto,
                    metodo: metodo,
                    receptor: receptor,
                    capacitacion: capacitacion,
                    comprobanteUrl: base64Url,
                    estado: 'Pendiente',
                    creado: fechaServidor()
                });
                
                if(typeof notify === "function") notify("✅ Solicitud enviada a administración");
                else alert("✅ Solicitud enviada a administración");
                
                document.getElementById('modal-pago').style.display = 'none';
                fileInput.value = "";
                document.getElementById('pago-monto').value = "";
                document.getElementById('pago-metodo').value = "";
                document.getElementById('pago-receptor').value = "";
                document.getElementById('pago-capacitacion').value = "";

            } catch (err) {
                manejarError(err, "No se pudo enviar la solicitud de pago");
            } finally {
                btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> ENVIAR SOLICITUD';
                btn.disabled = false;
            }
        };
        img.onerror = function() {
            notify("❌ No se pudo procesar la imagen. Intenta con otra foto.");
            btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> ENVIAR SOLICITUD';
            btn.disabled = false;
        };
    };
    reader.onerror = function() {
        notify("❌ No se pudo leer el archivo de tu dispositivo.");
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> ENVIAR SOLICITUD';
        btn.disabled = false;
    };
}

// 3. Escuchador para Coordinador General y Administrador con los pagos PENDIENTES
function listenPagosPendientes() {
    if(unsubscribePagosPendientes || !puedeGestionarPagosActual()) return;

    const container = document.getElementById('admin-pagos-list');
    if(!container) return;

    mostrarEstadoLista("admin-pagos-list", "Cargando pagos pendientes...");
    unsubscribePagosPendientes = db.collection("solicitudes_pago")
        .where("estado", "==", "Pendiente")
        .onSnapshot(snap => {
            container.innerHTML = '';
            comprobantesTemp = {};

            if(snap.empty) {
                container.innerHTML = '<p style="text-align:center; font-size:0.65rem; color:#94a3b8;">No hay pagos pendientes por verificar en este momento.</p>';
                return;
            }

            snap.forEach(doc => {
                const d = doc.data();
                const bolStr = Array.isArray(d.boletas) ? d.boletas.map(b => b?.n ?? '').join(', ') : '---';
                comprobantesTemp[doc.id] = esComprobanteSeguro(d.comprobanteUrl) ? d.comprobanteUrl : '';
                const pagoIdEvento = codificarDatoEvento(doc.id);

                container.innerHTML += `
                    <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(16,185,129,0.3); padding:15px; border-radius:12px;">
                        <p style="margin:0 0 5px 0; font-size:0.65rem; color:#10b981; font-weight:800;">${escaparHTML(String(d.recreadorNombre || '---').toUpperCase())} <span style="color:#94a3b8; font-weight:400;">(${escaparHTML(d.equipo || '---')})</span></p>
                        <p style="margin:0 0 10px 0; font-size:0.65rem;">Boletas solicitadas: <b style="color:white;">${escaparHTML(bolStr)}</b></p>

                        <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 10px; font-size: 0.6rem; color: #cbd5e1;">
                            <div style="margin-bottom: 3px;"><span style="color:var(--accent); font-weight:800;">Entrega:</span> $${escaparHTML(d.monto)} (${escaparHTML(d.metodo)})</div>
                            <div style="margin-bottom: 3px;"><span style="color:var(--accent); font-weight:800;">Entregado a:</span> ${escaparHTML(d.receptor)}</div>
                            <div><span style="color:var(--accent); font-weight:800;">¿Asiste capacitación?:</span> ${escaparHTML(d.capacitacion)}</div>
                        </div>

                        <div style="display:flex; gap:5px; flex-wrap:wrap;">
                            <button class="btn-mini" style="flex:1; min-width:80px; background:rgba(0,240,255,0.1); border-color:var(--accent); color:var(--accent);" onclick="verFotoComprobante(decodeURIComponent('${pagoIdEvento}'))"><i class="fa-solid fa-image"></i> VER FOTO</button>
                            <button class="btn-mini" style="flex:1; min-width:80px; background:rgba(16,185,129,0.2); color:#10b981; border-color:#10b981;" onclick="verificarPago(decodeURIComponent('${pagoIdEvento}'), true)"><i class="fa-solid fa-check"></i> VERIFICADO</button>
                            <button class="btn-mini" style="flex:1; min-width:80px; background:rgba(239,68,68,0.2); color:#ef4444; border-color:#ef4444;" onclick="verificarPago(decodeURIComponent('${pagoIdEvento}'), false)"><i class="fa-solid fa-xmark"></i> NO</button>
                        </div>
                    </div>
                `;
            });
        }, error => {
            mostrarEstadoLista("admin-pagos-list", "No fue posible cargar los pagos.", "error");
            manejarError(error, "No se pudieron cargar los pagos pendientes");
        });
}

function verFotoComprobante(id) {
    if(!puedeGestionarPagosActual()) return notify("⛔ No tienes permiso para ver comprobantes");

    const base64 = comprobantesTemp[id];
    if(!esComprobanteSeguro(base64)) return notify("⚠️ El comprobante no contiene una imagen válida");
    const w = window.open("");
    if(!w) return notify("⚠️ El navegador bloqueó la ventana del comprobante");

    w.document.body.style.cssText = "margin:0; background:#000; display:flex; justify-content:center; align-items:center; height:100vh;";
    const imagen = w.document.createElement("img");
    imagen.src = base64;
    imagen.alt = "Comprobante de pago";
    imagen.style.cssText = "max-width:100%; max-height:100%; border-radius:8px;";
    w.document.body.replaceChildren(imagen);
}

async function verificarPago(solicitudId, aprobado) {
    if(!puedeGestionarPagosActual()) return notify("⛔ No tienes permiso para aprobar pagos");

    if(!confirm(aprobado ? '¿Aprobar comprobante y ACTIVAR estas boletas seleccionadas?' : '¿Rechazar este pago? Las boletas seguirán en estado Pendiente.')) return;
    const liberarBoton = bloquearBotonActual("PROCESANDO...");

    try {
        if(aprobado) {
            const solicitudRef = db.collection("solicitudes_pago").doc(solicitudId);
            const solDoc = await solicitudRef.get();

            if(!solDoc.exists) {
                throw new Error("La solicitud de pago ya no existe");
            }

            const d = solDoc.data();

            if(d.estado !== 'Pendiente') {
                throw new Error("Esta solicitud ya fue procesada");
            }

            if(!Array.isArray(d.boletas) || d.boletas.length === 0) {
                throw new Error("La solicitud no contiene boletas válidas");
            }
            
            const batch = db.batch();
            d.boletas.forEach(b => {
                if(!b.id) throw new Error("Una de las boletas no tiene identificador");
                const bRef = db.collection("boletas").doc(b.id);
                batch.update(bRef, { estado: 'Activa' });
            });

            batch.update(solicitudRef, {
                estado: 'Aprobado',
                verificadoPor: auth.currentUser.email,
                fechaVerificacion: fechaServidor()
            });

            await batch.commit();
            if(typeof notify === "function") notify("✅ Pago aprobado y boletas activadas exitosamente");
        } else {
            await db.collection("solicitudes_pago").doc(solicitudId).update({ estado: 'Rechazado', verificadoPor: auth.currentUser.email, fechaVerificacion: fechaServidor() });
            if(typeof notify === "function") notify("❌ Pago rechazado");
        }
    } catch (error) {
        manejarError(error, "No se pudo procesar el pago");
    } finally {
        liberarBoton();
    }
}

// 4. LÓGICA DE HISTORIAL DE PAGOS (CON BOTONES DE BORRADO)
function toggleHistorialPagos() {
    if(!puedeGestionarPagosActual()) return notify("⛔ No tienes permiso para ver pagos");

    const histDiv = document.getElementById('admin-pagos-historial-wrapper');
    if(histDiv.style.display === 'none') {
        histDiv.style.display = 'flex';
        cargarHistorialPagos();
    } else {
        detenerEscuchadorHistorialPagos();
    }
}

function cargarHistorialPagos() {
    if(!puedeGestionarPagosActual()) return notify("⛔ No tienes permiso para ver pagos");
    if(listenerHistorialPagos) return;

    const container = document.getElementById('admin-pagos-historial');
    container.innerHTML = '<p style="text-align:center; font-size:0.65rem; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando historial...</p>';
    
    listenerHistorialPagos = db.collection("solicitudes_pago")
        .where("estado", "==", "Aprobado")
        .onSnapshot(snap => {
            container.innerHTML = '';
            if(snap.empty) {
                container.innerHTML = '<p style="text-align:center; font-size:0.65rem; color:#94a3b8;">No hay pagos verificados en el historial.</p>';
                return;
            }
            
            let historial = [];
            snap.forEach(doc => {
                historial.push({ id: doc.id, ...doc.data() });
            });
            
            historial.sort((a, b) => obtenerMilisegundosFecha(b.fechaVerificacion) - obtenerMilisegundosFecha(a.fechaVerificacion));

            const esAdmin = esAdministradorActual();
            
            historial.forEach(d => {
                const bolStr = Array.isArray(d.boletas) ? d.boletas.map(b => b?.n ?? '').join(', ') : '---';
                comprobantesTemp[d.id] = esComprobanteSeguro(d.comprobanteUrl) ? d.comprobanteUrl : '';
                const fechaHistorial = convertirFechaFirestore(d.fechaVerificacion || d.creado);
                const fechaStr = fechaHistorial ? fechaHistorial.toLocaleString() : '---';
                const pagoIdEvento = codificarDatoEvento(d.id);
                const botonEliminar = esAdmin
                    ? `<button class="btn-mini" style="flex:1; justify-content:center; background:rgba(239,68,68,0.1); border-color:#ef4444; color:#ef4444;" onclick="borrarPagoHistorial(decodeURIComponent('${pagoIdEvento}'))"><i class="fa-solid fa-trash"></i></button>`
                    : '';

                container.innerHTML += `
                    <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); padding:15px; border-radius:12px; opacity: 0.85;">
                        <div style="display:flex; justify-content:space-between; align-items: flex-start; margin-bottom: 5px;">
                            <p style="margin:0; font-size:0.65rem; color:#e2e8f0; font-weight:800;">${escaparHTML(String(d.recreadorNombre || '---').toUpperCase())} <span style="color:#94a3b8; font-weight:400;">(${escaparHTML(d.equipo || '---')})</span></p>
                            <span style="font-size: 0.45rem; color: #10b981; border: 1px solid #10b981; border-radius: 4px; padding: 3px 5px; font-weight: 800;">VERIFICADO</span>
                        </div>
                        <p style="margin:0 0 5px 0; font-size:0.5rem; color:#94a3b8;"><i class="fa-regular fa-clock"></i> ${fechaStr}</p>
                        <p style="margin:0 0 10px 0; font-size:0.65rem;">Boletas: <b style="color:white;">${escaparHTML(bolStr)}</b></p>
                        
                        <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 10px; font-size: 0.6rem; color: #cbd5e1;">
                            <div style="margin-bottom: 3px;"><span style="color:var(--accent); font-weight:800;">Entrega:</span> $${escaparHTML(d.monto)} (${escaparHTML(d.metodo)})</div>
                            <div style="margin-bottom: 3px;"><span style="color:var(--accent); font-weight:800;">Entregado a:</span> ${escaparHTML(d.receptor)}</div>
                            <div><span style="color:var(--accent); font-weight:800;">¿Asiste capacitación?:</span> ${escaparHTML(d.capacitacion)}</div>
                        </div>
                        
                        <div style="display: flex; gap: 5px;">
                            <button class="btn-mini" style="flex:3; justify-content:center; background:rgba(0,240,255,0.1); border-color:var(--accent); color:var(--accent);" onclick="verFotoComprobante(decodeURIComponent('${pagoIdEvento}'))"><i class="fa-solid fa-image"></i> VER FOTO</button>
                            ${botonEliminar}
                        </div>
                    </div>
                `;
            });
        }, error => {
            mostrarEstadoLista("admin-pagos-historial", "No fue posible cargar el historial de pagos.", "error");
            manejarError(error, "No se pudo cargar el historial de pagos");
        });
}

// 5. FUNCIONES PARA ELIMINAR REGISTROS
async function borrarPagoHistorial(id) {
    if(!esAdministradorActual()) return notify("⛔ Solo el administrador puede eliminar pagos");

    if(!confirm("¿Seguro que deseas eliminar este registro del historial? (Las boletas seguirán activas). Esta acción no se puede deshacer.")) return;
    const liberarBoton = bloquearBotonActual("ELIMINANDO...");
    try {
        await db.collection("solicitudes_pago").doc(id).delete();
        if(typeof notify === "function") notify("✅ Registro eliminado exitosamente");
    } catch(error) {
        manejarError(error, "No se pudo eliminar el pago");
    } finally {
        liberarBoton();
    }
}

async function borrarTodoHistorialPagos() {
    if(!esAdministradorActual()) return notify("⛔ Solo el administrador puede vaciar el historial");

    if(!confirm("⚠️ ¿ESTÁS SEGURO DE VACIAR TODO EL HISTORIAL DE PAGOS? Esto borrará todos los comprobantes aprobados definitivamente.")) return;
    const liberarBoton = bloquearBotonActual("ELIMINANDO...");

    try {
        const snapshot = await db.collection("solicitudes_pago").where("estado", "==", "Aprobado").get();
        if (snapshot.empty) {
            if(typeof notify === "function") notify("⚠️ El historial ya está vacío");
            return;
        }
        
        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        if(typeof notify === "function") notify("✅ Historial vaciado exitosamente");
    } catch(error) {
        manejarError(error, "No se pudo vaciar el historial");
    } finally {
        liberarBoton();
    }
}

async function exportarPagosExcel() {
    if(!puedeGestionarPagosActual()) return notify("⛔ No tienes permiso para exportar pagos");

    const liberarBoton = bloquearBotonActual("GENERANDO...");
    try {
        const snap = await db.collection("solicitudes_pago").orderBy("creado", "desc").get();
        if(snap.empty) {
            if(typeof notify === "function") notify("⚠️ No hay pagos registrados.");
            else alert("⚠️ No hay pagos registrados.");
            return;
        }
        
        const data = [];
        snap.forEach(doc => {
            const p = doc.data();
            const usuario = allUsers.find(u => u.id === p.recreadorEmail) || {};
            const nombreCompleto = (p.recreadorNombre || "").trim();
            const partesNombre = nombreCompleto.split(/\s+/).filter(Boolean);
            const nombres = usuario.nombre || partesNombre.shift() || "---";
            const apellidos = usuario.apellido || partesNombre.join(" ") || "---";

            data.push({
                "NOMBRES": nombres,
                "APELLIDOS": apellidos,
                "COLOR DE EQUIPO": p.equipo || usuario.color || "Gris",
                "DINERO ENTREGADO": Number(p.monto) || 0
            });
        });

        data.sort((a, b) => {
            const comparacionNombres = a.NOMBRES.localeCompare(b.NOMBRES, 'es', { sensitivity: 'base' });
            if (comparacionNombres !== 0) return comparacionNombres;
            return a.APELLIDOS.localeCompare(b.APELLIDOS, 'es', { sensitivity: 'base' });
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Pagos");
        XLSX.writeFile(workbook, "Reporte_Pagos_General.xlsx");
        
        if(typeof notify === "function") notify("✅ Reporte de pagos generado");
    } catch (error) {
        manejarError(error, "No se pudo generar el reporte de pagos");
    } finally {
        liberarBoton();
    }
}