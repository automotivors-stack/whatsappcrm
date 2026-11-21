# Landing pública (Let's Touch Base.)

## Estado
- **Etapa 1 (entregue, em validação):** hero cinematográfico (túnel WebGL próprio, Three.js), sequência de frases,
  assinatura, transição "O futuro das vendas começa com uma conversa." e seção 2 ("O problema").
  As seções "A plataforma" e "Demonstração" são marcadores honestos ("em construção"); nada simula envio.
- **Próximas:** seções 3 a 13 do Master Prompt e o formulário de pré-triagem (etapa 2).

## Segurança
- Rota pública só `GET`/`HEAD /` (`ROTAS_PUBLICAS` em `proxy.js`); o restante do CRM segue com HTTP Basic.
- A landing não importa serviços, banco nem variáveis de ambiente do servidor.
- Rota nova pública só entra pela lista, com teste em `tests/acessoPublico.test.js`.

## Etapa 2 — pré-triagem própria (requisitos aprovados, ainda não implementados)
1. Tabela própria de pedidos de demonstração (migração nova em `lib/db.js`, só acrescenta).
2. Área administrativa protegida para ver, analisar, aprovar ou recusar.
3. Aviso por e-mail (Resend) a cada pedido.
4. Captura de UTM/origem com consentimento (LGPD).
5. Validação no servidor, antispam, limite de taxa e deduplicação.
6. Nunca inserir automaticamente no Kanban.
7. Depois da aprovação humana, criação controlada do card em "Contato Recebido".
8. Histórico de decisões e mudanças de status.
9. Arquitetura pronta para campanhas, analytics e automação.

O endpoint de envio será a segunda rota pública de escrita e precisa entrar em `ROTAS_PUBLICAS` com teste.
O formulário só confirma o pedido depois de gravá-lo.

## Limitações conhecidas
- WebGL testado só em Chromium com renderização por software (swiftshader); falta conferir em aparelhos reais.
- Logotipo em texto (o vetor final da marca ainda não existe).
