const { localDate } = require('../../lib/dates');
const { DEFAULT_PARTS } = require('../../lib/parts');
const { planPartsForDate } = require('../../lib/plan');
const { request } = require('../../lib/api');
Page({
  data: { date: '', record: null, partOptions: DEFAULT_PARTS,
    planParts: [], planSummary: '未设置',
    loaded: false, busy: false, error: '' },
  onShow() {
    const date = localDate();
    this.setData({ date, loaded: false, error: '' });
    this.load(date);
  },
  retry() { this.load(this.data.date); },
  async load(date) {
    try {
      const [record, settings, plan] = await Promise.all([
        request('get', { date }), request('parts'), request('getPlan', { date })
      ]);
      const planParts = planPartsForDate(plan, date);
      if (this.data.date === date) this.setData({ record, partOptions: settings.parts,
        planParts, planSummary: plan ? (planParts.length ? planParts.join(' · ') : '休息日') : '未设置',
        loaded: true });
    } catch (error) {
      if (this.data.date === date) this.setData({ error: error.message, loaded: false });
    }
  },
  applyPlan() {
    const form = this.selectComponent('#today-form');
    if (form) form.applyPlanParts(this.data.planParts);
  },
  openPlan() { wx.switchTab({ url: '/pages/plan/index' }); },
  async save(event) {
    if (this.data.busy) return;
    const date = this.data.date;
    this.setData({ busy: true, error: '' });
    try {
      const record = await request('save', { date, ...event.detail });
      this.setData({ record });
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ busy: false });
    }
  },
  remove() {
    if (this.data.busy) return;
    wx.showModal({ title: '删除记录', content: '删除后，这天会显示为未记录。', success: result => {
      if (result.confirm) this.confirmRemove();
    } });
  },
  async confirmRemove() {
    this.setData({ busy: true, error: '' });
    try {
      await request('remove', { date: this.data.date });
      this.setData({ record: null });
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ busy: false });
    }
  }
});
