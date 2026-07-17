import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { FileText, Plus, HelpCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Layout() {
  const [templates, setTemplates] = useState([]);
  const location = useLocation();

  useEffect(() => {
    base44.entities.Template.list('-updated_date', 50).then(setTemplates).catch(() => {});
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-[#f8f9fa]">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-[#f8f9fa] border-r border-[#dadce0] flex flex-col">
        <div className="px-5 py-5 border-b border-[#dadce0]">
          <Link to="/" className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#1a73e8]" />
            <span className="font-semibold text-[#202124] text-[15px]">Editor de Documentos</span>
          </Link>
        </div>

        <div className="px-4 py-4">
          <Link
            to="/templates/new"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-[#1a73e8] text-[#1a73e8] rounded-lg text-sm font-medium hover:bg-[#e8f0fe] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Templates
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          <div className="px-3 py-2 text-xs font-medium text-[#5f6368] uppercase tracking-wide">
            Meus Templates
          </div>
          {templates.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[#9aa0a6]">Nenhum template ainda</div>
          ) : (
            templates.map((t) => (
              <Link
                key={t.id}
                to={`/templates/${t.id}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[#f1f3f4] transition-colors ${
                  location.pathname === `/templates/${t.id}` || location.pathname === `/templates/${t.id}/generate`
                    ? 'bg-[#e8f0fe] text-[#1a73e8]'
                    : 'text-[#3c4043]'
                }`}
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{t.title}</span>
              </Link>
            ))
          )}
        </div>

        <div className="px-4 py-4 border-t border-[#dadce0]">
          <button className="flex items-center gap-2 text-sm text-[#5f6368] hover:text-[#202124]">
            <HelpCircle className="w-4 h-4" />
            Ajuda
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}