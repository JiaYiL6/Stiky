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

    const fileExists = fs.existsSync(fullPath);

    const template = [
      {
        label: fileData.originalName.length > 40
          ? fileData.originalName.slice(0, 40) + '...'
          : fileData.originalName,
        enabled: false
      },
      { type: 'separator' },
      {
        label: '打开文件',
        enabled: fileExists,
        click: () => {
          require('electron').shell.openPath(fullPath);
        }
      },
      { type: 'separator' },
      {
        label: '复制文件路径',
        click: () => clipboard.writeText(fullPath)
      },
      {
        label: '打开所在文件夹',
        enabled: fileExists,
        click: () => {
          require('electron').shell.showItemInFolder(fullPath);
        }
      },
      { type: 'separator' },
      {
        label: '移出中转站',
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

  // 双击打开文件（使用系统默认程序）
  ipcMain.handle('file:open', async (event, fileId) => {
    const { shell } = require('electron');
    const fileData = storageManager.getFileById(fileId);
    if (!fileData) return { success: false, error: 'FILE_NOT_FOUND' };
    const fullPath = storageManager._getFilePath(fileData);
    if (!fs.existsSync(fullPath)) return { success: false, error: 'FILE_MISSING' };
    const err = await shell.openPath(fullPath);
    if (err) {
      console.error('file:open error:', err);
      return { success: false, error: err };
    }
    return { success: true };
  });

  ipcMain.handle('app:open-external', (event, url) => {
    const { shell } = require('electron');
    return shell.openExternal(url);
  });

  ipcMain.handle('app:get-version', () => {
    const pkg = require('../../package.json');
    return pkg.version;
  });

  ipcMain.handle('app:check-update', async () => {
    const { net } = require('electron');
    const pkg = require('../../package.json');
    const current = pkg.version;
    try {
      const response = await net.fetch('https://api.github.com/repos/JiaYiL6/Stiky/releases/latest', {
        headers: { 'User-Agent': 'Stiky/' + current }
      });
      if (response.status === 404) return { current, latest: current, newer: false, url: '', downloadUrl: '' };
      if (!response.ok) return { error: `HTTP ${response.status}` };
      const data = await response.json();
      const latest = data.tag_name ? data.tag_name.replace(/^v/, '') : null;
      if (!latest) return { error: '无法获取版本信息' };
      const newer = latest > current;
      // 提取 .exe 下载链接
      let downloadUrl = data.html_url || '';
      if (data.assets && data.assets.length > 0) {
        const exeAsset = data.assets.find(a => a.name && a.name.endsWith('.exe'));
        if (exeAsset) downloadUrl = exeAsset.browser_download_url;
      }
      return { current, latest, newer, url: data.html_url, downloadUrl };
    } catch (e) {
      return { error: e.message };
    }
  });

  // 下载更新（使用 Electron net 模块，兼容 Windows 证书）
  ipcMain.on('app:download-update', (event, downloadUrl) => {
    const { net, app } = require('electron');
    const tmpDir = require('os').tmpdir();
    const destPath = path.join(tmpDir, 'Stiky_Setup_Update.exe');
    const sender = event.sender;

    doDownload(net, downloadUrl, destPath, sender, 0);
  });

  function doDownload(net, url, destPath, sender, redirectCount) {
    if (redirectCount > 5) {
      sender.send('update:error', '重定向次数过多');
      return;
    }

    const file = fs.createWriteStream(destPath);
    const request = net.request({ url, method: 'GET' });

    request.on('response', (response) => {
      // 处理重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        try { fs.unlinkSync(destPath); } catch (_) {}
        const nextUrl = response.headers.location;
        // 相对路径转绝对路径
        const fullUrl = nextUrl.startsWith('http') ? nextUrl : new URL(nextUrl, url).href;
        doDownload(net, fullUrl, destPath, sender, redirectCount + 1);
        return;
      }

      if (response.statusCode >= 400) {
        file.close();
        try { fs.unlinkSync(destPath); } catch (_) {}
        sender.send('update:error', `HTTP ${response.statusCode}`);
        return;
      }

      const total = parseInt(response.headers['content-length'] || '0', 10);
      let downloaded = 0;

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        file.write(chunk);
        if (total > 0) {
          sender.send('update:progress', { downloaded, total, percent: Math.round(downloaded / total * 100) });
        }
      });

      response.on('end', () => {
        file.end(() => {
          sender.send('update:complete', destPath);
        });
      });

      response.on('error', (err) => {
        file.close();
        try { fs.unlinkSync(destPath); } catch (_) {}
        sender.send('update:error', err.message);
      });
    });

    request.on('error', (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch (_) {}
      sender.send('update:error', err.message);
    });

    request.end();
  }

  ipcMain.handle('app:install-update', async (event, filePath) => {
    const { shell, app } = require('electron');
    try {
      await shell.openPath(filePath);
      // 延迟退出，等安装程序启动
      setTimeout(() => {
        app.isQuitting = true;
        app.quit();
      }, 1000);
      return true;
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('file:open-folder', () => {
    const { shell, app } = require('electron');
    shell.openPath(app.getPath('desktop'));
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
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    // 检查是否为便签窗口，空便签直接删除
    for (const [id, entry] of windowManager.noteWindows) {
      if (entry.window === win) {
        const note = storageManager.getNote(id);
        if (note) {
          const content = (note.content || '').replace(/<[^>]*>/g, '').trim();
          const hasImage = /<img\b/i.test(note.content || '');
          const hasFiles = storageManager.getFilesByNote(id).length > 0;
          if (!content && !hasImage && !hasFiles) {
            // 真正空白便签（无内容、无图片、无中转站项目）→ 删除
            storageManager.deleteNote(id);
            win.close();
            return;
          }
        }
        break;
      }
    }
    win.close();
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

  // ─── 图片全屏预览 ───
  let previewWindow = null;

  ipcMain.handle('image:preview', (event, imgSrc) => {
    const { BrowserWindow, screen } = require('electron');
    // 关闭旧预览窗口
    if (previewWindow && !previewWindow.isDestroyed()) {
      previewWindow.close();
      previewWindow = null;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{margin:0;padding:0;box-sizing:border-box;}
      html,body{width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;}
      img{max-width:100vw;max-height:100vh;object-fit:contain;box-shadow:0 0 40px rgba(0,0,0,0.8);}
    </style></head><body><img src="${imgSrc.replace(/"/g,'&quot;')}" id="img"></body>
    <script>document.body.addEventListener('click',()=>window.close());document.addEventListener('keydown',e=>{if(e.key==='Escape')window.close()});<\/script></html>`;

    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);

    previewWindow = new BrowserWindow({
      fullscreen: true,
      frame: false,
      alwaysOnTop: true,
      backgroundColor: '#000000',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    previewWindow.loadURL(dataUrl);

    previewWindow.on('closed', () => { previewWindow = null; });

    // 点击/按 Esc 会自动调用 window.close()
  });
}

module.exports = { register };
