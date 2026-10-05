import cors from 'cors';
import express from 'express';
import {
  PASS_ACCURACY,
  isUnlocked,
  levelFromXp,
  newBadges,
  nextStreak,
  xpForSession,
} from './gamification.js';
import { issueCertificate, reportProgress } from './stellar.js';
import { allLearners, courses, getProgress } from './store.js';

export const app = express();
app.use(cors());
app.use(express.json());

const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

app.get('/health', (_req, res) => res.json({ ok: true }));

// ------------------------------------------------------------------ courses

app.get('/courses', (_req, res) => {
  res.json(
    courses.map(({ lessons, ...c }) => ({ ...c, lessonCount: lessons.length })),
  );
});

app.get('/courses/:id', (req, res) => {
  const course = courses.find((c) => c.id === Number(req.params.id));
  if (!course) return res.status(404).json({ error: 'Course not found' });
  res.json(course);
});

// ----------------------------------------------------------------- practice

/**
 * Log a practice session for a lesson challenge.
 * body: { learner, courseId, lessonId, accuracy (0-100), minutes }
 */
app.post('/practice', async (req, res) => {
  const { learner, courseId, lessonId, accuracy, minutes } = req.body ?? {};
  if (!STELLAR_ADDRESS.test(learner ?? '')) return res.status(400).json({ error: 'Invalid learner address' });
  if (typeof accuracy !== 'number' || typeof minutes !== 'number' || minutes <= 0) {
    return res.status(400).json({ error: 'accuracy and minutes must be numbers' });
  }

  const course = courses.find((c) => c.id === Number(courseId));
  if (!course) return res.status(404).json({ error: 'Course not found' });
  const lessonIndex = course.lessons.findIndex((l) => l.id === lessonId);
  if (lessonIndex === -1) return res.status(404).json({ error: 'Lesson not found' });

  // TODO(good-first-issue): check CoursePayment.has_access on-chain before accepting.
  const p = getProgress(learner);
  const passed = (p.passedLessons[course.id] ??= []);
  if (!isUnlocked(course, lessonIndex, passed)) {
    return res.status(403).json({ error: 'Lesson is locked. Pass the previous lesson first.' });
  }

  Object.assign(p, nextStreak(p.lastPracticeDay, p.streak));
  const didPass = accuracy >= PASS_ACCURACY;
  const firstPass = didPass && !passed.includes(lessonId);
  const xp = xpForSession({ accuracy, minutes, passed: firstPass, streak: p.streak });

  p.xp += xp;
  p.weeklyXp += xp;
  p.sessions += 1;
  p.totalMinutes += minutes;
  p.bestAccuracy = Math.max(p.bestAccuracy, accuracy);
  if (firstPass) passed.push(lessonId);

  const earned = newBadges(p);
  p.badges.push(...earned);

  const onChain = {};
  try {
    if (firstPass) onChain.progress = await reportProgress(course.id, learner, passed.length);
    if (firstPass && passed.length === course.lessons.length) {
      onChain.certificate = await issueCertificate(learner, course, accuracy);
    }
  } catch (err) {
    console.error(err);
    onChain.error = 'On-chain update failed; will retry'; // TODO: retry queue
  }

  res.json({
    xpEarned: xp,
    passed: didPass,
    nextLessonUnlocked: firstPass && lessonIndex + 1 < course.lessons.length,
    courseCompleted: passed.length === course.lessons.length,
    newBadges: earned,
    progress: summary(p),
    onChain,
  });
});

// ----------------------------------------------------------------- learners

app.get('/learners/:address', (req, res) => {
  if (!STELLAR_ADDRESS.test(req.params.address)) return res.status(400).json({ error: 'Invalid address' });
  res.json(summary(getProgress(req.params.address)));
});

app.get('/leaderboard', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 100);
  const board = allLearners()
    .sort((a, b) => b.weeklyXp - a.weeklyXp)
    .slice(0, limit)
    .map((p, i) => ({ rank: i + 1, displayName: p.displayName, weeklyXp: p.weeklyXp, streak: p.streak }));
  res.json(board);
});

function summary(p) {
  return {
    address: p.address,
    displayName: p.displayName,
    xp: p.xp,
    ...levelFromXp(p.xp),
    streak: p.streak,
    badges: p.badges,
    totalMinutes: p.totalMinutes,
    passedLessons: p.passedLessons,
  };
}
