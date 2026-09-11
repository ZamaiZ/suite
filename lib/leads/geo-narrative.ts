/**
 * A prosa do pilar de Presença em IA no diagnóstico. Pura e determinística.
 *
 * **Nenhuma LLM escreve isto.** A etapa inteira existe sob a regra de que a LLM
 * é objeto de medição, nunca instrumento de análise — e um parágrafo gerado por
 * modelo sobre o negócio do lead quebraria a regra no lugar mais visível, que é
 * o documento que o lead lê.
 *
 * A linha genérica de `pillarLine` continua valendo para os outros quatro
 * pilares. Este pilar ganha a sua porque tem três coletas de naturezas
 * diferentes — uma de graça, duas pagas — e porque **ausência de medição nossa
 * não pode parecer fraqueza do lead** num documento comercial.
 */

import type { GeoSnapshot } from "./geo-audit.ts"

function plural(n: number, um: string, muitos: string): string {
  return n === 1 ? um : muitos
}

/**
 * Monta o parágrafo do pilar a partir do que **foi** coletado.
 *
 * Cada coleta ausente simplesmente não vira frase. A alternativa — dizer "não
 * sondado" no documento do cliente — transformaria a lacuna da nossa auditoria
 * em declaração sobre o negócio dele.
 */
export function geoNarrative(snapshot: GeoSnapshot | null): string {
  if (!snapshot) return ""

  const frases: string[] = []

  // 1. Acesso: é o que a etapa mede de graça e o que sustenta todo o resto.
  // Lista vazia é crawl anterior à coleta ampliada: nada foi medido, e a frase
  // não existe. Dizer "os robôs conseguem ler" sem ter olhado seria elogio a
  // uma dimensão que ninguém mediu.
  const acesso = snapshot.accessibility
  if (acesso.aiCrawlers.length > 0) {
    frases.push(
      acesso.blockedAiCrawlers === 0
        ? `Os ${acesso.aiCrawlers.length} robôs de IA avaliados conseguem ler o site.`
        : `${acesso.blockedAiCrawlers} de ${acesso.aiCrawlers.length} robôs de IA estão bloqueados no robots.txt, e o que eles não leem não pode ser citado.`,
    )
  }

  if (acesso.contentRequiresJs) {
    frases.push(
      "O conteúdo principal só aparece depois do JavaScript, e as IAs em geral não o executam.",
    )
  }

  // 2. Citação em IA do Google: já paga na Visibilidade.
  //
  // **A ausência aqui cala quando a outra medição encontra presença.** Os dois
  // índices discordam sobre o mesmo lead — medido em 2026-09-11, o
  // `ranked_keywords` deu zero citações em visão geral de IA enquanto o
  // `llm_mentions` achou sete respostas citando o site. Cada um está certo no
  // próprio recorte, mas emendar as duas frases num documento comercial
  // produziria uma contradição que o lead não tem como desfazer: "você não é
  // citado" seguido de "você é citado em sete".
  //
  // Regra: medição positiva ganha da negativa vinda de um índice mais grosso.
  // Não afirmamos ausência quando outra leitura da mesma coisa vê presença.
  const aio = snapshot.aiOverview
  const temMencaoMedida = (snapshot.citations?.mentions ?? 0) > 0
  if (aio !== null) {
    if (aio.count > 0) {
      frases.push(
        `O site é citado em ${aio.count} ${plural(aio.count, "busca", "buscas")} onde o Google mostra visão geral de IA.`,
      )
    } else if (aio.hasOrganicFootprint && !temMencaoMedida) {
      frases.push(
        "O site ranqueia no Google, mas não é citado em nenhuma visão geral de IA.",
      )
    }
  }

  // 3. Menções — coleta paga. Ausente, não vira frase nenhuma.
  const citations = snapshot.citations
  if (citations !== null) {
    if (citations.mentions === 0) {
      frases.push(
        "Em nenhuma resposta de IA deste mercado o negócio aparece como fonte.",
      )
    } else {
      const trecho = citations.domainCitedAsSource
        ? `o site aparece entre as fontes em ${citations.mentions} ${plural(citations.mentions, "resposta", "respostas")} de IA deste mercado`
        : `o negócio é mencionado em ${citations.mentions} ${plural(citations.mentions, "resposta", "respostas")} de IA deste mercado, mas o site não entra entre as fontes citadas`
      frases.push(
        `${trecho.charAt(0).toUpperCase()}${trecho.slice(1)}.`,
      )
    }
  }

  // 4. Participação — sempre com o universo declarado. "10,6% das citações nas
  //    7 respostas medidas" é verdade; "10,6% de participação de mercado" não.
  const mentions = snapshot.aiMentions
  if (mentions !== null && mentions.share !== null) {
    frases.push(
      `Nessas ${mentions.promptCount} ${plural(mentions.promptCount, "resposta", "respostas")}, o site responde por ${Math.round(mentions.share * 100)}% das fontes citadas.`,
    )
  }

  // 5. Sondagem — a mais cara. Sem ela, o parágrafo termina antes.
  const probe = snapshot.promptVisibility
  if (probe !== null) {
    const executadas = probe.runs.filter((run) => run.status === "ok").length
    if (executadas > 0) {
      frases.push(
        `Perguntando a ChatGPT, Claude, Gemini e Perplexity o que este mercado pergunta, a marca apareceu em ${Math.round(probe.metrics.mentionRate * 100)}% das ${executadas} respostas — número direcional, porque a mesma pergunta varia entre execuções.`,
      )
    }
  }

  return frases.join(" ")
}
