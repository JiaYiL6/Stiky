// ============================================
// Stiky Note — 便签主逻辑
// ============================================

// 从 URL query 获取 note id
const urlParams = new URLSearchParams(window.location.search);
const noteId = urlParams.get('id');

// 状态
let noteData = null;
let currentColor = 'yellow';
let currentOpacity = 0.9;
let currentFontSize = 14;
let ignoreHoverOpacity = false;
let saveTimer = null;

// DOM 元素
const noteContainer = document.getElementById('noteContainer');
const editor = document.getElementById('editor');
const toolbar = document.getElementById('toolbar');
const colorPicker = document.getElementById('colorPicker');
const colorGrid = document.getElementById('colorGrid');
const opacitySlider = document.getElementById('opacitySlider');
const opacityRange = document.getElementById('opacityRange');
const opacityValue = document.getElementById('opacityValue');

// ─── 初始化 ───
async function init() {
  if (!noteId) return;

  const allNotes = await window.StikyAPI.getAllNotes();
  noteData = allNotes.find(n => n.id === noteId);
  if (!noteData) return;

  // 应用便签颜色
  applyColor(noteData.color);

  // 恢复内容
  if (noteData.content) {
    editor.innerHTML = noteData.content;
  }

  // 恢复透明度
  currentOpacity = noteData.opacity !== undefined ? noteData.opacity : 0.9;
  opacityRange.value = Math.round(currentOpacity * 100);
  opacityValue.textContent = Math.round(currentOpacity * 100) + '%';

  // 恢复置顶状态
  if (noteData.alwaysOnTop) {
    document.getElementById('btnPin').classList.add('active');
  }

  // 恢复字号
  currentFontSize = noteData.fontSize || 14;
  applyFontSize(currentFontSize);

  // 恢复侧边栏状态
  const sidebar = document.getElementById('transferSidebar');
  if (noteData.sidebarVisible === false) {
    sidebar.classList.add('collapsed');
  }
  if (noteData.sidebarWidth) {
    sidebar.style.setProperty('--sidebar-width', noteData.sidebarWidth + 'px');
  }

  // 设置工具栏
  setupToolbar();

  // 设置事件监听
  setupEvents();

  // 初始化侧边栏
  if (typeof initTransferSidebar === 'function') {
    initTransferSidebar();
  }
}

// ─── 颜色应用 ───
function applyColor(colorKey) {
  currentColor = colorKey;
  const colors = getNoteColor(colorKey);
  noteContainer.style.setProperty('--note-bg', colors.bg);
  noteContainer.style.setProperty('--note-bg-sidebar', colors.bgSidebar);
  noteContainer.style.setProperty('--note-border', colors.border);
  noteContainer.style.setProperty('--note-text', colors.text);

  // 更新颜色选择器高亮
  document.querySelectorAll('.color-swatch').forEach(el => {
    el.classList.toggle('active', el.dataset.color === colorKey);
  });
}

function renderColorSwatches() {
  colorGrid.innerHTML = Object.entries(NOTE_COLORS).map(([key, val]) => `
    <div class="color-swatch ${key === currentColor ? 'active' : ''}"
         data-color="${key}"
         style="background-color: ${val.bg}; border-color: ${val.border};"
         title="${val.name}">
    </div>
  `).join('');

  colorGrid.querySelectorAll('.color-swatch').forEach(el => {
    el.addEventListener('click', () => {
      const color = el.dataset.color;
      applyColor(color);
      window.StikyAPI.setNoteColor(noteId, color);
      colorPicker.classList.add('hidden');
    });
  });
}

// ─── 工具栏 ───
function setupToolbar() {
  setupToolbarButtons(toolbar, editor);
  setupToolbarSync(editor, toolbar);
  setupKeyboardShortcuts(editor, toolbar);
}

// ─── 事件绑定 ───
function setupEvents() {
  // 置顶按钮
  document.getElementById('btnPin').addEventListener('click', async () => {
    const newState = await window.StikyAPI.setAlwaysOnTop(noteId);
    document.getElementById('btnPin').classList.toggle('active', newState);
  });

  // 颜色按钮
  document.getElementById('btnColor').addEventListener('click', (e) => {
    e.stopPropagation();
    colorPicker.classList.toggle('hidden');
    opacitySlider.classList.add('hidden');
  });

  // 透明度按钮
  document.getElementById('btnOpacity').addEventListener('click', (e) => {
    e.stopPropagation();
    opacitySlider.classList.toggle('hidden');
    colorPicker.classList.add('hidden');
  });

  // 新建便签
  document.getElementById('btnNewNote').addEventListener('click', async () => {
    await window.StikyAPI.createNote();
  });

  // 便签管理器
  document.getElementById('btnManager').addEventListener('click', () => {
    window.StikyAPI.openNoteManager();
  });

  // 设置按钮
  document.getElementById('btnSettings').addEventListener('click', () => {
    window.StikyAPI.openSettings();
  });

  // 关闭按钮
  document.getElementById('btnClose').addEventListener('click', () => {
    saveContent();
    window.StikyAPI.closeWindow();
  });

  // 颜色选择器
  renderColorSwatches();

  // 透明度滑块
  opacityRange.addEventListener('input', (e) => {
    const val = parseInt(e.target.value) / 100;
    currentOpacity = val;
    ignoreHoverOpacity = true;
    opacityValue.textContent = e.target.value + '%';
    window.StikyAPI.setOpacity(noteId, val);
  });

  opacityRange.addEventListener('change', () => {
    saveContent();
  });

  // 鼠标悬停恢复不透明（仅内容区，不含标题栏）
  const noteBody = document.querySelector('.note-body');
  noteBody.addEventListener('mouseenter', () => {
    if (currentOpacity < 0.95 && !ignoreHoverOpacity) {
      window.StikyAPI.setOpacity(noteId, 1.0);
    }
  });
  noteBody.addEventListener('mouseleave', () => {
    if (currentOpacity < 0.95) {
      window.StikyAPI.setOpacity(noteId, currentOpacity);
      ignoreHoverOpacity = false;
    }
  });

  // 待办按钮
  document.getElementById('btnTodo').addEventListener('mousedown', (e) => {
    e.preventDefault();
    insertTodo();
  });

  // 编辑器内点击勾选待办（事件委托）
  editor.addEventListener('click', (e) => {
    const marker = e.target.closest('.todo-marker');
    if (marker) {
      const item = marker.closest('.todo-line');
      if (item) {
        item.classList.toggle('checked');
        const isChecked = item.classList.contains('checked');
        marker.textContent = isChecked ? '☑' : '☐';
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveContent, 300);
      }
    }
  });

  // 编辑器输入 → 自动保存
  editor.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveContent, 500);
  });

  // 点击空白关闭弹窗
  document.addEventListener('click', (e) => {
    if (!colorPicker.contains(e.target) && e.target !== document.getElementById('btnColor')) {
      colorPicker.classList.add('hidden');
    }
    if (!opacitySlider.contains(e.target) && e.target !== document.getElementById('btnOpacity')) {
      opacitySlider.classList.add('hidden');
    }
  });

  // 失焦自动保存（从主进程触发）
  window.StikyAPI.onAutoSave(() => {
    saveContent();
  });

  // 设置变更监听（中转站显示模式切换）
  window.StikyAPI.onSettingsChanged((settings) => {
    const mode = (settings.transferStation || {}).displayMode;
    const sidebar = document.getElementById('transferSidebar');
    const divider = document.getElementById('sidebarDivider');
    if (mode === 'window') {
      sidebar.style.display = 'none';
      divider.style.display = 'none';
    } else {
      sidebar.style.display = '';
      divider.style.display = '';
    }
  });

  // 字体大小实时同步（从设置面板调整时）
  window.StikyAPI.onFontSizeChanged((size) => {
    applyFontSize(size);
    saveContent();
  });

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    // Ctrl+S 手动保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveContent();
    }
  });
}

// ─── 保存 ───
function applyFontSize(size) {
  currentFontSize = size;
  editor.style.fontSize = size + 'px';
}

async function saveContent() {
  if (!noteId) return;
  await window.StikyAPI.saveNote({
    id: noteId,
    content: editor.innerHTML,
    opacity: currentOpacity,
    fontSize: currentFontSize,
    sidebarVisible: !document.getElementById('transferSidebar').classList.contains('collapsed')
  });
}

async function saveSidebarState() {
  const sidebar = document.getElementById('transferSidebar');
  const sidebarWidth = parseInt(getComputedStyle(sidebar).getPropertyValue('--sidebar-width').trim()) || 260;
  await window.StikyAPI.saveNote({
    id: noteId,
    sidebarVisible: !sidebar.classList.contains('collapsed'),
    sidebarWidth
  });
}

// ─── 待办插入 ───
function insertTodo() {
  editor.focus();
  const sel = window.getSelection();
  if (sel.rangeCount === 0 || !editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    return;
  }

  // 创建 todo-line 元素
  const line = document.createElement('div');
  line.className = 'todo-line';
  const marker = document.createElement('span');
  marker.className = 'todo-marker';
  marker.contentEditable = 'false';
  marker.textContent = '☐';
  line.appendChild(marker);

  // 插入到光标位置
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(line);

  // 光标移到 ☐ 之后
  const newRange = document.createRange();
  newRange.setStartAfter(marker);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);

  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveContent, 300);
}

// ─── 启动 ───
init();
