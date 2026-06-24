from sqlalchemy import Column, Integer, String, Time, Date, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import time, datetime
from database import Base

class Empleado(Base):
    __tablename__ = "empleados"
    id = Column(Integer, primary_key=True, index=True)
    dni = Column(String, unique=True, index=True)
    nombres = Column(String)
    apellido_paterno = Column(String)
    apellido_materno = Column(String)
    correo = Column(String, nullable=True)
    celular = Column(String, nullable=True)
    contacto_emergencia = Column(String, nullable=True)
    foto_perfil = Column(String, nullable=True)
    hora_entrada_turno = Column(Time, default=time(8, 0))
    hora_salida_turno = Column(Time, default=time(18, 0))
    activo = Column(Boolean, default=True)
    motivo_baja = Column(String, nullable=True)
    asistencias = relationship("Asistencia", back_populates="empleado")

class Asistencia(Base):
    __tablename__ = "asistencias"
    id = Column(Integer, primary_key=True, index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.id"))
    fecha = Column(Date)
    hora_entrada = Column(Time, nullable=True)
    hora_salida = Column(Time, nullable=True)
    estado = Column(String)
    minutos_tardanza = Column(Integer, default=0)
    minutos_extra = Column(Integer, default=0)
    justificacion_motivo = Column(String, nullable=True)
    justificacion_archivo = Column(String, nullable=True)
    sincronizado = Column(Boolean, default=False)
    empleado = relationship("Empleado", back_populates="asistencias")

class ColaMensaje(Base):
    __tablename__ = "cola_correos"
    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String, default="Email")
    destino = Column(String)
    mensaje = Column(String)
    archivo_adjunto = Column(String, nullable=True)
    estado = Column(String, default="Pendiente")

class Notificacion(Base):
    __tablename__ = "notificaciones"
    id = Column(Integer, primary_key=True, index=True)
    mensaje = Column(String)
    tipo = Column(String)
    leida = Column(Boolean, default=False)
    fecha = Column(String, default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))