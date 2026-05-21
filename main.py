from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from datetime import datetime, date, time
import models, schemas
from database import engine, SessionLocal

models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="SIA - Backend de Asistencia")

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def procesar_faltas_automaticas_global(db: Session):
    hoy = date.today()
    ahora = datetime.now().time()
    empleados = db.query(models.Empleado).filter(models.Empleado.activo == True).all()
    for emp in empleados:
        if not db.query(models.Asistencia).filter(models.Asistencia.empleado_id == emp.id, models.Asistencia.fecha == hoy).first():
            if ahora > emp.hora_salida_turno:
                db.add(models.Asistencia(empleado_id=emp.id, fecha=hoy, estado="Falta", hora_entrada=time(0,0)))
    db.commit()

@app.post("/login")
def login(data: schemas.LoginData):
    if data.username == "admin" and data.password == "admin123": return {"mensaje": "Login exitoso"}
    raise HTTPException(status_code=401, detail="Credenciales incorrectas")

@app.get("/empleados")
def obtener_empleados_activos(db: Session = Depends(get_db)):
    procesar_faltas_automaticas_global(db)
    return db.query(models.Empleado).filter(models.Empleado.activo == True).all()

@app.get("/empleados/todos")
def obtener_todos_empleados(db: Session = Depends(get_db)):
    return db.query(models.Empleado).all()

@app.post("/empleados")
def crear_empleado(datos: schemas.EmpleadoCreate, db: Session = Depends(get_db)):
    if db.query(models.Empleado).filter(models.Empleado.dni == datos.dni).first():
        raise HTTPException(status_code=400, detail="El DNI ya está registrado")
    nuevo_empleado = models.Empleado(
        dni=datos.dni,
        nombres=datos.nombres.upper(),
        apellido_paterno=datos.apellido_paterno.upper(),
        apellido_materno=datos.apellido_materno.upper(),
        correo=datos.correo,
        celular=datos.celular,
        contacto_emergencia=datos.contacto_emergencia,
        hora_entrada_turno=datetime.strptime(datos.hora_entrada_turno, "%H:%M:%S").time(),
        hora_salida_turno=datetime.strptime(datos.hora_salida_turno, "%H:%M:%S").time(),
        foto_perfil=datos.foto_perfil
    )
    db.add(nuevo_empleado); db.commit(); return {"mensaje": "Empleado guardado"}

@app.put("/empleados/{dni}")
def editar_empleado(dni: str, datos: schemas.EmpleadoUpdate, db: Session = Depends(get_db)):
    empleado = db.query(models.Empleado).filter(models.Empleado.dni == dni).first()
    if not empleado: raise HTTPException(status_code=404, detail="No encontrado")
    empleado.nombres = datos.nombres.upper()
    empleado.apellido_paterno = datos.apellido_paterno.upper()
    empleado.apellido_materno = datos.apellido_materno.upper()
    empleado.correo = datos.correo
    empleado.celular = datos.celular
    empleado.contacto_emergencia = datos.contacto_emergencia
    empleado.hora_entrada_turno = datetime.strptime(datos.hora_entrada_turno, "%H:%M:%S").time()
    empleado.hora_salida_turno = datetime.strptime(datos.hora_salida_turno, "%H:%M:%S").time()
    if datos.foto_perfil: empleado.foto_perfil = datos.foto_perfil
    db.commit(); return {"mensaje": "Actualizado"}

@app.put("/empleados/{dni}/baja")
def dar_de_baja(dni: str, datos: schemas.EmpleadoBaja, db: Session = Depends(get_db)):
    empleado = db.query(models.Empleado).filter(models.Empleado.dni == dni).first()
    empleado.activo = False
    empleado.motivo_baja = datos.motivo
    db.commit(); return {"mensaje": "Dado de baja"}

@app.post("/entrada")
def registrar_entrada(datos: schemas.EntradaData, db: Session = Depends(get_db)):
    empleado = db.query(models.Empleado).filter(models.Empleado.dni == datos.dni, models.Empleado.activo == True).first()
    hoy = date.today()
    asistencia = db.query(models.Asistencia).filter(models.Asistencia.empleado_id == empleado.id, models.Asistencia.fecha == hoy).first()
    if not asistencia:
        asistencia = models.Asistencia(empleado_id=empleado.id, fecha=hoy)
        db.add(asistencia)
    hora_llegada_dt = datetime.strptime(datos.hora_llegada, "%H:%M:%S").time()
    asistencia.hora_entrada = hora_llegada_dt
    asistencia.estado = datos.estado
    if datos.estado == "Tardanza":
        diferencia_minutos = (datetime.combine(hoy, hora_llegada_dt) - datetime.combine(hoy, empleado.hora_entrada_turno)).total_seconds() / 60
        asistencia.minutos_tardanza = int(diferencia_minutos) if diferencia_minutos > 0 else 0
    db.commit(); return {"mensaje": "Entrada registrada"}

@app.put("/asistencias/modificar_entrada")
def modificar_entrada(datos: schemas.EntradaData, db: Session = Depends(get_db)):
    empleado = db.query(models.Empleado).filter(models.Empleado.dni == datos.dni).first()
    hoy = date.today()
    asistencia = db.query(models.Asistencia).filter(models.Asistencia.empleado_id == empleado.id, models.Asistencia.fecha == hoy).first()
    if not asistencia:
        asistencia = models.Asistencia(empleado_id=empleado.id, fecha=hoy)
        db.add(asistencia)
    hora_llegada_dt = datetime.strptime(datos.hora_llegada, "%H:%M:%S").time()
    asistencia.hora_entrada = hora_llegada_dt
    asistencia.estado = datos.estado
    if datos.estado == "Tardanza":
        diferencia_minutos = (datetime.combine(hoy, hora_llegada_dt) - datetime.combine(hoy, empleado.hora_entrada_turno)).total_seconds() / 60
        asistencia.minutos_tardanza = int(diferencia_minutos) if diferencia_minutos > 0 else 0
    else: asistencia.minutos_tardanza = 0
    db.commit(); return {"mensaje": "Modificada"}

@app.post("/salida")
def registrar_salida(datos: schemas.SalidaData, db: Session = Depends(get_db)):
    empleado = db.query(models.Empleado).filter(models.Empleado.dni == datos.dni, models.Empleado.activo == True).first()
    hoy = date.today()
    asistencia = db.query(models.Asistencia).filter(models.Asistencia.empleado_id == empleado.id, models.Asistencia.fecha == hoy).first()
    hora_salida_dt = datetime.strptime(datos.hora_salida, "%H:%M:%S").time()
    asistencia.hora_salida = hora_salida_dt
    diferencia_extra = (datetime.combine(hoy, hora_salida_dt) - datetime.combine(hoy, empleado.hora_salida_turno)).total_seconds() / 60
    asistencia.minutos_extra = int(diferencia_extra // 15) * 15 if diferencia_extra >= 15 else 0
    db.commit(); return {"mensaje": "Salida registrada"}

@app.get("/asistencias/monitor")
def obtener_monitor_asistencias(db: Session = Depends(get_db)):
    asistencias = db.query(models.Asistencia).order_by(models.Asistencia.fecha.desc(), models.Asistencia.id.desc()).all()
    return [{"dni": a.empleado.dni, "nombre_completo": f"{a.empleado.nombres} {a.empleado.apellido_paterno} {a.empleado.apellido_materno}".strip().upper(), "fecha": a.fecha.strftime("%Y-%m-%d"), "hora_entrada": a.hora_entrada.strftime("%H:%M") if a.hora_entrada else "--:--", "hora_salida": a.hora_salida.strftime("%H:%M") if a.hora_salida else "--:--", "minutos_tardanza": int(a.minutos_tardanza or 0), "horas_extra": f"{int((a.minutos_extra or 0)//60)}h {int((a.minutos_extra or 0)%60)}m" if (a.minutos_extra or 0) > 0 else "0h", "estado": a.estado} for a in asistencias if a.empleado]

app.mount("/", StaticFiles(directory=".", html=True), name="static")