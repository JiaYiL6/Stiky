const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

class StorageManager {
  constructor() {
    this.userDataPath = '';
    this.notesPath = '';
    this.settingsPath = '';
    this.filesMetaPath = '';
    this.filesDir = '';
    this.thumbnailsDir = '';

    this.notes = [];
    this.filesMeta = [];
    this.settings = {};
  }

  init() {
    this.userDataPath = app.getPath('userData');
    this.notesPath = path.join(this.userDataPath, 'notes.json');
    this.settingsPath = path.join(this.userDataPath, 'settings.json');
    this.filesMetaPath = path.join(this.userDataPath, 'files.json');
    this.filesDir = path.join(this.userDataPath, 'staged-files');
    this.thumbnailsDir = path.join(this.userDataPath, 'thumbnails');

    // 确保目录存在
    fs.mkdirSync(this.filesDir, { recursive: true });
    fs.mkdirSync(this.thumbnailsDir, { recursive: true });

    // 加载数据
    this.notes = this._readJSON(this.notesPath, []).notes || [];
    const notesWrapper = this._readJSON(this.notesPath, {});
    if (Array.isArray(notesWrapper)) {
      // 兼容旧格式
      this.notes = notesWrapper;
    } else {
      this.notes = notesWrapper.notes || [];
    }

    this.filesMeta = this._readJSON(this.filesMetaPath, []).files || [];
    const filesWrapper = this._readJSON(this.filesMetaPath, {});
    if (Array.isArray(filesWrapper)) {
      this.filesMeta = filesWrapper;
    } else {
      this.filesMeta = filesWrapper.files || [];
    }

    this.settings = this._loadSettings();

    // 清理过期文件
    this.cleanupExpiredFiles();
  }

  // ─── JSON 原子读写 ───
  _readJSON(filePath, defaultValue) {
    try {
      if (!fs.existsSync(filePath)) return defaultValue;
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      console.error(`Failed to read ${filePath}:`, e.message);
      // 尝试备份损坏文件
      try {
        if (fs.existsSync(filePath)) {
          fs.copyFileSync(filePath, filePath + '.bak');
        }
      } catch (_) {}
      return defaultValue;
    }
  }

  _writeJSON(filePath, data) {
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, filePath);
  }

  // ─── 便签操作 ───
  getAllNotes() {
    return this.notes;
  }

  getNote(id) {
    return this.notes.find(n => n.id === id);
  }

  createNote(defaults = {}, preferPosition = null) {
    const settings = this.settings.noteDefaults || {};
    // 有期望位置 → 偏移30px；无 → 逐个错开
    const pos = preferPosition
      ? { x: preferPosition.x + 30, y: preferPosition.y + 30 }
      : { x: 200 + this.notes.length * 30, y: 200 + this.notes.length * 30 };

    const note = {
      id: crypto.randomUUID(),
      content: '',
      color: defaults.color || settings.defaultColor || 'yellow',
      position: pos,
      size: {
        width: settings.defaultWidth || 350,
        height: settings.defaultHeight || 350
      },
      alwaysOnTop: defaults.alwaysOnTop !== undefined ? defaults.alwaysOnTop : (settings.defaultAlwaysOnTop || false),
      opacity: defaults.opacity || settings.defaultOpacity || 0.9,
      fontSize: defaults.fontSize || settings.defaultFontSize || 14,
      sidebarVisible: defaults.sidebarVisible !== undefined ? defaults.sidebarVisible : (settings.defaultSidebarVisible === true),
      sidebarWidth: defaults.sidebarWidth || settings.defaultSidebarWidth || 52,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.notes.push(note);
    this._saveNotes();
    return note;
  }

  saveNote(data) {
    const idx = this.notes.findIndex(n => n.id === data.id);
    if (idx === -1) return;
    this.notes[idx] = { ...this.notes[idx], ...data, updatedAt: new Date().toISOString() };
    this._saveNotes();
  }

  deleteNote(id) {
    this.notes = this.notes.filter(n => n.id !== id);
    this._saveNotes();
    // 同时删除该便签的中转站文件
    this.removeAllFilesForNote(id);
  }

  _saveNotes() {
    this._writeJSON(this.notesPath, { version: 1, notes: this.notes });
  }

  // ─── 文件元数据操作 ───
  getAllFiles() {
    return this.filesMeta;
  }

  getFileById(id) {
    return this.filesMeta.find(f => f.id === id);
  }

  async stageFile(sourcePath, noteId) {
    if (!fs.existsSync(sourcePath)) {
      throw new Error('Source file not found: ' + sourcePath);
    }

    const id = crypto.randomUUID();
    const originalName = path.basename(sourcePath);

    // 每个便签独立子目录
    const baseDir = this._getStorageDir();
    const noteDir = path.join(baseDir, noteId);
    fs.mkdirSync(noteDir, { recursive: true });

    let storedName = originalName;
    const ext = path.extname(originalName);
    const baseName = originalName.slice(0, -ext.length) || originalName;
    let counter = 1;
    while (fs.existsSync(path.join(noteDir, storedName))) {
      storedName = `${baseName} (${counter})${ext}`;
      counter++;
    }

    const destPath = path.join(noteDir, storedName);
    await fs.promises.copyFile(sourcePath, destPath);
    const stat = await fs.promises.stat(destPath);

    const mimeType = this._guessMimeType(sourcePath);

    // 计算过期时间
    const retentionDays = (this.settings.transferStation || {}).retentionDays;
    const expiresAt = (retentionDays && retentionDays > 0)
      ? new Date(Date.now() + retentionDays * 86400000).toISOString()
      : null;

    const fileData = {
      id,
      noteId,
      originalName,
      storedName,
      size: stat.size,
      mimeType,
      thumbnailPath: null,
      addedAt: new Date().toISOString(),
      expiresAt
    };

    fileData.thumbnailPath = await this._generateThumbnail(sourcePath, id);

    this.filesMeta.push(fileData);
    this._saveFilesMeta();
    return fileData;
  }

  _getFilePath(fileData) {
    const baseDir = this._getStorageDir();
    return path.join(baseDir, fileData.noteId || '_global', fileData.storedName);
  }

  getFilesByNote(noteId) {
    return this.filesMeta.filter(f => f.noteId === noteId);
  }

  async removeStagedFile(id) {
    const fileData = this.getFileById(id);
    if (!fileData) return;

    const filePath = this._getFilePath(fileData);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.error('Failed to delete staged file:', e.message);
    }

    if (fileData.thumbnailPath) {
      try {
        const thumbPath = path.join(this.thumbnailsDir, fileData.thumbnailPath);
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
      } catch (_) {}
    }

    this.filesMeta = this.filesMeta.filter(f => f.id !== id);
    this._saveFilesMeta();
  }

  clearAllFiles() {
    for (const f of [...this.filesMeta]) {
      this.removeStagedFileSync(f.id);
    }
  }

  removeStagedFileSync(id) {
    const fileData = this.getFileById(id);
    if (!fileData) return;
    const filePath = this._getFilePath(fileData);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
    if (fileData.thumbnailPath) {
      try {
        const thumbPath = path.join(this.thumbnailsDir, fileData.thumbnailPath);
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
      } catch (_) {}
    }
    this.filesMeta = this.filesMeta.filter(f => f.id !== id);
    this._saveFilesMeta();
  }

  // 清理过期文件（启动时调用）
  cleanupExpiredFiles() {
    const now = Date.now();
    const expired = this.filesMeta.filter(f => f.expiresAt && new Date(f.expiresAt).getTime() < now);
    for (const f of expired) {
      this.removeStagedFileSync(f.id);
    }
    if (expired.length > 0) {
      console.log(`Cleaned up ${expired.length} expired file(s)`);
    }
  }

  // 删除某便签的所有文件
  removeAllFilesForNote(noteId) {
    const noteFiles = this.filesMeta.filter(f => f.noteId === noteId);
    for (const f of noteFiles) {
      this.removeStagedFileSync(f.id);
    }
    // 清理空目录
    const noteDir = path.join(this._getStorageDir(), noteId);
    try { if (fs.existsSync(noteDir)) fs.rmdirSync(noteDir); } catch (_) {}
  }

  _saveFilesMeta() {
    this._writeJSON(this.filesMetaPath, { version: 1, files: this.filesMeta });
  }

  _getStorageDir() {
    const customPath = (this.settings.transferStation || {}).storagePath;
    if (customPath && fs.existsSync(customPath)) return customPath;
    return this.filesDir;
  }

  // ─── 设置操作 ───
  _loadSettings() {
    const defaults = {
      version: 1,
      noteDefaults: {
        defaultColor: 'yellow',
        defaultOpacity: 0.9,
        defaultFontSize: 14,
        defaultAlwaysOnTop: false,
        defaultWidth: 300,
        defaultHeight: 300,
        defaultSidebarVisible: false,
        defaultSidebarWidth: 52
      },
      transferStation: {
        storagePath: '',
        showThumbnails: true,
        maxThumbnailSize: 128,
        retentionDays: 7
      },
      general: {
        launchOnStartup: false,
        showTaskbar: true,
        language: 'zh-CN',
        hotkeys: {
          newNote: 'Alt+N',
          toggleTransfer: 'Alt+T',
          openNoteManager: 'Alt+M'
        }
      }
    };

    const saved = this._readJSON(this.settingsPath, {});
    return this._deepMerge(defaults, saved);
  }

  getSettings() {
    return this.settings;
  }

  saveSettings(partial) {
    this.settings = this._deepMerge(this.settings, partial);
    this._writeJSON(this.settingsPath, this.settings);
  }

  // ─── 工具方法 ───
  _deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  _isImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico'].includes(ext);
  }

  _guessMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.txt': 'text/plain',
      '.json': 'application/json'
    };
    return map[ext] || 'application/octet-stream';
  }

  async _generateThumbnail(sourcePath, fileId) {
    try {
      // 使用 Windows 原生 API 获取文件图标/缩略图
      // 图片显示真实缩略图，文档/PDF 等显示系统关联图标
      const { app } = require('electron');
      const icon = await app.getFileIcon(sourcePath, { size: 'large' });
      const thumbName = `${fileId}_thumb.png`;
      const thumbPath = path.join(this.thumbnailsDir, thumbName);
      fs.writeFileSync(thumbPath, icon.toPNG());
      return thumbName;
    } catch (e) {
      console.error('Thumbnail generation failed:', e.message);
      return null;
    }
  }
}

module.exports = new StorageManager();
