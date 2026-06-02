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
const toolbar = document.querySelector('.toolbar-btns');
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
    // 已有图片固定尺寸（兼容旧数据）
    editor.querySelectorAll('img').forEach(img => {
      if (img.style.width) {
        // 已被 resize 过的图片，取消响应式缩放
        img.style.maxWidth = 'none';
        return;
      }
      img.style.maxWidth = '100%';
      const setSize = () => {
        const editorW = editor.clientWidth - 28;
        if (img.naturalWidth && img.naturalWidth > editorW) {
          const ratio = editorW / img.naturalWidth;
          img.style.width = Math.round(editorW) + 'px';
          img.style.height = Math.round(img.naturalHeight * ratio) + 'px';
        } else if (img.naturalWidth) {
          img.style.width = img.naturalWidth + 'px';
          img.style.height = img.naturalHeight + 'px';
        }
        img.style.maxWidth = 'none';
      };
      img.onload = setSize;
      if (img.complete) setSize();
    });
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

  // 初始化字数显示（加载旧内容时）
  window.refreshWordCount();

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

  // 新建便签 → 在当前便签右下方偏移 30px
  document.getElementById('btnNewNote').addEventListener('click', async () => {
    const pos = noteData ? noteData.position : null;
    await window.StikyAPI.createNote(pos);
  });

  // 便签管理器
  // 菜单按钮 → 弹出选择（固定在按钮下方）
  const btnMenu = document.getElementById('btnMenu');
  btnMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = btnMenu.getBoundingClientRect();
    showMenuPopup(window.innerWidth - 88, rect.bottom + 4);
  });

  // 双击标题栏 → 最大化/还原
  const dragRegion = document.querySelector('.drag-region');
  dragRegion.addEventListener('dblclick', () => {
    window.StikyAPI.toggleMaximize();
  });

  // 关闭按钮 — 空白便签直接删除（中转站有项目时保留）
  document.getElementById('btnClose').addEventListener('click', async () => {
    const content = editor.innerHTML.replace(/<[^>]*>/g, '').trim();
    const hasImage = /<img\b/i.test(editor.innerHTML);
    const hasFiles = window.getTransferFileCount && window.getTransferFileCount() > 0;
    if (!content && !hasImage && !hasFiles) {
      await window.StikyAPI.deleteNote(noteId);
    } else {
      await saveContent();
      window.StikyAPI.closeWindow();
    }
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

  // 鼠标悬停恢复不透明（整个窗口区域）
  noteContainer.addEventListener('mouseenter', () => {
    if (currentOpacity < 0.95 && !ignoreHoverOpacity) {
      window.StikyAPI.setOpacity(noteId, 1.0);
    }
  });
  noteContainer.addEventListener('mouseleave', () => {
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

  // ─── 图片拖拽 resize ───
  let imgResizing = null;
  const RESIZE_EDGE = 8; // 边缘检测阈值(px)

  function getResizeDir(img, clientX, clientY) {
    const rect = img.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let dir = '';
    if (y < RESIZE_EDGE) dir += 'n';
    else if (y > rect.height - RESIZE_EDGE) dir += 's';
    if (x < RESIZE_EDGE) dir += 'w';
    else if (x > rect.width - RESIZE_EDGE) dir += 'e';
    return dir;
  }

  editor.addEventListener('mousedown', (e) => {
    if (e.target.tagName !== 'IMG') return;
    const dir = getResizeDir(e.target, e.clientX, e.clientY);
    if (!dir) return; // 不在边缘，正常交互
    e.preventDefault();
    e.stopPropagation();
    const img = e.target;
    img.style.maxWidth = 'none'; // 手动调整后不再响应式缩放
    imgResizing = {
      img,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startW: img.offsetWidth,
      startH: img.offsetHeight,
      ratio: img.offsetWidth / img.offsetHeight
    };
    document.body.style.cursor = (dir === 'se' || dir === 'nw') ? 'nwse-resize' :
      (dir === 'ne' || dir === 'sw') ? 'nesw-resize' :
      (dir === 'e' || dir === 'w') ? 'ew-resize' : 'ns-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (imgResizing) {
      const { img, dir, startX, startY, startW, startH, ratio } = imgResizing;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newW = startW, newH = startH;

      if (dir.includes('e')) newW = Math.max(20, startW + dx);
      if (dir.includes('w')) newW = Math.max(20, startW - dx);
      if (dir.includes('s')) newH = Math.max(20, startH + dy);
      if (dir.includes('n')) newH = Math.max(20, startH - dy);

      // Shift 保持比例
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) newH = newW / ratio;
        else newW = newH * ratio;
      }

      img.style.width = Math.round(newW) + 'px';
      img.style.height = Math.round(newH) + 'px';
      return;
    }

    // 悬停时更新光标
    if (e.target.tagName === 'IMG' && !imgResizing) {
      const dir = getResizeDir(e.target, e.clientX, e.clientY);
      if (dir === 'se' || dir === 'nw') e.target.style.cursor = 'nwse-resize';
      else if (dir === 'ne' || dir === 'sw') e.target.style.cursor = 'nesw-resize';
      else if (dir === 'e' || dir === 'w') e.target.style.cursor = 'ew-resize';
      else if (dir === 'n' || dir === 's') e.target.style.cursor = 'ns-resize';
      else e.target.style.cursor = 'default';
    }
  });

  document.addEventListener('mouseup', () => {
    if (imgResizing) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      imgResizing = null;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveContent, 300);
    }
  });

  // ─── 双击图片全屏预览 ───
  editor.addEventListener('dblclick', (e) => {
    if (e.target.tagName !== 'IMG') return;
    window.StikyAPI.previewImage(e.target.src);
  });

  // ─── 粘贴图片时固定初始尺寸 ───
  editor.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = () => {
          const img = document.createElement('img');
          img.src = reader.result;
          img.style.maxWidth = '100%';
          // 插入后读取自然尺寸，限制最大宽度为编辑器宽度
          img.onload = () => {
            const editorW = editor.clientWidth - 28; // padding
            if (img.naturalWidth > editorW) {
              const ratio = editorW / img.naturalWidth;
              img.style.width = Math.round(editorW) + 'px';
              img.style.height = Math.round(img.naturalHeight * ratio) + 'px';
            } else {
              img.style.width = img.naturalWidth + 'px';
              img.style.height = img.naturalHeight + 'px';
            }
            img.style.maxWidth = 'none'; // 固定尺寸后不再随窗口缩放
          };
          // 插入到光标位置
          const sel = window.getSelection();
          if (sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            range.collapse(false);
          } else {
            editor.appendChild(img);
          }
          clearTimeout(saveTimer);
          saveTimer = setTimeout(saveContent, 300);
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
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
        if (isChecked) {
          // 勾选：把 marker 之后的内容包在 <span class="todo-done"> 中
          const range = document.createRange();
          range.setStartAfter(marker);
          range.setEndAfter(item.lastChild);
          try {
            const done = document.createElement('span');
            done.className = 'todo-done';
            range.surroundContents(done);
            // 在 done 后插入零宽空格，光标移到外部避免新文字带删除线
            const after = document.createTextNode('​');
            done.after(after);
            const sel = window.getSelection();
            const r = document.createRange();
            r.setStartAfter(after);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
          } catch (_) {}
        } else {
          // 取消勾选：解包 todo-done span，移除零宽空格
          item.querySelectorAll('.todo-done').forEach(el => {
            el.replaceWith(...el.childNodes);
          });
          item.querySelectorAll('s, strike, del').forEach(el => {
            el.replaceWith(...el.childNodes);
          });
          item.childNodes.forEach(cn => {
            if (cn.nodeType === 3 && cn.textContent === '​') cn.remove();
          });
        }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveContent, 300);
      }
    }
  });

  // 底部栏显示：字数 | 项目数（始终显示，0也显示）
  let bottomWordCount = 0;
  function updateBottomStats() {
    const wc = document.getElementById('wordCountInline');
    const fc = document.getElementById('fileCountInline');
    wc.textContent = bottomWordCount + ' 字';
    if (fc && !fc.classList.contains('visible')) fc.classList.add('visible');
  }
  window.updateBottomStats = updateBottomStats;

  window.refreshWordCount = function() {
    const text = (editor.innerText || '').replace(/\s/g, '');
    bottomWordCount = text.length;
    updateBottomStats();
  }
  updateBottomStats();

  // 编辑器输入 → 自动保存 + 更新字数
  editor.addEventListener('input', () => {
    window.refreshWordCount();
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

  // 标题栏和底部栏自动隐藏（不在区域内持续600ms后收起）
  let hideBarsTimer = null;
  const titlebar = document.getElementById('titlebar');
  const bottombar = document.getElementById('bottombar');

  function showBars() {
    clearTimeout(hideBarsTimer);
    hideBarsTimer = null;
    titlebar.classList.remove('hidden');
    if (bottombar) bottombar.classList.remove('hidden');
    noteContainer.classList.remove('bars-hidden');
    if (window._sidebarCollapseTimer) clearTimeout(window._sidebarCollapseTimer);
  }

  function hideBars() {
    // 不在区域内时启动/重置600ms定时器
    clearTimeout(hideBarsTimer);
    hideBarsTimer = setTimeout(() => {
      titlebar.classList.add('hidden');
      if (bottombar) bottombar.classList.add('hidden');
      noteContainer.classList.add('bars-hidden');
      // 收起所有展开的标题栏工具
      colorPicker.classList.add('hidden');
      opacitySlider.classList.add('hidden');
      // 收起侧边栏
      const sidebar = document.getElementById('transferSidebar');
      if (sidebar && !window._sidebarPinned && !sidebar.classList.contains('collapsed')) {
        sidebar.classList.add('collapsed');
      }
      hideBarsTimer = null;
    }, 600);
  }

  noteContainer.addEventListener('mouseenter', showBars);
  noteContainer.addEventListener('mouseleave', hideBars);
  // 初始显示
  showBars();

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

// ─── 菜单弹窗 ───
let menuPopup = null;

function showMenuPopup(x, y) {
  if (menuPopup) menuPopup.remove();

  menuPopup = document.createElement('div');
  menuPopup.style.cssText = `
    position: fixed; left: ${x}px; top: ${y}px;
    background: #fff; border: 1px solid #ddd; border-radius: 8px;
    box-shadow: 0 3px 12px rgba(0,0,0,0.18); z-index: 1000;
    padding: 4px 0; min-width: 80px; font-size: 13px;
  `;

  const items = [
    { label: '管理便签', action: () => window.StikyAPI.openNoteManager() },
    { label: '设置', action: () => window.StikyAPI.openSettings() }
  ];

  items.forEach(item => {
    const el = document.createElement('div');
    el.textContent = item.label;
    el.style.cssText = 'padding:8px 16px;cursor:pointer;color:#333;';
    el.addEventListener('mouseenter', () => { el.style.background = '#f0f0f0'; });
    el.addEventListener('mouseleave', () => { el.style.background = ''; });
    el.addEventListener('click', () => { item.action(); menuPopup.remove(); menuPopup = null; });
    menuPopup.appendChild(el);
  });

  document.body.appendChild(menuPopup);

  const close = (ev) => {
    if (menuPopup && !menuPopup.contains(ev.target)) {
      menuPopup.remove(); menuPopup = null;
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
}

// ─── 启动 ───
init();
