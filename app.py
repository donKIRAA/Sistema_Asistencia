from flask import Flask

#Iniciamos la aplicación
app = Flask(__name__)

# 2. Creamos la ruta principal (la pantalla que el supervisor verá primero)
@app.route('/')
def inicio():
    return "¡El servidor del Sistema de Asistencia está funcionando correctamente!"

# 3. Ejecutamos el servidor local
if __name__ == '__main__':
    # debug=True hace que los cambios se actualicen automáticamente al guardar
    app.run(debug=True, port=5000)