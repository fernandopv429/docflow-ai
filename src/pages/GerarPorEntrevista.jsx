import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Paperclip, Send, X, FileText, Bot, FileDown, Library, RefreshCw, Wrench,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { exportToDocx } from '@/lib/exportDocx';
import { TIPO_DISPENSA_LABELS } from '@/lib/trabalhista/tokens';
import { formatBRL } from '@/lib/trabalhista/mathUtils';
import {
  carregarModeloPadrao,
  conversarEntrevista,
  gerarPecaPadrao,
  verificarCoerencia,
} from '@/lib/trabalhista/modelosReferencia';

export default function GerarPorEntrevista() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [allUrls, setAllUrls] = useState([]);
  const [modeloPadrao, setModeloPadrao] = useState(null);
  const [attrs, setAttrs] = useState(null);
  const [comTimbrado, setComTimbrado] = useState(true);

  // Documento vivo (painel à direita)
  const [docHtml, setDocHtml] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    carregarModeloPadrao().then(setModeloPadrao).catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending, generating]);

  const userText = messages.filter((m) => m.role === 'user').map((m) => m.text).filter(Boolean).join('\n\n');

  const gerarMinuta = async (opts = {}) => {
    if (!modeloPadrao || generating) return;
    setGenerating(true);
    setMessages((m) => [...m, { role: 'tool', text: `Usando modelo padrão: ${modeloPadrao.titulo}` }]);
    try {
      const geracaoTexto = opts.texto ?? userText;
      const { html, dadosReceita, calculos, caso } = await gerarPecaPadrao({
        texto: geracaoTexto,
        fileUrls: opts.urls ?? allUrls,
        attrs: opts.attrs ?? attrs,
        modeloPadrao,
        onTool: (msg) => setMessages((m) => [...m, { role: 'tool', text: msg }]),
      });
      setDocHtml(html);
      const verificados = (dadosReceita || []).filter((d) => !d.erro);
      let nota = docHtml
        ? 'Documento atualizado com base no modelo padrão. Veja as mudanças ao lado.'
        : 'Minuta gerada com base no modelo padrão. Veja o documento ao lado.';
      if (verificados.length) {
        nota += ` CNPJ(s) confirmado(s) na Receita: ${verificados.map((d) => `${d.razao_social} (${d.cnpj})`).join('; ')}.`;
      }
      const comValor = (calculos || []).filter((c) => c.valor != null);
      if (comValor.length) {
        nota += `\n\nCálculos determinísticos (por código, sem IA):\n${comValor.map((c) => `• ${c.item}: ${formatBRL(c.valor)}`).join('\n')}`;
      }
      setMessages((m) => [...m, { role: 'assistant', text: nota }]);

      // Verificação de coerência jurídica da minuta (LLM audita, não reescreve)
      setMessages((m) => [...m, { role: 'tool', text: 'Verificando coerência jurídica da minuta...' }]);
      try {
        const verif = await verificarCoerencia({ texto: geracaoTexto, caso, html });
        const alertas = verif?.alertas || [];
        const icone = { BLOQUEANTE: '⛔', ATENCAO: '⚠️', INFO: 'ℹ️' };
        const cabecalho = `Verificação de coerência — status: ${verif?.status || 'concluída'}.`;
        const corpo = alertas.length
          ? '\n' + alertas.map((a) => `${icone[a.severidade] || '•'} ${a.descricao}${a.sugestao ? ` — ${a.sugestao}` : ''}`).join('\n')
          : ' Nenhum problema aparente. A revisão humana do advogado continua obrigatória.';
        setMessages((m) => [...m, { role: 'assistant', text: cabecalho + corpo }]);
      } catch (e) {
        console.error(e);
      }
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
    const novasMsgs = [...messages, { role: 'user', text, files: attached.map((f) => f.name) }];
    setMessages(novasMsgs);
    setInput('');
    setFiles([]);
    setSending(true);
    try {
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

      const transcript = novasMsgs
        .filter((m) => m.role !== 'tool')
        .map((m) => ({ role: m.role, text: m.text || '' }));
      const modelosCtx = modeloPadrao ? [{ titulo: modeloPadrao.titulo, teses: [] }] : [];
      const res = await conversarEntrevista({ transcript, fileUrls: urls, modelos: modelosCtx });

      const novoAttrs = { ...(attrs || {}), ...(res?.atributos || {}) };
      setAttrs(novoAttrs);
      setMessages((m) => [...m, { role: 'assistant', text: res?.reply || 'Certo.' }]);

      // Inicia a geração/atualização da minuta automaticamente após cada envio
      const textoCompleto = novasMsgs
        .filter((m) => m.role === 'user')
        .map((m) => m.text)
        .filter(Boolean)
        .join('\n\n');
      await gerarMinuta({ texto: textoCompleto, urls, attrs: novoAttrs });
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

  const exportar = async () => {
    if (!docHtml) return;
    try {
      await exportToDocx(docHtml, null, 'Minuta - petição inicial', { comTimbrado });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[#dadce0] bg-white flex-shrink-0">
        <Link to="/modelos" className="text-[#5f6368] hover:text-[#202124]" title="Modelos / Configurações">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-[#202124]">Gerar por Entrevista</h1>
          <p className="text-xs text-[#5f6368] truncate">
            Converse à esquerda; a minuta aparece e se atualiza à direita.
          </p>
        </div>
        <Link to="/modelos" className="flex items-center gap-1.5 text-xs text-[#1a73e8] hover:underline whitespace-nowrap">
          <Library className="w-3.5 h-3.5" /> Configurações
        </Link>
      </div>

      {/* Barra do modelo padrão */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-2 border-b border-[#f1f3f4] bg-white flex-shrink-0">
        <span className="text-xs text-[#5f6368]">Modelo padrão:</span>
        <span className="text-xs font-medium text-[#202124] truncate max-w-[420px]">
          {modeloPadrao?.titulo || 'carregando...'}
        </span>
        {attrs && (attrs.funcao || attrs.tipo_dispensa) && (
          <span className="text-[11px] text-[#9aa0a6]">
            {attrs.funcao || '—'} · {TIPO_DISPENSA_LABELS[attrs.tipo_dispensa]?.split('(')[0]?.trim() || attrs.tipo_dispensa || '—'}
          </span>
        )}
        {generating && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-[#1a73e8]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando minuta...
          </span>
        )}
      </div>

      {/* Corpo: chat (esq) + documento (dir) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Chat */}
        <div className="flex flex-col min-h-0 lg:w-[420px] lg:flex-shrink-0 lg:border-r border-[#dadce0]">
          <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
            <div className="space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-10">
                  <Bot className="w-8 h-8 text-[#dadce0] mx-auto mb-2" />
                  <p className="text-sm text-[#5f6368]">
                    Descreva o caso ou cole a entrevista.
                    <br />Pode anexar documentos e enviar mais informações a qualquer momento.
                  </p>
                </div>
              )}
              {messages.map((m, i) =>
                m.role === 'tool' ? (
                  <div key={i} className="flex justify-start">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[#f1f3f4] border border-[#e8eaed] rounded-full text-[11px] text-[#5f6368]">
                      <Wrench className="w-3 h-3 text-[#1a73e8] flex-shrink-0" />
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[88%] px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-[#1a73e8] text-white rounded-br-sm'
                          : 'bg-white border border-[#dadce0] text-[#3c4043] rounded-bl-sm'
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
                      {m.text}
                    </div>
                  </div>
                )
              )}
              {(sending || generating) && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 px-3.5 py-2 bg-white border border-[#dadce0] rounded-2xl rounded-bl-sm text-sm text-[#5f6368]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#1a73e8]" />
                    {generating ? 'Redigindo o documento...' : 'Pensando...'}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          {/* Barra de entrada */}
          <div className="flex-shrink-0 border-t border-[#dadce0] bg-white px-3 py-3">
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
                placeholder="Descreva o caso, peça um ajuste ou envie documentos..."
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
          </div>
        </div>

        {/* Documento */}
        <div className="flex flex-col min-h-0 flex-1 bg-[#f1f3f4]">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#dadce0] bg-white flex-shrink-0">
            <FileText className="w-4 h-4 text-[#1a73e8]" />
            <span className="text-sm font-medium text-[#202124] truncate flex-1">Minuta</span>
            {generating && (
              <span className="flex items-center gap-1 text-[11px] text-[#1a73e8]">
                <RefreshCw className="w-3 h-3 animate-spin" /> atualizando
              </span>
            )}
            <label className="flex items-center gap-1.5 text-xs text-[#3c4043] cursor-pointer select-none ml-2">
              <input type="checkbox" checked={comTimbrado} onChange={(e) => setComTimbrado(e.target.checked)} className="w-4 h-4 accent-[#1a73e8]" />
              Timbrado
            </label>
            <button
              onClick={exportar}
              disabled={!docHtml}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a73e8] text-white rounded-lg text-xs font-medium hover:bg-[#1557b0] transition-colors disabled:opacity-40"
            >
              <FileDown className="w-3.5 h-3.5" /> Exportar DOCX
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 lg:p-8 min-h-0 relative">
            {docHtml ? (
              <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-[#dadce0] px-8 py-10">
                <div
                  className={`text-[15px] text-[#202124] leading-relaxed transition-opacity duration-300 [&_h1]:font-semibold [&_h2]:font-semibold [&_h2]:text-base [&_h2]:mt-5 [&_h2]:mb-2 [&_p]:my-2.5 [&_p]:text-justify ${generating ? 'opacity-40' : 'opacity-100'}`}
                  dangerouslySetInnerHTML={{ __html: docHtml }}
                />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <FileText className="w-10 h-10 text-[#dadce0] mb-3" />
                <p className="text-sm text-[#5f6368]">A minuta aparecerá aqui.</p>
                <p className="text-xs text-[#9aa0a6] mt-1">Envie a entrevista à esquerda — a minuta será gerada automaticamente.</p>
              </div>
            )}
            {generating && docHtml && (
              <div className="absolute inset-0 flex items-start justify-center pt-10 pointer-events-none">
                <span className="flex items-center gap-2 px-3 py-1.5 bg-white/90 border border-[#dadce0] rounded-full text-xs text-[#1a73e8] shadow-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Atualizando o documento...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}