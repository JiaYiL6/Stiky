// ============================================
// Stiky Transfer Window — 独立中转站逻辑
// ============================================

let files = [];
let dragCounter = 0;

const fileList = document.getElementById('fileList');
const emptyState = document.getElementById('emptyState');
const dropOverlay = document.getElementById('dropOverlay');
const fileStats = document.getElementById('fileStats');
const badge = document.getElementById('badge');
const btnClearAll = document.getElementById('btnClearAll');

// ─── 初始化 ───
async function init() {
  files = await window.StikyAPI.getFiles();
  renderFileList();
  setupEvents();
  setupDragDrop();
  setupFilesListener();
}

// ─── 渲染列表 ───
function renderFileList() {
  fileList.querySelectorAll('.file-item').forEach(el => el.remove());

  const hasFiles = files.length > 0;
  emptyState.style.display = hasFiles ? 'none' : 'flex';
  badge.style.display = hasFiles ? 'inline' : 'none';
  badge.textContent = files.length;

  if (!hasFiles) {
    fileStats.textContent = '0 个文件';
    btnClearAll.disabled = true;
    return;
  }

  btnClearAll.disabled = false;

  files.forEach(file => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.draggable = true;
    item.dataset.id = file.id;

    const iconGlyph = getIconGlyph(file.originalName);
    let iconHTML;
    if (file.thumbnailPath) {
      iconHTML = `<span style="font-size:26px">${iconGlyph}</span><img src="" style="display:none;width:40px;height:40px;object-fit:cover;border-radius:5px" data-thumb="${file.thumbnailPath}">`;
    } else {
      iconHTML = `<span style="font-size:26px">${iconGlyph}</span>`;
    }

    item.innerHTML = `
      <div class="file-item-icon">${iconHTML}</div>
      <div class="file-item-info">
        <div class="file-item-name">${escapeHtml(file.originalName)}</div>
      </div>
      <button class="file-item-remove" data-id="${file.id}" title="删除">✕</button>
    `;

    // 异步加载 Windows 原生缩略图
    if (file.thumbnailPath) {
      window.StikyAPI.getThumbnailPath(file.thumbnailPath).then(path => {
        if (path) {
          const img = item.querySelector('img');
          const placeholder = item.querySelector('.file-item-icon span');
          if (placeholder) placeholder.style.display = 'none';
          if (img) { img.src = path; img.style.display = ''; }
        }
      });
    }

    // 拖出
    item.addEventListener('dragstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.StikyAPI.startDrag(file.id);
    });

    // 右键菜单
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      window.StikyAPI.showContextMenu(file.id);
    });

    // 删除按钮
    item.querySelector('.file-item-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      window.StikyAPI.removeFile(file.id);
    });

    fileList.appendChild(item);
  });

  // 统计
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
  fileStats.textContent = `${files.length} 个文件`;
}

// ─── 拖入 ───
function setupDragDrop() {
  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dropOverlay.classList.remove('hidden');
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
      dropOverlay.classList.add('hidden');
    }
  });

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropOverlay.classList.add('hidden');

    const droppedFiles = Array.from(e.dataTransfer.files || []);
    const paths = droppedFiles
      .map(f => {
        try { return window.StikyAPI.getPathForFile(f); } catch (_) { return ''; }
      })
      .filter(p => p && p.trim());

    if (paths.length === 0) return;

    for (const srcPath of paths) {
      try {
        await window.StikyAPI.addFile(srcPath);
      } catch (err) {
        console.error('Failed to stage file:', srcPath, err.message);
      }
    }
  });
}

// ─── 事件 ───
function setupEvents() {
  document.getElementById('btnClose').addEventListener('click', () => {
    window.StikyAPI.closeTransferWindow();
  });

  btnClearAll.addEventListener('click', async () => {
    if (files.length === 0) return;
    if (!confirm(`确定清空全部 ${files.length} 个文件吗？`)) return;
    await window.StikyAPI.clearAllFiles();
  });
}

// ─── 监听文件变化 ───
function setupFilesListener() {
  window.StikyAPI.onFilesChanged((updatedFiles) => {
    files = updatedFiles;
    renderFileList();
  });
}

init();
