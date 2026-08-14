# Dashboard de eficiencia operativa — caso de estudio

**[Ver el dashboard en vivo →](https://gaff05.github.io/field-ops-efficiency-dashboard/)**

Un dashboard de eficiencia operativa (fotos por técnico, cumplimiento de
checklist por categoría, atrasados, tiempo de ciclo) para una empresa de
servicios de campo — con **datos 100% sintéticos**, generados a partir de
patrones agregados de un sistema real en producción. Es una pieza de
portafolio, no una herramienta interna: la metodología es lo que importa
acá, no un dashboard más.

## El problema real detrás de esto

Construí una PWA de registro fotográfico para **North Company**, una
empresa de instalaciones de gas en Perú. Los técnicos documentan
instalaciones en terreno (con soporte offline — señal irregular en obra),
supervisores gestionan y aprueban ese trabajo, y las fotos quedan
organizadas en Google Drive con fecha/dirección quemadas en la imagen.

Esa aplicación sigue privada (tiene datos reales de clientes) — este
repo toma solo los **patrones agregados** de su uso operativo y los
convierte en un dataset inventado con la misma forma estadística, para
poder mostrar el tipo de análisis que la app real habilita, sin exponer
nada de lo que contiene.

**Decisiones de arquitectura de la app real que vale la pena destacar**
(la parte de ingeniería, no de datos):
- **Offline-first de verdad**: los técnicos cargan fotos sin señal
  (Service Worker + IndexedDB), con sincronización en segundo plano que
  respeta el orden cronológico por casillero — una foto vieja nunca le
  gana la carrera de red a una más nueva.
- **Postgres para metadata, Drive para los archivos**: las fotos pesadas
  nunca tocan la base de datos — solo su referencia. Mantiene la base
  chica y rápida, y aprovecha el storage/CDN de Drive para lo que ya
  resuelve bien.
- **FOREIGN KEYs + auditoría real**: el esquema hace cumplir su propia
  integridad referencial (no solo por convención en el código), y cada
  acción destructiva queda en un log de auditoría separado que sobrevive
  al borrado de lo que describe.

## La metodología de este dashboard

**No son datos reales, ni siquiera anonimizados.** En una empresa chica,
anonimizar (sacar nombres) no alcanza — los patrones y tiempos por sí
solos pueden re-identificar a alguien. En cambio:

1. **Extracción de agregados** (vive en el repo privado de la app, nunca
   acá): consultas de **solo agregados** — promedios, proporciones,
   conteos — contra la base real. Nunca una fila, nunca un nombre.
2. **Generación sintética** (`generador/generar_sintetico.py`, en este
   repo, código abierto): un generador con `Faker` construye técnicos y
   registros **inventados** que reproducen esos mismos patrones — mismo
   volumen, misma distribución por categoría, mismo tiempo de ciclo
   promedio — pero ninguna entidad es real.

El refresco es **manual**, no un pipeline en vivo contra producción — así
cada actualización pasa por revisión humana antes de publicarse, y la app
real nunca queda con una conexión permanente hacia afuera. El detalle
completo de cada decisión (por qué este stack, por qué manual, qué pasa
si dejo la empresa, cómo se generan los ciclos de vida de los registros
sintéticos) está en **[PLANNING.md](PLANNING.md)**.

## Cómo confío en que esto es creíble sin mostrar datos reales

No intento probar que el dato es real — pruebo que el **sistema** detrás
es real. El código de extracción de agregados y el generador están acá,
completos, para revisar. La app real existe y está en uso — puedo
mostrarla funcionando (por pantalla compartida, o corriendo localmente
sembrada con este mismo dataset sintético) en una entrevista.

## Stack

- **Extracción y generación**: Python (`psycopg2` para agregados,
  `Faker` para los datos sintéticos).
- **Dashboard**: HTML + JS plano, [Chart.js](https://www.chartjs.org/)
  por CDN. Sin build step, sin framework — mismo criterio que la app
  real. Hosteado gratis en GitHub Pages, sin backend: la página lee
  `data/dataset.json` directo con `fetch()`.

## Correrlo local

```bash
# Regenerar el dataset sintético (con los parámetros de ejemplo, mientras
# no haya suficiente historial real — ver PLANNING.md):
pip install -r generador/requirements.txt
python generador/generar_sintetico.py \
  --params generador/parametros_agregados_ejemplo.json \
  --out data/dataset.json

# Servir el dashboard (fetch() necesita HTTP, no funciona con file://):
python -m http.server 8000
# → http://localhost:8000
```

## Licencia de los datos

Todo lo que hay en `data/dataset.json` es ficticio: nombres, empresas,
direcciones, fechas. Cualquier parecido con una persona o empresa real es
coincidencia del generador aleatorio, no un dato real transformado.
