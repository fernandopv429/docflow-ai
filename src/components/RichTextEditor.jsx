import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const RichTextEditor = forwardRef(({ value, onChange, placeholder }, ref) => {
  const quillRef = useRef(null);

  useImperativeHandle(ref, () => ({
    insertVariable: (varName) => {
      const editor = quillRef.current?.getEditor();
      if (editor) {
        const range = editor.getSelection();
        const index = range ? range.index : editor.getLength();
        editor.insertText(index, `{{${varName}}}`);
      }
    }
  }), []);

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['link'],
      ['clean']
    ]
  };

  return (
    <div className="quill-wrapper">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        placeholder={placeholder || 'Comece a escrever seu documento...'}
      />
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';
export default RichTextEditor;