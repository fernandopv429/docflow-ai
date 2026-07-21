import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';

export default function DescriptionSection({ description, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-[#dadce0]">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 w-full px-5 py-3 text-left hover:bg-[#f8f9fa] transition-colors"
      >
        <FileText className="w-4 h-4 text-[#1a73e8]" />
        <span className="font-semibold text-[#202124] text-sm flex-1">Descrição do Template</span>
        {description?.trim() && !open && (
          <span className="w-2 h-2 bg-[#1a73e8] rounded-full" />
        )}
        {open ? (
          <ChevronUp className="w-4 h-4 text-[#5f6368]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#5f6368]" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-4">
          <p className="text-xs text-[#5f6368] mb-2">
            Descreva quando este template deve ser usado, para que uma IA possa selecioná-lo automaticamente com base no contexto.
          </p>
          <textarea
            value={description || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ex: Contrato de honorários para ações previdenciárias de aposentadoria..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-md resize-none focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
          />
        </div>
      )}
    </div>
  );
}