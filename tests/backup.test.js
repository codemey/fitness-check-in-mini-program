const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBackup } = require('../miniprogram/lib/backup');

test('导入兼容旧时间格式并跳过旧版没练记录', () => {
  const backup = { format: 'punch-in-v1', exportedAt: '2025-03-10T10:00:00.000Z', records: [
    { date: '2025-03-08', trained: true, parts: ['腿', '胸'] },
    { date: '2025-03-09', trained: false, parts: [] }
  ] };
  assert.deepEqual(parseBackup(JSON.stringify(backup)), {
    records: [{ date: '2025-03-08', trained: true, parts: ['腿', '胸'] }],
    skippedRest: 1, planRevisions: null
  });
  assert.deepEqual(parseBackup(JSON.stringify({ format: 'punch-in-v1', records: [
    { date: '2025-03-10', trained: true, parts: ['有氧跑步'] }
  ] })).records[0].parts, ['有氧跑步']);
});

test('新版备份保留训练计划并校验版本', () => {
  const planRevisions = [{ effectiveDate: '2025-03-01',
    days: [['胸'], [], ['腿'], [], [], [], []] }];
  const backup = { format: 'punch-in-v2', records: [], planRevisions };
  assert.deepEqual(parseBackup(JSON.stringify(backup)).planRevisions, planRevisions);
  assert.throws(() => parseBackup(JSON.stringify({ ...backup,
    planRevisions: [{ ...planRevisions[0], effectiveDate: '2025-02-29' }] })), /训练计划无效/);
  assert.throws(() => parseBackup(JSON.stringify({ ...backup,
    planRevisions: [...planRevisions, ...planRevisions] })), /训练计划无效/);
});

test('导入拒绝无效或重复日期及无效部位', () => {
  assert.throws(() => parseBackup('{'), /有效的 JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ records: [] })), /格式不正确/);
  const record = { date: '2025-03-08', trained: true, parts: ['胸'] };
  const backup = records => JSON.stringify({ format: 'punch-in-v1', records });
  assert.throws(() => parseBackup(backup([{ ...record, date: '2025-02-29' }])), /无效记录/);
  assert.throws(() => parseBackup(backup([record, record])), /重复日期/);
  assert.throws(() => parseBackup(backup([{ ...record, parts: ['胸', '胸'] }])), /无效记录/);
  assert.throws(() => parseBackup(backup([{ ...record, parts: [] }])), /无效记录/);
  assert.throws(() => parseBackup(backup([{ ...record, parts: ['过长的训练部位名称'] }])), /无效记录/);
});
