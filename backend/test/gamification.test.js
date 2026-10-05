import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isUnlocked,
  levelFromXp,
  newBadges,
  nextStreak,
  xpForSession,
} from '../src/gamification.js';

test('level curve', () => {
  assert.equal(levelFromXp(0).level, 1);
  assert.equal(levelFromXp(99).level, 1);
  assert.equal(levelFromXp(100).level, 2);
  assert.equal(levelFromXp(300).level, 3);
  assert.deepEqual(levelFromXp(350), { level: 3, xpIntoLevel: 50, xpForNextLevel: 300 });
});

test('streaks', () => {
  const now = new Date('2026-10-05T10:00:00Z');
  assert.deepEqual(nextStreak(null, 0, now), { streak: 1, lastPracticeDay: '2026-10-05' });
  assert.equal(nextStreak('2026-10-05', 4, now).streak, 4); // same day
  assert.equal(nextStreak('2026-10-04', 4, now).streak, 5); // consecutive
  assert.equal(nextStreak('2026-10-01', 4, now).streak, 1); // missed days
});

test('xp rewards passing and streaks', () => {
  const base = xpForSession({ accuracy: 80, minutes: 10, passed: false, streak: 0 });
  const pass = xpForSession({ accuracy: 80, minutes: 10, passed: true, streak: 0 });
  const streak = xpForSession({ accuracy: 80, minutes: 10, passed: false, streak: 10 });
  assert.equal(base, 60);
  assert.ok(pass > base);
  assert.ok(streak > base);
});

test('badges', () => {
  const p = { sessions: 1, streak: 3, bestAccuracy: 90, totalMinutes: 20, xp: 0, badges: ['first-note'] };
  assert.deepEqual(newBadges(p), ['streak-3']);
});

test('lesson unlocking', () => {
  const course = { lessons: [{ id: 'a' }, { id: 'b' }] };
  assert.equal(isUnlocked(course, 0, []), true);
  assert.equal(isUnlocked(course, 1, []), false);
  assert.equal(isUnlocked(course, 1, ['a']), true);
});
