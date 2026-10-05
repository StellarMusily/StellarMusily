const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type Challenge = { type: 'note'; note: string; hz: number };
export type Lesson = { id: string; title: string; challenge: Challenge };
export type Course = {
  id: number;
  title: string;
  instrument: string;
  instructor: string;
  priceUsdc: number;
  level: string;
  description: string;
  lessonCount?: number;
  lessons?: Lesson[];
};
export type Progress = {
  address: string;
  displayName: string;
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  streak: number;
  badges: string[];
  totalMinutes: number;
  passedLessons: Record<string, string[]>;
};
export type PracticeResult = {
  xpEarned: number;
  passed: boolean;
  nextLessonUnlocked: boolean;
  courseCompleted: boolean;
  newBadges: string[];
  progress: Progress;
};
export type LeaderRow = { rank: number; displayName: string; weeklyXp: number; streak: number };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API + path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export const getCourses = () => get<Course[]>('/courses');
export const getCourse = (id: number | string) => get<Course>(`/courses/${id}`);
export const getProgress = (address: string) => get<Progress>(`/learners/${address}`);
export const getLeaderboard = () => get<LeaderRow[]>('/leaderboard');

export async function logPractice(body: {
  learner: string;
  courseId: number;
  lessonId: string;
  accuracy: number;
  minutes: number;
}): Promise<PracticeResult> {
  const res = await fetch(`${API}/practice`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Practice failed');
  return data;
}
