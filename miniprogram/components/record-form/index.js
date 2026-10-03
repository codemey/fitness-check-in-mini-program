const { DEFAULT_PARTS, MAX_PARTS, recordPartChoices } = require('../../lib/parts');
Component({
  properties: {
    record: { type: Object, value: null },
    date: { type: String, value: '' },
    busy: { type: Boolean, value: false },
    partOptions: { type: Array, value: DEFAULT_PARTS }
  },
  observers: {
    'date, record, partOptions': function (date, record, partOptions) {
      this.setData({
        trained: !!(record && record.trained),
        parts: recordPartChoices(partOptions, record)
      });
    }
  },
  data: { trained: false, parts: recordPartChoices(DEFAULT_PARTS, null) },
  methods: {
    chooseTrained() {
      if (this.data.busy) return;
      this.setData({ trained: true });
    },
    applyPlanParts(parts) {
      if (this.data.busy || !Array.isArray(parts) || !parts.length) return;
      this.setData({ trained: true,
        parts: recordPartChoices(this.data.partOptions, { parts }) });
    },
    togglePart(event) {
      if (this.data.busy || !this.data.trained) return;
      const label = event.currentTarget.dataset.part;
      const target = this.data.parts.find(part => part.label === label);
      if (target && !target.selected && this.data.parts.filter(part => part.selected).length >= MAX_PARTS) {
        wx.showToast({ title: '最多选择12个部位', icon: 'none' });
        return;
      }
      this.setData({ parts: this.data.parts.map(part => part.label === label
        ? { ...part, selected: !part.selected } : part) });
    },
    save() {
      if (this.data.busy || !this.data.trained) return;
      const parts = this.data.parts.filter(part => part.selected).map(part => part.label);
      if (!parts.length) {
        wx.showToast({ title: '请选择训练部位', icon: 'none' });
        return;
      }
      this.triggerEvent('save', { trained: true, parts });
    },
    remove() {
      if (!this.data.busy) this.triggerEvent('remove');
    }
  }
});
