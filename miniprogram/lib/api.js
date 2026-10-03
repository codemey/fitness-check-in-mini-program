function request(action, payload = {}) {
  const setupError = getApp().globalData.setupError;
  if (setupError) return Promise.reject(new Error(setupError));
  return wx.cloud.callFunction({ name: 'records', data: { action, ...payload } })
    .then(({ result }) => {
      if (!result || !result.ok) {
        throw new Error(result && result.message ? result.message : '云服务暂不可用，请稍后重试');
      }
      return result.data;
    })
    .catch(error => {
      if (/INVALID_ENV|Environment not found|errCode:\s*-501000/.test(error.message || '')) {
        throw new Error('当前小程序无法访问云环境。请核对环境 ID、环境状态及 AppID 关联或授权。');
      }
      throw error;
    });
}
module.exports = { request };
