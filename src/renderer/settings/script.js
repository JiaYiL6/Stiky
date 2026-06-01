// ============================================
// Stiky Settings — 设置面板逻辑
// ============================================

let settings = null;

// DOM 元素
const defaultColorGrid = document.getElementById('defaultColorGrid');
const defaultFontSize = document.getElementById('defaultFontSize');
const defaultFontSizeVal = document.getElementById('defaultFontSizeVal');
const defaultOpacity = document.getElementById('defaultOpacity');
const defaultOpacityVal = document.getElementById('defaultOpacityVal');
const defaultAlwaysOnTop = document.getElementById('defaultAlwaysOnTop');
const defaultSidebarVisible = document.getElementById('defaultSidebarVisible');
const storagePath = document.getElementById('storagePath');
const showThumbnails = document.getElementById('showThumbnails');
const showTaskbar = document.getElementById('showTaskbar');
const launchOnStartup = document.getElementById('launchOnStartup');
const language = document.getElementById('language');

// ─── 初始化 ───
async function init() {
  settings = await window.StikyAPI.getSettings();
  if (!settings) return;

  const nd = settings.noteDefaults || {};
  const ts = settings.transferStation || {};
  const gn = settings.general || {};

  // 颜色
  renderColorSwatches(nd.defaultColor || 'yellow');

  // 字号
  const fs = nd.defaultFontSize || 14;
  defaultFontSize.value = fs;
  defaultFontSizeVal.textContent = fs + 'px';

  // 透明度
  const op = Math.round((nd.defaultOpacity || 0.9) * 100);
  defaultOpacity.value = op;
  defaultOpacityVal.textContent = op + '%';

  // 置顶
  defaultAlwaysOnTop.checked = nd.defaultAlwaysOnTop || false;

  // 尺寸
  // 侧边栏默认展开
  defaultSidebarVisible.checked = nd.defaultSidebarVisible !== false;

  // 存储路径
  storagePath.value = ts.storagePath || '';
  if (!ts.storagePath) {
    storagePath.placeholder = '默认: %APPDATA%/Stiky/staged-files/';
  }

  // 保留期限
  const retentionDays = document.getElementById('retentionDays');
  retentionDays.value = ts.retentionDays !== undefined ? ts.retentionDays : 7;

  // 缩略图
  showThumbnails.checked = ts.showThumbnails !== false;

  // 通用
  showTaskbar.checked = gn.showTaskbar !== false;
  launchOnStartup.checked = gn.launchOnStartup || false;
  language.value = gn.language || 'zh-CN';

  setupEvents();
}

// ─── 颜色选择器 ───
function renderColorSwatches(current) {
  defaultColorGrid.innerHTML = Object.entries(NOTE_COLORS).map(([key, val]) => `
    <div class="color-swatch ${key === current ? 'active' : ''}"
         data-color="${key}"
         style="background-color: ${val.bg}; border-color: ${val.border};"
         title="${val.name}">
    </div>
  `).join('');

  defaultColorGrid.querySelectorAll('.color-swatch').forEach(el => {
    el.addEventListener('click', () => {
      defaultColorGrid.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
      saveSetting('noteDefaults.defaultColor', el.dataset.color);
    });
  });
}

// ─── 保存设置 ───
function saveSetting(path, value) {
  // 将点分隔路径转为嵌套对象
  const obj = {};
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;

  window.StikyAPI.setSettings(obj);
}

// ─── 事件绑定 ───
function setupEvents() {
  // 关闭
  document.getElementById('btnClose').addEventListener('click', () => {
    window.StikyAPI.closeSettings();
  });

  // 字号
  defaultFontSize.addEventListener('input', () => {
    defaultFontSizeVal.textContent = defaultFontSize.value + 'px';
  });
  defaultFontSize.addEventListener('change', () => {
    saveSetting('noteDefaults.defaultFontSize', parseInt(defaultFontSize.value));
  });

  // 透明度
  defaultOpacity.addEventListener('input', () => {
    defaultOpacityVal.textContent = defaultOpacity.value + '%';
  });
  defaultOpacity.addEventListener('change', () => {
    saveSetting('noteDefaults.defaultOpacity', parseInt(defaultOpacity.value) / 100);
  });

  // 置顶
  defaultAlwaysOnTop.addEventListener('change', () => {
    saveSetting('noteDefaults.defaultAlwaysOnTop', defaultAlwaysOnTop.checked);
  });

  // 侧边栏默认展开
  defaultSidebarVisible.addEventListener('change', () => {
    saveSetting('noteDefaults.defaultSidebarVisible', defaultSidebarVisible.checked);
  });

  // 存储路径浏览
  document.getElementById('btnBrowse').addEventListener('click', async () => {
    const dir = await window.StikyAPI.selectDirectory();
    if (dir) {
      storagePath.value = dir;
      storagePath.placeholder = '';
      saveSetting('transferStation.storagePath', dir);
    }
  });

  // 重置路径
  document.getElementById('btnResetPath').addEventListener('click', () => {
    storagePath.value = '';
    storagePath.placeholder = '默认: %APPDATA%/Stiky/staged-files/';
    saveSetting('transferStation.storagePath', '');
  });

  // 保留期限
  document.getElementById('retentionDays').addEventListener('change', function() {
    saveSetting('transferStation.retentionDays', parseInt(this.value));
  });

  // 缩略图
  showThumbnails.addEventListener('change', () => {
    saveSetting('transferStation.showThumbnails', showThumbnails.checked);
  });

  // 任务栏显示
  showTaskbar.addEventListener('change', () => {
    saveSetting('general.showTaskbar', showTaskbar.checked);
  });

  // 开机启动
  launchOnStartup.addEventListener('change', () => {
    saveSetting('general.launchOnStartup', launchOnStartup.checked);
  });

  // 语言
  language.addEventListener('change', () => {
    saveSetting('general.language', language.value);
  });
}

init();
