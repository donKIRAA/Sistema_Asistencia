from datetime import datetime, time

def calcular_horas(entrada_turno: time, salida_turno: time, entrada_real: time, salida_real: time):
    """
    Motor matemático actualizado:
    - Tardanza: Se contabiliza desde el primer minuto.
    - Horas Extra: Umbral de 45 minutos para redondear a 1 hora (ej: 45m = 1h, 1h 45m = 2h).
    """
    fecha_base = datetime.today()

    dt_ent_turno = datetime.combine(fecha_base, entrada_turno)
    dt_sal_turno = datetime.combine(fecha_base, salida_turno)
    dt_ent_real = datetime.combine(fecha_base, entrada_real)
    dt_sal_real = datetime.combine(fecha_base, salida_real)

    # 1. Cálculo de Horas Efectivas Trabajadas
    tiempo_total = dt_sal_real - dt_ent_real
    horas_trabajadas = max(tiempo_total.total_seconds() / 3600, 0)

    # 2. Cálculo de Tardanza (Sin tolerancia: cualquier minuto cuenta)
    minutos_tardanza = 0.0
    if dt_ent_real > dt_ent_turno:
        tardanza = dt_ent_real - dt_ent_turno
        minutos_tardanza = tardanza.total_seconds() / 60

    # 3. Cálculo de Horas Extra (REGLA: A partir de 45 min)
    minutos_extra = 0.0
    if dt_sal_real > dt_sal_turno:
        extra = dt_sal_real - dt_sal_turno
        minutos_extra_brutos = extra.total_seconds() / 60
        
        # Lógica de redondeo:
        # Sumamos 15 minutos al bruto antes de dividir entre 60.
        # Esto hace que 45min (45+15=60) se convierta en 1 hora, y 44min no alcance.
        if minutos_extra_brutos >= 45:
            minutos_extra = ((minutos_extra_brutos + 15) // 60) * 60

    return {
        "horas_trabajadas": round(horas_trabajadas, 2),
        "minutos_tardanza": round(minutos_tardanza, 2),
        "minutos_extra": float(minutos_extra) 
    }