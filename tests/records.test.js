const test = require('node:test');
const assert = require('node:assert/strict');
const { localDate, localDateTime, shiftMonth, calendarCells } = require('../miniprogram/lib/dates');
const { validDate, validMonth, validPartOptions, validPlanDays, validateRecord,
  createHandler } = require('../cloudfunctions/records/handler');

function fakeCloud(currentUser = 'owner') {
  const documents = new Map();
  const cloud = {
    getWXContext: () => ({ OPENID: currentUser }),
    database: () => ({ collection: () => ({
      doc: id => ({
        set: async ({ data }) => { documents.set(id, { _id: id, ...data }); },
        remove: async () => { documents.delete(id); }
      }),
      where: filter => {
        const query = {
          offset: 0, count: Infinity, sortKey: null,
          limit(number) { this.count = number; return this; },
          skip(number) { this.offset = number; return this; },
          orderBy(key) { this.sortKey = key; return this; },
          async get() {
            let data = [...documents.values()].filter(record =>
              Object.entries(filter).every(([key, value]) => record[key] === value));
            if (this.sortKey) data.sort((a, b) => a[this.sortKey].localeCompare(b[this.sortKey]));
            return { data: data.slice(this.offset, this.offset + this.count) };
          }
        };
        return query;
      }
    }) })
  };
  return { cloud, documents, asUser: user => { currentUser = user; } };
}

test('日期处理在本地时区且月历按周一起始', () => {
  assert.equal(localDate(new Date(2024, 1, 29, 23, 55)), '2024-02-29');
  assert.equal(localDateTime(new Date(2024, 1, 29, 23, 5, 9)), '2024-02-29 23:05:09');
  assert.equal(shiftMonth('2025-01', -1), '2024-12');
  assert.equal(shiftMonth('2025-12', 1), '2026-01');
  const cells = calendarCells('2024-02', [{ date: '2024-02-29', trained: true }], '2024-02-29');
  assert.equal(cells[0].empty, true);
  assert.equal(cells[3].date, '2024-02-01');
  assert.equal(cells.find(cell => cell.date === '2024-02-29').trained, true);
  assert.equal(cells.filter(cell => cell.date).length, 29);
});

test('严格校验日期与训练部位', () => {
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2025-02-29'), false);
  assert.equal(validDate('2025-13-01'), false);
  assert.equal(validMonth('2025-00'), false);
  assert.equal(validateRecord(true, ['胸', '背']), true);
  assert.equal(validateRecord(true, ['有氧跑步']), true);
  assert.equal(validateRecord(true, []), false);
  assert.equal(validateRecord(true, ['胸', '胸']), false);
  assert.equal(validateRecord(false, []), false);
  assert.equal(validateRecord(false, ['腿']), false);
  assert.equal(validPartOptions(['胸', '胸']), false);
  assert.equal(validPartOptions(['过长的训练部位名称']), false);
  assert.equal(validPlanDays([['胸'], [], [], [], [], [], []]), true);
  assert.equal(validPlanDays([['胸'], []]), false);
  assert.equal(validPlanDays([['胸', '胸'], [], [], [], [], [], []]), false);
});

test('每周计划按生效日保留历史，休息日不出现在日历计划中', async () => {
  const { cloud, documents } = fakeCloud();
  const handle = createHandler(cloud, 'owner');
  const oldDays = [['胸'], [], [], [], [], [], []];
  const newDays = [['背'], [], [], [], [], [], []];
  documents.set('owner_weekly_plan', { _id: 'owner_weekly_plan', revisions: [
    { effectiveDate: '2025-01-01', days: oldDays },
    { effectiveDate: '2025-01-15', days: newDays }
  ] });
  assert.equal((await handle({ action: 'getPlan', date: '2024-12-31' })).data, null);
  assert.deepEqual((await handle({ action: 'getPlan', date: '2025-01-13' })).data.days[0], ['胸']);
  assert.deepEqual((await handle({ action: 'getPlan', date: '2025-01-20' })).data.days[0], ['背']);
  const month = (await handle({ action: 'planMonth', month: '2025-01' })).data;
  assert.deepEqual(month.find(day => day.date === '2025-01-13').parts, ['胸']);
  assert.deepEqual(month.find(day => day.date === '2025-01-20').parts, ['背']);
  assert.equal(month.some(day => day.date === '2025-01-21'), false);
  assert.deepEqual((await handle({ action: 'export' })).data, []);

  const saved = await handle({ action: 'savePlan', days: [['腿'], [], [], [], [], [], []] });
  assert.equal(saved.ok, true);
  assert.deepEqual((await handle({ action: 'getPlan', date: '2025-01-13' })).data.days[0], ['胸']);
  assert.deepEqual((await handle({ action: 'getPlan', date: saved.data.effectiveDate })).data.days[0], ['腿']);
  assert.equal(documents.get('owner_weekly_plan').ownerId, undefined);
  assert.equal((await handle({ action: 'savePlan', days: [['胸']] })).ok, false);
});

test('训练计划随备份恢复，并拒绝无效版本', async () => {
  const { cloud } = fakeCloud();
  const handle = createHandler(cloud, 'owner');
  const revisions = [{ effectiveDate: '2025-01-01',
    days: [['胸'], [], [], [], [], [], []] }];
  assert.deepEqual((await handle({ action: 'restorePlan', revisions })).data, { count: 1 });
  assert.deepEqual((await handle({ action: 'exportPlan' })).data, revisions);
  assert.equal((await handle({ action: 'restorePlan', revisions: [...revisions, ...revisions] })).ok, false);
  assert.equal((await handle({ action: 'restorePlan', revisions: [{ ...revisions[0],
    effectiveDate: '2025-02-29' }] })).ok, false);
});

test('未绑定时只可读取自己的身份', async () => {
  const { cloud } = fakeCloud();
  const handle = createHandler(cloud, '');
  assert.deepEqual(await handle({ action: 'identity' }), { ok: true, data: { openid: 'owner', bound: false } });
  assert.equal((await handle({ action: 'save', date: '2025-01-01', trained: true, parts: ['腿'] })).ok, false);
});

test('同日多部位覆盖保存、历史查询和删除', async () => {
  const { cloud, documents } = fakeCloud();
  const handle = createHandler(cloud, 'owner');
  assert.equal((await handle({ action: 'get', date: '2025-03-08' })).data, null);
  assert.deepEqual((await handle({ action: 'save', date: '2025-03-08', trained: true, parts: ['背', '胸'] })).data,
    { date: '2025-03-08', trained: true, parts: ['背', '胸'] });
  assert.equal(documents.size, 1);
  assert.deepEqual((await handle({ action: 'list', month: '2025-03' })).data,
    [{ date: '2025-03-08', trained: true, parts: ['背', '胸'] }]);
  assert.equal((await handle({ action: 'save', date: '2025-03-08', trained: false, parts: [] })).ok, false);
  assert.equal(documents.size, 1);
  assert.deepEqual((await handle({ action: 'get', date: '2025-03-08' })).data,
    { date: '2025-03-08', trained: true, parts: ['背', '胸'] });
  assert.equal((await handle({ action: 'export' })).data.length, 1);
  await handle({ action: 'remove', date: '2025-03-08' });
  assert.equal((await handle({ action: 'get', date: '2025-03-08' })).data, null);
});

test('更新部位选项不改写历史记录，旧部位仍可编辑', async () => {
  const { cloud, documents } = fakeCloud();
  const handle = createHandler(cloud, 'owner');
  assert.deepEqual((await handle({ action: 'parts' })).data.parts, ['胸', '背', '肩', '腿']);
  await handle({ action: 'save', date: '2025-03-08', trained: true, parts: ['胸'] });
  assert.deepEqual((await handle({ action: 'saveParts', parts: ['有氧跑步', '瑜伽'] })).data.parts,
    ['有氧跑步', '瑜伽']);
  assert.deepEqual((await handle({ action: 'parts' })).data.parts, ['有氧跑步', '瑜伽']);
  assert.deepEqual((await handle({ action: 'get', date: '2025-03-08' })).data.parts, ['胸']);
  assert.equal(documents.get('owner_2025-03-08').parts[0], '胸');
  assert.equal(documents.get('owner_part_options').ownerId, undefined);
  assert.equal((await handle({ action: 'save', date: '2025-03-09', trained: true,
    parts: ['有氧跑步'] })).ok, true);
  assert.equal((await handle({ action: 'save', date: '2025-03-08', trained: true,
    parts: ['胸', '瑜伽'] })).ok, true);
  assert.deepEqual((await handle({ action: 'export' })).data.map(record => record.parts),
    [['胸', '瑜伽'], ['有氧跑步']]);
  assert.equal((await handle({ action: 'saveParts', parts: ['胸', '胸'] })).ok, false);
});

test('旧版没练记录按未记录处理', async () => {
  const { cloud, documents } = fakeCloud();
  const handle = createHandler(cloud, 'owner');
  documents.set('owner_2025-03-09', { _id: 'owner_2025-03-09', ownerId: 'owner',
    date: '2025-03-09', month: '2025-03', trained: false, parts: [] });
  assert.equal((await handle({ action: 'get', date: '2025-03-09' })).data, null);
  assert.deepEqual((await handle({ action: 'list', month: '2025-03' })).data, []);
  assert.deepEqual((await handle({ action: 'export' })).data, []);
});

test('导入备份按当前账号写入并拒绝无效批次', async () => {
  const { cloud, documents } = fakeCloud();
  const handle = createHandler(cloud, 'owner');
  await handle({ action: 'save', date: '2025-03-08', trained: true, parts: ['背'] });
  await handle({ action: 'save', date: '2025-03-07', trained: true, parts: ['肩'] });
  const records = [
    { date: '2025-03-08', trained: true, parts: ['腿', '胸'] },
    { date: '2025-03-09', trained: true, parts: ['肩'] }
  ];
  assert.deepEqual((await handle({ action: 'import', records })).data, { count: 2 });
  assert.deepEqual(documents.get('owner_2025-03-08').parts, ['腿', '胸']);
  assert.equal(documents.get('owner_2025-03-08').ownerId, 'owner');
  assert.deepEqual(documents.get('owner_2025-03-07').parts, ['肩']);
  assert.equal((await handle({ action: 'import', records: [records[0], records[0]] })).ok, false);
  assert.equal((await handle({ action: 'import', records: [{ date: '2025-03-10', trained: false, parts: [] }] })).ok, false);
  assert.equal((await handle({ action: 'import', records: Array(11).fill(records[0]) })).ok, false);
  assert.equal(documents.size, 3);
});

test('备份超过单次查询数量时完整分页且按日期排序', async () => {
  const { cloud, documents } = fakeCloud();
  const handle = createHandler(cloud, 'owner');
  for (let index = 0; index < 105; index += 1) {
    const date = new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10);
    await handle({ action: 'save', date, trained: true, parts: ['肩', '背'] });
  }
  const exported = (await handle({ action: 'export' })).data;
  assert.equal(exported.length, 105);
  assert.equal(exported[0].date, '2024-01-01');
  assert.equal(exported[104].date, '2024-04-14');
  assert.equal((await handle({ action: 'save', date: '2024-01-01', trained: false, parts: ['胸'] })).ok, false);
  assert.equal(documents.get('owner_2024-01-01').trained, true);
});

test('其他微信账号无法读取或写入', async () => {
  const { cloud, asUser, documents } = fakeCloud();
  const handle = createHandler(cloud, 'owner');
  await handle({ action: 'save', date: '2025-03-08', trained: true, parts: ['腿'] });
  asUser('stranger');
  assert.equal((await handle({ action: 'identity' })).data.bound, false);
  for (const action of ['parts', 'saveParts', 'getPlan', 'planMonth', 'savePlan',
    'exportPlan', 'restorePlan', 'get', 'list', 'save', 'remove', 'import', 'export']) {
    assert.equal((await handle({ action, date: '2025-03-08', month: '2025-03', trained: false, parts: [] })).ok, false);
  }
  assert.equal(documents.size, 1);
});
