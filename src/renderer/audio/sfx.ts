// Лёгкий синтез звуков ответа через Web Audio. Без файлов.
export interface Note { freq: number; start: number; dur: number; gain: number; }

export function toneSpec(kind: 'correct' | 'wrong'): Note[] {
  if (kind === 'correct') {
    return [
      { freq: 660, start: 0, dur: 0.12, gain: 0.15 },
      { freq: 880, start: 0.1, dur: 0.16, gain: 0.15 },
    ];
  }
  return [{ freq: 180, start: 0, dur: 0.22, gain: 0.14 }];
}

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

function playNote(ac: AudioContext, n: Note) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  const t0 = ac.currentTime + n.start;
  osc.type = 'sine';
  osc.frequency.value = n.freq;
  // быстрый attack, плавный release
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(n.gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + n.dur + 0.02);
}

export function playSfx(kind: 'correct' | 'wrong'): void {
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  for (const n of toneSpec(kind)) playNote(ac, n);
}
