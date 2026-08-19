import { hasRole } from "@/lib/auth/roles"
import { requireCommercialMember } from "@/lib/auth/session"
import { getToolsSettings } from "@/app/actions/settings"
import { ToolsSettings } from "@/components/custom/ToolsSettings"

export default async function ToolsSettingsPage() {
  const { roles } = await requireCommercialMember()
  const settings = await getToolsSettings()
  const currentUserIsAdmin = hasRole(roles, "admin")

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <ToolsSettings
        selected={settings.selected}
        dataForSeoConfigured={settings.dataForSeoConfigured}
        serpApiConfigured={settings.serpApiConfigured}
        serpApiQuota={settings.serpApiQuota}
        currentUserIsAdmin={currentUserIsAdmin}
      />
    </div>
  )
}
