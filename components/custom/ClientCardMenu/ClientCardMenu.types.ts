import type { ReactNode } from "react"
import type { ClientPortalSnapshot } from "./use-client-portal-actions"

export type ClientCardMenuProps = {
  clientId: string
  /**
   * Estado do portal que a listagem já trouxe. Com ele o menu abre pronto, sem
   * consulta nenhuma.
   */
  snapshot: ClientPortalSnapshot
  /** Classe da linha do card: o gatilho de clique direito É a linha. */
  className?: string
  /** O conteúdo da linha. A setinha é acrescentada aqui dentro. */
  children: ReactNode
}

export type ClientPortalMenuProps = {
  clientId: string
  /**
   * Opcional aqui: o diálogo abre por rota e nem sempre tem a linha da lista no
   * escopo. Sem o estado, o menu volta a buscar sob demanda.
   */
  snapshot?: ClientPortalSnapshot
}
