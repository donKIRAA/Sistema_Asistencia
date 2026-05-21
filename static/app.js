// --- VARIABLES GLOBALES ---
let modoActual = 'entrada';
let listaGlobalEmpleados = []; 
let vistaGestionActual = 'activos';
let listaGestionGlobal = []; 
let dniParaBaja = ''; 
let listaMonitorGlobal = [];
let asistenciasHoy = []; 
let fotoBase64Global = null; 

// --- MOTOR DE SEGURIDAD GLOBAL ---
let accionAutorizadaPendiente = null;

function pedirAutorizacion(callback) {
    accionAutorizadaPendiente = callback;
    document.getElementById('auth_user').value = '';
    document.getElementById('auth_pass').value = '';
    document.getElementById('modal-autorizacion').classList.remove('hidden');
}

function cerrarModalAutorizacion() { 
    document.getElementById('modal-autorizacion').classList.add('hidden'); 
    accionAutorizadaPendiente = null;
}

async function verificarAutorizacion() {
    const user = document.getElementById('auth_user').value;
    const pass = document.getElementById('auth_pass').value;
    if (!user || !pass) return mostrarNotificacion("Complete credenciales de seguridad", "error");

    try {
        const response = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) });
        if (response.ok) {
            mostrarNotificacion("Autorización Concedida", "success");
            
            // 1. Ejecutamos la acción pendiente ANTES de borrarla
            if(accionAutorizadaPendiente) accionAutorizadaPendiente(); 
            
            // 2. Ahora sí cerramos el modal de seguridad
            cerrarModalAutorizacion();
        } else { 
            mostrarNotificacion("Acceso Denegado: Credenciales incorrectas", "error"); 
        }
    } catch (error) { mostrarNotificacion("Error interno de red.", "error"); }
}

// --- NOTIFICACIONES Y MODALES BÁSICOS ---
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

async function iniciarSesion() {
    const user = document.getElementById('login_user').value;
    const pass = document.getElementById('login_pass').value;
    if (!user || !pass) return mostrarNotificacion("Ingrese sus credenciales", "error");
    try {
        const response = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) });
        if (response.ok) {
            document.getElementById('pantalla-login').style.display = 'none'; document.getElementById('dashboard').style.display = 'flex';
            cargarListaEmpleados();
        } else { const err = await response.json(); mostrarNotificacion(err.detail, "error"); }
    } catch (error) { mostrarNotificacion("Error de conexión", "error"); }
}
function cerrarSesion() {
    mostrarConfirmacion("¿Estás seguro de que deseas cerrar sesión?", () => {
        document.getElementById('login_user').value = ''; document.getElementById('login_pass').value = '';
        document.getElementById('dashboard').style.display = 'none'; document.getElementById('pantalla-login').style.display = 'flex';
        mostrarPantalla('entrada'); 
    });
}

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
        
        // Mostrar filtro de horario solo en Salida
        const filtroSalida = document.getElementById('filtro_horario_salida');
        if (modo === 'salida') { filtroSalida.classList.remove('hidden'); filtroSalida.value = ''; } 
        else { filtroSalida.classList.add('hidden'); }
        
        cargarListaEmpleados(); 
    }
}

// --- CORE DE REGLAS DE TIEMPO (10 MINUTOS TOLERANCIA) ---
function evaluarOpcionesEstado(dni, horaTurnoStr) {
    const inputHora = document.getElementById(`hora_${dni}`);
    const selectEstado = document.getElementById(`estado_${dni}`);
    if (!inputHora || !selectEstado) return;

    const [hTurno, mTurno] = horaTurnoStr.split(':').map(Number);
    const [hInput, mInput] = inputHora.value.split(':').map(Number);
    
    const turnoObj = new Date(); turnoObj.setHours(hTurno, mTurno, 0);
    const inputObj = new Date(); inputObj.setHours(hInput, mInput, 0);
    
    const diffMinutos = (inputObj - turnoObj) / (1000 * 60);
    const currentVal = selectEstado.value;

    selectEstado.innerHTML = '';
    // Regla estricta
    if (diffMinutos >= -10 && diffMinutos <= 10) {
        selectEstado.innerHTML += `<option value="Asistencia">Asistencia</option>`;
    } else {
        selectEstado.innerHTML += `<option value="Asistencia" disabled style="color: #bdc3c7; background: #f2f2f2;">Asistencia (Deshabilitada)</option>`;
    }
    selectEstado.innerHTML += `<option value="Tardanza">Tardanza</option><option value="Falta">Falta</option>`;

    if (selectEstado.querySelector(`option[value="${currentVal}"]:not([disabled])`)) {
        selectEstado.value = currentVal;
    } else {
        selectEstado.value = (diffMinutos > 10) ? 'Tardanza' : 'Falta';
    }
}

// --- CONTROL DE ASISTENCIA Y RENDERIZACIÓN ---
async function cargarListaEmpleados() {
    try {
        const resEmp = await fetch('/empleados'); 
        let empleados = await resEmp.json();
        // Orden alfabético y forzar Mayúsculas en Front por seguridad
        empleados.forEach(e => {
            e.nombres = e.nombres.toUpperCase();
            e.apellido_paterno = e.apellido_paterno.toUpperCase();
            e.apellido_materno = e.apellido_materno.toUpperCase();
        });
        empleados.sort((a, b) => a.nombres.localeCompare(b.nombres));
        listaGlobalEmpleados = empleados;

        const resAsis = await fetch('/asistencias/monitor');
        let todasAsistencias = await resAsis.json();
        const hoy = new Date().toISOString().split('T')[0];
        asistenciasHoy = todasAsistencias.filter(a => a.fecha === hoy);

        // Llenar filtro de horarios de salida
        if (modoActual === 'salida') {
            const filtro = document.getElementById('filtro_horario_salida');
            filtro.innerHTML = '<option value="">Todos los horarios</option>';
            const horarios = [...new Set(empleados.map(e => e.hora_salida_turno.substring(0,5)))].sort();
            horarios.forEach(h => filtro.innerHTML += `<option value="${h}">Salida a las ${h}</option>`);
        }

        renderizarLista(empleados);
    } catch (error) { console.error(error); }
}

function renderizarLista(empleados) {
    const contenedor = document.getElementById('lista-empleados');
    contenedor.innerHTML = '';
    const ahora = new Date();
    const tiempoReal = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

    empleados.forEach(emp => {
        const nombreCompleto = [emp.nombres, emp.apellido_paterno, emp.apellido_materno].filter(Boolean).join(' ');
        const foto = emp.foto_perfil || 'https://via.placeholder.com/70x70.png?text=Foto';
        
        const registroHoy = asistenciasHoy.find(a => a.dni === emp.dni);
        const yaMarcoEntrada = registroHoy && registroHoy.hora_entrada && registroHoy.hora_entrada !== '--:--';
        
        let selectHTML = ''; let btnHTML = ''; let inputHoraHTML = '';

        if (modoActual === 'entrada') {
            const [hTurno, mTurno] = emp.hora_entrada_turno.split(':').map(Number);
            const horaInicioMarcacion = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hTurno, mTurno, 0);
            horaInicioMarcacion.setMinutes(horaInicioMarcacion.getMinutes() - 10); 
            const [hSal, mSal] = emp.hora_salida_turno.split(':').map(Number);
            const horaFinTurno = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hSal, mSal, 0);

            if (yaMarcoEntrada) {
                selectHTML = `<select id="estado_${emp.dni}" disabled><option value="${registroHoy.estado}">${registroHoy.estado}</option></select>`;
                inputHoraHTML = `<input type="time" id="hora_${emp.dni}" value="${registroHoy.hora_entrada}" disabled style="font-weight:bold; color:#7f8c8d; background-color:#ecf0f1; border:1px solid #ddd; width: 95px;">`;
                btnHTML = `
                    <button id="btn-mod_${emp.dni}" class="btn-accion btn-editar" style="margin-right:5px; padding:6px 10px;" onclick="solicitarModificacion('${emp.dni}')">Modificar</button>
                    <button class="btn-marcar" disabled style="background:#bdc3c7; color:#fff; cursor:not-allowed;">Marcado</button>`;
            } else if (ahora < horaInicioMarcacion || ahora > horaFinTurno) {
                selectHTML = `<select id="estado_${emp.dni}" disabled><option value="Falta">Falta</option></select>`;
                inputHoraHTML = `<input type="time" id="hora_${emp.dni}" value="--:--" disabled style="font-weight:bold; color:#7f8c8d; background-color:#ecf0f1; border:1px solid #ddd; width: 95px;">`;
                btnHTML = `<button class="btn-marcar" disabled style="background:#bdc3c7; color:#fff; cursor:not-allowed;">Bloqueado</button>`;
            } else {
                selectHTML = `<select id="estado_${emp.dni}"></select>`;
                inputHoraHTML = `<input type="time" id="hora_${emp.dni}" value="${tiempoReal}" class="reloj-vivo" readonly tabindex="-1" style="font-weight:bold; color:#2c3e50; background-color:#f4f7f6; border:1px solid #ddd; pointer-events:none; width: 95px;">`;
                btnHTML = `<button class="btn-marcar" id="btn-marcar_${emp.dni}" onclick="enviarRegistroLista('${emp.dni}')">Marcar</button>`;
            }
        } else {
            // SALIDA: Regla de bloqueo estricto si aún no es la hora
            const yaMarcoSalida = registroHoy && registroHoy.hora_salida && registroHoy.hora_salida !== '--:--';
            const [hSal, mSal] = emp.hora_salida_turno.split(':').map(Number);
            const horaFinTurno = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hSal, mSal, 0);

            if(yaMarcoSalida) {
                inputHoraHTML = `<input type="time" id="hora_salida_${emp.dni}" value="${registroHoy.hora_salida}" disabled style="font-weight:bold; color:#7f8c8d; background-color:#ecf0f1; border:1px solid #ddd; width: 95px;">`;
                btnHTML = `<button class="btn-marcar" disabled style="background:#bdc3c7; color:#fff; cursor:not-allowed;">Marcado</button>`;
            } else if (ahora < horaFinTurno) {
                // Aún no es su hora de salida -> Bloqueo
                inputHoraHTML = `<input type="time" id="hora_${emp.dni}" value="--:--" disabled style="font-weight:bold; color:#7f8c8d; background-color:#ecf0f1; border:1px solid #ddd; width: 95px;">`;
                btnHTML = `<button class="btn-marcar" disabled style="background:#f39c12; color:#fff; cursor:not-allowed;" title="Aún no es hora de salida">En Turno</button>`;
            } else {
                inputHoraHTML = `<input type="time" id="hora_${emp.dni}" value="${tiempoReal}" class="reloj-vivo" onfocus="this.classList.remove('reloj-vivo')" onchange="this.classList.remove('reloj-vivo')" style="font-weight:bold; color:#2c3e50; background-color:#fff; border:1px solid #95a5a6; cursor:pointer; width: 95px;">`;
                btnHTML = `<button class="btn-marcar salida" onclick="enviarRegistroLista('${emp.dni}')">Salir</button>`;
            }
        }

        contenedor.innerHTML += `
            <div class="tarjeta-empleado">
                <div class="perfil-info">
                    <img src="${foto}" alt="Perfil">
                    <div class="datos-texto"><h4>${nombreCompleto}</h4><p>DNI: ${emp.dni}</p></div>
                </div>
                <div class="controles-tarjeta">
                    ${selectHTML}
                    <div class="acciones-rapidas">${inputHoraHTML} ${btnHTML}</div>
                </div>
            </div>`;
            
        if(modoActual === 'entrada' && !yaMarcoEntrada && selectHTML.includes('id="estado_')) {
            evaluarOpcionesEstado(emp.dni, emp.hora_entrada_turno);
        }
    });
}

function filtrarLista() {
    const texto = document.getElementById('busqueda_rapida').value.toLowerCase();
    let filtrados = listaGlobalEmpleados;
    
    if (modoActual === 'salida') {
        const filtroHr = document.getElementById('filtro_horario_salida').value;
        if (filtroHr) filtrados = filtrados.filter(emp => emp.hora_salida_turno.substring(0,5) === filtroHr);
    }

    filtrados = filtrados.filter(emp => {
        const nombreCompleto = `${emp.nombres} ${emp.apellido_paterno} ${emp.apellido_materno}`.toLowerCase();
        return nombreCompleto.includes(texto) || emp.dni.includes(texto);
    });
    renderizarLista(filtrados);
}

async function enviarRegistroLista(dni, isModificacion = false) {
    const hora = document.getElementById(`hora_${dni}`).value;
    let endpoint = (modoActual === 'entrada') ? '/entrada' : '/salida';
    if (isModificacion) endpoint = '/asistencias/modificar_entrada';

    let cuerpo = { dni: dni };
    if (modoActual === 'entrada') { cuerpo.hora_llegada = `${hora}:00`; cuerpo.estado = document.getElementById(`estado_${dni}`).value; } 
    else { cuerpo.hora_salida = `${hora}:00`; }

    try {
        const response = await fetch(endpoint, { method: isModificacion ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
        if (response.ok) {
            mostrarNotificacion(isModificacion ? "Modificación Guardada con Éxito" : "Registro completado", 'success');
            setTimeout(cargarListaEmpleados, 400); 
        } else { const res = await response.json(); mostrarNotificacion(res.detail, 'error'); }
    } catch (error) { mostrarNotificacion("Error de red.", "error"); }
}

function solicitarModificacion(dni) {
    pedirAutorizacion(() => {
        const inputHora = document.getElementById(`hora_${dni}`);
        const selectEstado = document.getElementById(`estado_${dni}`);
        const btnMod = document.getElementById(`btn-mod_${dni}`);
        const emp = listaGlobalEmpleados.find(e => e.dni === dni);
        
        inputHora.disabled = false; inputHora.style.backgroundColor = "#ffffff"; inputHora.style.pointerEvents = "auto";
        selectEstado.disabled = false;
        
        btnMod.innerText = "Guardar"; btnMod.style.background = "#27ae60";
        btnMod.setAttribute("onclick", `enviarRegistroLista('${dni}', true)`);
        
        inputHora.addEventListener('input', () => evaluarOpcionesEstado(dni, emp.hora_entrada_turno));
        evaluarOpcionesEstado(dni, emp.hora_entrada_turno);
    });
}

// --- RELOJ EN VIVO Y RECORDATORIOS (5 MINUTOS) ---
let recordatoriosMostrados = new Set();

setInterval(() => {
    const ahora = new Date();
    const h = String(ahora.getHours()).padStart(2, '0');
    const m = String(ahora.getMinutes()).padStart(2, '0');
    const tiempoReal = `${h}:${m}`;
    
    // 1. Reloj de marcación
    document.querySelectorAll('.reloj-vivo').forEach(input => { 
        if (input.value !== tiempoReal) {
            input.value = tiempoReal;
            const dni = input.id.split('_')[1];
            const emp = listaGlobalEmpleados.find(e => e.dni === dni);
            if (emp && modoActual === 'entrada') evaluarOpcionesEstado(dni, emp.hora_entrada_turno);
            if (emp && modoActual === 'salida') renderizarLista(listaGlobalEmpleados); // Re-renderiza para desbloquear boton si ya es hora
        }
    });

    // 2. Lógica de Alertas de Salida 5 Minutos antes
    ahora.setMinutes(ahora.getMinutes() + 5);
    const targetHora = String(ahora.getHours()).padStart(2, '0');
    const targetMin = String(ahora.getMinutes()).padStart(2, '0');
    const targetTime = `${targetHora}:${targetMin}`;

    const empSalenPronto = listaGlobalEmpleados.filter(e => e.hora_salida_turno.substring(0,5) === targetTime);
    if (empSalenPronto.length > 0 && !recordatoriosMostrados.has(targetTime)) {
        recordatoriosMostrados.add(targetTime);
        document.getElementById('texto-recordatorio').innerText = `En 5 minutos (${targetTime}) finalizará el turno de ${empSalenPronto.length} empleado(s). Prepárese para registrar las salidas.`;
        document.getElementById('modal-recordatorio').classList.remove('hidden');
    }

}, 1000);

// --- GESTIÓN DE PERSONAL ---
function abrirModalEmpleado() {
    document.getElementById('form-titulo').innerText = 'Registrar Nuevo Empleado';
    document.getElementById('reg_dni').value = ''; document.getElementById('reg_dni').disabled = false; document.getElementById('reg_dni').style.backgroundColor = "white";
    document.getElementById('reg_nombres').value = ''; document.getElementById('reg_ap_paterno').value = ''; document.getElementById('reg_ap_materno').value = '';
    document.getElementById('reg_correo').value = ''; document.getElementById('reg_celular').value = ''; document.getElementById('reg_emergencia').value = '';
    document.getElementById('reg_entrada').value = '08:00'; document.getElementById('reg_salida').value = '18:00';
    fotoBase64Global = null; document.getElementById('reg_foto').value = '';
    const box = document.getElementById('foto-preview-box'); box.style.backgroundImage = 'none'; box.querySelector('.foto-plus').style.display = 'block';
    document.getElementById('btn-guardar-nuevo').classList.remove('hidden'); document.getElementById('controles-edicion').classList.add('hidden');
    document.getElementById('modal-empleado').classList.remove('hidden');
}
function cerrarModalEmpleado() { document.getElementById('modal-empleado').classList.add('hidden'); }

function prepararEdicion(dni) {
    pedirAutorizacion(() => {
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
        if (empleado.foto_perfil) { fotoBase64Global = empleado.foto_perfil; box.style.backgroundImage = `url('${fotoBase64Global}')`; box.querySelector('.foto-plus').style.display = 'none'; }
        document.getElementById('btn-guardar-nuevo').classList.add('hidden'); document.getElementById('controles-edicion').classList.remove('hidden');
    });
}

function validarFormularioEmpleado(datos) {
    if (!datos.dni || !datos.nombres || !datos.ap_paterno || !datos.ap_materno || !datos.correo || !datos.celular || !datos.emergencia) {
        mostrarNotificacion("Todos los campos de texto son obligatorios.", "error"); return false;
    }
    if (datos.dni.length !== 8) { mostrarNotificacion("El DNI debe tener 8 dígitos.", "error"); return false; }
    if (datos.celular.length !== 9 || datos.emergencia.length !== 9) { mostrarNotificacion("Los números telefónicos deben tener 9 dígitos.", "error"); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) { mostrarNotificacion("Ingrese un correo válido.", "error"); return false; }
    return true;
}

async function guardarNuevoEmpleado() {
    const datos = { dni: document.getElementById('reg_dni').value.trim(), nombres: document.getElementById('reg_nombres').value.trim(), ap_paterno: document.getElementById('reg_ap_paterno').value.trim(), ap_materno: document.getElementById('reg_ap_materno').value.trim(), correo: document.getElementById('reg_correo').value.trim(), celular: document.getElementById('reg_celular').value.trim(), emergencia: document.getElementById('reg_emergencia').value.trim() };
    const entrada = document.getElementById('reg_entrada').value; const salida = document.getElementById('reg_salida').value;
    if (!validarFormularioEmpleado(datos)) return;
    try {
        const response = await fetch('/empleados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dni: datos.dni, nombres: datos.nombres, apellido_paterno: datos.ap_paterno, apellido_materno: datos.ap_materno, correo: datos.correo, celular: datos.celular, contacto_emergencia: datos.emergencia, hora_entrada_turno: `${entrada}:00`, hora_salida_turno: `${salida}:00`, foto_perfil: fotoBase64Global }) });
        if (response.ok) { mostrarNotificacion("Empleado registrado.", "success"); cerrarModalEmpleado(); cargarTablaGestion(); } else { const res = await response.json(); mostrarNotificacion(res.detail, "error"); }
    } catch (error) { mostrarNotificacion("Error de red.", "error"); }
}

async function enviarEdicion() {
    const datos = { dni: document.getElementById('reg_dni').value.trim(), nombres: document.getElementById('reg_nombres').value.trim(), ap_paterno: document.getElementById('reg_ap_paterno').value.trim(), ap_materno: document.getElementById('reg_ap_materno').value.trim(), correo: document.getElementById('reg_correo').value.trim(), celular: document.getElementById('reg_celular').value.trim(), emergencia: document.getElementById('reg_emergencia').value.trim() };
    const entrada = document.getElementById('reg_entrada').value; const salida = document.getElementById('reg_salida').value;
    if (!validarFormularioEmpleado(datos)) return;
    try {
        const response = await fetch(`/empleados/${datos.dni}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombres: datos.nombres, apellido_paterno: datos.ap_paterno, apellido_materno: datos.ap_materno, correo: datos.correo, celular: datos.celular, contacto_emergencia: datos.emergencia, hora_entrada_turno: `${entrada}:00`, hora_salida_turno: `${salida}:00`, foto_perfil: fotoBase64Global }) });
        if (response.ok) { mostrarNotificacion("Empleado actualizado.", "success"); cerrarModalEmpleado(); cargarTablaGestion(); } else { const res = await response.json(); mostrarNotificacion(res.detail, "error"); }
    } catch (error) { mostrarNotificacion("Error de red.", "error"); }
}

function previsualizarFoto(event) {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) return mostrarNotificacion("La imagen supera los 2 MB.", "error"), event.target.value = '';
    const reader = new FileReader(); reader.onload = function(e) { fotoBase64Global = e.target.result; const box = document.getElementById('foto-preview-box'); box.style.backgroundImage = `url('${fotoBase64Global}')`; box.querySelector('.foto-plus').style.display = 'none'; }; reader.readAsDataURL(file);
}

function darDeBaja(dni) {
    pedirAutorizacion(() => {
        dniParaBaja = dni; document.getElementById('baja-dni').innerText = dni; document.getElementById('baja-motivo').value = ''; document.getElementById('modal-baja').classList.remove('hidden');
    });
}
function cerrarModalBaja() { document.getElementById('modal-baja').classList.add('hidden'); dniParaBaja = ''; }
async function ejecutarBaja() {
    const motivo = document.getElementById('baja-motivo').value.trim(); if (!motivo) return mostrarNotificacion("Escribe una justificación.", "error");
    try { const response = await fetch(`/empleados/${dniParaBaja}/baja`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }) });
        if (response.ok) { mostrarNotificacion("Baja procesada.", "success"); cerrarModalBaja(); cargarTablaGestion(); } else { const res = await response.json(); mostrarNotificacion(res.detail, "error"); }
    } catch (error) { mostrarNotificacion("Error de red.", "error"); }
}
function verJustificacion(motivo) { document.getElementById('texto-justificacion').innerText = motivo; document.getElementById('modal-justificacion').classList.remove('hidden'); }

// --- TABLAS DE GESTIÓN (NUEVAS COLUMNAS COMBINADAS) ---
function cambiarPestanaGestion(pestana) {
    vistaGestionActual = pestana;
    document.getElementById('tab-activos').classList.remove('active'); document.getElementById('tab-todos').classList.remove('active');
    document.getElementById(`tab-${pestana}`).classList.add('active'); document.getElementById('busqueda_gestion').value = '';
    const cabeceraTabla = document.querySelector('#tabla-empleados-head'); 
    
    // Aquí agregamos la columna de Contacto que agrupa los 3 nuevos datos
    if (pestana === 'activos') {
        cabeceraTabla.innerHTML = `<tr><th>DNI</th><th>Nombres y Apellidos</th><th>Datos de Contacto</th><th>Horario Laboral</th><th style="text-align: center;">Asistencia</th><th>Acciones</th></tr>`;
        cargarTablaGestion();
    } else {
        cabeceraTabla.innerHTML = `<tr><th>DNI</th><th>Nombres y Apellidos</th><th>Datos de Contacto</th><th style="text-align: center;">Estado</th><th style="text-align: center;">Justificación</th></tr>`;
        cargarTablaTodos();
    }
}

function renderizarTablaGestion(empleados) {
    const tbody = document.getElementById('tabla-empleados-body'); tbody.innerHTML = '';
    empleados.forEach(emp => {
        const tr = document.createElement('tr'); 
        const nombreCompleto = [emp.nombres, emp.apellido_paterno, emp.apellido_materno].filter(Boolean).join(' ').toUpperCase();
        
        // Columna agrupada de datos de contacto
        const contactoInfo = `
            <span style="display:block; font-size: 12px; color: #34495e;">📱 ${emp.celular || '-'}</span>
            <span style="display:block; font-size: 12px; color: #34495e;">✉️ ${emp.correo || '-'}</span>
            <span style="display:block; font-size: 12px; color: #c0392b;">🆘 ${emp.contacto_emergencia || '-'}</span>
        `;

        if (vistaGestionActual === 'activos') {
            tr.innerHTML = `<td><strong>${emp.dni}</strong></td><td>${nombreCompleto}</td><td>${contactoInfo}</td><td>${emp.hora_entrada_turno.substring(0,5)} - ${emp.hora_salida_turno.substring(0,5)}</td>
                <td style="text-align: center;"><button class="btn-historial" onclick="verHistorialIndividual('${emp.dni}', '${nombreCompleto}')" title="Ver Historial">📋</button></td>
                <td><button class="btn-accion btn-editar" onclick="prepararEdicion('${emp.dni}')">Editar</button><button class="btn-accion btn-baja" onclick="darDeBaja('${emp.dni}')">Baja</button></td>`;
        } else {
            const estadoBadge = emp.activo ? '<span style="background:#27ae60; color:white; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">ACTIVO</span>' : '<span style="background:#c0392b; color:white; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">INACTIVO</span>';
            const btnJustificacion = emp.activo ? '<span style="color:#95a5a6; font-style:italic;">N/A</span>' : `<button class="btn-accion" style="background:#f39c12; color:white; border-radius:15px;" onclick="verJustificacion('${emp.motivo_baja}')">Ver Detalles</button>`;
            if(!emp.activo) tr.style.backgroundColor = "#fdf2f2"; 
            tr.innerHTML = `<td><strong>${emp.dni}</strong></td><td>${nombreCompleto}</td><td>${contactoInfo}</td><td style="text-align: center;">${estadoBadge}</td><td style="text-align: center;">${btnJustificacion}</td>`;
        }
        tbody.appendChild(tr);
    });
}

async function cargarTablaGestion() { try { const response = await fetch('/empleados'); let empleados = await response.json(); empleados.sort((a,b) => a.nombres.localeCompare(b.nombres)); listaGestionGlobal = empleados; renderizarTablaGestion(empleados); } catch (e) { console.error(e); } }
async function cargarTablaTodos() { try { const response = await fetch('/empleados/todos'); let empleados = await response.json(); empleados.sort((a,b) => a.nombres.localeCompare(b.nombres)); listaGestionGlobal = empleados; renderizarTablaGestion(empleados); } catch (e) { console.error(e); } }
function filtrarTablaGestion() { const texto = document.getElementById('busqueda_gestion').value.toLowerCase(); renderizarTablaGestion(listaGestionGlobal.filter(emp => `${emp.nombres} ${emp.apellido_paterno} ${emp.apellido_materno}`.toLowerCase().includes(texto) || emp.dni.includes(texto))); }

// --- HISTORIAL INDIVIDUAL ---
function cerrarModalHistorial() { document.getElementById('modal-historial-empleado').classList.add('hidden'); }
async function verHistorialIndividual(dni, nombre) {
    document.getElementById('historial-nombre-empleado').innerText = "Historial: " + nombre;
    const tbody = document.getElementById('tabla-historial-individual-body'); tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Cargando...</td></tr>';
    document.getElementById('modal-historial-empleado').classList.remove('hidden');
    try {
        const response = await fetch('/asistencias/monitor'); let asistencias = await response.json();
        const historial = asistencias.filter(a => a.dni === dni); tbody.innerHTML = '';
        if (historial.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Sin registros.</td></tr>'; return; }
        historial.forEach(asis => {
            const tr = document.createElement('tr');
            let estadoBadge = ''; let estadoUpper = asis.estado.toUpperCase();
            if (estadoUpper === 'ASISTENCIA') estadoBadge = '<span style="color:#27ae60; font-weight:bold;">Asistió</span>';
            else if (estadoUpper === 'TARDANZA') estadoBadge = '<span style="color:#f39c12; font-weight:bold;">Tardanza</span>';
            else if (estadoUpper === 'FALTA') estadoBadge = '<span style="color:#c0392b; font-weight:bold;">Faltó</span>';
            else estadoBadge = asis.estado;
            tr.innerHTML = `<td style="text-align: center;">${asis.fecha}</td><td style="text-align: center; font-weight:bold;">${asis.hora_entrada}</td><td style="text-align: center; font-weight:bold;">${asis.hora_salida}</td><td style="text-align: center;">${estadoBadge}</td><td style="text-align: center; color: #2980b9; font-weight: bold;">${asis.horas_extra}</td>`;
            tbody.appendChild(tr);
        });
    } catch (error) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #c0392b;">Error.</td></tr>'; }
}

// --- MONITOR GENERAL ---
async function cargarTablaMonitor() { try { const response = await fetch('/asistencias/monitor'); listaMonitorGlobal = await response.json(); filtrarTablaMonitor(); } catch (e) { mostrarNotificacion("Error", "error"); } }
function limpiarFiltroMonitor() { document.getElementById('filtro-fecha-monitor').value = ''; document.getElementById('busqueda_monitor').value = ''; filtrarTablaMonitor(); }
function filtrarTablaMonitor() { const texto = document.getElementById('busqueda_monitor').value.toLowerCase(); const fecha = document.getElementById('filtro-fecha-monitor').value; renderizarTablaMonitor(listaMonitorGlobal.filter(asis => (asis.nombre_completo.toLowerCase().includes(texto) || asis.dni.includes(texto)) && (fecha ? asis.fecha === fecha : true))); }
function renderizarTablaMonitor(asistencias) {
    const tbody = document.getElementById('tabla-monitor-body'); tbody.innerHTML = '';
    let contAsistencias = 0, contTardanzas = 0, contFaltas = 0;
    asistencias.forEach(asis => {
        if (asis.estado === 'Asistencia') contAsistencias++; if (asis.estado === 'Tardanza') contTardanzas++; if (asis.estado === 'Falta') contFaltas++;
        const tr = document.createElement('tr');
        let estadoBadge = asis.estado === 'Asistencia' ? '<span style="background:#27ae60; color:white; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">ASISTENCIA</span>' : (asis.estado === 'Tardanza' ? '<span style="background:#f39c12; color:white; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">TARDANZA</span>' : '<span style="background:#c0392b; color:white; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">FALTA</span>');
        tr.innerHTML = `<td><strong>${asis.dni}</strong></td><td>${asis.nombre_completo.toUpperCase()}</td><td>${asis.fecha}</td><td style="text-align: center; font-weight:bold;">${asis.hora_entrada}</td><td style="text-align: center; font-weight:bold;">${asis.hora_salida}</td><td style="text-align: center;">${asis.minutos_tardanza > 0 ? asis.minutos_tardanza + ' min' : '-'}</td><td style="text-align: center; font-weight:bold; color:#2980b9;">${asis.horas_extra}</td><td style="text-align: center;">${estadoBadge}</td>`;
        tbody.appendChild(tr);
    });
    document.getElementById('kpi-asistencias').innerText = contAsistencias; document.getElementById('kpi-tardanzas').innerText = contTardanzas; document.getElementById('kpi-faltas').innerText = contFaltas;
}