import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Paperclip, X, Sparkles, FileDown, Wand2, Library,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { exportToDocx } from '@/lib/exportDocx';
import { TIPO_DISPENSA_LABELS } from '@/lib/trabalhista/tokens';
import {
  listarModelosAtivos,
  extrairAtributos,
  rankearModelos,
  gerarPeca,
} from '@/lib/trabalhista/modelosReferencia';

export default function GerarPorEntrevista() {
  const [texto, setTexto] = useState('');
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [modelos, setModelos] = useState([]);
  const [analisando, setAnalisando] = useState(false);
  const [attrs, setAttrs] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [modeloId, setModeloId] = useState('');

  const [gerando, setGerando] = useState(false);
  const [html, setHtml] = useState('');
  const [comTimbrado, setComTimbrado] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    listarModelosAtivos().then(setModelos).catch(() => {});
  }, []);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setDocs((prev) => [...prev, { name: file.name, url: file_url }]);
      }
    } catch (err) {
      console.error(err);
      setErro('Falha ao enviar um dos arquivos.');
    }
    setUploading(false);
    e.target.value = '';
  };

  const analisar = async () => {
    if (!texto.trim() && docs.length === 0) {
      setErro('Cole o texto da entrevista ou anexe um documento.');
      return;
    }
    setAnalisando(true);
    setErro(null);
    setHtml('');
    try {
      const fileUrls = docs.map((d) => d.url);
      const a = await extrairAtributos({ texto, fileUrls });
      setAttrs(a);
      const rk = rankearModelos(modelos, a);
      setRanking(rk);
      setModeloId(rk[0]?.modelo?.id || '');
    } catch (err) {
      console.error(err);
      setErro('Erro ao analisar a entrevista. Tente novamente.');
    }
    setAnalisando(false);
  };

  const gerar = async () => {
    const modelo = modelos.find((m) => m.id === modeloId);
    if (!modelo) {
      setErro('Selecione um modelo de referência.');
      return;
    }
    setGerando(true);
    setErro(null);
    try {
      const fileUrls = docs.map((d) => d.url);
      const resultado = await gerarPeca({ texto, fileUrls, attrs, modelo });
      setHtml(typeof resultado === 'string' ? resultado : String(resultado || ''));
    } catch (err) {
      console.error(err);
      setErro('Erro ao gerar a minuta. Tente novamente.');
    }
    setGerando(false);
  };

  const exportar = async () => {
    try {
      await exportToDocx(html, null, 'Minuta - petição inicial', { comTimbrado });
    } catch (err) {
      console.error(err);
      setErro('Erro ao exportar o DOCX.');
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        <div className="flex items-center gap-3">
          <Link to="/trabalhista" className="text-[#5f6368] hover:text-[#202124]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-[#202124]">Gerar por Entrevista</h1>
            <p className="text-xs text-[#5f6368]">
              Cole a entrevista, escolha o modelo de referência mais aderente e gere uma minuta.
            </p>
          </div>
          <Link
            to="/modelos"
            className="flex items-center gap-1.5 text-xs text-[#1a73e8] hover:underline"
          >
            <Library className="w-3.5 h-3.5" /> Modelos ({modelos.length})
          </Link>
        </div>

        {erro && <p className="text-sm text-red-500">{erro}</p>}

        {/* Entrada */}
        <section className="bg-white border border-[#dadce0] rounded-xl p-5 space-y-3">
          <label className="block text-sm font-semibold text-[#202124]">Entrevista / relato do cliente</label>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={8}
            placeholder="Cole aqui a transcrição da entrevista, o relato dos fatos, jornada, verbas, etc."
            className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-md focus:outline-none focus:border-[#1a73e8] resize-y"
          />
          <div>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.docx,.txt"
              onChange={handleFiles}
              className="hidden"
              id="docs-entrevista"
            />
            <label
              htmlFor="docs-entrevista"
              className="flex items-center gap-2 px-4 py-2 border border-dashed border-[#dadce0] rounded-lg text-sm text-[#5f6368] hover:bg-[#f8f9fa] cursor-pointer w-fit"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              {uploading ? 'Enviando...' : 'Anexar documentos (opcional)'}
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
          <button
            onClick={analisar}
            disabled={analisando}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] transition-colors disabled:opacity-50"
          >
            {analisando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {analisando ? 'Analisando...' : 'Analisar e escolher modelo'}
          </button>
        </section>

        {/* Ranking de modelos */}
        {ranking.length > 0 && (
          <section className="bg-white border border-[#dadce0] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#202124]">Modelo de referência</h2>
              {attrs && (
                <span className="text-xs text-[#5f6368]">
                  {attrs.funcao || '—'} · {TIPO_DISPENSA_LABELS[attrs.tipo_dispensa]?.split('(')[0]?.trim() || attrs.tipo_dispensa || '—'} · {attrs.rito || '—'}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {ranking.map(({ modelo, score, motivos }) => (
                <label
                  key={modelo.id}
                  className={`block border rounded-lg p-3 cursor-pointer transition-colors ${
                    modeloId === modelo.id ? 'border-[#1a73e8] bg-[#e8f0fe]' : 'border-[#dadce0] hover:bg-[#f8f9fa]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="modelo"
                      checked={modeloId === modelo.id}
                      onChange={() => setModeloId(modelo.id)}
                      className="mt-1 accent-[#1a73e8]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm text-[#202124]">{modelo.titulo}</p>
                        <span className="text-xs font-semibold text-[#1a73e8] whitespace-nowrap">
                          {score} pts{!modelo.arquivo_url && ' · sem DOCX'}
                        </span>
                      </div>
                      {motivos.length > 0 && (
                        <p className="text-xs text-[#5f6368] mt-0.5">{motivos.join(' · ')}</p>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <button
              onClick={gerar}
              disabled={gerando || !modeloId}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] transition-colors disabled:opacity-50"
            >
              {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {gerando ? 'Gerando minuta...' : 'Gerar minuta'}
            </button>
          </section>
        )}

        {/* Resultado */}
        {html && (
          <section className="bg-white border border-[#dadce0] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#202124]">Minuta gerada</h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-[#3c4043] cursor-pointer select-none">
                  <input type="checkbox" checked={comTimbrado} onChange={(e) => setComTimbrado(e.target.checked)} className="w-4 h-4 accent-[#1a73e8]" />
                  Timbrado
                </label>
                <button
                  onClick={exportar}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#1a73e8] text-white rounded-lg text-xs font-medium hover:bg-[#1557b0] transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" /> Exportar DOCX
                </button>
              </div>
            </div>
            <div
              className="text-sm text-[#202124] leading-relaxed border-t border-[#f1f3f4] pt-4 max-h-[600px] overflow-y-auto [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:text-[#202124] [&_p]:my-2 [&_p]:text-justify"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </section>
        )}
      </div>
    </div>
  );
}
