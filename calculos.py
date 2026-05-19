from datetime import datetime, time

def calcular_horas(entrada_turno: time, salida_turno: time, entrada_real: time, salida_real: time):
    """
    Motor matemático para procesar las horas de la jornada con redondeo dinámico.
    """
    fecha_base = datetime.today()

    dt_ent_turno = datetime.combine(fecha_base, entrada_turno)
    dt_sal_turno = datetime.combine(fecha_base, salida_turno)
    dt_ent_real = datetime.combine(fecha_base, entrada_real)
    dt_sal_real = datetime.combine(fecha_base, salida_real)

    # 1. Cálculo de Horas Efectivas Trabajadas
    tiempo_total = dt_sal_real - dt_ent_real
    horas_trabajadas = max(tiempo_total.total_seconds() / 3600, 0)

    # 2. Cálculo de Tardanza con Tiempo de Gracia (Ej: 5 minutos de tolerancia)
    minutos_tardanza = 0.0
    if dt_ent_real > dt_ent_turno:
        tardanza = dt_ent_real - dt_ent_turno
        minutos_brutos_tardanza = tardanza.total_seconds() / 60
        
        # Si llega hasta 5 minutos tarde, no se considera tardanza
        if minutos_brutos_tardanza > 5:
            minutos_tardanza = minutos_brutos_tardanza

    # 3. Cálculo de Horas Extra con REDONDEO DINÁMICO
    minutos_extra = 0.0
    if dt_sal_real > dt_sal_turno:
        extra = dt_sal_real - dt_sal_turno
        minutos_extra_brutos = extra.total_seconds() / 60
        
        # REGLAS DE NEGOCIO PARA EXTRAS:
        # - Umbral mínimo: Debe quedarse al menos 15 minutos para que cuente como extra.
        # - Bloque de redondeo: Se cuenta en bloques exactos de 15 minutos (evita fracciones difíciles de pagar).
        UMBRAL_MINIMO = 15
        BLOQUE_REDONDEO = 15
        
        if minutos_extra_brutos >= UMBRAL_MINIMO:
            # División entera (//) para saber cuántos bloques completos de 15 min hizo
            bloques_completos = int(minutos_extra_brutos // BLOQUE_REDONDEO)
            minutos_extra = bloques_completos * BLOQUE_REDONDEO

    return {
        "horas_trabajadas": round(horas_trabajadas, 2),
        "minutos_tardanza": round(minutos_tardanza, 2),
        "minutos_extra": float(minutos_extra)
    }