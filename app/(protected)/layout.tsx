import { requireCommercialMember } from "@/lib/auth/session"
import { Sidebar } from "@/components/custom/Sidebar"
import { MobileNavigation } from "@/components/custom/MobileNavigation"
import { CommandPalette } from "@/components/custom/CommandPalette"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireCommercialMember()

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <div className="md:hidden">
        <MobileNavigation />
      </div>
      {/* Uma instância só, fora dos wrappers de breakpoint: o atalho é global
          e o diálogo precisa existir nos dois tamanhos. */}
      <CommandPalette />
    </div>
  )
}
