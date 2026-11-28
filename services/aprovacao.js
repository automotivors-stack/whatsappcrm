// Aprovação humana pré-CRM: nenhum card entra em `oportunidades` sem o SIM do consultor
// no WhatsApp administrativo (ADMIN_WHATSAPP_NUMBER).

import { chatIdDoTelefone, mascarar } from "../lib/telefone.js";

/** Campos do diagnóstico aceitos; são as colunas de `oportunidades` preenchidas pela conversa. */
export const CAMPOS_DIAGNOSTICO = [
  "tipo_pessoa", "nome_ou_razao_social", "documento", "descricao_negocio", "onde_opera_hoje",
  "volume_mensal", "numero_transacoes", "taxas_atuais", "taxa_med_operacao", "limite_por_venda",
  "limite_saque_diario", "saque_terceiros", "metodos_pagamento", "tipo_integracao",
  "whatsapp_contato", "email_contato", "resumo_executivo",
];

const TAMANHO_MAXIMO_CAMPO = 2000;
const NAO_INFORMADO = "não informado";

export const TEXTO_LEAD_INSERIDO = "✅ Lead inserido com sucesso na fase 'Contato Recebido' do CRM!";

/** Mantém só os campos conhecidos, com tipos coerentes com a tabela. */
export function limparDiagnostico(diagnostico, telefone) {
  const entrada = diagnostico && typeof diagnostico === "object" ? diagnostico : {};
  const dados = {};
  for (const campo of CAMPOS_DIAGNOSTICO) {
    const valor = entrada[campo];
    if (valor === undefined || valor === null || valor === "") continue;
    if (campo === "numero_transacoes") {
      const n = Number.parseInt(valor, 10);
      if (Number.isFinite(n)) dados[campo] = n;
    } else if (campo === "saque_terceiros") {
      const v = String(valor).trim().toLowerCase();
      if (valor === true || ["sim", "true", "1"].includes(v)) dados[campo] = 1;
      else if (valor === false || ["nao", "não", "false", "0"].includes(v)) dados[campo] = 0;
    } else {
      // Uma linha só: quebras de linha vindas da conversa não podem forjar linhas
      // ("• Documento: ...") no aviso que o consultor usa para decidir.
      dados[campo] = String(valor).replace(/\s+/g, " ").trim().slice(0, TAMANHO_MAXIMO_CAMPO);
    }
  }
  if (!dados.whatsapp_contato && telefone) dados.whatsapp_contato = telefone;
  return dados;
}

/** Linha da origem para o aviso: só quando o contato veio do site. Valores já vêm limpos (lib/origemSite.js). */
export function linhaOrigem(origem) {
  if (origem?.origem !== "site") return null;
  const f = origem.formulario ?? {};
  const extras = [f.prioridade && `prioridade: ${f.prioridade}`, f.gargalo && `gargalo: ${f.gargalo}`].filter(Boolean);
  return `• Origem: site${extras.length ? ` (${extras.join("; ")})` : ""}`;
}

export function formatarAvisoAdmin(dados, id, origem = null) {
  const v = (campo) => dados[campo] ?? NAO_INFORMADO;
  const volume = dados.volume_mensal ? `${dados.volume_mensal}/mês` : NAO_INFORMADO;
  const linhaSite = linhaOrigem(origem);
  return [
    "🔔 *Novo diagnóstico de meios de pagamento finalizado!*",
    ...(linhaSite ? [linhaSite] : []),
    `• Cliente: ${v("nome_ou_razao_social")}`,
    `• Documento: ${v("documento")}`,
    `• Volume Declarado: ${volume}`,
    `• Taxa MED: ${v("taxa_med_operacao")}`,
    `• Limite Venda: ${v("limite_por_venda")}`,
    `• Resumo: ${v("resumo_executivo")}`,
    "",
    "Deseja implementar este lead no CRM? Responda *SIM* para cadastrar no Kanban ou *NÃO* para descartar.",
    `_Código #${id}. Se houver mais de um pendente, responda SIM ${id} ou NÃO ${id}._`,
  ].join("\n");
}

/** Origem gravada no contato (processarMensagem.js); null se não veio do site ou se a leitura falhar. */
async function origemDoContato(db, telefone) {
  try {
    const { rows } = await db.execute({ sql: "SELECT origem, dados_site FROM contatos WHERE phone_number = ?", args: [telefone] });
    if (rows[0]?.origem !== "site") return null;
    return { origem: "site", formulario: JSON.parse(rows[0].dados_site ?? "{}") ?? {} };
  } catch {
    return null;
  }
}

/**
 * Chamado quando a IA encerra o atendimento e gera o resumo executivo:
 *  a) pausa o bot no chat do cliente (status_relacionamento = 'pausado_humano');
 *  b) grava a pendência em `aprovacoes_pendentes` (uma aberta por contato; a nova substitui os dados);
 *  c) avisa o consultor no ADMIN_WHATSAPP_NUMBER.
 * Se o aviso falhar, o erro vai para o log e a pendência fica com aviso_enviado = 0, visível no painel.
 */
export async function finalizarDiagnostico(ctx, telefone, diagnostico) {
  const { db, enviar, adminNumero } = ctx;
  if (!adminNumero) throw new Error("ADMIN_WHATSAPP_NUMBER não configurado.");

  const dados = limparDiagnostico(diagnostico, telefone);
  const [, pendencia] = await db.batch(
    [
      {
        sql: `UPDATE contatos SET status_relacionamento = 'pausado_humano', updated_at = CURRENT_TIMESTAMP
              WHERE phone_number = ?`,
        args: [telefone],
      },
      {
        sql: `INSERT INTO aprovacoes_pendentes (phone_number, dados) VALUES (?, ?)
              ON CONFLICT (phone_number) WHERE status = 'aguardando'
              DO UPDATE SET dados = excluded.dados, aviso_enviado = 0, created_at = CURRENT_TIMESTAMP
              RETURNING id`,
        args: [telefone, JSON.stringify(dados)],
      },
    ],
    "write",
  );
  const id = Number(pendencia.rows[0].id);

  // O lead nunca se perde: a pendência já está gravada. Se o WhatsApp do consultor falhar,
  // ela fica com aviso_enviado = 0 e aparece no aviso do painel (Kanban e Dashboard).
  try {
    await enviar(chatIdDoTelefone(adminNumero), formatarAvisoAdmin(dados, id, await origemDoContato(db, telefone)));
  } catch (erro) {
    console.error(
      `[aprovacao] aviso da pendência #${id} (${mascarar(telefone)}) NÃO chegou ao consultor: ${erro?.message ?? erro}. ` +
        "Ela está no painel, em 'diagnósticos aguardando aprovação'.",
    );
    return { id, avisoEnviado: false };
  }
  await db.execute({ sql: "UPDATE aprovacoes_pendentes SET aviso_enviado = 1 WHERE id = ?", args: [id] });
  console.info(`[aprovacao] pendência #${id} criada para ${mascarar(telefone)}`);
  return { id, avisoEnviado: true };
}

/** Normaliza "Sim", "*não*", "NAO 12", "nao #12" → { decisao: "SIM"|"NAO", id?: number } ou null. */
export function interpretarDecisao(texto) {
  const limpo = String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[*_~.!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const m = /^(SIM|NAO)(?: ?#? ?(\d+))?$/.exec(limpo);
  if (!m) return null;
  return { decisao: m[1], id: m[2] ? Number(m[2]) : undefined };
}

async function pendenciasAbertas(db) {
  const { rows } = await db.execute(
    "SELECT id, dados FROM aprovacoes_pendentes WHERE status = 'aguardando' ORDER BY id",
  );
  return rows.map((r) => ({ id: Number(r.id), dados: JSON.parse(r.dados) }));
}

const nomeDe = (dados) => dados.nome_ou_razao_social ?? "cliente sem nome";

/**
 * Trata uma mensagem vinda do ADMIN_WHATSAPP_NUMBER.
 * SIM → cria a oportunidade em 'Contato Recebido'. NÃO → descarta a pendência. Nada é apagado.
 */
export async function tratarRespostaAdmin(ctx, texto) {
  const { db, enviar, adminNumero } = ctx;
  const chatAdmin = chatIdDoTelefone(adminNumero);
  const responder = (msg) => enviar(chatAdmin, msg);
  const decisao = interpretarDecisao(texto);

  if (!decisao) {
    const abertas = await pendenciasAbertas(db);
    if (abertas.length) {
      await responder(`Há ${abertas.length} diagnóstico(s) aguardando decisão. Responda *SIM* ou *NÃO* (com o código, se houver mais de um).`);
    }
    return { acao: "admin_texto_livre" };
  }

  let alvo;
  if (decisao.id !== undefined) {
    const { rows } = await db.execute({
      sql: "SELECT id, dados, status FROM aprovacoes_pendentes WHERE id = ?",
      args: [decisao.id],
    });
    if (!rows.length) {
      await responder(`Não encontrei o diagnóstico #${decisao.id}.`);
      return { acao: "admin_codigo_inexistente" };
    }
    if (rows[0].status !== "aguardando") {
      await responder(`O diagnóstico #${decisao.id} já foi ${rows[0].status}.`);
      return { acao: "admin_ja_decidido" };
    }
    alvo = { id: Number(rows[0].id), dados: JSON.parse(rows[0].dados) };
  } else {
    const abertas = await pendenciasAbertas(db);
    if (abertas.length === 0) {
      await responder("Não há diagnóstico aguardando decisão.");
      return { acao: "admin_sem_pendencia" };
    }
    if (abertas.length > 1) {
      const lista = abertas.slice(0, 10).map((p) => `• #${p.id} ${nomeDe(p.dados)}`).join("\n");
      await responder(`Há ${abertas.length} diagnósticos aguardando. Responda com o código, por exemplo *SIM ${abertas[0].id}*:\n${lista}`);
      return { acao: "admin_ambiguo" };
    }
    alvo = abertas[0];
  }

  const r = await decidirPendencia(db, alvo.id, decisao.decisao);
  if (r.resultado === "ja_decidido") {
    await responder(`O diagnóstico #${alvo.id} já tinha sido decidido.`);
    return { acao: "admin_ja_decidido" };
  }
  if (r.resultado === "descartado") {
    await responder(`🗑️ Diagnóstico #${alvo.id} (${nomeDe(alvo.dados)}) descartado. Nada foi cadastrado no CRM.`);
    return { acao: "descartado", pendenciaId: alvo.id };
  }
  await responder(`${TEXTO_LEAD_INSERIDO}\n#${alvo.id} ${nomeDe(alvo.dados)}`);
  return { acao: "aprovado", pendenciaId: alvo.id, oportunidadeId: r.oportunidadeId };
}

/**
 * Decide uma pendência: a MESMA regra para o SIM/NÃO do WhatsApp e para os botões do painel.
 *  SIM → cria a oportunidade em 'Contato Recebido' (numa transação; duas aprovações simultâneas
 *        da mesma pendência criam um card só). NÃO → descarta. Nada é apagado.
 * @param {"SIM"|"NAO"} decisao
 * @returns {Promise<{ resultado: "aprovado"|"descartado"|"ja_decidido"|"inexistente", oportunidadeId?: number }>}
 */
export async function decidirPendencia(db, id, decisao) {
  if (decisao !== "SIM" && decisao !== "NAO") throw new Error("Decisão inválida.");
  const existe = await db.execute({ sql: "SELECT status FROM aprovacoes_pendentes WHERE id = ?", args: [id] });
  if (!existe.rows.length) return { resultado: "inexistente" };

  if (decisao === "NAO") {
    const r = await db.execute({
      sql: `UPDATE aprovacoes_pendentes SET status = 'descartado', decidido_em = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'aguardando'`,
      args: [id],
    });
    return { resultado: r.rowsAffected === 0 ? "ja_decidido" : "descartado" };
  }

  // Um lote atômico (batch): o banco executa os lotes um de cada vez, então dois "SIM" ao mesmo
  // tempo (painel + WhatsApp, ou duas abas) viram um aprovado e um "já decidido", sem erro de
  // banco ocupado. Cada passo só age se o anterior agiu (condições no próprio SQL).
  const colunas = CAMPOS_DIAGNOSTICO;
  const [marcada, inserida] = await db.batch(
    [
      {
        sql: `UPDATE aprovacoes_pendentes SET status = 'aprovado', decidido_em = CURRENT_TIMESTAMP
              WHERE id = ? AND status = 'aguardando'`,
        args: [id],
      },
      {
        sql: `INSERT INTO oportunidades (phone_number, ${colunas.join(", ")}, status_kanban)
              SELECT phone_number, ${colunas.map((c) => `json_extract(dados, '$.${c}')`).join(", ")}, 'Contato Recebido'
              FROM aprovacoes_pendentes
              WHERE id = ? AND status = 'aprovado' AND oportunidade_id IS NULL AND changes() = 1
              RETURNING id`,
        args: [id],
      },
      {
        sql: `UPDATE aprovacoes_pendentes SET oportunidade_id = last_insert_rowid()
              WHERE id = ? AND oportunidade_id IS NULL AND changes() = 1`,
        args: [id],
      },
    ],
    "write",
  );
  if (marcada.rowsAffected === 0 || !inserida.rows.length) return { resultado: "ja_decidido" };
  return { resultado: "aprovado", oportunidadeId: Number(inserida.rows[0].id) };
}

/** Pendências abertas para o painel (fallback do WhatsApp), mais antigas primeiro. */
export async function listarPendencias(db) {
  const { rows } = await db.execute(
    `SELECT id, phone_number, dados, aviso_enviado, created_at
     FROM aprovacoes_pendentes WHERE status = 'aguardando' ORDER BY created_at, id`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    telefone: r.phone_number,
    dados: JSON.parse(r.dados),
    aviso_enviado: Number(r.aviso_enviado) === 1,
    created_at: r.created_at,
  }));
}
