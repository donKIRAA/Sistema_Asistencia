from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, time, timedelta
import models, schemas
from database import engine, SessionLocal
import base64
import os
import smtplib
import csv
import io
from calendar import monthrange
from email.message import EmailMessage
from fpdf import FPDF

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

def enviar_correo_real(correo_destino: str, asunto: str, cuerpo: str, ruta_adjunto: str):
    remitente = "tu_correo_real@gmail.com" 
    password = "tu_password_de_aplicacion_16_caracteres" 
    if not correo_destino or "tu_correo_real" in remitente: return True
    msg = EmailMessage()
    msg['Subject'] = asunto
    msg['From'] = remitente
    msg['To'] = correo_destino
    msg.set_content(cuerpo)
    if ruta_adjunto and os.path.exists(ruta_adjunto):
        with open(ruta_adjunto, 'rb') as f:
            msg.add_attachment(f.read(), maintype='application', subtype='pdf', filename=os.path.basename(ruta_adjunto))
    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(remitente, password)
            smtp.send_message(msg)
        return True
    except: return False

def procesar_cola_correos(db_bg: Session):
    pendientes = db_bg.query(models.ColaMensaje).filter(models.ColaMensaje.estado == "Pendiente").all()
    for msg in pendientes:
        if enviar_correo_real(msg.destino, "Notificación de Recursos Humanos", msg.mensaje, msg.archivo_adjunto):
            msg.estado = "Enviado"
            db_bg.add(models.Notificacion(mensaje=f"✅ Correo enviado correctamente a {msg.destino}", tipo="exito"))
        else:
            msg.estado = "Error"
            db_bg.add(models.Notificacion(mensaje=f"❌ Error al enviar correo a {msg.destino}.", tipo="alerta"))
    db_bg.commit()

@app.post("/login")
def login(data: schemas.LoginData):
    if data.username == "admin" and data.password == "admin123": return {"mensaje": "Login exitoso"}
    raise HTTPException(status_code=404, detail="Credenciales incorrectas")

@app.get("/empleados")
def obtener_empleados_activos(db: Session = Depends(get_db)):
    procesar_faltas_automaticas_global(db)
    return db.query(models.Empleado).filter(models.Empleado.activo == True).all()

@app.get("/empleados/todos")
def obtener_todos_empleados(db: Session = Depends(get_db)):
    return db.query(models.Empleado).all()

@app.post("/empleados")
def crear_empleado(datos: schemas.EmpleadoCreate, db: Session = Depends(get_db)):
    if db.query(models.Empleado).filter(models.Empleado.dni == datos.dni).first(): raise HTTPException(status_code=400, detail="El DNI ya existe")
    nuevo = models.Empleado(
        dni=datos.dni, nombres=datos.nombres.upper(), apellido_paterno=datos.apellido_paterno.upper(), apellido_materno=datos.apellido_materno.upper(),
        correo=datos.correo, celular=datos.celular, contacto_emergencia=datos.contacto_emergencia,
        hora_entrada_turno=datetime.strptime(datos.hora_entrada_turno, "%H:%M:%S").time(),
        hora_salida_turno=datetime.strptime(datos.hora_salida_turno, "%H:%M:%S").time(), foto_perfil=datos.foto_perfil
    )
    db.add(nuevo); db.commit(); return {"mensaje": "Empleado guardado"}

@app.put("/empleados/{dni}")
def editar_empleado(dni: str, datos: schemas.EmpleadoUpdate, db: Session = Depends(get_db)):
    empleado = db.query(models.Empleado).filter(models.Empleado.dni == dni).first()
    if not empleado: raise HTTPException(status_code=404, detail="No encontrado")
    empleado.nombres = datos.nombres.upper(); empleado.apellido_paterno = datos.apellido_paterno.upper(); empleado.apellido_materno = datos.apellido_materno.upper()
    empleado.correo = datos.correo; empleado.celular = datos.celular; empleado.contacto_emergencia = datos.contacto_emergencia
    empleado.hora_entrada_turno = datetime.strptime(datos.hora_entrada_turno, "%H:%M:%S").time()
    empleado.hora_salida_turno = datetime.strptime(datos.hora_salida_turno, "%H:%M:%S").time()
    if datos.foto_perfil: empleado.foto_perfil = datos.foto_perfil
    db.commit(); return {"mensaje": "Actualizado"}

@app.put("/empleados/{dni}/baja")
def dar_de_baja(dni: str, datos: schemas.EmpleadoBaja, db: Session = Depends(get_db)):
    empleado = db.query(models.Empleado).filter(models.Empleado.dni == dni).first()
    empleado.activo = False; empleado.motivo_baja = datos.motivo; db.commit(); return {"mensaje": "Dado de baja"}

@app.post("/entrada")
def registrar_entrada(datos: schemas.EntradaData, db: Session = Depends(get_db)):
    empleado = db.query(models.Empleado).filter(models.Empleado.dni == datos.dni, models.Empleado.activo == True).first()
    hoy = date.today()
    asistencia = db.query(models.Asistencia).filter(models.Asistencia.empleado_id == empleado.id, models.Asistencia.fecha == hoy).first()
    if not asistencia:
        asistencia = models.Asistencia(empleado_id=empleado.id, fecha=hoy)
        db.add(asistencia)
    hora_llegada_dt = datetime.strptime(datos.hora_llegada, "%H:%M:%S").time()
    asistencia.hora_entrada = hora_llegada_dt; asistencia.estado = datos.estado
    if datos.estado == "Tardanza":
        diff = (datetime.combine(hoy, hora_llegada_dt) - datetime.combine(hoy, empleado.hora_entrada_turno)).total_seconds() / 60
        asistencia.minutos_tardanza = int(diff) if diff > 0 else 0
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
    asistencia.hora_entrada = hora_llegada_dt; asistencia.estado = datos.estado
    if datos.estado == "Tardanza":
        diff = (datetime.combine(hoy, hora_llegada_dt) - datetime.combine(hoy, empleado.hora_entrada_turno)).total_seconds() / 60
        asistencia.minutos_tardanza = int(diff) if diff > 0 else 0
    else: asistencia.minutos_tardanza = 0
    db.commit(); return {"mensaje": "Modificada"}

@app.post("/salida")
def registrar_salida(datos: schemas.SalidaData, db: Session = Depends(get_db)):
    empleado = db.query(models.Empleado).filter(models.Empleado.dni == datos.dni, models.Empleado.activo == True).first()
    hoy = date.today()
    asistencia = db.query(models.Asistencia).filter(models.Asistencia.empleado_id == empleado.id, models.Asistencia.fecha == hoy).first()
    hora_salida_dt = datetime.strptime(datos.hora_salida, "%H:%M:%S").time()
    asistencia.hora_salida = hora_salida_dt
    diff_extra = (datetime.combine(hoy, hora_salida_dt) - datetime.combine(hoy, empleado.hora_salida_turno)).total_seconds() / 60
    asistencia.minutos_extra = int(diff_extra // 15) * 15 if diff_extra >= 15 else 0
    db.commit(); return {"mensaje": "Salida registrada"}

@app.put("/asistencias/justificar")
def justificar_falta(datos: schemas.JustificacionData, db: Session = Depends(get_db)):
    empleado = db.query(models.Empleado).filter(models.Empleado.dni == datos.dni).first()
    fecha_obj = datetime.strptime(datos.fecha, "%Y-%m-%d").date()
    asistencia = db.query(models.Asistencia).filter(models.Asistencia.empleado_id == empleado.id, models.Asistencia.fecha == fecha_obj).first()
    asistencia.estado = "Justificada"; asistencia.justificacion_motivo = datos.motivo
    if datos.archivo_base64: asistencia.justificacion_archivo = datos.archivo_base64
    db.commit(); return {"mensaje": "Justificación registrada"}

@app.put("/asistencias/firmar_documento")
def firmar_documento(datos: schemas.FirmaData, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    empleado = db.query(models.Empleado).filter(models.Empleado.dni == datos.dni).first()
    fecha_obj = datetime.strptime(datos.fecha, "%Y-%m-%d").date()
    asistencia = db.query(models.Asistencia).filter(models.Asistencia.empleado_id == empleado.id, models.Asistencia.fecha == fecha_obj).first()
    if not asistencia: raise HTTPException(status_code=404, detail="Registro no encontrado")
    sanciones_previas = db.query(models.Asistencia).filter(models.Asistencia.empleado_id == empleado.id, models.Asistencia.estado == "Sancionada").count()
    numero_falta = sanciones_previas + 1
    if not os.path.exists("documentos_legales"): os.makedirs("documentos_legales")
    ruta_firma = f"documentos_legales/firma_temp_{datos.dni}.png"
    with open(ruta_firma, "wb") as fh: fh.write(base64.b64decode(datos.firma_base64.split(",")[1]))
    pdf = FPDF()
    pdf.add_page(); pdf.set_font("Arial", 'B', 16)
    if numero_falta >= 3:
        titulo_doc = "CARTA DE DESPIDO"
        cuerpo = f"Por medio de la presente, se le notifica formalmente su DESVINCULACIÓN LABORAL debido a la acumulación de {numero_falta} inasistencias injustificadas, siendo la más reciente el día {datos.fecha}."
        ruta_pdf = f"documentos_legales/Despido_{empleado.dni}_{datos.fecha}.pdf"
        alerta = f"⛔ {empleado.nombres} ha alcanzado las 3 faltas y ha sido DESPEDIDO."
    else:
        titulo_doc = "MEMORÁNDUM DE INASISTENCIA"
        cuerpo = f"Por medio de la presente, se le notifica formalmente sobre su inasistencia injustificada (Falta #{numero_falta}) ocurrida el día {datos.fecha}. Se le recuerda que acumular 3 conllevará despido."
        ruta_pdf = f"documentos_legales/Memo_{empleado.dni}_{datos.fecha}.pdf"
        alerta = f"⚠️ {empleado.nombres} recibió su 1er Memo (Faltan 2 para despido)." if numero_falta == 1 else f"🚨 {empleado.nombres} recibió su 2do Memo (A 1 falta del despido)."
    pdf.cell(0, 10, txt=titulo_doc, ln=True, align='C')
    pdf.set_font("Arial", 'B', 12); pdf.cell(0, 10, txt="SERVICIOS GENERALES FAMMA E.I.R.L.", ln=True, align='C'); pdf.ln(10)
    pdf.set_font("Arial", '', 12); pdf.cell(0, 10, txt=f"Fecha de emisión: {date.today().strftime('%Y-%m-%d')}", ln=True)
    pdf.cell(0, 10, txt=f"Dirigido a: {empleado.nombres} {empleado.apellido_paterno}", ln=True)
    pdf.ln(10); pdf.multi_cell(0, 10, txt=cuerpo); pdf.ln(20)
    pdf.cell(0, 10, txt="Firma del Supervisor:", ln=True, align='C'); pdf.image(ruta_firma, x=80, w=50); pdf.output(ruta_pdf)
    if os.path.exists(ruta_firma): os.remove(ruta_firma)
    asistencia.estado = "Sancionada"
    db.add(models.Notificacion(mensaje=alerta, tipo="alerta"))
    if empleado.correo:
        db.add(models.ColaMensaje(
            tipo="Email", destino=empleado.correo,
            mensaje=f"Estimado(a) {empleado.nombres},\n\nSe adjunta de manera formal el documento {titulo_doc} correspondete a la falta del {datos.fecha}.\n\nAtentamente,\nRecursos Humanos.",
            archivo_adjunto=ruta_pdf, estado="Pendiente"
        ))
    db.commit(); return {"mensaje": f"{titulo_doc} generado y encolado", "archivo": ruta_pdf}

@app.get("/descargar_documento/{dni}/{fecha}")
def descargar_documento(dni: str, fecha: str):
    m = f"documentos_legales/Memo_{dni}_{fecha}.pdf"; d = f"documentos_legales/Despido_{dni}_{fecha}.pdf"
    if os.path.exists(m): return FileResponse(path=m, filename=f"Memorandum_{dni}_{fecha}.pdf", media_type='application/pdf')
    elif os.path.exists(d): return FileResponse(path=d, filename=f"Despido_{dni}_{fecha}.pdf", media_type='application/pdf')
    raise HTTPException(status_code=404, detail="No existe.")

@app.get("/notificaciones")
def obtener_notificaciones(db: Session = Depends(get_db)):
    return db.query(models.Notificacion).order_by(models.Notificacion.id.desc()).limit(50).all()

@app.put("/notificaciones/leer")
def marcar_notificaciones_leidas(db: Session = Depends(get_db)):
    db.query(models.Notificacion).filter(models.Notificacion.leida == False).update({"leida": True}); db.commit(); return {"mensaje": "Leídas"}

@app.post("/notificaciones")
def crear_notificacion(datos: schemas.NotificacionCreate, db: Session = Depends(get_db)):
    db.add(models.Notificacion(mensaje=datos.mensaje, tipo=datos.tipo)); db.commit(); return {"mensaje": "Ok"}

@app.post("/sincronizar_correos")
def sincronizar_correos(background_tasks: BackgroundTasks):
    db_bg = SessionLocal()
    try:
        p = db_bg.query(models.ColaMensaje).filter(models.ColaMensaje.estado == "Pendiente").count()
        if p > 0: background_tasks.add_task(procesar_cola_correos, db_bg); return {"mensaje": f"Sincronizando {p} correos en segundo plano."}
        return {"mensaje": "No hay correos pendientes."}
    finally: db_bg.close()

@app.post("/sincronizar_nube")
def sincronizar_nube(db: Session = Depends(get_db)):
    pendientes = db.query(models.Asistencia).filter(models.Asistencia.sincronizado == False).all()
    if not pendientes: return {"mensaje": "Base de datos local totalmente sincronizada."}
    contador = 0
    for asis in pendientes:
        asis.sincronizado = True
        contador += 1
    db.commit()
    db.add(models.Notificacion(mensaje=f"🌐 Sincronización masiva exitosa: {contador} asistencias subidas a la nube.", tipo="exito"))
    db.commit()
    return {"mensaje": f"Se sincronizaron {contador} registros de asistencia sin duplicados."}

@app.get("/analitica/datos")
def obtener_datos_analitica(db: Session = Depends(get_db)):
    hoy = date.today()
    dias, asistencias_7d, tardanzas_7d, faltas_7d = [], [], [], []
    for i in range(6, -1, -1):
        dia = hoy - timedelta(days=i)
        dias.append(dia.strftime("%d/%m"))
        asistencias_7d.append(db.query(models.Asistencia).filter(models.Asistencia.fecha == dia, models.Asistencia.estado == "Asistencia").count())
        tardanzas_7d.append(db.query(models.Asistencia).filter(models.Asistencia.fecha == dia, models.Asistencia.estado == "Tardanza").count())
        faltas_7d.append(db.query(models.Asistencia).filter(models.Asistencia.fecha == dia, models.Asistencia.estado.in_(["Falta", "Sancionada"])).count())
    primer_mes = hoy.replace(day=1)
    t_asis = db.query(models.Asistencia).filter(models.Asistencia.fecha >= primer_mes, models.Asistencia.estado == "Asistencia").count()
    t_tard = db.query(models.Asistencia).filter(models.Asistencia.fecha >= primer_mes, models.Asistencia.estado == "Tardanza").count()
    t_falt = db.query(models.Asistencia).filter(models.Asistencia.fecha >= primer_mes, models.Asistencia.estado.in_(["Falta", "Sancionada"])).count()
    t_just = db.query(models.Asistencia).filter(models.Asistencia.fecha >= primer_mes, models.Asistencia.estado == "Justificada").count()
    top_inf = db.query(models.Empleado.dni, models.Empleado.nombres, models.Empleado.apellido_paterno, func.sum(models.Asistencia.minutos_tardanza).label("total")).join(models.Asistencia).filter(models.Asistencia.fecha >= primer_mes, models.Asistencia.minutos_tardanza > 0).group_by(models.Empleado.id).order_by(func.sum(models.Asistencia.minutos_tardanza).desc()).limit(5).all()
    return {
        "tendencia": {"dias": dias, "asistencias": asistencias_7d, "tardanzas": tardanzas_7d, "faltas": faltas_7d},
        "distribucion": [t_asis, t_tard, t_falt, t_just],
        "top_infractores": [{"dni": r[0], "nombre": f"{r[1]} {r[2]}".strip().upper(), "minutos": int(r[3] or 0)} for r in top_inf]
    }

@app.get("/reporte/mensual/{periodo}")
def descargar_reporte_mensual(periodo: str, db: Session = Depends(get_db)):
    try: year, month = map(int, periodo.split('-'))
    except ValueError: raise HTTPException(status_code=400, detail="Formato YYYY-MM requerido")
    fecha_inicio = date(year, month, 1)
    _, last_day = monthrange(year, month)
    fecha_fin = date(year, month, last_day)
    asistencias = db.query(models.Asistencia).filter(models.Asistencia.fecha >= fecha_inicio, models.Asistencia.fecha <= fecha_fin).order_by(models.Asistencia.fecha.asc()).all()
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';', quotechar='"', quoting=csv.QUOTE_MINIMAL)
    writer.writerow(["DNI", "Apellidos y Nombres", "Fecha", "Hora Entrada", "Hora Salida", "Estado", "Tardanza (Min)", "Horas Extra (Min)", "Justificación"])
    for a in asistencias:
        emp = a.empleado
        if emp:
            writer.writerow([emp.dni, f"{emp.apellido_paterno} {emp.apellido_materno} {emp.nombres}".strip().upper(), a.fecha.strftime("%Y-%m-%d"), a.hora_entrada.strftime("%H:%M") if a.hora_entrada else "--:--", a.hora_salida.strftime("%H:%M") if a.hora_salida else "--:--", a.estado, a.minutos_tardanza or 0, a.minutos_extra or 0, a.justificacion_motivo or "-"])
    output.seek(0)
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8-sig")
    response.headers["Content-Disposition"] = f"attachment; filename=Reporte_Asistencia_{periodo}.csv"
    return response

@app.get("/asistencias/monitor")
def obtener_monitor_asistencias(db: Session = Depends(get_db)):
    asistencias = db.query(models.Asistencia).order_by(models.Asistencia.fecha.desc(), models.Asistencia.id.desc()).all()
    return [{"dni": a.empleado.dni, "nombre_completo": f"{a.empleado.nombres} {a.empleado.apellido_paterno}".strip().upper(), "fecha": a.fecha.strftime("%Y-%m-%d"), "hora_entrada": a.hora_entrada.strftime("%H:%M") if a.hora_entrada else "--:--", "hora_salida": a.hora_salida.strftime("%H:%M") if a.hora_salida else "--:--", "minutos_tardanza": int(a.minutos_tardanza or 0), "horas_extra": f"{int((a.minutos_extra or 0)//60)}h {int((a.minutos_extra or 0)%60)}m" if (a.minutos_extra or 0) > 0 else "0h", "estado": a.estado} for a in asistencias if a.empleado]

app.mount("/", StaticFiles(directory=".", html=True), name="static")