const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const storageManager = require('./storageManager');

// 应用图标路径（开发/生产）
function getIconPath() {
  const devPath = path.join(__dirname, '..', 'assets', 'icon.ico');
  if (fs.existsSync(devPath)) return devPath;
  try { return path.join(process.resourcesPath, 'assets', 'icon.ico'); } catch (_) { return ''; }
}

class WindowManager {
  constructor() {
    this.noteWindows = new Map();
    this.transferWindow = null;
    this.settingsWindow = null;
    this.noteManagerWindow = null;
  }

  // ─── 便签窗口 ───
  createNoteWindow(noteData, show = true) {
    if (!noteData) {
      noteData = storageManager.createNote();
    }

    const preloadPath = path.join(__dirname, '..', '..', 'preload.js');
    const noteHTML = path.join(__dirname, '..', 'renderer', 'note', 'index.html');

    const win = new BrowserWindow({
      width: noteData.size.width || 580,
      height: noteData.size.height || 420,
      x: noteData.position.x,
      y: noteData.position.y,
      minWidth: 200,
      minHeight: 130,
      frame: false,
      transparent: true,
      alwaysOnTop: noteData.alwaysOnTop || false,
      backgroundColor: '#00000000',
      hasShadow: true,
      resizable: true,
      skipTaskbar: !(storageManager.getSettings().general?.showTaskbar !== false),
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    win.loadFile(noteHTML, {
      query: { id: noteData.id }
    });

    // 设置透明度（创建后）
    if (noteData.opacity !== undefined && noteData.opacity < 1) {
      win.setOpacity(noteData.opacity);
    }

    // 关闭前检查：空白便签直接删除
    win.on('close', () => {
      const note = storageManager.getNote(noteData.id);
      if (note) {
        const content = (note.content || '').replace(/<[^>]*>/g, '').trim();
        const hasImage = /<img\b/i.test(note.content || '');
        if (!content && !hasImage) {
          storageManager.deleteNote(noteData.id);
        }
      }
    });

    win.on('closed', () => {
      this.noteWindows.delete(noteData.id);
    });

    // 窗口移动/调整大小后保存位置
    let moveResizeTimer = null;
    const saveBounds = () => {
      clearTimeout(moveResizeTimer);
      moveResizeTimer = setTimeout(() => {
        if (win.isDestroyed()) return;
        const bounds = win.getBounds();
        const [w, h] = win.getSize();
        storageManager.saveNote({
          id: noteData.id,
          position: { x: bounds.x, y: bounds.y },
          size: { width: w, height: h }
        });
      }, 1000);
    };

    win.on('move', saveBounds);
    win.on('resize', saveBounds);

    // 失焦时保存内容
    win.on('blur', () => {
      if (!win.isDestroyed()) {
        win.webContents.send('app:auto-save');
      }
    });

    this.noteWindows.set(noteData.id, { window: win, data: noteData });

    if (show) win.show();
    return win;
  }

  getNoteWindow(id) {
    return this.noteWindows.get(id);
  }

  focusNote(id) {
    let entry = this.noteWindows.get(id);
    if (entry) {
      entry.window.focus();
      entry.window.show();
    } else {
      // 窗口已关闭，重新创建
      const note = storageManager.getNote(id);
      if (note) {
        this.createNoteWindow(note, true);
      }
    }
  }

  toggleAlwaysOnTop(id) {
    const entry = this.noteWindows.get(id);
    if (!entry) {
      // 窗口已关闭，只更新存储状态
      const note = storageManager.getNote(id);
      if (!note) return false;
      const newState = !note.alwaysOnTop;
      storageManager.saveNote({ id, alwaysOnTop: newState });
      return newState;
    }
    const newState = !entry.window.isAlwaysOnTop();
    entry.window.setAlwaysOnTop(newState, 'floating');
    storageManager.saveNote({ id, alwaysOnTop: newState });
    return newState;
  }

  setOpacity(id, value) {
    const entry = this.noteWindows.get(id);
    if (!entry) return;
    entry.window.setOpacity(value);
  }

  setNoteColor(id, color) {
    const entry = this.noteWindows.get(id);
    if (entry) {
      entry.data.color = color;
    }
  }

  bringAllToFront() {
    for (const [, entry] of this.noteWindows) {
      if (!entry.window.isDestroyed()) {
        entry.window.show();
        entry.window.focus();
      }
    }
  }

  broadcastToAllNotes(channel, data) {
    for (const [, entry] of this.noteWindows) {
      if (!entry.window.isDestroyed()) {
        entry.window.webContents.send(channel, data);
      }
    }
  }

  // ─── 独立中转站窗口 ───
  createTransferWindow() {
    if (this.transferWindow && !this.transferWindow.isDestroyed()) {
      this.transferWindow.focus();
      return this.transferWindow;
    }

    const preloadPath = path.join(__dirname, '..', '..', 'preload.js');
    const transferHTML = path.join(__dirname, '..', 'renderer', 'transfer-window', 'index.html');

    this.transferWindow = new BrowserWindow({
      width: 300,
      height: 500,
      minWidth: 220,
      minHeight: 300,
      frame: false,
      transparent: false,
      alwaysOnTop: true,
      resizable: true,
      skipTaskbar: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    this.transferWindow.loadFile(transferHTML);
    this.transferWindow.on('closed', () => {
      this.transferWindow = null;
    });

    return this.transferWindow;
  }

  closeTransferWindow() {
    if (this.transferWindow && !this.transferWindow.isDestroyed()) {
      this.transferWindow.close();
      this.transferWindow = null;
    }
  }

  toggleTransferWindow() {
    if (this.transferWindow && !this.transferWindow.isDestroyed()) {
      this.closeTransferWindow();
    } else {
      this.createTransferWindow();
    }
  }

  // ─── 设置窗口 ───
  createSettingsWindow() {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    const preloadPath = path.join(__dirname, '..', '..', 'preload.js');
    const settingsHTML = path.join(__dirname, '..', 'renderer', 'settings', 'index.html');

    this.settingsWindow = new BrowserWindow({
      width: 480,
      height: 600,
      frame: false,
      icon: getIconPath(),
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: true,
      resizable: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    this.settingsWindow.loadFile(settingsHTML);
    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });

    return this.settingsWindow;
  }

  closeSettingsWindow() {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.close();
      this.settingsWindow = null;
    }
  }

  // ─── 便签管理器窗口 ───
  createNoteManagerWindow() {
    if (this.noteManagerWindow && !this.noteManagerWindow.isDestroyed()) {
      this.noteManagerWindow.focus();
      return this.noteManagerWindow;
    }

    const preloadPath = path.join(__dirname, '..', '..', 'preload.js');
    const managerHTML = path.join(__dirname, '..', 'renderer', 'note-manager', 'index.html');

    this.noteManagerWindow = new BrowserWindow({
      width: 500,
      height: 550,
      minWidth: 380,
      minHeight: 350,
      frame: false,
      icon: getIconPath(),
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: true,
      resizable: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    this.noteManagerWindow.loadFile(managerHTML);
    this.noteManagerWindow.on('closed', () => {
      this.noteManagerWindow = null;
    });

    return this.noteManagerWindow;
  }

  closeNoteManagerWindow() {
    if (this.noteManagerWindow && !this.noteManagerWindow.isDestroyed()) {
      this.noteManagerWindow.close();
      this.noteManagerWindow = null;
    }
  }
}

module.exports = new WindowManager();
