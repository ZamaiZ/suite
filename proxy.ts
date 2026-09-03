import { NextResponse, type NextRequest } from "next/server"
import { createProxyClient } from "@/lib/supabase/proxy"

const PUBLIC_AUTH_PATHS = new Set(["/login", "/sign-up"])

function isClientPortalPath(pathname: string): boolean {
  return pathname === "/b" || pathname.startsWith("/b/")
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request })

  const supabase = createProxyClient(request, response)

  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  const isPublicAuth = PUBLIC_AUTH_PATHS.has(pathname)
  const isClientPortal = isClientPortalPath(pathname)
  const isApiRoute = pathname.startsWith("/api/")

  if (user && isPublicAuth) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (!user && !isPublicAuth && !isClientPortal) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|sw\\.js|manifest\\.webmanifest|icon-192\\.png|icon-512\\.png|icon-512-maskable\\.png|icon\\.svg).*)",
  ],
}
