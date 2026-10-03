const { localDate, monthOf, monthLabel, shiftMonth, calendarCells } = require('../../lib/dates');
const { monthPartStats, yearMonthStats } = require('../../lib/stats');
const { DEFAULT_PARTS } = require('../../lib/parts');
const { request } = require('../../lib/api');

const emptyYear = () => Array.from({ length: 12 }, () => []);

Page({
  data: {
    view: 'calendar', month: '', monthLabel: '', year: '', today: '', todayMonth: '', todayYear: '',
    selected: '', cells: [], record: null, records: [], planDays: [],
    selectedPlanSummary: '无训练安排', partOptions: DEFAULT_PARTS,
    monthStats: monthPartStats([]),
    yearStats: yearMonthStats(emptyYear()), loaded: false, busy: false, error: '',
    yearLoading: false, yearError: '', canNext: false, canNextYear: false
  },
  onShow() {
    const today = localDate();
    const todayMonth = monthOf(today);
    const todayYear = today.slice(0, 4);
    const month = this.data.month && this.data.month <= todayMonth ? this.data.month : todayMonth;
    const year = this.data.year && this.data.year <= todayYear ? this.data.year : todayYear;
    const selected = this.data.selected && monthOf(this.data.selected) === month && this.data.selected <= today
      ? this.data.selected : (month === todayMonth ? today : `${month}-01`);
    this.setData({ today, todayMonth, todayYear, month, monthLabel: monthLabel(month), year,
      selected, canNext: month < todayMonth, canNextYear: year < todayYear, loaded: false });
    if (this.data.view === 'year') this.loadYear(year);
    else this.loadMonth(month);
  },
  switchView(event) {
    const view = event.currentTarget.dataset.view;
    if (!['calendar', 'month', 'year'].includes(view) || view === this.data.view) return;
    this._yearLoadToken = (this._yearLoadToken || 0) + 1;
    this.setData({ view, yearLoading: false });
    if (view === 'year') this.loadYear(this.data.year);
    else if (!this.data.loaded) this.loadMonth(this.data.month);
  },
  retry() { this.loadMonth(this.data.month); },
  retryYear() { this.loadYear(this.data.year); },
  async loadMonth(month) {
    const token = (this._monthLoadToken || 0) + 1;
    this._monthLoadToken = token;
    this.setData({ loaded: false, error: '' });
    try {
      const [records, settings, planDays] = await Promise.all([
        request('list', { month }), request('parts'), request('planMonth', { month })
      ]);
      if (token !== this._monthLoadToken || this.data.month !== month) return;
      const selected = this.data.selected;
      const planned = new Set(planDays.map(day => day.date));
      const selectedPlan = planDays.find(day => day.date === selected);
      this.setData({ records, record: records.find(item => item.date === selected) || null,
        planDays, selectedPlanSummary: selectedPlan ? selectedPlan.parts.join(' · ') : '无训练安排',
        partOptions: settings.parts,
        cells: calendarCells(month, records, this.data.today).map(cell => ({
          ...cell, planned: !!cell.date && planned.has(cell.date)
        })),
        monthStats: monthPartStats(records, settings.parts),
        loaded: true });
    } catch (error) {
      if (token === this._monthLoadToken && this.data.month === month) {
        this.setData({ error: error.message, loaded: false });
      }
    }
  },
  previous() { this.setMonth(shiftMonth(this.data.month, -1)); },
  next() { if (this.data.canNext) this.setMonth(shiftMonth(this.data.month, 1)); },
  pickMonth(event) { this.setMonth(String(event.detail.value).slice(0, 7)); },
  setMonth(month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > this.data.todayMonth) return;
    const selected = monthOf(this.data.selected) === month && this.data.selected <= this.data.today
      ? this.data.selected : (month === this.data.todayMonth ? this.data.today : `${month}-01`);
    this.setData({ month, monthLabel: monthLabel(month), selected, record: null,
      canNext: month < this.data.todayMonth });
    this.loadMonth(month);
  },
  selectDay(event) {
    const date = event.currentTarget.dataset.date;
    if (!this.data.loaded || !date || date > this.data.today) return;
    const plan = this.data.planDays.find(item => item.date === date);
    this.setData({ selected: date, record: this.data.records.find(item => item.date === date) || null,
      selectedPlanSummary: plan ? plan.parts.join(' · ') : '无训练安排' });
  },
  previousYear() { this.setYear(String(Number(this.data.year) - 1)); },
  nextYear() { if (this.data.canNextYear) this.setYear(String(Number(this.data.year) + 1)); },
  pickYear(event) { this.setYear(String(event.detail.value).slice(0, 4)); },
  setYear(year) {
    if (!/^\d{4}$/.test(year) || Number(year) < 1900 || year > this.data.todayYear) return;
    this.setData({ year, canNextYear: year < this.data.todayYear });
    this.loadYear(year);
  },
  async loadYear(year) {
    const token = (this._yearLoadToken || 0) + 1;
    this._yearLoadToken = token;
    this.setData({ yearLoading: true, yearError: '' });
    const months = emptyYear();
    const lastMonth = year === this.data.todayYear ? Number(this.data.todayMonth.slice(5)) : 12;
    try {
      for (let index = 0; index < lastMonth; index += 4) {
        const chunk = await Promise.all(Array.from({ length: Math.min(4, lastMonth - index) }, (_, offset) => {
          const month = `${year}-${String(index + offset + 1).padStart(2, '0')}`;
          return request('list', { month });
        }));
        if (token !== this._yearLoadToken || this.data.year !== year) return;
        chunk.forEach((records, offset) => { months[index + offset] = records; });
      }
      this.setData({ yearStats: yearMonthStats(months), yearLoading: false });
    } catch (error) {
      if (token === this._yearLoadToken && this.data.year === year) {
        this.setData({ yearError: error.message, yearLoading: false });
      }
    }
  },
  async save(event) {
    if (this.data.busy) return;
    const date = this.data.selected;
    this.setData({ busy: true, error: '' });
    try {
      const record = await request('save', { date, ...event.detail });
      if (date === this.data.selected) this.setData({ record });
      await this.loadMonth(this.data.month);
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  },
  remove() {
    if (this.data.busy) return;
    wx.showModal({ title: '删除记录', content: '删除后，这天会显示为未记录。', success: result => {
      if (result.confirm) this.confirmRemove();
    } });
  },
  async confirmRemove() {
    const date = this.data.selected;
    this.setData({ busy: true, error: '' });
    try {
      await request('remove', { date });
      if (date === this.data.selected) this.setData({ record: null });
      await this.loadMonth(this.data.month);
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  }
});
