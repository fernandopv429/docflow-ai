import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';

const RichTextEditor = forwardRef(({ value, onChange, placeholder, onVariableFromSelection, onVariableAtCursor }, ref) => {
  const editorRef = useRef(null);
  const isInternalChange = useRef(false);
  const pendingRange = useRef(null);

  // Sync external value changes to the DOM (e.g. on load)
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    isInternalChange.current = false;
  }, [value]);

  useImperativeHandle(ref, () => ({
    insertVariable: (varName) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
        // Place cursor at end
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      const range = sel.getRangeAt(0);
      const text = document.createTextNode(`{{${varName}}}`);
      range.deleteContents();
      range.insertNode(text);
      range.setStartAfter(text);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      isInternalChange.current = true;
      onChange(el.innerHTML);
    },
    applyPendingVariable: (varName) => {
      const el = editorRef.current;
      const range = pendingRange.current;
      if (!el || !range) return;
      range.deleteContents();
      const text = document.createTextNode(`{{${varName}}}`);
      range.insertNode(text);
      pendingRange.current = null;
      isInternalChange.current = true;
      onChange(el.innerHTML);
    }
  }), []);

  const exec = (command, val = null) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    isInternalChange.current = true;
    onChange(editorRef.current?.innerHTML || '');
  };

  const setBlock = (tag) => {
    document.execCommand('formatBlock', false, tag);
    editorRef.current?.focus();
    isInternalChange.current = true;
    onChange(editorRef.current?.innerHTML || '');
  };

  const handleInput = () => {
    isInternalChange.current = true;
    onChange(editorRef.current?.innerHTML || '');
  };

  const handleKeyDown = (e) => {
    // Enter in empty editor creates a <p>
    if (e.key === 'Enter' && !e.shiftKey) {
      // Default behavior handles this; execCommand handles it natively
    }
  };

  const ToolbarButton = ({ cmd, children, title }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        exec(cmd);
      }}
      className="w-7 h-7 flex items-center justify-center text-[#5f6368] hover:bg-[#e8eaed] hover:text-[#202124] rounded text-sm transition-colors"
    >
      {children}
    </button>
  );

  const BlockButton = ({ tag, children, title }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        setBlock(tag);
      }}
      className="px-2 h-7 flex items-center justify-center text-[#5f6368] hover:bg-[#e8eaed] hover:text-[#202124] rounded text-xs font-medium transition-colors min-w-[70px]"
    >
      {children}
    </button>
  );

  return (
    <div className="quill-wrapper flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-[#dadce0] bg-[#f8f9fa] sticky top-0 z-10 flex-wrap">
        <select
          onChange={(e) => setBlock(e.target.value)}
          defaultValue="p"
          className="h-7 text-xs border border-[#dadce0] rounded px-1 bg-white text-[#3c4043] focus:outline-none focus:border-[#1a73e8]"
        >
          <option value="p">Texto normal</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
        </select>
        <div className="w-px h-5 bg-[#dadce0] mx-1" />
        <ToolbarButton cmd="bold" title="Negrito">
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton cmd="italic" title="Itálico">
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton cmd="underline" title="Sublinhado">
          <u>U</u>
        </ToolbarButton>
        <div className="w-px h-5 bg-[#dadce0] mx-1" />
        <ToolbarButton cmd="insertUnorderedList" title="Lista">
          •≡
        </ToolbarButton>
        <ToolbarButton cmd="insertOrderedList" title="Lista numerada">
          1≡
        </ToolbarButton>
        <div className="w-px h-5 bg-[#dadce0] mx-1" />
        <ToolbarButton cmd="justifyLeft" title="Alinhar à esquerda">
          ⯇
        </ToolbarButton>
        <ToolbarButton cmd="justifyCenter" title="Centralizar">
          ≡
        </ToolbarButton>
        <ToolbarButton cmd="justifyRight" title="Alinhar à direita">
          ⯈
        </ToolbarButton>
        <div className="w-px h-5 bg-[#dadce0] mx-1" />
        <button
          type="button"
          title="Transformar seleção em variável"
          onMouseDown={(e) => {
            e.preventDefault();
            const sel = window.getSelection();
            const text = sel.toString().trim();
            if (!text || sel.rangeCount === 0 || !editorRef.current?.contains(sel.anchorNode)) {
              alert('Grife (selecione) um trecho do texto para transformá-lo em variável');
              return;
            }
            pendingRange.current = sel.getRangeAt(0).cloneRange();
            onVariableFromSelection?.(text);
          }}
          className="px-2 h-7 flex items-center justify-center text-[#1a73e8] hover:bg-[#e8f0fe] rounded text-xs font-mono font-medium transition-colors"
        >
          {'{{x}}'}
        </button>
        <button
          type="button"
          title="Inserir variável no ponto do cursor"
          onMouseDown={(e) => {
            e.preventDefault();
            const el = editorRef.current;
            if (!el) return;
            const sel = window.getSelection();
            let range;
            if (sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
              range = sel.getRangeAt(0).cloneRange();
              range.collapse(true);
            } else {
              range = document.createRange();
              range.selectNodeContents(el);
              range.collapse(false);
            }
            pendingRange.current = range;
            onVariableAtCursor?.();
          }}
          className="px-2 h-7 flex items-center justify-center text-[#1a73e8] hover:bg-[#e8f0fe] rounded text-xs font-mono font-medium transition-colors"
        >
          {'+{{}}'}
        </button>
        <div className="w-px h-5 bg-[#dadce0] mx-1" />
        <button
          type="button"
          title="Limpar formatação"
          onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); }}
          className="px-2 h-7 flex items-center justify-center text-[#5f6368] hover:bg-[#e8eaed] hover:text-[#202124] rounded text-xs transition-colors"
        >
          ⌫
        </button>
      </div>

      {/* Editable area */}
      <div className="flex-1 overflow-y-auto">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          data-placeholder={placeholder || 'Comece a escrever seu documento...'}
          className="doc-editor-content focus:outline-none"
        />
      </div>
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';
export default RichTextEditor;