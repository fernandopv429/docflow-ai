import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, MoreVertical, Trash2, Copy, Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Home() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState(null);

  const load = () => {
    base44.entities.Template
      .list('-updated_date', 50)
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!confirm('Excluir este template?')) return;
    await base44.entities.Template.delete(id);
    setOpenMenu(null);
    load();
  };

  const handleDuplicate = async (t) => {
    await base44.entities.Template.create({
      title: `${t.title} (cópia)`,
      content: t.content,
      variables: t.variables,
    });
    setOpenMenu(null);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-[#1a73e8] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[#202124]">Meus Templates</h1>
          <p className="text-sm text-[#5f6368] mt-1">Crie documentos com variáveis preenchidas por IA</p>
        </div>
        <Link
          to="/templates/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-[#e8f0fe] rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-[#1a73e8]" />
          </div>
          <h3 className="text-lg font-medium text-[#202124] mb-2">Nenhum template ainda</h3>
          <p className="text-sm text-[#5f6368] mb-4">Crie seu primeiro template com variáveis dinâmicas</p>
          <Link
            to="/templates/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar Template
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="group relative bg-white border border-[#dadce0] rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-[#e8f0fe] rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#1a73e8]" />
                </div>
                <button
                  onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)}
                  className="p-1 text-[#5f6368] hover:bg-[#f1f3f4] rounded"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {openMenu === t.id && (
                  <div className="absolute right-4 top-12 z-10 bg-white border border-[#dadce0] rounded-lg shadow-lg py-1 w-40">
                    <button
                      onClick={() => handleDuplicate(t)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#3c4043] hover:bg-[#f8f9fa]"
                    >
                      <Copy className="w-3.5 h-3.5" /> Duplicar
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  </div>
                )}
              </div>
              <Link to={`/templates/${t.id}`}>
                <h3 className="font-medium text-[#202124] mb-1 hover:text-[#1a73e8] transition-colors">
                  {t.title}
                </h3>
              </Link>
              <p className="text-xs text-[#5f6368] mb-3">
                {(t.variables || []).length} variável(is) • Atualizado em{' '}
                {new Date(t.updated_date).toLocaleDateString('pt-BR')}
              </p>
              <div className="flex gap-2 pt-3 border-t border-[#f1f3f4]">
                <Link
                  to={`/templates/${t.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#3c4043] border border-[#dadce0] rounded-md hover:bg-[#f8f9fa] transition-colors"
                >
                  Editar
                </Link>
                <Link
                  to={`/templates/${t.id}/generate`}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  Gerar com IA
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}