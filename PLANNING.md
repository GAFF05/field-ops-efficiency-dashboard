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
producción. La Etapa 2 (este generador) SÍ puede automatizarse con un
GitHub Action programado que relea `parametros_agregados.json` y
recommitee un `dataset.json` nuevo — no toca la base real ni ninguna
credencial, solo resamplea. Queda como posible mejora futura, no
implementada todavía.

## Estructura del repo

```
generador/
  generar_sintetico.py       # Etapa 2 — lee parámetros, escribe data/dataset.json
  parametros_agregados_ejemplo.json  # placeholder mientras no haya suficiente historial real
  requirements.txt
data/
  dataset.json                # lo único que lee el dashboard
index.html                    # Fase 3, pendiente
README.md                     # Fase 4, pendiente — caso de estudio
```

## Pendiente (no implementado todavía)

- Fase 3: `index.html` con los gráficos (Chart.js, mismo patrón visual que
  `supervisor.html` en la app real).
- Fase 4: `README.md` tipo caso de estudio.
- Fase 5: script/doc en el repo PRIVADO para sembrar la app real local con
  este mismo `dataset.json`, para demos en entrevistas.
- Fase 6 (opcional): automatizar la Etapa 2 vía GitHub Action.
- Activar GitHub Pages una vez que `index.html` exista.
