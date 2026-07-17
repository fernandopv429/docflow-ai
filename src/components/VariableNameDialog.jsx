import React, { useState, useEffect } from 'react';
import { Highlighter, X } from 'lucide-react';

export default function VariableNameDialog({ open, selectedText, onConfirm, onClose }) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    const clean = name.trim().toUpperCase().replace(/\s+/g, '_');
    if (!clean) return;
    onConfirm(clean);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#dadce0]">
          <div className="flex items-center gap-2">
            <Highlighter className="w-4 h-4 text-[#1a73e8]" />
            <h2 className="font-semibold text-[#202124] text-sm">Transformar seleção em variável</h2>
          </div>
          <button onClick={onClose} className="p-1 text-[#5f6368] hover:bg-[#f1f3f4] rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[#5f6368] mb-2">Texto selecionado:</p>
          <div className="px-3 py-2 bg-[#f8f9fa] border border-[#dadce0] rounded-md text-sm text-[#3c4043] mb-3 max-h-20 overflow-y-auto">
            {selectedText}
          </div>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            placeholder="NOME_DA_VARIAVEL"
            className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-md focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
          />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#dadce0]">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#3c4043] border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!name.trim()}
            className="px-4 py-2 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] disabled:opacity-50"
          >
            Criar variável
          </button>
        </div>
      </div>
    </div>
  );
}