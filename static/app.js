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
        // Mostrar panel de gestión, ocultar asistencia
        asistencia.classList.add('hidden');
        gestion.classList.remove('hidden');
    } else {
        // Mostrar panel de asistencia, ocultar gestión
        gestion.classList.add('hidden');
        asistencia.classList.remove('hidden');
        
        // Actualizar el título dinámicamente
        document.getElementById('titulo-pantalla').innerText = `Registro de ${modo.charAt(0).toUpperCase() + modo.slice(1)}`;
        
        // Limpiar la barra de búsqueda
        document.getElementById('busqueda_rapida').value = ''; 
        
        // Cargar y dibujar la cuadrícula de empleados adaptada al modo (Entrada o Salida)
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
            document.getElementById('reg_dni').value = '';
            document.getElementById('reg_nombre').value = '';
            document.getElementById('reg_entrada').value = '08:00';
            document.getElementById('reg_salida').value = '18:00';
        } else {
            alert("Error: " + res.detail);
        }
    } catch (error) {
        alert("Error de conexión al guardar el empleado.");
    }
}