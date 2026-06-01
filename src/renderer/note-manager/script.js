// ============================================
// Stiky Note Manager — 便签管理器逻辑
// ============================================

let notes = [];
let filteredNotes = [];
let selectedIds = new Set();

// DOM 元素
const noteList = document.getElementById('noteList');
const searchInput = document.getElementById('searchInput');
const noteCount = document.getElementById('noteCount');
const emptyState = document.getElementById('emptyState');
const selectAll = document.getElementById('selectAll');
const selectedCount = document.getElementById('selectedCount');
const btnDelete = document.getElementById('btnDelete');
const btnNew = document.getElementById('btnNew');

// ─── 初始化 ───
async function init() {
  await refreshNotes();
  setupEvents();
}

async function refreshNotes() {
  notes = await window.StikyAPI.getAllNotes();
  // 按更新时间倒序
  notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  applyFilter();
}

function applyFilter() {
  const query = (searchInput.value || '').toLowerCase().trim();
  if (!query) {
    filteredNotes = [...notes];
  } else {
    filteredNotes = notes.filter(n => {
      const text = (n.content || '').replace(/<[^>]*>/g, '').toLowerCase();
      return text.includes(query);
    });
  }
  noteCount.textContent = `${filteredNotes.length} 个便签`;
  renderList();
}

// ─── 渲染列表 ───
function renderList() {
  noteList.innerHTML = '';

  if (filteredNotes.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  filteredNotes.forEach(note => {
    const item = document.createElement('div');
    item.className = 'note-item';
    item.dataset.id = note.id;
    if (selectedIds.has(note.id)) {
      item.classList.add('selected');
    }

    const colors = getNoteColor(note.color);
    const plainText = (note.content || '').replace(/<[^>]*>/g, '').trim();
    const preview = plainText.slice(0, 120) || '(空便签)';
    const wordCount = plainText ? plainText.length : 0;
    const dateStr = note.updatedAt ? formatDate(note.updatedAt) : '';

    item.innerHTML = `
      <input type="checkbox" class="note-item-checkbox" ${selectedIds.has(note.id) ? 'checked' : ''}>
      <div class="note-item-color-dot" style="background:${colors.bg};"></div>
      <div class="note-item-content">
        <div class="note-item-preview">${escapeHtml(preview)}</div>
        <div class="note-item-meta">
          <span class="note-item-date">${dateStr}</span>
          ${wordCount > 0 ? `<span class="note-item-words">${wordCount} 字</span>` : ''}
        </div>
      </div>
    `;

    // 点击便签项 → 打开/聚焦便签
    item.addEventListener('click', (e) => {
      // 不拦截 checkbox 点击
      if (e.target.tagName === 'INPUT') return;
      window.StikyAPI.focusNote(note.id);
    });

    // 双击 → 最小化管理器让用户看到便签
    item.addEventListener('dblclick', () => {
      window.StikyAPI.focusNote(note.id);
    });

    // checkbox
    const checkbox = item.querySelector('.note-item-checkbox');
    checkbox.addEventListener('change', () => {
      toggleSelect(note.id, checkbox.checked);
    });

    // 颜色点 → 弹出颜色选择
    const dot = item.querySelector('.note-item-color-dot');
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      showColorPicker(e, note, dot);
    });

    noteList.appendChild(item);
  });

  updateActionBar();
}

// ─── 选择逻辑 ───
function toggleSelect(id, checked) {
  if (checked) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }
  updateActionBar();

  // 更新对应 item 样式
  const item = noteList.querySelector(`[data-id="${id}"]`);
  if (item) item.classList.toggle('selected', checked);
}

function updateActionBar() {
  const count = selectedIds.size;
  selectedCount.textContent = `已选 ${count} 项`;
  btnDelete.disabled = count === 0;
  selectAll.checked = count > 0 && count === filteredNotes.length;
  selectAll.indeterminate = count > 0 && count < filteredNotes.length;
}

// ─── 事件绑定 ───
function setupEvents() {
  // 关闭
  document.getElementById('btnClose').addEventListener('click', () => {
    window.StikyAPI.closeNoteManager();
  });

  // 设置
  document.getElementById('btnSettings').addEventListener('click', () => {
    window.StikyAPI.openSettings();
  });

  // 搜索
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilter, 200);
  });

  // 全选
  selectAll.addEventListener('change', () => {
    if (selectAll.checked) {
      filteredNotes.forEach(n => selectedIds.add(n.id));
    } else {
      filteredNotes.forEach(n => selectedIds.delete(n.id));
    }
    renderList();
  });

  // 新建便签
  btnNew.addEventListener('click', async () => {
    await window.StikyAPI.createNote();
    await refreshNotes();
  });

  // 删除选中
  btnDelete.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个便签吗？此操作不可撤销。`)) return;

    for (const id of selectedIds) {
      await window.StikyAPI.deleteNote(id);
    }
    selectedIds.clear();
    await refreshNotes();
  });

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    // Ctrl+A 全选
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      filteredNotes.forEach(n => selectedIds.add(n.id));
      renderList();
    }
    // Delete 键删除选中
    if (e.key === 'Delete' && selectedIds.size > 0) {
      btnDelete.click();
    }
  });

  // 定期刷新（其他窗口可能创建/删除便签）
  setInterval(refreshNotes, 5000);
}

// ─── 颜色选择弹窗 ───
let colorPopup = null;

function showColorPicker(e, note, dot) {
  // 移除旧弹窗
  if (colorPopup) colorPopup.remove();

  colorPopup = document.createElement('div');
  colorPopup.className = 'color-popup';
  colorPopup.style.cssText = `
    position: fixed; background: #fff; border: 1px solid #ddd; border-radius: 8px;
    padding: 8px; box-shadow: 0 3px 12px rgba(0,0,0,0.18); z-index: 1000;
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;
    left: ${e.clientX}px; top: ${e.clientY}px;
  `;

  Object.entries(NOTE_COLORS).forEach(([key, val]) => {
    const swatch = document.createElement('div');
    swatch.style.cssText = `
      width: 26px; height: 26px; border-radius: 5px; cursor: pointer;
      background: ${val.bg}; border: 2px solid ${key === note.color ? '#0078d4' : val.border};
      box-shadow: ${key === note.color ? '0 0 0 2px rgba(0,120,212,0.2)' : 'none'};
    `;
    swatch.title = val.name;
    swatch.addEventListener('click', async () => {
      await window.StikyAPI.setNoteColor(note.id, key);
      dot.style.background = val.bg;
      colorPopup.remove();
      colorPopup = null;
    });
    colorPopup.appendChild(swatch);
  });

  document.body.appendChild(colorPopup);

  // 点击其他地方关闭
  const closePopup = (ev) => {
    if (colorPopup && !colorPopup.contains(ev.target)) {
      colorPopup.remove();
      colorPopup = null;
      document.removeEventListener('click', closePopup);
    }
  };
  setTimeout(() => document.addEventListener('click', closePopup), 0);
}

init();
