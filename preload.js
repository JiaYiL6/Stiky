const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('StikyAPI', {
  // ─── 工具 ───
  getPathForFile: (file) => webUtils.getPathForFile(file),
  // ─── 便签操作 ───
  createNote: (preferPosition) => ipcRenderer.invoke('note:create', preferPosition),
  deleteNote: (id) => ipcRenderer.invoke('note:delete', id),
  saveNote: (data) => ipcRenderer.invoke('note:save', data),
  getAllNotes: () => ipcRenderer.invoke('note:get-all'),
  focusNote: (id) => ipcRenderer.invoke('note:focus', id),
  setAlwaysOnTop: (id) => ipcRenderer.invoke('note:set-always-on-top', id),
  setOpacity: (id, value) => ipcRenderer.invoke('note:set-opacity', id, value),
  setNoteColor: (id, color) => ipcRenderer.invoke('note:set-color', id, color),

  // ─── 文件操作 ───
  addFile: (sourcePath, noteId) => ipcRenderer.invoke('file:add', sourcePath, noteId),
  removeFile: (id) => ipcRenderer.invoke('file:remove', id),
  getFiles: (noteId) => ipcRenderer.invoke('file:get-by-note', noteId),
  startDrag: (id) => ipcRenderer.send('file:start-drag', id),
  openFile: (id) => ipcRenderer.invoke('file:open', id),
  previewImage: (src) => ipcRenderer.invoke('image:preview', src),
  showContextMenu: (id) => ipcRenderer.invoke('file:show-context-menu', id),
  clearAllFiles: () => ipcRenderer.invoke('file:clear-all'),
  openStorageFolder: () => ipcRenderer.invoke('file:open-folder'),
  checkUpdate: () => ipcRenderer.invoke('app:check-update'),
  downloadUpdate: (url) => ipcRenderer.send('app:download-update', url),
  installUpdate: (filePath) => ipcRenderer.invoke('app:install-update', filePath),
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
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
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
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
  onFontSizeChanged: (cb) => {
    const handler = (event, size) => cb(size);
    ipcRenderer.on('app:font-size', handler);
    return () => ipcRenderer.removeListener('app:font-size', handler);
  },
  onUpdateProgress: (cb) => {
    const handler = (event, data) => cb(data);
    ipcRenderer.on('update:progress', handler);
    return () => ipcRenderer.removeListener('update:progress', handler);
  },
  onUpdateComplete: (cb) => {
    const handler = (event, filePath) => cb(filePath);
    ipcRenderer.on('update:complete', handler);
    return () => ipcRenderer.removeListener('update:complete', handler);
  },
  onUpdateError: (cb) => {
    const handler = (event, msg) => cb(msg);
    ipcRenderer.on('update:error', handler);
    return () => ipcRenderer.removeListener('update:error', handler);
  }
});
