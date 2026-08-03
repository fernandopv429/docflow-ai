import { base44 } from '@/api/base44Client';
import {
  carregarModeloPadrao,
  conversarEntrevista,
  gerarPecaPadrao,
  verificarCoerencia,
} from '@/lib/trabalhista/modelosReferencia';
import { fontesAuditoria, fontesEntrevista, fontesGeracao } from '@/lib/trabalhista/fontesAnalise';
import { formatBRL } from '@/lib/trabalhista/mathUtils';
import { carregarConversa, salvarConversa, tituloDaConversa } from '@/lib/conversas';

// ============================================================
// Store global de sessões de entrevista.
// Vive FORA dos componentes: cada conversa continua processando
// (análise, geração, auditoria) mesmo quando o usuário troca de
// chat ou sai da página — nada é interrompido.
// ============================================================
const sessions = new Map(); // chave -> estado
const aliases = new Map(); // id salvo no banco -> chave local
const listeners = new Set();
const saveTimers = new Map();
const saveChains = new Map(); // chave -> promise do último salvamento encadeado (evita corrida entre saves)

let listVersion = 0;
export const getListVersion = () => listVersion;

const emit = () => listeners.forEach((l) => l());
export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

let modeloPromise = null;
export function obterModeloPadrao() {
  if (!modeloPromise) modeloPromise = carregarModeloPadrao().catch(() => null);
  return modeloPromise;
}

const novoEstado = (extra = {}) => ({
  id: null,
  messages: [],
  docHtml: '',
  attrs: null,
  allUrls: [],
  documentSources: [],
  pending: null,
  geracao: null, // contexto da geração em andamento (persistido para sobreviver a refresh)
  sending: false,
  generating: false,
  reviewConfirmed: false,
  saveStatus: 'saved',
  ...extra,
});

export const resolveKey = (key) => aliases.get(key) || key;
export const getSession = (key) => (key ? sessions.get(resolveKey(key)) || null : null);

export function novaSessao() {
  const key = `nova-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  sessions.set(key, novoEstado());
  emit();
  return key;
}

export async function abrirSessao(key) {
  const k = resolveKey(key);
  if (sessions.has(k)) return k;
  const c = await carregarConversa(k);
  sessions.set(
    k,
    novoEstado({
      id: c.id,
      messages: c.messages || [],
      docHtml: c.doc_html || '',
      attrs: c.estado?.attrs || null,
      allUrls: c.estado?.allUrls || [],
      documentSources: c.estado?.documentSources || [],
      geracao: c.estado?.geracao || null,
    })
  );
  emit();
  // Geração interrompida por refresh/fechamento da aba: retoma automaticamente
  // a partir do contexto que ficou salvo no banco.
  const interrompida = c.estado?.geracao;
  if (interrompida) {
    addMessages(k, { role: 'tool', text: 'Geração interrompida detectada — retomando automaticamente...' });
    gerarMinuta(k, interrompida);
  }
  return k;
}

function patch(key, upd) {
  const k = resolveKey(key);
  const atual = sessions.get(k);
  if (!atual) return;
  sessions.set(k, { ...atual, ...(typeof upd === 'function' ? upd(atual) : upd) });
  emit();
}

function patchAndSave(key, upd) {
  patch(key, upd);
  agendarSave(key);
}

const addMessages = (key, ...msgs) =>
  patchAndSave(key, (s) => ({ messages: [...s.messages, ...msgs] }));

function agendarSave(key) {
  const k = resolveKey(key);
  clearTimeout(saveTimers.get(k));
  saveTimers.set(
    k,
    setTimeout(() => {
      // Encadeia com qualquer salvamento AINDA EM ANDAMENTO para essa mesma
      // conversa — sem isso, dois salvamentos podiam rodar em paralelo (ex.:
      // um disparado antes da minuta ficar pronta, outro logo depois) e o que
      // terminasse por último (não necessariamente o mais recente a começar)
      // vencia, sobrescrevendo o banco com um estado mais antigo/vazio.
      // Encadear garante execução sequencial, sempre lendo o estado mais
      // atual no momento em que CADA salvamento realmente roda.
      const anterior = saveChains.get(k) || Promise.resolve();
      const atual = anterior.then(() => executarSave(k)).catch((e) => console.error(e));
      saveChains.set(k, atual);
    }, 800)
  );
}

// Salva IMEDIATAMENTE (sem o debounce de 800ms). Usado ao iniciar/encerrar a
// geração, para que o marcador de "geração em andamento" chegue ao banco mesmo
// se a página for recarregada logo em seguida.
function flushSave(key) {
  const k = resolveKey(key);
  clearTimeout(saveTimers.get(k));
  const anterior = saveChains.get(k) || Promise.resolve();
  const atual = anterior.then(() => executarSave(k)).catch((e) => console.error(e));
  saveChains.set(k, atual);
  return atual;
}

async function executarSave(k) {
  const s = sessions.get(k);
  if (!s || !s.messages.length) return;
  patch(k, { saveStatus: 'saving' });
  try {
    const salva = await salvarConversa(s.id, {
      titulo: tituloDaConversa(s.messages),
      messages: s.messages,
      doc_html: s.docHtml,
      estado: { attrs: s.attrs, allUrls: s.allUrls, documentSources: s.documentSources, geracao: s.geracao },
    });
    if (!s.id) {
      aliases.set(salva.id, k);
      patch(k, { id: salva.id });
    }
    patch(k, { saveStatus: 'saved' });
  } catch (e) {
    console.error(e);
    patch(k, { saveStatus: 'local' });
  }
  listVersion += 1;
  emit();
}

// Conversas que estão processando agora (para sinalizar na lista lateral)
export function sessoesOcupadas() {
  const mapa = {};
  for (const [k, s] of sessions) if (s.sending || s.generating) mapa[s.id || k] = true;
  return mapa;
}

export function confirmarRevisao(key) {
  patch(key, { reviewConfirmed: true });
}

export function esquecerSessao(key) {
  const k = resolveKey(key);
  sessions.delete(k);
  for (const [id, alias] of aliases) if (alias === k) aliases.delete(id);
  listVersion += 1;
  emit();
}

// ============================================================
// Geração da minuta (roda em segundo plano por sessão)
// ============================================================
export async function gerarMinuta(key, opts = {}) {
  const sessao = getSession(key);
  const modeloPadrao = await obterModeloPadrao();
  if (!modeloPadrao || !sessao || sessao.generating) return;
  const geracaoTexto =
    opts.texto ?? sessao.messages.filter((m) => m.role === 'user').map((m) => m.text).filter(Boolean).join('\n\n');
  const contexto = {
    texto: geracaoTexto,
    urls: opts.urls ?? sessao.allUrls,
    attrs: opts.attrs ?? sessao.attrs,
    sources: opts.sources ?? sessao.documentSources,
  };
  patch(key, { generating: true, geracao: contexto });
  addMessages(key, { role: 'tool', text: `Usando template principal: ${modeloPadrao.titulo}` });
  // Persiste o marcador antes de começar: se a aba for recarregada durante a
  // geração, a sessão retoma sozinha ao ser reaberta.
  flushSave(key);
  try {
    const { html, dadosReceita, dadosCep, dadosDatajud, dadosCct, calculos, caso, modeloSemelhante } =
      await gerarPecaPadrao({
        texto: geracaoTexto,
        fileUrls: contexto.urls,
        attrs: contexto.attrs,
        modeloPadrao,
        onTool: (msg) => addMessages(key, { role: 'tool', text: msg }),
      });
    const tinhaDoc = Boolean(getSession(key)?.docHtml);
    patchAndSave(key, { docHtml: html, reviewConfirmed: false });

    const retornos = [
      dadosReceita?.length && { role: 'tool_result', title: 'Retorno da Receita Federal (BrasilAPI)', text: JSON.stringify(dadosReceita, null, 2) },
      dadosCep?.length && { role: 'tool_result', title: 'Retorno da consulta de CEP', text: JSON.stringify(dadosCep, null, 2) },
      dadosDatajud?.length && { role: 'tool_result', title: 'Retorno do DataJud/CNJ', text: JSON.stringify(dadosDatajud, null, 2) },
      dadosCct?.clausulas?.length && { role: 'tool_result', title: 'Cláusulas de CCT consultadas', text: JSON.stringify(dadosCct, null, 2) },
      caso && Object.keys(caso).length && { role: 'tool_result', title: 'Dados analisados e extraídos pela IA', text: JSON.stringify(caso, null, 2) },
      calculos?.length && { role: 'tool_result', title: 'Retorno dos cálculos determinísticos', text: JSON.stringify(calculos, null, 2) },
      modeloSemelhante && { role: 'tool_result', title: 'Modelo de referência selecionado', text: JSON.stringify(modeloSemelhante, null, 2) },
      {
        role: 'tool_result',
        title: 'Fontes consultadas nesta geração',
        text: JSON.stringify(
          fontesGeracao({
            texto: geracaoTexto,
            documentos: contexto.sources,
            template: modeloPadrao,
            referencia: modeloSemelhante,
            dadosReceita,
            dadosCep,
            dadosDatajud,
            dadosCct,
          }),
          null,
          2
        ),
      },
    ].filter(Boolean);
    if (retornos.length) addMessages(key, ...retornos);

    const verificados = (dadosReceita || []).filter((d) => !d.erro);
    let nota = tinhaDoc
      ? 'Documento atualizado com base no modelo padrão. Veja as mudanças ao lado.'
      : 'Minuta gerada com base no modelo padrão. Veja o documento ao lado.';
    if (verificados.length) {
      nota += ` CNPJ(s) confirmado(s) na Receita: ${verificados.map((d) => `${d.razao_social} (${d.cnpj})`).join('; ')}.`;
    }
    const comValor = (calculos || []).filter((c) => c.valor != null);
    if (comValor.length) {
      nota += `\n\nCálculos determinísticos (por código, sem IA):\n${comValor
        .map((c) => `• ${c.item}: ${formatBRL(c.valor)}`)
        .join('\n')}`;
    }
    addMessages(key, { role: 'assistant', text: nota });

    // Verificação de coerência jurídica da minuta (LLM audita, não reescreve)
    addMessages(key, { role: 'tool', text: 'Verificando coerência jurídica da minuta...' });
    try {
      const verif = await verificarCoerencia({ texto: geracaoTexto, caso, html, dadosReceita, dadosCep });
      const alertas = verif?.alertas || [];
      const icone = { BLOQUEANTE: '⛔', ATENCAO: '⚠️', INFO: 'ℹ️' };
      const cabecalho = `Verificação de coerência — status: ${verif?.status || 'concluída'}.`;
      const corpo = alertas.length
        ? '\n' + alertas.map((a) => `${icone[a.severidade] || '•'} ${a.descricao}${a.sugestao ? ` — ${a.sugestao}` : ''}`).join('\n')
        : ' Nenhum problema aparente. A revisão humana do advogado continua obrigatória.';
      addMessages(
        key,
        { role: 'tool_result', title: 'Retorno da auditoria de coerência (IA)', text: JSON.stringify(verif, null, 2) },
        {
          role: 'tool_result',
          title: 'Fontes consultadas nesta auditoria',
          text: JSON.stringify(
            fontesAuditoria({ texto: geracaoTexto, template: modeloPadrao, referencia: modeloSemelhante }),
            null,
            2
          ),
        },
        { role: 'assistant', text: cabecalho + corpo }
      );
    } catch (e) {
      console.error(e);
    }
  } catch (err) {
    console.error(err);
    addMessages(key, {
      role: 'assistant',
      text: `Erro ao gerar a minuta: ${err?.message || 'falha desconhecida'}. Envie a última mensagem novamente para repetir a geração.`,
    });
  }
  patch(key, { generating: false, geracao: null });
  flushSave(key);
}

// ============================================================
// Envio de mensagem/arquivos (roda em segundo plano por sessão)
// ============================================================
export async function enviarMensagem(key, { text, files = [] }) {
  const sessao = getSession(key);
  if (!sessao || sessao.sending || sessao.generating) return;
  const novasMsgs = [...sessao.messages, { role: 'user', text, files: files.map((f) => f.name) }];
  patchAndSave(key, { messages: novasMsgs, sending: true });
  try {
    let urls = sessao.allUrls;
    let fontesAtuais = sessao.documentSources;
    if (files.length) {
      const novos = [];
      const novasFontes = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        novos.push(file_url);
        novasFontes.push({ nome: file.name, url: file_url });
      }
      urls = [...urls, ...novos];
      fontesAtuais = [...fontesAtuais, ...novasFontes];
      patch(key, { allUrls: urls, documentSources: fontesAtuais });
    }

    const modeloPadrao = await obterModeloPadrao();
    const transcript = novasMsgs
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, text: m.text || '' }));
    const res = await conversarEntrevista({
      transcript,
      fileUrls: urls,
      modelos: modeloPadrao ? [{ titulo: modeloPadrao.titulo, teses: [] }] : [],
      attrsAtuais: sessao.attrs || {},
    });

    const novoAttrs = { ...(sessao.attrs || {}), ...(res?.atributos || {}) };
    patch(key, { attrs: novoAttrs });
    addMessages(
      key,
      ...(res?.dadosReceita?.length
        ? [
            { role: 'tool', text: `Consultando ${res.dadosReceita.length} CNPJ(s) na Receita Federal (BrasilAPI)...` },
            { role: 'tool_result', title: 'Retorno da Receita Federal (BrasilAPI)', text: JSON.stringify(res.dadosReceita, null, 2) },
          ]
        : []),
      { role: 'assistant', text: res?.reply || 'Certo.' },
      {
        role: 'tool_result',
        title: 'Análise da IA sobre a entrevista',
        text: JSON.stringify({ atributos: res?.atributos || {}, pronto_para_gerar: res?.pronto_para_gerar ?? false }, null, 2),
      },
      {
        role: 'tool_result',
        title: 'Fontes consultadas nesta análise',
        text: JSON.stringify(
          fontesEntrevista({
            texto: transcript.filter((m) => m.role === 'user').map((m) => m.text).join('\n\n'),
            documentos: fontesAtuais,
          }),
          null,
          2
        ),
      }
    );

    const textoCompleto = novasMsgs.filter((m) => m.role === 'user').map((m) => m.text).filter(Boolean).join('\n\n');
    const faltando = res?.faltando || [];
    const contexto = { texto: textoCompleto, urls, attrs: novoAttrs, sources: fontesAtuais };
    patch(key, { sending: false });
    if (res?.pronto_para_gerar) {
      await gerarMinuta(key, contexto);
    } else if (faltando.length) {
      patch(key, { pending: contexto });
      addMessages(key, { role: 'approval', faltando });
    } else if (getSession(key)?.docHtml) {
      await gerarMinuta(key, contexto);
    }
  } catch (err) {
    console.error(err);
    addMessages(key, { role: 'assistant', text: 'Erro ao processar. Tente novamente.' });
  }
  patch(key, { sending: false });
}

export async function decidirGeracao(key, idx, aprovado) {
  patchAndSave(key, (s) => ({
    messages: s.messages.map((msg, i) => (i === idx ? { ...msg, decided: aprovado ? 'sim' : 'nao' } : msg)),
  }));
  const pend = getSession(key)?.pending;
  patch(key, { pending: null });
  if (aprovado && pend) {
    await gerarMinuta(key, pend);
  } else if (!aprovado) {
    addMessages(key, { role: 'assistant', text: 'Certo, aguardo as informações que faltam antes de gerar a minuta.' });
  }
}