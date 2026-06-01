const { globalShortcut } = require('electron');
const windowManager = require('./windowManager');
const storageManager = require('./storageManager');

class ShortcutManager {
  register() {
    const settings = storageManager.getSettings();
    const hotkeys = (settings.general || {}).hotkeys || {};

    // Alt+N: 新建便签
    const newNoteKey = hotkeys.newNote || 'Alt+N';
    try {
      globalShortcut.register(newNoteKey, () => {
        const note = storageManager.createNote();
        windowManager.createNoteWindow(note, true);
      });
    } catch (e) {
      console.error('Failed to register shortcut:', newNoteKey, e.message);
    }

    // Alt+M: 便签管理器
    const managerKey = hotkeys.openNoteManager || 'Alt+M';
    try {
      globalShortcut.register(managerKey, () => {
        windowManager.createNoteManagerWindow();
      });
    } catch (e) {
      console.error('Failed to register shortcut:', managerKey, e.message);
    }
  }

  unregister() {
    globalShortcut.unregisterAll();
  }
}

module.exports = new ShortcutManager();
