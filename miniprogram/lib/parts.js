const DEFAULT_PARTS = ['胸', '背', '肩', '腿'];
const MAX_PARTS = 12;

function validPartName(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 8
    && value.trim() === value && !/[\r\n\t]/.test(value);
}

function validPartOptions(parts) {
  return Array.isArray(parts) && parts.length > 0 && parts.length <= MAX_PARTS
    && parts.length === new Set(parts).size && parts.every(validPartName);
}

function recordPartChoices(options, record) {
  const active = validPartOptions(options) ? options : DEFAULT_PARTS;
  const previous = record && Array.isArray(record.parts) ? record.parts.filter(validPartName) : [];
  return [...new Set([...active, ...previous])].map(label => ({
    label, selected: previous.includes(label), legacy: !active.includes(label)
  }));
}

module.exports = { DEFAULT_PARTS, MAX_PARTS, validPartOptions, recordPartChoices };
