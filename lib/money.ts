import { digitsOnly } from "@/lib/br-documents"

const MAX_CENTS_DIGITS = 12

export type MoneyAmount = {
  amount: number
}

export function parseBRLInput(value: string): number | null {
  const digits = digitsOnly(value).slice(0, MAX_CENTS_DIGITS)
  if (!digits) return null
  const cents = Number(digits)
  if (!Number.isSafeInteger(cents) || cents < 0) return null
  return cents
}

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100)
}

export function formatBRLInput(value: string): string {
  const parsed = parseBRLInput(value)
  if (parsed === null) return ""
  return formatBRL(parsed)
}

export function toMoneyAmount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.round(parsed)
}

export function sumContractItems(items: MoneyAmount[]): number {
  return items.reduce((total, item) => total + item.amount, 0)
}
