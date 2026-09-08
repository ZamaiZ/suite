import { getUser } from "@/lib/auth/session"

export default async function HomePage() {
  const user = await getUser()

  const name = user?.user_metadata?.name as string | undefined
  const email = user?.email ?? ""

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-[var(--page-padding-x)] py-10">
      <div className="mx-auto max-w-2xl flex flex-col gap-2">
        <p className="text-xs/relaxed font-medium tracking-widest text-muted-foreground uppercase">
          Bem-vindo
        </p>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {name ?? email}
        </h1>
        {name && <p className="text-sm text-muted-foreground">{email}</p>}
      </div>
    </div>
  )
}
