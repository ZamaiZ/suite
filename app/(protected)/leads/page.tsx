import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  endOfAppDayIso,
  firstSearchParam,
  isBoardFlagOn,
  isLeadId,
  isPendingFilterOn,
} from "@/lib/leads/queues"
import { countActivitiesByChannel } from "@/lib/leads/channel"
import { isLeadActivityType } from "@/lib/leads/status"
import { isTagSlug, readLeadTags } from "@/lib/leads/tags"
import {
  readEmbeddedName,
  toLeadBoardItem,
  type LeadBoardItem,
} from "@/lib/leads/board-item"
import { canListAllOpportunities } from "@/lib/leads/gbp"
import { LeadBoard } from "@/components/custom/LeadBoard"

export const maxDuration = 60

function sanitizeSearch(value: string): string {
  return value.replace(/[%*,()\\]/g, " ").replace(/\s+/g, " ").trim()
}

type AssigneeEmbed = { name: string } | { name: string }[] | null
type ActivityEmbed = { type: string; created_at: string; channel: string | null }

async function leadIdsForTagSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string,
): Promise<string[]> {
  const { data: tag, error: tagError } = await supabase
    .from("tags")
    .select("id")
    .eq("slug", slug)
    .maybeSingle()
  if (tagError) {
    throw new Error("Unable to load tags.", { cause: tagError })
  }
  if (!tag) return []

  const { data: links, error: linkError } = await supabase
    .from("lead_tags")
    .select("lead_id")
    .eq("tag_id", tag.id)
  if (linkError) {
    throw new Error("Unable to load tags.", { cause: linkError })
  }
  return (links ?? []).map((row) => row.lead_id as string)
}

async function leadIdsForChannelQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  query: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("lead_digital_channels")
    .select("lead_id")
    .or(`normalized_key.ilike.%${query}%,value.ilike.%${query}%`)
  if (error) {
    throw new Error("Unable to search lead channels.", { cause: error })
  }
  return [
    ...new Set(
      (data ?? [])
        .map((row) => row.lead_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ]
}

export default async function LeadsPage({
  searchParams,
}: PageProps<"/leads">) {
  const { user, roles } = await requireCommercialMember()
  const params = await searchParams
  const rawQuery = firstSearchParam(params.q)
  const query = sanitizeSearch(rawQuery ?? "")
  const team = isBoardFlagOn(firstSearchParam(params.team))
  const today = isBoardFlagOn(firstSearchParam(params.today))
  const pending = isPendingFilterOn(firstSearchParam(params.pending))
  const rawTag = firstSearchParam(params.tag)
  const tag = isTagSlug(rawTag) ? rawTag : null
  const initialLeadId =
    typeof params.lead === "string" && isLeadId(params.lead)
      ? params.lead
      : null

  const supabase = await createClient()
  const [
    { data: catalogRows, error: catalogError },
    matchingIds,
    channelMatchIds,
  ] = await Promise.all([
    supabase.from("tags").select("name, slug").order("name"),
    tag ? leadIdsForTagSlug(supabase, tag) : Promise.resolve(null),
    query ? leadIdsForChannelQuery(supabase, query) : Promise.resolve([]),
  ])

  if (catalogError) {
    throw new Error("Unable to load tags.", { cause: catalogError })
  }

  const tagOptions = (catalogRows ?? []).flatMap((row) =>
    isTagSlug(row.slug) ? [{ slug: row.slug, name: row.name }] : [],
  )

  let leads: LeadBoardItem[] = []

  if (!matchingIds || matchingIds.length > 0) {
    const scope = team
      ? "and(status.eq.new,assigned_sdr_id.is.null),and(assigned_sdr_id.not.is.null)"
      : canListAllOpportunities(roles)
        ? `and(status.eq.new,assigned_sdr_id.is.null),and(assigned_sdr_id.eq.${user.id}),and(assigned_closer_id.eq.${user.id},status.eq.interested),and(status.eq.interested)`
        : `and(status.eq.new,assigned_sdr_id.is.null),and(assigned_sdr_id.eq.${user.id}),and(assigned_closer_id.eq.${user.id},status.eq.interested)`

    let listQuery = supabase.from("leads").select(
      "id, company_name, website, website_domain, status, next_follow_up_at, created_at, assigned_sdr_id, assigned_closer_id, closing_meeting_at, users!assigned_sdr_id(name), closer:users!assigned_closer_id(name), lead_activities(type, channel, created_at), lead_tags(tags(id, name))",
    )

    if (matchingIds) {
      listQuery = listQuery.in("id", matchingIds)
    }

    if (query) {
      const channelFilter =
        channelMatchIds.length > 0
          ? `,id.in.(${channelMatchIds.join(",")})`
          : ""
      listQuery = listQuery.or(
        `and(or(${scope}),or(company_name.ilike.%${query}%,website_domain.ilike.%${query}%${channelFilter}))`,
      )
    } else {
      listQuery = listQuery.or(scope)
    }

    if (today) {
      listQuery = listQuery.lte("next_follow_up_at", endOfAppDayIso())
    }

    const { data, error } = await listQuery
      .order("created_at", { ascending: false })
      .order("created_at", {
        referencedTable: "lead_activities",
        ascending: false,
      })

    if (error) {
      throw new Error("Unable to load leads.", { cause: error })
    }

    leads = (data ?? []).flatMap((row) => {
      const activities = Array.isArray(row.lead_activities)
        ? (row.lead_activities as ActivityEmbed[])
        : []
      const latest = activities[0]
      const item = toLeadBoardItem(row, {
        assignee_name: row.assigned_sdr_id
          ? readEmbeddedName(row.users as AssigneeEmbed)
          : null,
        closer_name: row.assigned_closer_id
          ? readEmbeddedName(
              (row as { closer?: AssigneeEmbed }).closer,
            )
          : null,
        from_denial: Boolean(
          latest && isLeadActivityType(latest.type) && latest.type === "denied",
        ),
        last_activity_at: latest?.created_at ?? null,
        activity_count: activities.length,
        activity_counts: countActivitiesByChannel(activities),
        tags: readLeadTags(row.lead_tags),
      })
      return item ? [item] : []
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-[var(--page-padding-x)] py-4">
      <h1 className="sr-only">Leads</h1>
      <LeadBoard
        leads={leads}
        currentUserId={user.id}
        listParams={{ q: rawQuery ?? "", team, today, pending, tag }}
        tagOptions={tagOptions}
        initialLeadId={initialLeadId}
      />
    </div>
  )
}
