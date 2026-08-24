# V10 · Fase 8 — Misiones de partido

## Objetivo

Convertir el ciclo técnico de cálculo y remate en un partido breve con inicio, avance, cierre y revancha. La fase añade propósito de juego sin modificar la física del tiro, el selector adaptativo ni los criterios de dominio matemático.

## Estructura de la misión

Cada partido contiene cinco remates. Completar los cinco siempre cuenta como el logro principal; los resultados futbolísticos y matemáticos son bonificaciones independientes:

- **Finalización:** completar cinco remates otorga una estrella.
- **Definición:** marcar al menos dos goles otorga una estrella adicional.
- **Precisión matemática:** resolver al menos tres operaciones al primer intento otorga una estrella adicional.

Una atajada, un tiro desviado o una respuesta con ayuda no impiden finalizar el partido. El mensaje de cierre reconoce la práctica y propone una revancha en lugar de castigar el error.

## Experiencia visible

- Encabezado `Cinco tiros, una misión`.
- Marcador permanente de tiro actual, goles, respuestas al primer intento y número de partido.
- Resumen después del quinto remate con una a tres estrellas.
- Bonificaciones explicadas con metas visibles desde el primer tiro.
- Botón `JUGAR REVANCHA` que inicia otro partido y conserva el progreso adaptativo de tablas.
- Sin coordenadas, temporizador ni presión por velocidad.

## Persistencia y privacidad

La sesión se guarda localmente en `tlm_v10_match_mission_v1`. Conserva únicamente:

- número secuencial del partido;
- máximo cinco resultados booleanos de gol;
- máximo cinco resultados booleanos de acierto al primer intento.

No contiene nombre, edad, correo, respuestas concretas ni identificadores. Los datos corruptos o fuera de rango se normalizan y nunca bloquean el juego.

## Contratos técnicos

`matchMission.ts` es un módulo puro e independiente de React. Centraliza creación, normalización, registro de remates, resumen, revancha y almacenamiento defensivo. El componente registra el remate después de que termina la trayectoria, en el mismo punto donde la fase 7 actualiza el progreso matemático.

Reglas protegidas:

1. Un partido nunca supera cinco resultados.
2. Matemática y fútbol se contabilizan por separado.
3. La revancha limpia solamente la misión actual.
4. El progreso de tablas no se reinicia al empezar la revancha.
5. Ninguna regla de misión cambia fuerza, dirección, efecto, colisiones o defensa.

## QA

Las pruebas unitarias cubren creación, registro independiente, estrellas, límite de cinco tiros, revancha, normalización, persistencia y fallos de almacenamiento. El E2E móvil valida marcador inicial, avance, recarga, cierre del quinto tiro, resumen y reinicio de revancha, además de conservar todas las verificaciones adaptativas de la fase 7.

## Validación con jóvenes

El feedback de Martín y de los tres jóvenes invitados se registrará como evidencia de producto. Los principales indicadores serán comprensión del primer remate, coherencia percibida del tiro, claridad del marcador, deseo de revancha y fricción causada por las multiplicaciones.
