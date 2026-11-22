// Rodapé da landing: marca e slogan; embaixo, razão social com CNPJ e o crédito de desenvolvimento.
// Espaço extra à direita e embaixo para o botão flutuante do WhatsApp não cobrir o texto.

import { DESENVOLVIDO_POR, EMPRESA } from "../../content/empresa.js";

export default function RodapeLanding() {
  return (
    <footer className="bg-ltb-navy-deep px-5 pb-28 pt-10 text-sm text-slate-400 sm:px-10 sm:pb-12">
      <div className="mx-auto max-w-7xl sm:pr-20">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-ltb-titulo text-base font-extrabold text-white">
            Let&rsquo;s Touch Base<span className="text-ltb-green">.</span>
          </p>
          <p lang="en">Every conversation moves business forward.</p>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs">
          <p>
            {EMPRESA.nome} · CNPJ {EMPRESA.cnpj}
          </p>
          <p>
            <span lang="en">Powered by </span>
            <a
              href={DESENVOLVIDO_POR.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-200 underline-offset-4 hover:text-white hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ltb-blue-soft"
            >
              {DESENVOLVIDO_POR.nome}
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
