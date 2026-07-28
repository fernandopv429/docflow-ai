import React from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export default function GenerationApprovalMessage({ faltando = [], decided, onDecide }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] px-3.5 py-3 rounded-2xl rounded-bl-sm bg-[#fef7e0] border border-[#f9cc4a] text-sm text-[#5c4400]">
        <div className="flex items-center gap-1.5 font-medium mb-1.5">
          <AlertTriangle className="w-4 h-4 text-[#e0a800]" />
          Faltam informações para uma minuta completa
        </div>
        <ul className="list-disc pl-5 space-y-0.5 mb-2">
          {faltando.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        {decided ? (
          <p className="flex items-center gap-1.5 text-xs font-medium">
            {decided === 'sim'
              ? <><CheckCircle2 className="w-3.5 h-3.5" /> Geração aprovada — os dados que faltam ficarão com marcadores [ ].</>
              : <><XCircle className="w-3.5 h-3.5" /> Geração adiada — envie as informações que faltam.</>}
          </p>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => onDecide(true)}
              className="px-3 py-1.5 bg-[#1a73e8] text-white rounded-lg text-xs font-medium hover:bg-[#1557b0]"
            >
              Gerar mesmo assim
            </button>
            <button
              onClick={() => onDecide(false)}
              className="px-3 py-1.5 border border-[#dadce0] bg-white text-[#3c4043] rounded-lg text-xs font-medium hover:bg-[#f1f3f4]"
            >
              Aguardar mais dados
            </button>
          </div>
        )}
      </div>
    </div>
  );
}