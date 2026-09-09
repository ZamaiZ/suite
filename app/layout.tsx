import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { MotionProvider } from "@/components/providers/motion-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"
import { APP_NAME } from "@/lib/brand"
import { SHADCN_PALETTE } from "@/lib/theme/shadcn-palette"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: APP_NAME,
  description: "Suite interna",
}

export const viewport: Viewport = {
  themeColor: SHADCN_PALETTE.light.primary,
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${inter.className}`}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MotionProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
