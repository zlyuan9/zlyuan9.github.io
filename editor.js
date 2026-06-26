(function () {
  const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'PRE', 'BLOCKQUOTE']);

  function getLineElements(content) {
    const lines = [];
    for (const child of content.children) {
      if (child.tagName === 'UL' || child.tagName === 'OL') {
        for (const li of child.children) {
          if (li.tagName === 'LI') lines.push(li);
        }
      } else if (BLOCK_TAGS.has(child.tagName) || child.tagName === 'DIV') {
        lines.push(child);
      }
    }
    return lines;
  }

  function findLineBlock(node, content) {
    const lines = getLineElements(content);
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el && el !== content) {
      if (lines.includes(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function getOffsetInElement(element, targetNode, targetOffset) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let node;
    while ((node = walker.nextNode())) {
      if (node === targetNode) return offset + targetOffset;
      offset += node.textContent.length;
    }
    return offset;
  }

  function getCaretLineCol(content) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!content.contains(range.startContainer)) return null;

    const lines = getLineElements(content);
    if (lines.length === 0) return { line: 1, col: 1 };

    const block = findLineBlock(range.startContainer, content);
    if (!block) return { line: 1, col: 1 };

    const lineIndex = lines.indexOf(block);
    const line = lineIndex >= 0 ? lineIndex + 1 : 1;
    const col = getOffsetInElement(block, range.startContainer, range.startOffset) + 1;

    return { line, col };
  }

  function getEndLineCol(content) {
    const lines = getLineElements(content);
    if (lines.length === 0) return { line: 1, col: 1 };

    const lastLine = lines[lines.length - 1];
    const text = lastLine.textContent || '';
    return { line: lines.length, col: text.length + 1 };
  }

  function updateCursorStatus(content, positionEl) {
    const pos = getCaretLineCol(content) || getEndLineCol(content);
    positionEl.textContent = `Ln ${pos.line}, Col ${pos.col}`;
  }

  function placeCaretAtEnd(content) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(content);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function placeCaretFromBlinkingCursor(content) {
    const blink = content.querySelector('.blinking-cursor');
    if (!blink) {
      placeCaretAtEnd(content);
      return;
    }

    const range = document.createRange();
    const selection = window.getSelection();
    range.setStartBefore(blink);
    range.collapse(true);
    blink.remove();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function isNavigationKey(key) {
    return [
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'PageUp', 'PageDown'
    ].includes(key);
  }

  function initEditorCursor() {
    const editor = document.getElementById('editor');
    const positionEl = document.getElementById('cursorPosition');
    if (!editor || !positionEl) return;

    const content = editor.querySelector('.content');
    if (!content) {
      positionEl.textContent = 'Ln 1, Col 1';
      return;
    }

    content.setAttribute('contenteditable', 'true');
    content.setAttribute('spellcheck', 'false');

    placeCaretFromBlinkingCursor(content);
    updateCursorStatus(content, positionEl);

    const refresh = () => updateCursorStatus(content, positionEl);

    content.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (link) {
        e.preventDefault();
        window.open(link.href, link.target || '_self');
        return;
      }
      refresh();
    });
    content.addEventListener('keyup', refresh);
    content.addEventListener('keydown', (e) => {
      if (!isNavigationKey(e.key)) e.preventDefault();
      requestAnimationFrame(refresh);
    });
    content.addEventListener('beforeinput', (e) => e.preventDefault());
    content.addEventListener('paste', (e) => e.preventDefault());
    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      if (content.contains(selection.anchorNode)) refresh();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEditorCursor);
  } else {
    initEditorCursor();
  }
})();
