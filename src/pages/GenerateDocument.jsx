import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Loader2, Download, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { extractVariables, highlightVariablesInHtml } from '@/lib/variables';
import { exportToDocx } from '@/lib/exportDocx';
import CorrectionChat from '@/components/CorrectionChat';
import { loadTemplateContent } from '@/lib/templateContent';
import { loadAnalysis } from '@/lib/analysisCache';
import AnalysisChat from '@/components/AnalysisChat';

export default function GenerateDocument() {
  const { id } = useParams();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadedUrls, setUploadedUrls] = useState([]);
  const [values, setValues] = useState({});
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [comTimbrado, setComTimbrado] = useState(true);

  useEffect(() => {
    base44.entities.Template
      .get(id)
      .then(async (t) => {
        const content = await loadTemplateContent(t);
        setTemplate({ ...t, content });
        const cached = loadAnalysis(id);
        if (cached && Object.keys(cached.values || {}).length > 0) {
          setValues(cached.values);
          setUploadedUrls(cached.urls || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const variables = template
    ? template.variables?.length
      ? template.variables
      : extractVariables(template.content)
    : [];

  const handleChatResults = (vals, urls) => {
    setValues(vals);
    setUploadedUrls(urls);
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
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-[#3c4043] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={comTimbrado}
                  onChange={(e) => setComTimbrado(e.target.checked)}
                  className="w-4 h-4 accent-[#1a73e8]"
                />
                Incluir timbrado
              </label>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] transition-colors disabled:opacity-50"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {exporting ? 'Exportando...' : 'Exportar DOCX'}
              </button>
            </div>
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
        {/* Analysis chat */}
        <div className="px-5 py-4 border-b border-[#dadce0]">
          <h2 className="font-semibold text-[#202124] text-sm mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#1a73e8]" />
            Chat de Análise
          </h2>

          <AnalysisChat
            variables={variables}
            skill={template.skill}
            webSearch={template.web_search}
            searchSites={template.search_sites}
            templateId={id}
            onResults={handleChatResults}
          />

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

      {hasResults && (
        <CorrectionChat
          template={template}
          variables={variables}
          values={values}
          onValuesChange={setValues}
          fileUrls={uploadedUrls}
          onSkillSaved={(newSkill) => setTemplate((prev) => ({ ...prev, skill: newSkill }))}
        />
      )}
    </div>
  );
}