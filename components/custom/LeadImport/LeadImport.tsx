"use client"

import { useState } from "react"
import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiUploadLine } from "react-icons/ri"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
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

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
        leadingIcon={<RiUploadLine size={16} aria-hidden />}
      >
        Importar planilha
      </Button>
      <Dialog
        open={open}
        onClose={close}
        onExited={session.reset}
        title="Importar leads"
        description="Importe planilhas .xlsx no modelo do CRM. A validação começa no envio."
        size={showSidebar ? "xl" : "lg"}
        header={
          <LeadImportHeader onClose={close} closeDisabled={session.isBusy} />
        }
        bodyClassName="bg-canvas p-0 sm:p-0"
        footer={
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
        }
      >
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
                      initial={
                        reduced
                          ? { opacity: 0 }
                          : { opacity: 0, transform: "translateX(12px)" }
                      }
                      animate={{ opacity: 1, transform: "translateX(0px)" }}
                      exit={
                        reduced
                          ? { opacity: 0 }
                          : { opacity: 0, transform: "translateX(12px)" }
                      }
                      transition={paneTransition}
                      className="flex max-h-[48%] w-full shrink-0 flex-col overflow-hidden border-t border-border-subtle bg-elevated lg:max-h-none lg:w-[min(100%,28rem)] lg:border-t-0 lg:border-l"
                    >
                      <LeadImportOverview
                        totals={session.totals}
                        previewRows={session.previewRows}
                        issues={session.issueItems}
                        issuesExpanded={session.issuesExpanded}
                        onToggleIssues={() =>
                          session.setIssuesExpanded(!session.issuesExpanded)
                        }
                        analyzing={session.isAnalyzing}
                      />
                    </m.aside>
                  ) : null}
                </AnimatePresence>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </Dialog>
    </>
  )
}
