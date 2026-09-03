import type { ReactNode } from "react"

export type BriefingReviewFieldProps = {
  label: string
  value?: string | null
  children?: ReactNode
}

export type BriefingReviewSectionProps = {
  title: string
  children: ReactNode
}

export type BriefingReviewChipsProps = {
  label: string
  items: string[]
}
