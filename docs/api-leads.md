# API de leads

Todas as rotas exigem o usuário e a senha do consultor (HTTP Basic, `CRM_USUARIO` / `CRM_SENHA`).
Erros sempre no formato `{ "error": "mensagem" }`:

| Status | Quando |
|---|---|
| 415 | POST/PATCH sem `Content-Type: application/json` (proteção contra formulário forjado de outro site) |
| 502 | WhatsApp ou e-mail recusado pelo OpenWA/Resend (a tentativa fica registrada como `falha`) |
| 400 | JSON inválido, campo desconhecido, fase/fornecedor inválido, id inválido, fornecedor ausente em "Aprovado" ou depois |
| 401 | Sem usuário e senha, ou incorretos |
| 404 | `{ "error": "Oportunidade não encontrada" }` |
| 500 | Erro interno (detalhe só no log do servidor) |

Todas as consultas são parametrizadas (`sql` + `args`). Os únicos trechos de SQL montados no código
são nomes de coluna e condições de uma lista fixa; nenhum valor vindo da requisição entra no texto do SQL.

## GET /api/leads

Filtros opcionais, combináveis:

- `status`: uma das 7 fases (`Contato Recebido`, `Interessado`, `Avançado`, `Conta em Análise`, `Aprovado`, `Operando`, `Operando dentro das expectativas`)
- `fornecedor`: `Pushin Pay`, `Kluubpay` ou `sem_parceiro`
- `busca`: parte do nome/razão social ou do documento (até 100 caracteres). Termo só com dígitos e `. - /` também encontra o documento sem pontuação (`12345678` acha `12.345.678/0001-90`). `%` e `_` são tratados como texto.

```
GET /api/leads?fornecedor=Pushin%20Pay&busca=padaria
```

Resposta `200`, array em `created_at DESC`:

```json
[
  {
    "id": 1,
    "phone_number": "5521900000001",
    "nome_ou_razao_social": "Padaria Pão Quente Ltda",
    "documento": "12.345.678/0001-90",
    "status_kanban": "Aprovado",
    "fornecedor_operacao": "Pushin Pay",
    "dados_precificacao": { "fornecedor": "Pushin Pay", "versao_tabela": "2026-11-21", "valor_referencia": 1000, "itens": { "pix_in_f2": { "percentual": 0.99, "fixo": 0.5, "custo_base": { "percentual": 0.7, "fixo": 0.35, "moeda": "BRL" } } }, "atualizado_em": "2026-11-21T14:00:00.000Z" },
    "volume_real_mes": 0,
    "med_real_mes": 0,
    "saque_terceiros": false,
    "created_at": "2026-11-21 13:58:02"
  }
]
```

## PATCH /api/leads (id no corpo) e PATCH /api/leads/:id

Campos aceitos: `status_kanban`, `fornecedor_operacao`, `dados_precificacao`, `volume_real_mes`, `med_real_mes`,
`lucro_real_mes` (lucro líquido da consultoria no mês, em reais; pode ser negativo)
e `status_relacionamento` (modo do bot no contato do lead: `"pausado_humano"` ou `"ia_ativa"`; só o consultor troca,
mensagem do cliente nunca reativa a IA). Todo lead devolvido pela API traz `status_relacionamento`.
Qualquer outro campo é recusado com 400. Em `/api/leads/:id`, um `id` no corpo diferente do da URL também é recusado.

```json
PATCH /api/leads/1
{ "status_kanban": "Aprovado", "fornecedor_operacao": "Pushin Pay" }
```

```json
PATCH /api/leads
{ "id": 1, "dados_precificacao": { "valor_referencia": 1000, "itens": { "pix_in_f2": { "percentual": 0.99, "fixo": 0.5 }, "pix_out": { "fixo": 1.5 } } } }
```

```json
PATCH /api/leads/1
{ "volume_real_mes": 152000.5, "med_real_mes": 0.35 }
```

```json
PATCH /api/leads/1
{ "status_relacionamento": "ia_ativa" }
```

Resposta `200`: a oportunidade completa, já atualizada (mesmo formato da listagem).

Regras:
- `Aprovado`, `Operando` e `Operando dentro das expectativas` exigem `fornecedor_operacao` (`Pushin Pay` ou `Kluubpay`); sem ele, `400`.
- Trocar o fornecedor descarta a precificação anterior (`dados_precificacao` volta a `null`).
- `dados_precificacao.itens` só aceita produtos da tabela do fornecedor atual; o servidor grava junto o custo base vigente e a versão da tabela.
- `volume_real_mes` e `med_real_mes` (MED em %) precisam ser números ≥ 0.

```json
400 { "error": "Para mover para \"Aprovado\", selecione o fornecedor (Pushin Pay ou Kluubpay)." }
```

## GET /api/leads/:id (dossiê 360°)

Resposta `200`:

```json
{
  "lead": { "id": 1, "nome_ou_razao_social": "Padaria Pão Quente Ltda", "...": "..." },
  "mensagens": [
    { "id": 1, "role": "user", "content": "Oi, quero reduzir taxas", "created_at": "2026-11-21 13:58:02" },
    { "id": 2, "role": "assistant", "content": "Claro! Qual o volume mensal?", "created_at": "2026-11-21 13:58:05" }
  ],
  "interacoes": [
    { "id": 2, "oportunidade_id": 1, "tipo": "whatsapp", "destinatario": "5521900000001", "assunto": null, "mensagem": "Proposta enviada", "status_envio": "sucesso", "created_at": "2026-11-21 14:18:08" }
  ]
}
```

`mensagens` vem do `mensagens_historico` pelo telefone da oportunidade, em ordem cronológica (as 300 mais
recentes). `interacoes` vem em `created_at DESC`. As duas consultas rodam em paralelo (`Promise.all`).

## GET /api/leads/:id/interacoes

Resposta `200`: array de interações em `created_at DESC` (mesmo formato de `interacoes` acima).

## POST /api/leads/:id/interacoes

Só registra na linha do tempo: não envia WhatsApp nem e-mail.

```json
POST /api/leads/1/interacoes
{ "tipo": "email", "destinatario": "financeiro@cliente.com.br", "assunto": "Proposta de taxas", "mensagem": "Segue a proposta.", "status_envio": "sucesso" }
```

- `tipo` obrigatório (texto livre, até 50 caracteres; ex.: `whatsapp`, `email`, `ligacao`, `nota`).
- `assunto` ou `mensagem` obrigatório.
- `status_envio` opcional, padrão `sucesso`.
- `oportunidade_id` no corpo é opcional; se vier, precisa ser igual ao da URL.

Resposta `201`: a interação criada.

```json
{ "id": 3, "oportunidade_id": 1, "tipo": "email", "destinatario": "financeiro@cliente.com.br", "assunto": "Proposta de taxas", "mensagem": "Segue a proposta.", "status_envio": "sucesso", "created_at": "2026-11-21 14:20:00" }
```

## POST /api/whatsapp/send (envio REAL pelo OpenWA)

```json
POST /api/whatsapp/send
{ "oportunidadeId": 1, "telefone": "(21) 98888-7777", "mensagem": "Olá! Segue a proposta...", "idempotencyKey": "3f1c0f9e-..." }
```

- `telefone` opcional: sem ele, usa o `whatsapp_contato` do diagnóstico (ou o número que conversou com o bot).
  10 ou 11 dígitos ganham o 55; com `+` na frente, o DDI digitado é respeitado. Vira `<dígitos>@c.us`.
- `mensagem` obrigatória, até 4096 caracteres (limite do OpenWA).
- `idempotencyKey` opcional (a tela gera uma por rascunho): o OpenWA não reenvia a mesma chave por 24 h.

Resposta `201`:

```json
{ "success": true, "messageId": "wamid.ABC", "interacao": { "id": 7, "oportunidade_id": 1, "tipo": "whatsapp_enviado", "destinatario": "5521988887777", "assunto": null, "mensagem": "Olá! Segue a proposta...", "status_envio": "sucesso", "created_at": "2026-11-21 14:30:52" } }
```

Falha no OpenWA, `502` (a tentativa fica na linha do tempo com `status_envio: "falha"`):

```json
{ "error": "O WhatsApp não foi enviado. OpenWA recusou o envio (HTTP 400).", "interacao": { "id": 8, "tipo": "whatsapp_enviado", "status_envio": "falha", "...": "..." } }
```

## POST /api/email/send (envio REAL pelo Resend)

```json
POST /api/email/send
{ "oportunidadeId": 1, "email": "financeiro@cliente.com.br", "assunto": "Proposta de condições Pushin Pay", "corpoHtml": "<p>Olá!</p>", "corpoTexto": "Olá!", "idempotencyKey": "9b2e..." }
```

- `email` opcional: sem ele, usa o `email_contato` do diagnóstico. Um destinatário só.
- `assunto` obrigatório (até 200 caracteres; quebras de linha viram espaço).
- `corpoHtml` obrigatório. `corpoTexto` opcional: sem ele, é derivado do HTML (melhora a entrega).
- Remetente: `RESEND_FROM_EMAIL` (domínio verificado no Resend).
- "Sucesso" quer dizer que o Resend aceitou o e-mail; a entrega na caixa do cliente acontece depois.

Resposta `201`: `{ "success": true, "emailId": "re_123", "interacao": { "tipo": "email_enviado", "assunto": "...", "mensagem": "<p>Olá!</p>", "status_envio": "sucesso", "...": "..." } }`.
Falha no Resend: `502 { "error": "O e-mail não foi enviado. Resend recusou o envio (HTTP 403): ...", "interacao": { "status_envio": "falha", ... } }`.

Quando o WhatsApp vai para o mesmo número que conversa com o bot, a mensagem também entra em
`mensagens_historico` com `role: "consultor"`: a IA passa a ver o que o consultor combinou.

Se o envio sair mas o registro na linha do tempo falhar, a resposta é `500` com
"... enviado, mas não foi registrado na linha do tempo. Não reenvie; avise o suporte."

## GET /api/dashboard/metrics?periodo=mes|90d|tudo

Métricas do Dashboard Executivo. `periodo` (padrão `mes`) vale para o **funil e a conversão** (leads pela data
de entrada no CRM). Carteira, TPV, lucro e MED são o **retrato atual**: o último valor lançado em cada conta.

```json
{
  "periodo": { "id": "mes", "rotulo": "Este mês" },
  "funil": { "fases": [{ "fase": "Contato Recebido", "quantidade": 1 }], "total": 8, "convertidos": 4, "conversao": 0.5 },
  "operacao": { "contas_em_operacao": 3, "tpv": 985000, "volume_declarado": 950000, "atingimento_volume": 1.037 },
  "lucro": { "realizado": 12900, "meta": 25000, "progresso": 0.516, "contas_com_lancamento": 2 },
  "carteira": { "total_clientes": 8, "parceiros": [
    { "fornecedor": "Pushin Pay", "rotulo": "Pushin Pay", "clientes": 3, "percentual_clientes": 0.375, "em_operacao": 2, "volume": 165000, "percentual_volume": 0.168 }
  ] },
  "alertas_med": [6],
  "contas": [{ "id": 6, "nome": "Info Cursos", "fornecedor": "Kluubpay", "volume_declarado_texto": "R$ 800 mil", "volume_declarado": 800000,
               "volume_real": 820000, "atingimento_volume": 1.025, "med_real": 0.9, "med_teto_texto": "0,5%", "med_teto": 0.5,
               "med_status": "acima", "lucro_real": 9800 }]
}
```

- Conversão = leads do período que estão em Aprovado, Operando ou Operando dentro das expectativas ÷ leads do período.
- `med_status`: `dentro`, `acima` (MED real maior que o teto declarado), `sem_referencia` (teto não declarado ou
  sem número) ou `sem_lancamento` (volume e MED reais ainda zerados).
- Volume declarado e teto de MED vêm do diagnóstico como texto ("R$ 150 mil", "0,5%") e são lidos como número;
  quando não dá para ler, o valor fica `null` e não entra nas somas.
- Meta: `META_LUCRO_MENSAL` (padrão 25000). Lucro realizado = soma de `lucro_real_mes` das contas em operação.

## GET /api/aprovacoes e POST /api/aprovacoes/:id

Contingência do SIM/NÃO no WhatsApp do consultor. Todo diagnóstico concluído pela IA fica em
`aprovacoes_pendentes` com status `aguardando` (pendente de aprovação) antes de qualquer aviso; se o aviso no
WhatsApp falhar, o erro vai para o log e a pendência fica com `aviso_enviado = 0`. O Kanban e o Dashboard mostram
"🔔 N diagnósticos concluídos aguardando aprovação" com o resumo e os botões Aprovar (SIM) / Descartar (NÃO).

```
GET /api/aprovacoes
→ 200 [ { "id": 2, "telefone": "5521977776666", "aviso_enviado": false, "created_at": "...", "dados": { "nome_ou_razao_social": "...", "resumo_executivo": "..." } } ]

POST /api/aprovacoes/2   { "decisao": "SIM" }   → 200 { "resultado": "aprovado", "oportunidadeId": 15 }
POST /api/aprovacoes/2   { "decisao": "NAO" }   → 200 { "resultado": "descartado" }
```

- Mesma regra do WhatsApp: SIM cria o card em "Contato Recebido"; NÃO descarta; nada é apagado.
- Já decidida (pelo WhatsApp, por outra aba ou ao mesmo tempo) → `409 { "error": "Este diagnóstico já foi decidido." }`.
  Duas aprovações simultâneas criam um único card.
- `decisao` diferente de SIM/NAO → 400; id inexistente → 404; sem `Content-Type: application/json` → 415.
