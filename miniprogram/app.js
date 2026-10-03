const { envId } = require('./config');
App({
  onLaunch() {
    if (!envId || envId === 'REPLACE_WITH_CLOUDBASE_ENV_ID') {
      this.globalData.setupError = '请先在 config.js 中填写云开发环境 ID';
      return;
    }
    if (!wx.cloud) {
      this.globalData.setupError = '当前微信版本不支持云开发';
      return;
    }
    wx.cloud.init({ env: envId, traceUser: true });
  },
  globalData: { setupError: '' }
});
