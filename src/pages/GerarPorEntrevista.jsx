import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Paperclip, Send, X, FileText, Bot, Wand2, FileDown, Library,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { exportToDocx } from '@/lib/exportDocx';
import { TIPO_DISPENSA_LABELS } from '@/lib/trabalhista/tokens';
import {
  listarModelosAtivos,
  conversarEntrevista,
  rankearModelos,
  gerarPeca,
} from '@/lib/trabalhista/modelosReferencia';

export default function GerarPorEntrevista() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [allUrls, setAllUrls] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [attrs, setAttrs] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [modeloId, setModeloId] = useState('');
  const [comTimbrado, setComTimbrado] = useState(true);

  const endRef = useRef(null);

  useEffect(() => {
    listarModelosAtivos().then(setModelos).catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending, generating]);

  const modeloAtual = modelos.find((m) => m.id === modeloId);
  const userText = messages.filter((m) => m.role === 'user').map((m) => m.text).filter(Boolean).join('\n\n');

  const gerarMinuta = async (modeloAlvo) => {
    const modelo = modeloAlvo || modeloAtual;
    if (!modelo || generating || sending) return;
    setGenerating(true);
    try {
      const { html, dadosReceita } = await gerarPeca({ texto: userText, fileUrls: allUrls, attrs, modelo });
      const verificados = (dadosReceita || []).filter((d) => !d.erro);
      let nota = `Minuta gerada com base no modelo "${modelo.titulo}".`;
      if (verificados.length) {
        nota += ` CNPJ(s) confirmado(s) na Receita: ${verificados.map((d) => `${d.razao_social} (${d.cnpj})`).join('; ')}.`;
      }
      setMessages((m) => [...m, { role: 'assistant', text: nota, html }]);
    } catch (err) {
      console.error(err);
      setMessages((m) => [...m, { role: 'assistant', text: 'Erro ao gerar a minuta. Tente novamente.' }]);
    }
    setGenerating(false);
  };

  const handleSend = async () => {
    if (sending || generating || (!input.trim() && files.length === 0)) return;
    const text = input.trim();
    const attached = files;
    const userMsg = { role: 'user', text, files: attached.map((f) => f.name) };
    const novasMsgs = [...messages, userMsg];
    setMessages(novasMsgs);
    setInput('');
    setFiles([]);
    setSending(true);
    try {
      // Upload de anexos
      let urls = allUrls;
      if (attached.length) {
        const novos = [];
        for (const file of attached) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          novos.push(file_url);
        }
        urls = [...allUrls, ...novos];
        setAllUrls(urls);
      }

      const transcript = novasMsgs.map((m) => ({
        role: m.role,
        text: m.text || (m.html ? '[minuta gerada anteriormente]' : ''),
      }));

      const res = await conversarEntrevista({ transcript, fileUrls: urls, modelos });

      // Atualiza atributos e ranking
      const novosAttrs = { ...(attrs || {}), ...(res?.atributos || {}) };
      setAttrs(novosAttrs);
      const rk = rankearModelos(modelos, novosAttrs);
      setRanking(rk);
      const topId = rk[0]?.modelo?.id || modeloId;
      if (topId) setModeloId(topId);

      setMessages((m) => [...m, { role: 'assistant', text: res?.reply || 'Certo.' }]);

      if (res?.pronto_para_gerar) {
        const alvo = modelos.find((mm) => mm.id === topId);
        if (alvo) await gerarMinuta(alvo);
      }
    } catch (err) {
      console.error(err);
      setMessages((m) => [...m, { role: 'assistant', text: 'Erro ao processar. Tente novamente.' }]);
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const exportar = async (html) => {
    try {
      await exportToDocx(html, null, 'Minuta - petição inicial', { comTimbrado });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[#dadce0] bg-white flex-shrink-0">
        <Link to="/trabalhista" className="text-[#5f6368] hover:text-[#202124]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-[#202124]">Gerar por Entrevista</h1>
          <p className="text-xs text-[#5f6368] truncate">
            Converse, envie documentos e gere a minuta com base no modelo mais aderente.
          </p>
        </div>
        <Link to="/modelos" className="flex items-center gap-1.5 text-xs text-[#1a73e8] hover:underline whitespace-nowrap">
          <Library className="w-3.5 h-3.5" /> Modelos
        </Link>
      </div>

      {/* Barra do modelo selecionado */}
      {ranking.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-6 py-2 border-b border-[#f1f3f4] bg-white flex-shrink-0">
          <span className="text-xs text-[#5f6368]">Modelo:</span>
          <select
            value={modeloId}
            onChange={(e) => setModeloId(e.target.value)}
            className="text-xs border border-[#dadce0] rounded-md px-2 py-1 bg-white max-w-[380px] focus:outline-none focus:border-[#1a73e8]"
          >
            {ranking.map(({ modelo, score }) => (
              <option key={modelo.id} value={modelo.id}>
                {modelo.titulo} ({score} pts{!modelo.arquivo_url ? ', sem DOCX' : ''})
              </option>
            ))}
          </select>
          {attrs && (
            <span className="text-[11px] text-[#9aa0a6]">
              {attrs.funcao || '—'} · {TIPO_DISPENSA_LABELS[attrs.tipo_dispensa]?.split('(')[0]?.trim() || attrs.tipo_dispensa || '—'} · {attrs.rito || '—'}
            </span>
          )}
          <button
            onClick={() => gerarMinuta()}
            disabled={!modeloId || sending || generating}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#1a73e8] text-white rounded-lg text-xs font-medium hover:bg-[#1557b0] transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            Gerar minuta
          </button>
        </div>
      )}

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Bot className="w-9 h-9 text-[#dadce0] mx-auto mb-2" />
              <p className="text-sm text-[#5f6368]">
                Descreva o caso ou cole a entrevista do cliente.
                <br />Você pode anexar documentos e enviar mais informações a qualquer momento.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'max-w-[80%] bg-[#1a73e8] text-white rounded-br-sm'
                    : m.html
                      ? 'w-full bg-white border border-[#dadce0] text-[#3c4043] rounded-bl-sm'
                      : 'max-w-[80%] bg-white border border-[#dadce0] text-[#3c4043] rounded-bl-sm'
                }`}
              >
                {m.files?.length > 0 && (
                  <div className="mb-1.5 space-y-0.5">
                    {m.files.map((name, j) => (
                      <div key={j} className="flex items-center gap-1 text-[12px] opacity-90">
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {m.text && <p>{m.text}</p>}
                {m.html && (
                  <div className="mt-3">
                    <div className="flex items-center justify-end gap-3 mb-2">
                      <label className="flex items-center gap-1.5 text-xs text-[#3c4043] cursor-pointer select-none">
                        <input type="checkbox" checked={comTimbrado} onChange={(e) => setComTimbrado(e.target.checked)} className="w-4 h-4 accent-[#1a73e8]" />
                        Timbrado
                      </label>
                      <button
                        onClick={() => exportar(m.html)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a73e8] text-white rounded-lg text-xs font-medium hover:bg-[#1557b0] transition-colors"
                      >
                        <FileDown className="w-3.5 h-3.5" /> Exportar DOCX
                      </button>
                    </div>
                    <div
                      className="text-sm text-[#202124] leading-relaxed border-t border-[#f1f3f4] pt-3 max-h-[520px] overflow-y-auto [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1 [&_p]:my-2 [&_p]:text-justify"
                      dangerouslySetInnerHTML={{ __html: m.html }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
          {(sending || generating) && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#dadce0] rounded-2xl rounded-bl-sm text-sm text-[#5f6368]">
                <Loader2 className="w-4 h-4 animate-spin text-[#1a73e8]" />
                {generating ? 'Gerando minuta...' : 'Pensando...'}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Barra de entrada */}
      <div className="flex-shrink-0 border-t border-[#dadce0] bg-white px-4 py-3">
        <div className="max-w-3xl mx-auto">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {files.map((f, i) => (
                <span key={i} className="flex items-center gap-1 px-2 py-1 bg-[#e8f0fe] text-[#1a73e8] text-[11px] rounded-md">
                  <FileText className="w-3 h-3" />
                  <span className="max-w-[140px] truncate">{f.name}</span>
                  <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1.5 border border-[#dadce0] rounded-2xl px-2 py-1.5 focus-within:border-[#1a73e8] transition-colors">
            <label className="p-2 text-[#5f6368] hover:bg-[#f1f3f4] rounded-full cursor-pointer" title="Anexar documento">
              <Paperclip className="w-4 h-4" />
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.docx,.txt"
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
              placeholder="Descreva o caso, cole a entrevista ou envie documentos..."
              rows={1}
              className="flex-1 px-1 py-2 text-sm bg-transparent resize-none focus:outline-none max-h-40"
            />
            <button
              onClick={handleSend}
              disabled={sending || generating || (!input.trim() && files.length === 0)}
              className="p-2 bg-[#1a73e8] text-white rounded-full hover:bg-[#1557b0] transition-colors disabled:opacity-40"
              title="Enviar"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-[#9aa0a6] mt-1.5 text-center">
            A minuta é gerada por IA a partir de um modelo de referência — revisão obrigatória do advogado.
          </p>
        </div>
      </div>
    </div>
  );
}
