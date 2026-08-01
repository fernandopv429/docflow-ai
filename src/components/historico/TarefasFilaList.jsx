import React from 'react';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

const STATUS = {
  pending: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
  processing: { label: 'Processando', cls: 'bg-blue-50 text-blue-700 border-blue-200', Icon: Loader2 },
  completed: { label: 'Concluída', cls: 'bg-green-50 text-green-700 border-green-200', Icon: CheckCircle2 },
  failed: { label: 'Falhou', cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
};

export default function TarefasFilaList({ jobs }) {
  if (!jobs.length) {
    return <p className="text-sm text-[#5f6368] text-center py-10">Nenhuma tarefa na fila ainda.</p>;
  }
  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const s = STATUS[job.status] || STATUS.pending;
        return (
          <div key={job.id} className="bg-white border border-[#dadce0] rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-[#202124]">{job.taskType}</span>
              <span className={`flex items-center gap-1 px-2 py-0.5 border rounded-full text-[11px] font-medium ${s.cls}`}>
                <s.Icon className={`w-3 h-3 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
                {s.label}
              </span>
              <span className="ml-auto text-[11px] text-[#9aa0a6]">
                {new Date(job.created_date).toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-[#5f6368]">
              Tentativas: {job.attempts || 0}/{job.maxAttempts || 3}
              {job.error && <span className="text-red-600"> · Erro: {job.error}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}