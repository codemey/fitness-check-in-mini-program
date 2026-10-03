const { localDate } = require('../../lib/dates');
const { DEFAULT_PARTS, MAX_PARTS } = require('../../lib/parts');
const { blankWeek, weekRows } = require('../../lib/plan');
const { request } = require('../../lib/api');

Page({
  data: { loading: false, loaded: false, saving: false, configured: false, effectiveDate: '',
    partOptions: DEFAULT_PARTS, week: weekRows(blankWeek(), DEFAULT_PARTS),
    editingDay: -1, dirty: false, error: '' },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, loaded: false, error: '' });
    try {
      const [settings, plan] = await Promise.all([
        request('parts'), request('getPlan', { date: localDate() })
      ]);
      this.setData({ partOptions: settings.parts,
        week: weekRows(plan ? plan.days : blankWeek(), settings.parts),
        configured: !!plan, effectiveDate: plan ? plan.effectiveDate : '',
        editingDay: -1, dirty: false, loaded: true });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ loading: false }); }
  },
  selectDay(event) {
    const day = Number(event.currentTarget.dataset.day);
    if (!Number.isInteger(day) || day < 0 || day > 6) return;
    this.setData({ editingDay: this.data.editingDay === day ? -1 : day });
  },
  togglePart(event) {
    if (this.data.saving) return;
    const day = Number(event.currentTarget.dataset.day);
    const label = event.currentTarget.dataset.part;
    if (!Number.isInteger(day) || day < 0 || day > 6
      || !this.data.week[day].choices.some(option => option.label === label)) return;
    const days = this.data.week.map(row => row.parts.slice());
    const index = days[day].indexOf(label);
    if (index >= 0) days[day].splice(index, 1);
    else {
      if (days[day].length >= MAX_PARTS) {
        wx.showToast({ title: '每天最多12个部位', icon: 'none' });
        return;
      }
      days[day].push(label);
    }
    this.setData({ week: weekRows(days, this.data.partOptions), dirty: true, error: '' });
  },
  setRest(event) {
    if (this.data.saving) return;
    const day = Number(event.currentTarget.dataset.day);
    if (!Number.isInteger(day) || day < 0 || day > 6) return;
    const days = this.data.week.map(row => row.parts.slice());
    days[day] = [];
    this.setData({ week: weekRows(days, this.data.partOptions), dirty: true, error: '' });
  },
  async savePlan() {
    if (this.data.saving || !this.data.dirty) return;
    this.setData({ saving: true, error: '' });
    try {
      const days = this.data.week.map(row => row.parts);
      const plan = await request('savePlan', { days });
      this.setData({ configured: true, effectiveDate: plan.effectiveDate, dirty: false });
      wx.showToast({ title: '计划已保存', icon: 'success' });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ saving: false }); }
  }
});
