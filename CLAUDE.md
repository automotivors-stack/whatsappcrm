# Let's Touch Base — CRM com IA e WhatsApp

**Let's Touch Base.** · Intelligent Sales Workspace. CRM comercial com IA conversacional e governança humana para uma
consultoria de meios de pagamento: a IA qualifica o lead no WhatsApp, o consultor aprova (SIM/NÃO), o card entra no
Kanban, o consultor precifica (Pushin Pay / Kluubpay), envia propostas e acompanha a operação no dashboard.
Interface e mensagens 100% em português do Brasil.

## Marca (fonte de verdade visual)

Manual: `docs/marca/manual-de-marca.md` (transcrição) e `docs/marca/lets-touch-base-manual-de-marca-v1.0.pdf` (original).
**Leia o manual antes de qualquer mudança de interface ou texto voltado ao cliente.** Resumo:

- Versão 1.0 **conceitual**, ainda em homologação; o logotipo não tem arquivo vetorial final (não desenhar um por conta própria).
- Arte conceitual: `docs/marca/arte-conceitual-v1.0.webp` (só referência estética; ver as divergências anotadas no fim de
  `docs/marca/manual-de-marca.md`; nunca copiar números ou nomes do mockup).
- Paleta: Midnight Navy `#0B1F44` (marca, títulos, navegação) · Electric Blue `#2563EB` (ação primária, links, foco) ·
  Growth Green `#22C55E` (sucesso, operação saudável) · AI Purple `#7C3AED` (IA e insights) · Slate `#94A3B8`
  (texto auxiliar, bordas) · Cloud White `#F8FAFC` (fundo). Verde nunca é ação primária; vermelho/âmbar só para
  risco, falha ou atenção.
- Tipografia Inter (alternativa Manrope), escala 32/40 · 24/32 · 18/26 · 14/22 · 12/18; grid de 8 px; raios 8 (inputs),
  12 (cards), 16 (painéis); WCAG 2.2 AA.
- Conteúdo gerado por IA em roxo e sinalizado; estados (pendente/aprovado/recusado, risco) nunca só por cor.
- Tom: consultivo, claro, assertivo e cordial. Nunca prometer resultado garantido, zero erros ou fim de chargeback.
- Nomes de módulos (Touch Intelligence, Pipeline, Connect, Pricing, Insights, Radar) são **proposta**, não marca registrada.
- A identidade **ainda não foi aplicada** à UI. O manual (seção 08) exige diagnóstico e plano aprovado antes de mudar
  a interface; tokens semânticos em vez de cores soltas.

## Stack e comandos

Next.js 16 (App Router, JS) · React 19 · Tailwind 4 · Turso/libSQL (`@libsql/client`) · OpenWA (WhatsApp) ·
Resend (e-mail) · Anthropic (`@anthropic-ai/sdk`, IA do diagnóstico). Gerenciador: npm.

- `npm run dev` / `npm run build` / `npm start`
- `npm test` — suíte completa (node:test, `tests/*.test.mjs` e `tests/*.test.js`). Rodar antes de dizer que terminou.
- `npm run test:negocio` — os 5 cenários de homologação (`tests/regrasNegocio.test.js`)
- `npm run db:migrate` — migrações versionadas em `lib/db.js` (`MIGRACOES`)
- `npm run seed` — massa de exemplo; só apaga/recria registros `[EXEMPLO]` (telefones `5500900…`); remoto exige `--confirmar-remoto`
- `npm run verificar -- <ambiente|banco|whatsapp|email <destino>|ia|webhook <url>>` — testa os serviços reais
- Variáveis: `.env.example`. Scripts leem `.env` e `.env.local` (o `.env.local` prevalece; variáveis do terminal valem mais).
- Homologação com serviços reais: `docs/roteiro-homologacao.md`. API: `docs/api-leads.md`.
- Produção: CRM na **Vercel**, OpenWA em VPS, Turso de produção separado — `docs/deploy.md`. A rota do webhook tem
  `maxDuration = 60`; os tempos da IA e do OpenWA (`configAgente`, `timeoutOpenWA`) cabem nisso e
  `tests/orcamento.test.js` confere. Mudou um, ajuste o outro.

## Mapa do código

- `app/api/webhooks/whatsapp` → `services/webhookOpenwa.js` (assinatura HMAC) → `services/processarMensagem.js`
- `services/aiDiagnosticService.js` (IA, saída estruturada) · `services/agente.js` (ponto de entrada)
- `services/aprovacao.js` (pendências, SIM/NÃO, `decidirPendencia`) · `app/api/aprovacoes` (fallback no painel)
- `services/leads.js` + `app/api/leads` (Kanban, dossiê, interações) · `lib/kanban.js` (7 fases)
- `lib/custosParceiros.js` (tabelas de custo) · `lib/precificacao.js` (spread) · `lib/proposta.js` (texto ao cliente)
- `services/comunicacao.js` + `app/api/whatsapp/send`, `app/api/email/send` (disparos)
- `services/dashboard.js` + `app/api/dashboard/metrics` · `app/(crm)/kanban`, `app/(crm)/dashboard`, `components/`
- `lib/piloto.js` — modo piloto (`PILOTO_ATIVO`, desligado por padrão): contato novo só entra com a frase do site
  ("Quero um diagnóstico") ou na lista `PILOTO_NUMEROS_TESTE`; o resto é ignorado sem gravar nada (`tests/piloto.test.js`)
- `lib/origemSite.js` — o servidor lê a mensagem do formulário da landing e grava `contatos.origem = 'site'` e
  `dados_site` (a primeira origem fica); a IA recebe `<formulario_site>` e não pergunta de novo; aviso e dossiê mostram a origem
- Área do cliente: `lib/auth.js` (Better Auth, e-mail e senha ou Google; tabelas `cliente_*`, migração 6) ·
  `app/(site)/entrar`, `cadastro`, `cliente` · `services/contasClientes.js` + `app/api/contas-clientes` (consultor libera,
  recusa e vincula ao card; banner "Contas de clientes" no Kanban). Toda conta nasce `pendente`; `status_acesso` e
  `oportunidade_id` nunca vêm do navegador. O cliente vê só a fase (texto de cliente) e as mensagens entregues; nunca custo,
  spread, margem, precificação, fornecedor ou dossiê (`tests/areaCliente.test.js`). Conta de cliente nunca abre o CRM
- `proxy.js` — usuário e senha (HTTP Basic) em tudo, menos a lista `ROTAS_PUBLICAS` (landing, webhook, telas do cliente e `/api/auth/`);
  `tests/acessoPublico.test.js` mapeia todas as rotas e falha se algo novo abrir sem autenticação
- Landing pública: `app/(site)/page.jsx` + `components/landing/` (hero WebGL em `tunel.js`, GSAP/ScrollTrigger,
  modo estático para `prefers-reduced-motion` e sem JS). Não lê banco nem dados do CRM. Plano: `docs/landing.md`
- `components/ui/works-wheel.jsx` (roda de cartões, usada no bloco de pilares): copiado de prompt externo, com um acréscimo
  nosso (modo controlado `progress`/`onRequest`: a rolagem da página gira a roda nos dois sentidos; e `cardMaxWidth`); não reformatar
- `components/ui/3d-testimonials.jsx` + `content/operacao.js`: frases da própria marca, sem pessoas nem resultados; depoimento
  de cliente só real e com autorização por escrito (nunca inventado)
- `components/ui/slide-confirm-button.jsx` + `components/landing/DeslizeCTA.jsx` (cores em `.ltb-deslize`): o arrasto abre a
  agenda do Google em nova aba (`AGENDA_URL` em `content/contato.js`, a mesma de todos os botões de agendar); nunca diz que agendou
- `components/landing/FormularioDiagnostico.jsx` + `content/diagnostico.js`: último bloco; monta a mensagem e abre o WhatsApp
  (`WHATSAPP_NUMERO` em `content/contato.js`). Não grava nada no site; nunca diz que enviou

## Regras de negócio (nunca quebrar; cada uma tem teste)

1. **Aprovação humana pré-CRM:** nenhum card nasce sem SIM do consultor (WhatsApp `ADMIN_WHATSAPP_NUMBER` ou botão no
   painel, mesma função `decidirPendencia`). Aviso que falha não perde o lead (fica no painel).
2. **Transbordo humano:** contato `pausado_humano` nunca recebe resposta da IA; mensagem do cliente nunca reativa o bot.
   Só o consultor troca o modo (ficha). Falha da IA pausa o contato e alerta o consultor.
3. **Webhook:** assinatura HMAC obrigatória; descarta `fromMe`, grupos e status; deduplicação por `messageId` na mesma
   transação que grava a mensagem.
4. **Fornecedor:** Aprovado, Operando e Operando dentro das expectativas exigem `fornecedor_operacao` (HTTP 400).
   Trocar o fornecedor descarta a precificação.
5. **Sigilo comercial:** proposta ao cliente mostra só a taxa negociada; nunca custo base, spread ou margem. A IA nunca
   cita taxas, custos ou fornecedores.
6. **Tabelas de custo sem invenção:** só valores informados pelo consultor; o que faltar fica `null` ("custo não
   informado"). Mudou a tabela → nova `VERSAO_TABELA_CUSTOS`.
7. **Segurança:** SQL sempre parametrizado (só nomes de coluna de listas fixas no texto); escrita exige
   `Content-Type: application/json` (anti-CSRF); erros como `{ error }`; logs sem telefone completo nem conteúdo.
8. **Disparos:** chave de idempotência por rascunho (trocada sempre que o servidor responde); toda tentativa vai para
   `interacoes_cliente` (`sucesso`, `falha` ou `incerto`).

## Decisões já tomadas (não reabrir sem o consultor)

- Grafia do parceiro no sistema: **Kluubpay** (não confirmada; o manual e mensagens usam "KlubbPay").
- Pushin Pay: cartão só **Visa e Mastercard**; fixo de **R$ 0,35 por parcela** (venda em Nx = 0,35 × N); crédito D+1
  e D+30 parcela a parcela; débito igual em D+1 e D+30.
- Diagnóstico: obrigatórios = nome/razão social, documento, negócio, volume mensal, métodos de pagamento
  (`DIAGNOSTICO_OBRIGATORIOS` muda); secundários ficam "Não informado / A apurar". Encerramento com texto fixo no código.
- IA: modelo padrão `claude-sonnet-5-5` (`AGENTE_MODELO`), esforço `low`, fallback do servidor em recusa.
- Lucro do mês é lançado pelo consultor (`lucro_real_mes`); não há cálculo automático (falta o mix de produtos) nem
  histórico mês a mês. Meta em `META_LUCRO_MENSAL` (padrão 25000). Teto de MED = taxa declarada no diagnóstico.

## Como trabalhar

- Mudanças pequenas, um commit por passo, mensagem em português. Branch de trabalho: `claude/lucid-ride-wde5o1`.
- Produção na Vercel (projeto `alexandre-theofilo/whatsappcrm`) sai da `main`; o branch de trabalho gera só prévias.
  Nada vai para a `main` sem PR aprovado e juntado pelo consultor.
- Migração publicada nunca é reescrita: correção vira migração nova; só acrescentar (nada destrutivo sem aprovação).
- Antes de dizer que terminou: `npm test` e `npm run build` passando; para UI, abrir no navegador (Playwright) e olhar.
- Valores comerciais (taxas, metas, limites) ficam em configuração; nunca inventar. Na dúvida sobre regra de negócio, perguntar.
- Dados de exemplo sempre marcados `[EXEMPLO]`; nunca apresentar como reais.
