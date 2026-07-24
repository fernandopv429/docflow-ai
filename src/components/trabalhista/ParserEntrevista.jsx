import React, { useState } from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import { extrairCasoDeTexto } from '@/lib/trabalhista/parserEntrevista';

// Caixa de texto livre: cola o resumo da entrevista e a IA preenche o formulário.
export default function ParserEntrevista({ onExtract }) {
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const extrair = async () => {
    if (!texto.trim() || loading) return;
    setLoading(true);
    setFeedback(null);
    try {
      const dados = await extrairCasoDeTexto(texto.trim());
      const qtd = Object.keys(dados).length;
      onExtract(dados);
      setFeedback(qtd ? `${qtd} campo(s) preenchido(s) automaticamente. Revise antes de salvar.` : 'Nenhum dado identificado no texto.');
    } catch (err) {
      console.error(err);
      setFeedback('Erro ao extrair os dados. Tente novamente.');
    }
    setLoading(false);
  };

  return (
    <fieldset className="bg-[#e8f0fe] border border-[#c6dafc] rounded-xl p-5">
      <legend className="px-2 text-sm font-semibold text-[#1a73e8] flex items-center gap-1.5">
        <Wand2 className="w-4 h-4" /> Preenchimento automático por IA
      </legend>
      <p className="text-xs text-[#5f6368] mb-2">
        Cole o resumo da entrevista em texto livre — a IA extrai os dados e preenche os campos abaixo.
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        placeholder='Ex.: "Isaac, vigilante, trabalhou de 22/01/26 a 02/06/26 na Verzani, posto Festpan, salário R$ 2.400, escala 12x36 noturna, demissão forçada por perseguição do supervisor Renan..."'
        className="w-full px-3 py-2 text-sm border border-[#c6dafc] rounded-md bg-white focus:outline-none focus:border-[#1a73e8] resize-y"
      />
      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={extrair}
          disabled={loading || !texto.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {loading ? 'Extraindo...' : 'Preencher formulário'}
        </button>
        {feedback && <span className="text-xs text-[#3c4043]">{feedback}</span>}
      </div>
    </fieldset>
  );
}