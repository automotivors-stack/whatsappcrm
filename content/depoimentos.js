// Depoimentos da landing (bloco components/landing/DepoimentosParede.jsx).
//
// REGRA: na versão publicada, só entram depoimentos REAIS, com autorização por escrito de cada gestor (nome, cargo,
// empresa, foto e texto), guardada fora do repositório. Nada de nome, número ou resultado inventado apresentado como
// real: isso é publicidade enganosa (CDC, art. 37) e fere o Código do CONAR.
//
// Os 30 itens abaixo foram enviados pelo time em 21/11/2026 como FICTÍCIOS, "destinados exclusivamente a
// demonstrações": pessoas e empresas não existem (nomes de empresa podem coincidir com empresas reais). Por isso cada um
// tem `exemplo: true` e o bloco mostra o aviso de demonstração (a pedido do time, o cartão não leva a palavra
// "fictício"; o aviso do bloco não pode sair enquanto houver item fictício). Antes de ir ao ar, troque pelos reais e
// apague `exemplo: true` (o aviso some quando nenhum item tiver a marca).
//
// Campos: name (nome), username (cargo · empresa; único, é a chave do cartão), body (o depoimento),
// country ("🇧🇷 Brasil"), img (opcional: endereço da foto autorizada; sem ela aparece a inicial do nome).

export const DEPOIMENTOS = [
  {
    exemplo: true,
    name: "Ricardo Monteiro",
    username: "CEO · Nexora Payments",
    body: "Antes, nossas oportunidades estavam espalhadas em conversas e planilhas. Na simulação com a Let’s Touch Base., conseguimos visualizar uma operação muito mais organizada, com histórico, prioridades e próximos passos em um só lugar.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Fernanda Albuquerque",
    username: "Diretora Comercial · Vértice Soluções Financeiras",
    body: "O que mais me chamou a atenção foi a possibilidade de qualificar contatos pelo WhatsApp sem transformar o atendimento em um interrogatório. É uma experiência muito mais próxima de uma conversa consultiva.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Marcelo Vieira",
    username: "Head de Vendas · AtlasPay Consulting",
    body: "A visão do pipeline permite entender rapidamente quais negociações precisam de atenção. Essa clareza faz muita diferença para uma equipe que trabalha com diversas oportunidades simultaneamente.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Juliana Prado",
    username: "Sócia-Diretora · BluePeak Consultoria",
    body: "Gostei especialmente do controle humano antes de uma oportunidade entrar no CRM. A automação ajuda, mas a decisão comercial precisa continuar nas mãos de quem conhece o negócio.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "André Vasconcelos",
    username: "Gerente Comercial · PrimeFlow Payments",
    body: "A proposta de reunir conversas, diagnóstico e negociação no mesmo ambiente é muito interessante. O consultor consegue dedicar mais atenção ao relacionamento e menos tempo à organização manual.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Patrícia Mendes",
    username: "COO · Elevare Fintech Solutions",
    body: "A mesa de precificação foi um dos pontos mais relevantes na demonstração. Ter clareza sobre as condições negociadas e preservar informações internas é essencial para uma operação profissional.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Eduardo Nogueira",
    username: "Diretor de Operações · OrbitPay Serviços",
    body: "A possibilidade de acompanhar o histórico completo de uma oportunidade muda a maneira como enxergamos a continuidade do atendimento. O contexto deixa de depender da memória de cada vendedor.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Camila Torres",
    username: "Head de Growth · Momentum Business Tech",
    body: "Uma das grandes vantagens do conceito é transformar o WhatsApp em uma fonte estruturada de oportunidades. A equipe comercial passa a ter mais contexto antes de iniciar a negociação.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Gustavo Almeida",
    username: "CEO · Conecta Capital Solutions",
    body: "A Let’s Touch Base. apresenta uma visão interessante de como tecnologia e relacionamento podem trabalhar juntos. A IA organiza informações, enquanto o consultor mantém a responsabilidade pelas decisões.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Renata Figueiredo",
    username: "Gerente de Relacionamento · NobrePay Consultoria",
    body: "O atendimento progressivo é um diferencial importante. Nem sempre o cliente possui todas as informações no primeiro contato, e o processo precisa respeitar essa realidade.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Felipe Martins",
    username: "Diretor Comercial · ScaleBridge Payments",
    body: "Conseguir enxergar a evolução de uma negociação desde o primeiro contato até a operação traz muito mais clareza para o acompanhamento comercial.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Beatriz Carvalho",
    username: "Sócia-Fundadora · Lumina Fintech Advisory",
    body: "A plataforma foi pensada para uma necessidade real de quem vende soluções financeiras: organizar informações complexas sem perder a proximidade com o cliente.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Daniel Ribeiro",
    username: "Head de Parcerias · NovaAxis Pay",
    body: "A separação das oportunidades por parceiro e estágio comercial facilita a análise do funil. É uma maneira objetiva de entender onde cada negociação está.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Larissa Oliveira",
    username: "Gerente de Vendas · FlowMetrics Consultoria",
    body: "A demonstração do Kanban mostrou como seria possível acompanhar prioridades com mais clareza. O valor está em saber exatamente qual é o próximo passo de cada oportunidade.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Thiago Moreira",
    username: "CEO · VantagePay Business",
    body: "A combinação de automação, precificação e acompanhamento operacional é o que torna a proposta interessante. Não se trata apenas de cadastrar contatos, mas de acompanhar toda a jornada comercial.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Mariana Lopes",
    username: "Diretora de Estratégia · CoreBridge Financial",
    body: "O radar de risco é uma funcionalidade particularmente relevante para meios de pagamento. Acompanhar indicadores operacionais ajuda a identificar situações que merecem atenção.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Rodrigo Sampaio",
    username: "Coordenador Comercial · PulsePay Solutions",
    body: "O conceito de ter uma IA fazendo a triagem inicial permite imaginar uma rotina mais focada em negociações qualificadas. Isso representa uma evolução importante no processo de prospecção.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Isabela Costa",
    username: "Head de Customer Success · Horizon Fintech",
    body: "O histórico unificado de interações é essencial para manter a continuidade do relacionamento. A experiência do cliente melhora quando ele não precisa repetir informações a cada contato.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Leonardo Azevedo",
    username: "Diretor Executivo · SummitPay Partners",
    body: "Gostei da proposta de manter as condições comerciais centralizadas e controladas. Para uma consultoria, governança e confidencialidade são tão importantes quanto velocidade.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Vanessa Rocha",
    username: "Gerente de Negócios · EloPrime Consultoria",
    body: "A plataforma apresenta uma maneira mais inteligente de conduzir o relacionamento comercial, desde a primeira mensagem até a negociação e o acompanhamento posterior.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Bruno Ferreira",
    username: "Sócio-Diretor · Stratos Payment Advisory",
    body: "A possibilidade de visualizar oportunidades, volume transacionado e indicadores financeiros no mesmo ambiente torna a gestão mais objetiva.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Aline Barros",
    username: "Head Comercial · IntegraPay Digital",
    body: "O mais interessante é que a IA não tenta substituir o vendedor. Ela organiza a etapa inicial para que a equipe possa concentrar energia nas decisões que realmente exigem experiência humana.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Caio Fernandes",
    username: "Diretor de Expansão · Vector Finance Solutions",
    body: "Uma estrutura comercial escalável precisa de processos claros. A Let’s Touch Base. apresenta justamente essa combinação entre padronização, flexibilidade e acompanhamento.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Priscila Andrade",
    username: "CEO · Aurum Payments",
    body: "O painel executivo oferece uma perspectiva muito útil sobre o desempenho da operação. Mais do que visualizar números, a ideia é entender onde agir.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Rafael Cardoso",
    username: "Gerente de Contas · BridgeOne Consultoria",
    body: "Ter acesso ao diagnóstico comercial e às interações anteriores ajuda a preparar conversas melhores. A qualidade do relacionamento depende muito da qualidade das informações.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Natália Freitas",
    username: "Diretora de Relacionamento · Connecta Financial Hub",
    body: "A integração entre comunicação e gestão comercial é um ponto forte do conceito. Ela evita que a conversa com o cliente fique desconectada do acompanhamento interno.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Henrique Batista",
    username: "Head de Operações · VertexPay Intelligence",
    body: "A rastreabilidade das ações e a separação entre automação e aprovação humana mostram uma preocupação importante com o controle operacional.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Carolina Teixeira",
    username: "Gerente de Estratégia Comercial · Evolve Business Payments",
    body: "O diferencial da plataforma está na forma como conecta qualificação, negociação e acompanhamento. A experiência transmite uma visão de processo comercial completo.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Pedro Henrique Lima",
    username: "Diretor de Vendas · NexaFlow Consultoria",
    body: "A demonstração da jornada comercial deixou evidente como a organização das informações pode apoiar uma equipe que precisa lidar com diferentes perfis de clientes e negociações.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Sofia Martins",
    username: "CEO · Elevon Payment Solutions",
    body: "A Let’s Touch Base. representa uma proposta de evolução para a gestão comercial: menos atividades repetitivas, mais contexto para decisões e maior atenção ao relacionamento com cada cliente.",
    country: "🇧🇷 Brasil",
  },
];
