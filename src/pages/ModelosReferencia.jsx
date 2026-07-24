import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Upload, Library, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
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

  const load = () =>
    base44.entities.ModeloReferencia
      .list('-updated_date', 100)
      .then(setModelos)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleImport = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setImportando(true);
    setErro(null);
    setMsg(null);
    let anexados = 0;
    let criados = 0;
    try {
      const atuais = await base44.entities.ModeloReferencia.list('-updated_date', 100);
      for (const file of files) {
        const conteudo = await extrairTextoDocx(file);
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const match = atuais.find((m) => norm(m.arquivo_nome) === norm(file.name));
        if (match) {
          await base44.entities.ModeloReferencia.update(match.id, {
            arquivo_url: file_url,
            conteudo: conteudo || match.conteudo,
          });
          anexados++;
        } else {
          await base44.entities.ModeloReferencia.create({
            titulo: file.name.replace(/\.docx$/i, ''),
            arquivo_nome: file.name,
            arquivo_url: file_url,
            conteudo,
            sindicato: 'SINDEEPRES',
            ativo: true,
          });
          criados++;
        }
      }
      setMsg(`Importação concluída: ${anexados} modelo(s) enriquecido(s), ${criados} novo(s).`);
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
          <Link to="/trabalhista" className="text-[#5f6368] hover:text-[#202124]">
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
          Ao importar, o arquivo original é anexado ao modelo e seu texto é <strong>anonimizado</strong> automaticamente
          (nomes, CPF, RG, PIS, endereços). Arquivos com o mesmo nome de um modelo existente enriquecem aquele registro;
          os demais criam novos modelos.
        </div>

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
                      {m.arquivo_url
                        ? <Badge tone="green">DOCX anexado</Badge>
                        : <Badge tone="amber">Sem DOCX — só resumo</Badge>}
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

function Badge({ children, tone = 'blue' }) {
  const cls = {
    blue: 'bg-[#e8f0fe] text-[#1a73e8]',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
  }[tone];
  return <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${cls}`}>{children}</span>;
}
