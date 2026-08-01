import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Executa a lógica de cada tipo de tarefa registrado na fila.
async function executarTarefa(base44, job) {
  const payload = job.payload || {};
  switch (job.taskType) {
    case 'CONSULTA_DATAJUD': {
      const res = await base44.functions.invoke('datajud', payload);
      return res?.data ?? res;
    }
    case 'CONSULTA_CCT': {
      const res = await base44.functions.invoke('cct', payload);
      return res?.data ?? res;
    }
    case 'GERAR_PETICAO': {
      // payload = requisição completa do InvokeLLM (prompt, model, file_urls, ...)
      const html = await base44.integrations.Core.InvokeLLM(payload);
      return { html: typeof html === 'string' ? html : html };
    }
    default:
      throw new Error(`taskType desconhecido: ${job.taskType}`);
  }
}

async function processarJob(base44, job) {
  await base44.entities.JobQueue.update(job.id, {
    status: 'processing',
    lockedAt: new Date().toISOString(),
  });
  try {
    const result = await executarTarefa(base44, job);
    await base44.entities.JobQueue.update(job.id, {
      status: 'completed',
      result: result && typeof result === 'object' ? result : { value: result },
      error: '',
    });
    return { id: job.id, taskType: job.taskType, status: 'completed' };
  } catch (err) {
    const attempts = (job.attempts || 0) + 1;
    const maxAttempts = job.maxAttempts || 3;
    const failed = attempts >= maxAttempts;
    await base44.entities.JobQueue.update(job.id, {
      status: failed ? 'failed' : 'pending',
      attempts,
      error: err?.message || String(err),
    });
    return { id: job.id, taskType: job.taskType, status: failed ? 'failed' : 'pending', attempts };
  }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try {
      body = await req.json();
    } catch (_e) {
      body = {};
    }

    // Se um jobId específico foi informado, processa só ele; senão, drena os pendentes.
    let jobs = [];
    if (body.jobId) {
      const job = await base44.entities.JobQueue.get(body.jobId);
      if (job && job.status === 'pending') jobs = [job];
    } else {
      jobs = await base44.entities.JobQueue.filter({ status: 'pending' }, 'created_date', 10);
    }

    const processed = [];
    for (const job of jobs) {
      processed.push(await processarJob(base44, job));
    }

    return Response.json({ processed, count: processed.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}