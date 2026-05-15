# ⚽ Tiro Libre Matemático — Versión 2

**Videojuego educativo de matemáticas y fútbol para Martín Roldán.**

Desarrollado con React 19 + TypeScript + Tailwind CSS 4. Diseño visual estilo **Pixel Champions** (inspirado en Brawl Stars + Nintendo).

---

## 🎮 ¿Cómo se juega?

1. **Elige un nivel** — hay 8 niveles de dificultad progresiva.
2. **Apunta** — toca la celda de la portería donde quieres disparar (coordenadas cartesianas).
3. **Resuelve la matemática** — aparece una multiplicación; si aciertas, tu tiro tiene más potencia.
4. **¡A tirar!** — el balón vuela hacia el objetivo. El portero intentará atajarlo.
5. **Acumula combos** — goles consecutivos multiplican tus puntos.

---

## 📚 Contenido educativo (8 niveles)

| Nivel | Nombre | Concepto STEM |
|-------|--------|---------------|
| 1 | Entrenamiento | Direcciones y orientación espacial |
| 2 | El Portero | Coordenadas en el primer cuadrante |
| 3 | Multiplicación Power | Tablas de multiplicar |
| 4 | Plano Cartesiano | Los 4 cuadrantes (positivos y negativos) |
| 5 | La Barrera | Ángulos y geometría |
| 6 | Trayectorias | Curvas y trayectorias parabólicas |
| 7 | Velocidad y Fuerza | Velocidad, fuerza y viento |
| 8 | Copa Matemática | Integración de todos los conceptos |

---

## 🛠️ Stack tecnológico

- **React 19** + **TypeScript** — arquitectura de componentes
- **Tailwind CSS 4** — sistema de diseño
- **Framer Motion** — animaciones y transiciones
- **Web Audio API** — sistema de sonidos sintetizados
- **Vite 7** — bundler y dev server
- **localStorage** — persistencia del progreso del jugador

---

## 🚀 Instalación y desarrollo

\`\`\`bash
# Instalar dependencias
pnpm install

# Servidor de desarrollo
pnpm dev

# Build de producción
pnpm build
\`\`\`

---

## 📁 Estructura del proyecto

\`\`\`
client/src/
  game/
    engine/         ← Motor del juego (GameContext, gameReducer, physics, sounds)
    levels/         ← Configuración de los 8 niveles
    math/           ← Generador de desafíos matemáticos
    screens/        ← Pantallas (Home, LevelSelect, Gameplay, Victory, Defeat...)
  components/       ← Componentes UI reutilizables
  pages/            ← Páginas de la app
\`\`\`

---

## 🎨 Características técnicas

- **Mobile-first**: botones con \`touchAction: manipulation\` y \`onPointerDown\` para respuesta instantánea en iOS/Android.
- **Safe-area**: padding adaptado para iPhones con notch.
- **Dificultad adaptativa**: si el jugador falla repetidamente, el sistema activa pistas y agranda los objetivos.
- **Progreso persistente**: el progreso se guarda automáticamente en el dispositivo.

---

*Creado con ❤️ para Martín Roldán — que las matemáticas sean siempre un gol.*
