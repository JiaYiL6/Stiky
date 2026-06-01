// 富文本工具栏状态同步
function syncToolbarState(toolbar) {
  toolbar.querySelectorAll('[data-cmd]').forEach(btn => {
    const cmd = btn.dataset.cmd;
    try {
      btn.classList.toggle('active', document.queryCommandState(cmd));
    } catch (e) {
      // 某些命令不支持 queryCommandState
    }
  });
}

// 编辑器选区变化时同步按钮状态
function setupToolbarSync(editor, toolbar) {
  editor.addEventListener('mouseup', () => syncToolbarState(toolbar));
  editor.addEventListener('keyup', () => syncToolbarState(toolbar));
}

// 快捷键支持 (Ctrl+B/I/U)
function setupKeyboardShortcuts(editor, toolbar) {
  editor.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
      // execCommand 由浏览器自动处理
      setTimeout(() => syncToolbarState(toolbar), 0);
    }
  });
}

// 给 toolbar 按钮绑定事件
function setupToolbarButtons(toolbar, editor) {
  toolbar.querySelectorAll('button[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      if (cmd === 'insertUnorderedList' || cmd === 'insertOrderedList') {
        document.execCommand(cmd, false, null);
      } else {
        document.execCommand(cmd, false, null);
      }
      editor.focus();
      syncToolbarState(toolbar);
    });
  });
}
