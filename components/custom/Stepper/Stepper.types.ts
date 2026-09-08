export type StepperItem = {
  id: string
  label: string
}

export type StepperOrientation = "horizontal" | "vertical"

export type StepperProps = {
  steps: StepperItem[]
  currentIndex: number
  highestReachedIndex: number
  onStepSelect: (index: number) => void
  orientation?: StepperOrientation
  className?: string
}
