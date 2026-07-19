// A minimal, dependency-free rich text editor: an editable box plus a small
// toolbar (font size / bold / text color / highlight / clear formatting).
// Built directly on the browser's contentEditable + document.execCommand
// APIs instead of pulling in a full editor library (Tiptap/Quill/etc) —
// proportional to what the newsletter composer actually needs. `execCommand`
// is a deprecated Web API, but every major browser still ships it and
// there's no drop-in replacement for "simple WYSIWYG toolbar" without a
// real dependency.
'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { Bold, Palette, Highlighter, Eraser, Type, ChevronDown } from 'lucide-react';

// Preset sizes shown in the font-size dropdown, in pixels.
const FONT_SIZES = [12, 14, 16, 18, 24, 32];

interface RichTextEditorProps {
  value: string; // current content, as an HTML string
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className = '' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  // The user's last text selection made *inside* the editor. Clicking a
  // native <input type="color"> steals focus (and the browser's selection)
  // before its color picker even opens — so we save the selection here
  // whenever it changes, and restore it right before applying a color,
  // otherwise the color command would have no selected text to apply to.
  const savedRangeRef = useRef<Range | null>(null);

  // Keep the editable box in sync with `value` only when it changes from
  // OUTSIDE (e.g. the parent page clearing the form after sending) — not on
  // every keystroke, which would fight the browser's own cursor position.
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const emitChange = useCallback(() => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0);
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
  }, []);

  // Runs a simple formatting command (bold, removeFormat) on the current
  // selection, focusing the editor first so the command has something to act on.
  const runCommand = useCallback((command: string) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false);
    emitChange();
  }, [emitChange, restoreSelection]);

  // Applies a pixel font size to the current selection. execCommand's own
  // 'fontSize' command only accepts legacy values 1–7 (not real px sizes),
  // so we use 7 as a sentinel — it wraps the selection in <font size="7">
  // — then immediately swap every such tag for a <span style="font-size:
  // Npx"> with the actual size the admin picked, and drop the legacy tag.
  const applyFontSize = useCallback((px: string) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand('fontSize', false, '7');
    editorRef.current?.querySelectorAll('font[size="7"]').forEach((el) => {
      const span = document.createElement('span');
      span.style.fontSize = `${px}px`;
      span.innerHTML = el.innerHTML;
      el.replaceWith(span);
    });
    emitChange();
  }, [emitChange, restoreSelection]);

  // Applies a text color to the current selection.
  const applyTextColor = useCallback((color: string) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand('foreColor', false, color);
    emitChange();
  }, [emitChange, restoreSelection]);

  // Applies a highlight (background) color. 'hiliteColor' is the standard
  // command for this, but older/some browsers only support 'backColor' —
  // execCommand returns false if a command isn't supported, so we fall back.
  const applyHighlight = useCallback((color: string) => {
    editorRef.current?.focus();
    restoreSelection();
    const ok = document.execCommand('hiliteColor', false, color);
    if (!ok) document.execCommand('backColor', false, color);
    emitChange();
  }, [emitChange, restoreSelection]);

  return (
    <div className={`border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        {/* Font size — a plain <select>; onMouseDown saves the current
            selection before the dropdown steals focus to open, same trick
            used by the color inputs below. Given an explicit border/bg/text
            color (rather than blending into the toolbar) and a manual
            chevron, since `appearance-none` strips the native arrow with
            nothing to replace it. */}
        <label
          className="relative flex items-center gap-1 pl-1.5 pr-5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          title="Font size"
        >
          <Type size={14} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
          <select
            defaultValue=""
            onMouseDown={saveSelection}
            onChange={(e) => { if (e.target.value) applyFontSize(e.target.value); e.target.value = ''; }}
            className="bg-transparent text-xs text-gray-700 dark:text-gray-200 outline-none cursor-pointer appearance-none"
          >
            <option value="" disabled className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">Size</option>
            {FONT_SIZES.map(size => (
              <option key={size} value={size} className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">{size}px</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-1.5 text-gray-400 dark:text-gray-500 pointer-events-none" />
        </label>

        <button
          type="button"
          // onMouseDown (not onClick) + preventDefault stops the button from
          // stealing focus/selection away from the editor before the command runs.
          onMouseDown={(e) => { e.preventDefault(); runCommand('bold'); }}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          title="Bold"
        >
          <Bold size={16} />
        </button>

        {/* Text color — a native color input, made invisible and stretched
            over the icon, so clicking the icon opens the OS color picker. */}
        <label className="relative p-1.5 rounded hover:bg-gray-200 dark:hover:bg-white/10 transition-colors cursor-pointer flex items-center" title="Text color">
          <Palette size={16} />
          <input
            type="color"
            defaultValue="#208f6a"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onMouseDown={saveSelection}
            onChange={(e) => applyTextColor(e.target.value)}
          />
        </label>

        {/* Highlight color — same overlay trick as above. */}
        <label className="relative p-1.5 rounded hover:bg-gray-200 dark:hover:bg-white/10 transition-colors cursor-pointer flex items-center" title="Highlight">
          <Highlighter size={16} />
          <input
            type="color"
            defaultValue="#fff59d"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onMouseDown={saveSelection}
            onChange={(e) => applyHighlight(e.target.value)}
          />
        </label>

        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); runCommand('removeFormat'); }}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          title="Clear formatting"
        >
          <Eraser size={16} />
        </button>
      </div>

      {/* Editable area. `empty:before:content-[attr(data-placeholder)]` shows
          the placeholder text via CSS only while the box has no content —
          contentEditable elements don't support a real `placeholder` attribute. */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        data-placeholder={placeholder}
        className="min-h-[160px] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 dark:empty:before:text-gray-500"
      />
    </div>
  );
}
