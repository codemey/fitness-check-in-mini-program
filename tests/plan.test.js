const test = require('node:test');
const assert = require('node:assert/strict');
const { blankWeek, weekdayIndex, planPartsForDate, weekRows } = require('../miniprogram/lib/plan');

test('周计划按周一至周日排列，保留已移除的旧部位', () => {
  const days = blankWeek();
  days[0] = ['胸'];
  days[6] = ['瑜伽'];
  assert.equal(weekdayIndex('2025-01-06'), 0);
  assert.equal(weekdayIndex('2025-01-12'), 6);
  assert.deepEqual(planPartsForDate({ days }, '2025-01-12'), ['瑜伽']);
  assert.deepEqual(planPartsForDate(null, '2025-01-12'), []);
  const rows = weekRows(days, ['胸', '背']);
  assert.equal(rows[0].summary, '胸');
  assert.equal(rows[1].summary, '休息');
  assert.deepEqual(rows[6].choices.find(choice => choice.label === '瑜伽'),
    { label: '瑜伽', selected: true, legacy: true });
});
