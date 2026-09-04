import type { MutableRefObject, ReactNode } from "react"

export type BriefingWriterFlush = () => Promise<boolean>

export type BriefingWriterValue = {
  clientId: string | null
  registerFlush: (flush: BriefingWriterFlush | null) => void
}

export type BriefingWriterProviderProps = {
  clientId: string | null
  children: ReactNode
  flushRef?: MutableRefObject<BriefingWriterFlush | null>
}
