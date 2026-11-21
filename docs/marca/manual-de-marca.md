# Let's Touch Base. — Manual de identidade visual e diretrizes de produto

Transcrição fiel do PDF `lets-touch-base-manual-de-marca-v1.0.pdf` (nesta pasta), para leitura e busca por pessoas e
assistentes de IA. Em caso de divergência, vale o PDF.

**Versão 1.0 · 21 de novembro de 2026 · Direção conceitual para validação.**
Documento conceitual, sujeito a refinamento e homologação antes de uso como identidade oficial. O logotipo apresentado
é uma referência conceitual, não um arquivo vetorial final homologado.

> **Every conversation moves business forward.** — Cada conversa impulsiona novos negócios.

## 01 Essência e posicionamento

- **Nome:** Let's Touch Base.
- **Descritor:** Intelligent Sales Workspace.
- **Categoria:** CRM comercial com IA conversacional e governança humana.
- **Propósito:** transformar conversas em oportunidades qualificadas, decisões comerciais melhores e relacionamentos duradouros.
- **Promessa:** A IA cuida da complexidade. Você cuida dos negócios.
- **Posicionamento:** plataforma de inteligência comercial para consultorias e operações B2B, inicialmente especializada
  em meios de pagamento, com possibilidade de expansão a outros setores.

## 02 Missão, visão e valores

- **Missão:** potencializar a performance comercial com IA, automação e dados, preservando o relacionamento humano e o
  controle das decisões.
- **Visão:** ser referência em inteligência comercial conversacional e gestão integrada de oportunidades.
- **Valores:** inteligência com propósito · humanidade no centro · confiança, rastreabilidade e transparência ·
  eficiência sem complexidade · relacionamentos que geram valor · evolução contínua.

## 03 Personalidade e voz

- **Atributos:** sofisticada, próxima, segura, objetiva, inteligente e moderna.
- **Tom:** consultivo, claro, assertivo e cordial.
- **Evitar:** exageros, jargão desnecessário e promessas de resultado garantido.
- **Mensagem principal:** "Every conversation moves business forward."
- **Alternativas de campanha:** "Less busywork. More business." e "Inteligência para conversar. Controle para crescer."

## 04 Sistema de identidade visual

### Logotipo e símbolo

- **Direção conceitual:** balão de conversa com check de validação, contorno contínuo e cantos arredondados;
  representa comunicação, aprovação humana e progresso comercial.
- **Wordmark:** "Let's Touch Base." em tipografia geométrica forte, com ponto final opcional apenas nas versões
  previamente aprovadas. Não redesenhar livremente o símbolo em cada tela.
- **Versões a produzir:** principal horizontal; empilhada; monocromática clara; monocromática escura; símbolo isolado; favicon.
- **Área de respiro:** mínimo igual à altura do check ao redor da assinatura.
- **Tamanho mínimo sugerido:** 140 px de largura (assinatura horizontal) e 24 px (ícone isolado); validar legibilidade em teste real.
- **Usos proibidos:** distorcer, girar, adicionar sombra não aprovada, trocar gradiente arbitrariamente, aplicar sobre
  fundo sem contraste, substituir o check por outros ícones ou usar a marca WhatsApp como parte do logotipo.

### Paleta oficial proposta

| Token | HEX | Papel |
|---|---|---|
| Midnight Navy | `#0B1F44` | Marca, títulos, navegação |
| Electric Blue | `#2563EB` | Ação primária, links, foco |
| Growth Green | `#22C55E` | Sucesso, operação saudável |
| AI Purple | `#7C3AED` | IA e insights |
| Slate | `#94A3B8` | Texto auxiliar, bordas |
| Cloud White | `#F8FAFC` | Fundo claro |

**Regra:** verde não substitui o azul em ações primárias; vermelho/âmbar ficam reservados para risco, falha ou atenção.
Gradientes são recursos de branding e não devem prejudicar leitura ou contraste.

### Tipografia e iconografia

- **Primária:** Inter (UI, títulos e corpo). **Alternativa:** Manrope (títulos e campanhas). **Fallback:** system-ui, Arial, sans-serif.
- **Escala (tamanho/altura de linha):** 32/40 título de página · 24/32 seção · 18/26 card · 14/22 corpo · 12/18 metadados.
- **Pesos:** 400, 500, 600, 700.
- **Ícones:** lineares e consistentes, traço 1,75–2 px, cantos arredondados.

## 05 Diretrizes de interface (Design System)

- **Grid:** base de 8 px; espaçamentos 4, 8, 12, 16, 24, 32, 48.
- **Raios:** 8 px inputs · 12 px cards · 16 px painéis.
- **Superfícies:** fundos claros `#F8FAFC`, cards brancos, texto principal `#0B1F44`; bordas suaves e sombras discretas.
- **Modo escuro:** opcional, com tokens próprios e verificação de contraste.
- **Botões:** primário azul; secundário contornado; destrutivo vermelho somente para ações irreversíveis; estados hover,
  focus-visible, disabled e loading.
- **Inputs:** labels persistentes, validação contextual, máscara de documento sem alterar o valor de busca sanitizado.
- **Acessibilidade:** mirar WCAG 2.2 AA; contraste mínimo 4,5:1 para texto normal, 3:1 para texto grande e indicadores
  não textuais; navegação por teclado e foco visível.

### Aplicação ao CRM

- **Kanban de sete fases:** Contato Recebido → Interessado → Avançado → Conta em Análise → Aprovado → Operando →
  Operando dentro das expectativas. Não representar mudança de fase apenas por cor.
- **Ficha 360°:** diagnóstico, histórico unificado, parceiro, taxas autorizadas, timeline e ações multicanal com hierarquia visual clara.
- **IA:** usar roxo para identificar recomendações ou conteúdos gerados por IA; sinalizar quando algo requer confirmação humana.
- **Governança:** exibir aprovação obrigatória do administrador antes de criar lead no CRM; status pendente, aprovado
  ou recusado devem ser explícitos.
- **Precificação:** nunca exibir custo base ou spread em propostas externas; limitar visualização conforme perfil e contexto.
- **Risco:** alertas de MED/chargeback e divergência de TPV devem conter descrição, gravidade e próximo passo, não apenas cor.
- **Métricas:** mostrar TPV, progresso para meta configurável e lucro líquido com período, fonte e data de atualização.

## 06 Nomenclatura de módulos (proposta)

- **Touch Intelligence** — triagem e qualificação com IA
- **Touch Pipeline** — CRM e Kanban
- **Touch Connect** — WhatsApp e e-mail
- **Touch Pricing** — mesa de precificação
- **Touch Insights** — dashboard e analytics
- **Touch Radar** — monitoramento de riscos

Os nomes são sugestões de arquitetura de produto e não devem ser tratados como marcas registradas ou módulos já lançados.

## 07 Regras de comunicação comercial

Não afirmar que a IA garante zero erros, elimina chargebacks ou assegura aumento de receita. Não divulgar custos
internos, margens, regras de risco sensíveis ou condições não cadastradas. Diferenciar funcionalidades existentes de
ideias de roadmap. Materiais externos devem focar no valor ao cliente: produtividade, organização, governança,
visibilidade e relacionamento.

## 08 Orientações para implementação pelo Claude

**Objetivo:** aplicar a identidade visual proposta à aplicação Next.js existente, sem reescrever a lógica de negócio.
Antes de alterar código, auditar componentes, estilos, tokens e fluxos; apresentar plano de arquivos e impactos para aprovação.

- Criar tokens semânticos de cor, tipografia, espaçamento, raio, elevação e estados; evitar cores hardcoded espalhadas.
- Criar componentes reutilizáveis para navegação, cards, badges, botões, formulários, tabelas, Kanban, timeline e indicadores.
- Preservar OpenWA, Resend, Turso SQLite Edge, queries parametrizadas, idempotência, anti-CSRF e regras de autenticação/autorização.
- Preservar a trava de aprovação via WhatsApp do administrador ("SIM") antes de inserir leads no CRM, e o transbordo
  humano sem reativação automática indevida.
- Preservar a regra de parceiro obrigatório para fases Aprovado ou posteriores, e sigilo de custos/margens nas propostas.
- Não criar nem alterar taxas, prazos, parceiros, metas, políticas ou limites operacionais sem fonte de configuração confirmada.
- Validar responsividade desktop/mobile, acessibilidade, estados vazios, carregamento, erro e sucesso; registrar mudanças e testes.
- Usar a arte conceitual apenas como referência estética; não reproduzir literalmente números, nomes ou dados ilustrativos do mockup.

**Prompt pronto (do manual):** "Atue como designer de produto sênior e engenheiro front-end. Use este manual como fonte
de verdade visual para a Let's Touch Base. Primeiro faça um diagnóstico da UI existente e proponha um plano de
implementação incremental. Não altere integrações, lógica comercial, governança, permissões, tabelas de taxas ou regras
de segurança. Crie tokens e componentes reutilizáveis, priorize acessibilidade e responsividade, e entregue uma lista de
arquivos alterados, screenshots de antes/depois e testes realizados. Peça aprovação antes de mudanças estruturais."

## 09 Checklist de aprovação da marca

- [ ] Aprovar desenho vetorial final e variantes do logotipo
- [ ] Validar disponibilidade de domínio e eventual conflito de marca registrada
- [ ] Testar contraste e legibilidade em telas reais
- [ ] Definir formatos SVG, PNG e favicon e regras de exportação
- [ ] Homologar tokens de interface e biblioteca de componentes
- [ ] Revisar comunicação jurídica, privacidade e uso de marcas de parceiros
