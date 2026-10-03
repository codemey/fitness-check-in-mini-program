const { validDate } = require('./dates');
const { validPartOptions } = require('./parts');
const { validPlanRevisions } = require('./plan');

function parseBackup(text) {
  let backup;
  try { backup = JSON.parse(text); }
  catch (_) { throw new Error('备份不是有效的 JSON'); }
  if (!backup || !['punch-in-v1', 'punch-in-v2'].includes(backup.format)
    || !Array.isArray(backup.records)) {
    throw new Error('备份格式不正确');
  }
  if (backup.format === 'punch-in-v2' && !validPlanRevisions(backup.planRevisions)) {
    throw new Error('备份中的训练计划无效');
  }

  const dates = new Set();
  const records = [];
  let skippedRest = 0;
  for (const record of backup.records) {
    if (!record || !validDate(record.date) || typeof record.trained !== 'boolean'
      || !Array.isArray(record.parts)
      || (record.trained ? !validPartOptions(record.parts) : record.parts.length !== 0)) {
      throw new Error('备份中存在无效记录');
    }
    if (dates.has(record.date)) throw new Error(`备份中有重复日期：${record.date}`);
    dates.add(record.date);
    if (!record.trained) {
      if (record.parts.length) throw new Error('备份中存在无效记录');
      skippedRest += 1;
      continue;
    }
    records.push({ date: record.date, trained: true, parts: record.parts.slice() });
  }
  return { records, skippedRest,
    planRevisions: backup.format === 'punch-in-v2' ? backup.planRevisions : null };
}

module.exports = { parseBackup };
