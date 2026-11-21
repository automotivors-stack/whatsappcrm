// Depoimentos da landing (bloco components/landing/DepoimentosParede.jsx).
//
// REGRA: só entram depoimentos REAIS, com autorização por escrito de cada gestor (nome, cargo, empresa, foto e texto),
// guardada fora do repositório. Nada de nome, número ou resultado inventado: depoimento falso é publicidade enganosa
// (CDC, art. 37) e fere o Código do CONAR. Resultado só com o número que o próprio gestor informou e autorizou.
//
// Enquanto não houver depoimentos reais, os itens abaixo são marcados `exemplo: true` e o bloco mostra o aviso de
// prévia. Para publicar: troque cada item pelo real e apague `exemplo: true`.
//
// Campos: name (nome), username (empresa ou cargo, único: é a chave do cartão), body (o depoimento),
// country ("🇧🇷 Brasil"), img (opcional: endereço da foto autorizada; sem ela aparece a inicial do nome).

export const DEPOIMENTOS = [
  {
    exemplo: true,
    name: "Gestor comercial",
    username: "Exemplo 1 · empresa a confirmar",
    body: "[EXEMPLO] Espaço para o relato real de como a equipe passou a organizar os contatos que chegam pelo WhatsApp.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Gestora comercial",
    username: "Exemplo 2 · empresa a confirmar",
    body: "[EXEMPLO] Espaço para o relato real sobre a aprovação humana antes de o lead entrar no funil.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Gestor comercial",
    username: "Exemplo 3 · empresa a confirmar",
    body: "[EXEMPLO] Espaço para o relato real sobre o acompanhamento das propostas no Kanban.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Gestora comercial",
    username: "Exemplo 4 · empresa a confirmar",
    body: "[EXEMPLO] Espaço para o relato real sobre a qualificação dos contatos pela IA.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Gestor comercial",
    username: "Exemplo 5 · empresa a confirmar",
    body: "[EXEMPLO] Espaço para o relato real sobre a leitura da operação no painel.",
    country: "🇧🇷 Brasil",
  },
  {
    exemplo: true,
    name: "Gestora comercial",
    username: "Exemplo 6 · empresa a confirmar",
    body: "[EXEMPLO] Espaço para o resultado alcançado, com o número informado e autorizado pelo próprio gestor.",
    country: "🇧🇷 Brasil",
  },
];
