"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const AUTOSAVE_MS = 600

export type BriefingAutosaveStatus = "idle" | "saving" | "saved" | "error"

export type BriefingAutosaveResult =
  | { status: "success"; updatedAt: string; completedAt: string | null }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export function useBriefingAutosave<T>(
  initialUpdatedAt: string | null,
  initialCompletedAt: string | null,
  save: (payload: T) => Promise<BriefingAutosaveResult>,
) {
  const [saveState, setSaveState] = useState<BriefingAutosaveStatus>(
    initialUpdatedAt ? "saved" : "idle",
  )
  const [savedAt, setSavedAt] = useState<string | null>(initialUpdatedAt)
  const [completedAt, setCompletedAt] = useState<string | null>(
    initialCompletedAt,
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPayloadRef = useRef<T | null>(null)
  const inFlightRef = useRef<Promise<boolean> | null>(null)
  const requestIdRef = useRef(0)
  const saveRef = useRef(save)

  useEffect(() => {
    saveRef.current = save
  }, [save])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const savePayload = useCallback((payload: T): Promise<boolean> => {
    const requestId = ++requestIdRef.current
    setSaveState("saving")
    const request = saveRef.current(payload).then((result) => {
      if (requestId !== requestIdRef.current) return false
      if (result.status === "unauthenticated") {
        setSaveState("error")
        setErrorMessage("Sessão expirada. Atualize a página.")
        return false
      }
      if (result.status === "error") {
        setSaveState("error")
        setErrorMessage(result.message)
        return false
      }
      setSaveState("saved")
      setSavedAt(result.updatedAt)
      setCompletedAt(result.completedAt)
      return true
    })
    inFlightRef.current = request
    void request.finally(() => {
      if (inFlightRef.current === request) inFlightRef.current = null
    })
    return request
  }, [])

  const scheduleSave = useCallback(
    (payload: T) => {
      setSaveState("idle")
      setErrorMessage(null)
      pendingPayloadRef.current = payload
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null
        const pending = pendingPayloadRef.current
        pendingPayloadRef.current = null
        if (pending) void savePayload(pending)
      }, AUTOSAVE_MS)
    },
    [savePayload],
  )

  const flushPending = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const pending = pendingPayloadRef.current
    pendingPayloadRef.current = null
    if (pending) return savePayload(pending)
    return (await inFlightRef.current) ?? true
  }, [savePayload])

  const markComplete = useCallback(
    (updatedAt: string, nextCompletedAt: string | null) => {
      setSaveState("saved")
      setSavedAt(updatedAt)
      setCompletedAt(nextCompletedAt)
      setErrorMessage(null)
    },
    [],
  )

  const setError = useCallback((message: string) => {
    setErrorMessage(message)
    setSaveState("error")
  }, [])

  const clearError = useCallback(() => {
    setErrorMessage(null)
  }, [])

  return {
    saveState,
    savedAt,
    completedAt,
    errorMessage,
    scheduleSave,
    flushPending,
    markComplete,
    setError,
    clearError,
    setCompletedAt,
  }
}
