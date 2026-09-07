import { FIELD, SCENARIOS, pathPoint } from './core/physics.mjs';

/** Stateless Canvas renderer. Collision geometry belongs exclusively to physics. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no está disponible en este navegador.');
  const line = (x1, y1, x2, y2, color = '#d8ebd6', width = 2) => {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  const poly = (points, color) => {
    ctx.fillStyle = color; ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p));
    ctx.closePath(); ctx.fill();
  };
  const person = (x, y, scale, shirt, keeper = false, catchPoint = null) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.fillStyle = '#001d2080'; ctx.beginPath(); ctx.ellipse(0, 4, 23, 7, 0, 0, Math.PI * 2); ctx.fill();
    line(-7, -22, -12, 0, '#14252c', 9); line(7, -22, 13, 0, '#14252c', 9);
    line(-13, 0, -20, 0, '#f2ffac', 5); line(13, 0, 20, 0, '#f2ffac', 5);
    poly([[-14, -57], [14, -57], [12, -22], [-12, -22]], shirt);
    const hand = catchPoint ? { x: (catchPoint.x - x) / scale, y: (catchPoint.y - y) / scale } : null;
    line(-12, -50, hand ? hand.x - 5 : keeper ? -37 : -20, hand ? hand.y : keeper ? -47 : -29, shirt, 9);
    line(12, -50, hand ? hand.x + 5 : keeper ? 37 : 20, hand ? hand.y : keeper ? -47 : -29, shirt, 9);
    if (hand) { line(hand.x - 7, hand.y, hand.x + 7, hand.y, '#f9fff2', 9); }
    ctx.fillStyle = '#bf957d'; ctx.beginPath(); ctx.arc(0, -69, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#172327'; ctx.beginPath(); ctx.arc(0, -72, 10, Math.PI, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  let background = null, cachedLeague = -1;
  function stadium(league) {
    const sky = ctx.createLinearGradient(0, 0, 0, 250);
    sky.addColorStop(0, league === 2 ? '#061123' : '#133039'); sky.addColorStop(1, '#63817b');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 1100, 280);
    poly([[0, 135], [160, 90], [940, 90], [1100, 135], [1100, 300], [0, 300]], '#172c32');
    for (let row = 0; row < 8; row++) {
      line(0, 145 + row * 16, 1100, 145 + row * 16, '#406267', 2);
      for (let col = 0; col < 68; col++) {
        ctx.fillStyle = ['#6d8987', '#98a9a0', '#2a4a4b', '#b9c09e'][(row * 17 + col * 7) % 4];
        ctx.fillRect(col * 17 + row % 2 * 8, 140 + row * 16, 4, 5);
      }
    }
    line(0, 132, 160, 88, '#96b0ab', 3); line(160, 88, 940, 88, '#96b0ab', 3); line(940, 88, 1100, 132, '#96b0ab', 3);
    for (const x of [95, 1005]) {
      line(x, 35, x, 270, '#577a78', 5); ctx.fillStyle = '#edffd5'; ctx.fillRect(x - 33, 32, 66, 9);
      const glow = ctx.createRadialGradient(x, 38, 2, x, 38, 110); glow.addColorStop(0, '#e5ffc947'); glow.addColorStop(1, '#e5ffc900');
      ctx.fillStyle = glow; ctx.fillRect(x - 110, 0, 220, 150);
    }
    const grass = ctx.createLinearGradient(0, 260, 0, 650); grass.addColorStop(0, '#4b7851'); grass.addColorStop(1, '#173d2d');
    ctx.fillStyle = grass; ctx.fillRect(0, 270, 1100, 380);
    for (let i = 0; i < 8; i++) {
      const a = 270 + (i / 8) ** 1.6 * 380, b = 270 + ((i + 1) / 8) ** 1.6 * 380;
      ctx.fillStyle = i % 2 ? '#b0cc7020' : '#082f1919'; ctx.fillRect(0, a, 1100, b - a);
    }
    for (const p of [[0, 377, 1100, 377], [240, 377, 40, 650], [860, 377, 1060, 650], [125, 529, 975, 529], [337, 377, 287, 452], [763, 377, 813, 452], [287, 452, 813, 452]]) line(...p, '#d7e6c285', 2);
    ctx.strokeStyle = '#d7e6c270'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(550, 529, 150, 48, 0, 0, Math.PI); ctx.stroke();
    const { left, right, top, bottom } = FIELD;
    poly([[left, top], [right, top], [right, bottom], [left, bottom]], '#071c3038');
    for (let x = left; x <= right; x += 20) line(x, top, x, bottom, '#e4f2ef48', 1);
    for (let y = top; y <= bottom; y += 15) line(left, y, right, y, '#e4f2ef48', 1);
    line(left, bottom, left, top, '#edf8ef', 7); line(left, top, right, top, '#edf8ef', 7); line(right, top, right, bottom, '#edf8ef', 7);
  }
  function draw(match, fraction = 0) {
    if (cachedLeague !== match.league || !background) {
      stadium(match.league);
      // Cache the static stadium once: no crowd rebuild on every animation frame.
      background = ctx.getImageData(0, 0, FIELD.width, FIELD.height); cachedLeague = match.league;
    } else ctx.putImageData(background, 0, 0);
    const scene = SCENARIOS[match.plan[match.index].scenario];
    const shot = match.outcome;
    const t = shot ? Math.min(fraction, 1) * shot.stop : 0;
    const catchPoint = shot?.type === 'save' && fraction > 0.7 ? shot.contact : null;
    person(scene.keeper, 369, 1.18, '#ffae4e', true, catchPoint);
    // The physical wall occupies x ±53, y 345..441 at depth .64.
    for (const x of [scene.wall - 34, scene.wall, scene.wall + 34]) person(x, 441, 1.2, '#a9cddd');
    if (match.phase === 'aim') {
      const { x, y } = match.aim;
      // A guide to the selected target, not a fake guaranteed trajectory.
      ctx.setLineDash([6, 12]); line(550, 584, x, y, '#d8ff6950', 2); ctx.setLineDash([]);
      ctx.strokeStyle = '#d6ff4b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.stroke();
      line(x - 27, y, x - 9, y, '#d6ff4b', 2); line(x + 9, y, x + 27, y, '#d6ff4b', 2);
      line(x, y - 27, x, y - 9, '#d6ff4b', 2); line(x, y + 9, x, y + 27, '#d6ff4b', 2);
    }
    const ball = shot ? pathPoint(shot.end, t) : { x: 550, y: 584, r: 14 };
    ctx.fillStyle = '#00191670'; ctx.beginPath(); ctx.ellipse(ball.x, 600 - 224 * t, ball.r * 1.3, 4, 0, 0, Math.PI * 2); ctx.fill();
    const fill = ctx.createRadialGradient(ball.x - ball.r / 3, ball.y - ball.r / 3, 1, ball.x, ball.y, ball.r);
    fill.addColorStop(0, '#ffffff'); fill.addColorStop(1, '#95aeb4');
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
    poly(Array.from({ length: 5 }, (_, i) => [ball.x + Math.cos(i * Math.PI * 2 / 5) * ball.r * .46, ball.y + Math.sin(i * Math.PI * 2 / 5) * ball.r * .46]), '#192d38');
    if (!shot) person(495, 622, 1.55, '#cfff42');
  }
  return { draw };
}
