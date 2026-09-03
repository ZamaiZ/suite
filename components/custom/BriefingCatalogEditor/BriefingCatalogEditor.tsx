"use client"

import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  LayoutGroup,
  useReducedMotion,
} from "motion/react"
import * as m from "motion/react-m"
import { RiAddLine, RiDeleteBinLine, RiServiceLine } from "react-icons/ri"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Switch } from "@/components/ui/Switch"
import { Textarea } from "@/components/ui/Textarea"
import {
  createEmptyProductOrService,
  PRODUCTS_AND_SERVICES_MAX,
  type ProductOrService,
} from "@/lib/briefing/brand"
import { cn } from "@/lib/cn"
import type { BriefingCatalogEditorProps } from "./BriefingCatalogEditor.types"

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]

export function BriefingCatalogEditor({
  items,
  onChange,
  disabled,
}: BriefingCatalogEditorProps) {
  const reduced = !!useReducedMotion()

  function updateItem(id: string, partial: Partial<ProductOrService>) {
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...partial } : item)),
    )
  }

  function addItem() {
    if (items.length >= PRODUCTS_AND_SERVICES_MAX) return
    onChange([...items, createEmptyProductOrService("product")])
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id))
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || items.length >= PRODUCTS_AND_SERVICES_MAX}
            leadingIcon={<RiAddLine size={16} aria-hidden />}
            onClick={addItem}
          >
            Adicionar
          </Button>
          <p className="font-sans text-caption text-fg-muted">
            {items.length}/{PRODUCTS_AND_SERVICES_MAX} itens
          </p>
        </div>

        {items.length === 0 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={addItem}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-10",
              "bg-elevated/40 text-center transition-colors hover:border-accent/40 hover:bg-elevated",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <RiServiceLine size={18} aria-hidden />
            </span>
            <span className="font-sans text-body-sm font-medium text-fg">
              Adicione o primeiro produto ou serviço
            </span>
            <span className="font-sans text-caption text-fg-muted">
              Nome, descrição e se é produto ou serviço.
            </span>
          </button>
        ) : (
          <LayoutGroup>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              <AnimatePresence initial={false} mode="popLayout">
                {items.map((item) => {
                  const isService = item.kind === "service"
                  return (
                    <m.div
                      key={item.id}
                      layout={!reduced}
                      initial={
                        reduced
                          ? { opacity: 0 }
                          : { opacity: 0, y: 10, scale: 0.98 }
                      }
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={
                        reduced
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.96, y: -6 }
                      }
                      transition={{ duration: reduced ? 0.12 : 0.28, ease: EASE }}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-elevated p-3.5 shadow-card"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-2">
                          <span
                            className={cn(
                              "font-sans text-caption font-medium",
                              isService ? "text-fg-muted" : "text-accent",
                            )}
                          >
                            Produto
                          </span>
                          <Switch
                            id={`catalog-kind-${item.id}`}
                            checked={isService}
                            disabled={disabled}
                            onCheckedChange={(checked) =>
                              updateItem(item.id, {
                                kind: checked ? "service" : "product",
                              })
                            }
                          />
                          <span
                            className={cn(
                              "font-sans text-caption font-medium",
                              isService ? "text-accent" : "text-fg-muted",
                            )}
                          >
                            Serviço
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          aria-label="Remover item"
                          disabled={disabled}
                          onClick={() => removeItem(item.id)}
                          leadingIcon={<RiDeleteBinLine size={16} aria-hidden />}
                        >
                          Remover
                        </Button>
                      </div>
                      <Input
                        id={`catalog-name-${item.id}`}
                        label="Nome"
                        value={item.name}
                        disabled={disabled}
                        onChange={(event) =>
                          updateItem(item.id, { name: event.target.value })
                        }
                      />
                      <Textarea
                        id={`catalog-description-${item.id}`}
                        label="Detalhes"
                        rows={4}
                        value={item.description}
                        disabled={disabled}
                        onChange={(event) =>
                          updateItem(item.id, {
                            description: event.target.value,
                          })
                        }
                      />
                    </m.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        )}
      </div>
    </LazyMotion>
  )
}
