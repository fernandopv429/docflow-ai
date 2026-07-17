import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import RichTextEditor from '@/components/RichTextEditor';
import VariableManager from '@/components/VariableManager';
import { extractVariables } from '@/lib/variables';

export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      />
    </div>
  );
}