"use client"

import { createContext, useCallback, useContext, useEffect } from "react"
import type {
  BriefingWriterFlush,
  BriefingWriterProviderProps,
  BriefingWriterValue,
} from "./BriefingWriter.types"

const BriefingWriterContext = createContext<BriefingWriterValue>({
  clientId: null,
  registerFlush: () => {},
})

export function BriefingWriterProvider({
  clientId,
  children,
  flushRef,
}: BriefingWriterProviderProps) {
  const registerFlush = useCallback(
    (flush: BriefingWriterFlush | null) => {
      if (flushRef) flushRef.current = flush
    },
    [flushRef],
  )

  return (
    <BriefingWriterContext.Provider value={{ clientId, registerFlush }}>
      {children}
    </BriefingWriterContext.Provider>
  )
}

export function useBriefingWriterClientId(): string | null {
  return useContext(BriefingWriterContext).clientId
}

export function useBriefingWriterFlushRegistration(flush: BriefingWriterFlush) {
  const { registerFlush } = useContext(BriefingWriterContext)
  useEffect(() => {
    registerFlush(flush)
    return () => registerFlush(null)
  }, [flush, registerFlush])
}

export function attachBriefingClientId<T extends object>(
  payload: T,
  clientId: string | null,
): T | (T & { clientId: string }) {
  if (!clientId) return payload
  return { ...payload, clientId }
}

export function useWrappedBriefingSave<T extends object>(
  save: (
    input: unknown,
  ) => Promise<
    | { status: "success"; updatedAt: string; completedAt: string | null }
    | { status: "error"; message: string }
    | { status: "unauthenticated" }
  >,
) {
  const clientId = useBriefingWriterClientId()
  return useCallback(
    (payload: T) => save(attachBriefingClientId(payload, clientId)),
    [save, clientId],
  )
}
