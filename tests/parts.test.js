const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_PARTS, validPartOptions, recordPartChoices } = require('../miniprogram/lib/parts');

test('当前部位与历史部位并列展示且不丢失旧选择', () => {
  assert.equal(validPartOptions(DEFAULT_PARTS), true);
  assert.equal(validPartOptions(['有氧跑步', '瑜伽']), true);
  assert.equal(validPartOptions(['胸', '胸']), false);
  const choices = recordPartChoices(['有氧跑步'], { parts: ['胸', '有氧跑步'] });
  assert.deepEqual(choices, [
    { label: '有氧跑步', selected: true, legacy: false },
    { label: '胸', selected: true, legacy: true }
  ]);
});
