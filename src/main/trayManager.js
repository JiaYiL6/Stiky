const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const fs = require('fs');
const windowManager = require('./windowManager');
const storageManager = require('./storageManager');

class TrayManager {
  constructor() {
    this.tray = null;
  }

  create() {
    // 开发环境用 src/assets/icon.ico，打包后用 resources/assets/icon.ico
    const devPath = path.join(__dirname, '..', 'assets', 'icon.ico');
    let prodPath = '';
    try { prodPath = path.join(process.resourcesPath, 'assets', 'icon.ico'); } catch (_) {}
    let trayIcon;
    try {
      if (fs.existsSync(devPath)) {
        trayIcon = nativeImage.createFromPath(devPath);
      } else if (prodPath && fs.existsSync(prodPath)) {
        trayIcon = nativeImage.createFromPath(prodPath);
      }
    } catch (_) {}

    if (!trayIcon || trayIcon.isEmpty()) {
      // 回退：生成黄色方块
      const s = 32, buf = Buffer.alloc(s * s * 4, 255);
      for (let i = 0; i < s * s; i++) { buf[i*4]=255; buf[i*4+1]=250; buf[i*4+2]=205; }
      trayIcon = nativeImage.createFromBuffer(buf, { width: s, height: s });
    }
    trayIcon = trayIcon.resize({ width: 16, height: 16 });

    this.tray = new Tray(trayIcon);
    this.tray.setToolTip('Stiky - 便签 & 文件中转站');
    this.updateMenu();

    this.tray.on('click', () => {
      const note = storageManager.createNote();
      windowManager.createNoteWindow(note, true);
    });
  }

  toggle(show) {
    if (show) {
      if (!this.tray || this.tray.isDestroyed()) {
        this.create();
      }
    } else {
      this.destroy();
    }
  }

  updateMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '新建便签',
        click: () => {
          const note = storageManager.createNote();
          windowManager.createNoteWindow(note, true);
        }
      },
      { type: 'separator' },
      {
        label: '便签管理器',
        click: () => windowManager.createNoteManagerWindow()
      },
      { type: 'separator' },
      {
        label: '设置',
        click: () => windowManager.createSettingsWindow()
      },
      { type: 'separator' },
      {
        label: '退出 Stiky',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = new TrayManager();
