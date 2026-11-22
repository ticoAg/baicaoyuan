// 网站和 App 共用的纯逻辑在 ../web/src/lib（安全等级、结论措辞、搜索、检索、急救），
// 用 @core/* 引用（见 tsconfig.json 的 paths），这里让 Metro 能读到那个目录。
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../web/src/lib')];

module.exports = config;
