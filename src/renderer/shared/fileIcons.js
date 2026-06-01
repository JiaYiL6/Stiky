// 文件类型图标映射
const FILE_TYPE_ICONS = {
  // 文档
  pdf: 'pdf', doc: 'word', docx: 'word', xls: 'excel', xlsx: 'excel',
  ppt: 'ppt', pptx: 'ppt', txt: 'txt', csv: 'csv', rtf: 'txt',
  // 压缩包
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
  // 图片（有缩略图时不使用图标）
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image',
  webp: 'image', bmp: 'image', svg: 'image', ico: 'image',
  // 音视频
  mp3: 'audio', wav: 'audio', flac: 'audio', aac: 'audio', ogg: 'audio',
  mp4: 'video', avi: 'video', mov: 'video', mkv: 'video', wmv: 'video',
  // 代码
  js: 'code', ts: 'code', jsx: 'code', tsx: 'code', html: 'code',
  css: 'code', scss: 'code', json: 'code', xml: 'code', py: 'code',
  java: 'code', cpp: 'code', c: 'code', rs: 'code', go: 'code',
  // 可执行文件
  exe: 'exe', msi: 'exe', bat: 'exe', cmd: 'exe', sh: 'exe',
  // 其他
  folder: 'folder'
};

function getFileTypeIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return FILE_TYPE_ICONS[ext] || 'file';
}

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico'];
function isImageFile(filename) {
  return IMAGE_EXTS.includes(filename.split('.').pop().toLowerCase());
}

// 用 Unicode 符号作为简易图标（正式版可替换为 SVG 图标文件）
const ICON_GLYPHS = {
  pdf: '📕', word: '📘', excel: '📗', ppt: '📙', txt: '📄', csv: '📊',
  archive: '📦', image: '🖼️', audio: '🎵', video: '🎬',
  code: '💻', exe: '⚙️', folder: '📁', file: '📄'
};

function getIconGlyph(filename) {
  return ICON_GLYPHS[getFileTypeIcon(filename)] || '📄';
}
