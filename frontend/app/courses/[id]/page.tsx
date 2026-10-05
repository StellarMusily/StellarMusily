'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PitchChallenge } from '@/components/PitchChallenge';
import { useWallet } from '@/components/WalletProvider';
import { XpBar } from '@/components/XpBar';
import { getCourse, logPractice, type Course, type PracticeResult } from '@/lib/api';
import { buyCourse, contractsConfigured, hasAccess } from '@/lib/stellar';

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { address, progress, connect, setProgress } = useWallet();
  const [course, setCourse] = useState<Course | null>(null);
  const [owned, setOwned] = useState(false);
  const [buying, setBuying] = useState(false);
  const [activeLesson, setActiveLesson] = useState<string | null>(null);
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCourse(id).then(setCourse).catch(() => setError('Course not found'));
  }, [id]);

  useEffect(() => {
    if (address && course) hasAccess(address, course.id).then(setOwned).catch(() => setOwned(false));
  }, [address, course]);

  if (!course?.lessons) return <p className="muted">{error ?? 'Loading…'}</p>;

  const passed = progress?.passedLessons[course.id] ?? [];
  const unlocked = (i: number) => i === 0 || passed.includes(course.lessons![i - 1].id);

  async function buy() {
    if (!address || !course) return;
    setBuying(true);
    setError(null);
    try {
      await buyCourse(address, course.id);
      setOwned(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purchase failed');
    } finally {
      setBuying(false);
    }
  }

  async function finish(accuracy: number, minutes: number) {
    if (!address || !activeLesson) return;
    try {
      const r = await logPractice({ learner: address, courseId: course!.id, lessonId: activeLesson, accuracy, minutes });
      setResult(r);
      setProgress(r.progress);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save practice');
    }
  }

  const lesson = course.lessons.find((l) => l.id === activeLesson);

  return (
    <>
      <h1>{course.title}</h1>
      <p className="muted">{course.description}</p>
      {progress && <XpBar progress={progress} />}

      {!address ? (
        <button className="btn" onClick={connect}>
          Connect Freighter to start
        </button>
      ) : !owned ? (
        <div className="buy">
          <button className="btn" onClick={buy} disabled={buying}>
            {buying ? 'Confirm in Freighter…' : `Buy for ${course.priceUsdc} USDC`}
          </button>
          <p className="muted">7-day refund if you haven&apos;t passed level 2. Held in escrow on Stellar.</p>
        </div>
      ) : (
        !contractsConfigured && <p className="muted">Dev mode: contracts not configured, all courses unlocked.</p>
      )}

      {error && <p className="error">{error}</p>}

      {/* Course map: each lesson is a level */}
      <ol className="map">
        {course.lessons.map((l, i) => {
          const done = passed.includes(l.id);
          const open = owned && unlocked(i);
          return (
            <li key={l.id} className={`level ${done ? 'done' : open ? 'open' : 'locked'}`}>
              <button
                disabled={!open}
                onClick={() => {
                  setActiveLesson(l.id);
                  setResult(null);
                }}
              >
                <span className="level-num">{done ? '★' : open ? i + 1 : '🔒'}</span>
                <span>{l.title}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {lesson && !result && <PitchChallenge key={lesson.id} lesson={lesson} onComplete={finish} />}

      {result && (
        <div className={`result ${result.passed ? 'pass' : 'fail'}`}>
          <h2>{result.passed ? 'Level cleared! 🎉' : 'So close. Try again!'}</h2>
          <p>+{result.xpEarned} XP</p>
          {result.newBadges.length > 0 && <p>New badges: {result.newBadges.join(', ')}</p>}
          {result.courseCompleted && <p>Course complete! Your certificate is being minted on Stellar.</p>}
          <button className="btn ghost" onClick={() => setResult(null)}>
            {result.passed ? 'Practice again' : 'Retry'}
          </button>
        </div>
      )}
    </>
  );
}
