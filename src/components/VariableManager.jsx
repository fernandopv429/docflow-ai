import React, { useState } from 'react';
import { Variable as VariableIcon, Save, Loader2, Info, ChevronRight, ChevronLeft } from 'lucide-react';
import SkillSection from '@/components/SkillSection';
import EditorDocUpload from '@/components/EditorDocUpload';

export default function VariableManager({
  variables,
  onUpdateDescription,
  onSave,
  saving,
  skill,
  onUpdateSkill,
  content,
  title
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="w-12 flex-shrink-0 bg-white border-l border-[#dadce0] flex flex-col items-center py-3 gap-3">
        <button
          onClick={() => setCollapsed(false)}
          title="Expandir painel de variáveis"
          className="p-2 text-[#5f6368] hover:bg-[#f1f3f4] rounded-full"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="relative" title={`${variables.length} variáveis`}>
          <VariableIcon className="w-5 h-5 text-[#1a73e8]" />
          {variables.length > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center bg-[#1a73e8] text-white text-[10px] font-medium rounded-full">
              {variables.length}
            </span>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 flex-shrink-0 bg-white border-l border-[#dadce0] flex flex-col">
      <div className="px-5 py-4 border-b border-[#dadce0]">
        <div className="flex items-center gap-2">
          <VariableIcon className="w-4 h-4 text-[#1a73e8]" />
          <h2 className="font-semibold text-[#202124] text-sm flex-1">Variáveis</h2>
          <button
            onClick={() => setCollapsed(true)}
            title="Recolher painel"
            className="p-1 text-[#5f6368] hover:bg-[#f1f3f4] rounded-full"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[#5f6368] mt-1">
          Serão preenchidas pela IA ao analisar documentos
        </p>
      </div>

      <SkillSection skill={skill} onChange={onUpdateSkill} />

      <EditorDocUpload variables={variables} skill={skill} content={content} title={title} />

      {/* Variable list */}
      <div className="flex-1 overflow-y-auto">
        {variables.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Info className="w-8 h-8 text-[#dadce0] mx-auto mb-2" />
            <p className="text-sm text-[#5f6368]">Nenhuma variável detectada</p>
            <p className="text-xs text-[#9aa0a6] mt-1">
              Grife um trecho e clique em {'{{x}}'} ou use {'+{{}}'} na barra do editor
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#f1f3f4]">
            {variables.map((v) => (
              <div key={v.name} className="px-5 py-3">
                <div className="inline-flex items-center px-2 py-0.5 bg-[#e8f0fe] text-[#1a73e8] text-xs font-mono font-medium rounded">
                  {`{{${v.name}}}`}
                </div>
                <textarea
                  value={v.description || ''}
                  onChange={(e) => onUpdateDescription(v.name, e.target.value)}
                  placeholder="Descreva o que esta variável representa..."
                  rows={2}
                  className="w-full mt-2 px-3 py-2 text-sm border border-[#dadce0] rounded-md resize-none focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-[#dadce0]">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#1a73e8] text-white rounded-lg text-sm font-medium hover:bg-[#1557b0] transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : 'Salvar Template'}
        </button>
      </div>
    </aside>
  );
}