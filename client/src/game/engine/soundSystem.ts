// =============================================================
// TIRO LIBRE MATEMÁTICO — Sound System v2
// Web Audio API — synthesized sounds, no external files needed
// FIX: Global user-gesture listener ensures audio works on mobile
// =============================================================

let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

// Register a one-time global listener to unlock audio on first touch/click
// This is required by mobile browsers (iOS Safari, Android Chrome)
function registerAudioUnlock() {
  const unlock = () => {
    if (audioUnlocked) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume().then(() => {
          audioUnlocked = true;
        });
      } else {
        audioUnlocked = true;
      }
    } catch (_) {}
  };

  // Listen on all common user interaction events
  ["touchstart", "touchend", "mousedown", "click", "keydown"].forEach((evt) => {
    document.addEventListener(evt, unlock, { once: false, passive: true });
  });
}

// Register immediately when module loads
if (typeof window !== "undefined") {
  registerAudioUnlock();
}

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  type: OscillatorType,
  duration: number,
  volume = 0.3,
  startTime = 0,
  endFreq?: number
) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime + startTime);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + startTime + duration);
    }

    gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

    osc.start(ctx.currentTime + startTime);
    osc.stop(ctx.currentTime + startTime + duration + 0.01);
  } catch (_) {}
}

function playNoise(duration: number, volume = 0.15, startTime = 0) {
  try {
    const ctx = getCtx();
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 0.5;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(volume, ctx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

    source.start(ctx.currentTime + startTime);
    source.stop(ctx.currentTime + startTime + duration + 0.01);
  } catch (_) {}
}

export const sounds = {
  /** Tap on goal to aim */
  aim() {
    playTone(440, "sine", 0.08, 0.15);
  },

  /** Ball kick — whoosh + impact */
  kick() {
    playNoise(0.15, 0.25);
    playTone(80, "sine", 0.12, 0.4, 0.05, 40);
    playTone(120, "triangle", 0.1, 0.3, 0.05, 60);
  },

  /** Goal scored! */
  goal() {
    playNoise(0.8, 0.2);
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      playTone(freq, "square", 0.18, 0.2, i * 0.12);
    });
    playTone(1047, "sine", 0.4, 0.3, 0.5);
  },

  /** Shot saved by keeper */
  save() {
    playTone(200, "square", 0.1, 0.3);
    playTone(150, "square", 0.15, 0.25, 0.08);
  },

  /** Shot missed / out */
  miss() {
    playTone(300, "sawtooth", 0.08, 0.2, 0, 150);
    playTone(200, "sine", 0.12, 0.15, 0.06);
  },

  /** Correct math answer */
  correct() {
    playTone(523, "sine", 0.1, 0.25);
    playTone(659, "sine", 0.1, 0.25, 0.1);
    playTone(784, "sine", 0.15, 0.2, 0.2);
  },

  /** Wrong math answer */
  wrong() {
    playTone(200, "sawtooth", 0.15, 0.3, 0, 100);
  },

  /** Button click */
  click() {
    playTone(600, "sine", 0.06, 0.1);
  },

  /** Level complete */
  levelComplete() {
    const melody = [523, 659, 784, 1047, 784, 1047, 1319];
    melody.forEach((freq, i) => {
      playTone(freq, "sine", 0.2, 0.25, i * 0.15);
    });
  },

  /** Level failed */
  levelFailed() {
    playTone(400, "sawtooth", 0.2, 0.3, 0, 200);
    playTone(300, "sawtooth", 0.2, 0.3, 0.2, 150);
    playTone(200, "sawtooth", 0.3, 0.3, 0.4, 100);
  },

  /** Combo! */
  combo() {
    playTone(880, "sine", 0.1, 0.3);
    playTone(1100, "sine", 0.1, 0.3, 0.1);
  },

  /** Unlock new level */
  unlock() {
    const notes = [392, 494, 587, 784];
    notes.forEach((freq, i) => {
      playTone(freq, "sine", 0.15, 0.2, i * 0.1);
    });
  },

  /** Manually resume AudioContext (call on first user interaction if needed) */
  init() {
    try {
      getCtx();
    } catch (_) {}
  },
};
