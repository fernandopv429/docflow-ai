import React from 'react';
import { Globe } from 'lucide-react';

export default function AnalysisSources({ sources }) {
  if (!sources?.trim()) return null;
  return (
    <div className="mt-3 px-3 py-2.5 bg-[#f8f9fa] border border-[#dadce0] rounded-md">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-[#3c4043] mb-1">
        <Globe className="w-3.5 h-3.5 text-[#1a73e8]" />
        Fontes consultadas pela IA
      </p>
      <p className="text-xs text-[#5f6368] whitespace-pre-wrap">{sources}</p>
    </div>
  );
}