import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import TarefasFilaList from '@/components/historico/TarefasFilaList';
import DocumentosExportadosList from '@/components/historico/DocumentosExportadosList';

export default function Historico() {
  const [tab, setTab] = useState('documentos');
  const [jobs, setJobs] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    const [j, d] = await Promise.all([
      base44.entities.JobQueue.list('-created_date', 100).catch(() => []),
      base44.entities.DocumentoExportado.list('-created_date', 100).catch(() => []),
    ]);
    setJobs(j);
    setDocumentos(d);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[#dadce0] bg-white flex-shrink-0">
        <Link to="/trabalhista/gerar-entrevista" className="text-[#5f6368] hover:text-[#202124]" title="Voltar">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-[#202124]">Histórico</h1>
          <p className="text-xs text-[#5f6368]">Tarefas da fila e documentos DOCX exportados.</p>
        </div>
        <button
          onClick={carregar}
          className="p-2 text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] rounded-full"
          title="Atualizar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-1 px-6 pt-3 bg-white border-b border-[#dadce0] flex-shrink-0">
        {[['documentos', 'Documentos exportados'], ['tarefas', 'Tarefas da fila']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === key
                ? 'border-[#1a73e8] text-[#1a73e8]'
                : 'border-transparent text-[#5f6368] hover:text-[#202124]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-[#1a73e8]" />
          </div>
        ) : tab === 'documentos' ? (
          <DocumentosExportadosList documentos={documentos} />
        ) : (
          <TarefasFilaList jobs={jobs} />
        )}
      </div>
    </div>
  );
}