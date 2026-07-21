import React from 'react';

const SEV_CLS = {
  BLOQUEANTE: 'bg-red-50 border-red-200 text-red-700',
  ATENCAO: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  INFO: 'bg-blue-50 border-blue-200 text-blue-700',
};

const STATUS_CLS = {
  aprovado: 'bg-green-100 text-green-700',
  revisar: 'bg-yellow-100 text-yellow-700',
  bloqueado: 'bg-red-100 text-red-700',
};

export default function AuditoriaResultado({ auditoria }) {
  if (!auditoria) return null;
  const c = auditoria.classificacao || {};

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase ${STATUS_CLS[auditoria.status_final] || 'bg-gray-100 text-gray-600'}`}>
          {auditoria.status_final}
        </span>
        {auditoria.valor_causa && (
          <span className="text-[#3c4043]">Valor da causa: <strong>{auditoria.valor_causa}</strong></span>
        )}
      </div>

      <div className="bg-[#f8f9fa] rounded-lg p-4">
        <p className="text-xs font-semibold text-[#5f6368] uppercase mb-1">Classificação</p>
        <p><strong>Template sugerido:</strong> {c.template_sugerido || '—'} {c.confianca != null && `(confiança ${(c.confianca * 100).toFixed(0)}%)`}</p>
        {c.categoria && <p><strong>Categoria:</strong> {c.categoria}</p>}
        {c.justificativa && <p className="text-[#5f6368] mt-1">{c.justificativa}</p>}
      </div>

      {auditoria.resumo_para_advogado && (
        <div className="bg-[#e8f0fe] rounded-lg p-4 text-[#202124]">
          <p className="text-xs font-semibold text-[#1a73e8] uppercase mb-1">Resumo para o advogado</p>
          {auditoria.resumo_para_advogado}
        </div>
      )}

      {auditoria.inconsistencias?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#5f6368] uppercase mb-2">Inconsistências</p>
          <div className="space-y-2">
            {auditoria.inconsistencias.map((inc, i) => (
              <div key={i} className={`border rounded-lg p-3 ${SEV_CLS[inc.severidade] || SEV_CLS.INFO}`}>
                <p className="font-semibold text-xs">{inc.severidade} {inc.campo && `— ${inc.campo}`}</p>
                <p>{inc.descricao}</p>
                {inc.sugestao && <p className="text-xs mt-1 opacity-80">Sugestão: {inc.sugestao}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {auditoria.documentos?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#5f6368] uppercase mb-2">Documentos</p>
          <div className="space-y-1">
            {auditoria.documentos.map((d, i) => (
              <p key={i} className="text-[#3c4043]">
                {d.presente ? '✅' : '❌'} <strong>{d.tipo}</strong>
                {d.periodo && ` — ${d.periodo}`}
                {d.valores_extraidos && <span className="text-[#5f6368]"> · {d.valores_extraidos}</span>}
              </p>
            ))}
          </div>
        </div>
      )}

      {auditoria.teses_incluidas?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#5f6368] uppercase mb-2">Teses incluídas</p>
          {auditoria.teses_incluidas.map((t, i) => (
            <div key={i} className="border border-[#dadce0] rounded-lg p-3 mb-2">
              <p className="font-medium">{t.tese}</p>
              <p className="text-xs text-[#5f6368]">{t.fundamento}</p>
              {t.evidencia && <p className="text-xs text-[#5f6368] mt-0.5">Evidência: {t.evidencia}</p>}
            </div>
          ))}
        </div>
      )}

      {auditoria.teses_excluidas?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#5f6368] uppercase mb-1">Teses excluídas</p>
          {auditoria.teses_excluidas.map((t, i) => (
            <p key={i} className="text-[#5f6368]">• {t.tese} — {t.motivo}</p>
          ))}
        </div>
      )}

      {auditoria.pendencias?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#5f6368] uppercase mb-1">Pendências</p>
          {auditoria.pendencias.map((p, i) => (
            <p key={i} className="text-yellow-700">⚠ {p}</p>
          ))}
        </div>
      )}
    </div>
  );
}