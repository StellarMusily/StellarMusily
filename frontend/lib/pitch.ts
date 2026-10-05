// Pitch detection with autocorrelation (no dependencies).
// Good enough for single notes on guitar/piano/voice; chords need a different approach
// (see docs/STARTER_ISSUES.md).

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Returns detected frequency in Hz, or null if the signal is too quiet / unclear. */
export function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  // Ignore silence.
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.01) return null;

  // Trim weak edges so the correlation isn't dominated by noise.
  const thres = 0.2;
  let r1 = 0;
  let r2 = buf.length - 1;
  for (let i = 0; i < buf.length / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < buf.length / 2; i++) if (Math.abs(buf[buf.length - i]) < thres) { r2 = buf.length - i; break; }
  const b = buf.slice(r1, r2);
  const n = b.length;

  const c = new Float32Array(n);
  for (let lag = 0; lag < n; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) sum += b[i] * b[i + lag];
    c[lag] = sum;
  }

  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;
  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < n; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }
  if (maxPos <= 0 || maxPos >= n - 1) return null;

  // Parabolic interpolation for sub-sample accuracy.
  const x1 = c[maxPos - 1], x2 = c[maxPos], x3 = c[maxPos + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const bb = (x3 - x1) / 2;
  const t0 = a ? maxPos - bb / (2 * a) : maxPos;
  return sampleRate / t0;
}

/** Cents between detected and target frequency (100 cents = 1 semitone). */
export function centsOff(hz: number, targetHz: number): number {
  return 1200 * Math.log2(hz / targetHz);
}

/** 0–100 score: 0 cents off = 100, 50+ cents off (half a semitone) = 0. */
export function noteAccuracy(hz: number, targetHz: number): number {
  return Math.max(0, Math.round(100 - Math.abs(centsOff(hz, targetHz)) * 2));
}

export function noteName(hz: number): string {
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}
