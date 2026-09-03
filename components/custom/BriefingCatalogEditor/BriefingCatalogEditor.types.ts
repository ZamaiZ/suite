import type { ProductOrService } from "@/lib/briefing/brand"

export type BriefingCatalogEditorProps = {
  items: ProductOrService[]
  onChange: (items: ProductOrService[]) => void
  disabled?: boolean
}
