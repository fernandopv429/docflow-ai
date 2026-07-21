import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { FileText, Plus, HelpCircle, PanelLeftClose, PanelLeftOpen, Briefcase } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Layout() {
  const [templates, setTemplates] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    base44.entities.Template.list('-updated_date', 50).then(setTemplates).catch(() => {});
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-[#f8f9fa]">
      {/* Sidebar */}
      <aside
        className={`${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 bg-[#f8f9fa] border-r border-[#dadce0] flex flex-col transition-all duration-200`}
      >
        <div className={`py-5 border-b border-[#dadce0] flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2 min-w-0">
              <FileText className="w-5 h-5 text-[#1a73e8] flex-shrink-0" />
              <span className="font-semibold text-[#202124] text-[15px] truncate">Editor de Documentos</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="p-1.5 text-[#5f6368] hover:bg-[#e8eaed] hover:text-[#202124] rounded-lg transition-colors flex-shrink-0"
          >
            {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        <div className={`py-4 ${collapsed ? 'px-2' : 'px-4'}`}>
          <Link
            to="/templates/new"
            title="Cadastrar Templates"
            className={`flex items-center justify-center gap-2 w-full py-2.5 border border-[#1a73e8] text-[#1a73e8] rounded-lg text-sm font-medium hover:bg-[#e8f0fe] transition-colors ${collapsed ? 'px-0' : 'px-4'}`}
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            {!collapsed && 'Cadastrar Templates'}
          </Link>
          <Link
            to="/trabalhista"
            title="Casos Trabalhistas"
            className={`flex items-center justify-center gap-2 w-full py-2.5 mt-2 rounded-lg text-sm font-medium transition-colors ${
              location.pathname.startsWith('/trabalhista')
                ? 'bg-[#e8f0fe] text-[#1a73e8]'
                : 'text-[#3c4043] hover:bg-[#f1f3f4]'
            } ${collapsed ? 'px-0' : 'px-4'}`}
          >
            <Briefcase className="w-4 h-4 flex-shrink-0" />
            {!collapsed && 'Casos Trabalhistas'}
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {!collapsed && (
            <div className="px-3 py-2 text-xs font-medium text-[#5f6368] uppercase tracking-wide">
              Meus Templates
            </div>
          )}
          {templates.length === 0 ? (
            !collapsed && <div className="px-3 py-2 text-sm text-[#9aa0a6]">Nenhum template ainda</div>
          ) : (
            templates.map((t) => (
              <Link
                key={t.id}
                to={`/templates/${t.id}`}
                title={t.title}
                className={`flex items-center gap-2 py-2 rounded-lg text-sm hover:bg-[#f1f3f4] transition-colors ${
                  collapsed ? 'justify-center px-0' : 'px-3'
                } ${
                  location.pathname === `/templates/${t.id}` || location.pathname === `/templates/${t.id}/generate`
                    ? 'bg-[#e8f0fe] text-[#1a73e8]'
                    : 'text-[#3c4043]'
                }`}
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{t.title}</span>}
              </Link>
            ))
          )}
        </div>

        <div className={`py-4 border-t border-[#dadce0] ${collapsed ? 'px-2 flex justify-center' : 'px-4'}`}>
          <button title="Ajuda" className="flex items-center gap-2 text-sm text-[#5f6368] hover:text-[#202124]">
            <HelpCircle className="w-4 h-4" />
            {!collapsed && 'Ajuda'}
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