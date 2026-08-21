import {
  RiCheckboxCircleLine,
  RiLockPasswordLine,
  RiPagesLine,
  RiSearchLine,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import type { WebsiteCrawl } from "@/lib/leads/website-audit"
import {
  websiteHasSchema,
  websiteHttpsLabel,
  websiteSitemapLabel,
} from "@/lib/leads/website-presenters"

function MetricCard({
  icon,
  label,
  value,
  complement,
}: {
  icon: typeof RiPagesLine
  label: string
  value: string | null
  complement: string
}) {
  return (
    <div className="flex min-h-16 items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2">
      <LeadIconWell icon={icon} />
      <div className="min-w-0">
        <p className="font-sans text-caption text-fg-muted">{label}</p>
        <p className="font-sans text-caption font-semibold text-fg">
          {value ?? "—"}
          {value && complement ? (
            <span className="ml-1 font-normal text-fg-muted">{complement}</span>
          ) : null}
        </p>
      </div>
    </div>
  )
}

export function LeadWebsiteSummaryCards({ crawl }: { crawl: WebsiteCrawl }) {
  const schema = websiteHasSchema(crawl)
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard
        icon={RiLockPasswordLine}
        label="Segurança"
        value={websiteHttpsLabel(crawl.https)}
        complement=""
      />
      <MetricCard
        icon={RiPagesLine}
        label="Páginas"
        value={`${crawl.pages.length.toLocaleString("pt-BR")} na amostra`}
        complement=""
      />
      <MetricCard
        icon={RiSearchLine}
        label="Sitemap"
        value={websiteSitemapLabel(crawl)}
        complement=""
      />
      <MetricCard
        icon={RiCheckboxCircleLine}
        label="Schema"
        value={schema ? "Presente" : "Ausente"}
        complement=""
      />
    </div>
  )
}
