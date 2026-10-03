const test = require('node:test');
const assert = require('node:assert/strict');
const { request } = require('../miniprogram/lib/api');

test('云环境不存在时显示可操作的接入提示', async () => {
  global.getApp = () => ({ globalData: { setupError: '' } });
  global.wx = { cloud: { callFunction: () => Promise.reject(new Error('errCode: -501000 | Environment not found INVALID_ENV')) } };
  await assert.rejects(request('get', { date: '2026-10-02' }), /核对环境 ID、环境状态及 AppID 关联或授权/);
});

test('其他云函数错误保持原有提示', async () => {
  global.getApp = () => ({ globalData: { setupError: '' } });
  global.wx = { cloud: { callFunction: () => Promise.resolve({ result: { ok: false, message: '云函数尚未配置 OWNER_OPENID' } }) } };
  await assert.rejects(request('get'), /OWNER_OPENID/);
});
