import sqlite3

# 1. Crea y se conecta al archivo de la base de datos
conexion = sqlite3.connect('asistencia.db')
cursor = conexion.cursor()

# 2. Crea la tabla para registrar a los trabajadores
cursor.execute('''
CREATE TABLE IF NOT EXISTS trabajadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dni TEXT UNIQUE NOT NULL,
    nombres TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    estado TEXT DEFAULT 'ACTIVO'
)
''')

# 3. Crea la tabla para registrar las horas de entrada y salida
cursor.execute('''
CREATE TABLE IF NOT EXISTS asistencia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trabajador_id INTEGER,
    fecha DATE,
    hora_ingreso TIME,
    hora_salida TIME,
    no_laboro BOOLEAN DEFAULT 0,
    observaciones TEXT,
    FOREIGN KEY(trabajador_id) REFERENCES trabajadores(id)
)
''')

# 4. Guarda los cambios y cierra la conexión
conexion.commit()
conexion.close()

print("¡Base de datos y tablas creadas con éxito!")