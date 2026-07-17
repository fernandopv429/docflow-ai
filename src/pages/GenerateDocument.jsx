import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Sparkles,
  Loader2,
  Download,
  FileText,
  CheckCircle2,
  X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { extractVariables, highlightVariablesInHtml } from '@/lib/variables';
import { exportToDocx } from '@/lib/exportDocx';

export default function GenerateDocument() {
  const { id } = useParams();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [uploadedUrls, setUploadedUrls] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [values, setValues] = useState({});
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [comTimbrado, setComTimbrado] = useState(true);

  useEffect(() => {
    base44.entities.Template
      .get(id)
      .then(setTemplate)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const variables = template
    ? template.variables?.length
      ? template.variables
      : extractVariables(template.content)
    : [];

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selected]);
    setUploadedUrls([]);
    setValues({});
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadedUrls([]);
    setValues({});
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    setValues({});

    try {
      let urls = uploadedUrls;

      if (urls.length === 0 && files.length > 0) {
        urls = [];
        for (const file of files) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          urls.push(file_url);
        }
        setUploadedUrls(urls);
      }

      if (urls.length === 0) {
        setError('Faça upload de pelo menos um documento');
        setAnalyzing(false);
        return;
      }

      const schema = {
        type: 'object',
        properties: Object.fromEntries(
          variables.map((v) => [v.name, { type: 'string' }])
        ),
      };

      const varList = variables
        .map((v) => `- ${v.name}: ${v.description || 'sem descrição'}`)
        .join('\n');

      const prompt = `Você é um assistente especializado em análise de documentos. Analise os documentos enviados (PDFs ou imagens de documentos como CNH, RG, contratos, etc.) e extraia os valores para as seguintes variáveis:\n\n${varList}\n\nPara cada variável, encontre o valor correspondente no documento. Se um valor não for encontrado, retorne uma string vazia. Responda apenas com o objeto JSON.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: urls,
        response_json_schema: schema,
      });

      setValues(result || {});
    } catch (err) {
      setError('Erro ao analisar documentos. Tente novamente.');
    }
    setAnalyzing(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToDocx(template.content, values, template.title, { comTimbrado });
      await base44.entities.GeneratedDocument.create({
        template_id: template.id,
        template_title: template.title,
        variable_values: values,
        source_files: uploadedUrls,
        status: 'completed',
      });
    } catch (err) {
      setError('Erro ao exportar documento');
    }
    setExporting(false);
  };

  const highlightedHtml = template ? highlightVariablesInHtml(template.content, values) : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-[#1a73e8] animate-spin" />
      </div>
    );
  }

  if (!template) {
    return <div className="p-8 text-center text-[#5f6368]">Template não encontrado</div>;
  }

  const hasResults = Object.keys(values).length > 0;

  return (
    <div className="flex h-full">
      {/* Main area - document preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-[#dadce0]">
          <Link to={`/templates/${id}`} className="text-[#5f6368] hover:text-[#202124]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-medium text-[#202124]">{template.title}</h1>
            <p className="text-xs text-[#5f6368]">Gerar documento com IA</p>
          </div>
          {hasResults && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] transition-colors disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? 'Exportando...' : 'Exportar DOCX'}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f8f9fa]">
          <div className="max-w-[816px] mx-auto my-6 bg-white shadow-md min-h-[1056px] p-16">
            <div
              className="doc-preview"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          </div>
        </div>
      </div>

      {/* Right panel - upload + AI + values */}
      <aside className="w-96 flex-shrink-0 bg-white border-l border-[#dadce0] flex flex-col overflow-y-auto">
        {/* Upload section */}
        <div className="px-5 py-4 border-b border-[#dadce0]">
          <h2 className="font-semibold text-[#202124] text-sm mb-3 flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#1a73e8]" />
            Documentos para Análise
          </h2>

          <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-[#dadce0] rounded-lg cursor-pointer hover:border-[#1a73e8] hover:bg-[#f8f9fa] transition-colors">
            <FileText className="w-8 h-8 text-[#5f6368]" />
            <span className="text-sm text-[#3c4043] font-medium">Clique para enviar</span>
            <span className="text-xs text-[#5f6368]">PDF, PNG, JPG</span>
            <input
              type="file"
              multiple
              accept=".pdf,image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-[#f8f9fa] rounded-md">
                  <FileText className="w-4 h-4 text-[#5f6368] flex-shrink-0" />
                  <span className="text-xs text-[#3c4043] truncate flex-1">{f.name}</span>
                  <button
                    onClick={() => removeFile(i)}
                    className="text-[#5f6368] hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={analyzing || files.length === 0}
            className="flex items-center justify-center gap-2 w-full mt-3 px-4 py-2.5 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] transition-colors disabled:opacity-50"
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {analyzing ? 'Analisando documentos...' : 'Analisar com IA'}
          </button>

          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>

        {/* Variables values */}
        <div className="flex-1 px-5 py-4">
          <h2 className="font-semibold text-[#202124] text-sm mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#1a73e8]" />
            Variáveis Preenchidas
          </h2>

          {variables.length === 0 ? (
            <p className="text-sm text-[#5f6368]">Este template não tem variáveis.</p>
          ) : (
            <div className="space-y-3">
              {variables.map((v) => (
                <div key={v.name}>
                  <div className="inline-flex items-center px-2 py-0.5 bg-[#e8f0fe] text-[#1a73e8] text-xs font-mono font-medium rounded mb-1">
                    {`{{${v.name}}}`}
                  </div>
                  {v.description && (
                    <p className="text-xs text-[#9aa0a6] mb-1">{v.description}</p>
                  )}
                  <input
                    type="text"
                    value={values[v.name] || ''}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                    }
                    placeholder="Aguardando análise..."
                    className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-md focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}