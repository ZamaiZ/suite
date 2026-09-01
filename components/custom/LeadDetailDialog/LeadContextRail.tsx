import { RiCalendarEventLine, RiMailLine, RiPhoneLine, RiUserLine } from "react-icons/ri"
import { LeadTagChips } from "@/components/custom/LeadTagField"
import { formatPhone, toTelHref } from "@/lib/br-documents"
import { cn } from "@/lib/cn"
import {
  formatDateTimeShort,
  getTimestampUrgency,
  toCivilDate,
  todayCivilDate,
  type TimestampUrgency,
} from "@/lib/date-time"
import type { LeadDetail } from "@/app/actions/leads"
import { LeadIconWell } from "./LeadIconWell"

const FOLLOW_UP_TONE: Record<TimestampUrgency, string> = {
  overdue: "text-danger",
  soon: "text-warning",
  later: "text-accent",
}

const FOLLOW_UP_WELL: Record<TimestampUrgency, string> = {
  overdue: "text-danger",
  soon: "text-warning",
  later: "text-accent",
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="font-sans text-caption font-medium tracking-wide text-fg-muted uppercase">
      {children}
    </p>
  )
}

export function LeadContextRail({
  detail,
  loading,
}: {
  detail: LeadDetail | null
  loading: boolean
}) {
  if (loading && !detail) {
    return <RailSkeleton />
  }

  if (!detail) return null

  const contacts = [
    detail.lead.phone
      ? {
          key: "phone",
          icon: RiPhoneLine,
          value: formatPhone(detail.lead.phone),
          href: toTelHref(detail.lead.phone),
        }
      : null,
    detail.lead.email
      ? {
          key: "email",
          icon: RiMailLine,
          value: detail.lead.email,
          href: `mailto:${detail.lead.email}`,
        }
      : null,
    detail.lead.contact_name
      ? {
          key: "contact",
          icon: RiUserLine,
          value: detail.lead.contact_name,
          href: null,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  const lastActivity = detail.activities[0] ?? null
  const lastAt = lastActivity?.created_at ?? null
  const isToday = lastAt ? toCivilDate(lastAt) === todayCivilDate() : false
  const followUpAt = detail.lead.next_follow_up_at
  const followUpUrgency = followUpAt ? getTimestampUrgency(followUpAt) : null
  const meetingAt = detail.lead.closing_meeting_at
  const meetingUrgency = meetingAt ? getTimestampUrgency(meetingAt) : null
  const assigneeName = detail.assigneeName
  const assigneeInitial = assigneeName?.trim().charAt(0).toUpperCase() ?? ""
  const closerName = detail.closerName
  const closerInitial = closerName?.trim().charAt(0).toUpperCase() ?? ""

  return (
    <div className="flex flex-col gap-4 px-4 py-5 sm:px-5">
      {contacts.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionLabel>Contato</SectionLabel>
          <ul className="flex flex-col gap-2">
            {contacts.map((item) => (
              <li key={item.key} className="flex min-w-0 items-center gap-2">
                <LeadIconWell icon={item.icon} />
                {item.href ? (
                  <a
                    href={item.href}
                    className="min-w-0 truncate font-sans text-body-sm text-fg transition-colors duration-150 ease-out hover:text-accent"
                  >
                    {item.value}
                  </a>
                ) : (
                  <span className="min-w-0 truncate font-sans text-body-sm text-fg">
                    {item.value}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        className={cn(
          "flex flex-col gap-2",
          contacts.length > 0 && "border-t border-border-subtle pt-4",
        )}
      >
        <SectionLabel>Última interação</SectionLabel>
        {lastAt ? (
          <div className="flex min-w-0 items-center gap-2">
            <LeadIconWell icon={RiCalendarEventLine} className="text-fg-secondary" />
            <span className="min-w-0 truncate font-sans text-body-sm text-fg">
              {formatDateTimeShort(lastAt)}
            </span>
            {isToday ? (
              <span className="shrink-0 rounded-md bg-success/10 px-1.5 py-0.5 font-sans text-caption font-medium text-success">
                Hoje
              </span>
            ) : null}
          </div>
        ) : (
          <p className="font-sans text-body-sm text-fg-muted">Nenhuma ainda</p>
        )}
      </section>

      {followUpAt && followUpUrgency ? (
        <section className="flex flex-col gap-2 border-t border-border-subtle pt-4">
          <SectionLabel>
            {detail.lead.closing_stage === "standby"
              ? "Próximo contato"
              : "Próximo retorno"}
          </SectionLabel>
          <div className="flex min-w-0 items-center gap-2">
            <LeadIconWell
              icon={RiCalendarEventLine}
              className={FOLLOW_UP_WELL[followUpUrgency]}
            />
            <span
              className={cn(
                "min-w-0 truncate font-sans text-body-sm",
                FOLLOW_UP_TONE[followUpUrgency],
              )}
            >
              {formatDateTimeShort(followUpAt)}
            </span>
          </div>
        </section>
      ) : null}

      {meetingAt && meetingUrgency ? (
        <section className="flex flex-col gap-2 border-t border-border-subtle pt-4">
          <SectionLabel>Reunião de fechamento</SectionLabel>
          <div className="flex min-w-0 items-center gap-2">
            <LeadIconWell
              icon={RiCalendarEventLine}
              className={FOLLOW_UP_WELL[meetingUrgency]}
            />
            <span
              className={cn(
                "min-w-0 truncate font-sans text-body-sm",
                FOLLOW_UP_TONE[meetingUrgency],
              )}
            >
              {formatDateTimeShort(meetingAt)}
            </span>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2 border-t border-border-subtle pt-4">
        <SectionLabel>Responsável</SectionLabel>
        {assigneeName ? (
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/10 font-sans text-caption font-semibold text-accent"
            >
              {assigneeInitial}
            </span>
            <span className="min-w-0 truncate font-sans text-body-sm text-fg">
              {assigneeName}
            </span>
          </div>
        ) : (
          <p className="font-sans text-body-sm text-fg-muted">Sem responsável</p>
        )}
      </section>

      {closerName ? (
        <section className="flex flex-col gap-2 border-t border-border-subtle pt-4">
          <SectionLabel>Closer</SectionLabel>
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-success/10 font-sans text-caption font-semibold text-success"
            >
              {closerInitial}
            </span>
            <span className="min-w-0 truncate font-sans text-body-sm text-fg">
              {closerName}
            </span>
          </div>
        </section>
      ) : null}

      {detail.tags.length > 0 ? (
        <section className="flex flex-col gap-2 border-t border-border-subtle pt-4">
          <SectionLabel>Tags</SectionLabel>
          <LeadTagChips tags={detail.tags} />
        </section>
      ) : null}
    </div>
  )
}

function RailSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 py-5 sm:px-5">
      <span className="h-16 animate-pulse rounded-md bg-hover motion-reduce:animate-none" />
      <span
        className="h-10 animate-pulse rounded-md bg-hover motion-reduce:animate-none"
        style={{ animationDelay: "40ms" }}
      />
      <span
        className="h-10 animate-pulse rounded-md bg-hover motion-reduce:animate-none"
        style={{ animationDelay: "80ms" }}
      />
      <span
        className="h-10 animate-pulse rounded-md bg-hover motion-reduce:animate-none"
        style={{ animationDelay: "120ms" }}
      />
    </div>
  )
}
