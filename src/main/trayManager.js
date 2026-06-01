const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const fs = require('fs');
const windowManager = require('./windowManager');
const storageManager = require('./storageManager');
const { createStickyIcon } = require('./iconMaker');

class TrayManager {
  constructor() {
    this.tray = null;
  }

  create() {
    const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
    let trayIcon;
    try {
      if (fs.existsSync(iconPath)) {
        trayIcon = nativeImage.createFromPath(iconPath);
      }
    } catch (_) {}

    if (!trayIcon || trayIcon.isEmpty()) {
      trayIcon = createStickyIcon(32);
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
        label: '显示所有便签',
        click: () => windowManager.bringAllToFront()
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
