# Roteiro de homologação com os serviços reais

Ordem segura: cada passo só depende dos anteriores. Marque o resultado na tabela do fim.
Os comandos rodam na pasta do projeto e leem `.env` e `.env.local` (o `.env.local` prevalece).

> **Atenção:** variáveis que já existem no terminal valem mais que os arquivos `.env`. Se um passo usar um valor
> inesperado, confira com `echo $NOME_DA_VARIAVEL`.

> **Banco:** use um banco Turso **só de homologação**. O sistema não tem botão de excluir lead, então tudo o que for
> criado nos testes fica no banco. Depois, troque `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` pelo banco de produção.

---

## 0. Preparação

1. Preencha as variáveis do `.env.example`. Além das do checklist, são obrigatórias:
   - `OPENWA_WEBHOOK_SECRET`: valor aleatório longo (`openssl rand -hex 32`). Sem ela o CRM recusa todo evento.
   - `CRM_USUARIO` e `CRM_SENHA`: login do painel. Sem elas o painel fica bloqueado.
2. Deixe `AGENTE_MODELO` **vazio** (padrão `claude-sonnet-5-5`). Modelos como `claude-3-5-sonnet-20241022` foram
   aposentados pela Anthropic e a API recusa.
3. `ADMIN_WHATSAPP_NUMBER` precisa ser **diferente** do número conectado ao OpenWA (o do bot). Se for o mesmo, o seu
   "SIM" chega como mensagem do próprio bot e é ignorado.
4. No **servidor do OpenWA** (não no CRM):
   - `RESOLVE_LID_TO_PHONE=true`, para mensagens de contatos com identificador privado chegarem com o telefone.
   - Se o CRM estiver na mesma máquina ou rede interna do OpenWA: `SSRF_ALLOWED_HOSTS=<host do CRM>`. Com URL pública
     (domínio ou túnel), não precisa.
5. Instale e confira:

```bash
npm install
```

```bash
npm run verificar -- ambiente
```

Esperado: `✅ Todas as variáveis necessárias estão preenchidas.` Se aparecer `❌`, corrija o item indicado.

---

## Teste 1. Banco Turso

```bash
npm run verificar -- banco
```

Esperado: `✅ Conectado (Turso remoto)` e as migrações 1 a 4 aplicadas. Rodar de novo responde "Banco já estava
atualizado" (não apaga nada).

| Erro | Causa provável |
|---|---|
| `401` / `Unauthorized` | `TURSO_AUTH_TOKEN` errado ou expirado (`turso db tokens create <banco>`) |
| `ENOTFOUND` / `fetch failed` | `TURSO_DATABASE_URL` com nome errado (`turso db show <banco> --url`) |

Opcional, só no banco de homologação: `npm run seed -- --confirmar-remoto` cria os 7 leads de exemplo (nomes
`[EXEMPLO]`, telefones que não existem) para olhar as telas antes do fluxo real.

---

## Teste 2. OpenWA e WhatsApp do consultor

```bash
npm run verificar -- whatsapp
```

Esperado: `✅ OpenWA aceitou a mensagem` e, no seu WhatsApp, "✅ Teste do CRM: a sessão do OpenWA está conectada...".

| Erro | Causa provável |
|---|---|
| `HTTP 401` | `OPENWA_API_KEY` errada |
| `HTTP 404` | `OPENWA_SESSION_ID` não existe no OpenWA |
| `HTTP 409` / `HTTP 503` | sessão desconectada: abra o painel do OpenWA e leia o QR Code de novo |
| `HTTP 400` | número do consultor não tem WhatsApp, ou formato errado (só dígitos com DDI) |
| `fetch failed` | `OPENWA_BASE_URL` inacessível desta máquina |

---

## Teste 3. Resend

```bash
npm run verificar -- email seu-email@seudominio.com.br
```

Esperado: `✅ Resend aceitou o e-mail` e o e-mail na caixa de entrada (olhe o spam também).

| Erro | Causa provável |
|---|---|
| `HTTP 401` | `RESEND_API_KEY` errada |
| `HTTP 403` / "domain is not verified" | domínio do `RESEND_FROM_EMAIL` não verificado no Resend (Domains → DNS) |
| `RESEND_FROM_EMAIL não configurado` | variável vazia |

---

## Teste 4. Anthropic (IA do diagnóstico)

```bash
npm run verificar -- ia
```

Esperado: `✅ Claude respondeu em X s`, uma pergunta natural ao lead, dados extraídos (nome, negócio, volume) e
`Concluir: false`. Custo: uma chamada curta.

| Erro | Causa provável |
|---|---|
| `401 authentication_error` | `ANTHROPIC_API_KEY` errada |
| `404 not_found_error` (model) | `AGENTE_MODELO` com modelo inexistente ou aposentado: deixe vazio |
| `429` / `529` | limite de uso ou sobrecarga momentânea: tente de novo em 1 minuto |
| `credit balance is too low` | sem crédito na conta da Anthropic |

---

## Teste 5. Jornada ponta a ponta

### 5.0 Subir o CRM e ligar o webhook

```bash
npm run build
```

```bash
npm start
```

O OpenWA precisa alcançar o CRM. Use o domínio do servidor ou, para teste local, um túnel (exemplo com Cloudflare):

```bash
cloudflared tunnel --url http://localhost:3000
```

Com a URL pública em mãos (ex.: `https://abc.trycloudflare.com`):

```bash
npm run verificar -- webhook https://abc.trycloudflare.com
```

Esperado: `✅ Webhook cadastrado ... evento message.received`. Rodar de novo não duplica. Se aparecer "Endereço interno
bloqueado", veja o item 4 da preparação.

Abra `https://<sua-url>/dashboard` e entre com `CRM_USUARIO`/`CRM_SENHA`.

### 5.1 Modo piloto (chip que também recebe outras conversas)

Se o número do bot ainda recebe conversas que não são leads, ligue o piloto na Vercel:
`PILOTO_ATIVO=true` e, se quiser testar de outro celular sem passar pelo site, `PILOTO_NUMEROS_TESTE=55DDDNUMERO`.

- Mensagem de quem nunca falou com o bot, sem a frase "Quero um diagnóstico": **ignorada**, nada é gravado e a IA
  não responde (log `[piloto] ... ignorada`).
- Mensagem enviada pelo formulário ou pelo botão do WhatsApp do site: a IA atende e o contato segue normalmente.
- Quem já é contato continua sendo atendido, com ou sem a frase.

Quem chega pelo formulário do site: a IA cumprimenta pelo nome, comenta a prioridade e o gargalo marcados e não pergunta
de novo nome, empresa, prioridade ou gargalo. O aviso no seu WhatsApp traz a linha `• Origem: site (...)` e o dossiê no
Kanban mostra o bloco "Veio do site".

Para encerrar o piloto, apague `PILOTO_ATIVO` (ou deixe `false`) e publique de novo.

### 5a. Bot atendendo e qualificando

Use um **terceiro celular** (nem o do bot, nem o do consultor). Envie ao número do bot:

> Oi, tenho uma loja e quero pagar menos taxa.

Esperado em poucos segundos: resposta natural, uma ou duas perguntas por vez. Responda como um cliente: nome da
empresa, CNPJ, o que vende, quanto fatura por mês e se quer Pix, cartão ou boleto. A IA pergunta os pontos secundários
(MED, limites, saque) uma vez; responder "não sei" é aceito.

Se o bot não responder, olhe o terminal do `npm start`:

| Log | Causa provável |
|---|---|
| nada aparece | webhook não chega: confira a URL cadastrada e o túnel |
| resposta `401` no OpenWA | `OPENWA_WEBHOOK_SECRET` diferente do `secret` do webhook: cadastre de novo |
| `remetente @lid sem senderPhone` | falta `RESOLVE_LID_TO_PHONE=true` no OpenWA |
| `[agente] falha da IA` | IA falhou: o contato foi pausado e você recebeu o "⚠️ Alerta Operacional" |

### 5b. Encerramento e resumo no seu WhatsApp

Ao completar os 5 pontos obrigatórios, o cliente recebe a mensagem fixa ("Perfeito, coletei todas as informações
iniciais... Um momento!") e o **seu** WhatsApp recebe "🔔 *Novo diagnóstico de meios de pagamento finalizado!*" com o
resumo e um código (#N).

Se o resumo não chegar: no painel aparece "🔔 1 diagnóstico concluído aguardando aprovação · 1 sem aviso no WhatsApp".

### 5c. SIM e card no Kanban

Responda **SIM** ao bot pelo seu WhatsApp. Esperado: "✅ Lead inserido com sucesso na fase 'Contato Recebido' do CRM!".
Abra o **Pipeline Kanban**: o card está em "1. Contato Recebido". Abra o card: diagnóstico, resumo e a conversa
completa (Cliente / IA).

Confira também a trava humana: mande outra mensagem pelo celular de teste. O bot **não** responde (está em modo
humano) e a mensagem aparece em "Conversa no WhatsApp" na ficha.

### 5d. Proposta por WhatsApp e e-mail

Na ficha do card:
1. Fornecedor **Pushin Pay** (ou Kluubpay) e fase **5. Aprovado**.
2. Na mesa de precificação, preencha as taxas cobradas de 2 ou 3 produtos e clique em **Salvar precificação**.
3. Em **Comunicação com o cliente → 📱 Enviar WhatsApp**: **Inserir proposta de taxas** → **Enviar via WhatsApp**.
   O celular de teste recebe a proposta, só com as taxas cobradas (nunca o custo).
4. Em **✉️ Enviar E-mail**: coloque o seu e-mail → **Inserir proposta de taxas** → **Enviar Proposta por E-mail**.
5. A linha do tempo mostra os dois envios; a conversa mostra a mensagem como "Consultor".

### 5e. Fechamento (opcional)

Mova o card para **6. Operando**, lance volume real, MED e lucro do mês em "Auditoria operacional" e confira o
**Dashboard Executivo**: TPV, meta, conversão e o status do MED.

---

## Registro do resultado

| Passo | Resultado | Observação |
|---|---|---|
| 0. Ambiente | ☐ ok ☐ falhou | |
| 1. Turso | ☐ ok ☐ falhou | |
| 2. OpenWA | ☐ ok ☐ falhou | |
| 3. Resend | ☐ ok ☐ falhou | |
| 4. Anthropic | ☐ ok ☐ falhou | |
| 5.0 Webhook | ☐ ok ☐ falhou | |
| 5a. Qualificação | ☐ ok ☐ falhou | tom e ordem das perguntas estão bons? |
| 5b. Resumo no WhatsApp | ☐ ok ☐ falhou | |
| 5c. SIM e card | ☐ ok ☐ falhou | |
| 5d. Proposta WhatsApp e e-mail | ☐ ok ☐ falhou | |
| 5e. Dashboard | ☐ ok ☐ falhou | |
