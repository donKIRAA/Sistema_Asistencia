// --- VARIABLES GLOBALES ---
let modoActual = 'entrada';
let listaGlobalEmpleados = []; 

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
        cargarTablaGestion(); 
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
    const horaPorDefecto = modoActual === 'entrada' ? '08:00' : '17:00';

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
                        <input type="time" id="hora_${emp.dni}" value="${horaPorDefecto}">
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

// --- GESTIÓN DE PERSONAL ---
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
            document.getElementById('reg_dni').value = '';
            document.getElementById('reg_nombre').value = '';
            document.getElementById('reg_entrada').value = '08:00';
            document.getElementById('reg_salida').value = '18:00';
            cargarTablaGestion();
        } else {
            mostrarNotificacion("Error: " + res.detail, "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión al guardar el empleado.", "error");
    }
}

async function cargarTablaGestion() {
    try {
        const response = await fetch('/empleados');
        let empleados = await response.json();
        empleados.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
        const tbody = document.getElementById('tabla-empleados-body');
        tbody.innerHTML = '';
        
        empleados.forEach(emp => {
            const entradaStr = emp.hora_entrada_turno.substring(0, 5);
            const salidaStr = emp.hora_salida_turno.substring(0, 5);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${emp.dni}</strong></td>
                <td>${emp.nombre_completo}</td>
                <td>${entradaStr} - ${salidaStr}</td>
                <td>
                    <button class="btn-accion btn-editar" onclick="prepararEdicion('${emp.dni}', '${emp.nombre_completo}', '${entradaStr}', '${salidaStr}')">Editar</button>
                    <button class="btn-accion btn-baja" onclick="darDeBaja('${emp.dni}')">Baja</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error al cargar tabla de gestión:", error);
    }
}

function prepararEdicion(dni, nombre, entrada, salida) {
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

function cancelarEdicion() {
    document.getElementById('form-titulo').innerText = 'Registrar Nuevo Empleado';
    const inputDni = document.getElementById('reg_dni');
    inputDni.value = '';
    inputDni.disabled = false;
    inputDni.style.backgroundColor = "white";
    document.getElementById('reg_nombre').value = '';
    document.getElementById('reg_entrada').value = '08:00';
    document.getElementById('reg_salida').value = '18:00';
    document.getElementById('btn-guardar-nuevo').classList.remove('hidden');
    document.getElementById('controles-edicion').classList.add('hidden');
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
            cancelarEdicion();
            cargarTablaGestion(); 
        } else {
            const res = await response.json();
            mostrarNotificacion("Error: " + res.detail, "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión al actualizar.", "error");
    }
}

function darDeBaja(dni) {
    const mensaje = `¿Estás seguro de que deseas dar de baja al empleado con DNI ${dni}?\nEsta acción lo ocultará del registro de asistencia.`;
    mostrarConfirmacion(mensaje, async () => {
        try {
            const response = await fetch(`/empleados/${dni}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                mostrarNotificacion("El empleado ha sido dado de baja.", "success");
                cargarTablaGestion(); 
            } else {
                const res = await response.json();
                mostrarNotificacion("Error: " + res.detail, "error");
            }
        } catch (error) {
            mostrarNotificacion("Error de conexión al dar de baja.", "error");
        }
    });
}

// --- VISTA DE EMPLEADOS INACTIVOS ---
let viendoActivos = true;

function toggleVistaInactivos() {
    viendoActivos = !viendoActivos;
    const titulo = document.getElementById('titulo-tabla-gestion');
    const btn = document.getElementById('btn-toggle-activos');
    const cabeceraTabla = document.querySelector('#tabla-empleados-head tr'); 

    if (viendoActivos) {
        titulo.innerText = 'Empleados Activos';
        btn.innerText = 'Ver Historial de Bajas';
        btn.style.background = '#7f8c8d';
        cabeceraTabla.innerHTML = `
            <th>DNI</th>
            <th>Nombre Completo</th>
            <th>Horario (Ent/Sal)</th>
            <th>Acciones</th>
        `;
        cargarTablaGestion(); 
    } else {
        titulo.innerText = 'Personal Dado de Baja';
        btn.innerText = 'Volver a Activos';
        btn.style.background = '#27ae60';
        cabeceraTabla.innerHTML = `
            <th>DNI</th>
            <th>Nombre Completo</th>
            <th>Estado</th>
        `;
        cargarTablaInactivos(); 
    }
}

async function cargarTablaInactivos() {
    try {
        const response = await fetch('/empleados/inactivos');
        let empleados = await response.json();
        empleados.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
        const tbody = document.getElementById('tabla-empleados-body');
        tbody.innerHTML = '';
        
        empleados.forEach(emp => {
            const tr = document.createElement('tr');
            tr.style.backgroundColor = "#fdf2f2"; 
            tr.innerHTML = `
                <td><strong>${emp.dni}</strong></td>
                <td style="color: #7f8c8d; text-decoration: line-through;">${emp.nombre_completo}</td>
                <td style="color: #c0392b; font-weight: bold;">INACTIVO</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error al cargar tabla de inactivos:", error);
    }
}