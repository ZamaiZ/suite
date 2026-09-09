"use client"

import { LazyMotion, domAnimation } from "motion/react"
import type { ReactNode } from "react"

/**
 * Sem um `LazyMotion` acima, os componentes `m.*` de `motion/react-m` renderizam
 * o estado `initial` e nunca animam — um `initial={{ opacity: 0 }}` vira opacidade
 * zero permanente e o conteúdo fica no DOM, selecionável, porém invisível.
 *
 * Montar aqui na raiz garante que qualquer `m.*` da aplicação anime, sem depender
 * de cada tela lembrar de embrulhar a própria árvore.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  )
}
