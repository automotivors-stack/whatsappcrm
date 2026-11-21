# Landing pública (Let's Touch Base.)

## Estado
- **Etapa 1 (entregue, em validação):** hero cinematográfico (túnel WebGL próprio, Three.js), sequência de frases,
  assinatura, transição "O futuro das vendas começa com uma conversa." e seção 2 ("O problema").
  As seções "A plataforma" e "Demonstração" são marcadores honestos ("em construção"); nada simula envio.
- **Próximas:** seções 3 a 13 do Master Prompt e o formulário de pré-triagem (etapa 2).

## Bloco "pilares" (roda)
- `components/landing/PilaresRoda.jsx` usa a roda de `components/ui/works-wheel.jsx` (Works Wheel, ProfitizeBuild,
  convertida para .jsx só tirando as anotações de tipo; o arquivo não deve ser reformatado nem "melhorado").
- As quatro frases (Talento abre caminhos, Persistência move, Organização dá direção, Inteligência acelera) são cartões
  em SVG gerados no próprio componente: nada em `/public` (ficaria atrás da senha do `proxy.js`) e nada externo.
- Cores e fonte da marca entram pelas props (`style` com as variáveis `--ww-*`), sem mexer no componente.
- A roda acompanha a rolagem da página nos dois sentidos (seção alta com a roda fixa; 0,7 tela de rolagem por passo,
  com pausa em cada pilar). Para isso o componente ganhou o modo controlado (`progress`/`onRequest`), marcado no código;
  sem `progress` ele funciona como o original. Lista, setas e clique num cartão rolam a página até o pilar.
- A demo do prompt (página `/obras` com capas do Unsplash) não foi criada: seria uma rota nova atrás da senha e com
  imagens que não são da marca.

## Bloco de depoimentos (parede 3D)
- `components/landing/DepoimentosParede.jsx` usa `components/ui/3d-testimonials.jsx` (3D Testimonials, ProfitizeBuild,
  convertido para .jsx só sem os tipos; não reformatar). Dados em `content/depoimentos.js`.
- **Só depoimentos reais, com autorização por escrito** (nome, cargo, empresa, foto, texto e qualquer número citado).
  Nada inventado: depoimento falso é publicidade enganosa (CDC art. 37; Código do CONAR).
- Hoje: 30 depoimentos FICTÍCIOS enviados pelo time só para demonstração (21/11/2026), sem fotos, cada cartão marcado "fictício" e o bloco com aviso de demonstração. Trocar pelos reais antes de ir ao ar. A demo do prompt (`/3d-testimonials`, com
  nomes fictícios e fotos do Unsplash) não foi criada.

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
