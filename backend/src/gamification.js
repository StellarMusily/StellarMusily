// Pure game logic: XP, levels, streaks, badges and lesson unlocking.
// No I/O here, so it's easy to unit-test and easy for contributors to extend.

export const PASS_ACCURACY = 70; // % needed to pass a lesson challenge

/** XP earned from one practice session. */
export function xpForSession({ accuracy, minutes, passed, streak }) {
  const base = Math.min(minutes, 60) * 2; // up to 120 XP for practice time
  const skill = Math.round(Math.max(0, Math.min(accuracy, 100)) / 2); // up to 50 XP
  const passBonus = passed ? 50 : 0;
  const streakMultiplier = 1 + Math.min(streak, 30) * 0.02; // up to +60%
  return Math.round((base + skill + passBonus) * streakMultiplier);
}

/** Level curve: each level needs 100 more XP than the last (100, 300, 600, 1000...). */
export function levelFromXp(xp) {
  let level = 1;
  let needed = 100;
  let remaining = xp;
  while (remaining >= needed) {
    remaining -= needed;
    level += 1;
    needed += 100;
  }
  return { level, xpIntoLevel: remaining, xpForNextLevel: needed };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (date) => new Date(date).toISOString().slice(0, 10); // UTC day

/**
 * Update a streak given the last practice day and now.
 * Same day → unchanged, next day → +1, gap → reset to 1.
 */
export function nextStreak(lastPracticeDay, streak, now = new Date()) {
  const today = dayKey(now);
  if (!lastPracticeDay) return { streak: 1, lastPracticeDay: today };
  if (lastPracticeDay === today) return { streak, lastPracticeDay: today };
  const yesterday = dayKey(new Date(now).getTime() - DAY_MS);
  if (lastPracticeDay === yesterday) return { streak: streak + 1, lastPracticeDay: today };
  return { streak: 1, lastPracticeDay: today };
}

export const BADGES = [
  { id: 'first-note', name: 'First Note', test: (p) => p.sessions >= 1 },
  { id: 'streak-3', name: 'On a Roll (3-day streak)', test: (p) => p.streak >= 3 },
  { id: 'streak-7', name: 'Week Warrior (7-day streak)', test: (p) => p.streak >= 7 },
  { id: 'streak-30', name: 'Unstoppable (30-day streak)', test: (p) => p.streak >= 30 },
  { id: 'perfect', name: 'Perfect Pitch (100% accuracy)', test: (p) => p.bestAccuracy >= 100 },
  { id: 'hour', name: 'One Hour In', test: (p) => p.totalMinutes >= 60 },
  { id: 'level-5', name: 'Level 5', test: (p) => levelFromXp(p.xp).level >= 5 },
];

/** Returns badge ids the learner has newly earned. */
export function newBadges(progress) {
  const owned = new Set(progress.badges);
  return BADGES.filter((b) => !owned.has(b.id) && b.test(progress)).map((b) => b.id);
}

/** A lesson is unlocked if it's the first one or the previous lesson is passed. */
export function isUnlocked(course, lessonIndex, passedLessonIds) {
  if (lessonIndex === 0) return true;
  const prev = course.lessons[lessonIndex - 1];
  return passedLessonIds.includes(prev.id);
}
