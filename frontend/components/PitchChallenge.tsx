'use client';

import { useEffect, useRef, useState } from 'react';
import type { Lesson } from '@/lib/api';
import { centsOff, detectPitch, noteAccuracy, noteName } from '@/lib/pitch';

const HOLD_MS = 3000; // how long the learner must hold the note

type Props = {
  lesson: Lesson;
  onComplete: (accuracy: number, minutes: number) => void;
};

/** Listens to the mic, shows a live tuner, and scores how well the target note is held. */
export function PitchChallenge({ lesson, onComplete }: Props) {
  const [listening, setListening] = useState(false);
  const [hz, setHz] = useState<number | null>(null);
  const [heldMs, setHeldMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const target = lesson.challenge.hz;

  useEffect(() => () => stopRef.current(), []);

  async function start() {
    setError(null);
    setHeldMs(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      const startedAt = performance.now();
      const scores: number[] = [];
      let last = performance.now();
      let held = 0;
      let raf = 0;

      const stop = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
        setListening(false);
      };
      stopRef.current = stop;

      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        const f = detectPitch(buf, ctx.sampleRate);
        const now = performance.now();
        setHz(f);
        if (f) {
          const acc = noteAccuracy(f, target);
          // Only count time while roughly on the right note.
          if (acc > 0) {
            held += now - last;
            scores.push(acc);
            setHeldMs(held);
          }
        }
        last = now;
        if (held >= HOLD_MS) {
          stop();
          const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          const minutes = Math.max(1, Math.round((now - startedAt) / 60000));
          onComplete(avg, minutes);
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      setListening(true);
      raf = requestAnimationFrame(tick);
    } catch {
      setError('Microphone access is needed for practice challenges.');
    }
  }

  const cents = hz ? centsOff(hz, target) : 0;
  const needle = Math.max(-50, Math.min(50, cents)); // clamp to ±50 cents

  return (
    <div className="challenge">
      <p className="muted">Play and hold</p>
      <p className="target-note">{lesson.challenge.note}</p>

      <div className="tuner">
        <div className="tuner-center" />
        {hz && <div className="tuner-needle" style={{ left: `${50 + needle}%` }} />}
      </div>
      <p className="muted">
        {hz ? `${noteName(hz)} · ${hz.toFixed(1)} Hz · ${cents > 0 ? '+' : ''}${cents.toFixed(0)}¢` : 'Listening…'}
      </p>

      <div className="hold-track">
        <div className="hold-fill" style={{ width: `${Math.min(100, (heldMs / HOLD_MS) * 100)}%` }} />
      </div>

      {!listening ? (
        <button className="btn" onClick={start}>
          🎤 Start challenge
        </button>
      ) : (
        <button className="btn ghost" onClick={() => stopRef.current()}>
          Stop
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
