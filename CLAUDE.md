# Plan y decisiones de diseño

Este documento existe para que el proyecto se sostenga solo — cualquiera
que clone este repo (incluida otra PC de Gabriel, o una sesión nueva de
Claude Code) tiene acá el contexto completo, sin depender de ningún
archivo local fuera del repo.

## Qué es esto

Dashboard público de "eficiencia operativa" para el portafolio de Gabriel
Candia (roles de Business Intelligence/Analytics). Muestra métricas reales
en su forma (fotos por técnico/semana, % cumplimiento por categoría,
atrasados vs. a tiempo, tiempo de ciclo) pero con **datos 100% sintéticos**
— nunca una fila real de la aplicación que le dio origen.

La aplicación real (`NC-Informes`, registro fotográfico de instalaciones de
gas para North Company) sigue privada. Este repo es una pieza separada y
chica: solo el dashboard + el generador de datos + este documento.

## Por qué datos sintéticos, no reales ni anonimizados

Con una empresa chica, anonimizar (sacar nombres) no alcanza — los
patrones/tiempos/proporciones por sí solos pueden re-identificar a alguien.
En cambio: agregados reales (proporciones, promedios, nunca filas) →
generador sintético que reproduce esos patrones con entidades inventadas.

## Cómo se genera el dataset — dos etapas

1. **Etapa 1 (agregados reales)** — vive en el repo PRIVADO de la app real
   (`scripts/extraer_agregados_dashboard.py`), nunca acá. Consulta SOLO
   agregados (conteos, promedios, proporciones — nunca filas) contra la
   base de producción, y escribe `parametros_agregados.json`. Manual,
   corrida por Gabriel a mano cuando quiera "refrescar" el dashboard —
   nunca un cron contra producción (más riesgo de credencial expuesta en
   infra pública + sin revisión humana + necesitaría OK explícito de
   North Company).
2. **Etapa 2 (generador sintético)** — `generador/generar_sintetico.py`,
   en este repo. Lee `parametros_agregados.json` (el real, o
   `parametros_agregados_ejemplo.json` mientras no haya suficiente
   historial real — ver más abajo) y produce `data/dataset.json`: técnicos
   y registros **inventados**, pero con las mismas proporciones/promedios
   que los reales. Es lo único que lee el dashboard (`index.html`), vía
   `fetch()` en el navegador — sin backend.

**Estado actual (2026-08-14):** producción todavía tiene muy poco volumen
real (marcha blanca reciente, la mayoría de los registros históricos se
purgaron por ser de prueba) — la primera corrida real de la Etapa 1 dio
números degenerados (ej. "100% atrasados" con un solo registro en toda la
base). `data/dataset.json` de este repo usa por ahora
`generador/parametros_agregados_ejemplo.json` (números de ejemplo,
razonables a mano, claramente marcados como tal) — **no representan
patrones reales todavía**. Cuando haya más historial real de uso, correr
la Etapa 1 de verdad y reemplazar el archivo de parámetros.

## Continuidad dentro de un dataset vs. entre refrescos

- **Dentro de UN dataset generado:** los técnicos y registros sintéticos
  tienen continuidad — mismo plantel a lo largo de toda la ventana de
  tiempo (8 semanas), cada registro con un ciclo de vida coherente
  (`activo` → tal vez `en_revision` → `completado`/`cancelado`, con fechas
  en orden). Sin esto, un gráfico de tendencia no tendría sentido.
- **Entre un refresco y el siguiente:** NO hay continuidad — cada corrida
  del generador crea una población nueva e independiente. No se simula
  "el mismo técnico sintético que sigue trabajando desde el mes pasado".
  Motivo: los gráficos son agregados (no dependen de que persista una
  identidad falsa) y es más honesto que se note que es sintético — no una
  simulación de carrera de empleados ficticios.

## Qué pasa cuando Gabriel deje North Company

El dataset publicado nunca tuvo datos reales — no hay nada que
"desactualizar" en ese sentido. Lo único que se pierde es la posibilidad
de correr la Etapa 1 de nuevo (acceso a producción, como corresponde). El
último `dataset.json` generado queda congelado y sigue siendo un
portafolio válido indefinidamente — el dashboard, el generador (leyendo
sus últimos parámetros guardados) y este repo entero siguen funcionando
sin ninguna dependencia de la empresa. La fecha de generación queda
explícita en `data/dataset.json` (`generado_en`) y se muestra en el
dashboard, para que "sin actualizar hace tiempo" se lea como decisión
metodológica, no como abandono.

## Stack: por qué HTML+JS estático (Chart.js) + GitHub Pages

Evaluado contra Power BI publicado y Streamlit — elegido por: cero
dependencia externa (nada que un tercero pueda cambiar de política o
dejar "dormido" justo cuando alguien abre el link), código 100%
inspeccionable en este repo, y gratis para siempre sin condiciones. El uso
real de Power BI para el CV de Gabriel ya está cubierto por trabajo
genuino en la app privada (endpoints de exportación a CSV construidos
para uso interno de North Company) — este dashboard no necesita cargar
también con esa señal.

## Automatización

La Etapa 1 (agregados reales) es 100% manual — nunca un cron contra
producción. La Etapa 2 (este generador) SÍ se automatiza con un GitHub
Action programado (`.github/workflows/refrescar-dataset.yml`, Fase 6,
**HECHO 2026-08-14**) que relee `parametros_agregados.json` y recommitea
`dataset.json` — no toca la base real ni ninguna credencial, solo
resamplea. Diseñado para correr semanal (lunes 09:00 UTC) + botón manual
(`workflow_dispatch`) desde la pestaña Actions. Nunca dispara por `push`
(evita loop contra su propio commit). Usa `generador/parametros_agregados.json`
si existe (el real) o si no `parametros_agregados_ejemplo.json` (lo que
hay hoy) — el mensaje de commit automático distingue cuál de los dos usó,
para no pisar la narrativa de "sin datos reales todavía" con una fecha
que se ve falsamente fresca. Commitea como `github-actions[bot]`, nunca
a nombre de Gabriel. Gratis en sí mismo: GitHub Actions no tiene costo en
repos públicos (confirmado — uso medido de esta prueba: Gross $0.10,
Billed $0.00, cubierto por el descuento gratuito).

**Estado (2026-08-14): schedule PAUSADO.** Todos los intentos de correr
el Action (manual, vía `gh workflow run`) fallan con "The job was not
started because your account is locked due to a billing issue" — pese a
que Settings > Billing de la cuenta de GitHub no muestra ninguna causa
(sin tarjeta fallida, sin factura vencida, "You have not made any
payments"). Se probó quitar una tarjeta vieja y esperar ~30 min por
posible caché de propagación — sin cambio. Caso pendiente con soporte de
GitHub (support.github.com). Mientras tanto, el bloque `schedule:` del
workflow está comentado (queda solo `workflow_dispatch`, para no
ensuciar la pestaña Actions con fallos semanales) y **la Etapa 2 se
corre a mano** (ver más abajo) igual que antes de la Fase 6. Para
reactivar el cron una vez resuelto con soporte: descomentar el bloque
`schedule:` en `.github/workflows/refrescar-dataset.yml`.

**Refresco manual (mientras el cron esté pausado), desde la raíz del
repo:**
```powershell
cd generador
pip install -r requirements.txt   # solo si falta Faker
python generar_sintetico.py --params parametros_agregados_ejemplo.json --out ../data/dataset.json
cd ..
git add data/dataset.json
git commit -m "Refresco manual del dataset sintético"
git push
```
(Cambiar `--params` a `parametros_agregados.json` cuando exista el
real.)

## Estructura del repo

```
.github/workflows/
  refrescar-dataset.yml       # Fase 6, HECHO — cron semanal, corre la Etapa 2
generador/
  generar_sintetico.py       # Etapa 2 — lee parámetros, escribe data/dataset.json
  parametros_agregados_ejemplo.json  # placeholder mientras no haya suficiente historial real
  requirements.txt
data/
  dataset.json                # lo único que lee el dashboard
index.html                    # Fase 3, HECHO (2026-08-14)
assets/dashboard.js            # Fase 3, HECHO
README.md                     # Fase 4, HECHO (2026-08-14)
```

**GitHub Pages: activado y verificado** — https://gaff05.github.io/field-ops-efficiency-dashboard/

## Pendiente (no implementado todavía)

- ~~Fase 3: `index.html` con los gráficos~~ — **HECHO (2026-08-14)**, mismo
  patrón visual que `supervisor.html` en la app real (paleta ya validada
  contra daltonismo, mark specs). Probado con Playwright contra un server
  local — stats, gráficos y filtro interactivo por técnico funcionando.
- ~~Fase 4: `README.md` tipo caso de estudio~~ — **HECHO (2026-08-14)**.
- ~~Fase 5: script/doc en el repo PRIVADO para sembrar la app real local
  con este mismo `dataset.json`, para demos en entrevistas.~~ — **HECHO
  (2026-08-14)**, en `NC-Informes` (commit `d549c35`), coordinado por
  relay manual entre esa sesión y esta (el usuario pasó mensajes entre
  las dos terminales). Detalle relevante para quien retome esto:
  - `scripts/sembrar_desde_dataset_publico.py` en `NC-Informes` lee
    `../field-ops-efficiency-dashboard/data/dataset.json` (ruta relativa
    entre las dos carpetas hermanas) y siembra una DB local aparte
    (`northcompany_demo.db`, gitignoreada) — nunca `northcompany.db` ni
    Postgres de producción (corta si detecta `DATABASE_URL` seteada).
    Pide confirmación escribiendo "SEMBRAR" (`--yes` para saltarla).
  - Como `cumplimiento_pct`/`atrasado` no son columnas reales (se
    calculan en vivo), el script los reproduce generando un checklist
    sintético de 10 ítems por registro y completando los que hagan falta
    para el mismo %, más fechas corridas por offset (`hoy − periodo.hasta`)
    para que los gráficos de "últimos N días" nunca queden vacíos sin
    importar cuánto tiempo pase entre generar el dataset y hacer la demo.
  - Logins de demo: `demo_supervisor` / `demo_admin` / `demo_t1..demo_tN`,
    contraseña `Demo1234` (creados por el script — el dataset público no
    trae credenciales).
  - Documentado en el README de `NC-Informes`, sección "🎤 Demo con datos
    sintéticos (para entrevistas)".
- ~~Fase 6 (opcional): automatizar la Etapa 2 vía GitHub Action.~~ —
  **HECHO (2026-08-14)**, ver sección "Automatización" arriba.

Sin pendientes nuevos por ahora — las 6 fases del plan original están
hechas. Próximo hito natural: cuando haya suficiente historial real en
producción, correr la Etapa 1 de verdad en el repo privado y agregar
`generador/parametros_agregados.json` (el Action lo detecta solo, sin
tocar el workflow).

**El trabajo de este repo se retoma en una sesión de Claude Code rooteada
en esta carpeta. Cuando haga falta algo del lado de `NC-Informes` (repo
privado, carpeta hermana), coordinar por relay manual: el usuario pasa
mensajes entre las dos terminales — no hay canal en vivo entre sesiones
de Claude Code ni memoria compartida entre ellas. Ver el historial de
commits/este documento para todo el contexto necesario.**
