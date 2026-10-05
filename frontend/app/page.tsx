'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCourses, getLeaderboard, type Course, type LeaderRow } from '@/lib/api';

const ICONS: Record<string, string> = { guitar: '🎸', piano: '🎹', drums: '🥁', violin: '🎻' };

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCourses().then(setCourses).catch(() => setError('Could not reach the API. Is the backend running on :4000?'));
    getLeaderboard().then(setBoard).catch(() => {});
  }, []);

  return (
    <>
      <section className="hero">
        <h1>Learn an instrument. Level up every day.</h1>
        <p className="muted">
          Buy a course once, practice with real-time feedback, keep your streak, and earn an on-chain certificate.
        </p>
      </section>

      {error && <p className="error">{error}</p>}

      <div className="grid">
        <section>
          <h2>Courses</h2>
          <div className="cards">
            {courses.map((c) => (
              <Link key={c.id} href={`/courses/${c.id}`} className="card">
                <div className="card-icon">{ICONS[c.instrument] ?? '🎵'}</div>
                <h3>{c.title}</h3>
                <p className="muted">{c.description}</p>
                <div className="card-foot">
                  <span className="pill">{c.lessonCount} levels</span>
                  <strong>{c.priceUsdc} USDC</strong>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <aside>
          <h2>This week</h2>
          <ol className="leaderboard">
            {board.length === 0 && <li className="muted">No one yet. Be first!</li>}
            {board.map((r) => (
              <li key={r.rank}>
                <span>
                  #{r.rank} {r.displayName}
                </span>
                <span>
                  {r.weeklyXp} XP · 🔥{r.streak}
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}
