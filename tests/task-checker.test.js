const test = require('node:test');
const assert = require('node:assert');
const { checkTasks } = require('../src/task-checker');

test('should detect zero tasks', () => {
  const md = 'Hello world\nNo tasks here.';
  const res = checkTasks(md);
  assert.strictEqual(res.total, 0);
  assert.strictEqual(res.isComplete, true);
});

test('should detect incomplete tasks', () => {
  const md = `
- [ ] Incomplete task 1
- [x] Complete task 2
* [ ] Incomplete task 3
  `;
  const res = checkTasks(md);
  assert.strictEqual(res.total, 3);
  assert.strictEqual(res.open.length, 2);
  assert.strictEqual(res.completed.length, 1);
  assert.strictEqual(res.isComplete, false);
  assert.strictEqual(res.open[0].text, 'Incomplete task 1');
});

test('should pass with only complete tasks', () => {
  const md = `
- [x] Task 1
- [X] Task 2
  `;
  const res = checkTasks(md);
  assert.strictEqual(res.total, 2);
  assert.strictEqual(res.open.length, 0);
  assert.strictEqual(res.isComplete, true);
});