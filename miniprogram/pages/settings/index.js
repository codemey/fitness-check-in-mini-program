const { request } = require('../../lib/api');
const { localDateTime } = require('../../lib/dates');
const { parseBackup } = require('../../lib/backup');
const { MAX_PARTS, validPartOptions } = require('../../lib/parts');

const BATCH_SIZE = 10;

Page({
  data: { openid: '', bound: false, loading: false, exporting: false, importing: false,
    partDraft: [], partsDirty: false, savingParts: false,
    draggingPartId: null, dropIndex: -1, dragStyle: '',
    importText: '', hasImportText: false, importedCount: 0, importTotal: 0, importResult: '', error: '' },
  onShow() { this.refresh(); },
  async refresh() {
    this.setData({ loading: true, error: '' });
    try {
      const { openid, bound } = await request('identity');
      const settings = bound ? await request('parts') : { parts: [] };
      this._partSeq = settings.parts.length;
      this.setData({ openid, bound, partsDirty: false,
        partDraft: settings.parts.map((label, index) => ({ id: index + 1, label })) });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ loading: false }); }
  },
  editPart(event) {
    const index = Number(event.currentTarget.dataset.index);
    const label = event.detail.value;
    this.setData({ partDraft: this.data.partDraft.map((part, position) =>
      position === index ? { ...part, label } : part), partsDirty: true, error: '' });
  },
  addPart() {
    if (this.data.partDraft.length >= MAX_PARTS) return;
    this._partSeq = (this._partSeq || 0) + 1;
    this.setData({ partDraft: [...this.data.partDraft, { id: this._partSeq, label: '' }],
      partsDirty: true, error: '' });
  },
  removePart(event) {
    if (this.data.partDraft.length <= 1) {
      wx.showToast({ title: '至少保留一个部位', icon: 'none' });
      return;
    }
    const id = Number(event.currentTarget.dataset.id);
    this.setData({ partDraft: this.data.partDraft.filter(part => part.id !== id),
      partsDirty: true, error: '' });
  },
  startPartDrag(event) {
    if (this.data.savingParts || this.data.loading) return;
    const id = Number(event.currentTarget.dataset.id);
    const from = this.data.partDraft.findIndex(part => part.id === id);
    const touch = event.touches && event.touches[0];
    if (from < 0 || !touch) return;
    const drag = { id, from, startY: touch.clientY, target: from, centers: null };
    this._partDrag = drag;
    this.setData({ draggingPartId: id, dropIndex: from, dragStyle: '' });
    wx.createSelectorQuery().in(this).selectAll('.part-edit-row').boundingClientRect(rects => {
      if (this._partDrag !== drag || !rects || rects.length !== this.data.partDraft.length) return;
      drag.centers = rects.map(rect => rect.top + rect.height / 2);
    }).exec();
  },
  movePartDrag(event) {
    const drag = this._partDrag;
    const touch = event.touches && event.touches[0];
    if (!drag || !touch) return;
    if (drag.centers) {
      drag.target = drag.centers.filter((center, index) => index !== drag.from && touch.clientY > center).length;
    }
    this.setData({ dragStyle: `transform: translateY(${touch.clientY - drag.startY}px);`,
      dropIndex: drag.target });
  },
  endPartDrag() {
    const drag = this._partDrag;
    if (!drag) return;
    this._partDrag = null;
    const partDraft = this.data.partDraft.slice();
    if (drag.target !== drag.from) {
      const [part] = partDraft.splice(drag.from, 1);
      partDraft.splice(drag.target, 0, part);
    }
    this.setData({ partDraft, partsDirty: this.data.partsDirty || drag.target !== drag.from,
      draggingPartId: null, dropIndex: -1, dragStyle: '' });
  },
  async saveParts() {
    if (!this.data.bound || this.data.savingParts || !this.data.partsDirty) return;
    const parts = this.data.partDraft.map(part => part.label.trim());
    if (!validPartOptions(parts)) {
      this.setData({ error: '请填写1至12个不重复的部位名称，每个名称不超过8个字' });
      return;
    }
    this.setData({ savingParts: true, error: '' });
    try {
      const result = await request('saveParts', { parts });
      this._partSeq = result.parts.length;
      this.setData({ partDraft: result.parts.map((label, index) => ({ id: index + 1, label })),
        partsDirty: false });
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ savingParts: false }); }
  },
  async exportRecords() {
    if (this.data.exporting) return;
    this.setData({ exporting: true, error: '' });
    try {
      const [records, planRevisions] = await Promise.all([
        request('export'), request('exportPlan')
      ]);
      const backup = { format: 'punch-in-v2', exportedAt: localDateTime(), records, planRevisions };
      await new Promise((resolve, reject) => wx.setClipboardData({ data: JSON.stringify(backup), success: resolve, fail: reject }));
      wx.showToast({ title: `已复制${records.length}条`, icon: 'none' });
    } catch (error) { this.setData({ error: error.message || '复制失败' }); }
    finally { this.setData({ exporting: false }); }
  },
  onImportInput(event) {
    const importText = event.detail.value;
    this.setData({ importText, hasImportText: !!importText.trim(), importResult: '', error: '' });
  },
  pasteBackup() {
    wx.getClipboardData({
      success: ({ data }) => this.setData({ importText: data, hasImportText: !!data.trim(),
        importResult: '', error: '' }),
      fail: () => this.setData({ error: '读取剪贴板失败' })
    });
  },
  importRecords() {
    if (!this.data.bound || this.data.importing) return;
    let parsed;
    try { parsed = parseBackup(this.data.importText); }
    catch (error) { this.setData({ error: error.message }); return; }
    if (!parsed.records.length && !(parsed.planRevisions && parsed.planRevisions.length)) {
      this.setData({ error: '备份中没有可导入的数据' });
      return;
    }
    const skipped = parsed.skippedRest ? `，跳过${parsed.skippedRest}条旧版“没练”记录` : '';
    const planNote = parsed.planRevisions === null ? ''
      : `，并替换当前训练计划（${parsed.planRevisions.length}个版本）`;
    wx.showModal({ title: '导入备份',
      content: `导入${parsed.records.length}条训练记录${skipped}${planNote}。同日期记录将被覆盖，其他日期保留。`,
      confirmText: '导入',
      success: result => { if (result.confirm) this.performImport(parsed.records,
        parsed.skippedRest, parsed.planRevisions); }
    });
  },
  async performImport(records, skippedRest, planRevisions) {
    this.setData({ importing: true, importedCount: 0, importTotal: records.length,
      importResult: '', error: '' });
    let imported = 0;
    try {
      for (let index = 0; index < records.length; index += BATCH_SIZE) {
        const result = await request('import', { records: records.slice(index, index + BATCH_SIZE) });
        imported += result.count;
        this.setData({ importedCount: imported });
      }
      if (planRevisions !== null) await request('restorePlan', { revisions: planRevisions });
      this.setData({ importText: '', hasImportText: false,
        importResult: `已导入${imported}条记录${planRevisions !== null ? '及训练计划' : ''}${skippedRest ? `，跳过${skippedRest}条旧版记录` : ''}` });
      wx.showToast({ title: '导入完成', icon: 'success' });
    } catch (error) {
      this.setData({ error: `已导入${imported}条，后续导入失败：${error.message}。可重试剩余备份。` });
    } finally {
      this.setData({ importing: false });
    }
  }
});
