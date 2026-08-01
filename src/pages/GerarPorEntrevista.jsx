import React, { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Paperclip, Send, X, FileText, Bot, FileDown, Library, RefreshCw, CheckCircle2, ScrollText, PanelLeft,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ToolTraceMessage from '@/components/ToolTraceMessage';
import SessionLogsModal from '@/components/SessionLogsModal';
import DocumentReviewPreview from '@/components/DocumentReviewPreview';
import GenerationApprovalMessage from '@/components/GenerationApprovalMessage';
import ConversasSidebar from '@/components/ConversasSidebar';
import { exportToDocx } from '@/lib/exportDocx';
import { TIPO_DISPENSA_LABELS } from '@/lib/trabalhista/tokens';
import useConsoleLogs from '@/hooks/useConsoleLogs';
import useConversaStore from '@/hooks/useConversaStore';
import { listarConversas, excluirConversa } from '@/lib/conversas';
import {
  abrirSessao,
  confirmarRevisao,
  decidirGeracao,
  enviarMensagem,
  esquecerSessao,
  getListVersion,
  getSession,
  novaSessao,
  obterModeloPadrao,
  sessoesOcupadas,
} from '@/lib/conversaStore';

export default function GerarPorEntrevista() {
  useConversaStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const chaveAtiva = searchParams.get('id');
  const [conversas, setConversas] = useState([]);
  const [modeloPadrao, setModeloPadrao] = useState(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [sidebarAberta, setSidebarAberta] = useState(true);
  const consoleLogs = useConsoleLogs();
  const [inputs, setInputs] = useState({});
  const [arquivos, setArquivos] = useState({});
  const [exporting, setExporting] = useState(false);
  const endRef = useRef(null);

  const listVersion = getListVersion();
  const sessao = getSession(chaveAtiva);
  const input = inputs[chaveAtiva] || '';
  const files = arquivos[chaveAtiva] || [];
  const ocupadas = sessoesOcupadas();

  useEffect(() => {
    obterModeloPadrao().then(setModeloPadrao);
  }, []);

  useEffect(() => {
    listarConversas().then(setConversas).catch(() => {});
  }, [listVersion]);

  // Garante que sempre existe uma sessão ativa para a chave da URL
  useEffect(() => {
    if (!chaveAtiva) {
      setSearchParams({ id: novaSessao() }, { replace: true });
      return;
    }
    if (!getSession(chaveAtiva)) abrirSessao(chaveAtiva).catch(() => {});
  }, [chaveAtiva, setSearchParams]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessao?.messages?.length, sessao?.sending, sessao?.generating, chaveAtiva]);

  const messages = sessao?.messages || [];
  const docHtml = sessao?.docHtml || '';
  const attrs = sessao?.attrs;
  const sending = sessao?.sending;
  const generating = sessao?.generating;
  const reviewConfirmed = sessao?.reviewConfirmed;

  const setInput = (valor) => setInputs((prev) => ({ ...prev, [chaveAtiva]: valor }));
  const setFiles = (fn) => setArquivos((prev) => ({ ...prev, [chaveAtiva]: fn(prev[chaveAtiva] || []) }));

  const handleSend = () => {
    if (sending || generating || (!input.trim() && files.length === 0)) return;
    const texto = input.trim();
    const anexos = files;
    setInput('');
    setFiles(() => []);
    // Não aguardamos: a conversa continua processando em segundo plano.
    enviarMensagem(chaveAtiva, { text: texto, files: anexos });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const removerConversa = async (id) => {
    await excluirConversa(id).catch(() => {});
    esquecerSessao(id);
    listarConversas().then(setConversas).catch(() => {});
    if (id === chaveAtiva || getSession(chaveAtiva) === null) setSearchParams({ id: novaSessao() });
  };

  const exportar = async () => {
    if (!docHtml || !reviewConfirmed || exporting) return;
    setExporting(true);
    try {
      const { blob } = await exportToDocx(docHtml, null, 'Minuta - petição inicial');
      const file = new File([blob], 'Minuta - petição inicial.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.DocumentoExportado.create({
        titulo: 'Minuta - petição inicial',
        file_url,
        tamanho_bytes: blob.size,
      });
    } catch (err) {
      console.error(err);
      window.alert(`Não foi possível exportar o documento: ${err?.message || 'erro desconhecido'}`);
    } finally {
      setExporting(false);
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
            Cada entrevista é um chat independente — todos continuam rodando em paralelo.
          </p>
        </div>
        <button
          onClick={() => setSidebarAberta((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#5f6368] hover:bg-[#f1f3f4] rounded-lg whitespace-nowrap"
          title="Mostrar/ocultar entrevistas"
        >
          <PanelLeft className="w-4 h-4" /> Entrevistas
        </button>
        <button
          onClick={() => setLogsOpen(true)}
          className="p-2 text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] rounded-full"
          title="Ver logs da sessão"
        >
          <ScrollText className="w-4 h-4" />
        </button>
        <Link to="/historico" className="flex items-center gap-1.5 text-xs text-[#1a73e8] hover:underline whitespace-nowrap">
          <FileText className="w-3.5 h-3.5" /> Histórico
        </Link>
        <Link to="/modelos" className="flex items-center gap-1.5 text-xs text-[#1a73e8] hover:underline whitespace-nowrap">
          <Library className="w-3.5 h-3.5" /> Configurações
        </Link>
      </div>

      {/* Barra do modelo padrão */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-2 border-b border-[#f1f3f4] bg-white flex-shrink-0">
        <span className="text-xs text-[#5f6368]">Template principal:</span>
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

      {/* Corpo: conversas + chat (esq) + documento (dir) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <ConversasSidebar
          conversas={conversas}
          ativaId={sessao?.id || chaveAtiva}
          ocupadas={ocupadas}
          aberta={sidebarAberta}
          onNova={() => setSearchParams({ id: novaSessao() })}
          onSelecionar={(id) => setSearchParams({ id })}
          onExcluir={removerConversa}
        />

        {/* Chat */}
        <div
          className="flex flex-col min-h-0 lg:w-[400px] lg:flex-shrink-0 lg:border-r border-[#dadce0]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = Array.from(e.dataTransfer.files || []);
            if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
          }}
        >
          <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
            <div className="space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-10">
                  <Bot className="w-8 h-8 text-[#dadce0] mx-auto mb-2" />
                  <p className="text-sm text-[#5f6368]">
                    Descreva o caso, cole a entrevista ou arraste o PDF aqui.
                    <br />Aceita PDF, DOCX, planilhas e imagens — pode enviar só o arquivo, sem texto.
                  </p>
                </div>
              )}
              {messages.map((m, i) =>
                m.role === 'approval' ? (
                  <GenerationApprovalMessage
                    key={i}
                    faltando={m.faltando}
                    decided={m.decided}
                    onDecide={(aprovado) => decidirGeracao(chaveAtiva, i, aprovado)}
                  />
                ) : m.role === 'tool' || m.role === 'tool_result' ? (
                  <ToolTraceMessage key={i} message={m} />
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
                  accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.csv,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic,.tif,.tiff,application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const novos = Array.from(e.target.files);
                    setFiles((prev) => [...prev, ...novos]);
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
              <span className="pb-2 text-[10px] text-[#9aa0a6] whitespace-nowrap">
                {sessao?.saveStatus === 'saving' ? 'Salvando...' : sessao?.saveStatus === 'local' ? 'Não salvo' : 'Salvo'}
              </span>
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
            {docHtml && !reviewConfirmed && (
              <span className="hidden md:inline text-[11px] text-[#8a5d00]">Confira os campos destacados</span>
            )}
            {docHtml && !reviewConfirmed && (
              <button
                onClick={() => confirmarRevisao(chaveAtiva)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1a73e8] text-[#1a73e8] rounded-lg text-xs font-medium hover:bg-[#e8f0fe] transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar revisão
              </button>
            )}
            <button
              onClick={exportar}
              disabled={!docHtml || !reviewConfirmed || exporting}
              title={!reviewConfirmed ? 'Confirme a revisão antes de exportar' : 'Exportar DOCX'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a73e8] text-white rounded-lg text-xs font-medium hover:bg-[#1557b0] transition-colors disabled:opacity-40"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              {exporting ? 'Exportando...' : 'Exportar DOCX'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 lg:p-8 min-h-0 relative">
            {docHtml ? (
              <DocumentReviewPreview html={docHtml} dimmed={generating} />
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
      <SessionLogsModal open={logsOpen} onOpenChange={setLogsOpen} messages={[...messages, ...consoleLogs]} />
    </div>
  );
}