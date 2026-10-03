const { recordPartChoices, validPartOptions } = require('./parts');
const { validDate } = require('./dates');

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function blankWeek() { return WEEKDAYS.map(() => []); }

function validPlanDays(days) {
  return Array.isArray(days) && days.length === 7
    && days.every(parts => Array.isArray(parts) && (parts.length === 0 || validPartOptions(parts)));
}

function validPlanRevisions(revisions) {
  return Array.isArray(revisions)
    && revisions.every(revision => revision && validDate(revision.effectiveDate)
      && validPlanDays(revision.days))
    && new Set(revisions.map(revision => revision.effectiveDate)).size === revisions.length;
}

function weekdayIndex(date) {
  const [year, month, day] = date.split('-').map(Number);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

function planPartsForDate(plan, date) {
  return plan ? plan.days[weekdayIndex(date)] : [];
}

function weekRows(days, options) {
  return WEEKDAYS.map((label, index) => ({
    label,
    parts: days[index].slice(),
    summary: days[index].length ? days[index].join(' · ') : '休息',
    choices: recordPartChoices(options, { parts: days[index] })
  }));
}

module.exports = { WEEKDAYS, blankWeek, validPlanDays, validPlanRevisions,
  weekdayIndex, planPartsForDate, weekRows };
