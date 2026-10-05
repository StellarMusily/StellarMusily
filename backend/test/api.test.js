import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { app } from '../src/app.js';

const LEARNER = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const post = (path, body) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('lists courses', async () => {
  const courses = await (await fetch(`${base}/courses`)).json();
  assert.ok(courses.length >= 1);
  assert.equal(courses[0].lessons, undefined);
});

test('locked lesson is rejected, then unlocks after passing', async () => {
  let res = await post('/practice', { learner: LEARNER, courseId: 1, lessonId: 'g2', accuracy: 90, minutes: 5 });
  assert.equal(res.status, 403);

  res = await post('/practice', { learner: LEARNER, courseId: 1, lessonId: 'g1', accuracy: 90, minutes: 5 });
  const body = await res.json();
  assert.equal(body.passed, true);
  assert.equal(body.nextLessonUnlocked, true);
  assert.ok(body.newBadges.includes('first-note'));

  res = await post('/practice', { learner: LEARNER, courseId: 1, lessonId: 'g2', accuracy: 50, minutes: 5 });
  assert.equal(res.status, 200);
});

test('leaderboard ranks learners', async () => {
  const board = await (await fetch(`${base}/leaderboard`)).json();
  assert.equal(board[0].rank, 1);
});
