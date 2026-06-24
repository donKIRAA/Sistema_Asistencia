let modoActual = 'entrada'; let listaGlobalEmpleados = []; let vistaGestionActual = 'activos';
let listaGestionGlobal = []; let dniParaBaja = ''; let listaMonitorGlobal = []; let listaMonitorActual = [];
let asistenciasHoy = []; let fotoBase64Global = null; let notificacionesGlobales = [];
let chartTendenciaInstance = null; let chartDistribucionInstance = null;

function mostrarFecha() {
    const el = document.getElementById('realTimeClock');
    if (el) el.textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
mostrarFecha();

let accionAutorizadaPendiente = null;
function pedirAutorizacion(callback) { accionAutorizadaPendiente = callback; document.getElementById('auth_user').value = ''; document.getElementById('auth_pass').value = ''; document.getElementById('modal-autorizacion').classList.remove('hidden'); }
function cerrarModalAutorizacion() { document.getElementById('modal-autorizacion').classList.add('hidden'); accionAutorizadaPendiente = null; }
async function verificarAutorizacion() {
    const user = document.getElementById('auth_user').value; const pass = document.getElementById('auth_pass').value;
    try {
        const res = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) });
        if (res.ok) { mostrarNotificacion("Autorización Concedida"); if(accionAutorizadaPendiente) accionAutorizadaPendiente(); cerrarModalAutorizacion(); } else { mostrarNotificacion("Credenciales incorrectas", "error"); }
    } catch (e) { mostrarNotificacion("Error de red", "error"); }
}

function mostrarNotificacion(msj, tipo = 'success') {
    const container = document.getElementById('toast-container'); const toast = document.createElement('div');
    toast.className = `toast ${tipo}`; toast.innerHTML = `<span>${msj}</span><span style="cursor:pointer; margin-left:15px; font-weight:bold;" onclick="this.parentElement.remove()">×</span>`;
    container.appendChild(toast); setTimeout(() => { toast.classList.add('fadeOut'); setTimeout(() => toast.remove(), 300); }, 3500);
}

function mostrarConfirmacion(msj, cb) {
    const m = document.getElementById('modal-confirmacion'); document.getElementById('modal-mensaje').innerText = msj; m.classList.remove('hidden');
    const btnA = document.getElementById('btn-modal-aceptar'); const btnC = document.getElementById('btn-modal-cancelar');
    const nBtnA = btnA.cloneNode(true); const nBtnC = btnC.cloneNode(true); btnA.parentNode.replaceChild(nBtnA, btnA); btnC.parentNode.replaceChild(nBtnC, btnC);
    nBtnC.addEventListener('click', () => m.classList.add('hidden')); nBtnA.addEventListener('click', () => { m.classList.add('hidden'); cb(); });
}

async function iniciarSesion() {
    const u = document.getElementById('login_user').value; const p = document.getElementById('login_pass').value;
    if (!u || !p) return mostrarNotificacion("Complete los campos", "error");
    try {
        const res = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
        if (res.ok) { document.getElementById('pantalla-login').style.display = 'none'; document.getElementById('dashboard').style.display = 'flex'; cargarListaEmpleados(); } else { mostrarNotificacion("Acceso incorrecto", "error"); }
    } catch (e) { mostrarNotificacion("Error de red", "error"); }
}
function cerrarSesion() { mostrarConfirmacion("¿Desea salir?", () => { document.getElementById('dashboard').style.display = 'none'; document.getElementById('pantalla-login').style.display = 'flex'; }); }

function mostrarPantalla(modo) {
    modoActual = modo;
    document.getElementById('seccion-asistencia').classList.add('hidden'); document.getElementById('seccion-gestion').classList.add('hidden'); document.getElementById('seccion-monitor').classList.add('hidden'); document.getElementById('seccion-notificaciones').classList.add('hidden'); document.getElementById('seccion-analitica').classList.add('hidden');
    if (modo === 'gestion') { document.getElementById('seccion-gestion').classList.remove('hidden'); cambiarPestanaGestion('activos'); }
    else if (modo === 'monitor') { document.getElementById('seccion-monitor').classList.remove('hidden'); document.getElementById('filtro-fecha-monitor').value = new Date().toISOString().split('T')[0]; cargarTablaMonitor(); }
    else if (modo === 'notificaciones') { document.getElementById('seccion-notificaciones').classList.remove('hidden'); marcarNotificacionesLeidas(); }
    else if (modo === 'analitica') { document.getElementById('seccion-analitica').classList.remove('hidden'); cargarAnaliticas(); }
    else {
        document.getElementById('seccion-asistencia').classList.remove('hidden'); document.getElementById('titulo-pantalla').innerText = `Registro de ${modo === 'entrada' ? 'Entrada' : 'Salida'}`;
        const fS = document.getElementById('filtro_horario_salida'); if (modo === 'salida') fS.classList.remove('hidden'); else fS.classList.add('hidden');
        cargarListaEmpleados();
    }
}

function descargarReporteMensual() {
    const periodo = document.getElementById('mes-reporte').value;
    if (!periodo) return mostrarNotificacion("Por favor, seleccione un mes válido.", "error");
    
    const enlaceOculto = document.createElement('a');
    enlaceOculto.href = `/reporte/mensual/${periodo}`;
    enlaceOculto.style.display = 'none';
    document.body.appendChild(enlaceOculto);
    enlaceOculto.click();
    document.body.removeChild(enlaceOculto);
    
    mostrarNotificacion(`Descargando reporte de ${periodo}...`, "info");
}

async function cargarAnaliticas() {
    try {
        const res = await fetch('/analitica/datos'); if (!res.ok) return;
        const datos = await res.json(); const tbody = document.getElementById('tabla-top-infractores'); tbody.innerHTML = '';
        if (datos.top_infractores.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#7f8c8d;">Sin infractores.</td></tr>'; }
        else { datos.top_infractores.forEach(i => { tbody.innerHTML += `<tr><td><strong>${i.dni}</strong></td><td>${i.nombre}</td><td style="text-align:center; color:#e67e22; font-weight:bold;">${i.minutos} min</td></tr>`; }); }
        if (chartTendenciaInstance) chartTendenciaInstance.destroy();
        chartTendenciaInstance = new Chart(document.getElementById('chart-tendencia').getContext('2d'), { type: 'bar', data: { labels: datos.tendencia.dias, datasets: [{ label: 'Asistencias', data: datos.tendencia.asistencias, backgroundColor: '#27ae60' }, { label: 'Tardanzas', data: datos.tendencia.tardanzas, backgroundColor: '#f39c12' }, { label: 'Faltas', data: datos.tendencia.faltas, backgroundColor: '#c0392b' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } } });
        if (chartDistribucionInstance) chartDistribucionInstance.destroy();
        chartDistribucionInstance = new Chart(document.getElementById('chart-distribucion').getContext('2d'), { type: 'doughnut', data: { labels: ['Asistencias', 'Tardanzas', 'Faltas', 'Justificadas'], datasets: [{ data: datos.distribucion, backgroundColor: ['#27ae60', '#f39c12', '#c0392b', '#8e44ad'] }] }, options: { responsive: true, maintainAspectRatio: false } });
    } catch (e) { console.error(e); }
}

async function cargarNotificaciones() {
    try {
        const res = await fetch('/notificaciones'); notificacionesGlobales = await res.json();
        const noLeidas = notificacionesGlobales.filter(n => !n.leida).length; const badge = document.getElementById('badge-notif');
        if (noLeidas > 0) { badge.innerText = noLeidas; badge.style.display = 'inline-block'; } else { badge.style.display = 'none'; }
        renderizarNotificaciones();
    } catch (e) { console.error(e); }
}

function renderizarNotificaciones() {
    const contenedor = document.getElementById('lista-notificaciones');
    if (notificacionesGlobales.length === 0) { contenedor.innerHTML = '<p style="color:#7f8c8d; text-align:center;">Sin alertas.</p>'; return; }
    contenedor.innerHTML = notificacionesGlobales.map(n => {
        let colorBorde = n.tipo === 'exito' ? '#27ae60' : (n.tipo === 'alerta' ? '#e74c3c' : '#3498db');
        return `<div style="border-left: 4px solid ${colorBorde}; background: ${n.leida ? '#ffffff' : '#f4f9f9'}; padding: 15px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><div style="font-size: 11px; color: #95a5a6; margin-bottom: 5px;">${n.fecha}</div><div style="font-size: 14px; color: #2c3e50; font-weight: ${n.leida ? 'normal' : 'bold'};">${n.mensaje}</div></div>`;
    }).join('');
}
async function marcarNotificacionesLeidas() { await fetch('/notificaciones/leer', { method: 'PUT' }); document.getElementById('badge-notif').style.display = 'none'; notificacionesGlobales.forEach(n => n.leida = true); renderizarNotificaciones(); }

function evaluarOpcionesEstado(dni, horaTurnoStr) {
    const inputHora = document.getElementById(`copy_hora_${dni}`) || document.getElementById(`hora_${dni}`); const selectEstado = document.getElementById(`estado_${dni}`);
    if (!inputHora || !selectEstado) return; const [hT, mT] = horaTurnoStr.split(':').map(Number); const [hI, mI] = inputHora.value.split(':').map(Number);
    const diff = ((new Date().setHours(hI, mI, 0)) - (new Date().setHours(hT, mT, 0))) / (1000 * 60); const valAnterior = selectEstado.value; selectEstado.innerHTML = '';
    if (diff >= -10 && diff <= 10) selectEstado.innerHTML += `<option value="Asistencia">Asistencia</option>`; else selectEstado.innerHTML += `<option value="Asistencia" disabled style="color:#ccc;">Asistencia (Bloqueada)</option>`;
    selectEstado.innerHTML += `<option value="Tardanza">Tardanza</option><option value="Falta">Falta</option>`; selectEstado.value = selectEstado.querySelector(`option[value="${valAnterior}"]:not([disabled])`) ? valAnterior : (diff > 10 ? 'Tardanza' : 'Falta');
}

async function cargarListaEmpleados() {
    try {
        const rE = await fetch('/empleados'); let empleados = await rE.json(); empleados.sort((a,b) => a.nombres.localeCompare(b.nombres)); listaGlobalEmpleados = empleados;
        const rA = await fetch('/asistencias/monitor'); let tA = await rA.json(); asistenciasHoy = tA.filter(a => a.fecha === new Date().toISOString().split('T')[0]);
        if (modoActual === 'salida') { const f = document.getElementById('filtro_horario_salida'); f.innerHTML = '<option value="">Todos los horarios</option>'; [...new Set(empleados.map(e => e.hora_salida_turno.substring(0,5)))].sort().forEach(h => f.innerHTML += `<option value="${h}">Salida ${h}</option>`); }
        renderizarLista(empleados);
    } catch (e) { console.error(e); }
}

function renderizarLista(empleados) {
    const contenedor = document.getElementById('lista-empleados'); contenedor.innerHTML = ''; const ahora = new Date(); const tReal = `${String(ahora.getHours()).padStart(2,'0')}:${String(ahora.getMinutes()).padStart(2,'0')}`;
    empleados.forEach(emp => {
        const nombre = `${emp.nombres} ${emp.apellido_paterno}`; const foto = emp.foto_perfil || 'https://via.placeholder.com/70'; const reg = asistenciasHoy.find(a => a.dni === emp.dni); const yaEntrada = reg && reg.hora_entrada && reg.hora_entrada !== '--:--';
        let selHTML = '', btnHTML = '', inputHTML = '';
        if (modoActual === 'entrada') {
            if (yaEntrada) { selHTML = `<select id="estado_${emp.dni}" disabled><option>${reg.estado}</option></select>`; inputHTML = `<input type="time" id="hora_${emp.dni}" value="${reg.hora_entrada}" disabled style="background:#ecf0f1; width:95px;">`; btnHTML = `<button class="btn-accion btn-editar" onclick="solicitarModificacion('${emp.dni}')">Modificar</button>`; }
            else { selHTML = `<select id="estado_${emp.dni}"></select>`; inputHTML = `<input type="time" id="hora_${emp.dni}" value="${tReal}" class="reloj-vivo" readonly style="pointer-events:none; width:95px;">`; btnHTML = `<button class="btn-marcar" onclick="enviarRegistroLista('${emp.dni}')">Marcar</button>`; }
        } else {
            const yaSalida = reg && reg.hora_salida && reg.hora_salida !== '--:--';
            if (yaSalida) { inputHTML = `<input type="time" value="${reg.hora_salida}" disabled style="background:#ecf0f1; width:95px;">`; btnHTML = `<button class="btn-marcar" disabled style="background:#bdc3c7;">Marcado</button>`; } else { inputHTML = `<input type="time" id="hora_${emp.dni}" value="${tReal}" class="reloj-vivo" style="width:95px;">`; btnHTML = `<button class="btn-marcar" style="background:#e67e22;" onclick="enviarRegistroLista('${emp.dni}')">Salir</button>`; }
        }
        contenedor.innerHTML += `<div class="tarjeta-empleado"><div class="perfil-info"><img src="${foto}"><div class="datos-texto"><h4>${nombre}</h4><p>DNI: ${emp.dni}</p></div></div><div class="controles-tarjeta">${selHTML}<div class="acciones-rapidas">${inputHTML} ${btnHTML}</div></div></div>`;
        if (modoActual === 'entrada' && !yaEntrada) evaluarOpcionesEstado(emp.dni, emp.hora_entrada_turno);
    });
}

function filtrarLista() { const txt = document.getElementById('busqueda_rapida').value.toLowerCase(); let res = listaGlobalEmpleados; if (modoActual === 'salida') { const f = document.getElementById('filtro_horario_salida').value; if(f) res = res.filter(e => e.hora_salida_turno.substring(0,5) === f); } renderizarLista(res.filter(e => `${e.nombres} ${e.apellido_paterno}`.toLowerCase().includes(txt) || e.dni.includes(txt))); }

async function enviarRegistroLista(dni, isMod = false) {
    const h = document.getElementById(`hora_${dni}`).value; let endpoint = modoActual === 'entrada' ? '/entrada' : '/salida'; if (isMod) endpoint = '/asistencias/modificar_entrada'; let body = { dni: dni };
    if (modoActual === 'entrada') { body.hora_llegada = `${h}:00`; body.estado = document.getElementById(`estado_${dni}`).value; } else body.hora_salida = `${h}:00`;
    try { const res = await fetch(endpoint, { method: isMod ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (res.ok) { mostrarNotificacion("Registro completado"); cargarListaEmpleados(); } } catch (e) { mostrarNotificacion("Error de conexión", "error"); }
}

function solicitarModificacion(dni) {
    pedirAutorizacion(() => {
        const input = document.getElementById(`hora_${dni}`); const select = document.getElementById(`estado_${dni}`); const emp = listaGlobalEmpleados.find(e => e.dni === dni);
        input.disabled = false; input.readOnly = false; input.style.pointerEvents = "auto"; input.style.background = "#fff"; select.disabled = false;
        const btn = document.getElementById(`hora_${dni}`).parentElement.querySelector('.btn-editar'); btn.innerText = "Guardar"; btn.style.background = "#27ae60"; btn.setAttribute("onclick", `enviarRegistroLista('${dni}', true)`);
        input.addEventListener('input', () => evaluarOpcionesEstado(dni, emp.hora_entrada_turno)); evaluarOpcionesEstado(dni, emp.hora_entrada_turno);
    });
}

async function cargarTablaMonitor() { const r = await fetch('/asistencias/monitor'); listaMonitorGlobal = await r.json(); filtrarTablaMonitor(); }
function limpiarFiltroMonitor() { document.getElementById('filtro-fecha-monitor').value = ''; document.getElementById('busqueda_monitor').value = ''; filtrarTablaMonitor(); }
function filtrarTablaMonitor() { const t = document.getElementById('busqueda_monitor').value.toLowerCase(); const f = document.getElementById('filtro-fecha-monitor').value; renderizarTablaMonitor(listaMonitorGlobal.filter(a => (a.nombre_completo.toLowerCase().includes(t) || a.dni.includes(t)) && (f ? a.fecha === f : true))); }

function renderizarTablaMonitor(lista) {
    listaMonitorActual = lista; const tbody = document.getElementById('tabla-monitor-body'); tbody.innerHTML = ''; let cA = 0, cT = 0, cF = 0; let total = lista.length;
    lista.forEach(a => {
        let bHTML = '', label = a.estado.toUpperCase();
        if (a.estado === 'Asistencia') { cA++; label = `<span class="badge" style="background:#27ae60;">ASISTENCIA</span>`; }
        else if (a.estado === 'Tardanza') { cT++; label = `<span class="badge" style="background:#f39c12;">TARDANZA</span>`; }
        else if (a.estado === 'Justificada') { cF++; label = `<span class="badge" style="background:#8e44ad;">JUSTIFICADA</span>`; }
        else if (a.estado === 'Sancionada') { cF++; label = `<span class="badge" style="background:#2c3e50;">SANCIONADA</span>`; bHTML = `<div style="margin-top:5px;"><a href="/descargar_documento/${a.dni}/${a.fecha}" download class="btn-accion" style="background:#2980b9; text-decoration:none; padding:4px 8px; font-size:10px; display:inline-block;">📥 Descargar</a></div>`; }
        else { cF++; label = `<span class="badge" style="background:#c0392b;">FALTA</span>`; bHTML = `<div style="display:flex; gap:3px; margin-top:5px;"><button class="btn-accion" style="background:#34495e; font-size:9px; padding:3px 6px;" onclick="abrirModalJustificacion('${a.dni}','${a.fecha}')">+ Cert</button><button class="btn-accion" style="background:#8e44ad; font-size:9px; padding:3px 6px;" onclick="abrirModalFirma('${a.dni}','${a.fecha}')">Firmar</button></div>`; }
        tbody.innerHTML += `<tr><td><strong>${a.dni}</strong></td><td>${a.nombre_completo}</td><td>${a.fecha}</td><td style="text-align:center;">${a.hora_entrada}</td><td style="text-align:center;">${a.hora_salida}</td><td style="text-align:center;">${a.minutos_tardanza}m</td><td style="text-align:center;">${a.horas_extra}</td><td style="text-align:center; display:flex; flex-direction:column; align-items:center;">${label} ${bHTML}</td></tr>`;
    });
    document.getElementById('kpi-asistencias').innerText = `${cA}/${total}`; document.getElementById('kpi-tardanzas').innerText = `${cT}/${total}`; document.getElementById('kpi-faltas').innerText = `${cF}/${total}`;
}

function verDetalleKpi(tipo) {
    document.getElementById('titulo-modal-kpi').innerText = `Detalle de ${tipo}s`; const tbody = document.getElementById('tabla-detalle-kpi-body'); tbody.innerHTML = '';
    let filtrados = [];
    if(tipo === 'Asistencia') filtrados = listaMonitorActual.filter(a => a.estado === 'Asistencia');
    else if(tipo === 'Tardanza') filtrados = listaMonitorActual.filter(a => a.estado === 'Tardanza');
    else filtrados = listaMonitorActual.filter(a => ['Falta', 'Sancionada', 'Justificada'].includes(a.estado));
    if(filtrados.length === 0) { tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#7f8c8d;">No hay registros de este tipo.</td></tr>`; }
    else {
        filtrados.forEach(a => {
            let color = '#27ae60'; if(a.estado === 'Tardanza') color = '#f39c12'; else if(['Falta', 'Sancionada'].includes(a.estado)) color = '#c0392b'; else if(a.estado === 'Justificada') color = '#8e44ad';
            tbody.innerHTML += `<tr><td><strong>${a.dni}</strong></td><td>${a.nombre_completo}</td><td style="text-align:center;"><span class="badge" style="background:${color};">${a.estado.toUpperCase()}</span></td></tr>`;
        });
    }
    document.getElementById('modal-detalle-kpi').classList.remove('hidden');
}
function cerrarModalKpi() { document.getElementById('modal-detalle-kpi').classList.add('hidden'); }

function abrirModalEmpleado() {
    document.getElementById('form-titulo').innerText = 'Registrar Nuevo Empleado'; document.getElementById('reg_dni').value = ''; document.getElementById('reg_dni').disabled = false; document.getElementById('reg_nombres').value = ''; document.getElementById('reg_ap_paterno').value = ''; document.getElementById('reg_ap_materno').value = ''; document.getElementById('reg_correo').value = ''; document.getElementById('reg_celular').value = ''; document.getElementById('reg_emergencia').value = ''; fotoBase64Global = null; document.getElementById('foto-preview-box').style.backgroundImage = 'none'; document.getElementById('btn-guardar-nuevo').classList.remove('hidden'); document.getElementById('controles-edicion').classList.add('hidden'); document.getElementById('modal-empleado').classList.remove('hidden');
}
function cerrarModalEmpleado() { document.getElementById('modal-empleado').classList.add('hidden'); }

function prepararEdicion(dni) {
    pedirAutorizacion(() => {
        const emp = listaGestionGlobal.find(e => e.dni === dni); if (!emp) return; abrirModalEmpleado(); document.getElementById('form-titulo').innerText = 'Editar Empleado'; document.getElementById('reg_dni').value = emp.dni; document.getElementById('reg_dni').disabled = true; document.getElementById('reg_nombres').value = emp.nombres; document.getElementById('reg_ap_paterno').value = emp.apellido_paterno; document.getElementById('reg_ap_materno').value = emp.apellido_materno; document.getElementById('reg_correo').value = emp.correo || ''; document.getElementById('reg_celular').value = emp.celular || ''; document.getElementById('reg_emergencia').value = emp.contacto_emergencia || ''; document.getElementById('reg_entrada').value = emp.hora_entrada_turno.substring(0,5); document.getElementById('reg_salida').value = emp.hora_salida_turno.substring(0,5); if (emp.foto_perfil) { fotoBase64Global = emp.foto_perfil; document.getElementById('foto-preview-box').style.backgroundImage = `url('${fotoBase64Global}')`; } document.getElementById('btn-guardar-nuevo').classList.add('hidden'); document.getElementById('controles-edicion').classList.remove('hidden');
    });
}

async function guardarNuevoEmpleado() { const body = { dni: document.getElementById('reg_dni').value, nombres: document.getElementById('reg_nombres').value, apellido_paterno: document.getElementById('reg_ap_paterno').value, apellido_materno: document.getElementById('reg_ap_materno').value, correo: document.getElementById('reg_correo').value, celular: document.getElementById('reg_celular').value, contacto_emergencia: document.getElementById('reg_emergencia').value, hora_entrada_turno: `${document.getElementById('reg_entrada').value}:00`, hora_salida_turno: `${document.getElementById('reg_salida').value}:00`, foto_perfil: fotoBase64Global }; try { const res = await fetch('/empleados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (res.ok) { mostrarNotificacion("Empleado registrado"); cerrarModalEmpleado(); cambiarPestanaGestion('activos'); } } catch (e) {} }
async function enviarEdicion() { const dni = document.getElementById('reg_dni').value; const body = { nombres: document.getElementById('reg_nombres').value, apellido_paterno: document.getElementById('reg_ap_paterno').value, apellido_materno: document.getElementById('reg_ap_materno').value, correo: document.getElementById('reg_correo').value, celular: document.getElementById('reg_celular').value, contacto_emergencia: document.getElementById('reg_emergencia').value, hora_entrada_turno: `${document.getElementById('reg_entrada').value}:00`, hora_salida_turno: `${document.getElementById('reg_salida').value}:00`, foto_perfil: fotoBase64Global }; try { const res = await fetch(`/empleados/${dni}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (res.ok) { mostrarNotificacion("Empleado actualizado"); cerrarModalEmpleado(); cambiarPestanaGestion('activos'); } } catch (e) {} }
function previsualizarFoto(e) { const f = e.target.files[0]; if(!f) return; const reader = new FileReader(); reader.onload = function(evt) { fotoBase64Global = evt.target.result; document.getElementById('foto-preview-box').style.backgroundImage = `url('${fotoBase64Global}')`; }; reader.readAsDataURL(f); }
function darDeBaja(dni) { pedirAutorizacion(() => { dniParaBaja = dni; document.getElementById('baja-motivo').value = ''; document.getElementById('modal-baja').classList.remove('hidden'); }); }
function cerrarModalBaja() { document.getElementById('modal-baja').classList.add('hidden'); }
async function ejecutarBaja() { try { const res = await fetch(`/empleados/${dniParaBaja}/baja`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo: document.getElementById('baja-motivo').value }) }); if (res.ok) { mostrarNotificacion("Baja procesada"); cerrarModalBaja(); cambiarPestanaGestion('activos'); } } catch (e) {} }

function cambiarPestanaGestion(p) { vistaGestionActual = p; document.getElementById('tab-activos').classList.remove('active'); document.getElementById('tab-todos').classList.remove('active'); document.getElementById(`tab-${p}`).classList.add('active'); const h = document.getElementById('tabla-empleados-head'); if (p === 'activos') { h.innerHTML = `<tr><th>DNI</th><th>Nombres y Apellidos</th><th>Contacto</th><th>Horario</th><th>Historial</th><th>Acciones</th></tr>`; cargarTablaGestion(); } else { h.innerHTML = `<tr><th>DNI</th><th>Nombres y Apellidos</th><th>Contacto</th><th>Estado</th><th>Detalle</th></tr>`; cargarTablaTodos(); } }
function renderizarTablaGestion(lista) { const b = document.getElementById('tabla-empleados-body'); b.innerHTML = ''; lista.forEach(emp => { const tr = document.createElement('tr'); const n = `${emp.nombres} ${emp.apellido_paterno}`; const c = `<span style="display:block; font-size:11px;">✉️ ${emp.correo || '-'}</span>`; if (vistaGestionActual === 'activos') { tr.innerHTML = `<td><strong>${emp.dni}</strong></td><td>${n}</td><td>${c}</td><td>${emp.hora_entrada_turno.substring(0,5)}-${emp.hora_salida_turno.substring(0,5)}</td><td style="text-align:center;"><button onclick="verHistorialIndividual('${emp.dni}', '${n}')">📋</button></td><td><button class="btn-accion btn-editar" onclick="prepararEdicion('${emp.dni}')">Editar</button><button class="btn-accion btn-baja" onclick="darDeBaja('${emp.dni}')">Baja</button></td>`; } else { tr.innerHTML = `<td><strong>${emp.dni}</strong></td><td>${n}</td><td>${c}</td><td>${emp.activo ? 'ACTIVO' : 'INACTIVO'}</td><td>${emp.activo ? '-' : emp.motivo_baja}</td>`; } b.appendChild(tr); }); }
async function cargarTablaGestion() { const r = await fetch('/empleados'); listaGestionGlobal = await r.json(); renderizarTablaGestion(listaGestionGlobal); }
async function cargarTablaTodos() { const r = await fetch('/empleados/todos'); listaGestionGlobal = await r.json(); renderizarTablaGestion(listaGestionGlobal); }
function filtrarTablaGestion() { const t = document.getElementById('busqueda_gestion').value.toLowerCase(); renderizarTablaGestion(listaGestionGlobal.filter(e => `${e.nombres} ${e.apellido_paterno}`.toLowerCase().includes(t) || e.dni.includes(t))); }

async function verHistorialIndividual(dni, n) { document.getElementById('historial-nombre-empleado').innerText = n; const body = document.getElementById('tabla-historial-individual-body'); body.innerHTML = ''; document.getElementById('modal-historial-empleado').classList.remove('hidden'); const r = await fetch('/asistencias/monitor'); let asis = await r.json(); asis.filter(a => a.dni === dni).forEach(a => { body.innerHTML += `<tr><td>${a.fecha}</td><td>${a.hora_entrada}</td><td>${a.hora_salida}</td><td>${a.estado}</td><td>${a.horas_extra}</td></tr>`; }); }
function cerrarModalHistorial() { document.getElementById('modal-historial-empleado').classList.add('hidden'); }

window.addEventListener('offline', () => mostrarNotificacion("⚠️ Red desconectada. Operando en Modo Offline local.", "error"));
window.addEventListener('online', sincronizarDatosPendientes);
async function sincronizarDatosPendientes() {
    mostrarNotificacion("✅ Red restablecida. Sincronizando cola...");
    try {
        const res = await fetch('/sincronizar_correos', { method: 'POST' });
        const resNube = await fetch('/sincronizar_nube', { method: 'POST' });
        if (resNube.ok) { const dNube = await resNube.json(); if(dNube.mensaje.includes("Se sincronizaron")) { mostrarNotificacion(`🌐 ${dNube.mensaje}`); cargarTablaMonitor(); } }
    } catch (e) {}
}
setTimeout(() => { if (navigator.onLine) sincronizarDatosPendientes(); }, 2000);

document.addEventListener('DOMContentLoaded', () => { const today = new Date(); const yyyy = today.getFullYear(); const mm = String(today.getMonth() + 1).padStart(2, '0'); const inputMes = document.getElementById('mes-reporte'); if (inputMes) inputMes.value = `${yyyy}-${mm}`; });
setInterval(cargarNotificaciones, 30000); setTimeout(cargarNotificaciones, 2000);