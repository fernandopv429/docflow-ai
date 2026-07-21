import { useState } from 'react';
import { base44 } from '@/api/base44Client';

// AI helper backed by Claude via the platform's secure LLM integration
// (no API key exposed in the browser).
export function useAIHelper() {
  const [loading, setLoading] = useState(false);

  const ask = async (prompt) => {
    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'claude_sonnet_4_6',
      });
      return result;
    } catch (error) {
      console.error('Erro no assistente IA:', error);
      return 'Erro ao processar. Tente novamente.';
    } finally {
      setLoading(false);
    }
  };

  const suggestImprovement = (text) =>
    ask(
      `Você é um assistente jurídico especializado em redação de documentos. Sugira melhorias jurídicas e de redação para o texto abaixo, mantendo o sentido original. Responda em português, de forma objetiva.\n\nTEXTO:\n"""\n${text}\n"""`
    );

  const checkCompleteness = (document) =>
    ask(
      `Você é um assistente jurídico. Analise o documento abaixo e diga se está completo. Liste objetivamente, em português, o que está faltando ou incompleto (seções, dados, fundamentação, pedidos).\n\nDOCUMENTO:\n"""\n${typeof document === 'string' ? document : JSON.stringify(document)}\n"""`
    );

  const suggestNextSection = (content) =>
    ask(
      `Você é um assistente jurídico. Com base no conteúdo abaixo, sugira qual é a próxima seção mais importante a ser escrita e um breve esboço dela. Responda em português.\n\nCONTEÚDO ATUAL:\n"""\n${content}\n"""`
    );

  return { suggestImprovement, checkCompleteness, suggestNextSection, loading };
}