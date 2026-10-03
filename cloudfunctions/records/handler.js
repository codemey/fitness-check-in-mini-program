const DEFAULT_PARTS = ['胸', '背', '肩', '腿'];
const COLLECTION = 'workout_records';
const MAX_PARTS = 12;

function validPartName(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 8
    && value.trim() === value && !/[\r\n\t]/.test(value);
}
function validPartOptions(parts) {
  return Array.isArray(parts) && parts.length > 0 && parts.length <= MAX_PARTS
    && parts.length === new Set(parts).size && parts.every(validPartName);
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}
function validMonth(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
function validateRecord(trained, parts) {
  return trained === true && validPartOptions(parts);
}
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
function planForDate(revisions, date) {
  const active = revisions.filter(revision => revision && validDate(revision.effectiveDate)
    && validPlanDays(revision.days) && revision.effectiveDate <= date)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
  return active ? { effectiveDate: active.effectiveDate, days: active.days } : null;
}
function weekdayIndex(date) {
  const [year, month, day] = date.split('-').map(Number);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}
function publicRecord(record) {
  return { date: record.date, trained: record.trained, parts: record.parts };
}
function createHandler(cloud, ownerOpenid) {
  const db = cloud.database();
  const collection = db.collection(COLLECTION);
  async function planRevisions(openid) {
    const result = await collection.where({ _id: `${openid}_weekly_plan` }).limit(1).get();
    const revisions = result.data[0] && result.data[0].revisions;
    return Array.isArray(revisions) ? revisions : [];
  }
  return async function handle(event = {}) {
    const openid = cloud.getWXContext().OPENID;
    if (!openid) return { ok: false, message: '无法识别微信账号，请在微信中重新打开小程序' };
    if (event.action === 'identity') {
      return { ok: true, data: { openid, bound: !!ownerOpenid && ownerOpenid === openid } };
    }
    if (!ownerOpenid) return { ok: false, message: '云函数尚未配置 OWNER_OPENID，请先打开设置页查看自己的 OpenID' };
    if (ownerOpenid !== openid) return { ok: false, message: '当前微信账号无权访问记录' };
    try {
      if (event.action === 'parts') {
        const result = await collection.where({ _id: `${openid}_part_options` }).limit(1).get();
        const saved = result.data[0] && result.data[0].parts;
        return { ok: true, data: { parts: validPartOptions(saved) ? saved : DEFAULT_PARTS } };
      }
      if (event.action === 'saveParts') {
        if (!validPartOptions(event.parts)) {
          return { ok: false, message: '训练部位需为1至12个不重复的名称，每个名称不超过8个字' };
        }
        await collection.doc(`${openid}_part_options`).set({ data: { parts: event.parts } });
        return { ok: true, data: { parts: event.parts } };
      }
      if (event.action === 'getPlan') {
        if (!validDate(event.date)) return { ok: false, message: '日期无效' };
        return { ok: true, data: planForDate(await planRevisions(openid), event.date) };
      }
      if (event.action === 'planMonth') {
        if (!validMonth(event.month)) return { ok: false, message: '月份无效' };
        const revisions = await planRevisions(openid);
        const [year, month] = event.month.split('-').map(Number);
        const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const days = [];
        for (let day = 1; day <= count; day += 1) {
          const date = `${event.month}-${String(day).padStart(2, '0')}`;
          const plan = planForDate(revisions, date);
          const parts = plan ? plan.days[weekdayIndex(date)] : [];
          if (parts.length) days.push({ date, parts });
        }
        return { ok: true, data: days };
      }
      if (event.action === 'savePlan') {
        if (!validPlanDays(event.days)) {
          return { ok: false, message: '每周计划无效，请检查训练部位' };
        }
        const effectiveDate = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const revisions = (await planRevisions(openid))
          .filter(revision => revision.effectiveDate !== effectiveDate);
        revisions.push({ effectiveDate, days: event.days.map(parts => parts.slice()) });
        revisions.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
        await collection.doc(`${openid}_weekly_plan`).set({ data: { revisions } });
        return { ok: true, data: { effectiveDate, days: event.days } };
      }
      if (event.action === 'exportPlan') {
        return { ok: true, data: await planRevisions(openid) };
      }
      if (event.action === 'restorePlan') {
        if (!validPlanRevisions(event.revisions)) {
          return { ok: false, message: '备份中的训练计划无效' };
        }
        const revisions = event.revisions.slice()
          .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
        await collection.doc(`${openid}_weekly_plan`).set({ data: { revisions } });
        return { ok: true, data: { count: revisions.length } };
      }
      if (event.action === 'get') {
        if (!validDate(event.date)) return { ok: false, message: '日期无效' };
        const result = await collection.where({ _id: `${openid}_${event.date}` }).limit(1).get();
        const record = result.data[0];
        return { ok: true, data: record && record.trained === true ? publicRecord(record) : null };
      }
      if (event.action === 'list') {
        if (!validMonth(event.month)) return { ok: false, message: '月份无效' };
        const result = await collection.where({ ownerId: openid, month: event.month }).limit(31).get();
        return { ok: true, data: result.data.filter(record => record.trained === true)
          .map(publicRecord).sort((a, b) => a.date.localeCompare(b.date)) };
      }
      if (event.action === 'save') {
        if (!validDate(event.date) || !validateRecord(event.trained, event.parts)) {
          return { ok: false, message: '记录无效，请检查日期、训练状态和部位' };
        }
        const record = { ownerId: openid, date: event.date, month: event.date.slice(0, 7),
          trained: true, parts: event.parts };
        await collection.doc(`${openid}_${event.date}`).set({ data: record });
        return { ok: true, data: publicRecord(record) };
      }
      if (event.action === 'remove') {
        if (!validDate(event.date)) return { ok: false, message: '日期无效' };
        await collection.doc(`${openid}_${event.date}`).remove();
        return { ok: true, data: null };
      }
      if (event.action === 'import') {
        const records = event.records;
        if (!Array.isArray(records) || !records.length || records.length > 10
          || records.some(record => !record || !validDate(record.date)
            || !validateRecord(record.trained, record.parts))
          || new Set(records.map(record => record.date)).size !== records.length) {
          return { ok: false, message: '备份记录无效，请检查日期和训练部位' };
        }
        await Promise.all(records.map(record => collection.doc(`${openid}_${record.date}`).set({ data: {
          ownerId: openid, date: record.date, month: record.date.slice(0, 7), trained: true,
          parts: record.parts
        } })));
        return { ok: true, data: { count: records.length } };
      }
      if (event.action === 'export') {
        const records = [];
        const pageSize = 100;
        for (let offset = 0; ; offset += pageSize) {
          const result = await collection.where({ ownerId: openid })
            .orderBy('date', 'asc').skip(offset).limit(pageSize).get();
          records.push(...result.data.filter(record => record.trained === true).map(publicRecord));
          if (result.data.length < pageSize) break;
        }
        return { ok: true, data: records };
      }
      return { ok: false, message: '未知操作' };
    } catch (error) {
      console.error('records cloud function failed', error);
      return { ok: false, message: '云端操作失败，请检查云函数和数据库配置' };
    }
  };
}
module.exports = { createHandler, validDate, validMonth, validPartOptions, validPlanDays,
  validPlanRevisions,
  planForDate, validateRecord };
