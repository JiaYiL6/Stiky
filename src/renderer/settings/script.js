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
const showThumbnails = document.getElementById('showThumbnails');
const showTaskbar = document.getElementById('showTaskbar');
const launchOnStartup = document.getElementById('launchOnStartup');

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

  // 缩略图
  showThumbnails.checked = ts.showThumbnails !== false;

  // 通用
  showTaskbar.checked = gn.showTaskbar !== false;
  launchOnStartup.checked = gn.launchOnStartup || false;

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
async function setupEvents() {
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

  // 缩略图
  showThumbnails.addEventListener('change', () => {
    saveSetting('transferStation.showThumbnails', showThumbnails.checked);
  });

  // 版本号
  const versionText = document.getElementById('versionText');
  const btnCheckUpdate = document.getElementById('btnCheckUpdate');
  const ver = await window.StikyAPI.getVersion();
  if (versionText) versionText.textContent = 'v' + ver;

  const updateProgress = document.getElementById('updateProgress');
  const updateStatus = document.getElementById('updateStatus');
  const progressFill = document.getElementById('progressFill');
  const btnInstall = document.getElementById('btnInstall');
  let pendingUpdatePath = '';

  btnCheckUpdate.addEventListener('click', async () => {
    btnCheckUpdate.textContent = '检查中...';
    btnCheckUpdate.disabled = true;
    updateProgress.classList.add('hidden');
    const result = await window.StikyAPI.checkUpdate();
    btnCheckUpdate.disabled = false;
    if (result.error) {
      btnCheckUpdate.textContent = '检查失败';
      setTimeout(() => { btnCheckUpdate.textContent = '检查更新'; }, 2000);
    } else if (result.newer) {
      btnCheckUpdate.textContent = '下载 v' + result.latest;
      btnCheckUpdate.disabled = true;
      updateProgress.classList.remove('hidden');
      updateStatus.textContent = '准备下载...';
      progressFill.style.width = '0%';
      btnInstall.classList.add('hidden');
      // 开始下载
      window.StikyAPI.downloadUpdate(result.downloadUrl);
    } else {
      btnCheckUpdate.textContent = '已是最新';
      setTimeout(() => { btnCheckUpdate.textContent = '检查更新'; }, 2000);
    }
  });

  // 下载进度
  window.StikyAPI.onUpdateProgress((data) => {
    updateStatus.textContent = `下载中 ${data.percent}% (${formatSize(data.downloaded)} / ${formatSize(data.total)})`;
    progressFill.style.width = data.percent + '%';
  });

  // 下载完成
  window.StikyAPI.onUpdateComplete((filePath) => {
    pendingUpdatePath = filePath;
    updateStatus.textContent = '下载完成！';
    progressFill.style.width = '100%';
    btnInstall.classList.remove('hidden');
    btnInstall.addEventListener('click', async () => {
      await window.StikyAPI.installUpdate(filePath);
    });
    btnCheckUpdate.textContent = '检查更新';
    btnCheckUpdate.disabled = false;
  });

  // 下载失败
  window.StikyAPI.onUpdateError((msg) => {
    updateStatus.textContent = '下载失败: ' + msg;
    btnCheckUpdate.textContent = '重试';
    btnCheckUpdate.disabled = false;
  });

  // 任务栏显示
  showTaskbar.addEventListener('change', () => {
    saveSetting('general.showTaskbar', showTaskbar.checked);
  });

  // 开机启动
  launchOnStartup.addEventListener('change', () => {
    saveSetting('general.launchOnStartup', launchOnStartup.checked);
  });

}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

init();
