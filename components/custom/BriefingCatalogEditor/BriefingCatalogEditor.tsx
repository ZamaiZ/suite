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
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  createEmptyProductOrService,
  PRODUCTS_AND_SERVICES_MAX,
  type ProductOrService,
} from "@/lib/briefing/brand"
import { cn } from "cn"
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
            onClick={addItem}
          >
            <RiAddLine size={16} aria-hidden data-icon="inline-start" />
            Adicionar
          </Button>
          <p className="text-xs/relaxed text-muted-foreground">
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
              "bg-popover/40 text-center transition-colors hover:border-primary/40 hover:bg-popover",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RiServiceLine size={18} aria-hidden />
            </span>
            <span className="text-xs/relaxed font-medium text-foreground">
              Adicione o primeiro produto ou serviço
            </span>
            <span className="text-xs/relaxed text-muted-foreground">
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
                      transition={{
                        duration: reduced ? 0.12 : 0.28,
                        ease: EASE,
                      }}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-popover p-3.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-2">
                          <span
                            className={cn(
                              "text-xs/relaxed font-medium",
                              isService
                                ? "text-muted-foreground"
                                : "text-primary",
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
                              "text-xs/relaxed font-medium",
                              isService
                                ? "text-primary"
                                : "text-muted-foreground",
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
                        >
                          <RiDeleteBinLine
                            size={16}
                            aria-hidden
                            data-icon="inline-start"
                          />
                          Remover
                        </Button>
                      </div>
                      <Field>
                        <FieldLabel htmlFor={`catalog-name-${item.id}`}>
                          Nome
                        </FieldLabel>
                        <Input
                          id={`catalog-name-${item.id}`}
                          value={item.name}
                          disabled={disabled}
                          onChange={(event) =>
                            updateItem(item.id, { name: event.target.value })
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`catalog-description-${item.id}`}>
                          Detalhes
                        </FieldLabel>
                        <Textarea
                          id={`catalog-description-${item.id}`}
                          rows={4}
                          value={item.description}
                          disabled={disabled}
                          onChange={(event) =>
                            updateItem(item.id, {
                              description: event.target.value,
                            })
                          }
                        />
                      </Field>
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
