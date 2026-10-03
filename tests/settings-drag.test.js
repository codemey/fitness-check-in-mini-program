const test = require('node:test');
const assert = require('node:assert/strict');

let definition;
global.Page = page => { definition = page; };
require('../miniprogram/pages/settings/index');
delete global.Page;

const rowRects = [0, 86, 172, 258].map(top => ({ top, height: 72 }));
global.wx = {
  createSelectorQuery() {
    return {
      in() { return this; },
      selectAll() { return this; },
      boundingClientRect(callback) { this.callback = callback; return this; },
      exec() { this.callback(rowRects); }
    };
  }
};

function pageWithParts() {
  return {
    ...definition,
    data: { partDraft: ['胸', '背', '肩', '腿'].map((label, index) => ({ id: index + 1, label })),
      partsDirty: false, loading: false, savingParts: false },
    setData(change) { Object.assign(this.data, change); }
  };
}

function drag(page, id, fromY, toY) {
  page.startPartDrag({ currentTarget: { dataset: { id } }, touches: [{ clientY: fromY }] });
  page.movePartDrag({ touches: [{ clientY: toY }] });
  page.endPartDrag();
}

test('拖动部位到末尾和开头，松手后保持顺序并等待保存', () => {
  const page = pageWithParts();
  drag(page, 2, 122, 340);
  assert.deepEqual(page.data.partDraft.map(part => part.label), ['胸', '肩', '腿', '背']);
  assert.equal(page.data.partsDirty, true);

  drag(page, 4, 208, 0);
  assert.deepEqual(page.data.partDraft.map(part => part.label), ['腿', '胸', '肩', '背']);
  assert.equal(page.data.draggingPartId, null);
});
