from pydantic import BaseModel, Field
from datetime import time
from typing import Optional

# Esquema para crear un empleado nuevo
class EmpleadoCreate(BaseModel):
    dni: str = Field(..., min_length=8, max_length=8, pattern=r"^\d{8}$")
    nombre_completo: str
    foto_perfil: Optional[str] = None
    hora_entrada_turno: time = time(8, 0)
    hora_salida_turno: time = time(18, 0)

# Esquema para las marcaciones de asistencia (ya lo tenías)
class AsistenciaEntrada(BaseModel):
    dni: str = Field(..., min_length=8, max_length=8, pattern=r"^\d{8}$")
    hora_llegada: time
    estado: str = Field(..., pattern="^(Asistencia|Falta|Tardanza)$")

class AsistenciaSalida(BaseModel):
    dni: str = Field(..., min_length=8, max_length=8, pattern=r"^\d{8}$")
    hora_salida: time

class AdminLogin(BaseModel):
    username: str
    password: str

class EmpleadoUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    foto_perfil: Optional[str] = None
    hora_entrada_turno: Optional[time] = None
    hora_salida_turno: Optional[time] = None

class EmpleadoUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    foto_perfil: Optional[str] = None
    hora_entrada_turno: Optional[time] = None
    hora_salida_turno: Optional[time] = None
    activo: Optional[bool] = None # <--- AÑADIMOS ESTO

# Añadir al final de schemas.py
class EmpleadoBaja(BaseModel):
    motivo: str