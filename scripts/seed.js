// Massa de demonstração: 7 leads em fases diferentes, conversas, interações e um diagnóstico
// aguardando o SIM do consultor. Uso: npm run seed   (lê TURSO_DATABASE_URL do ambiente / .env.local)
//
// SEGURANÇA
//  - Só apaga e recria os PRÓPRIOS registros de exemplo: telefones 55 00 9xxxx-xxxx (DDD 00 não
//    existe, então nenhuma mensagem chega a um número real) e nomes começando com "[EXEMPLO]".
//    Dados reais nunca são tocados.
//  - Por padrão só roda em banco local (file:). Em banco remoto (Turso) exige --confirmar-remoto.
//  - E-mails de exemplo usam o domínio reservado .example (não recebe e-mail).
//  - Taxas, volumes e lucros são de demonstração, não de clientes reais.

import { pathToFileURL } from "node:url";
import { getDb, migrar } from "../lib/db.js";
import { montarPrecificacao } from "../lib/precificacao.js";
import { KLUUBPAY, PUSHIN_PAY } from "../lib/custosParceiros.js";

export const PREFIXO_TELEFONE_DEMO = "550090000";
const tel = (n) => `${PREFIXO_TELEFONE_DEMO}${String(n).padStart(4, "0")}`;

/** Os 7 leads do Kanban + 1 diagnóstico aguardando aprovação. */
export const LEADS_DEMO = [
  {
    n: 1, nome: "[EXEMPLO] Padaria Pão Quente Ltda", fase: "Contato Recebido", fornecedor: null,
    tipo: "PJ", documento: "12.345.678/0001-90", negocio: "Padaria com delivery próprio", ondeOpera: "Maquininha do banco",
    volume: "R$ 60 mil", transacoes: 900, taxas: "Débito 1,9%, crédito 3,5%", med: "0,5%", limiteVenda: "R$ 2 mil",
    limiteSaque: "R$ 10 mil", saqueTerceiros: false, metodos: "Pix e cartão", integracao: "Checkout pronto",
    resumo: "Padaria de bairro com delivery, R$ 60 mil/mês. Quer reduzir taxas de cartão e receber Pix na hora. Recém-aprovada no CRM.",
    conversa: [
      ["user", "Oi! Vi o anúncio de vocês, quero pagar menos taxa na maquininha."],
      ["assistant", "Olá! Vamos entender a sua operação. Você vende como pessoa física ou empresa?"],
      ["user", "Empresa, Padaria Pão Quente."],
    ],
  },
  {
    n: 2, nome: "[EXEMPLO] Academia Digital Cursos Ltda", fase: "Interessado", fornecedor: null,
    tipo: "PJ", documento: "66.777.888/0001-99", negocio: "Infoprodutos: cursos e mentorias online", ondeOpera: "Hotmart e Kiwify",
    volume: "R$ 80 mil", transacoes: 600, taxas: "Pix 0,99%, cartão 4,9%", med: "Não informado / A apurar", limiteVenda: "R$ 2 mil",
    limiteSaque: "Não informado / A apurar", saqueTerceiros: null, metodos: "Pix e cartão", integracao: "Checkout pronto",
    resumo: "Produtora de infoprodutos, R$ 80 mil/mês entre Pix e cartão. Em qualificação: falta confirmar MED e limite de saque.",
    conversa: [
      ["user", "Boa tarde! Vendo cursos online e quero sair da Hotmart pra pagar menos taxa."],
      ["assistant", "Boa tarde! Vamos entender sua operação. Quanto você vende por mês, mais ou menos?"],
      ["user", "Uns 80 mil, metade Pix metade cartão."],
      ["consultor", "Oi, aqui é o consultor. Vou te mandar uma proposta ainda hoje."],
      ["user", "Combinado, fico no aguardo!"],
    ],
  },
  {
    n: 3, nome: "[EXEMPLO] Loja Bela Moda", fase: "Conta em Análise", fornecedor: KLUUBPAY,
    tipo: "PJ", documento: "98.765.432/0001-10", negocio: "Loja de roupas com e-commerce", ondeOpera: "PagSeguro",
    volume: "R$ 300 mil", transacoes: 2500, taxas: "Crédito 4,2%", med: "0,8%", limiteVenda: "R$ 5 mil",
    limiteSaque: "R$ 50 mil", saqueTerceiros: false, metodos: "Pix, cartão e boleto", integracao: "API",
    resumo: "E-commerce de moda, R$ 300 mil/mês, integração via API. Documentação enviada ao compliance da Kluubpay.",
    conversa: [["user", "Mandei o contrato social e o comprovante de endereço por e-mail."]],
  },
  {
    n: 4, nome: "[EXEMPLO] Pet Shop Amigo", fase: "Aprovado", fornecedor: PUSHIN_PAY,
    tipo: "PJ", documento: "55.666.777/0001-88", negocio: "Pet shop com banho e tosa", ondeOpera: "Stone",
    volume: "R$ 90 mil", transacoes: 1100, taxas: "Pix 0,99%, débito 1,6%", med: "0,5%", limiteVenda: "R$ 3 mil",
    limiteSaque: "R$ 20 mil", saqueTerceiros: false, metodos: "Pix e cartão", integracao: "Checkout pronto",
    resumo: "Pet shop, R$ 90 mil/mês. Aprovado na Pushin Pay; precificação de Pix com 0,40 p.p. acima do custo.",
    // Pix In: custo + 0,40 p.p. em cada faixa (D0)
    precificacao: {
      fornecedor: PUSHIN_PAY,
      valor_referencia: 150,
      itens: {
        pix_in_f1: { percentual: 0.4, fixo: 0.35 },
        pix_in_f2: { percentual: 1.1, fixo: 0.35 },
        pix_in_f3: { percentual: 1.3, fixo: 0.35 },
      },
    },
    conversa: [["consultor", "Conta aprovada na Pushin Pay! Segue a proposta de Pix."]],
  },
  {
    n: 5, nome: "[EXEMPLO] NuvemFlow SaaS e Cripto", fase: "Operando", fornecedor: KLUUBPAY,
    tipo: "PJ", documento: "11.222.333/0001-44", negocio: "SaaS de assinaturas com recebimento em cripto", ondeOpera: "Asaas",
    volume: "R$ 200 mil", transacoes: 1200, taxas: "Pix R$ 2,90", med: "0,5%", limiteVenda: "R$ 5 mil",
    limiteSaque: "R$ 30 mil", saqueTerceiros: true, metodos: "Pix e cripto USDT", integracao: "API",
    resumo: "SaaS de assinaturas, R$ 200 mil/mês declarados em Pix e parte em USDT. Operando na Kluubpay com MED controlado.",
    precificacao: {
      fornecedor: KLUUBPAY,
      valor_referencia: 150,
      itens: {
        pix_in: { percentual: 0, fixo: 2.5 }, // custo R$ 1,50
        pix_out: { percentual: 0, fixo: 2.5 }, // custo R$ 1,50
        cripto_usdt: { percentual: 4.5, fixo: 3.5 }, // custo 3,50% + R$ 2,50
      },
    },
    operacao: { volumeReal: 180000, medReal: 0.2, lucro: 1500 },
    conversa: [["user", "Primeiras liquidações caíram certinho, obrigado!"]],
  },
  {
    n: 6, nome: "[EXEMPLO] Eletrônicos Rápido (alerta de MED)", fase: "Operando", fornecedor: PUSHIN_PAY,
    tipo: "PJ", documento: "22.333.444/0001-55", negocio: "Loja online de eletrônicos", ondeOpera: "Cielo",
    volume: "R$ 400 mil", transacoes: 1800, taxas: "Crédito 3,9%", med: "1,0%", limiteVenda: "R$ 8 mil",
    limiteSaque: "R$ 80 mil", saqueTerceiros: false, metodos: "Pix e cartão", integracao: "API",
    resumo: "E-commerce de eletrônicos, R$ 400 mil/mês declarados. Operando na Pushin Pay; MED real acima do declarado.",
    precificacao: {
      fornecedor: PUSHIN_PAY,
      valor_referencia: 250,
      itens: { pix_in_f2: { percentual: 1.1, fixo: 0.35 }, credito_d30_1x: { percentual: 4.9, fixo: 0.5 } },
    },
    operacao: { volumeReal: 420000, medReal: 2.6, lucro: 1800 },
    conversa: [["user", "Tivemos umas contestações de Pix essa semana, é normal?"]],
  },
  {
    n: 7, nome: "[EXEMPLO] Rede Farmácias Vida", fase: "Operando dentro das expectativas", fornecedor: PUSHIN_PAY,
    tipo: "PJ", documento: "33.444.555/0001-66", negocio: "Rede com 6 farmácias", ondeOpera: "Rede e GetNet",
    volume: "R$ 1,1 milhão", transacoes: 14000, taxas: "Débito 1,5%, crédito 3,2%", med: "0,4%", limiteVenda: "R$ 3 mil",
    limiteSaque: "R$ 200 mil", saqueTerceiros: false, metodos: "Pix, cartão D+1 e D+30", integracao: "Checkout pronto",
    resumo: "Rede de farmácias, R$ 1,1 milhão/mês. Cliente consolidado, volume acima do prometido e MED baixo.",
    precificacao: {
      fornecedor: PUSHIN_PAY,
      valor_referencia: 80,
      itens: {
        pix_in_f1: { percentual: 0.5, fixo: 0.35 },
        debito: { percentual: 5.2, fixo: 0.35 },
        credito_d30_1x: { percentual: 4.9, fixo: 0.35 },
      },
    },
    operacao: { volumeReal: 1200000, medReal: 0.25, lucro: 9600 },
    conversa: [["consultor", "Fechamos o mês acima da meta de volume, parabéns!"]],
  },
];

/** Diagnóstico concluído pela IA, aguardando o SIM/NÃO do consultor (ainda não é card). */
export const PENDENTE_DEMO = {
  n: 8, nome: "[EXEMPLO] Auto Peças Sul (aguardando aprovação)",
  dados: {
    tipo_pessoa: "PJ", nome_ou_razao_social: "[EXEMPLO] Auto Peças Sul (aguardando aprovação)",
    documento: "44.555.666/0001-77", descricao_negocio: "Distribuidora de autopeças", onde_opera_hoje: "Banco do Brasil",
    volume_mensal: "R$ 250 mil", metodos_pagamento: "Boleto e Pix", taxa_med_operacao: "Não informado / A apurar",
    resumo_executivo: "Distribuidora B2B, R$ 250 mil/mês em boleto e Pix. Diagnóstico concluído pela IA; aguarda o SIM do consultor.",
  },
  conversa: [
    ["user", "Quero emitir boleto mais barato pra minha distribuidora."],
    ["assistant", "Perfeito, coletei todas as informações iniciais da sua operação! 🚀 Nosso consultor especialista em meios de pagamento já recebeu o seu dossiê e entrará em contato por aqui em instantes para apresentar as melhores taxas e condições. Um momento!"],
  ],
};

const INTERACOES_DEMO = [
  [2, "whatsapp_enviado", "Proposta de Pix enviada pelo WhatsApp.", null, "sucesso"],
  [3, "email_enviado", "<p>Recebemos sua documentação e enviamos ao compliance.</p>", "Documentação recebida", "sucesso"],
  [4, "email_enviado", "<p>Segue a proposta de condições Pushin Pay.</p>", "Proposta de condições Pushin Pay", "sucesso"],
  [4, "whatsapp_enviado", "Conta aprovada na Pushin Pay! Segue a proposta de Pix.", null, "sucesso"],
  [5, "whatsapp_enviado", "Integração concluída, primeiras liquidações confirmadas.", null, "sucesso"],
  [6, "whatsapp_enviado", "Identificamos MED acima do esperado. Podemos conversar hoje?", null, "falha"],
  [6, "email_enviado", "<p>Alerta: MED de 2,6% no mês, acima do teto de 1,0% declarado.</p>", "Alerta de MED", "sucesso"],
  [7, "email_enviado", "<p>Relatório mensal: volume 9% acima do prometido.</p>", "Relatório mensal", "sucesso"],
];

/** Apaga só os registros de exemplo (telefones demo), na ordem das chaves estrangeiras. */
export async function limparDemo(db) {
  const padrao = `${PREFIXO_TELEFONE_DEMO}%`;
  await db.batch(
    [
      { sql: "DELETE FROM interacoes_cliente WHERE oportunidade_id IN (SELECT id FROM oportunidades WHERE phone_number LIKE ?)", args: [padrao] },
      { sql: "DELETE FROM aprovacoes_pendentes WHERE phone_number LIKE ?", args: [padrao] },
      { sql: "DELETE FROM oportunidades WHERE phone_number LIKE ?", args: [padrao] },
      { sql: "DELETE FROM mensagens_historico WHERE phone_number LIKE ?", args: [padrao] },
      { sql: "DELETE FROM contatos WHERE phone_number LIKE ?", args: [padrao] },
      { sql: "DELETE FROM eventos_processados WHERE message_id LIKE 'seed-%'", args: [] },
    ],
    "write",
  );
}

/** Popula a massa de demonstração. Devolve { leads: { [n]: id }, pendenciaId }. */
export async function semear(db) {
  await migrar(db);
  await limparDemo(db);
  const ids = {};
  const comandos = [];

  for (const l of LEADS_DEMO) {
    const telefone = tel(l.n);
    const pausado = true; // todos já passaram pelo consultor
    comandos.push({
      sql: `INSERT INTO contatos (phone_number, nome, tipo_pessoa, documento, descricao_negocio, volume_mensal, status_relacionamento)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [telefone, l.nome, l.tipo, l.documento, l.negocio, l.volume, pausado ? "pausado_humano" : "ia_ativa"],
    });
    l.conversa.forEach(([role, content], i) => {
      comandos.push({
        sql: "INSERT INTO mensagens_historico (phone_number, role, content, created_at) VALUES (?, ?, ?, datetime('now', ?))",
        args: [telefone, role, content, `-${(l.conversa.length - i) * 7} minutes`],
      });
    });
  }
  // Pendente: contato pausado esperando o consultor
  const telPendente = tel(PENDENTE_DEMO.n);
  comandos.push({
    sql: "INSERT INTO contatos (phone_number, nome, tipo_pessoa, documento, volume_mensal, status_relacionamento, dados_diagnostico) VALUES (?, ?, 'PJ', ?, ?, 'pausado_humano', ?)",
    args: [telPendente, PENDENTE_DEMO.nome, PENDENTE_DEMO.dados.documento, PENDENTE_DEMO.dados.volume_mensal, JSON.stringify(PENDENTE_DEMO.dados)],
  });
  PENDENTE_DEMO.conversa.forEach(([role, content]) => {
    comandos.push({ sql: "INSERT INTO mensagens_historico (phone_number, role, content) VALUES (?, ?, ?)", args: [telPendente, role, content] });
  });
  await db.batch(comandos, "write");

  for (const l of LEADS_DEMO) {
    const precificacao = l.precificacao ? JSON.stringify(montarPrecificacao(l.precificacao.fornecedor, l.precificacao)) : null;
    const op = l.operacao ?? { volumeReal: 0, medReal: 0, lucro: 0 };
    const { rows } = await db.execute({
      sql: `INSERT INTO oportunidades (phone_number, tipo_pessoa, nome_ou_razao_social, documento, descricao_negocio, onde_opera_hoje,
              volume_mensal, numero_transacoes, taxas_atuais, taxa_med_operacao, limite_por_venda, limite_saque_diario, saque_terceiros,
              metodos_pagamento, tipo_integracao, whatsapp_contato, email_contato, resumo_executivo, status_kanban,
              fornecedor_operacao, dados_precificacao, volume_real_mes, med_real_mes, lucro_real_mes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
            RETURNING id`,
      args: [
        tel(l.n), l.tipo, l.nome, l.documento, l.negocio, l.ondeOpera, l.volume, l.transacoes, l.taxas, l.med,
        l.limiteVenda, l.limiteSaque, l.saqueTerceiros === null ? null : l.saqueTerceiros ? 1 : 0, l.metodos, l.integracao,
        tel(l.n), `financeiro${l.n}@cliente.example`, l.resumo, l.fase, l.fornecedor, precificacao,
        op.volumeReal, op.medReal, op.lucro, `-${(8 - l.n) * 2} days`,
      ],
    });
    ids[l.n] = Number(rows[0].id);
  }

  await db.batch(
    INTERACOES_DEMO.map(([n, tipo, mensagem, assunto, status], i) => ({
      sql: `INSERT INTO interacoes_cliente (oportunidade_id, tipo, destinatario, assunto, mensagem, status_envio, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))`,
      args: [ids[n], tipo, tipo === "email_enviado" ? `financeiro${n}@cliente.example` : tel(n), assunto, mensagem, status, `-${(INTERACOES_DEMO.length - i) * 3} hours`],
    })),
    "write",
  );

  const pend = await db.execute({
    sql: "INSERT INTO aprovacoes_pendentes (phone_number, dados, aviso_enviado) VALUES (?, ?, 1) RETURNING id",
    args: [telPendente, JSON.stringify(PENDENTE_DEMO.dados)],
  });
  return { leads: ids, pendenciaId: Number(pend.rows[0].id) };
}

// ---- execução pela linha de comando ----
async function principal() {
  const url = process.env.TURSO_DATABASE_URL ?? "";
  const remoto = !url.startsWith("file:");
  if (remoto && !process.argv.includes("--confirmar-remoto")) {
    console.error(
      "Banco remoto detectado. O seed só apaga e recria os registros de exemplo (telefones 5500900...),\n" +
        "mas por segurança só roda em banco remoto com: npm run seed -- --confirmar-remoto",
    );
    process.exit(1);
  }
  const { leads, pendenciaId } = await semear(getDb());
  console.log(`Seed concluído: ${Object.keys(leads).length} leads no Kanban e 1 diagnóstico aguardando aprovação (#${pendenciaId}).`);
  console.log("Registros de exemplo: nomes com [EXEMPLO] e telefones 5500900000001 a 5500900000008.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((e) => {
    console.error("Falha no seed:", e.message);
    process.exit(1);
  });
}
