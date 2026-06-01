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
    // 创建托盘图标（优先用文件，不存在则生成简易图标）
    const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
    let trayIcon;
    try {
      if (fs.existsSync(iconPath)) {
        trayIcon = nativeImage.createFromPath(iconPath);
      }
    } catch (_) {}

    if (!trayIcon || trayIcon.isEmpty()) {
      // 生成一个 16x16 的黄色小方块作为默认托盘图标
      trayIcon = this._createSimpleIcon('#FFFACD');
    }
    trayIcon = trayIcon.resize({ width: 16, height: 16 });

    this.tray = new Tray(trayIcon);
    this.tray.setToolTip('Stiky - 便签 & 文件中转站');

    // 右键菜单
    this.updateMenu();

    // 左键点击：新建便签
    this.tray.on('click', () => {
      const note = storageManager.createNote();
      windowManager.createNoteWindow(note, true);
    });
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
      {
        label: '文件中转站',
        click: () => windowManager.toggleTransferWindow()
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

  _createSimpleIcon(color) {
    // 用 nativeImage 创建一个纯色小图标
    const size = 16;
    const buf = Buffer.alloc(size * size * 4);
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    for (let i = 0; i < size * size; i++) {
      buf[i * 4] = r;
      buf[i * 4 + 1] = g;
      buf[i * 4 + 2] = b;
      buf[i * 4 + 3] = 255;
    }
    return nativeImage.createFromBuffer(buf, { width: size, height: size });
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = new TrayManager();
