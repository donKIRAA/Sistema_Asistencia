from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from datetime import datetime, date
import models, schemas
from database import engine, SessionLocal

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="SIA - Backend de Asistencia")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/login")
def login(data: schemas.LoginData):
    if data.username == "admin" and data.password == "admin123":
        return {"mensaje": "Login exitoso"}
    raise HTTPException(status_code=401, detail="Credenciales incorrectas")

@app.get("/empleados")
def obtener_empleados_activos(db: Session = Depends(get_db)):
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
        nombres=datos.nombres,
        apellido_paterno=datos.apellido_paterno,
        apellido_materno=datos.apellido_materno,
        correo=datos.correo,
        celular=datos.celular,
        contacto_emergencia=datos.contacto_emergencia,
        hora_entrada_turno=datetime.strptime(datos.hora_entrada_turno, "%H:%M:%S").time(),
        hora_salida_turno=datetime.strptime(datos.hora_salida_turno, "%H:%M:%S").time(),
        foto_perfil=datos.foto_perfil
    )
    db.add(nuevo_empleado)
    db.commit()
    return {"mensaje": "Empleado guardado correctamente"}

@app.put("/empleados/{dni}")
def editar_empleado(dni: str, datos: schemas.EmpleadoUpdate, db: Session = Depends(get_db)):
    empleado = db.query(models.Empleado).filter(models.Empleado.dni == dni).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    
    empleado.nombres = datos.nombres
    empleado.apellido_paterno = datos.apellido_paterno
    empleado.apellido_materno = datos.apellido_materno
    empleado.correo = datos.correo
    empleado.celular = datos.celular
    empleado.contacto_emergencia = datos.contacto_emergencia
    empleado.hora_entrada_turno = datetime.strptime(datos.hora_entrada_turno, "%H:%M:%S").time()
    empleado.hora_salida_turno = datetime.strptime(datos.hora_salida_turno, "%H:%M:%S").time()
    
    if datos.foto_perfil:
        empleado.foto_perfil = datos.foto_perfil
        
    db.commit()
    return {"mensaje": "Empleado actualizado exitosamente"}

@app.put("/empleados/{dni}/baja")
def dar_de_baja(dni: str, datos: schemas.EmpleadoBaja, db: Session = Depends(get_db)):
    empleado = db.query(models.Empleado).filter(models.Empleado.dni == dni).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    
    empleado.activo = False
    empleado.motivo_baja = datos.motivo
    db.commit()
    return {"mensaje": "Empleado dado de baja"}

@app.post("/entrada")
def registrar_entrada(datos: schemas.EntradaData, db: Session = Depends(get_db)):
    empleado = db.query(models.Empleado).filter(models.Empleado.dni == datos.dni, models.Empleado.activo == True).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado o está inactivo")
    
    hoy = date.today()
    asistencia = db.query(models.Asistencia).filter(models.Asistencia.empleado_id == empleado.id, models.Asistencia.fecha == hoy).first()
    
    if asistencia and asistencia.hora_entrada:
        raise HTTPException(status_code=400, detail="La entrada ya fue registrada para el día de hoy")
    
    if not asistencia:
        asistencia = models.Asistencia(empleado_id=empleado.id, fecha=hoy)
        db.add(asistencia)
    
    hora_llegada_dt = datetime.strptime(datos.hora_llegada, "%H:%M:%S").time()
    asistencia.hora_entrada = hora_llegada_dt
    asistencia.estado = datos.estado
    
    if datos.estado == "Tardanza":
        dt_llegada = datetime.combine(hoy, hora_llegada_dt)
        dt_turno = datetime.combine(hoy, empleado.hora_entrada_turno)
        diferencia_minutos = (dt_llegada - dt_turno).total_seconds() / 60
        if diferencia_minutos > 0:
            asistencia.minutos_tardanza = int(diferencia_minutos)
            
    db.commit()
    return {"mensaje": "Marcación de entrada registrada"}

@app.post("/salida")
def registrar_salida(datos: schemas.SalidaData, db: Session = Depends(get_db)):
    empleado = db.query(models.Empleado).filter(models.Empleado.dni == datos.dni, models.Empleado.activo == True).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    
    hoy = date.today()
    asistencia = db.query(models.Asistencia).filter(models.Asistencia.empleado_id == empleado.id, models.Asistencia.fecha == hoy).first()
    
    if not asistencia or not asistencia.hora_entrada:
        raise HTTPException(status_code=400, detail="Debe registrar su entrada primero")
    
    hora_salida_dt = datetime.strptime(datos.hora_salida, "%H:%M:%S").time()
    asistencia.hora_salida = hora_salida_dt
    
    dt_salida = datetime.combine(hoy, hora_salida_dt)
    dt_turno_salida = datetime.combine(hoy, empleado.hora_salida_turno)
    diferencia_extra = (dt_salida - dt_turno_salida).total_seconds() / 60
    
    if diferencia_extra >= 15: 
        bloques_completos = int(diferencia_extra // 15)
        asistencia.minutos_extra = bloques_completos * 15 
    else:
        asistencia.minutos_extra = 0
        
    db.commit()
    return {"mensaje": "Marcación de salida registrada"}

@app.get("/asistencias/monitor")
def obtener_monitor_asistencias(db: Session = Depends(get_db)):
    asistencias = db.query(models.Asistencia).order_by(models.Asistencia.fecha.desc(), models.Asistencia.id.desc()).all()
    resultado = []
    for asis in asistencias:
        emp = asis.empleado 
        if not emp:
            continue
        
        entrada_str = asis.hora_entrada.strftime("%H:%M") if asis.hora_entrada else "--:--"
        salida_str = asis.hora_salida.strftime("%H:%M") if asis.hora_salida else "--:--"
        
        m_extra = asis.minutos_extra or 0
        h_ext = int(m_extra // 60)
        m_ext = int(m_extra % 60)
        str_extra = f"{h_ext}h {m_ext}m" if m_extra > 0 else "0h"
        
        # Unificamos el nombre completo para el monitor
        nombre_completo = f"{emp.nombres} {emp.apellido_paterno} {emp.apellido_materno}".strip()
        
        resultado.append({
            "dni": emp.dni,
            "nombre_completo": nombre_completo,
            "fecha": asis.fecha.strftime("%Y-%m-%d"),
            "hora_entrada": entrada_str,
            "hora_salida": salida_str,
            "minutos_tardanza": int(asis.minutos_tardanza or 0),
            "horas_extra": str_extra,
            "estado": asis.estado
        })
    return resultado

app.mount("/", StaticFiles(directory=".", html=True), name="static")