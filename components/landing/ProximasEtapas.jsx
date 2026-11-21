// Prévia em construção: destinos dos CTAs ("Conhecer a plataforma" e "Agendar demonstração")
// enquanto as próximas seções e o formulário de pré-triagem não existem. Nada aqui simula envio.

export default function ProximasEtapas() {
  return (
    <section className="bg-ltb-navy px-5 py-20 text-white sm:px-10 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2">
        <div id="plataforma" className="scroll-mt-24 rounded-[16px] border border-white/10 bg-white/5 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ltb-blue-soft">A plataforma</p>
          <h2 className="mt-3 font-ltb-titulo text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">
            Da primeira conversa à operação. Tudo conectado.
          </h2>
          <p className="mt-3 text-slate-300">
            A jornada completa — WhatsApp, IA comercial, aprovação humana, pipeline, proposta e analytics — entra na
            próxima etapa desta página.
          </p>
          <p className="mt-5 inline-flex rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300">Prévia: seção em construção</p>
        </div>
        <div id="demonstracao" className="scroll-mt-24 rounded-[16px] border border-white/10 bg-white/5 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ltb-green">Demonstração</p>
          <h2 className="mt-3 font-ltb-titulo text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">
            O próximo movimento pode transformar seu negócio.
          </h2>
          <p className="mt-3 text-slate-300">
            O formulário para agendar uma demonstração ainda não está disponível nesta prévia. Ele será publicado com
            validação, proteção antispam e consentimento, e só vai confirmar o pedido depois de registrá-lo de verdade.
          </p>
          <p className="mt-5 inline-flex rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300">Prévia: formulário em construção</p>
        </div>
      </div>
      <footer className="mx-auto mt-16 flex max-w-7xl flex-wrap items-baseline justify-between gap-3 border-t border-white/10 pt-8 text-sm text-slate-400">
        <p className="font-ltb-titulo text-base font-extrabold text-white">
          Let&rsquo;s Touch Base<span className="text-ltb-green">.</span>
        </p>
        <p lang="en">Every conversation moves business forward.</p>
      </footer>
    </section>
  );
}
