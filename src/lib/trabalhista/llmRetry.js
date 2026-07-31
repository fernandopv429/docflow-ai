import { base44 } from '@/api/base44Client';

// Chamada ao LLM com retentativa automática para erros transitórios (502/503/504/timeout).
export async function invokeLLMComRetry(req, { tentativas = 3, onRetry } = {}) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await base44.integrations.Core.InvokeLLM(req);
    } catch (err) {
      ultimoErro = err;
      const status = err?.response?.status || err?.status;
      const transitorio = [502, 503, 504].includes(status) || /timeout|network/i.test(err?.message || '');
      if (!transitorio || i === tentativas - 1) throw err;
      onRetry?.(i + 1);
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw ultimoErro;
}