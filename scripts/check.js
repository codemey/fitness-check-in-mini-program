const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let checked = 0;
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { inspect(file); continue; }
    if (entry.name.endsWith('.json')) JSON.parse(fs.readFileSync(file, 'utf8'));
    if (entry.name.endsWith('.js')) execFileSync(process.execPath, ['--check', file]);
    checked += 1;
  }
}
inspect(path.join(root, 'miniprogram'));
inspect(path.join(root, 'cloudfunctions'));
for (const page of JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8')).pages) {
  for (const extension of ['js', 'json', 'wxml', 'wxss']) {
    if (!fs.existsSync(path.join(root, 'miniprogram', `${page}.${extension}`))) {
      throw new Error(`缺少页面文件: ${page}.${extension}`);
    }
  }
}
console.log(`检查通过：${checked} 个小程序及云函数字段文件`);
