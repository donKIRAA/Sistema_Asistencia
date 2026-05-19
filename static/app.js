// --- VARIABLES GLOBALES ---
let modoActual = 'entrada';

// --- AUTENTICACIÓN ---
async function iniciarSesion() {
    const user = document.getElementById('login_user').value;
    const pass = document.getElementById('login_pass').value;

    if (!user || !pass) return alert("Ingrese sus credenciales");

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
            alert(err.detail);
        }
    } catch (error) {
        alert("Error de conexión con el servidor");
    }
}

function cerrarSesion() {
    // Ventana emergente de confirmación
    const confirmar = confirm("¿Estás seguro de que deseas cerrar sesión?");
    
    if (confirmar) {
        document.getElementById('login_user').value = '';
        document.getElementById('login_pass').value = '';
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('pantalla-login').style.display = 'flex';
        
        document.getElementById('dni_busqueda').value = '';
        document.getElementById('info-empleado').classList.add('hidden');
    }
}

// --- NAVEGACIÓN ---
function mostrarPantalla(modo) {
    modoActual = modo;
    const asistencia = document.getElementById('seccion-asistencia');
    const gestion = document.getElementById('seccion-gestion');

    if (modo === 'gestion') {
        asistencia.classList.add('hidden');
        gestion.classList.remove('hidden');
        cargarTablaGestion(); // <--- Llamamos a la tabla
    } else {
        gestion.classList.add('hidden');
        asistencia.classList.remove('hidden');
        document.getElementById('titulo-pantalla').innerText = `Registro de ${modo.charAt(0).toUpperCase() + modo.slice(1)}`;
        document.getElementById('busqueda_rapida').value = ''; 
        cargarListaEmpleados(); 
    }
}

// --- ASISTENCIA ---
let listaGlobalEmpleados = []; // Guarda la lista para la barra de búsqueda

// 1. Descarga los empleados y los ordena
async function cargarListaEmpleados() {
    try {
        const response = await fetch('/empleados');
        let empleados = await response.json();

        // Ordenar alfabéticamente por nombre completo
        empleados.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
        listaGlobalEmpleados = empleados;

        renderizarLista(empleados);
    } catch (error) {
        console.error("Error al cargar lista:", error);
    }
}

// 2. Dibuja las tarjetas en pantalla
function renderizarLista(empleados) {
    const contenedor = document.getElementById('lista-empleados');
    contenedor.innerHTML = '';
    const ahora = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

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

        // Estructura HTML idéntica a tu boceto
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
                        <input type="time" id="hora_${emp.dni}" value="${ahora}">
                        <button class="${claseBoton}" onclick="enviarRegistroLista('${emp.dni}')">${textoBoton}</button>
                    </div>
                </div>
            </div>
        `;
        contenedor.innerHTML += tarjeta;
    });
}

// 3. Barra de búsqueda en tiempo real
function filtrarLista() {
    const texto = document.getElementById('busqueda_rapida').value.toLowerCase();
    const filtrados = listaGlobalEmpleados.filter(emp =>
        emp.nombre_completo.toLowerCase().includes(texto) ||
        emp.dni.includes(texto)
    );
    renderizarLista(filtrados);
}

// 4. Envía la marcación al servidor
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
        alert(response.ok ? res.mensaje : res.detail);
    } catch (error) {
        alert("Error de conexión al registrar.");
    }
}

// --- GESTIÓN DE PERSONAL ---
async function guardarNuevoEmpleado() {
    const dni = document.getElementById('reg_dni').value;
    const nombre = document.getElementById('reg_nombre').value;
    const entrada = document.getElementById('reg_entrada').value;
    const salida = document.getElementById('reg_salida').value;

    if (!dni || !nombre) return alert("Completa DNI y Nombre obligatoriamente.");
    if (dni.length !== 8) return alert("El DNI debe tener exactamente 8 dígitos.");

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
            alert("Empleado guardado correctamente.");
            
            // Limpiamos los campos del formulario
            document.getElementById('reg_dni').value = '';
            document.getElementById('reg_nombre').value = '';
            document.getElementById('reg_entrada').value = '08:00';
            document.getElementById('reg_salida').value = '18:00';
            
            // ¡MAGIA!: Refrescamos la tabla de la izquierda automáticamente
            cargarTablaGestion();
            
        } else {
            alert("Error: " + res.detail);
        }
    } catch (error) {
        alert("Error de conexión al guardar el empleado.");
    }
}

// --- FUNCIONES DE LA TABLA DE GESTIÓN ---

async function cargarTablaGestion() {
    try {
        const response = await fetch('/empleados');
        let empleados = await response.json();
        
        // Orden alfabético
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
    // Cambiamos los textos y valores del formulario
    document.getElementById('form-titulo').innerText = 'Editar Empleado';
    
    const inputDni = document.getElementById('reg_dni');
    inputDni.value = dni;
    inputDni.disabled = true; // El DNI no se debe modificar
    inputDni.style.backgroundColor = "#eee";
    
    document.getElementById('reg_nombre').value = nombre;
    document.getElementById('reg_entrada').value = entrada;
    document.getElementById('reg_salida').value = salida;
    
    // Cambiamos los botones visibles
    document.getElementById('btn-guardar-nuevo').classList.add('hidden');
    document.getElementById('controles-edicion').classList.remove('hidden');
}

function cancelarEdicion() {
    // Restauramos el formulario a su estado original
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

    if (!nombre) return alert("El nombre no puede estar vacío.");

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
            alert("Datos actualizados correctamente.");
            cancelarEdicion();
            cargarTablaGestion(); // Refrescamos la tabla para ver el cambio
        } else {
            const res = await response.json();
            alert("Error: " + res.detail);
        }
    } catch (error) {
        alert("Error de conexión al actualizar.");
    }
}

async function darDeBaja(dni) {
    const confirmar = confirm(`¿Estás seguro de que deseas dar de baja al empleado con DNI ${dni}?\nEsta acción lo ocultará del registro de asistencia.`);
    
    if (!confirmar) return;

    try {
        const response = await fetch(`/empleados/${dni}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert("El empleado ha sido dado de baja.");
            cargarTablaGestion(); // Refrescamos la tabla y el empleado desaparecerá
        } else {
            const res = await response.json();
            alert("Error: " + res.detail);
        }
    } catch (error) {
        alert("Error de conexión al dar de baja.");
    }
}

// --- VISTA DE EMPLEADOS INACTIVOS ---
let viendoActivos = true;

function toggleVistaInactivos() {
    viendoActivos = !viendoActivos;
    const titulo = document.getElementById('titulo-tabla-gestion');
    const btn = document.getElementById('btn-toggle-activos');
    const cabeceraTabla = document.querySelector('#tabla-empleados-head tr'); // Seleccionamos la fila de los títulos

    if (viendoActivos) {
        // --- MODO: ACTIVOS ---
        titulo.innerText = 'Empleados Activos';
        btn.innerText = 'Ver Historial de Bajas';
        btn.style.background = '#7f8c8d';
        
        // Restauramos las 4 columnas originales
        cabeceraTabla.innerHTML = `
            <th>DNI</th>
            <th>Nombre Completo</th>
            <th>Horario (Ent/Sal)</th>
            <th>Acciones</th>
        `;
        
        cargarTablaGestion(); 
    } else {
        // --- MODO: INACTIVOS ---
        titulo.innerText = 'Personal Dado de Baja';
        btn.innerText = 'Volver a Activos';
        btn.style.background = '#27ae60';
        
        // Cambiamos a solo 3 columnas con el título "Estado"
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
            
            // Inyectamos solo 3 celdas (<td>), quitando completamente la columna de acciones
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

async function reactivarEmpleado(dni) {
    const confirmar = confirm(`¿Deseas reactivar al empleado con DNI ${dni} y devolverlo al registro de asistencia?`);
    
    if (!confirmar) return;

    try {
        const response = await fetch(`/empleados/${dni}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                activo: true // Mandamos la orden de volverlo a la vida
            })
        });

        if (response.ok) {
            alert("El empleado ha sido reactivado exitosamente.");
            cargarTablaInactivos(); // Refrescamos la lista de bajas (desaparecerá de aquí)
        } else {
            const res = await response.json();
            alert("Error: " + res.detail);
        }
    } catch (error) {
        alert("Error de conexión al reactivar.");
    }
}