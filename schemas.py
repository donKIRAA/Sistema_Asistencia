from pydantic import BaseModel
from typing import Optional

class LoginData(BaseModel):
    username: str
    password: str

class EmpleadoBase(BaseModel):
    dni: str
    nombres: str
    apellido_paterno: str
    apellido_materno: str
    correo: Optional[str] = None
    celular: Optional[str] = None
    contacto_emergencia: Optional[str] = None
    hora_entrada_turno: str
    hora_salida_turno: str
    foto_perfil: Optional[str] = None

class EmpleadoCreate(EmpleadoBase): pass

class EmpleadoUpdate(BaseModel):
    nombres: str
    apellido_paterno: str
    apellido_materno: str
    correo: Optional[str] = None
    celular: Optional[str] = None
    contacto_emergencia: Optional[str] = None
    hora_entrada_turno: str
    hora_salida_turno: str
    foto_perfil: Optional[str] = None

class EmpleadoBaja(BaseModel):
    motivo: str

class EntradaData(BaseModel):
    dni: str
    hora_llegada: str
    estado: str

class SalidaData(BaseModel):
    dni: str
    hora_salida: str

class JustificacionData(BaseModel):
    dni: str
    fecha: str
    motivo: str
    archivo_base64: Optional[str] = None

class FirmaData(BaseModel):
    dni: str
    fecha: str
    firma_base64: str

class NotificacionCreate(BaseModel):
    mensaje: str
    tipo: str