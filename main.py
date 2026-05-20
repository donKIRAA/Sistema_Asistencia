from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from datetime import date
from database import engine, Base, SessionLocal
import models
import schemas
import calculos

# Inicialización del servidor
app = FastAPI(title="API Control de Asistencia")

# Montar la carpeta de archivos estáticos (Frontend)
# Asegúrate de tener una carpeta llamada 'static' con tu index.html, style.css y app.js
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.on_event("startup")
def startup_event():
    # Crea las tablas si no existen
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        # Crear Admin por defecto si no existe
        if not db.query(models.Admin).filter(models.Admin.username == "Admin").first():
            db.add(models.Admin(username="Admin", password="admin_password"))
            
        # Crear Empleado de prueba si no existe
        if not db.query(models.Empleado).filter(models.Empleado.dni == "12345678").first():
            db.add(models.Empleado(
                dni="12345678", 
                nombre_completo="Practicante1",
                activo=True
            ))
        db.commit()
    finally:
        db.close()

@app.get("/")
def ruta_principal():
    return {"mensaje": "Servidor funcionando. Accede a /static/index.html para la interfaz."}

@app.post("/login")
def login_admin(datos: schemas.AdminLogin):
    db: Session = SessionLocal()
    try:
        admin = db.query(models.Admin).filter(
            models.Admin.username == datos.username,
            models.Admin.password == datos.password
        ).first()
        
        if not admin:
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
            
        return {"mensaje": "Login exitoso"}
    finally:
        db.close()

# --- CRUD DE EMPLEADOS ---

@app.post("/empleados")
def crear_empleado(datos: schemas.EmpleadoCreate):
    db: Session = SessionLocal()
    try:
        existe = db.query(models.Empleado).filter(models.Empleado.dni == datos.dni).first()
        if existe:
            raise HTTPException(status_code=400, detail="El DNI ya está registrado")
        
        nuevo = models.Empleado(
            dni=datos.dni,
            nombre_completo=datos.nombre_completo,
            foto_perfil=datos.foto_perfil,
            hora_entrada_turno=datos.hora_entrada_turno,
            hora_salida_turno=datos.hora_salida_turno
        )
        db.add(nuevo)
        db.commit()
        return {"mensaje": "Empleado creado exitosamente"}
    finally:
        db.close()

@app.get("/empleados")
def obtener_empleados_activos():
    db: Session = SessionLocal()
    try:
        # Solo devolvemos empleados que no han sido dados de baja (Soft Delete)
        empleados = db.query(models.Empleado).filter(models.Empleado.activo == True).all()
        return empleados
    finally:
        db.close()

# --- REEMPLAZA TU ANTIGUA RUTA DE BAJA POR ESTA ---
@app.put("/empleados/{dni}/baja")
def dar_de_baja_empleado(dni: str, datos: schemas.EmpleadoBaja):
    db: Session = SessionLocal()
    try:
        empleado = db.query(models.Empleado).filter(models.Empleado.dni == dni).first()
        if not empleado:
            raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
        empleado.activo = False  
        empleado.motivo_baja = datos.motivo # Guardamos la justificación
        db.commit()
        return {"mensaje": f"Empleado {empleado.nombre_completo} dado de baja correctamente"}
    finally:
        db.close()
        
@app.get("/empleados/todos")
def obtener_todos_empleados():
    db: Session = SessionLocal()
    try:
        # Devuelve tanto activos como inactivos
        empleados = db.query(models.Empleado).all()
        return empleados
    finally:
        db.close()

# 1. Busca tu @app.put("/empleados/{dni}") y agrégale esta validación:
@app.put("/empleados/{dni}")
def actualizar_empleado(dni: str, datos: schemas.EmpleadoUpdate):
    db: Session = SessionLocal()
    try:
        empleado = db.query(models.Empleado).filter(models.Empleado.dni == dni).first()
        if not empleado:
            raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
        if datos.nombre_completo is not None:
            empleado.nombre_completo = datos.nombre_completo
        if datos.hora_entrada_turno is not None:
            empleado.hora_entrada_turno = datos.hora_entrada_turno
        if datos.hora_salida_turno is not None:
            empleado.hora_salida_turno = datos.hora_salida_turno
        # --- AÑADE ESTAS DOS LÍNEAS ---
        if datos.activo is not None:
            empleado.activo = datos.activo
            
        db.commit()
        return {"mensaje": "Empleado actualizado correctamente"}
    finally:
        db.close()

# 2. Añade esta NUEVA ruta justo debajo:
@app.get("/empleados/inactivos")
def obtener_empleados_inactivos():
    db: Session = SessionLocal()
    try:
        # Traemos solo los que tienen activo == False
        empleados = db.query(models.Empleado).filter(models.Empleado.activo == False).all()
        return empleados
    finally:
        db.close()

# --- RUTAS DE ASISTENCIA (ENTRADA Y SALIDA) ---

@app.post("/entrada")
def registrar_entrada(datos: schemas.AsistenciaEntrada):
    db: Session = SessionLocal()
    try:
        # 1. Buscar empleado
        empleado = db.query(models.Empleado).filter(
            models.Empleado.dni == datos.dni, 
            models.Empleado.activo == True
        ).first()
        
        if not empleado:
            raise HTTPException(status_code=404, detail="Empleado no encontrado o inactivo")
        
        # 2. Verificar si ya marcó hoy
        hoy = date.today()
        asistencia_hoy = db.query(models.Asistencia).filter(
            models.Asistencia.empleado_id == empleado.id,
            models.Asistencia.fecha == hoy
        ).first()

        if asistencia_hoy:
            raise HTTPException(status_code=400, detail="Ya se registró una entrada hoy para este DNI")

        # 3. Guardar registro
        nueva_asistencia = models.Asistencia(
            empleado_id=empleado.id,
            hora_entrada=datos.hora_llegada,
            estado=datos.estado
        )
        db.add(nueva_asistencia)
        db.commit()
        
        # Guardamos el nombre antes de cerrar la sesión para evitar el DetachedInstanceError
        nombre = empleado.nombre_completo
        return {"mensaje": f"Entrada registrada para {nombre}. Estado: {datos.estado}"}
    finally:
        db.close()

@app.post("/salida")
def registrar_salida(datos: schemas.AsistenciaSalida):
    db: Session = SessionLocal()
    try:
        empleado = db.query(models.Empleado).filter(models.Empleado.dni == datos.dni).first()
        if not empleado:
            raise HTTPException(status_code=404, detail="Empleado no encontrado")
            
        hoy = date.today()
        asistencia = db.query(models.Asistencia).filter(
            models.Asistencia.empleado_id == empleado.id,
            models.Asistencia.fecha == hoy
        ).first()

        if not asistencia:
            raise HTTPException(status_code=400, detail="No existe un registro de entrada para hoy")
            
        if asistencia.hora_salida:
            raise HTTPException(status_code=400, detail="Ya se registró la salida hoy")

        # 1. Guardamos la hora de salida real
        asistencia.hora_salida = datos.hora_salida
        
        # 2. LLAMAMOS AL MOTOR MATEMÁTICO
        # Pasamos el turno del empleado y sus marcaciones reales
        resultados = calculos.calcular_horas(
            entrada_turno=empleado.hora_entrada_turno,
            salida_turno=empleado.hora_salida_turno,
            entrada_real=asistencia.hora_entrada,
            salida_real=asistencia.hora_salida
        )
        
        # 3. Actualizamos la base de datos con los resultados matemáticos
        asistencia.horas_trabajadas = resultados["horas_trabajadas"]
        asistencia.minutos_tardanza = resultados["minutos_tardanza"]
        asistencia.minutos_extra = resultados["minutos_extra"]

        # 4. Guardamos todo
        db.commit()
        
        nombre = empleado.nombre_completo
        return {"mensaje": f"Salida y cálculos registrados exitosamente para {nombre}"}
    finally:
        db.close()

from fastapi.staticfiles import StaticFiles

# Esto le dice a FastAPI que busque los archivos web en la carpeta /static
app.mount("/static", StaticFiles(directory="static"), name="static")