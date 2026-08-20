# Tiro Libre Matemático V9 — paquete de especificación para Manus

## Propósito

Este directorio es el contrato de producto y de ingeniería para que Manus evolucione la repo `AlejoRoldan/videojuego-MartinV2` hacia la versión V9 **Estado de Flujo**.

El objetivo no es reconstruir el juego desde cero. Manus debe partir del código existente, conservar la calidad conseguida en el Sprint QA 2 e integrar una experiencia donde las matemáticas mejoran visiblemente el tiro.

## Línea base verificada

- Repo: `https://github.com/AlejoRoldan/videojuego-MartinV2`
- Rama de referencia al redactar: `codex/qa-core-tests-diagnosis`
- Commit de referencia: `40499b6`
- Stack: React 19, TypeScript, Vite, Tailwind CSS 4, Framer Motion, Vitest y E2E con Chrome/CDP.
- Producto: aplicación web estática; no requiere backend para el alcance V9.
- Persistencia actual: navegador/localStorage.
- Calidad existente: typecheck, pruebas unitarias, cobertura V8, build y recorrido E2E móvil.

## Orden de lectura

| Orden | Archivo | Decisión que contiene |
|---:|---|---|
| 1 | `01_PRD_V9_ESTADO_DE_FLUJO.md` | Qué producto construir y cómo medir su valor |
| 2 | `02_GAME_DESIGN_FLUJO.md` | Cómo debe sentirse el loop y cómo funciona el flujo |
| 3 | `03_ESPECIFICACION_FUNCIONAL.md` | Historias de usuario y criterios verificables |
| 4 | `04_ARQUITECTURA_TECNICA.md` | Cómo integrarlo sin romper el diseño actual |
| 5 | `05_ANALITICA_Y_ADAPTACION.md` | Eventos, perfil de dominio y reglas adaptativas |
| 6 | `06_PLAN_QA.md` | Estrategia de pruebas y Definition of Done |
| 7 | `07_PLAN_IMPLEMENTACION.md` | Secuencia de trabajo, entregas y dependencias |
| 8 | `08_PROMPT_MAESTRO_MANUS.md` | Instrucción lista para pegar en Manus |

## Jerarquía de fuentes

Cuando exista una contradicción, Manus debe resolverla en este orden:

1. Criterios de aceptación y reglas de este paquete V9.
2. Pruebas automatizadas del comportamiento nuevo.
3. Código actual de la repo, que se debe refactorizar de manera incremental.
4. README genérico de la plantilla Manus.

## Brechas conocidas que Manus debe cerrar

1. La rama de GitHub todavía ordena los niveles como direcciones → coordenadas → multiplicación. V9 exige tablas → coordenadas → física → Copa STEM.
2. La física actual usa aleatoriedad en dispersión, portero, barrera y viento. V9 exige que apuntado, animación y resolución compartan un único modelo determinista.
3. El estado adaptativo existe, pero no registra de forma completa tiempo real, rachas por bloque ni dominio separado por concepto.
4. Math Powers existe, pero debe conectarse de forma más explícita con aprendizaje, feedback y progresión por mundos.
5. El CI actual debe preservarse y ampliarse; no debe reemplazarse por verificaciones manuales.

## Restricciones de ejecución

- No eliminar ni debilitar pruebas para hacer pasar el CI.
- No reemplazar el stack salvo bloqueo técnico demostrado.
- No introducir backend, autenticación, anuncios, compras ni cuentas sociales en V9.
- No usar azar oculto para decidir si un tiro idéntico es gol o fallo.
- No presentar las matemáticas como castigo o pantalla desconectada del fútbol.
- No modificar simultáneamente dificultad matemática, futbolística y temporal.
- Conservar accesibilidad, experiencia táctil, responsive móvil y `prefers-reduced-motion`.

## Resultado esperado

Una rama lista para Pull Request que incluya implementación, migración segura de progreso, documentación actualizada y CI completamente verde.
