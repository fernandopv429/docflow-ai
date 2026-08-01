import { base44 } from '@/api/base44Client';

// Producer: insere uma tarefa na fila e dispara o worker sem bloquear o fluxo.
export async function enqueueJob(taskType, payload = {}, { maxAttempts = 3 } = {}) {
  const job = await base44.entities.JobQueue.create({
    taskType,
    payload,
    status: 'pending',
    attempts: 0,
    maxAttempts,
  });
  // Chamada assíncrona não-bloqueante — o worker processa em segundo plano.
  base44.functions.invoke('queue-worker', { jobId: job.id }).catch(() => {});
  return job;
}

// Consulta o estado atual de um job (para polling do resultado).
export async function getJob(jobId) {
  return base44.entities.JobQueue.get(jobId);
}

// Aguarda a conclusão de um job com polling (útil para fluxos que precisam do resultado).
export async function waitForJob(jobId, { intervalMs = 2000, timeoutMs = 180000 } = {}) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const job = await getJob(jobId);
    if (job.status === 'completed' || job.status === 'failed') return job;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Tempo esgotado aguardando o processamento do job.');
}