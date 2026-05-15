# Ideas de Diseño — Tiro Libre Matemático

## Contexto
Videojuego educativo para Martín (11 años). Fútbol + Matemáticas. Debe sentirse como un indie game profesional, no como una app escolar.

---

<response>
<probability>0.07</probability>
<text>

## Opción A — "Neon Street Stadium"

**Design Movement:** Neo-brutalism + Arcade Neon (inspirado en FIFA Street + Brawl Stars)

**Core Principles:**
1. Contraste extremo: fondos oscuros con colores neón vibrantes
2. Tipografía pesada y bold como en carteles de estadio
3. Feedback visual instantáneo y exagerado (squash & stretch)
4. UI que "respira" — elementos que pulsan y vibran con la acción

**Color Philosophy:**
- Fondo: Azul marino profundo (#0A0E27) — como la noche en un estadio iluminado
- Primario: Verde neón (#39FF14) — el césped eléctrico
- Acento: Amarillo dorado (#FFD700) — trofeos y estrellas
- Peligro/Error: Rojo coral (#FF4757)
- Texto: Blanco puro con sombras de color

**Layout Paradigm:**
- Pantalla de juego ocupa 100% del viewport
- HUD flotante en esquinas, no en barras fijas
- Elementos matemáticos integrados en el campo de juego
- Menús como "tarjetas de estadio" que se deslizan desde los bordes

**Signature Elements:**
1. Líneas de luz neón que trazan la trayectoria del balón
2. Números matemáticos que "explotan" en partículas al acertar
3. Fondo de estadio con luces bokeh animadas

**Interaction Philosophy:**
- Cada acción tiene una reacción visual inmediata y exagerada
- Los errores no son castigos — son "rebotes" con feedback amigable
- El campo cartesiano se ilumina progresivamente al usarlo

**Animation:**
- Balón: física con squash al impacto, stretch en vuelo
- Gol: explosión de partículas + slow-motion + cámara zoom
- Números: aparecen con bounce, desaparecen con fade + escala
- Transiciones entre pantallas: slide con momentum (ease-out fuerte)
- Duración: 150-300ms para UI, 500-800ms para celebraciones

**Typography System:**
- Display: "Fredoka One" — redondeado, amigable, bold
- Body: "Nunito" — legible, amigable para niños
- Números matemáticos: "Orbitron" — futurista, de videojuego

</text>
</response>

<response>
<probability>0.06</probability>
<text>

## Opción B — "Pixel Champions" (ELEGIDA)

**Design Movement:** Modern Pixel Art + Supercell Cartoon (inspirado en Brawl Stars + Nintendo + Pokémon)

**Core Principles:**
1. Colores saturados y vibrantes sobre fondos sólidos con textura
2. Bordes gruesos (2-4px) en todos los elementos — estilo cómic/cartoon
3. Sombras duras (drop shadows sin blur) para dar profundidad
4. Proporciones exageradas — botones grandes, iconos oversized

**Color Philosophy:**
- Fondo primario: Verde césped saturado (#2ECC40) con textura de hierba
- Sky: Azul cielo brillante (#87CEEB) con nubes
- UI Cards: Blanco con borde negro grueso + sombra amarilla
- Primario: Naranja vibrante (#FF6B35) — energía y acción
- Secundario: Azul royal (#3742FA) — coordenadas y matemáticas
- Éxito: Verde lima (#7BED9F)
- Error: Rojo tomate (#FF4757)
- Gold/XP: Amarillo dorado (#FFA502)

**Layout Paradigm:**
- Campo de fútbol como escenario central (perspectiva isométrica leve)
- HUD en la parte superior como "banda de estadio"
- Panel matemático emerge desde abajo como un "tablero táctico"
- Portería con cuadrícula cartesiana superpuesta

**Signature Elements:**
1. Personaje jugador con animaciones cartoon (idle, kick, celebrate)
2. Balón con cara expresiva que reacciona a los resultados
3. Números matemáticos como "power-ups" flotantes en el campo

**Interaction Philosophy:**
- Tap/click en el campo para apuntar — visual inmediato
- Deslizar para potencia — barra con animación de carga
- Resolver matemáticas = desbloquear el "poder" del tiro

**Animation:**
- Personaje: idle bounce sutil, kick con anticipación + follow-through
- Balón: arco parabólico con spin visual, impacto con squash
- Gol: confetti + estrellas + texto "¡GOL!" con bounce
- Números: aparecen con pop (scale 0.8→1.1→1.0), desaparecen con sparkle
- Transiciones: slide horizontal entre pantallas (como páginas de cómic)

**Typography System:**
- Display: "Fredoka One" — redondeado, cartoon, perfecto para niños
- Body: "Nunito Bold" — legible, amigable
- Score/Numbers: "Boogaloo" — casual, divertido, de videojuego

</text>
</response>

<response>
<probability>0.05</probability>
<text>

## Opción C — "Tactical Board" 

**Design Movement:** Sports Analytics + Glassmorphism (inspirado en FIFA Ultimate Team + Duolingo)

**Core Principles:**
1. Glassmorphism sobre fondos de estadio fotorrealista
2. Gradientes azul-verde como pantallas de análisis táctico
3. Datos y números como elementos de diseño principales
4. Sensación de "sala de control de entrenador profesional"

**Color Philosophy:**
- Fondo: Foto de estadio con overlay oscuro + blur
- Cards: Vidrio esmerilado (backdrop-filter: blur)
- Primario: Cyan eléctrico (#00D2FF)
- Acento: Verde esmeralda (#00B894)
- Texto: Blanco con opacidad variable

**Layout Paradigm:**
- Pantalla dividida: campo izquierda, panel táctico derecha
- Plano cartesiano siempre visible como overlay del campo
- Datos matemáticos en cards flotantes con glassmorphism

**Signature Elements:**
1. Líneas de análisis táctico (como TV de fútbol)
2. Heatmaps de probabilidad de gol
3. Estadísticas en tiempo real con gráficas animadas

**Interaction Philosophy:**
- Precisión y estrategia sobre velocidad
- Feedback analítico: "Tu ángulo fue X°, necesitabas Y°"
- Progresión visible con dashboards de estadísticas

**Animation:**
- Líneas tácticas que se dibujan progresivamente
- Datos que se actualizan con counter animations
- Transiciones con fade + scale suave

**Typography System:**
- Display: "Rajdhani" — técnico, deportivo
- Body: "IBM Plex Sans" — analítico, preciso
- Data: "JetBrains Mono" — monoespaciado para números

</text>
</response>

---

## DECISIÓN FINAL: Opción B — "Pixel Champions"

**Razón:** Es la que mejor combina la energía de Brawl Stars/Nintendo con la claridad de Duolingo para niños de 11 años. Los colores saturados, bordes gruesos y animaciones cartoon crean una experiencia inmediatamente reconocible como "videojuego de verdad" sin sentirse escolar. La filosofía de "números como power-ups" hace que las matemáticas sean el motor de la diversión, no un obstáculo.
