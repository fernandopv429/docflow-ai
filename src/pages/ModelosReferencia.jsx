import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Upload, Library, CheckCircle2, AlertCircle, FileText, SlidersHorizontal } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { TIPO_DISPENSA_LABELS } from '@/lib/trabalhista/tokens';
import { extrairTextoDocx } from '@/lib/trabalhista/modelosReferencia';

const RITO_LABEL = { ordinario: 'Ordinário', sumarissimo: 'Sumaríssimo' };

const norm = (s) => (s || '').toString().trim().toLowerCase();

export default function ModelosReferencia() {
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState(null);
  const [config, setConfig] = useState(null);

  const load = () =>
    base44.entities.ModeloReferencia
      .list('-updated_date', 100)
      .then(setModelos)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const l = await base44.entities.IntegracaoConfig.list('-updated_date', 1);
        if (l?.[0]) {
          setConfig(l[0]);
        } else {
          const c = await base44.entities.IntegracaoConfig.create({
            chave: 'default', cnpj_ativo: true, cep_ativo: true, datajud_ativo: false, datajud_tribunal: 'trt2', datajud_size: 5,
          });
          setConfig(c);
        }
      } catch (e) { /* mantém defaults implícitos */ }
    })();
  }, []);

  const salvarConfig = async (patch) => {
    if (!config?.id) return;
    const novo = { ...config, ...patch };
    setConfig(novo);
    try {
      await base44.entities.IntegracaoConfig.update(config.id, patch);
    } catch (e) {
      setErro('Erro ao salvar a configuração das integrações.');
    }
  };

  const handleImport = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setImportando(true);
    setErro(null);
    setMsg(null);
    let anexados = 0;
    const ignorados = [];
    try {
      const atuais = await base44.entities.ModeloReferencia.list('-updated_date', 100);
      for (const file of files) {
        const match = atuais.find((m) => norm(m.arquivo_nome) === norm(file.name));
        if (!match) {
          ignorados.push(file.name);
          continue;
        }
        const textoAnon = await extrairTextoDocx(file); // texto já anonimizado
        // Texto integral vai para arquivo hospedado (o campo da entidade tem limite de tamanho).
        const anonFile = new File(
          [textoAnon],
          `${file.name.replace(/\.docx$/i, '')}-anon.txt`,
          { type: 'text/plain' }
        );
        const [anon, orig] = await Promise.all([
          base44.integrations.Core.UploadFile({ file: anonFile }),
          base44.integrations.Core.UploadFile({ file }),
        ]);
        await base44.entities.ModeloReferencia.update(match.id, {
          conteudo_url: anon.file_url,        // texto integral anonimizado (usado na geração)
          arquivo_url: orig.file_url,         // DOCX original (arquivo/referência; não vai à IA)
          conteudo: (textoAnon || '').slice(0, 1500), // prévia curta
        });
        anexados++;
      }
      let resumo = `Importação concluída: ${anexados} modelo(s) atualizado(s).`;
      if (ignorados.length) {
        resumo += ` ${ignorados.length} arquivo(s) ignorado(s) por não corresponder a um modelo da base: ${ignorados.join(', ')}.`;
      }
      setMsg(resumo);
      await load();
    } catch (err) {
      console.error(err);
      setErro(`Erro ao importar: ${err.message || 'tente novamente'}`);
    }
    setImportando(false);
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-[#1a73e8] animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-[#5f6368] hover:text-[#202124]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-[#202124] flex items-center gap-2">
              <Library className="w-5 h-5 text-[#1a73e8]" /> Modelos de Referência
            </h1>
            <p className="text-xs text-[#5f6368]">
              Peças corretas usadas como base para gerar novas minutas a partir da entrevista.
            </p>
          </div>
          <div>
            <input type="file" multiple accept=".docx" onChange={handleImport} className="hidden" id="import-modelos" />
            <label
              htmlFor="import-modelos"
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] transition-colors cursor-pointer"
            >
              {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importando ? 'Importando...' : 'Importar .docx'}
            </label>
          </div>
        </div>

        <div className="bg-[#e8f0fe] border border-[#c6dafc] rounded-xl p-4 text-xs text-[#3c4043]">
          Ao importar, o arquivo original é anexado ao modelo <strong>já existente</strong> de mesmo nome e seu texto é
          <strong>anonimizado</strong> automaticamente (nomes, CPF, RG, PIS, endereços). Arquivos que não correspondem a um
          modelo da base são ignorados — novos modelos não são criados por aqui.
        </div>

        {config && (
          <div className="bg-white border border-[#dadce0] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-[#202124] mb-1 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#1a73e8]" /> Integrações (consultas externas)
            </h2>
            <p className="text-xs text-[#5f6368] mb-3">Ligue/desligue as consultas usadas ao gerar a petição.</p>
            <div className="space-y-1">
              <Toggle
                label="Consulta de CNPJ (BrasilAPI)"
                desc="Razão social e endereço oficiais das reclamadas"
                checked={!!config.cnpj_ativo}
                onChange={() => salvarConfig({ cnpj_ativo: !config.cnpj_ativo })}
              />
              <Toggle
                label="Consulta de CEP (ViaCEP)"
                desc="Completa endereço e município (competência)"
                checked={!!config.cep_ativo}
                onChange={() => salvarConfig({ cep_ativo: !config.cep_ativo })}
              />
              <Toggle
                label="Consulta ao DataJud (CNJ)"
                desc="Contexto jurisprudencial por tema — requer a função de backend 'datajud' publicada"
                checked={!!config.datajud_ativo}
                onChange={() => salvarConfig({ datajud_ativo: !config.datajud_ativo })}
              />
            </div>
            {config.datajud_ativo && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <label className="text-xs text-[#5f6368]">Tribunal DataJud:</label>
                <input
                  value={config.datajud_tribunal || 'trt2'}
                  onChange={(e) => setConfig({ ...config, datajud_tribunal: e.target.value })}
                  onBlur={(e) => salvarConfig({ datajud_tribunal: e.target.value.trim() || 'trt2' })}
                  className="text-xs border border-[#dadce0] rounded-md px-2 py-1 w-24 focus:outline-none focus:border-[#1a73e8]"
                />
                <span className="text-[11px] text-[#9aa0a6]">ex.: trt2 (SP), trt1 (RJ), trt3 (MG), trt15 (Campinas)</span>
              </div>
            )}
          </div>
        )}

        {msg && (
          <p className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="w-4 h-4" /> {msg}
          </p>
        )}
        {erro && (
          <p className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" /> {erro}
          </p>
        )}

        {modelos.length === 0 ? (
          <div className="text-center py-16 bg-white border border-[#dadce0] rounded-xl">
            <Library className="w-10 h-10 text-[#dadce0] mx-auto mb-3" />
            <p className="text-[#5f6368]">Nenhum modelo de referência ainda</p>
            <p className="text-xs text-[#9aa0a6] mt-1">Importe arquivos .docx para começar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {modelos.map((m) => (
              <div key={m.id} className="bg-white border border-[#dadce0] rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-[#1a73e8] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#202124]">{m.titulo}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.funcao && <Badge>{m.funcao}</Badge>}
                      {m.rito && <Badge>{RITO_LABEL[m.rito] || m.rito}</Badge>}
                      {m.tipo_dispensa && <Badge>{TIPO_DISPENSA_LABELS[m.tipo_dispensa]?.split('(')[0]?.trim() || m.tipo_dispensa}</Badge>}
                      {m.tem_tomadora && <Badge>Tomadora (Súm. 331)</Badge>}
                      {m.conteudo_url
                        ? <Badge tone="green">Texto integral</Badge>
                        : <Badge tone="amber">Só resumo</Badge>}
                    </div>
                    {(m.teses || []).length > 0 && (
                      <p className="text-xs text-[#5f6368] mt-2">
                        {(m.teses || []).slice(0, 8).join(' · ')}{(m.teses || []).length > 8 ? ' …' : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-3 py-1.5 cursor-pointer select-none">
      <span className="min-w-0">
        <span className="block text-sm text-[#202124]">{label}</span>
        {desc && <span className="block text-xs text-[#5f6368]">{desc}</span>}
      </span>
      <span className="relative inline-flex flex-shrink-0 mt-0.5">
        <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
        <span className="w-9 h-5 rounded-full bg-[#dadce0] peer-checked:bg-[#1a73e8] transition-colors" />
        <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

function Badge({ children, tone = 'blue' }) {
  const cls = {
    blue: 'bg-[#e8f0fe] text-[#1a73e8]',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
  }[tone];
  return <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${cls}`}>{children}</span>;
}
