import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, Loader2, FileText, X, Bot } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { saveAnalysis, loadAnalysis } from '@/lib/analysisCache';
import { prepareFileForUpload } from '@/lib/compressImage';
import { buildAnalysisRequest } from '@/lib/analysisPrompt';

export default function AnalysisChat({ variables, skill, webSearch, searchSites, templateId, onResults }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [allUrls, setAllUrls] = useState(() => loadAnalysis(templateId)?.urls || []);
  const [accValues, setAccValues] = useState(() => loadAnalysis(templateId)?.values || {});
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, analyzing]);

  const handleSend = async () => {
    if (analyzing || (!input.trim() && files.length === 0)) return;
    const text = input.trim();
    const attached = files;
    setMessages((m) => [...m, { role: 'user', text, files: attached.map((f) => f.name) }]);
    setInput('');
    setFiles([]);
    setAnalyzing(true);
    try {
      const newUrls = await Promise.all(
        attached.map(async (f) => {
          const prepared = await prepareFileForUpload(f);
          const { file_url } = await base44.integrations.Core.UploadFile({ file: prepared });
          return file_url;
        })
      );
      const urls = [...allUrls, ...newUrls];
      setAllUrls(urls);

      const result = await base44.integrations.Core.InvokeLLM(
        buildAnalysisRequest({ variables, skill, webSearch, searchSites, fileUrls: urls, pastedText: text })
      );
      const { _fontes, ...vals } = result || {};
      const nonEmpty = Object.fromEntries(
        Object.entries(vals).filter(([, v]) => v !== '' && v != null)
      );
      const merged = { ...accValues, ...nonEmpty };
      setAccValues(merged);
      saveAnalysis(templateId, merged, urls);
      onResults?.(merged, urls);

      let reply = `Preenchi ${Object.keys(nonEmpty).length} de ${variables.length} variáveis.`;
      if (_fontes?.trim()) reply += `\n\nFontes consultadas:\n${_fontes.trim()}`;
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', text: 'Erro ao analisar. Tente novamente.' }]);
    }
    setAnalyzing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col border border-[#dadce0] rounded-lg overflow-hidden bg-white">
      {/* Messages */}
      <div className="max-h-72 min-h-[120px] overflow-y-auto px-3 py-3 space-y-3 bg-[#f8f9fa]">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <Bot className="w-7 h-7 text-[#dadce0] mx-auto mb-1.5" />
            <p className="text-xs text-[#5f6368]">
              Envie documentos ou cole informações aqui.
              <br />A IA analisa e preenche as variáveis.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-xs whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-[#1a73e8] text-white rounded-br-sm'
                  : 'bg-white border border-[#dadce0] text-[#3c4043] rounded-bl-sm'
              }`}
            >
              {m.files?.length > 0 && (
                <div className="mb-1 space-y-0.5">
                  {m.files.map((name, j) => (
                    <div key={j} className="flex items-center gap-1 text-[11px] opacity-90">
                      <FileText className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{name}</span>
                    </div>
                  ))}
                </div>
              )}
              {m.text}
            </div>
          </div>
        ))}
        {analyzing && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-[#dadce0] rounded-xl rounded-bl-sm text-xs text-[#5f6368]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1a73e8]" />
              Analisando...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Attached files */}
      {files.length > 0 && (
        <div className="px-3 pt-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1 px-2 py-1 bg-[#e8f0fe] text-[#1a73e8] text-[11px] rounded-md">
              <FileText className="w-3 h-3" />
              <span className="max-w-[120px] truncate">{f.name}</span>
              <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-end gap-1.5 px-2 py-2 border-t border-[#f1f3f4]">
        <label className="p-2 text-[#5f6368] hover:bg-[#f1f3f4] rounded-full cursor-pointer" title="Anexar documento (PDF, PNG, JPG)">
          <Paperclip className="w-4 h-4" />
          <input
            type="file"
            multiple
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => {
              setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
              e.target.value = '';
            }}
          />
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Cole informações ou peça uma análise..."
          rows={1}
          className="flex-1 px-2 py-2 text-xs bg-transparent resize-none focus:outline-none max-h-24"
        />
        <button
          onClick={handleSend}
          disabled={analyzing || (!input.trim() && files.length === 0)}
          className="p-2 bg-[#1a73e8] text-white rounded-full hover:bg-[#1557b0] transition-colors disabled:opacity-40"
          title="Enviar"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}