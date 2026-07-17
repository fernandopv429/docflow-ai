import React, { useState } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AIVariableDialog({ open, onClose, contentHtml, onApply }) {
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleAnalyze = async () => {
    if (!context.trim()) return;
    setLoading(true);
    try {
      const tmp = document.createElement('div');
      tmp.innerHTML = contentHtml;
      const plainText = tmp.textContent || '';

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um assistente de criação de templates de documentos.

CONTEXTO FORNECIDO PELO USUÁRIO:
${context}

TEXTO DO DOCUMENTO:
${plainText.slice(0, 15000)}

Analise o documento e, com base no contexto do usuário, identifique os trechos que devem virar variáveis dinâmicas (dados que mudam a cada documento, como nomes, datas, valores, endereços, CPF/CNPJ, etc).

Para cada variável retorne:
- name: nome em MAIÚSCULAS com underscores (ex: NOME_CONTRATANTE)
- description: descrição curta do que a variável representa
- original_text: o trecho EXATO e VERBATIM do documento que deve ser substituído (copie exatamente como aparece, sem alterar nada). Escolha trechos curtos e contínuos, sem quebras de linha.

Retorne apenas variáveis cujo original_text aparece literalmente no documento.`,
        response_json_schema: {
          type: 'object',
          properties: {
            variables: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  original_text: { type: 'string' },
                },
              },
            },
          },
        },
      });

      onApply(result.variables || []);
      setContext('');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao analisar o documento com a IA');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#dadce0]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#1a73e8]" />
            <h2 className="font-semibold text-[#202124] text-sm">Criar variáveis com IA</h2>
          </div>
          <button onClick={onClose} className="p-1 text-[#5f6368] hover:bg-[#f1f3f4] rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-[#5f6368] mb-3">
            Descreva o contexto do documento e a IA vai identificar automaticamente os trechos que devem virar variáveis.
          </p>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Ex: Este é um contrato de prestação de serviços. Quero variáveis para os dados do contratante, do contratado, valores e datas."
            rows={4}
            className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-md resize-none focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
          />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#dadce0]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#3c4043] border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]"
          >
            Cancelar
          </button>
          <button
            onClick={handleAnalyze}
            disabled={loading || !context.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Analisando...' : 'Analisar e criar'}
          </button>
        </div>
      </div>
    </div>
  );
}