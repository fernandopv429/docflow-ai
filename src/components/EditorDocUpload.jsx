import React, { useState, useEffect } from 'react';
import { Upload, FileText, X, Sparkles, Loader2, Download } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { exportToDocx } from '@/lib/exportDocx';
import { saveAnalysis, loadAnalysis } from '@/lib/analysisCache';
import { prepareFileForUpload } from '@/lib/compressImage';
import { buildAnalysisRequest } from '@/lib/analysisPrompt';
import AnalysisSources from '@/components/AnalysisSources';

export default function EditorDocUpload({ variables, skill, webSearch, searchSites, content, title, templateId }) {
  const [expanded, setExpanded] = useState(true);
  const [files, setFiles] = useState([]);
  const [pastedText, setPastedText] = useState('');
  const [uploadedUrls, setUploadedUrls] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [values, setValues] = useState({});
  const [sources, setSources] = useState('');
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const cached = loadAnalysis(templateId);
    if (cached && Object.keys(cached.values || {}).length > 0) {
      setValues(cached.values);
      setUploadedUrls(cached.urls || []);
    }
  }, [templateId]);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selected]);
    setUploadedUrls([]);
    setValues({});
    e.target.value = '';
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadedUrls([]);
    setValues({});
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    setValues({});
    try {
      let urls = uploadedUrls;
      if (urls.length === 0 && files.length > 0) {
        urls = await Promise.all(
          files.map(async (file) => {
            const prepared = await prepareFileForUpload(file);
            const { file_url } = await base44.integrations.Core.UploadFile({ file: prepared });
            return file_url;
          })
        );
        setUploadedUrls(urls);
      }
      if (urls.length === 0 && !pastedText.trim()) {
        setError('Envie um documento ou cole um texto para análise');
        setAnalyzing(false);
        return;
      }

      const result = await base44.integrations.Core.InvokeLLM(
        buildAnalysisRequest({ variables, skill, webSearch, searchSites, fileUrls: urls, pastedText })
      );
      const { _fontes, ...vals } = result || {};
      setValues(vals);
      setSources(_fontes || '');
      saveAnalysis(templateId, vals, urls);
    } catch (err) {
      setError('Erro ao analisar documentos. Tente novamente.');
    }
    setAnalyzing(false);
  };

  const handleExport = async () => {
    setExporting(true);
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
        <Upload className="w-4 h-4 text-[#1a73e8]" />
        <span className="font-semibold text-[#202124] text-sm flex-1">Documentos para Análise</span>
        {files.length > 0 && (
          <span className="min-w-[16px] h-4 px-1 flex items-center justify-center bg-[#1a73e8] text-white text-[10px] font-medium rounded-full">
            {files.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-4">
          <label className="flex flex-col items-center justify-center gap-1.5 px-4 py-4 border-2 border-dashed border-[#dadce0] rounded-lg cursor-pointer hover:border-[#1a73e8] hover:bg-[#f8f9fa] transition-colors">
            <FileText className="w-6 h-6 text-[#5f6368]" />
            <span className="text-xs text-[#3c4043] font-medium">Clique para enviar</span>
            <span className="text-[11px] text-[#5f6368]">PDF, PNG, JPG</span>
            <input type="file" multiple accept=".pdf,image/*" onChange={handleFileChange} className="hidden" />
          </label>

          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Ou cole aqui um texto para análise..."
            rows={3}
            className="w-full mt-2 px-3 py-2 text-xs border border-[#dadce0] rounded-md resize-none focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
          />

          {files.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-[#f8f9fa] rounded-md">
                  <FileText className="w-3.5 h-3.5 text-[#5f6368] flex-shrink-0" />
                  <span className="text-xs text-[#3c4043] truncate flex-1">{f.name}</span>
                  <button onClick={() => removeFile(i)} className="text-[#5f6368] hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={analyzing || (files.length === 0 && !pastedText.trim())}
            className="flex items-center justify-center gap-2 w-full mt-2.5 px-4 py-2 bg-[#1a73e8] text-white rounded-lg text-xs font-medium hover:bg-[#1557b0] transition-colors disabled:opacity-50"
          >
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {analyzing ? 'Analisando...' : 'Analisar com IA'}
          </button>

          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

          <AnalysisSources sources={sources} />

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