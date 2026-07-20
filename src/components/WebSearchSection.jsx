import React, { useState } from 'react';
import { Globe, ChevronDown, ChevronUp } from 'lucide-react';

export default function WebSearchSection({ webSearch, onToggle, searchSites, onUpdateSites }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-[#dadce0]">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-2 w-full px-5 py-3 text-left hover:bg-[#f8f9fa] transition-colors"
      >
        <Globe className="w-4 h-4 text-[#1a73e8]" />
        <span className="font-semibold text-[#202124] text-sm flex-1">Busca na Internet</span>
        {webSearch && <span className="w-2 h-2 bg-[#1a73e8] rounded-full" />}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[#5f6368]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#5f6368]" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-4">
          <label className="flex items-center gap-2 text-sm text-[#3c4043] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={webSearch}
              onChange={(e) => onToggle(e.target.checked)}
              className="w-4 h-4 accent-[#1a73e8]"
            />
            Permitir busca na internet
          </label>
          <p className="text-xs text-[#5f6368] mt-1.5">
            A IA poderá complementar a análise com informações da web quando o dado não estiver no documento.
          </p>
          {webSearch && (
            <textarea
              value={searchSites || ''}
              onChange={(e) => onUpdateSites(e.target.value)}
              placeholder="Sites prioritários (um por linha). Ex: gov.br, receita.fazenda.gov.br"
              rows={3}
              className="w-full mt-2 px-3 py-2 text-sm border border-[#dadce0] rounded-md resize-none focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
            />
          )}
        </div>
      )}
    </div>
  );
}