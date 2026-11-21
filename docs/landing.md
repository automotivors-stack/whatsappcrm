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
- A roda acompanha a rolagem da página nos dois sentidos (seção alta com a roda fixa; 0,3 tela de rolagem por passo; o palco fixo tem a tela inteira no desktop e 600 px no celular, `--ltb-palco` em globals.css,
  com pausa curta em cada pilar). No celular o cartão vai até metade da largura (`cardMaxWidth`, outro acréscimo nosso
  ao componente) e o nome ao lado do cartão some (o cartão e a lista já dizem o pilar). Para isso o componente ganhou o modo controlado (`progress`/`onRequest`), marcado no código;
  sem `progress` ele funciona como o original. Lista, setas e clique num cartão rolam a página até o pilar.
- A demo do prompt (página `/obras` com capas do Unsplash) não foi criada: seria uma rota nova atrás da senha e com
  imagens que não são da marca.

## Bloco "O que muda na sua operação." (parede 3D)
- `components/landing/OperacaoParede.jsx` usa `components/ui/3d-testimonials.jsx` (3D Testimonials, ProfitizeBuild,
  convertido para .jsx só sem os tipos; não reformatar). Frases em `content/operacao.js`.
- São 30 frases na voz da própria Let's Touch Base. (o que a plataforma faz), sem pessoas, empresas, números ou
  resultados; por isso não levam aviso. Vieram dos 30 depoimentos fictícios enviados pelo time em 21/11/2026, reescritos
  assim para não publicar depoimento inventado (CDC art. 37; Código do CONAR).
- Depoimento de cliente só em bloco próprio, real e com autorização por escrito de cada gestor.

## Botão de arrastar no fim dos blocos
- `components/ui/slide-confirm-button.jsx` (Slide Confirm Button, ProfitizeBuild, convertido para .jsx só sem os tipos;
  não reformatar) e `components/landing/DeslizeCTA.jsx`, com a identidade da marca pela classe `ltb-deslize` em
  `app/globals.css` (pílula navy, puxador Electric Blue, fonte Inter).
- No fim de "O problema" (Quero organizar), dos pilares (Agendar conversa) e dos depoimentos (Quero ver na prática).
- Agendamento: todos os botões de agendar (cabeçalho, hero, card Demonstração e os três de arrastar) abrem a agenda do
  Google em nova aba (`AGENDA_URL` em `content/contato.js`). O balão só diz "Abrindo a agenda": quem confirma o horário é a
  própria agenda. A pré-triagem (etapa 2) continua planejada; quando existir, decidir se substitui ou antecede a agenda.
- A demo do prompt (`/slide-confirm-button`, marca fictícia Vozi) não foi criada.

## Hero: quando a sequência aparece
- Normal: as 3 frases, a aceleração de 1x a 5x, a explosão e a assinatura (~18 s).
- "Reduzir movimento" do sistema (o "Remover animações" de muitos Android): as 3 frases também aparecem, uma a uma,
  só esmaecendo; sem deslizar, sem aceleração, explosão nem clarão.
- Animações muito atrasadas (mais de 7 s depois de a página reagir) ou sem JavaScript: versão parada, com as frases em
  texto, a assinatura e os botões, sem nada sobreposto. Chegar atrasado não recomeça a sequência.

## Botão flutuante de WhatsApp
- `components/landing/WhatsAppFlutuante.jsx`: só o símbolo do WhatsApp num círculo verde (pedido do time; o nome para o
  leitor de tela é "Fale com um especialista pelo WhatsApp"). Abre `WHATSAPP_URL` (`content/contato.js`) em nova aba, com
  a mensagem "Quero um diagnóstico do meu departamento comercial" já escrita.
- Aparece depois do hero e some ao voltar ao topo. No celular, sai de lado enquanto um botão de agendar está na tela
  (ficariam um por cima do outro).

## Último bloco: formulário de diagnóstico (`#demonstracao`)
- `components/landing/FormularioDiagnostico.jsx` + `content/diagnostico.js` (opções, validação e mensagem; testes em
  `tests/diagnosticoLanding.test.js`).
- Duas perguntas de escolha (prioridade, principal gargalo), nome (obrigatório) e empresa (opcional), resumo ao vivo.
  "Iniciar conversa com diagnóstico no WhatsApp" abre o WhatsApp do especialista com a mensagem montada; "Prefiro escolher
  um horário na agenda" abre `AGENDA_URL`.
- Nada é gravado no site (sem banco, sem cadastro, sem cookie): os dados vão só na mensagem que a pessoa envia. O aviso
  depois do clique diz que o WhatsApp abriu com a mensagem pronta, nunca que algo foi enviado.
- As opções são texto provisório (aprovar com o time). A pré-triagem com banco e painel continua planejada à parte.

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
