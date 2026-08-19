import assert from "node:assert/strict"
import test from "node:test"

import { leadDetailDialogSize } from "./detail-dialog-layout.ts"

test("expands only the opportunity tab to the import workspace size", () => {
  assert.equal(leadDetailDialogSize("activity"), "lg")
  assert.equal(leadDetailDialogSize("record"), "lg")
  assert.equal(leadDetailDialogSize("opportunity"), "xl")
})
