"use client"

import { useEffect, useRef } from "react"

/**
 * Poll enquanto houver trabalho em aberto.
 *
 * Extraído de `ClientResearchRunner.tsx`, onde nasceu como `useSerpPolling`,
 * quando a prospecção precisou do mesmo laço. O repositório já fez essa
 * mudança antes com `useCaptureShortcut`, e pelo mesmo motivo: mantê-lo dentro
 * do componente arrastaria o módulo inteiro para o bundle de quem só precisa
 * do intervalo.
 *
 * Duas armadilhas de React estão travadas aqui, e as duas custaram caro:
 *
 * **A dependência é `total` e `settled`, nunca o objeto de progresso.** Objeto
 * vindo de props ganha identidade nova a cada resposta, e o intervalo
 * reiniciaria a cada ciclo sem nunca completar.
 *
 * **O callback mora num ref atualizado por efeito**, nunca na lista de
 * dependências — pela mesma razão.
 *
 * A guarda de empilhamento fica com quem chama: se uma passada demora mais que
 * o intervalo, sem `inFlightRef` as chamadas se acumulam, e cada uma é uma
 * server action inteira.
 */
export function useQueuePolling({
  enabled,
  settled,
  total,
  onTick,
  intervalMs = 8000,
}: {
  enabled: boolean
  settled: boolean
  total: number
  onTick: () => void
  intervalMs?: number
}) {
  const tickRef = useRef(onTick)
  useEffect(() => {
    tickRef.current = onTick
  })

  useEffect(() => {
    if (!enabled || settled || total === 0) return
    const id = window.setInterval(() => tickRef.current(), intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, settled, total, intervalMs])
}
