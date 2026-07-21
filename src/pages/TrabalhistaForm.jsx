import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Paperclip, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { deriveTokens, TIPO_DISPENSA_LABELS } from '@/lib/trabalhista/tokens';
import CampoInput from '@/components/trabalhista/CampoInput';

const Section = ({ title, children }) => (
  <fieldset className="bg-white border border-[#dadce0] rounded-xl p-5">
    <legend className="px-2 text-sm font-semibold text-[#202124]">{title}</legend>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  </fieldset>
);

export default function TrabalhistaForm() {
  const navigate = useNavigate();
  const [f, setF] = useState(/** @type {Record<string, any>} */ ({ tipo_dispensa: '' }));
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (campo) => (e) =>
    setF((prev) => ({ ...prev, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setDocs((prev) => [...prev, { name: file.name, url: file_url }]);
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tokens = deriveTokens(f);
      const caso = await base44.entities.CasoTrabalhista.create({
        ...f,
        salario: f.salario ? Number(f.salario) : undefined,
        val_ft: f.val_ft ? Number(f.val_ft) : undefined,
        ft_qtd_media: f.ft_qtd_media ? Number(f.ft_qtd_media) : undefined,
        comarca_uf: (f.comarca_uf || '').toUpperCase(),
        regiao_trt: tokens.REGIAO_TRT,
        tem_ft: tokens.tem_ft,
        tem_dano_moral: tokens.tem_dano_moral,
        titulo: f.titulo?.trim() || `${f.recl_nome} × ${f.recl1_nome}`,
        status: 'rascunho',
        analise_status: 'pendente',
        document_urls: docs.map((d) => d.url),
        document_names: docs.map((d) => d.name),
      });
      navigate(`/trabalhista/${caso.id}`);
    } catch (err) {
      console.error(err);
      alert(`Erro ao criar caso: ${err.message || 'tente novamente'}`);
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        <div className="flex items-center gap-3">
          <Link to="/trabalhista" className="text-[#5f6368] hover:text-[#202124]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-semibold text-[#202124]">Novo Caso Trabalhista</h1>
        </div>

        <Section title="Identificação">
          <CampoInput label="Título do caso" placeholder="Gerado automaticamente se vazio" value={f.titulo || ''} onChange={set('titulo')} className="md:col-span-2" />
        </Section>

        <Section title="Reclamante">
          <CampoInput label="Nome completo" required value={f.recl_nome || ''} onChange={set('recl_nome')} />
          <CampoInput label="CPF" hint="Somente números (11 dígitos)" value={f.recl_cpf || ''} onChange={set('recl_cpf')} />
          <CampoInput label="RG" value={f.recl_rg || ''} onChange={set('recl_rg')} />
          <CampoInput label="PIS" value={f.recl_pis || ''} onChange={set('recl_pis')} />
          <CampoInput label="CTPS" value={f.recl_ctps || ''} onChange={set('recl_ctps')} />
          <CampoInput label="Endereço" value={f.recl_endereco || ''} onChange={set('recl_endereco')} />
        </Section>

        <Section title="Reclamada (1ª)">
          <CampoInput label="Razão social" required value={f.recl1_nome || ''} onChange={set('recl1_nome')} />
          <CampoInput label="CNPJ" required hint="Somente números (14 dígitos)" value={f.recl1_cnpj || ''} onChange={set('recl1_cnpj')} />
          <CampoInput label="Logradouro" value={f.recl1_logradouro || ''} onChange={set('recl1_logradouro')} />
          <CampoInput label="Complemento" value={f.recl1_complemento || ''} onChange={set('recl1_complemento')} />
          <CampoInput label="2ª Reclamada - Nome (opcional)" value={f.recl2_nome || ''} onChange={set('recl2_nome')} />
          <CampoInput label="2ª Reclamada - CNPJ" value={f.recl2_cnpj || ''} onChange={set('recl2_cnpj')} />
          <CampoInput label="3ª Reclamada - Nome (opcional)" value={f.recl3_nome || ''} onChange={set('recl3_nome')} />
          <CampoInput label="3ª Reclamada - CNPJ" value={f.recl3_cnpj || ''} onChange={set('recl3_cnpj')} />
        </Section>

        <Section title="Contrato">
          <CampoInput label="Data de admissão" required type="date" value={f.data_admissao || ''} onChange={set('data_admissao')} />
          <CampoInput label="Data de rescisão" type="date" value={f.data_rescisao || ''} onChange={set('data_rescisao')} />
          <CampoInput label="Função/Cargo" required value={f.funcao || ''} onChange={set('funcao')} />
          <CampoInput label="Salário mensal (R$)" required type="number" step="0.01" value={f.salario || ''} onChange={set('salario')} />
          <CampoInput label="Jornada/Horário" placeholder="Ex: 12h x 36h" value={f.jornada_horario || ''} onChange={set('jornada_horario')} />
          <div>
            <label className="block text-xs font-medium text-[#3c4043] mb-1">
              Modalidade de rescisão <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={f.tipo_dispensa}
              onChange={set('tipo_dispensa')}
              className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-md focus:outline-none focus:border-[#1a73e8] bg-white"
            >
              <option value="">Selecione...</option>
              {Object.entries(TIPO_DISPENSA_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <CampoInput label="Comarca/UF" required placeholder="Ex: SP" maxLength={2} hint="A Região TRT é derivada automaticamente" value={f.comarca_uf || ''} onChange={set('comarca_uf')} />
        </Section>

        <Section title="Valores e Irregularidades">
          <CampoInput label="Folgas trabalhadas (quantidade)" type="number" value={f.val_ft || ''} onChange={set('val_ft')} />
          <CampoInput label="FT - Quantidade média/mês" type="number" value={f.ft_qtd_media || ''} onChange={set('ft_qtd_media')} />
          <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              ['tem_desvio', 'Desvio de função'],
              ['tem_acumulo', 'Acúmulo de função'],
              ['tem_insalubridade', 'Insalubridade'],
              ['tem_periculosidade', 'Periculosidade'],
              ['tem_adic_noturno', 'Adicional noturno'],
              ['dano_sem_estrutura', 'Dano - sem estrutura'],
            ].map(([campo, label]) => (
              <label key={campo} className="flex items-center gap-2 text-xs text-[#3c4043] cursor-pointer">
                <input type="checkbox" checked={!!f[campo]} onChange={set(campo)} className="w-4 h-4 accent-[#1a73e8]" />
                {label}
              </label>
            ))}
          </div>
          <CampoInput label="Dano moral - fatos" placeholder="Descrição do dano" value={f.dano_fatos || ''} onChange={set('dano_fatos')} />
          <CampoInput label="Dano moral - supervisor" placeholder="Conduta do supervisor" value={f.dano_supervisor || ''} onChange={set('dano_supervisor')} />
        </Section>

        <Section title="Documentos">
          <div className="md:col-span-2">
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.docx,.csv,.xlsx" onChange={handleFiles} className="hidden" id="docs-caso" />
            <label htmlFor="docs-caso" className="flex items-center gap-2 px-4 py-2 border border-dashed border-[#dadce0] rounded-lg text-sm text-[#5f6368] hover:bg-[#f8f9fa] cursor-pointer w-fit">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              {uploading ? 'Enviando...' : 'Anexar documentos (holerites, CTPS, TRCT, ponto...)'}
            </label>
            {docs.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {docs.map((d, i) => (
                  <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#e8f0fe] text-[#1a73e8] text-xs rounded-full">
                    {d.name}
                    <button type="button" onClick={() => setDocs((prev) => prev.filter((_, j) => j !== i))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Section>

        <button
          type="submit"
          disabled={saving || uploading}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Criando caso...' : 'Criar Caso'}
        </button>
      </form>
    </div>
  );
}