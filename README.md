# GOL LAB · versión_astra

Prototipo jugable de tiros libres para aprender multiplicación y división, con estética deportiva para adolescentes.

**Jugar:** https://gol-lab-martin.alejor.chatgpt.site

El sitio tiene acceso privado desde la cuenta de su propietario. Compartir esta URL no concede acceso automáticamente.

## Esta rama

Rama: `versión_astra` (con tilde). Parte de `main` en el commit `bfc81e18127f509728229bb438f603403ad8f009`.

El código completo de GOL LAB está en [astra/](astra/). Es una aplicación estática independiente. Los proyectos y herramientas anteriores permanecen en sus directorios; su documentación original está en [README.previous.md](README.previous.md). Los comandos del proyecto React de la raíz no ejecutan GOL LAB.

## Ejecutar GOL LAB

Desde la raíz del repositorio:

```bash
git switch versión_astra
python3 -m http.server 8000 --directory astra
```

Abrir http://localhost:8000 en el navegador. No requiere instalar dependencias ni compilar. Python 3 se utiliza únicamente como servidor local; el juego se ejecuta en el navegador.

## Código

| Archivo | Responsabilidad |
| --- | --- |
| `astra/index.html` | Pantalla de juego, controles, marcadores y ligas |
| `astra/style.css` | Estética, tipografía y adaptación a móvil |
| `astra/game.js` | Operaciones, estados, tiros, animación Canvas, sonido y progreso |

Se emplean HTML, CSS, JavaScript, Canvas 2D, Web Audio y localStorage. Las fuentes de Google Fonts requieren conexión; hay fuentes de respaldo. No hay backend, cuentas de jugador ni sincronización entre dispositivos.

## Cómo jugar

1. Elegir multiplicar, dividir o modo mixto.
2. Resolver la operación. No hay límite de tiempo; se puede pedir una pista.
3. Tocar el arco para apuntar o ajustar dirección y altura con los controles.
4. Elegir la potencia y pulsar **DISPARAR**.
5. Revisar el resultado y completar cinco tiros. La misión es marcar al menos tres goles.

Con el foco en la cancha, las flechas ajustan la puntería y la barra espaciadora dispara. Los controles HTML también se pueden manejar con teclado.

Resolver correctamente habilita el disparo. El gol depende de la puntería y la potencia, con reglas deterministas para portero, barrera y salida del arco. Una respuesta incorrecta permite corregir con ayuda.

## Progresión

| Liga | Requisito | Operaciones |
| --- | --- | --- |
| La cantera | 0 XP | Tablas del 2 al 5 y divisiones exactas |
| Liga ascenso | 180 XP | Tablas del 3 al 9 y divisiones exactas |
| Noche de final | 420 XP | Tablas del 6 al 12 y divisiones exactas |

El segundo factor varía de 2 a 12. Las divisiones se generan a partir de productos, siempre con resultado entero.

- Acierto inicial sin pista: **20 XP**.
- Acierto con pista o tras un error: **10 XP**.
- Gol: **15 XP**.
- Marcar tres o más goles en un partido: **60 XP adicionales**.
- Las rachas cuentan aciertos iniciales sin ayuda.
- Las operaciones falladas pueden reaparecer para repasarlas durante la sesión.

XP y récord se guardan en la clave `gol-lab-v1` del navegador. No se guardan el partido en curso ni la cola de repaso. Cambiar de liga inicia un nuevo partido. El progreso local y el del sitio publicado son independientes por origen.

## Publicación

Los tres archivos de `astra/` corresponden al prototipo publicado el 7 de septiembre de 2026 en el enlace anterior. Se pueden alojar en cualquier servidor estático usando `astra/` como directorio público.

Esta rama es una copia del código publicado: subir cambios a GitHub no actualiza automáticamente el sitio. Una futura actualización necesita publicación independiente. No se incluyen credenciales ni configuración de identidad del alojamiento.

## Validación y límites

Se verificó la sintaxis JavaScript y, con un entorno DOM simulado, el ciclo de cinco tiros, puntuación, récord, reintentos, 100 rondas de división y casos de gol, atajada, barrera y potencia.

```bash
node --check astra/game.js
```

No se ejecutó una prueba visual o E2E en navegador para este prototipo. Las pruebas existentes del proyecto React no cubren automáticamente `astra/`.

Es una base Canvas 2D con perspectiva, física simplificada y personajes geométricos. No implementa realismo 3D, multijugador, división con residuo, evaluación formal de dominio ni dificultad adaptativa completa. Las ligas cambian el rango matemático y la ambientación; el modelo del portero y la barrera permanece igual.

## Siguientes pasos propuestos

1. Probar sesiones con el jugador: comprensión de controles, relación entre puntería y resultado, deseo de repetir.
2. Mejorar modelos y animaciones de cancha, jugador y portero.
3. Incorporar dominio por tabla y repaso espaciado con persistencia.
4. Ampliar división a problemas contextuales y residuos.
5. Evaluar la integración de las mecánicas validadas en el proyecto principal.
