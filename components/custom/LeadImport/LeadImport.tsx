"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiUploadLine } from "react-icons/ri"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { LeadImportEditGrid } from "./LeadImportEditGrid"
import { LeadImportFooter } from "./LeadImportFooter"
import { LeadImportHeader } from "./LeadImportHeader"
import { LeadImportOverview } from "./LeadImportOverview"
import { LeadImportWorkspace } from "./LeadImportWorkspace"
import { useLeadImportSession } from "./useLeadImportSession"

const EASE = [0.23, 1, 0.32, 1] as const

export function LeadImport() {
  const [open, setOpen] = useState(false)
  const reduced = !!useReducedMotion()
  const session = useLeadImportSession()
  const wasOpenRef = useRef(false)
  const editing = Boolean(session.editingId)
  const showSidebar = session.files.length > 0
  const editingFile = session.files.find(
    (entry) => entry.id === session.editingId,
  )

  function close() {
    if (session.isBusy) return
    setOpen(false)
  }

  async function handleImport() {
    const ok = await session.importAll()
    if (ok) setOpen(false)
  }

  const paneTransition = {
    duration: reduced ? 0.12 : 0.2,
    ease: EASE,
  }

  useEffect(() => {
    if (wasOpenRef.current && !open) session.reset()
    wasOpenRef.current = open
  }, [open, session])

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        <RiUploadLine data-icon="inline-start" aria-hidden />
        Importar planilha
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close()
        }}
      >
        <DialogContent
          showCloseButton={false}
          className={showSidebar
            ? "h-[min(90dvh,56rem)] max-w-[calc(100%-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-6xl"
            : "h-[min(90dvh,46rem)] max-w-[calc(100%-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl"}
        >
          <DialogTitle className="sr-only">Importar leads</DialogTitle>
          <DialogDescription className="sr-only">
            Importe planilhas .xlsx no modelo do CRM. A validação começa no envio.
          </DialogDescription>
          <LeadImportHeader onClose={close} closeDisabled={session.isBusy} />
          <div className="min-h-0 bg-background">
            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                {editing && editingFile && session.draftRows ? (
                  <m.div
                    key="edit"
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    transition={paneTransition}
                    className="flex min-h-0 flex-1 flex-col overflow-hidden"
                  >
                    <LeadImportEditGrid
                      fileName={editingFile.name}
                      rows={session.draftRows}
                      pending={session.isRevalidating}
                      onChange={session.updateDraftCell}
                      onBlurRow={session.blurDraftRow}
                    />
                  </m.div>
                ) : (
                  <m.div
                    key="browse"
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    transition={paneTransition}
                    className="flex h-full min-h-0 flex-1 flex-col overflow-hidden lg:flex-row"
                  >
                    <LeadImportWorkspace
                      files={session.files}
                      totals={session.totals}
                      notice={session.notice}
                      dropDisabled={session.dropDisabled}
                      onFiles={session.addFiles}
                      onEdit={session.startEdit}
                      onRemove={session.removeFile}
                    />
                    <AnimatePresence initial={false}>
                      {showSidebar ? (
                        <m.aside
                          key="import-sidebar"
                          initial={reduced ? { opacity: 0 } : { opacity: 0, transform: "translateX(12px)" }}
                          animate={{ opacity: 1, transform: "translateX(0px)" }}
                          exit={reduced ? { opacity: 0 } : { opacity: 0, transform: "translateX(12px)" }}
                          transition={paneTransition}
                          className="flex max-h-[48%] w-full shrink-0 flex-col overflow-hidden border-t border-border bg-muted/30 lg:max-h-none lg:w-[min(100%,28rem)] lg:border-t-0 lg:border-l"
                        >
                          <LeadImportOverview
                            totals={session.totals}
                            previewRows={session.previewRows}
                            issues={session.issueItems}
                            issuesExpanded={session.issuesExpanded}
                            onToggleIssues={() => session.setIssuesExpanded(!session.issuesExpanded)}
                            analyzing={session.isAnalyzing}
                          />
                        </m.aside>
                      ) : null}
                    </AnimatePresence>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <DialogFooter className="border-t border-border p-3 sm:p-4">
          <LeadImportFooter
            editing={editing}
            canImport={session.canImport}
            importLabel={`Importar ${session.totals.valid} ${session.totals.valid === 1 ? "lead" : "leads"}`}
            blockReason={session.importBlockReason}
            importError={session.importError}
            isImporting={session.isImporting}
            isRevalidating={session.isRevalidating}
            onCancel={close}
            onBack={session.cancelEdit}
            onImport={() => {
              void handleImport()
            }}
            onRevalidate={() => {
              void session.revalidateEditing()
            }}
          />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
