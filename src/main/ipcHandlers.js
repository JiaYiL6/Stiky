const { ipcMain, clipboard, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const storageManager = require('./storageManager');
const windowManager = require('./windowManager');

function register() {
  // ─── 便签操作 ───
  ipcMain.handle('note:create', (event, preferPosition) => {
    const note = storageManager.createNote({}, preferPosition);
    windowManager.createNoteWindow(note);
    return note;
  });

  ipcMain.handle('note:delete', (event, id) => {
    const entry = windowManager.getNoteWindow(id);
    if (entry && !entry.window.isDestroyed()) {
      entry.window.close();
    }
    storageManager.deleteNote(id);
  });

  ipcMain.handle('note:save', (event, data) => {
    storageManager.saveNote(data);
  });

  ipcMain.handle('note:get-all', () => {
    return storageManager.getAllNotes();
  });

  ipcMain.handle('note:focus', (event, id) => {
    windowManager.focusNote(id);
  });

  ipcMain.handle('note:set-always-on-top', (event, id) => {
    return windowManager.toggleAlwaysOnTop(id);
  });

  ipcMain.handle('note:set-opacity', (event, id, value) => {
    windowManager.setOpacity(id, value);
  });

  ipcMain.handle('note:set-color', (event, id, color) => {
    windowManager.setNoteColor(id, color);
    storageManager.saveNote({ id, color });
  });

  // ─── 文件操作 ───
  ipcMain.handle('file:add', async (event, sourcePath, noteId) => {
    try {
      const fileData = await storageManager.stageFile(sourcePath, noteId);
      // 通知对应便签窗口更新
      const entry = windowManager.getNoteWindow(noteId);
      if (entry) {
        const files = storageManager.getFilesByNote(noteId);
        entry.window.webContents.send('transfer:files-changed', files);
      }
      return fileData;
    } catch (e) {
      console.error('file:add error:', e.message);
      throw e;
    }
  });

  ipcMain.handle('file:remove', async (event, id) => {
    const fileData = storageManager.getFileById(id);
    await storageManager.removeStagedFile(id);
    if (fileData) {
      const entry = windowManager.getNoteWindow(fileData.noteId);
      if (entry) {
        const files = storageManager.getFilesByNote(fileData.noteId);
        entry.window.webContents.send('transfer:files-changed', files);
      }
    }
  });

  ipcMain.handle('file:get-by-note', (event, noteId) => {
    return storageManager.getFilesByNote(noteId);
  });

  ipcMain.handle('file:get-all', () => {
    return storageManager.getAllFiles();
  });

  // file:start-drag 必须用同步 IPC (on/send)，因为 startDrag 必须在手势上下文中调用
  ipcMain.on('file:start-drag', (event, fileId) => {
    const fileData = storageManager.getFileById(fileId);
    if (!fileData) return;

    const filePath = storageManager._getFilePath(fileData);
    if (!fs.existsSync(filePath)) return;

    // 图标：优先使用文件缩略图
    const { nativeImage } = require('electron');
    let icon;
    if (fileData.thumbnailPath) {
      const thumbPath = path.join(storageManager.thumbnailsDir, fileData.thumbnailPath);
      if (fs.existsSync(thumbPath)) {
        icon = nativeImage.createFromPath(thumbPath);
      }
    }
    if (!icon || icon.isEmpty()) {
      // 回退：生成 32×32 浅黄色图标
      const s = 32;
      const buf = Buffer.alloc(s * s * 4);
      for (let i = 0; i < s * s; i++) {
        buf[i * 4] = 255; buf[i * 4 + 1] = 250; buf[i * 4 + 2] = 205; buf[i * 4 + 3] = 255;
      }
      icon = nativeImage.createFromBuffer(buf, { width: s, height: s });
    }

    // 直接拖出存储的文件（文件名已是原始名称）
    event.sender.startDrag({ file: filePath, icon });
  });

  ipcMain.handle('file:show-context-menu', (event, fileId) => {
    const { Menu } = require('electron');
    const fileData = storageManager.getFileById(fileId);
    if (!fileData) return;

    const fullPath = storageManager._getFilePath(fileData);

    const template = [
      {
        label: fileData.originalName.length > 40
          ? fileData.originalName.slice(0, 40) + '...'
          : fileData.originalName,
        enabled: false
      },
      { type: 'separator' },
      {
        label: '复制文件路径',
        click: () => clipboard.writeText(fullPath)
      },
      {
        label: '打开所在文件夹',
        click: () => {
          require('electron').shell.showItemInFolder(fullPath);
        }
      },
      { type: 'separator' },
      {
        label: '删除文件',
        click: async () => {
          const fd = storageManager.getFileById(fileId);
          await storageManager.removeStagedFile(fileId);
          if (fd) {
            const entry = windowManager.getNoteWindow(fd.noteId);
            if (entry) {
              entry.window.webContents.send('transfer:files-changed', storageManager.getFilesByNote(fd.noteId));
            }
          }
        }
      }
    ];

    Menu.buildFromTemplate(template).popup({
      window: require('electron').BrowserWindow.fromWebContents(event.sender)
    });
  });

  ipcMain.handle('file:open-folder', () => {
    const { shell } = require('electron');
    const storageDir = storageManager._getStorageDir();
    shell.openPath(storageDir);
  });

  ipcMain.handle('file:clear-all', async () => {
    storageManager.clearAllFiles();
    const allFiles = storageManager.getAllFiles();
    windowManager.broadcastToAllNotes('transfer:files-changed', allFiles);
    if (windowManager.transferWindow && !windowManager.transferWindow.isDestroyed()) {
      windowManager.transferWindow.webContents.send('transfer:files-changed', allFiles);
    }
  });

  ipcMain.handle('file:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  // ─── 设置操作 ───
  ipcMain.handle('settings:get', () => {
    return storageManager.getSettings();
  });

  ipcMain.handle('settings:set', (event, partial) => {
    storageManager.saveSettings(partial);
    const settings = storageManager.getSettings();

    // 字体大小变更 → 广播到所有便签实时更新
    if (partial.noteDefaults && partial.noteDefaults.defaultFontSize !== undefined) {
      windowManager.broadcastToAllNotes('app:font-size', partial.noteDefaults.defaultFontSize);
    }

    // 任务栏显示开关
    if (partial.general && partial.general.showTaskbar !== undefined) {
      const show = partial.general.showTaskbar;
      for (const [, entry] of windowManager.noteWindows) {
        if (!entry.window.isDestroyed()) entry.window.setSkipTaskbar(!show);
      }
    }

    return settings;
  });

  // ─── 窗口操作 ───
  ipcMain.handle('window:open-settings', () => {
    windowManager.createSettingsWindow();
  });

  ipcMain.handle('window:close-settings', () => {
    windowManager.closeSettingsWindow();
  });

  ipcMain.handle('window:open-note-manager', () => {
    windowManager.createNoteManagerWindow();
  });

  ipcMain.handle('window:close-note-manager', () => {
    windowManager.closeNoteManagerWindow();
  });

  ipcMain.handle('window:minimize', (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.handle('window:close', (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });

  ipcMain.handle('window:toggle-maximize', (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle('window:get-thumbnail-path', (event, thumbName) => {
    if (!thumbName) return '';
    const thumbPath = path.join(storageManager.thumbnailsDir, thumbName);
    // 返回 file:// 协议的路径
    return 'file:///' + thumbPath.replace(/\\/g, '/');
  });
}

module.exports = { register };
