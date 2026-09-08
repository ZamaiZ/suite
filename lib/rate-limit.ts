import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

type Operation = "signup" | "login"

const LIMITS: Record<
  Operation,
  { windowSeconds: number; maxRequests: number }
> = {
  signup: { windowSeconds: 3600, maxRequests: 10 },
  login: { windowSeconds: 900, maxRequests: 20 },
}

export async function checkRateLimit(
  operation: Operation,
  ip: string,
): Promise<boolean> {
  const { windowSeconds, maxRequests } = LIMITS[operation]
  const admin = createAdminClient()

  const { data, error } = await admin.rpc("check_rate_limit", {
    p_key: `${operation}:${ip}`,
    p_window_seconds: windowSeconds,
    p_max_requests: maxRequests,
  })

  if (error) {
    console.error("[rate-limit] check failed:", error.message)
    return true
  }

  return data as boolean
}
