// --- VARIABLES GLOBALES ---
let modoActual = 'entrada';
let listaGlobalEmpleados = []; 
let vistaGestionActual = 'activos';
let listaGestionGlobal = []; 
let dniParaBaja = ''; 
let listaMonitorGlobal = [];
let fotoBase64Global = null; 

// --- NOTIFICACIONES Y MODALES ---
function mostrarNotificacion(mensaje, tipo = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `<span>${mensaje}</span><span style="cursor:pointer; font-weight:bold; margin-left:15px; font-size:18px;" onclick="this.parentElement.remove()">×</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('fadeOut'); setTimeout(() => toast.remove(), 300); }, 3500);
}

function mostrarConfirmacion(mensaje, callbackAceptar) {
    const modal = document.getElementById('modal-confirmacion');
    document.getElementById('modal-mensaje').innerText = mensaje;
    modal.classList.remove('hidden');
    const btnAceptar = document.getElementById('btn-modal-aceptar');
    const btnCancelar = document.getElementById('btn-modal-cancelar');
    const nuevoBtnAceptar = btnAceptar.cloneNode(true);
    const nuevoBtnCancelar = btnCancelar.cloneNode(true);
    btnAceptar.parentNode.replaceChild(nuevoBtnAceptar, btnAceptar);
    btnCancelar.parentNode.replaceChild(nuevoBtnCancelar, btnCancelar);
    nuevoBtnCancelar.addEventListener('click', () => modal.classList.add('hidden'));
    nuevoBtnAceptar.addEventListener('click', () => { modal.classList.add('hidden'); callbackAceptar(); });
}

// --- AUTENTICACIÓN ---
async function iniciarSesion() {
    const user = document.getElementById('login_user').value;
    const pass = document.getElementById('login_pass').value;
    if (!user || !pass) return mostrarNotificacion("Ingrese sus credenciales", "error");
    try {
        const response = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) });
        if (response.ok) {
            document.getElementById('pantalla-login').style.display = 'none';
            document.getElementById('dashboard').style.display = 'flex';
            cargarListaEmpleados();
        } else {
            const err = await response.json(); mostrarNotificacion(err.detail, "error");
        }
    } catch (error) { mostrarNotificacion("Error de conexión", "error"); }
}

function cerrarSesion() {
    mostrarConfirmacion("¿Estás seguro de que deseas cerrar sesión?", () => {
        document.getElementById('login_user').value = '';
        document.getElementById('login_pass').value = '';
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('pantalla-login').style.display = 'flex';
        mostrarPantalla('entrada'); 
    });
}

// --- NAVEGACIÓN ---
function mostrarPantalla(modo) {
    modoActual = modo;
    document.getElementById('seccion-asistencia').classList.add('hidden');
    document.getElementById('seccion-gestion').classList.add('hidden');
    document.getElementById('seccion-monitor').classList.add('hidden');

    if (modo === 'gestion') {
        document.getElementById('seccion-gestion').classList.remove('hidden');
        cambiarPestanaGestion('activos'); 
    } else if (modo === 'monitor') {
        document.getElementById('seccion-monitor').classList.remove('hidden');
        document.getElementById('filtro-fecha-monitor').value = new Date().toISOString().split('T')[0];
        cargarTablaMonitor(); 
    } else {
        document.getElementById('seccion-asistencia').classList.remove('hidden');
        document.getElementById('titulo-pantalla').innerText = `Registro de ${modo.charAt(0).toUpperCase() + modo.slice(1)}`;
        document.getElementById('busqueda_rapida').value = ''; 
        cargarListaEmpleados(); 
    }
}

// --- ASISTENCIA (Entrada/Salida) ---
async function cargarListaEmpleados() {
    try {
        const response = await fetch('/empleados');
        let empleados = await response.json();
        // Ordenamos alfabéticamente por Nombres
        empleados.sort((a, b) => a.nombres.localeCompare(b.nombres));
        listaGlobalEmpleados = empleados;
        renderizarLista(empleados);
    } catch (error) { console.error("Error:", error); }
}

function renderizarLista(empleados) {
    const contenedor = document.getElementById('lista-empleados');
    contenedor.innerHTML = '';
    const ahora = new Date();
    const tiempoReal = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

    empleados.forEach(emp => {
        const nombreCompleto = [emp.nombres, emp.apellido_paterno, emp.apellido_materno].filter(Boolean).join(' ');
        const foto = emp.foto_perfil || 'https://via.placeholder.com/70x70.png?text=Foto';
        const selectEstado = modoActual === 'entrada' ? `<select id="estado_${emp.dni}"><option value="Asistencia">Asistencia</option><option value="Tardanza">Tardanza</option><option value="Falta">Falta</option></select>` : '';
        const claseBoton = modoActual === 'entrada' ? 'btn-marcar' : 'btn-marcar salida';
        const textoBoton = modoActual === 'entrada' ? 'Marcar' : 'Salir';

        let inputHoraHTML = modoActual === 'entrada' 
            ? `<input type="time" id="hora_${emp.dni}" value="${tiempoReal}" class="reloj-vivo" readonly tabindex="-1" style="font-weight:bold; color:#2c3e50; background-color:#f4f7f6; border:1px solid #ddd; pointer-events:none;">`
            : `<input type="time" id="hora_${emp.dni}" value="${tiempoReal}" class="reloj-vivo" onfocus="this.classList.remove('reloj-vivo')" onchange="this.classList.remove('reloj-vivo')" style="font-weight:bold; color:#2c3e50; background-color:#fff; border:1px solid #95a5a6; cursor:pointer;">`;

        contenedor.innerHTML += `
            <div class="tarjeta-empleado">
                <div class="perfil-info">
                    <img src="${foto}" alt="Perfil">
                    <div class="datos-texto"><h4>${nombreCompleto}</h4><p>DNI: ${emp.dni}</p></div>
                </div>
                <div class="controles-tarjeta">
                    ${selectEstado}
                    <div class="acciones-rapidas">${inputHoraHTML}<button class="${claseBoton}" onclick="enviarRegistroLista('${emp.dni}')">${textoBoton}</button></div>
                </div>
            </div>`;
    });
}

function filtrarLista() {
    const texto = document.getElementById('busqueda_rapida').value.toLowerCase();
    renderizarLista(listaGlobalEmpleados.filter(emp => {
        const nombreCompleto = `${emp.nombres} ${emp.apellido_paterno} ${emp.apellido_materno}`.toLowerCase();
        return nombreCompleto.includes(texto) || emp.dni.includes(texto);
    }));
}

async function enviarRegistroLista(dni) {
    const hora = document.getElementById(`hora_${dni}`).value;
    const endpoint = (modoActual === 'entrada') ? '/entrada' : '/salida';
    let cuerpo = { dni: dni };
    if (modoActual === 'entrada') { cuerpo.hora_llegada = `${hora}:00`; cuerpo.estado = document.getElementById(`estado_${dni}`).value; } 
    else { cuerpo.hora_salida = `${hora}:00`; }

    try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
        if (response.ok) mostrarNotificacion(modoActual === 'entrada' ? "Entrada registrada" : "Salida registrada", 'success');
        else { const res = await response.json(); mostrarNotificacion(res.detail, 'error'); }
    } catch (error) { mostrarNotificacion("Error de conexión.", "error"); }
}

setInterval(() => {
    const ahora = new Date();
    const tiempoReal = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
    document.querySelectorAll('.reloj-vivo').forEach(input => { if (input.value !== tiempoReal) input.value = tiempoReal; });
}, 1000);

// --- GESTIÓN DE PERSONAL Y FOTO ---
function previsualizarFoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return mostrarNotificacion("La imagen supera los 2 MB.", "error"), event.target.value = '';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        fotoBase64Global = e.target.result; 
        const box = document.getElementById('foto-preview-box');
        box.style.backgroundImage = `url('${fotoBase64Global}')`;
        box.querySelector('.foto-plus').style.display = 'none'; 
    };
    reader.readAsDataURL(file);
}

function abrirModalEmpleado() {
    document.getElementById('form-titulo').innerText = 'Registrar Nuevo Empleado';
    
    document.getElementById('reg_dni').value = ''; document.getElementById('reg_dni').disabled = false; document.getElementById('reg_dni').style.backgroundColor = "white";
    document.getElementById('reg_nombres').value = '';
    document.getElementById('reg_ap_paterno').value = '';
    document.getElementById('reg_ap_materno').value = '';
    document.getElementById('reg_correo').value = '';
    document.getElementById('reg_celular').value = '';
    document.getElementById('reg_emergencia').value = '';
    document.getElementById('reg_entrada').value = '08:00'; 
    document.getElementById('reg_salida').value = '18:00';
    
    fotoBase64Global = null; document.getElementById('reg_foto').value = '';
    const box = document.getElementById('foto-preview-box');
    box.style.backgroundImage = 'none'; box.querySelector('.foto-plus').style.display = 'block';

    document.getElementById('btn-guardar-nuevo').classList.remove('hidden'); document.getElementById('controles-edicion').classList.add('hidden');
    document.getElementById('modal-empleado').classList.remove('hidden');
}

function cerrarModalEmpleado() { document.getElementById('modal-empleado').classList.add('hidden'); }

function prepararEdicion(dni) {
    const empleado = listaGestionGlobal.find(emp => emp.dni === dni);
    if (!empleado) return;

    abrirModalEmpleado(); 
    document.getElementById('form-titulo').innerText = 'Editar Empleado';
    
    document.getElementById('reg_dni').value = empleado.dni; document.getElementById('reg_dni').disabled = true; document.getElementById('reg_dni').style.backgroundColor = "#eee";
    document.getElementById('reg_nombres').value = empleado.nombres;
    document.getElementById('reg_ap_paterno').value = empleado.apellido_paterno;
    document.getElementById('reg_ap_materno').value = empleado.apellido_materno;
    document.getElementById('reg_correo').value = empleado.correo || '';
    document.getElementById('reg_celular').value = empleado.celular || '';
    document.getElementById('reg_emergencia').value = empleado.contacto_emergencia || '';
    document.getElementById('reg_entrada').value = empleado.hora_entrada_turno.substring(0, 5);
    document.getElementById('reg_salida').value = empleado.hora_salida_turno.substring(0, 5);
    
    const box = document.getElementById('foto-preview-box');
    if (empleado.foto_perfil) {
        fotoBase64Global = empleado.foto_perfil;
        box.style.backgroundImage = `url('${fotoBase64Global}')`; box.querySelector('.foto-plus').style.display = 'none';
    }

    document.getElementById('btn-guardar-nuevo').classList.add('hidden'); document.getElementById('controles-edicion').classList.remove('hidden');
}

async function guardarNuevoEmpleado() {
    const dni = document.getElementById('reg_dni').value.trim();
    const nombres = document.getElementById('reg_nombres').value.trim();
    const ap_paterno = document.getElementById('reg_ap_paterno').value.trim();
    const ap_materno = document.getElementById('reg_ap_materno').value.trim();
    const correo = document.getElementById('reg_correo').value.trim();
    const celular = document.getElementById('reg_celular').value.trim();
    const emergencia = document.getElementById('reg_emergencia').value.trim();
    const entrada = document.getElementById('reg_entrada').value; 
    const salida = document.getElementById('reg_salida').value;

    if (!dni || !nombres || !ap_paterno || dni.length !== 8) return mostrarNotificacion("DNI (8 dígitos), Nombres y Apellido Paterno son obligatorios.", "error");

    try {
        const response = await fetch('/empleados', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                dni, nombres, apellido_paterno: ap_paterno, apellido_materno: ap_materno,
                correo, celular, contacto_emergencia: emergencia,
                hora_entrada_turno: `${entrada}:00`, hora_salida_turno: `${salida}:00`, foto_perfil: fotoBase64Global 
            })
        });
        if (response.ok) { mostrarNotificacion("Empleado guardado.", "success"); cerrarModalEmpleado(); cargarTablaGestion(); } 
        else { const res = await response.json(); mostrarNotificacion("Error: " + res.detail, "error"); }
    } catch (error) { mostrarNotificacion("Error de conexión.", "error"); }
}

async function enviarEdicion() {
    const dni = document.getElementById('reg_dni').value;
    const nombres = document.getElementById('reg_nombres').value.trim();
    const ap_paterno = document.getElementById('reg_ap_paterno').value.trim();
    const ap_materno = document.getElementById('reg_ap_materno').value.trim();
    const correo = document.getElementById('reg_correo').value.trim();
    const celular = document.getElementById('reg_celular').value.trim();
    const emergencia = document.getElementById('reg_emergencia').value.trim();
    const entrada = document.getElementById('reg_entrada').value; 
    const salida = document.getElementById('reg_salida').value;

    if (!nombres || !ap_paterno) return mostrarNotificacion("Nombres y Apellido Paterno son obligatorios.", "error");

    try {
        const response = await fetch(`/empleados/${dni}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                nombres, apellido_paterno: ap_paterno, apellido_materno: ap_materno,
                correo, celular, contacto_emergencia: emergencia,
                hora_entrada_turno: `${entrada}:00`, hora_salida_turno: `${salida}:00`, foto_perfil: fotoBase64Global 
            })
        });
        if (response.ok) { mostrarNotificacion("Datos actualizados.", "success"); cerrarModalEmpleado(); cargarTablaGestion(); } 
        else { const res = await response.json(); mostrarNotificacion("Error: " + res.detail, "error"); }
    } catch (error) { mostrarNotificacion("Error de conexión.", "error"); }
}

function darDeBaja(dni) { dniParaBaja = dni; document.getElementById('baja-dni').innerText = dni; document.getElementById('baja-motivo').value = ''; document.getElementById('modal-baja').classList.remove('hidden'); }
function cerrarModalBaja() { document.getElementById('modal-baja').classList.add('hidden'); dniParaBaja = ''; }

async function ejecutarBaja() {
    const motivo = document.getElementById('baja-motivo').value.trim();
    if (!motivo) return mostrarNotificacion("Escribe una justificación.", "error");
    try {
        const response = await fetch(`/empleados/${dniParaBaja}/baja`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }) });
        if (response.ok) { mostrarNotificacion("Empleado dado de baja.", "success"); cerrarModalBaja(); cargarTablaGestion(); } 
        else { const res = await response.json(); mostrarNotificacion("Error: " + res.detail, "error"); }
    } catch (error) { mostrarNotificacion("Error de conexión.", "error"); }
}

function verJustificacion(motivo) { document.getElementById('texto-justificacion').innerText = motivo; document.getElementById('modal-justificacion').classList.remove('hidden'); }

function cambiarPestanaGestion(pestana) {
    vistaGestionActual = pestana;
    document.getElementById('tab-activos').classList.remove('active'); document.getElementById('tab-todos').classList.remove('active');
    document.getElementById(`tab-${pestana}`).classList.add('active'); document.getElementById('busqueda_gestion').value = '';
    const cabeceraTabla = document.querySelector('#tabla-empleados-head tr'); 
    if (pestana === 'activos') {
        cabeceraTabla.innerHTML = `<th>DNI</th><th>Nombre Completo</th><th>Horario Laboral</th><th style="text-align: center;">Historial Asistencia</th><th>Acciones</th>`;
        cargarTablaGestion();
    } else {
        cabeceraTabla.innerHTML = `<th>DNI</th><th>Nombre Completo</th><th style="text-align: center;">Estado</th><th style="text-align: center;">Justificación Baja</th>`;
        cargarTablaTodos();
    }
}

function renderizarTablaGestion(empleados) {
    const tbody = document.getElementById('tabla-empleados-body');
    tbody.innerHTML = '';
    empleados.forEach(emp => {
        const tr = document.createElement('tr');
        const nombreCompleto = [emp.nombres, emp.apellido_paterno, emp.apellido_materno].filter(Boolean).join(' ');
        
        if (vistaGestionActual === 'activos') {
            tr.innerHTML = `<td><strong>${emp.dni}</strong></td><td>${nombreCompleto}</td><td>${emp.hora_entrada_turno.substring(0,5)} - ${emp.hora_salida_turno.substring(0,5)}</td>
                <td style="text-align: center;"><button class="btn-historial" onclick="verHistorialIndividual('${emp.dni}', '${nombreCompleto}')" title="Ver Historial">📋</button></td>
                <td><button class="btn-accion btn-editar" onclick="prepararEdicion('${emp.dni}')">Editar</button><button class="btn-accion btn-baja" onclick="darDeBaja('${emp.dni}')">Baja</button></td>`;
        } else {
            const estadoBadge = emp.activo ? '<span style="background:#27ae60; color:white; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">ACTIVO</span>' : '<span style="background:#c0392b; color:white; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">INACTIVO</span>';
            const btnJustificacion = emp.activo ? '<span style="color:#95a5a6; font-style:italic;">N/A</span>' : `<button class="btn-accion" style="background:#f39c12; color:white; border-radius:15px;" onclick="verJustificacion('${emp.motivo_baja}')">Ver Detalles</button>`;
            if(!emp.activo) tr.style.backgroundColor = "#fdf2f2"; 
            tr.innerHTML = `<td><strong>${emp.dni}</strong></td><td>${nombreCompleto}</td><td style="text-align: center;">${estadoBadge}</td><td style="text-align: center;">${btnJustificacion}</td>`;
        }
        tbody.appendChild(tr);
    });
}

async function cargarTablaGestion() {
    try { const response = await fetch('/empleados'); let empleados = await response.json(); empleados.sort((a,b) => a.nombres.localeCompare(b.nombres)); listaGestionGlobal = empleados; renderizarTablaGestion(empleados); } catch (e) { console.error(e); }
}
async function cargarTablaTodos() {
    try { const response = await fetch('/empleados/todos'); let empleados = await response.json(); empleados.sort((a,b) => a.nombres.localeCompare(b.nombres)); listaGestionGlobal = empleados; renderizarTablaGestion(empleados); } catch (e) { console.error(e); }
}
function filtrarTablaGestion() {
    const texto = document.getElementById('busqueda_gestion').value.toLowerCase();
    renderizarTablaGestion(listaGestionGlobal.filter(emp => {
        const nombreCompleto = `${emp.nombres} ${emp.apellido_paterno} ${emp.apellido_materno}`.toLowerCase();
        return nombreCompleto.includes(texto) || emp.dni.includes(texto);
    }));
}

// --- HISTORIAL INDIVIDUAL (El trabajo de tu compañero) ---
function cerrarModalHistorial() {
    document.getElementById('modal-historial-empleado').classList.add('hidden');
}

async function verHistorialIndividual(dni, nombre) {
    document.getElementById('historial-nombre-empleado').innerText = "Historial: " + nombre;
    const tbody = document.getElementById('tabla-historial-individual-body');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Cargando registros...</td></tr>';
    document.getElementById('modal-historial-empleado').classList.remove('hidden');

    try {
        const response = await fetch('/asistencias/monitor');
        let asistencias = await response.json();

        // Filtramos solo los registros de este empleado
        const historial = asistencias.filter(a => a.dni === dni);
        tbody.innerHTML = '';

        if (historial.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Este empleado aún no tiene registros de asistencia.</td></tr>';
            return;
        }

        historial.forEach(asis => {
            const tr = document.createElement('tr');

            // Formatear entradas/salidas vacías con un guión
            const entrada = (asis.hora_entrada && asis.hora_entrada !== '--:--') ? asis.hora_entrada : '-';
            const salida = (asis.hora_salida && asis.hora_salida !== '--:--') ? asis.hora_salida : '-';

            // ESTADOS: Asistió, Tardanza, Faltó
            let estadoBadge = '';
            let estadoUpper = asis.estado.toUpperCase();
            if (estadoUpper === 'ASISTENCIA') estadoBadge = '<span style="color:#27ae60; font-weight:bold;">Asistió</span>';
            else if (estadoUpper === 'TARDANZA') estadoBadge = '<span style="color:#f39c12; font-weight:bold;">Tardanza</span>';
            else if (estadoUpper === 'FALTA') estadoBadge = '<span style="color:#c0392b; font-weight:bold;">Faltó</span>';
            else estadoBadge = asis.estado;

            // REGLA DE HORAS EXTRA: 45 min o más equivale a 1h extra.
            let extraFinal = '-';
            if (asis.horas_extra && asis.horas_extra !== "0h") {
                let str = asis.horas_extra;
                let h = 0, m = 0;
                
                // Extraer horas y minutos del string del backend ("Xh Ym")
                if (str.includes('h')) h = parseInt(str.split('h')[0]) || 0;
                if (str.includes('m')) {
                    let parts = str.split('h');
                    let minPart = parts.length > 1 ? parts[1] : parts[0];
                    m = parseInt(minPart.replace('m', '').trim()) || 0;
                }

                let totalMinutos = (h * 60) + m;
                let horasCalculadas = Math.floor(totalMinutos / 60);
                let minutosRestantes = totalMinutos % 60;

                // Aplicar la regla de oro: si sobran 45 mins o más, se cuenta como una hora entera
                if (minutosRestantes >= 45) {
                    horasCalculadas += 1;
                    minutosRestantes = 0; 
                }

                if (horasCalculadas > 0) {
                    extraFinal = `${horasCalculadas}h`;
                    // Mostrar minutos si fueran menores a 45 y quieres guardar la exactitud
                    if (minutosRestantes > 0) extraFinal += ` ${minutosRestantes}m`;
                } else {
                    extraFinal = '-'; 
                }
            }

            tr.innerHTML = `
                <td style="text-align: center;">${asis.fecha}</td>
                <td style="text-align: center; font-weight:bold; color: #2c3e50;">${entrada}</td>
                <td style="text-align: center; font-weight:bold; color: #2c3e50;">${salida}</td>
                <td style="text-align: center;">${estadoBadge}</td>
                <td style="text-align: center; color: #2980b9; font-weight: bold;">${extraFinal}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #c0392b; padding: 20px;">Error al cargar el historial del empleado.</td></tr>';
        console.error(error);
    }
}

// --- MONITOR DE ASISTENCIAS GENERAL ---
async function cargarTablaMonitor() {
    try { const response = await fetch('/asistencias/monitor'); listaMonitorGlobal = await response.json(); filtrarTablaMonitor(); } catch (e) { mostrarNotificacion("Error al cargar historial", "error"); }
}
function limpiarFiltroMonitor() { document.getElementById('filtro-fecha-monitor').value = ''; document.getElementById('busqueda_monitor').value = ''; filtrarTablaMonitor(); }

function filtrarTablaMonitor() {
    const texto = document.getElementById('busqueda_monitor').value.toLowerCase();
    const fecha = document.getElementById('filtro-fecha-monitor').value;
    renderizarTablaMonitor(listaMonitorGlobal.filter(asis => (asis.nombre_completo.toLowerCase().includes(texto) || asis.dni.includes(texto)) && (fecha ? asis.fecha === fecha : true)));
}

function renderizarTablaMonitor(asistencias) {
    const tbody = document.getElementById('tabla-monitor-body'); tbody.innerHTML = '';
    let contAsistencias = 0, contTardanzas = 0, contFaltas = 0;

    asistencias.forEach(asis => {
        if (asis.estado === 'Asistencia') contAsistencias++; if (asis.estado === 'Tardanza') contTardanzas++; if (asis.estado === 'Falta') contFaltas++;
        const tr = document.createElement('tr');
        
        let estadoBadge = '';
        if (asis.estado === 'Asistencia') estadoBadge = '<span style="background:#27ae60; color:white; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">ASISTENCIA</span>';
        else if (asis.estado === 'Tardanza') estadoBadge = '<span style="background:#f39c12; color:white; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">TARDANZA</span>';
        else if (asis.estado === 'Falta') estadoBadge = '<span style="background:#c0392b; color:white; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">FALTA</span>';
        else estadoBadge = `<span style="background:#7f8c8d; color:white; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">${asis.estado.toUpperCase()}</span>`;

        let tardanzaStr = '-';
        if (asis.minutos_tardanza > 0) {
            let t_h = Math.floor(asis.minutos_tardanza / 60), t_m = asis.minutos_tardanza % 60;
            tardanzaStr = t_h > 0 && t_m > 0 ? `${t_h}h ${t_m}m` : (t_h > 0 ? `${t_h}h` : `${t_m}m`);
        }

        let tardanzaStyle = asis.minutos_tardanza > 0 ? 'color: #c0392b; font-weight: bold;' : 'color: #7f8c8d;';
        let extraStyle = asis.horas_extra && asis.horas_extra !== "0h" ? 'color: #2980b9; font-weight: bold;' : 'color: #7f8c8d;';

        tr.innerHTML = `<td><strong>${asis.dni}</strong></td><td>${asis.nombre_completo}</td><td>${asis.fecha}</td>
            <td style="text-align: center; font-weight:bold; color: #2c3e50;">${asis.hora_entrada}</td><td style="text-align: center; font-weight:bold; color: #2c3e50;">${asis.hora_salida}</td>
            <td style="text-align: center; ${tardanzaStyle}">${tardanzaStr}</td><td style="text-align: center; ${extraStyle}">${asis.horas_extra && asis.horas_extra !== "0h" ? asis.horas_extra : '-'}</td>
            <td style="text-align: center;">${estadoBadge}</td>`;
        tbody.appendChild(tr);
    });

    document.getElementById('kpi-asistencias').innerText = contAsistencias;
    document.getElementById('kpi-tardanzas').innerText = contTardanzas;
    document.getElementById('kpi-faltas').innerText = contFaltas;
}