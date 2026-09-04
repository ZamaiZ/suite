import type {
  BriefingAccessesPayload,
  BriefingSecretFlags,
} from "@/lib/briefing/accesses"

export type BriefingReviewAccessesProps = {
  clientId: string
  payload: BriefingAccessesPayload
  secretFlags: BriefingSecretFlags
  canRevealSecrets?: boolean
}
