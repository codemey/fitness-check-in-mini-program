const test = require('node:test');
const assert = require('node:assert/strict');
const { monthPartStats, yearMonthStats } = require('../miniprogram/lib/stats');

test('月度统计按训练日和多选部位计数', () => {
  const summary = monthPartStats([
    { date: '2025-03-01', trained: true, parts: ['胸', '肩'] },
    { date: '2025-03-02', trained: true, parts: ['胸'] },
    { date: '2025-03-03', trained: false, parts: [] }
  ]);
  assert.equal(summary.total, 2);
  assert.deepEqual(summary.bars.map(bar => bar.count), [2, 0, 1, 0]);
  assert.deepEqual(summary.bars.map(bar => bar.width), [100, 0, 50, 0]);
});

test('年度统计为每个月生成固定位置的柱形', () => {
  const months = Array.from({ length: 12 }, () => []);
  months[0] = [{ trained: true }, { trained: true }];
  months[9] = [{ trained: true }, { trained: false }];
  const summary = yearMonthStats(months);
  assert.equal(summary.total, 3);
  assert.equal(summary.bars.length, 12);
  assert.equal(summary.bars[0].height, 150);
  assert.equal(summary.bars[9].count, 1);
  assert.equal(summary.bars[1].height, 0);
});

test('月度统计保留已移除部位的历史天数', () => {
  const summary = monthPartStats([
    { date: '2025-03-01', trained: true, parts: ['胸'] },
    { date: '2025-03-02', trained: true, parts: ['有氧跑步'] }
  ], ['有氧跑步', '瑜伽']);
  assert.deepEqual(summary.bars.map(bar => [bar.label, bar.count]),
    [['有氧跑步', 1], ['瑜伽', 0], ['胸', 1]]);
});
