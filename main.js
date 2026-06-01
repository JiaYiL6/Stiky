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

  // 每次启动创建一个新便签
  const defaultNote = storageManager.createNote();
  windowManager.createNoteWindow(defaultNote, true);
});

// macOS: 点击 dock 图标重新创建窗口
app.on('activate', () => {
  if (windowManager.noteWindows && windowManager.noteWindows.size === 0) {
    const defaultNote = storageManager.createNote();
    windowManager.createNoteWindow(defaultNote, true);
  }
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
    // 用户尝试打开第二个实例时，显示已有窗口
    windowManager.bringAllToFront();
  });
}
