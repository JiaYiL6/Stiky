// ============================================
// Stiky Note — 中转站侧边栏逻辑
// ============================================

let files = [];
let dragCounter = 0;

// DOM 元素
let sidebar, sidebarFileList, sidebarEmpty;
let sidebarDropOverlay, sidebarDivider;
let isResizing = false;
let startX, startWidth;

function initTransferSidebar() {
  sidebar = document.getElementById('transferSidebar');
  sidebarFileList = document.getElementById('sidebarFileList');
  sidebarEmpty = document.getElementById('sidebarEmpty');
  sidebarDropOverlay = document.getElementById('sidebarDropOverlay');
  sidebarDivider = document.getElementById('sidebarDivider');

  loadFiles();
  setupDragIn();
  setupDragOut();
  setupDividerResize();
  setupCollapse();
  setupFilesChangedListener();
}

// ─── 加载文件 ───
async function loadFiles() {
  files = await window.StikyAPI.getFiles(noteId);
  renderFileList();
}

// ─── 渲染文件列表 ───
function renderFileList() {
  if (!sidebarFileList) return;

  // 清空
  sidebarFileList.innerHTML = '';

  if (sidebarEmpty) {
    sidebarEmpty.style.display = files.length === 0 ? 'flex' : 'none';
  }

  // 渲染文件项
  renderFileItems();
  updateStats();
}

function renderFileItems() {
  sidebarFileList.querySelectorAll('.file-item').forEach(el => el.remove());
  files.forEach(file => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.draggable = true;
    item.dataset.id = file.id;

    // Windows 原生缩略图 or 回退图标
    const fallbackGlyph = getIconGlyph(file.originalName);
    let iconHTML;
    if (file.thumbnailPath) {
      // 先用占位，异步加载缩略图
      iconHTML = `<span class="icon-placeholder" style="font-size:24px">${fallbackGlyph}</span><img src="" style="display:none;width:36px;height:36px;object-fit:cover;border-radius:4px" data-thumb="${file.thumbnailPath}">`;
    } else {
      iconHTML = `<span style="font-size:24px">${fallbackGlyph}</span>`;
    }

    item.innerHTML = `
      <div class="file-item-icon">${iconHTML}</div>
      <div class="file-item-info">
        <div class="file-item-name">${escapeHtml(file.originalName)}</div>
      </div>
      <button class="file-item-remove" data-id="${file.id}" title="删除">✕</button>
    `;

    // 删除按钮
    item.querySelector('.file-item-remove').addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      await window.StikyAPI.removeFile(file.id);
      // 列表会自动通过 files-changed 事件更新
    });

    // 拖出事件
    item.addEventListener('dragstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.StikyAPI.startDrag(file.id);
    });

    // 双击打开文件
    item.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.StikyAPI.openFile(file.id);
    });

    // 右键菜单
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      window.StikyAPI.showContextMenu(file.id);
    });

    sidebarFileList.appendChild(item);

    // 异步加载 Windows 原生缩略图
    if (file.thumbnailPath) {
      window.StikyAPI.getThumbnailPath(file.thumbnailPath).then(path => {
        if (path) {
          const placeholder = item.querySelector('.icon-placeholder');
          const img = item.querySelector('img');
          if (placeholder) placeholder.style.display = 'none';
          if (img) { img.src = path; img.style.display = ''; }
        }
      });
    }
  });

}



// ─── 拖入逻辑 ───
function setupDragIn() {
  const dropTargets = [sidebar, sidebarFileList, sidebarDropOverlay, document.body];

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (sidebarDropOverlay) {
      sidebarDropOverlay.classList.remove('hidden');
    }
    // 如果侧边栏折叠，自动展开
    if (sidebar && sidebar.classList.contains('collapsed')) {
      sidebar.classList.remove('collapsed');
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      if (sidebarDropOverlay) {
        sidebarDropOverlay.classList.add('hidden');
      }
    }
  });

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (sidebarDropOverlay) {
      sidebarDropOverlay.classList.add('hidden');
    }

    const droppedFiles = Array.from(e.dataTransfer.files || []);
    const paths = droppedFiles
      .map(f => {
        try { return window.StikyAPI.getPathForFile(f); } catch (_) { return ''; }
      })
      .filter(p => p && p.trim());

    if (paths.length === 0) return;

    // 判断拖放目标：在编辑器内 → 粘贴路径；在侧边栏 → 复制到中转站
    const editorArea = document.getElementById('editorArea');
    const droppedInEditor = editorArea && editorArea.contains(e.target);

    if (droppedInEditor) {
      // 粘贴文件路径到编辑器光标位置
      const text = paths.join('\n');
      const editor = document.getElementById('editor');
      if (editor) {
        editor.focus();
        document.execCommand('insertText', false, text);
      }
    } else {
      for (const srcPath of paths) {
        try {
          await window.StikyAPI.addFile(srcPath, noteId);
        } catch (err) {
          console.error('Failed to stage file:', srcPath, err.message);
        }
      }
    }
  });
}

// ─── 拖出逻辑 ───
function setupDragOut() {
  // 已在 renderFileList 中处理
}

// ─── 分隔条拖拽调整宽度 ───
function setupDividerResize() {
  if (!sidebarDivider || !sidebar) return;

  sidebarDivider.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const delta = e.clientX - startX;
    // 侧边栏在右侧，向右拖增大，向左拖减小
    const newWidth = Math.max(52, Math.min(window.innerWidth * 0.5, startWidth - delta));
    sidebar.style.setProperty('--sidebar-width', newWidth + 'px');
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    saveSidebarState();

    // 调整完宽度后，如果鼠标已不在侧边栏内，启动收起定时器
    if (!sidebarPinned && !sidebar.classList.contains('collapsed')) {
      const rect = sidebar.getBoundingClientRect();
      // 用 mousemove 事件中记录的鼠标位置判断（或直接启动定时器）
      collapseTimer = setTimeout(() => {
        sidebar.classList.add('collapsed');
        updateFileHint();
      }, 600); syncState();
    }
  });

  // 双击重置宽度
  sidebarDivider.addEventListener('dblclick', () => {
    sidebar.style.setProperty('--sidebar-width', '260px');
    saveSidebarState();
  });

  // 监听宽度变化，窄时切换为仅图标模式
  const observer = new ResizeObserver(() => {
    const w = sidebar.offsetWidth;
    sidebar.classList.toggle('narrow', w < 90);
  });
  observer.observe(sidebar);
}

// ─── 图钉固定 + hover 自动展开 ───
let collapseTimer = null;
let sidebarPinned = false;
// 同步到 window 供 script.js 统一控制
function syncState() {
  window._sidebarCollapseTimer = collapseTimer;
  window._sidebarPinned = sidebarPinned;
}

function setupCollapse() {
  const pinBtn = document.getElementById('sidebarPinBtn');
  if (!pinBtn) return;

  // 点击图钉 → 切换固定/取消固定
  pinBtn.addEventListener('click', () => {
    sidebarPinned = !sidebarPinned;
    syncState();
    if (sidebarPinned) {
      pinBtn.textContent = '📍';
      pinBtn.title = '取消固定（鼠标移开自动收起）';
      pinBtn.classList.add('pinned');
    } else {
      pinBtn.textContent = '📌';
      pinBtn.title = '固定侧边栏';
      pinBtn.classList.remove('pinned');
    }
    saveSidebarState();
  });

  // 鼠标移到右边缘 → 自动展开
  const noteBody = document.querySelector('.note-body');
  noteBody.addEventListener('mousemove', (e) => {
    if (isResizing || sidebarPinned || !sidebar.classList.contains('collapsed')) return;
    const rect = noteBody.getBoundingClientRect();
    if (rect.right - e.clientX < 20) {
      clearTimeout(collapseTimer); syncState();
      sidebar.classList.remove('collapsed');
      updateFileHint();
    }
  });

  // 鼠标进入侧边栏 → 取消定时器
  sidebar.addEventListener('mouseenter', () => {
    clearTimeout(collapseTimer); syncState();
  });

  // 鼠标离开 → 自动折叠（未固定且非拖拽中）
  sidebar.addEventListener('mouseleave', () => {
    if (!sidebarPinned && !isResizing && !sidebar.classList.contains('collapsed')) {
      collapseTimer = setTimeout(() => {
        sidebar.classList.add('collapsed');
        updateFileHint();
      }, 600); syncState();
    }
  });

  // 拖入时保持展开
  document.addEventListener('dragenter', () => {
    clearTimeout(collapseTimer); syncState();
    if (sidebar.classList.contains('collapsed')) {
      sidebar.classList.remove('collapsed');
    }
  });

  // 文件夹按钮 → 打开桌面
  const folderBtn = document.getElementById('sidebarFolderBtn');
  if (folderBtn) {
    folderBtn.title = '打开桌面';
    folderBtn.addEventListener('click', () => {
      window.StikyAPI.openStorageFolder();
    });
  }
}

// ─── 文件数提示 ───
function updateStats() {
  updateFileHint();
}

function updateFileHint() {
  const el = document.getElementById('fileCountInline');
  if (!el) return;
  const hasFiles = files.length > 0;
  if (hasFiles) {
    el.classList.add('visible');
    el.textContent = `${files.length} 项目`;
  } else {
    el.classList.remove('visible');
  }
  if (window.updateBottomStats) window.updateBottomStats();
}

// ─── 监听文件变化（主进程广播） ───
function setupFilesChangedListener() {
  window.StikyAPI.onFilesChanged((updatedFiles) => {
    files = updatedFiles;
    renderFileList();
  });
}
