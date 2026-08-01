import React from 'react';
import { FileText, Download } from 'lucide-react';

function formatarTamanho(bytes) {
  if (!bytes) return '';
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default function DocumentosExportadosList({ documentos }) {
  if (!documentos.length) {
    return (
      <p className="text-sm text-[#5f6368] text-center py-10">
        Nenhum documento exportado ainda. Ao exportar um DOCX, uma cópia ficará salva aqui.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {documentos.map((doc) => (
        <div key={doc.id} className="flex items-center gap-3 bg-white border border-[#dadce0] rounded-lg px-4 py-3">
          <FileText className="w-5 h-5 text-[#1a73e8] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#202124] truncate">{doc.titulo}</p>
            <p className="text-[11px] text-[#9aa0a6]">
              {new Date(doc.created_date).toLocaleString('pt-BR')}
              {doc.tamanho_bytes ? ` · ${formatarTamanho(doc.tamanho_bytes)}` : ''}
            </p>
          </div>
          <a
            href={doc.file_url}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1a73e8] text-[#1a73e8] rounded-lg text-xs font-medium hover:bg-[#e8f0fe] transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Baixar
          </a>
        </div>
      ))}
    </div>
  );
}