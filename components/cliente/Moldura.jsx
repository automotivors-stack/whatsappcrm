// Moldura das telas da área do cliente (login, cadastro e área logada): tema navy do site.

export const CLASSE_CAMPO =
  "mt-2 block w-full rounded-[8px] border border-white/15 bg-white/[0.05] px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-ltb-blue focus:outline-none focus:ring-2 focus:ring-ltb-blue/60";

export const CLASSE_BOTAO =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ltb-blue px-6 text-base font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ltb-blue-soft disabled:opacity-60";

export function Moldura({ children, largura = "max-w-md" }) {
  return (
    <div className="flex min-h-screen flex-col bg-ltb-navy-deep bg-[radial-gradient(70%_60%_at_85%_0%,rgba(37,99,235,0.22),transparent_70%)] text-white">
      <header className="mx-auto flex h-16 w-full max-w-7xl items-center px-5 sm:px-10">
        <a href="/" className="font-ltb-titulo text-base font-extrabold tracking-[-0.02em] text-white sm:text-lg" aria-label="Let's Touch Base, voltar ao site">
          Let&rsquo;s Touch Base<span className="text-ltb-green">.</span>
        </a>
      </header>
      <main id="conteudo" className={`mx-auto w-full ${largura} flex-1 px-5 pb-16 pt-6 sm:pt-12`}>
        {children}
      </main>
    </div>
  );
}

export function Erro({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-2 inline-flex items-center gap-2 rounded-[8px] bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900">
      <span aria-hidden="true">!</span> {children}
    </p>
  );
}

export function Aviso({ tipo = "erro", children }) {
  if (!children) return null;
  const cor = tipo === "erro" ? "border-amber-300 bg-amber-100 text-amber-950" : "border-white/15 bg-white/[0.06] text-slate-100";
  return (
    <p role={tipo === "erro" ? "alert" : "status"} className={`rounded-[8px] border px-4 py-3 text-sm ${cor}`}>
      {children}
    </p>
  );
}

function IconeGoogle() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false" className="h-[18px] w-[18px]">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export function BotaoGoogle({ onClick, ocupado, children = "Continuar com o Google" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupado}
      className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-white/20 bg-white px-6 text-base font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ltb-blue-soft disabled:opacity-60"
    >
      <IconeGoogle /> {children}
    </button>
  );
}

export function Divisor() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-400" aria-hidden="true">
      <span className="h-px flex-1 bg-white/15" /> ou <span className="h-px flex-1 bg-white/15" />
    </div>
  );
}
