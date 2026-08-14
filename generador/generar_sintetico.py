"""Etapa 2 del dashboard de portafolio: lee parametros_agregados.json (Etapa
1, solo agregados reales — o el archivo de ejemplo mientras no haya
suficiente historial real) y genera dataset.json: un dataset SINTÉTICO
completo (técnicos, registros con ciclo de vida coherente, fotos por
semana) que reproduce esos mismos patrones estadísticos, sin ninguna fila
real.

Continuidad (ver plan): DENTRO de este dataset, los técnicos/registros son
coherentes en toda la ventana de tiempo (mismo plantel, ciclos de vida con
fechas ordenadas). ENTRE corridas de este script, NO hay continuidad —
cada corrida genera una población nueva e independiente (a propósito, ver
plan: no hace falta simular "carrera de empleados", y es más honesto que
se note que es sintético).

Uso:
    python generar_sintetico.py --params parametros_agregados.json --out dataset.json
"""
import argparse
import json
import random
import secrets
from datetime import date, timedelta

from faker import Faker

FAKE = Faker('es_ES')

VENTANA_SEMANAS = 8

# No viene de ningún agregado real — es una suposición razonable para que
# el dataset sintético tenga un volumen creíble de registros en la ventana.
# Si algún día se agrega "registros creados por técnico en el período" a
# parametros_agregados.json (scripts/extraer_agregados_dashboard.py en el
# repo privado), esto debería leerse de ahí en vez de ser una constante.
REGISTROS_POR_TECNICO_PERIODO = 3

# Distritos genéricos de Lima, NO derivados de clusters de clientes reales
# (ver plan — la ubicación real es el dato más sensible del esquema).
DISTRITOS_DEMO = [
    'San Isidro', 'Miraflores', 'Surco', 'La Molina', 'San Borja',
    'Los Olivos', 'Ate', 'Comas', 'Chorrillos', 'San Miguel',
]


def cargar_parametros(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def id_corto():
    """Mismo formato que registros.id real: 8 hex chars (uuid4()[:8])."""
    return secrets.token_hex(4)


def generar_tecnicos(n):
    return [{'id': f't{i + 1}', 'nombre': FAKE.name()} for i in range(max(1, n))]


def elegir_por_peso(opciones_pesos):
    opciones = list(opciones_pesos.keys())
    pesos = [max(w, 0.001) for w in opciones_pesos.values()]
    return random.choices(opciones, weights=pesos, k=1)[0]


def generar_registros_e_historial(params, tecnicos, hoy):
    desde = hoy - timedelta(weeks=VENTANA_SEMANAS)
    dias_ventana = (hoy - desde).days
    cat_pesos = {c['nombre']: c['proporcion_registros'] for c in params['categorias']}
    cat_stats = {c['nombre']: c for c in params['categorias']}
    ciclo = params['tiempo_ciclo_dias']
    prom_ciclo = ciclo.get('promedio_dias') or 4.0
    desv_ciclo = ciclo.get('desvio_dias') or 1.0
    pct_atrasados = params.get('pct_atrasados', 0) / 100.0

    total_registros = max(1, round(len(tecnicos) * REGISTROS_POR_TECNICO_PERIODO))
    registros, historial = [], []

    for _ in range(total_registros):
        rid = id_corto()
        tecnico = random.choice(tecnicos)
        categoria = elegir_por_peso(cat_pesos)
        creado = desde + timedelta(days=random.randint(0, dias_ventana))
        estado = elegir_por_peso(params['distribucion_estados'])

        historial.append({'registro_id': rid, 'estado': 'activo', 'fecha': creado.isoformat()})

        atrasado = False
        if estado == 'completado':
            dias = max(1, round(random.gauss(prom_ciclo, desv_ciclo)))
            fin = min(creado + timedelta(days=dias), hoy)
            historial.append({'registro_id': rid, 'estado': 'completado', 'fecha': fin.isoformat()})
        elif estado == 'cancelado':
            dias = max(1, round(random.gauss(prom_ciclo / 2, desv_ciclo)))
            fin = min(creado + timedelta(days=dias), hoy)
            historial.append({'registro_id': rid, 'estado': 'cancelado', 'fecha': fin.isoformat()})
        elif estado == 'en_revision':
            dias = max(1, round(prom_ciclo * 0.7))
            fecha_er = min(creado + timedelta(days=dias), hoy)
            historial.append({'registro_id': rid, 'estado': 'en_revision', 'fecha': fecha_er.isoformat()})
            atrasado = random.random() < pct_atrasados
        else:  # activo, todavía en curso
            atrasado = random.random() < pct_atrasados

        cat_stat = cat_stats.get(categoria, {})
        base_pct = cat_stat.get('cumplimiento_pct')
        if estado == 'completado':
            cumplimiento = round(min(100, max(0, random.gauss(96, 4))))
        elif base_pct is not None:
            cumplimiento = round(min(100, max(0, random.gauss(base_pct, 8))))
        else:
            cumplimiento = round(min(100, max(0, random.gauss(70, 15))))

        registros.append({
            'id': rid,
            'nombre_proyecto': f'{FAKE.company()} – {random.choice(DISTRITOS_DEMO)}',
            'categoria': categoria,
            'tecnico_id': tecnico['id'],
            'creado_en': creado.isoformat(),
            'estado': estado,
            'atrasado': atrasado,
            'cumplimiento_pct': cumplimiento,
        })

    return registros, historial


def generar_fotos_por_semana(params, tecnicos, hoy):
    stat = params['fotos_por_tecnico_semana']
    promedio = stat.get('promedio', 0)
    desvio = stat.get('desvio') or max(promedio * 0.3, 1)
    filas = []
    for t in tecnicos:
        for semanas_atras in range(VENTANA_SEMANAS - 1, -1, -1):
            dia_en_semana = hoy - timedelta(weeks=semanas_atras)
            lunes = dia_en_semana - timedelta(days=dia_en_semana.weekday())
            cantidad = max(0, round(random.gauss(promedio, desvio)))
            filas.append({'tecnico_id': t['id'], 'semana': lunes.isoformat(), 'cantidad': cantidad})
    return filas


def generar(params):
    hoy = date.today()
    tecnicos = generar_tecnicos(params['total_tecnicos_activos'])
    registros, historial = generar_registros_e_historial(params, tecnicos, hoy)
    fotos_semana = generar_fotos_por_semana(params, tecnicos, hoy)
    return {
        'generado_en': date.today().isoformat(),
        'periodo': {
            'desde': (hoy - timedelta(weeks=VENTANA_SEMANAS)).isoformat(),
            'hasta': hoy.isoformat(),
        },
        'tecnicos': tecnicos,
        'registros': registros,
        'historial_estados': historial,
        'fotos_por_tecnico_semana': fotos_semana,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--params', default='parametros_agregados.json')
    parser.add_argument('--out', default='dataset.json')
    parser.add_argument('--seed', type=int, help='Semilla fija, para pruebas reproducibles')
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)
        Faker.seed(args.seed)

    params = cargar_parametros(args.params)
    dataset = generar(params)

    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    print(f"Generado {args.out}: {len(dataset['tecnicos'])} técnicos, "
          f"{len(dataset['registros'])} registros, "
          f"{len(dataset['historial_estados'])} filas de historial, "
          f"{len(dataset['fotos_por_tecnico_semana'])} filas de fotos/semana.")
    print('Revisá el resultado antes de commitear dataset.json al repo público.')
