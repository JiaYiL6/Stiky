const { app, globalShortcut } = require('electron');
const storageManager = require('./src/main/storageManager');
const windowManager = require('./src/main/windowManager');
const { register: registerIpcHandlers } = require('./src/main/ipcHandlers');
const trayManager = require('./src/main/trayManager');
const shortcutManager = require('./src/main/shortcutManager');

// 应用名称
app.setName('Stiky');

// 标记是否为退出操作
app.isQuitting = false;

app.whenReady().then(() => {
  // 初始化存储
  storageManager.init();

  // 注册 IPC
  registerIpcHandlers();

  // 初始化窗口管理器
  windowManager.init && windowManager.init();

  // 创建系统托盘
  trayManager.create();

  // 注册全局快捷键
  shortcutManager.register();

  // 启动时不打开便签，仅显示托盘图标
  // 双击exe/快捷方式 → second-instance事件 → 新建便签
});

// 点击任务栏/dock 图标 → 仅激活（不新建便签）
app.on('activate', () => {
  // 不新建便签，仅通过托盘菜单新建
});

// 所有窗口关闭时不退出（驻留托盘）
app.on('window-all-closed', () => {
  if (!app.isQuitting) {
    // 不退出，保持在托盘
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  // 注销快捷键
  shortcutManager.unregister();
});

// 防止多实例（可选）
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 双击exe或快捷方式 → 仅激活，不新建便签
    // 通过托盘菜单新建便签
  });
}
