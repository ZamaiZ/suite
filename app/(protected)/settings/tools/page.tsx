import { getToolsSettings } from "@/app/actions/settings"
import { ToolsSettings } from "@/components/custom/ToolsSettings"

export default async function ToolsSettingsPage() {
  const settings = await getToolsSettings()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <ToolsSettings
        configured={settings.configured}
        usage={settings.usage}
        errorMessage={settings.errorMessage}
      />
    </div>
  )
}
