// --- VARIABLES GLOBALES ---
let modoActual = 'entrada';
let listaGlobalEmpleados = []; 

// Variables para la sección de Gestión
let vistaGestionActual = 'activos';
let listaGestionGlobal = []; 
let dniParaBaja = ''; // Guarda temporalmente el DNI a dar de baja

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
    });
}

// --- NAVEGACIÓN ---
function mostrarPantalla(modo) {
    modoActual = modo;
    const asistencia = document.getElementById('seccion-asistencia');
    const gestion = document.getElementById('seccion-gestion');

    if (modo === 'gestion') {
        asistencia.classList.add('hidden');
        gestion.classList.remove('hidden');
        cambiarPestanaGestion('activos'); 
    } else {
        gestion.classList.add('hidden');
        asistencia.classList.remove('hidden');
        document.getElementById('titulo-pantalla').innerText = `Registro de ${modo.charAt(0).toUpperCase() + modo.slice(1)}`;
        document.getElementById('busqueda_rapida').value = ''; 
        cargarListaEmpleados(); 
    }
}

// --- ASISTENCIA ---
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
    
    // Obtenemos la hora inicial para el primer renderizado
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
            // ENTRADA: Tiene la clase "reloj-vivo" y está bloqueado
            inputHoraHTML = `
                <input type="time" id="hora_${emp.dni}" value="${horaActualTiempoReal}" 
                class="reloj-vivo" readonly tabindex="-1" 
                style="font-weight: bold; color: #2c3e50; background-color: #f4f7f6; border: 1px solid #ddd; pointer-events: none;">
            `;
        } else {
            // SALIDA: Tiene la clase "reloj-vivo", pero se la quitamos (onfocus/onchange) si decide interactuar
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

// --- MOTOR DEL RELOJ EN TIEMPO REAL ---
// Se ejecuta una vez cada segundo (1000 milisegundos)
setInterval(() => {
    const ahora = new Date();
    const horas = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    const tiempoReal = `${horas}:${minutos}`;
    
    // Busca todos los inputs que tengan la etiqueta "reloj-vivo" y actualiza su hora
    document.querySelectorAll('.reloj-vivo').forEach(input => {
        if (input.value !== tiempoReal) {
            input.value = tiempoReal;
        }
    });
}, 1000);

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

// --- GESTIÓN DE PERSONAL ---

// 1. Manejo del Modal de Formulario Empleado
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

// 2. Operaciones CRUD Básicas
async function guardarNuevoEmpleado() {
    const dni = document.getElementById('reg_dni').value;
    const nombre = document.getElementById('reg_nombre').value;
    const entrada = document.getElementById('reg_entrada').value;
    const salida = document.getElementById('reg_salida').value;

    if (!dni || !nombre) return mostrarNotificacion("Completa DNI y Nombre obligatoriamente.", "error");
    if (dni.length !== 8) return mostrarNotificacion("El DNI debe tener exactamente 8 dígitos.", "error");

    try {
        const response = await fetch('/empleados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dni: dni,
                nombre_completo: nombre,
                hora_entrada_turno: `${entrada}:00`,
                hora_salida_turno: `${salida}:00`
            })
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
        mostrarNotificacion("Error de conexión al guardar el empleado.", "error");
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
            body: JSON.stringify({
                nombre_completo: nombre,
                hora_entrada_turno: `${entrada}:00`,
                hora_salida_turno: `${salida}:00`
            })
        });

        if (response.ok) {
            mostrarNotificacion("Datos actualizados correctamente.", "success");
            cerrarModalEmpleado(); 
            cargarTablaGestion(); 
        } else {
            const res = await response.json();
            mostrarNotificacion("Error: " + res.detail, "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión al actualizar.", "error");
    }
}

// 3. NUEVO FLUJO DE BAJA CON JUSTIFICACIÓN
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
    
    if (!motivo) return mostrarNotificacion("Debes escribir una justificación para la baja.", "error");

    try {
        const response = await fetch(`/empleados/${dniParaBaja}/baja`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ motivo: motivo })
        });
        
        if (response.ok) {
            mostrarNotificacion("Empleado dado de baja correctamente.", "success");
            cerrarModalBaja();
            cargarTablaGestion(); 
        } else {
            const res = await response.json();
            mostrarNotificacion("Error: " + res.detail, "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión al procesar la baja.", "error");
    }
}

function verJustificacion(motivo) {
    document.getElementById('texto-justificacion').innerText = motivo;
    document.getElementById('modal-justificacion').classList.remove('hidden');
}

// 4. Renderizado, Pestañas y Filtros de la Tabla Completa
function cambiarPestanaGestion(pestana) {
    vistaGestionActual = pestana;
    
    document.getElementById('tab-activos').classList.remove('active');
    document.getElementById('tab-todos').classList.remove('active');
    document.getElementById(`tab-${pestana}`).classList.add('active');
    
    document.getElementById('busqueda_gestion').value = '';

    const cabeceraTabla = document.querySelector('#tabla-empleados-head tr'); 

    if (pestana === 'activos') {
        cabeceraTabla.innerHTML = `
            <th>DNI</th>
            <th>Nombre Completo</th>
            <th>Horario Laboral</th>
            <th style="text-align: center;">Historial Asistencia</th>
            <th>Acciones</th>
        `;
        cargarTablaGestion();
    } else {
        cabeceraTabla.innerHTML = `
            <th>DNI</th>
            <th>Nombre Completo</th>
            <th style="text-align: center;">Estado</th>
            <th style="text-align: center;">Justificación Baja</th>
        `;
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
                <td><strong>${emp.dni}</strong></td>
                <td>${emp.nombre_completo}</td>
                <td>${entradaStr} - ${salidaStr}</td>
                <td style="text-align: center;">
                    <button class="btn-historial" onclick="verHistorial('${emp.dni}')" title="Ver Historial">📋</button>
                </td>
                <td>
                    <button class="btn-accion btn-editar" onclick="prepararEdicion('${emp.dni}', '${emp.nombre_completo}', '${entradaStr}', '${salidaStr}')">Editar</button>
                    <button class="btn-accion btn-baja" onclick="darDeBaja('${emp.dni}')">Baja</button>
                </td>
            `;
        } else {
            // DISEÑO PARA EL HISTORIAL COMPLETO
            const esActivo = emp.activo;
            
            const estadoBadge = esActivo 
                ? '<span style="background: #27ae60; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">ACTIVO</span>'
                : '<span style="background: #c0392b; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">INACTIVO</span>';
            
            const btnJustificacion = esActivo 
                ? '<span style="color: #95a5a6; font-style: italic;">N/A</span>'
                : `<button class="btn-accion" style="background: #f39c12; color: white; border-radius: 15px;" onclick="verJustificacion('${emp.motivo_baja}')">Ver Detalles</button>`;

            if(!esActivo) tr.style.backgroundColor = "#fdf2f2"; 

            tr.innerHTML = `
                <td><strong>${emp.dni}</strong></td>
                <td>${emp.nombre_completo}</td>
                <td style="text-align: center;">${estadoBadge}</td>
                <td style="text-align: center;">${btnJustificacion}</td>
            `;
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
    } catch (error) {
        console.error("Error al cargar tabla activos:", error);
    }
}

async function cargarTablaTodos() {
    try {
        const response = await fetch('/empleados/todos');
        let empleados = await response.json();
        empleados.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
        listaGestionGlobal = empleados;
        renderizarTablaGestion(empleados);
    } catch (error) {
        console.error("Error al cargar historial completo:", error);
    }
}

function filtrarTablaGestion() {
    const texto = document.getElementById('busqueda_gestion').value.toLowerCase();
    const filtrados = listaGestionGlobal.filter(emp =>
        emp.nombre_completo.toLowerCase().includes(texto) ||
        emp.dni.includes(texto)
    );
    renderizarTablaGestion(filtrados);
}

// 5. Placeholder para la Actividad 7
function verHistorial(dni) {
    mostrarNotificacion(`Preparando entorno para cargar el historial del DNI: ${dni} (Actividad 7)`, 'success');
}