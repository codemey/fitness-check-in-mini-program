const { DEFAULT_PARTS, validPartOptions } = require('./parts');

function monthPartStats(records, partOptions = DEFAULT_PARTS) {
  const trained = records.filter(record => record.trained === true);
  const active = validPartOptions(partOptions) ? partOptions : DEFAULT_PARTS;
  const labels = [...new Set([...active, ...trained.flatMap(record => record.parts)])];
  const counts = labels.map(part => trained.filter(record => record.parts.includes(part)).length);
  const max = Math.max(1, ...counts);
  return { total: trained.length, bars: labels.map((label, index) => ({
    label, count: counts[index], width: counts[index] ? Math.round(counts[index] / max * 100) : 0,
    tone: `part-${index % 4}`
  })) };
}

function yearMonthStats(monthRecords) {
  const counts = monthRecords.map(records => records.filter(record => record.trained === true).length);
  const max = Math.max(1, ...counts);
  return { total: counts.reduce((sum, count) => sum + count, 0),
    bars: counts.map((count, index) => ({
      month: index + 1, count, height: count ? Math.max(12, Math.round(count / max * 150)) : 0
    })) };
}

module.exports = { monthPartStats, yearMonthStats };
