import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Sparkles, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import RichTextEditor from '@/components/RichTextEditor';
import VariableManager from '@/components/VariableManager';
import AIVariableDialog from '@/components/AIVariableDialog';
import VariableNameDialog from '@/components/VariableNameDialog';
import { extractVariables } from '@/lib/variables';
import { importDocxAsTemplate } from '@/lib/importDocx';

export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [selDialog, setSelDialog] = useState({ open: false, text: '' });
  const editorRef = useRef(null);

  useEffect(() => {
    if (id) {
      base44.entities.Template
        .get(id)
        .then((t) => {
          setTitle(t.title || '');
          setContent(t.content || '');
          setVariables(t.variables || []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id]);

  const detectedVars = extractVariables(content);
  const mergedVars = detectedVars.map((dv) => {
    const existing = variables.find((v) => v.name === dv.name);
    return existing ? { ...existing } : dv;
  });

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Digite um título para o template');
      return;
    }
    setSaving(true);
    try {
      const data = { title, content, variables: mergedVars };
      if (id) {
        await base44.entities.Template.update(id, data);
      } else {
        const created = await base44.entities.Template.create(data);
        navigate(`/templates/${created.id}`, { replace: true });
      }
    } catch (err) {
      alert('Erro ao salvar template');
    }
    setSaving(false);
  };

  const handleAddVariable = (varName) => {
    editorRef.current?.insertVariable(varName);
  };

  const handleUpdateDescription = (varName, description) => {
    setVariables((prev) => {
      const existing = prev.find((v) => v.name === varName);
      if (existing) {
        return prev.map((v) => (v.name === varName ? { ...v, description } : v));
      }
      return [...prev, { name: varName, description }];
    });
  };

  const handleAIVariables = (aiVars) => {
    let newContent = content;
    let appliedCount = 0;
    aiVars.forEach((v) => {
      if (v.original_text && v.name && newContent.includes(v.original_text)) {
        newContent = newContent.split(v.original_text).join(`{{${v.name}}}`);
        appliedCount++;
      }
    });
    setContent(newContent);
    setVariables((prev) => {
      const merged = [...prev];
      aiVars.forEach((v) => {
        const existing = merged.find((m) => m.name === v.name);
        if (existing) {
          existing.description = v.description || existing.description;
        } else {
          merged.push({ name: v.name, description: v.description || '' });
        }
      });
      return merged;
    });
    if (appliedCount === 0) {
      alert('A IA não encontrou trechos exatos para substituir. Tente descrever melhor o contexto.');
    }
  };

  const handleSelectionVariable = (text) => setSelDialog({ open: true, text });

  const confirmSelectionVariable = (name, description) => {
    editorRef.current?.applyPendingVariable(name);
    setVariables((prev) => {
      const existing = prev.find((v) => v.name === name);
      if (existing) {
        return prev.map((v) => (v.name === name ? { ...v, description: description || v.description } : v));
      }
      return [...prev, { name, description: description || '' }];
    });
    setSelDialog({ open: false, text: '' });
  };

  const handleImportDocx = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await importDocxAsTemplate(file);
      setTitle(result.title);
      setContent(result.content);
      setVariables(result.variables);
    } catch (err) {
      console.error(err);
      alert(`Erro ao importar documento: ${err.message}`);
    }
    setImporting(false);
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-[#1a73e8] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-[#dadce0]">
          <Link to="/" className="text-[#5f6368] hover:text-[#202124]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do documento"
            className="flex-1 text-lg font-medium text-[#202124] bg-transparent border-none focus:outline-none"
          />
          <input type="file" accept=".docx" onChange={handleImportDocx} className="hidden" id="import-docx" />
          <label htmlFor="import-docx" className="flex items-center gap-2 px-4 py-2 text-[#3c4043] border border-[#dadce0] rounded-lg text-sm font-medium hover:bg-[#f8f9fa] transition-colors cursor-pointer">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? 'Importando...' : 'Importar DOCX'}
          </label>
          {id && (
            <Link
              to={`/templates/${id}/generate`}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Gerar com IA
            </Link>
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto bg-[#f8f9fa]">
          <div className="max-w-[816px] mx-auto my-6 bg-white shadow-md min-h-[1056px]">
            <RichTextEditor
              ref={editorRef}
              value={content}
              onChange={setContent}
              onVariableFromSelection={handleSelectionVariable}
              placeholder="Comece a escrever seu documento... Use {{NOME_VARIAVEL}} para inserir variáveis."
            />
          </div>
        </div>
      </div>

      {/* Variable panel */}
      <VariableManager
        variables={mergedVars}
        onAddVariable={handleAddVariable}
        onUpdateDescription={handleUpdateDescription}
        onSave={handleSave}
        saving={saving}
        onOpenAI={() => setAiDialogOpen(true)}
      />

      <AIVariableDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        contentHtml={content}
        onApply={handleAIVariables}
      />

      <VariableNameDialog
        open={selDialog.open}
        selectedText={selDialog.text}
        onConfirm={confirmSelectionVariable}
        onClose={() => setSelDialog({ open: false, text: '' })}
      />
    </div>
  );
}