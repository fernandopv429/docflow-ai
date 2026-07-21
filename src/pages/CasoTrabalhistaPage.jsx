import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, FileSearch, ShieldCheck, FileDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';
import { validarCaso, deriveTokens } from '@/lib/trabalhista/tokens';
import { analisarDocumentos, auditarCaso } from '@/lib/trabalhista/pipeline';
import AuditoriaResultado from '@/components/trabalhista/AuditoriaResultado';
import GerarDocxSection from '@/components/trabalhista/GerarDocxSection';

const Step = ({ icon: Icon, num, title, children }) => (
  <section className="bg-white border border-[#dadce0] rounded-xl p-5">
    <h2 className="flex items-center gap-2 font-semibold text-[#202124] text-sm mb-3">
      <span className="w-6 h-6 flex items-center justify-center bg-[#e8f0fe] text-[#1a73e8] text-xs font-bold rounded-full">{num}</span>
      <Icon className="w-4 h-4 text-[#1a73e8]" />
      {title}
    </h2>
    {children}
  </section>
);

export default function CasoTrabalhistaPage() {
  const { id } = useParams();
  const [caso, setCaso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rodando, setRodando] = useState(null); // 'analise' | 'auditoria'
  const [erro, setErro] = useState(null);

  const recarregar = () =>
    base44.entities.CasoTrabalhista.get(id).then(setCaso);

  useEffect(() => {
    recarregar().catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const rodar = async (passo, fn) => {
    setRodando(passo);
    setErro(null);
    try {
      await fn(caso);
      await recarregar();
    } catch (err) {
      console.error(err);
      setErro('Erro ao executar o passo. Tente novamente.');
    }
    setRodando(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-[#1a73e8] animate-spin" />
      </div>
    );
  }
  if (!caso) return <div className="p-8 text-center text-[#5f6368]">Caso não encontrado</div>;

  const pendencias = validarCaso(caso);
  const tokens = deriveTokens(caso);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        <div className="flex items-center gap-3">
          <Link to="/trabalhista" className="text-[#5f6368] hover:text-[#202124]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-[#202124]">{caso.titulo}</h1>
            <p className="text-xs text-[#5f6368]">
              {caso.recl_nome} × {caso.recl1_nome} — {tokens.COMARCA_UF} ({tokens.REGIAO_TRT || 'TRT não derivado'})
              {caso.document_names?.length > 0 && ` · ${caso.document_names.length} documento(s)`}
            </p>
          </div>
        </div>

        {pendencias.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-yellow-800 uppercase mb-1">Validações pendentes</p>
            {pendencias.map((p, i) => (
              <p key={i} className="text-sm text-yellow-700">⚠ {p}</p>
            ))}
          </div>
        )}

        {erro && <p className="text-sm text-red-500">{erro}</p>}

        <Step icon={FileSearch} num="1" title="Análise Documental (Laudo Técnico)">
          <button
            onClick={() => rodar('analise', analisarDocumentos)}
            disabled={!!rodando}
            className="flex items-center gap-2 px-4 py-2 border border-[#1a73e8] text-[#1a73e8] rounded-lg text-sm font-medium hover:bg-[#e8f0fe] transition-colors disabled:opacity-50"
          >
            {rodando === 'analise' && <Loader2 className="w-4 h-4 animate-spin" />}
            {rodando === 'analise' ? 'Analisando documentos...' : caso.analise_laudo ? 'Refazer análise' : 'Analisar documentos'}
          </button>
          {caso.analise_laudo && (
            <div className="mt-4 text-sm text-[#202124] leading-relaxed border-t border-[#f1f3f4] pt-4 [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold">
              <ReactMarkdown>{caso.analise_laudo}</ReactMarkdown>
            </div>
          )}
        </Step>

        <Step icon={ShieldCheck} num="2" title="Auditoria Estruturada (Especialista #58)">
          <button
            onClick={() => rodar('auditoria', auditarCaso)}
            disabled={!!rodando}
            className="flex items-center gap-2 px-4 py-2 border border-[#1a73e8] text-[#1a73e8] rounded-lg text-sm font-medium hover:bg-[#e8f0fe] transition-colors disabled:opacity-50"
          >
            {rodando === 'auditoria' && <Loader2 className="w-4 h-4 animate-spin" />}
            {rodando === 'auditoria' ? 'Auditando...' : caso.analise_json ? 'Refazer auditoria' : 'Auditar caso'}
          </button>
          {caso.analise_json && (
            <div className="mt-4 border-t border-[#f1f3f4] pt-4">
              <AuditoriaResultado auditoria={caso.analise_json} />
            </div>
          )}
        </Step>

        <Step icon={FileDown} num="3" title="Geração do DOCX">
          {caso.analise_json?.status_final === 'bloqueado' ? (
            <p className="text-sm text-red-600">
              Auditoria com status BLOQUEADO — corrija as inconsistências bloqueantes antes de gerar.
            </p>
          ) : (
            <GerarDocxSection caso={caso} onGerado={recarregar} />
          )}
        </Step>
      </div>
    </div>
  );
}