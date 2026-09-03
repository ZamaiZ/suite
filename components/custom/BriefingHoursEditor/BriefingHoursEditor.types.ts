export type BriefingHoursEditorProps = {
  id: string
  value: string[]
  onChange: (lines: string[]) => void
  disabled?: boolean
}
