import { LeadGbpCard } from "@/components/custom/LeadGbpPanel/LeadGbpCard"
import type { WebsitePagespeedSnapshot } from "@/lib/leads/website-pagespeed"

function Shot({
  label,
  src,
}: {
  label: string
  src: string | null
}) {
  return (
    <figure className="min-w-0">
      <figcaption className="font-sans text-caption text-fg-muted">
        {label}
      </figcaption>
      {src ? (
        <img
          src={src}
          alt={`Captura ${label}`}
          className="mt-1 max-h-64 w-full rounded-lg border border-border-subtle bg-canvas object-cover object-top"
        />
      ) : (
        <div className="mt-1 flex min-h-28 items-center justify-center rounded-lg border border-dashed border-border-subtle bg-canvas px-3 py-6">
          <p className="font-sans text-caption text-fg-muted">
            Aguardando captura
          </p>
        </div>
      )}
    </figure>
  )
}

export function LeadWebsiteScreenshots({
  pagespeed,
}: {
  pagespeed: WebsitePagespeedSnapshot | null
}) {
  return (
    <LeadGbpCard title="Capturas PageSpeed">
      <p className="mb-2 font-sans text-caption text-fg-muted">
        Servem para design, CTA e layout estreito — não só para o PageSpeed.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Shot label="Mobile" src={pagespeed?.mobile?.screenshot ?? null} />
        <Shot label="Desktop" src={pagespeed?.desktop?.screenshot ?? null} />
      </div>
    </LeadGbpCard>
  )
}
