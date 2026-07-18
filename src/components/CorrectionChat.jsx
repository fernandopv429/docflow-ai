import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, BookmarkPlus, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function CorrectionChat({ template, variables, values, onValuesChange, fileUrls, onSkillSaved }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [savingSkill, setSavingSkill] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setSending(true);

    try {
      const varList = variables
        .map((v) => `- ${v.name}: ${v.description || 'sem descrição'}${v.example ? ` (exemplo: "${v.example}")` : ''}`)
        .join('\n');

      const prompt = `Você é um assistente de correção de preenchimento de documentos.

O template "${template.title}" tem as seguintes variáveis:
${varList}

Valores atuais preenchidos:
${JSON.stringify(values, null, 2)}

${template.skill?.trim() ? `Skill atual do template (instruções existentes):\n${template.skill.trim()}\n` : ''}
O usuário identificou um erro e deu a seguinte instrução de correção:
"${text}"

Sua tarefa:
1. Corrija os valores das variáveis conforme a instrução (use os documentos anexados como fonte da verdade, se houver).
2. Em "corrected_values", retorne APENAS as variáveis que precisam mudar, com os novos valores.
3. Em "reply", explique brevemente o que foi corrigido.
4. Em "skill_suggestion", escreva uma instrução curta e genérica (uma regra) que, se adicionada à skill do template, evitaria esse erro em preenchimentos futuros.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: fileUrls?.length ? fileUrls : undefined,
        response_json_schema: {
          type: 'object',
          properties: {
            reply: { type: 'string' },
            corrected_values: { type: 'object', additionalProperties: { type: 'string' } },
            skill_suggestion: { type: 'string' },
          },
        },
      });

      if (result?.corrected_values && Object.keys(result.corrected_values).length > 0) {
        onValuesChange((prev) => ({ ...prev, ...result.corrected_values }));
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: result?.reply || 'Correção aplicada.',
          corrected: result?.corrected_values || {},
          skillSuggestion: result?.skill_suggestion || '',
          skillSaved: false,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Erro ao processar a correção. Tente novamente.' }]);
    }
    setSending(false);
  };

  const handleSaveSkill = async (index) => {
    const msg = messages[index];
    if (!msg?.skillSuggestion) return;
    setSavingSkill(index);
    try {
      const current = template.skill?.trim() || '';
      const newSkill = current ? `${current}\n- ${msg.skillSuggestion}` : `- ${msg.skillSuggestion}`;
      await base44.entities.Template.update(template.id, { skill: newSkill });
      onSkillSaved(newSkill);
      setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, skillSaved: true } : m)));
    } catch (err) {
      alert('Erro ao salvar na skill. Tente novamente.');
    }
    setSavingSkill(null);
  };

  return (
    <>
      {/* Floating toggle */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Chat de correção"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-[#1a73e8] text-white rounded-full shadow-lg hover:bg-[#1557b0] transition-colors"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-sm font-medium">Corrigir com IA</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-40 w-96 h-[520px] bg-white rounded-xl shadow-2xl border border-[#dadce0] flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-[#1a73e8] text-white">
            <MessageSquare className="w-4 h-4" />
            <h3 className="text-sm font-semibold flex-1">Chat de Correção</h3>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/20 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#f8f9fa]">
            {messages.length === 0 && (
              <p className="text-xs text-[#5f6368] text-center mt-6">
                A IA errou ou alucinou algum valor? Descreva aqui a correção — ela ajusta os valores e você pode salvar a regra na Skill do template.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] px-3 py-2 bg-[#1a73e8] text-white rounded-2xl rounded-br-sm text-sm'
                      : 'max-w-[85%] px-3 py-2 bg-white border border-[#dadce0] text-[#3c4043] rounded-2xl rounded-bl-sm text-sm'
                  }
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.role === 'assistant' && m.skillSuggestion && (
                    <div className="mt-2 pt-2 border-t border-[#f1f3f4]">
                      <p className="text-xs text-[#5f6368] italic mb-2">Regra sugerida: "{m.skillSuggestion}"</p>
                      {m.skillSaved ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                          <Check className="w-3.5 h-3.5" /> Adicionada à Skill
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSaveSkill(i)}
                          disabled={savingSkill === i}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#e8f0fe] text-[#1a73e8] text-xs font-medium rounded-md hover:bg-[#d2e3fc] transition-colors disabled:opacity-50"
                        >
                          {savingSkill === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                          Incluir na Skill
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="px-3 py-2 bg-white border border-[#dadce0] rounded-2xl rounded-bl-sm">
                  <Loader2 className="w-4 h-4 text-[#1a73e8] animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex items-center gap-2 px-3 py-3 bg-white border-t border-[#dadce0]">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ex: A data está errada, deve ser por extenso..."
              className="flex-1 px-3 py-2 text-sm border border-[#dadce0] rounded-full focus:outline-none focus:border-[#1a73e8]"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="flex items-center justify-center w-9 h-9 bg-[#1a73e8] text-white rounded-full hover:bg-[#1557b0] transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}