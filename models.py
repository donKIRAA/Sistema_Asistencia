from sqlalchemy import Column, Integer, String, Time, Date, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import time, date
from database import Base

class Admin(Base):
    __tablename__ = "administradores"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)

class Empleado(Base):
    __tablename__ = "empleados"
    id = Column(Integer, primary_key=True, index=True)
    dni = Column(String, unique=True, index=True)
    nombre_completo = Column(String)
    foto_perfil = Column(String, nullable=True) 
    hora_entrada_turno = Column(Time, default=time(8, 0)) 
    hora_salida_turno = Column(Time, default=time(18, 0)) 
    activo = Column(Boolean, default=True) # <--- NUEVO CAMPO: True (Trabajando), False (Dado de baja)

class Asistencia(Base):
    __tablename__ = "asistencias"
    id = Column(Integer, primary_key=True, index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.id"))
    fecha = Column(Date, default=date.today)
    hora_entrada = Column(Time, nullable=True) 
    hora_salida = Column(Time, nullable=True)  
    estado = Column(String) 
    
    # --- NUEVOS CAMPOS PARA EL CÁLCULO ---
    horas_trabajadas = Column(Float, default=0.0)
    minutos_tardanza = Column(Float, default=0.0)
    minutos_extra = Column(Float, default=0.0) # Preparando el terreno para el Paso 6
    
    empleado = relationship("Empleado")