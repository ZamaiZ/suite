import type {
  BriefingAccessesPayload,
  BriefingSecretFlags,
} from "@/lib/briefing/accesses"

export type ClientBriefingAccessesFormProps = {
  initialPayload: BriefingAccessesPayload
  initialSecretFlags: BriefingSecretFlags
  initialUpdatedAt: string | null
  initialCompletedAt: string | null
  onBack?: () => void
  onContinue?: (completedAt: string) => void
}
