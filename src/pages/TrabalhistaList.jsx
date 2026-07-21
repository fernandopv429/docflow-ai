import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Plus, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const STATUS_LABELS = {
  rascunho: ['Rascunho', 'bg-gray-100 text-gray-600'],
  em_analise: ['Em análise', 'bg-blue-100 text-blue-700'],
  auditado: ['Auditado', 'bg-purple-100 text-purple-700'],
  gerado: ['Gerado', 'bg-green-100 text-green-700'],
  revisao: ['Revisão', 'bg-yellow-100 text-yellow-700'],
  pronto: ['Pronto', 'bg-green-100 text-green-700'],
};

export default function TrabalhistaList() {
  const [casos, setCasos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.CasoTrabalhista.list('-updated_date', 100)
      .then(setCasos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-[#1a73e8] animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#202124]">Casos Trabalhistas</h1>
            <p className="text-sm text-[#5f6368] mt-1">Análise documental, auditoria e geração de petições</p>
          </div>
          <Link
            to="/trabalhista/novo"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Caso
          </Link>
        </div>

        {casos.length === 0 ? (
          <div className="text-center py-16 bg-white border border-[#dadce0] rounded-xl">
            <Briefcase className="w-10 h-10 text-[#dadce0] mx-auto mb-3" />
            <p className="text-[#5f6368]">Nenhum caso trabalhista ainda</p>
            <p className="text-xs text-[#9aa0a6] mt-1">Crie um caso para iniciar o fluxo de análise e geração</p>
          </div>
        ) : (
          <div className="space-y-2">
            {casos.map((c) => {
              const [label, cls] = STATUS_LABELS[c.status] || STATUS_LABELS.rascunho;
              return (
                <Link
                  key={c.id}
                  to={`/trabalhista/${c.id}`}
                  className="flex items-center gap-3 px-5 py-4 bg-white border border-[#dadce0] rounded-xl hover:shadow-md transition-shadow"
                >
                  <Briefcase className="w-5 h-5 text-[#1a73e8] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#202124] truncate">{c.titulo}</p>
                    <p className="text-xs text-[#5f6368]">
                      {c.recl_nome} × {c.recl1_nome} — {c.comarca_uf?.toUpperCase()}
                    </p>
                  </div>
                  {c.status_final_auditoria && (
                    <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${
                      c.status_final_auditoria === 'aprovado' ? 'bg-green-100 text-green-700'
                        : c.status_final_auditoria === 'revisar' ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {c.status_final_auditoria}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${cls}`}>{label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}