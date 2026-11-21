"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", rotulo: "Dashboard Executivo", icone: "📊" },
  { href: "/kanban", rotulo: "Pipeline Kanban", icone: "🗂️" },
];

export default function NavegacaoPrincipal() {
  const caminho = usePathname();
  return (
    <nav aria-label="Navegação principal" className="border-b border-slate-800 bg-slate-900">
      <div className="flex items-center gap-1 overflow-x-auto px-4 sm:px-6">
        <span className="mr-3 shrink-0 py-3 text-sm font-semibold text-white">CRM Meios de Pagamento</span>
        {LINKS.map((l) => {
          const ativo = caminho?.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={ativo ? "page" : undefined}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                ativo ? "border-white text-white" : "border-transparent text-slate-300 hover:text-white"
              }`}
            >
              <span aria-hidden="true">{l.icone}</span> {l.rotulo}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
