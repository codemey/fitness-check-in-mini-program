function pad(value) { return String(value).padStart(2, '0'); }
function localDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function localDateTime(date = new Date()) {
  return `${localDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
}
function monthOf(date) { return date.slice(0, 7); }
function monthLabel(month) {
  const [year, number] = month.split('-');
  return `${year}年${Number(number)}月`;
}
function shiftMonth(month, offset) {
  const [year, number] = month.split('-').map(Number);
  const next = new Date(year, number - 1 + offset, 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;
}
function calendarCells(month, records, today) {
  const [year, number] = month.split('-').map(Number);
  const firstDay = new Date(year, number - 1, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const count = new Date(year, number, 0).getDate();
  const byDate = {};
  records.forEach(record => { byDate[record.date] = record; });
  const cells = Array.from({ length: offset }, (_, index) => ({ key: `empty-${index}`, empty: true }));
  for (let day = 1; day <= count; day += 1) {
    const date = `${month}-${pad(day)}`;
    const record = byDate[date];
    cells.push({ key: date, day, date, future: date > today,
      trained: !!(record && record.trained === true) });
  }
  return cells;
}
module.exports = { localDate, localDateTime, validDate, monthOf, monthLabel, shiftMonth, calendarCells };
