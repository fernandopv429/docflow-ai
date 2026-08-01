import React from 'react';
import { Plus, MessageSquare, Trash2, Loader2 } from 'lucide-react';

export default function ConversasSidebar({ conversas, ativaId, ocupadas = {}, aberta = true, onNova, onSelecionar, onExcluir }) {
  if (!aberta) return null;
  return (
    <div className="flex flex-col w-full lg:w-56 max-h-52 lg:max-h-none flex-shrink-0 border-b lg:border-b-0 lg:border-r border-[#dadce0] bg-white">
      <div className="p-3">
        <button
          onClick={onNova}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1a73e8] text-white rounded-lg text-xs font-medium hover:bg-[#1557b0] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Nova entrevista
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        {conversas.length === 0 && (
          <p className="text-[11px] text-[#9aa0a6] px-2 py-3">Nenhuma entrevista salva ainda.</p>
        )}
        {conversas.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center gap-1.5 px-2 py-2 rounded-lg cursor-pointer ${
              c.id === ativaId ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'text-[#3c4043] hover:bg-[#f1f3f4]'
            }`}
            onClick={() => onSelecionar(c.id)}
          >
            {ocupadas[c.id] ? (
              <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin text-[#1a73e8]" />
            ) : (
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            <span className="flex-1 min-w-0 truncate text-xs">{c.titulo || 'Sem título'}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExcluir(c.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-[#9aa0a6] hover:text-red-600"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}