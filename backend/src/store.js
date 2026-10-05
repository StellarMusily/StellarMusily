// In-memory store for the starter. Swap for Postgres using db/schema.sql
// (tracked as a good-first-issue in docs/STARTER_ISSUES.md).

export const courses = [
  {
    id: 1, // matches the on-chain course id in course_payment
    title: 'Beginner Guitar: Your First 30 Days',
    instrument: 'guitar',
    instructor: 'GINSTRUCTOR_PLACEHOLDER_ADDRESS',
    priceUsdc: 15,
    level: 'beginner',
    description: 'Tune up, learn the open strings, then play your first chords in time.',
    lessons: [
      { id: 'g1', title: 'Low E string', challenge: { type: 'note', note: 'E2', hz: 82.41 } },
      { id: 'g2', title: 'A string', challenge: { type: 'note', note: 'A2', hz: 110.0 } },
      { id: 'g3', title: 'D string', challenge: { type: 'note', note: 'D3', hz: 146.83 } },
      { id: 'g4', title: 'G string', challenge: { type: 'note', note: 'G3', hz: 196.0 } },
      { id: 'g5', title: 'B string', challenge: { type: 'note', note: 'B3', hz: 246.94 } },
      { id: 'g6', title: 'High E string', challenge: { type: 'note', note: 'E4', hz: 329.63 } },
    ],
  },
  {
    id: 2,
    title: 'Piano Basics: Middle C and Beyond',
    instrument: 'piano',
    instructor: 'GINSTRUCTOR_PLACEHOLDER_ADDRESS',
    priceUsdc: 12,
    level: 'beginner',
    description: 'Find middle C, play the C major scale, and build hand independence.',
    lessons: [
      { id: 'p1', title: 'Middle C', challenge: { type: 'note', note: 'C4', hz: 261.63 } },
      { id: 'p2', title: 'D', challenge: { type: 'note', note: 'D4', hz: 293.66 } },
      { id: 'p3', title: 'E', challenge: { type: 'note', note: 'E4', hz: 329.63 } },
      { id: 'p4', title: 'G', challenge: { type: 'note', note: 'G4', hz: 392.0 } },
    ],
  },
];

/** learner address -> progress */
const learners = new Map();

export function getProgress(address) {
  if (!learners.has(address)) {
    learners.set(address, {
      address,
      displayName: `${address.slice(0, 4)}…${address.slice(-4)}`,
      xp: 0,
      streak: 0,
      lastPracticeDay: null,
      sessions: 0,
      totalMinutes: 0,
      bestAccuracy: 0,
      badges: [],
      passedLessons: {}, // courseId -> [lessonId]
      weeklyXp: 0,
    });
  }
  return learners.get(address);
}

export function allLearners() {
  return [...learners.values()];
}
