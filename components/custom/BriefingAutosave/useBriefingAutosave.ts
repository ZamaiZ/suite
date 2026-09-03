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

  const scheduleSave = useCallback((payload: T) => {
    setSaveState("idle")
    setErrorMessage(null)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current
      setSaveState("saving")
      void saveRef.current(payload).then((result) => {
        if (requestId !== requestIdRef.current) return
        if (result.status === "unauthenticated") {
          setSaveState("error")
          setErrorMessage("Sessão expirada. Atualize a página.")
          return
        }
        if (result.status === "error") {
          setSaveState("error")
          setErrorMessage(result.message)
          return
        }
        setSaveState("saved")
        setSavedAt(result.updatedAt)
        setCompletedAt(result.completedAt)
      })
    }, AUTOSAVE_MS)
  }, [])

  const flushPending = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [])

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
