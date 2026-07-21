import React, { useState, useEffect } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { loadTemplateContent } from '@/lib/templateContent';
import { exportToDocx } from '@/lib/exportDocx';
import { deriveTokens, valorInvalido } from '@/lib/trabalhista/tokens';

// Passo 5: geração determinística do DOCX (sem IA) a partir do template + tokens
export default function GerarDocxSection({ caso, onGerado }) {
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [comTimbrado, setComTimbrado] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);

  const sugerido = caso.analise_json?.classificacao?.template_sugerido;

  useEffect(() => {
    base44.entities.Template.list('-updated_date', 100).then((list) => {
      setTemplates(list);
      const match = sugerido && list.find((t) => t.title === sugerido);
      setTemplateId(caso.template_id || match?.id || list[0]?.id || '');
    }).catch(() => {});
  }, [sugerido, caso.template_id]);

  const handleGerar = async () => {
    setGerando(true);
    setErro(null);
    try {
      const template = templates.find((t) => t.id === templateId);
      const content = await loadTemplateContent(template);
      // Tokens: extraídos pela IA na auditoria + derivação determinística (autoritativa)
      const derived = deriveTokens(caso);
      const values = { ...(caso.analise_json?.tokens || {}) };
      for (const [k, v] of Object.entries(derived)) {
        if (typeof v === 'boolean') continue;
        if (v) values[k] = v;
      }
      // Sanitização: rejeita valores inválidos ("SIM", "N/A", etc.)
      for (const k of Object.keys(values)) {
        if (typeof values[k] === 'boolean') { delete values[k]; continue; }
        values[k] = String(values[k] ?? '');
        if (valorInvalido(values[k])) values[k] = '';
      }
      await exportToDocx(content, values, caso.titulo, { comTimbrado });
      await base44.entities.CasoTrabalhista.update(caso.id, { template_id: templateId, status: 'gerado' });
      onGerado?.();
    } catch (err) {
      console.error(err);
      setErro('Erro ao gerar documento. Verifique o template selecionado.');
    }
    setGerando(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-[#3c4043] mb-1">Template da petição</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-md bg-white focus:outline-none focus:border-[#1a73e8]"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}{t.title === sugerido ? ' (sugerido pela auditoria)' : ''}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-[#3c4043] cursor-pointer select-none">
        <input type="checkbox" checked={comTimbrado} onChange={(e) => setComTimbrado(e.target.checked)} className="w-4 h-4 accent-[#1a73e8]" />
        Incluir timbrado
      </label>
      <button
        onClick={handleGerar}
        disabled={gerando || !templateId}
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] transition-colors disabled:opacity-50"
      >
        {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {gerando ? 'Gerando...' : 'Gerar DOCX (determinístico, sem IA)'}
      </button>
      {erro && <p className="text-xs text-red-500">{erro}</p>}
    </div>
  );
}