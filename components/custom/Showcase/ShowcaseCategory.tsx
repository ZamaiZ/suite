"use client"

import type React from "react"
import { Toaster } from "@/components/ui/toast"
import type { ShowcaseCategoryId } from "./Showcase.types"
import { ActionsShowcase } from "./categories/ActionsShowcase"
import { ContentShowcase } from "./categories/ContentShowcase"
import { FormsShowcase } from "./categories/FormsShowcase"
import { MessagingShowcase } from "./categories/MessagingShowcase"
import { NavigationShowcase } from "./categories/NavigationShowcase"
import { OverlaysShowcase } from "./categories/OverlaysShowcase"

const CATEGORY_CONTENT = {
  actions: { title: "Ações e feedback", content: <ActionsShowcase /> },
  forms: { title: "Formulários", content: <FormsShowcase /> },
  navigation: {
    title: "Navegação e comandos",
    content: <NavigationShowcase />,
  },
  overlays: { title: "Camadas e revelação", content: <OverlaysShowcase /> },
  content: { title: "Conteúdo e dados", content: <ContentShowcase /> },
  messaging: { title: "Conversas e anexos", content: <MessagingShowcase /> },
} satisfies Record<
  ShowcaseCategoryId,
  { title: string; content: React.ReactNode }
>

export function ShowcaseCategory({
  category,
}: {
  category: ShowcaseCategoryId
}) {
  const selected = CATEGORY_CONTENT[category]
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-[var(--page-padding-x)] py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header>
          <p className="text-xs/relaxed font-semibold tracking-widest text-primary uppercase">
            Showcase
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold text-foreground">
            {selected.title}
          </h1>
        </header>
        {selected.content}
        <Toaster />
      </div>
    </div>
  )
}
