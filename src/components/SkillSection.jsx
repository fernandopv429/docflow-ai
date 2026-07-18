import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';

export default function SkillSection({ skill, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-[#dadce0]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-5 py-3 text-left hover:bg-[#f8f9fa] transition-colors"
      >
        <Brain className="w-4 h-4 text-[#1a73e8]" />
        <span className="font-semibold text-[#202124] text-sm flex-1">Skill da IA</span>
        {skill?.trim() && !open && (
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
          <textarea
            value={skill || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={6}
            placeholder="Ensine a IA como preencher este template corretamente. Ex: 'Datas sempre por extenso. Nomes em maiúsculas. O valor deve ser escrito em números e por extenso...'"
            className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-md resize-none focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
          />
          <p className="text-xs text-[#9aa0a6] mt-1">
            Estas instruções são usadas pela IA ao analisar documentos e preencher as variáveis deste template.
          </p>
        </div>
      )}
    </div>
  );
}