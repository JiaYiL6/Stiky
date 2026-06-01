const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('StikyAPI', {
  // ─── 工具 ───
  getPathForFile: (file) => webUtils.getPathForFile(file),
  // ─── 便签操作 ───
  createNote: () => ipcRenderer.invoke('note:create'),
  deleteNote: (id) => ipcRenderer.invoke('note:delete', id),
  saveNote: (data) => ipcRenderer.invoke('note:save', data),
  getAllNotes: () => ipcRenderer.invoke('note:get-all'),
  focusNote: (id) => ipcRenderer.invoke('note:focus', id),
  setAlwaysOnTop: (id) => ipcRenderer.invoke('note:set-always-on-top', id),
  setOpacity: (id, value) => ipcRenderer.invoke('note:set-opacity', id, value),
  setNoteColor: (id, color) => ipcRenderer.invoke('note:set-color', id, color),

  // ─── 文件操作 ───
  addFile: (sourcePath) => ipcRenderer.invoke('file:add', sourcePath),
  removeFile: (id) => ipcRenderer.invoke('file:remove', id),
  getFiles: () => ipcRenderer.invoke('file:get-all'),
  startDrag: (id) => ipcRenderer.send('file:start-drag', id),
  showContextMenu: (id) => ipcRenderer.invoke('file:show-context-menu', id),
  clearAllFiles: () => ipcRenderer.invoke('file:clear-all'),
  openStorageFolder: () => ipcRenderer.invoke('file:open-folder'),
  selectDirectory: () => ipcRenderer.invoke('file:select-directory'),
  getThumbnailPath: (name) => ipcRenderer.invoke('window:get-thumbnail-path', name),

  // ─── 设置操作 ───
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),

  // ─── 窗口操作 ───
  openSettings: () => ipcRenderer.invoke('window:open-settings'),
  closeSettings: () => ipcRenderer.invoke('window:close-settings'),
  openNoteManager: () => ipcRenderer.invoke('window:open-note-manager'),
  closeNoteManager: () => ipcRenderer.invoke('window:close-note-manager'),
  createTransferWindow: () => ipcRenderer.invoke('window:create-transfer-window'),
  closeTransferWindow: () => ipcRenderer.invoke('window:close-transfer-window'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // ─── 事件监听 ───
  onAutoSave: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('app:auto-save', handler);
    return () => ipcRenderer.removeListener('app:auto-save', handler);
  },
  onFilesChanged: (cb) => {
    const handler = (event, files) => cb(files);
    ipcRenderer.on('transfer:files-changed', handler);
    return () => ipcRenderer.removeListener('transfer:files-changed', handler);
  },
  onSettingsChanged: (cb) => {
    const handler = (event, settings) => cb(settings);
    ipcRenderer.on('settings:changed', handler);
    return () => ipcRenderer.removeListener('settings:changed', handler);
  },
  onFontSizeChanged: (cb) => {
    const handler = (event, size) => cb(size);
    ipcRenderer.on('app:font-size', handler);
    return () => ipcRenderer.removeListener('app:font-size', handler);
  }
});
