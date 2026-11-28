# Deploy em produção: CRM na Vercel, OpenWA na VPS

Arquitetura:

```
Lead (WhatsApp) ──► OpenWA (VPS, Docker, HTTPS) ──webhook assinado──► CRM (Vercel) ──► Turso (produção)
                       ▲                                                  │ ├──► Anthropic (IA)
                       └────────────── envios (X-API-Key) ◄───────────────┘ └──► Resend (e-mail)
```

Faça na ordem. Cada etapa diz como conferir antes de seguir. Pré-requisito: homologação concluída
(`docs/roteiro-homologacao.md`).

---

## 1. Banco de produção (Turso)

Banco **novo e vazio**, separado do de homologação (que continua para testes). Não rode o `seed` aqui.

```bash
turso db create lets-touch-base-prod
```

```bash
turso db show lets-touch-base-prod --url
```

```bash
turso db tokens create lets-touch-base-prod
```

Anote a URL (`libsql://...`) e o token. Escolha uma região do Turso próxima da região das funções da Vercel
(etapa 3.4): banco e função longe um do outro deixam cada consulta mais lenta.

Aplique as migrações **da sua máquina**, apontando só esta vez para o banco de produção (as variáveis do terminal
valem mais que o `.env`):

```bash
TURSO_DATABASE_URL="libsql://<url-de-producao>" TURSO_AUTH_TOKEN="<token-de-producao>" npm run verificar -- banco
```

Conferir: `✅ Conectado (Turso remoto)`, migrações 1 a 6, contatos 0, oportunidades 0.

---

**Migrações automáticas:** o `npm run build` roda `scripts/migrarNoBuild.mjs` antes do `next build`. No build de
produção da Vercel (`VERCEL_ENV=production`, com `TURSO_DATABASE_URL`), ele aplica as migrações pendentes; se falhar,
o build falha e a versão anterior continua no ar. Prévias e builds locais pulam. Com a integração Turso da Vercel
(prefixo `TURSO_DATABASE`), o token chega como `TURSO_DATABASE_AUTH_TOKEN`, aceito pelo sistema.

---

## 2. OpenWA na VPS

1. Use o `docker-compose.yml` **oficial** do OpenWA (já traz `restart: unless-stopped` e volumes para a sessão do
   WhatsApp sobreviver a reinícios). Siga a documentação do OpenWA para subir e criar a chave de API.
2. **HTTPS com domínio** (ex.: `openwa.seudominio.com.br`) por um proxy reverso (Caddy, Nginx ou Traefik). A Vercel
   chama o OpenWA pela internet: sem HTTPS, a chave de API trafega aberta.
3. Firewall: abra só 80/443 para o proxy. A porta interna do OpenWA (padrão 2785) não fica exposta.
4. No `.env` do OpenWA:
   - `RESOLVE_LID_TO_PHONE=true` (mensagens de contatos com identificador privado chegam com o telefone).
   - `SSRF_ALLOWED_HOSTS` **não** é necessário: a URL da Vercel é pública.
5. Crie a sessão e leia o QR Code com o **número oficial** da consultoria (etapa 6 fala do aquecimento).
6. Backup: inclua os volumes do OpenWA no backup da VPS. Perder o volume = ler o QR Code de novo.

Conferir da sua máquina (com `OPENWA_BASE_URL=https://openwa.seudominio.com.br` no `.env`):

```bash
npm run verificar -- whatsapp
```

---

## 3. CRM na Vercel

### 3.1 Projeto

1. Vercel → Add New → Project → importe `automotivors-stack/whatsappcrm`.
2. Framework: Next.js (detectado). Build `npm run build`, instalação `npm install` (padrões).
3. Node.js 22 (Settings → Build and Deployment → Node.js Version).
4. **Production Branch:** o branch que vai para produção. Hoje o trabalho está em `claude/lucid-ride-wde5o1`; o normal
   é juntar num `main` e usar `main` como produção.

### 3.2 Variáveis de ambiente (Settings → Environment Variables → Production)

Copie da homologação, trocando o banco:

| Variável | Valor de produção |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | os do banco **de produção** (etapa 1) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` (área do cliente) |
| `BETTER_AUTH_URL` | endereço público do site, sem barra no fim |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | opcionais: login com o Google (redirecionamento `<BETTER_AUTH_URL>/api/auth/callback/google`) |
| `OPENWA_BASE_URL` | `https://openwa.seudominio.com.br` (sem barra no fim) |
| `OPENWA_API_KEY`, `OPENWA_SESSION_ID` | os da VPS |
| `OPENWA_WEBHOOK_SECRET` | um valor **novo** (`openssl rand -hex 32`), diferente do da homologação |
| `ADMIN_WHATSAPP_NUMBER` | seu WhatsApp pessoal (diferente do número do bot) |
| `CRM_USUARIO`, `CRM_SENHA` | login do painel; senha forte e diferente da homologação |
| `ANTHROPIC_API_KEY` | chave de produção |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | remetente com domínio verificado |
| `META_LUCRO_MENSAL` | opcional (padrão 25000) |
| `AGENTE_MODELO` | **vazio** (padrão `claude-sonnet-5-5`) |
| `AGENTE_TIMEOUT_MS`, `AGENTE_TENTATIVAS_EXTRAS`, `OPENWA_TIMEOUT_MS` | **vazios** (padrões feitos para a Vercel) |

Variável alterada só vale no próximo deploy (Deployments → Redeploy).

### 3.3 Tempo de execução (por que os padrões importam)

A rota do webhook responde 200 na hora e continua o trabalho (IA, resposta ao lead, aviso ao consultor) dentro do
limite de tempo da função: `maxDuration = 60` em `app/api/webhooks/whatsapp/route.js`. O pior caso com os padrões é
~55 s: IA 18 s × 2 tentativas, dois envios ao OpenWA de 8 s cada e o banco. Se a função passar do limite, a Vercel
encerra no meio e o lead fica sem resposta **e** sem alerta.

- Se o seu plano permitir mais tempo e você quiser dar mais folga à IA: aumente `maxDuration` na rota **e** os tempos
  juntos. `tests/orcamento.test.js` confere a conta; rode `npm test` antes do deploy.
- Nunca aumente só os tempos da IA sem aumentar o `maxDuration`.

### 3.4 Região das funções

Settings → Functions → Region: a mesma área do banco Turso (ex.: São Paulo com São Paulo). Também próxima da VPS do
OpenWA, se possível.

### 3.5 Domínio e proteção

1. Settings → Domains: adicione o domínio do CRM (ex.: `crm.seudominio.com.br`) e configure o DNS indicado.
2. **Deployment Protection:** os deploys de *preview* ficam atrás do login da Vercel, e o OpenWA não passa por ele.
   Por isso o webhook aponta **só** para o domínio de produção, nunca para uma URL de preview.
3. O painel fica protegido pelo `CRM_USUARIO`/`CRM_SENHA` (o `proxy.js`); o webhook, pela assinatura HMAC.

Conferir: abra `https://crm.seudominio.com.br/dashboard`. O navegador pede usuário e senha, e o painel abre vazio.

---

## 4. Ligar o webhook de produção

Da sua máquina, com o `.env` apontando para o OpenWA de produção e o `OPENWA_WEBHOOK_SECRET` **igual** ao da Vercel:

```bash
npm run verificar -- webhook https://crm.seudominio.com.br
```

Conferir: `✅ Webhook cadastrado ... evento message.received`. Se houver um webhook antigo (da homologação ou de um
túnel) na mesma sessão do OpenWA, remova-o no painel do OpenWA, senão os eventos vão para os dois lugares.

---

## 5. Teste de fumaça em produção

Com um celular de teste (nem o do bot, nem o seu):

1. Mande "Oi" ao número do bot → resposta em poucos segundos.
2. Complete o diagnóstico → mensagem de encerramento ao lead e o resumo "🔔" no seu WhatsApp.
3. Responda SIM → card em "Contato Recebido" no Kanban.
4. Mova o card para "Interessado" e descarte-o se não for um lead real: **não há botão de excluir**, então use um nome
   que deixe claro que é teste (ex.: "TESTE produção") para identificar depois.

Logs: Vercel → Deployments → (deploy) → Logs. Linhas `[webhook]`, `[agente]`, `[aprovacao]`, `[comunicacao]`. Os logs
nunca mostram telefone completo nem conteúdo de mensagem.

---

## 6. Go-live

1. **Aquecimento do número:** o OpenWA usa o WhatsApp Web, não a API oficial da Meta. Volume alto e repentino (tráfego
   pago, envios em sequência) aumenta o risco de bloqueio do número. Comece com poucas conversas por dia e aumente aos
   poucos. Para escala, planeje a migração para a WhatsApp Cloud API oficial (exige trocar a camada de envio e o webhook).
2. **LGPD:** a política de privacidade deve informar que a conversa (inclusive CPF/CNPJ) é processada por IA (Anthropic)
   para qualificação. Não há comando de descadastro ("SAIR"); trate pedidos manualmente até existir um.
3. **Primeiros dias:** acompanhe a faixa "🔔 diagnósticos aguardando aprovação" e os alertas "⚠️ Alerta Operacional"
   no seu WhatsApp. Ajustes no tom da IA ficam em `services/aiDiagnosticService.js` (prompt).

## Checklist

| Etapa | Feito |
|---|---|
| 1. Banco de produção criado e migrado (contatos 0, oportunidades 0) | ☐ |
| 2. OpenWA na VPS com HTTPS, `RESOLVE_LID_TO_PHONE=true`, sessão conectada, `verificar -- whatsapp` ✅ | ☐ |
| 3. Projeto na Vercel, variáveis de produção, Node 22, região, domínio | ☐ |
| 4. Webhook cadastrado no domínio de produção (sem webhook antigo) | ☐ |
| 5. Teste de fumaça: resposta, resumo, SIM, card | ☐ |
| 6. Aquecimento planejado, política de privacidade atualizada | ☐ |

## Situação atual (22/11/2026)

- Projeto na Vercel: `alexandre-theofilo/whatsappcrm` (plano Hobby), ligado ao GitHub `automotivors-stack/whatsappcrm`.
- **Produção sai da `main`.** O branch de trabalho (`claude/lucid-ride-wde5o1`) gera só prévias; mudança vai para a
  `main` por PR aprovado pelo consultor. Endereço de produção provisório: https://whatsappcrm-xi-eight.vercel.app
  (domínio definitivo: `letstouchbase.com.br`, ainda não comprado).
- Proteção de acesso: deve proteger **só as prévias** (Settings → Deployment Protection → Vercel Authentication →
  "Only Preview Deployments"). Com "todas exceto domínio próprio", o `.vercel.app` de produção pede login da Vercel e o
  OpenWA não consegue chamar o webhook.
- Modo piloto (`PILOTO_ATIVO`, opcional): a IA só atende contato novo vindo do site ou da lista de teste
  (`docs/roteiro-homologacao.md`, item 5.1).
- Variáveis de ambiente: nenhuma cadastrada ainda. A landing funciona sem elas; o CRM responde 503 até cadastrar
  (lista na seção de variáveis acima).
