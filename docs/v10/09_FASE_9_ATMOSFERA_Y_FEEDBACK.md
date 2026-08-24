# V10 · Fase 9 — Atmósfera y feedback de partido

## Objetivo

Dar emoción y personalidad a los remates de la Fase 8 mediante sonido, reacción del estadio y narración breve. La atmósfera refuerza lo que ya ocurrió: nunca modifica fuerza, dirección, efecto, colisiones, arquero, selección matemática o estrellas.

## Sonido

La experiencia reutiliza el sintetizador Web Audio existente y no descarga archivos externos. Los sonidos se activan únicamente después de una interacción del jugador, de acuerdo con las restricciones de navegadores móviles.

Se diferencian:

- respuesta correcta e intento incorrecto;
- contacto con el balón y vuelo;
- gol, atajada, barrera y remate fallido;
- desbloqueo de tablas 6–9;
- final del partido de cinco tiros.

El encabezado incluye un botón accesible para silenciar o activar. La preferencia se conserva localmente en `tlm_v10_sound_enabled`; el valor predeterminado es sonido activo y cualquier fallo de almacenamiento deja el juego operativo.

## Celebraciones

- **Gol:** pulso verde y dorado con confeti breve.
- **Atajada:** destello azul contenido, sin convertir el fallo en castigo.
- **Desbloqueo:** acento violeta y azul.
- **Partido completado:** celebración dorada vinculada al resumen de estrellas.

Los efectos no bloquean botones ni gestos. Con `prefers-reduced-motion` el confeti se elimina y se conserva únicamente un halo estático de baja intensidad.

## Voz del estadio

Cada resultado tiene una frase corta, específica y accionable. El lenguaje reconoce el remate y ofrece una pista sobre dirección, potencia, altura o efecto. No etiqueta al jugador ni confunde el resultado matemático con el futbolístico.

## Privacidad

No se graba audio, no se usa micrófono y no se recopilan datos personales. La única información nueva es la preferencia booleana de sonido almacenada en el navegador.

## QA

Las pruebas unitarias cubren el mapeo de todos los resultados, prioridad de final de partido, desbloqueo y almacenamiento defensivo de la preferencia. El E2E móvil valida el control de silencio, recarga, resumen, celebración final y ausencia de errores de ejecución, además de conservar todos los recorridos de fases anteriores.
