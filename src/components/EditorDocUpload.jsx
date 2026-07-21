import React, { useState, useEffect } from 'react';
import { MessageSquare, Loader2, Download } from 'lucide-react';
import { exportToDocx } from '@/lib/exportDocx';
import { loadAnalysis } from '@/lib/analysisCache';
import AnalysisChat from '@/components/AnalysisChat';

export default function EditorDocUpload({ variables, skill, webSearch, searchSites, content, title, templateId }) {
  const [expanded, setExpanded] = useState(true);
  const [values, setValues] = useState({});
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cached = loadAnalysis(templateId);
    if (cached && Object.keys(cached.values || {}).length > 0) {
      setValues(cached.values);
    }
  }, [templateId]);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await exportToDocx(content, values, title || 'documento', { comTimbrado: true });
    } catch (err) {
      setError('Erro ao exportar documento');
    }
    setExporting(false);
  };

  const hasResults = Object.keys(values).length > 0;

  return (
    <div className="border-b border-[#dadce0]">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-2 w-full px-5 py-3 text-left hover:bg-[#f8f9fa] transition-colors"
      >
        <MessageSquare className="w-4 h-4 text-[#1a73e8]" />
        <span className="font-semibold text-[#202124] text-sm flex-1">Chat de Análise</span>
      </button>

      {expanded && (
        <div className="px-5 pb-4">
          <AnalysisChat
            variables={variables}
            skill={skill}
            webSearch={webSearch}
            searchSites={searchSites}
            templateId={templateId}
            onResults={(vals) => setValues(vals)}
          />

          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

          {hasResults && (
            <div className="mt-3">
              <p className="text-xs font-medium text-[#3c4043] mb-2">Valores extraídos:</p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {variables.map((v) => (
                  <div key={v.name}>
                    <span className="text-[11px] font-mono text-[#1a73e8]">{`{{${v.name}}}`}</span>
                    <input
                      type="text"
                      value={values[v.name] || ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                      className="w-full mt-0.5 px-2.5 py-1.5 text-xs border border-[#dadce0] rounded-md focus:outline-none focus:border-[#1a73e8]"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center justify-center gap-2 w-full mt-2.5 px-4 py-2 border border-[#1a73e8] text-[#1a73e8] rounded-lg text-xs font-medium hover:bg-[#e8f0fe] transition-colors disabled:opacity-50"
              >
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {exporting ? 'Exportando...' : 'Exportar DOCX preenchido'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}