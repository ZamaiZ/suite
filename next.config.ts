import type { NextConfig } from "next"

const ngrokDevOrigin = "marleen-interthronging-synergistically.ngrok-free.dev"

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs"],
  allowedDevOrigins: [ngrokDevOrigin],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      allowedOrigins: [ngrokDevOrigin],
    },
  },
}

export default nextConfig
