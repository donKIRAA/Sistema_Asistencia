// --- VARIABLES GLOBALES ---
let modoActual = 'entrada';
let listaGlobalEmpleados = []; 

// Variables para Gestión
let vistaGestionActual = 'activos';
let listaGestionGlobal = []; 
let dniParaBaja = ''; 

// Variables para el Monitor
let listaMonitorGlobal = [];

// --- SISTEMAS DE NOTIFICACIÓN Y MODALES ---
function mostrarNotificacion(mensaje, tipo = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `
        <span>${mensaje}</span>
        <span style="cursor:pointer; font-weight:bold; margin-left:15px; font-size:18px;" onclick="this.parentElement.remove()">×</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fadeOut');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
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

    nuevoBtnCancelar.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    nuevoBtnAceptar.addEventListener('click', () => {
        modal.classList.add('hidden');
        callbackAceptar();
    });
}

// --- AUTENTICACIÓN ---
async function iniciarSesion() {
    const user = document.getElementById('login_user').value;
    const pass = document.getElementById('login_pass').value;

    if (!user || !pass) return mostrarNotificacion("Ingrese sus credenciales", "error");

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });

        if (response.ok) {
            document.getElementById('pantalla-login').style.display = 'none';
            document.getElementById('dashboard').style.display = 'flex';
            cargarListaEmpleados();
        } else {
            const err = await response.json();
            mostrarNotificacion(err.detail, "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión con el servidor", "error");
    }
}

function cerrarSesion() {
    mostrarConfirmacion("¿Estás seguro de que deseas cerrar sesión?", () => {
        document.getElementById('login_user').value = '';
        document.getElementById('login_pass').value = '';
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('pantalla-login').style.display = 'flex';
        
        document.getElementById('busqueda_rapida').value = '';
        document.getElementById('seccion-asistencia').classList.remove('hidden');
        document.getElementById('seccion-gestion').classList.add('hidden');
        document.getElementById('seccion-monitor').classList.add('hidden');
    });
}

// --- NAVEGACIÓN ---
function mostrarPantalla(modo) {
    modoActual = modo;
    
    const asistencia = document.getElementById('seccion-asistencia');
    const gestion = document.getElementById('seccion-gestion');
    const monitor = document.getElementById('seccion-monitor');

    asistencia.classList.add('hidden');
    gestion.classList.add('hidden');
    if (monitor) monitor.classList.add('hidden');

    if (modo === 'gestion') {
        gestion.classList.remove('hidden');
        cambiarPestanaGestion('activos'); 
        
    } else if (modo === 'monitor') {
        monitor.classList.remove('hidden');
        // Filtramos por el día de hoy por defecto al entrar
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('filtro-fecha-monitor').value = hoy;
        cargarTablaMonitor(); 
        
    } else {
        asistencia.classList.remove('hidden');
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
        empleados.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
        listaGlobalEmpleados = empleados;
        renderizarLista(empleados);
    } catch (error) {
        console.error("Error al cargar lista:", error);
    }
}

function renderizarLista(empleados) {
    const contenedor = document.getElementById('lista-empleados');
    contenedor.innerHTML = '';
    
    const ahora = new Date();
    const horasStr = String(ahora.getHours()).padStart(2, '0');
    const minutosStr = String(ahora.getMinutes()).padStart(2, '0');
    const horaActualTiempoReal = `${horasStr}:${minutosStr}`;

    empleados.forEach(emp => {
        const foto = emp.foto_perfil || 'https://via.placeholder.com/70x70.png?text=Foto';
        
        const selectEstado = modoActual === 'entrada' ? `
            <select id="estado_${emp.dni}">
                <option value="Asistencia">Asistencia</option>
                <option value="Tardanza">Tardanza</option>
                <option value="Falta">Falta</option>
            </select>
        ` : '';
        
        const claseBoton = modoActual === 'entrada' ? 'btn-marcar' : 'btn-marcar salida';
        const textoBoton = modoActual === 'entrada' ? 'Marcar' : 'Salir';

        let inputHoraHTML = '';
        if (modoActual === 'entrada') {
            inputHoraHTML = `
                <input type="time" id="hora_${emp.dni}" value="${horaActualTiempoReal}" 
                class="reloj-vivo" readonly tabindex="-1" 
                style="font-weight: bold; color: #2c3e50; background-color: #f4f7f6; border: 1px solid #ddd; pointer-events: none;">
            `;
        } else {
            inputHoraHTML = `
                <input type="time" id="hora_${emp.dni}" value="${horaActualTiempoReal}" 
                class="reloj-vivo"
                onfocus="this.classList.remove('reloj-vivo')" 
                onchange="this.classList.remove('reloj-vivo')"
                style="font-weight: bold; color: #2c3e50; background-color: #ffffff; border: 1px solid #95a5a6; cursor: pointer;">
            `;
        }

        const tarjeta = `
            <div class="tarjeta-empleado">
                <div class="perfil-info">
                    <img src="${foto}" alt="Perfil">
                    <div class="datos-texto">
                        <h4>${emp.nombre_completo}</h4>
                        <p>DNI: ${emp.dni}</p>
                    </div>
                </div>
                <div class="controles-tarjeta">
                    ${selectEstado}
                    <div class="acciones-rapidas">
                        ${inputHoraHTML}
                        <button class="${claseBoton}" onclick="enviarRegistroLista('${emp.dni}')">${textoBoton}</button>
                    </div>
                </div>
            </div>
        `;
        contenedor.innerHTML += tarjeta;
    });
}

function filtrarLista() {
    const texto = document.getElementById('busqueda_rapida').value.toLowerCase();
    const filtrados = listaGlobalEmpleados.filter(emp =>
        emp.nombre_completo.toLowerCase().includes(texto) ||
        emp.dni.includes(texto)
    );
    renderizarLista(filtrados);
}

async function enviarRegistroLista(dni) {
    const hora = document.getElementById(`hora_${dni}`).value;
    const endpoint = (modoActual === 'entrada') ? '/entrada' : '/salida';
    let cuerpo = { dni: dni };
    if (modoActual === 'entrada') {
        cuerpo.hora_llegada = `${hora}:00`;
        cuerpo.estado = document.getElementById(`estado_${dni}`).value;
    } else {
        cuerpo.hora_salida = `${hora}:00`;
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo)
        });
        const res = await response.json();
        if (response.ok) {
            const mensajeExito = (modoActual === 'entrada') ? "Marcación de entrada exitosa" : "Marcación de salida exitosa";
            mostrarNotificacion(mensajeExito, 'success');
        } else {
            mostrarNotificacion(res.detail, 'error');
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión al registrar.", "error");
    }
}

// Motor del reloj en tiempo real
setInterval(() => {
    const ahora = new Date();
    const horas = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    const tiempoReal = `${horas}:${minutos}`;
    
    document.querySelectorAll('.reloj-vivo').forEach(input => {
        if (input.value !== tiempoReal) input.value = tiempoReal;
    });
}, 1000);

// --- GESTIÓN DE PERSONAL ---
function abrirModalEmpleado() {
    document.getElementById('form-titulo').innerText = 'Registrar Nuevo Empleado';
    document.getElementById('reg_dni').value = '';
    document.getElementById('reg_dni').disabled = false;
    document.getElementById('reg_dni').style.backgroundColor = "white";
    document.getElementById('reg_nombre').value = '';
    document.getElementById('reg_entrada').value = '08:00';
    document.getElementById('reg_salida').value = '18:00';
    document.getElementById('btn-guardar-nuevo').classList.remove('hidden');
    document.getElementById('controles-edicion').classList.add('hidden');
    document.getElementById('modal-empleado').classList.remove('hidden');
}

function cerrarModalEmpleado() {
    document.getElementById('modal-empleado').classList.add('hidden');
}

function prepararEdicion(dni, nombre, entrada, salida) {
    abrirModalEmpleado(); 
    document.getElementById('form-titulo').innerText = 'Editar Empleado';
    const inputDni = document.getElementById('reg_dni');
    inputDni.value = dni;
    inputDni.disabled = true; 
    inputDni.style.backgroundColor = "#eee";
    document.getElementById('reg_nombre').value = nombre;
    document.getElementById('reg_entrada').value = entrada;
    document.getElementById('reg_salida').value = salida;
    document.getElementById('btn-guardar-nuevo').classList.add('hidden');
    document.getElementById('controles-edicion').classList.remove('hidden');
}

async function guardarNuevoEmpleado() {
    const dni = document.getElementById('reg_dni').value;
    const nombre = document.getElementById('reg_nombre').value;
    const entrada = document.getElementById('reg_entrada').value;
    const salida = document.getElementById('reg_salida').value;

    if (!dni || !nombre) return mostrarNotificacion("Completa DNI y Nombre.", "error");
    if (dni.length !== 8) return mostrarNotificacion("El DNI debe tener 8 dígitos.", "error");

    try {
        const response = await fetch('/empleados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni, nombre_completo: nombre, hora_entrada_turno: `${entrada}:00`, hora_salida_turno: `${salida}:00` })
        });
        const res = await response.json();
        if (response.ok) {
            mostrarNotificacion("Empleado guardado correctamente.", "success");
            cerrarModalEmpleado(); 
            cargarTablaGestion();  
        } else {
            mostrarNotificacion("Error: " + res.detail, "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión.", "error");
    }
}

async function enviarEdicion() {
    const dni = document.getElementById('reg_dni').value;
    const nombre = document.getElementById('reg_nombre').value;
    const entrada = document.getElementById('reg_entrada').value;
    const salida = document.getElementById('reg_salida').value;

    if (!nombre) return mostrarNotificacion("El nombre no puede estar vacío.", "error");

    try {
        const response = await fetch(`/empleados/${dni}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre_completo: nombre, hora_entrada_turno: `${entrada}:00`, hora_salida_turno: `${salida}:00` })
        });
        if (response.ok) {
            mostrarNotificacion("Datos actualizados.", "success");
            cerrarModalEmpleado(); 
            cargarTablaGestion(); 
        } else {
            const res = await response.json();
            mostrarNotificacion("Error: " + res.detail, "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión.", "error");
    }
}

function darDeBaja(dni) {
    dniParaBaja = dni;
    document.getElementById('baja-dni').innerText = dni;
    document.getElementById('baja-motivo').value = ''; 
    document.getElementById('modal-baja').classList.remove('hidden');
}

function cerrarModalBaja() {
    document.getElementById('modal-baja').classList.add('hidden');
    dniParaBaja = '';
}

async function ejecutarBaja() {
    const motivo = document.getElementById('baja-motivo').value.trim();
    if (!motivo) return mostrarNotificacion("Escribe una justificación.", "error");

    try {
        const response = await fetch(`/empleados/${dniParaBaja}/baja`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ motivo: motivo })
        });
        if (response.ok) {
            mostrarNotificacion("Empleado dado de baja.", "success");
            cerrarModalBaja();
            cargarTablaGestion(); 
        } else {
            const res = await response.json();
            mostrarNotificacion("Error: " + res.detail, "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión.", "error");
    }
}

function verJustificacion(motivo) {
    document.getElementById('texto-justificacion').innerText = motivo;
    document.getElementById('modal-justificacion').classList.remove('hidden');
}

function cambiarPestanaGestion(pestana) {
    vistaGestionActual = pestana;
    document.getElementById('tab-activos').classList.remove('active');
    document.getElementById('tab-todos').classList.remove('active');
    document.getElementById(`tab-${pestana}`).classList.add('active');
    document.getElementById('busqueda_gestion').value = '';

    const cabeceraTabla = document.querySelector('#tabla-empleados-head tr'); 
    if (pestana === 'activos') {
        cabeceraTabla.innerHTML = `
            <th>DNI</th><th>Nombre Completo</th><th>Horario Laboral</th>
            <th style="text-align: center;">Historial Asistencia</th><th>Acciones</th>`;
        cargarTablaGestion();
    } else {
        cabeceraTabla.innerHTML = `
            <th>DNI</th><th>Nombre Completo</th>
            <th style="text-align: center;">Estado</th><th style="text-align: center;">Justificación Baja</th>`;
        cargarTablaTodos();
    }
}

function renderizarTablaGestion(empleados) {
    const tbody = document.getElementById('tabla-empleados-body');
    tbody.innerHTML = '';
    
    empleados.forEach(emp => {
        const tr = document.createElement('tr');
        if (vistaGestionActual === 'activos') {
            const entradaStr = emp.hora_entrada_turno.substring(0, 5);
            const salidaStr = emp.hora_salida_turno.substring(0, 5);
            tr.innerHTML = `
                <td><strong>${emp.dni}</strong></td><td>${emp.nombre_completo}</td><td>${entradaStr} - ${salidaStr}</td>
                <td style="text-align: center;"><button class="btn-historial" onclick="filtrarMonitorPorDNI('${emp.dni}')" title="Ver Historial">📋</button></td>
                <td>
                    <button class="btn-accion btn-editar" onclick="prepararEdicion('${emp.dni}', '${emp.nombre_completo}', '${entradaStr}', '${salidaStr}')">Editar</button>
                    <button class="btn-accion btn-baja" onclick="darDeBaja('${emp.dni}')">Baja</button>
                </td>`;
        } else {
            const esActivo = emp.activo;
            const estadoBadge = esActivo 
                ? '<span style="background: #27ae60; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">ACTIVO</span>'
                : '<span style="background: #c0392b; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">INACTIVO</span>';
            const btnJustificacion = esActivo 
                ? '<span style="color: #95a5a6; font-style: italic;">N/A</span>'
                : `<button class="btn-accion" style="background: #f39c12; color: white; border-radius: 15px;" onclick="verJustificacion('${emp.motivo_baja}')">Ver Detalles</button>`;
            if(!esActivo) tr.style.backgroundColor = "#fdf2f2"; 
            tr.innerHTML = `<td><strong>${emp.dni}</strong></td><td>${emp.nombre_completo}</td><td style="text-align: center;">${estadoBadge}</td><td style="text-align: center;">${btnJustificacion}</td>`;
        }
        tbody.appendChild(tr);
    });
}

async function cargarTablaGestion() {
    try {
        const response = await fetch('/empleados');
        let empleados = await response.json();
        empleados.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
        listaGestionGlobal = empleados;
        renderizarTablaGestion(empleados);
    } catch (error) { console.error("Error:", error); }
}

async function cargarTablaTodos() {
    try {
        const response = await fetch('/empleados/todos');
        let empleados = await response.json();
        empleados.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
        listaGestionGlobal = empleados;
        renderizarTablaGestion(empleados);
    } catch (error) { console.error("Error:", error); }
}

function filtrarTablaGestion() {
    const texto = document.getElementById('busqueda_gestion').value.toLowerCase();
    const filtrados = listaGestionGlobal.filter(emp => emp.nombre_completo.toLowerCase().includes(texto) || emp.dni.includes(texto));
    renderizarTablaGestion(filtrados);
}

// --- MONITOR DE ASISTENCIAS (NUEVO) ---
async function cargarTablaMonitor() {
    try {
        const response = await fetch('/asistencias/monitor');
        let asistencias = await response.json();
        listaMonitorGlobal = asistencias;
        filtrarTablaMonitor(); 
    } catch (error) {
        console.error("Error al cargar monitor:", error);
        mostrarNotificacion("Error al cargar historial de asistencias", "error");
    }
}

function limpiarFiltroMonitor() {
    document.getElementById('filtro-fecha-monitor').value = '';
    document.getElementById('busqueda_monitor').value = '';
    filtrarTablaMonitor();
}

// Conecta el botón del portapapeles en Gestión directo con el Monitor
function filtrarMonitorPorDNI(dni) {
    mostrarPantalla('monitor');
    document.getElementById('filtro-fecha-monitor').value = ''; 
    document.getElementById('busqueda_monitor').value = dni;
    // Pequeño retraso para asegurar que la vista cargue primero
    setTimeout(() => filtrarTablaMonitor(), 100);
}

function filtrarTablaMonitor() {
    const texto = document.getElementById('busqueda_monitor').value.toLowerCase();
    const fechaFiltro = document.getElementById('filtro-fecha-monitor').value;

    const filtrados = listaMonitorGlobal.filter(asis => {
        const coincideTexto = asis.nombre_completo.toLowerCase().includes(texto) || asis.dni.includes(texto);
        const coincideFecha = fechaFiltro ? asis.fecha === fechaFiltro : true;
        return coincideTexto && coincideFecha;
    });

    renderizarTablaMonitor(filtrados);
}

function renderizarTablaMonitor(asistencias) {
    const tbody = document.getElementById('tabla-monitor-body');
    tbody.innerHTML = '';

    let contAsistencias = 0;
    let contTardanzas = 0;
    let contFaltas = 0;

    asistencias.forEach(asis => {
        // Cálculo de KPIs
        if (asis.estado === 'Asistencia') contAsistencias++;
        if (asis.estado === 'Tardanza') contTardanzas++;
        if (asis.estado === 'Falta') contFaltas++;

        const tr = document.createElement('tr');

        // Diseño visual de estados
        let estadoBadge = '';
        if (asis.estado === 'Asistencia') estadoBadge = '<span style="background:#27ae60; color:white; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">ASISTENCIA</span>';
        else if (asis.estado === 'Tardanza') estadoBadge = '<span style="background:#f39c12; color:white; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">TARDANZA</span>';
        else if (asis.estado === 'Falta') estadoBadge = '<span style="background:#c0392b; color:white; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">FALTA</span>';
        else estadoBadge = `<span style="background:#7f8c8d; color:white; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">${asis.estado.toUpperCase()}</span>`;

        // LÓGICA NUEVA: Formatear los minutos de tardanza a "Xh Ym"
        let tardanzaStr = '-';
        if (asis.minutos_tardanza > 0) {
            let t_h = Math.floor(asis.minutos_tardanza / 60); // Extrae las horas enteras
            let t_m = asis.minutos_tardanza % 60; // Extrae los minutos sobrantes
            
            if (t_h > 0 && t_m > 0) tardanzaStr = `${t_h}h ${t_m}m`;
            else if (t_h > 0) tardanzaStr = `${t_h}h`;
            else tardanzaStr = `${t_m}m`;
        }

        // Resaltado de anomalías (Tardanzas y Horas extra)
        let tardanzaStyle = asis.minutos_tardanza > 0 ? 'color: #c0392b; font-weight: bold;' : 'color: #7f8c8d;';
        let extraStyle = asis.horas_extra !== "0h" ? 'color: #2980b9; font-weight: bold;' : 'color: #7f8c8d;';

        tr.innerHTML = `
            <td><strong>${asis.dni}</strong></td>
            <td>${asis.nombre_completo}</td>
            <td>${asis.fecha}</td>
            <td style="text-align: center; font-weight:bold; color: #2c3e50;">${asis.hora_entrada}</td>
            <td style="text-align: center; font-weight:bold; color: #2c3e50;">${asis.hora_salida}</td>
            <td style="text-align: center; ${tardanzaStyle}">${tardanzaStr}</td>
            <td style="text-align: center; ${extraStyle}">${asis.horas_extra !== "0h" ? asis.horas_extra : '-'}</td>
            <td style="text-align: center;">${estadoBadge}</td>
        `;
        tbody.appendChild(tr);
    });

    // Inyectar contadores en las 3 tarjetas restantes
    document.getElementById('kpi-asistencias').innerText = contAsistencias;
    document.getElementById('kpi-tardanzas').innerText = contTardanzas;
    document.getElementById('kpi-faltas').innerText = contFaltas;
}