import { useRef, useState, type PointerEvent } from "react"
import { cn } from "@/lib/cn"
import { fromHour12, toHour12, type CivilHourCycle } from "@/lib/date-time"

const FACE = 256
const OUTER_R = 100
const INNER_R = 62
const RING_SPLIT = (OUTER_R + INNER_R) / 2
const OUTER_PCT = (OUTER_R / FACE) * 100
const INNER_PCT = (INNER_R / FACE) * 100
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)"

const HOUR_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const
const HOUR_24_INNER = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] as const
const MINUTE_LABELS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const

export type TimePickerClockProps = {
  hourCycle: CivilHourCycle
  segment: "hour" | "minute"
  hour23: number
  minute: number
  reduced: boolean
  onHourChange: (hour23: number) => void
  onHourCommit: (hour23: number) => void
  onMinuteChange: (minute: number) => void
  onMinuteCommit: (minute: number) => void
}

function indexFromPoint(dx: number, dy: number): number {
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  const clock = (angle + 90 + 360) % 360
  return Math.round(clock / 30) % 12
}

function hourFromPoint(
  dx: number,
  dy: number,
  half: number,
  hourCycle: CivilHourCycle,
  hour23: number,
): number {
  const index = indexFromPoint(dx, dy)
  if (hourCycle === "h12") {
    const hour12 = index === 0 ? 12 : index
    return fromHour12(hour12, toHour12(hour23).period)
  }
  const dist = Math.hypot(dx, dy)
  const split = half * (RING_SPLIT / (FACE / 2))
  if (dist < split) return HOUR_24_INNER[index] ?? 0
  return index === 0 ? 12 : index
}

function minuteFromPoint(dx: number, dy: number): number {
  return indexFromPoint(dx, dy) * 5
}

function hourHand(hour23: number, hourCycle: CivilHourCycle) {
  if (hourCycle === "h12") {
    const { hour } = toHour12(hour23)
    return { angle: (hour % 12) * 30, inner: false }
  }
  if (hour23 === 0 || hour23 > 12) {
    return { angle: (hour23 === 0 ? 0 : hour23 - 12) * 30, inner: true }
  }
  return { angle: (hour23 % 12) * 30, inner: false }
}

function labelPosition(index: number, radiusPct: number) {
  const rad = ((index * 30 - 90) * Math.PI) / 180
  return {
    left: `${50 + radiusPct * Math.cos(rad)}%`,
    top: `${50 + radiusPct * Math.sin(rad)}%`,
  }
}

function formatClockLabel(value: number, pad: boolean) {
  if (!pad) return String(value)
  return String(value).padStart(2, "0")
}

export function TimePickerClock({
  hourCycle,
  segment,
  hour23,
  minute,
  reduced,
  onHourChange,
  onHourCommit,
  onMinuteChange,
  onMinuteCommit,
}: TimePickerClockProps) {
  const faceRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  function valueFromEvent(event: PointerEvent<HTMLDivElement>) {
    const face = faceRef.current
    if (!face) return null
    const rect = face.getBoundingClientRect()
    const half = rect.width / 2
    const dx = event.clientX - (rect.left + half)
    const dy = event.clientY - (rect.top + half)
    if (segment === "minute") return minuteFromPoint(dx, dy)
    return hourFromPoint(dx, dy, half, hourCycle, hour23)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    const next = valueFromEvent(event)
    if (next === null) return
    if (segment === "minute") onMinuteChange(next)
    else onHourChange(next)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const next = valueFromEvent(event)
    if (next === null) return
    if (segment === "minute") onMinuteChange(next)
    else onHourChange(next)
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragging(false)
    const next = valueFromEvent(event)
    if (next === null) return
    if (segment === "minute") onMinuteCommit(next)
    else onHourCommit(next)
  }

  const hand =
    segment === "minute"
      ? { angle: minute * 6, inner: false }
      : hourHand(hour23, hourCycle)
  const handLength = hand.inner ? INNER_PCT : OUTER_PCT
  const instant = reduced || dragging

  const hour12 = toHour12(hour23).hour
  const showInner = hourCycle === "h23" && segment === "hour"
  const snappedMinute = (Math.round(minute / 5) % 12) * 5

  return (
    <div
      ref={faceRef}
      role="presentation"
      aria-hidden
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative mx-auto aspect-square w-full max-w-[16rem] cursor-pointer touch-none select-none rounded-full bg-hover"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          transform: `rotate(${hand.angle}deg)`,
          transition: instant ? undefined : `transform 150ms ${EASE}`,
        }}
      >
        <span
          className="absolute left-1/2 w-0.5 rounded-full bg-accent"
          style={{
            bottom: "50%",
            height: `${handLength}%`,
            transform: "translateX(-50%)",
          }}
        />
      </div>
      <span className="pointer-events-none absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />

      {segment === "minute"
        ? MINUTE_LABELS.map((value, index) => {
            const selected = value === snappedMinute
            return (
              <span
                key={value}
                className={cn(
                  "pointer-events-none absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
                  "font-sans text-caption font-medium tabular-nums",
                  selected ? "bg-accent text-accent-fg" : "text-fg",
                )}
                style={labelPosition(index, OUTER_PCT)}
              >
                {formatClockLabel(value, true)}
              </span>
            )
          })
        : HOUR_12.map((value, index) => {
            const selected =
              hourCycle === "h12" ? hour12 === value : hour23 === value
            return (
              <span
                key={`outer-${value}`}
                className={cn(
                  "pointer-events-none absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
                  "font-sans text-caption font-medium tabular-nums",
                  selected ? "bg-accent text-accent-fg" : "text-fg",
                )}
                style={labelPosition(index, OUTER_PCT)}
              >
                {value}
              </span>
            )
          })}

      {showInner
        ? HOUR_24_INNER.map((value, index) => {
            const selected = hour23 === value
            return (
              <span
                key={`inner-${value}`}
                className={cn(
                  "pointer-events-none absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
                  "font-sans text-caption font-medium tabular-nums",
                  selected ? "bg-accent text-accent-fg" : "text-fg-muted",
                )}
                style={labelPosition(index, INNER_PCT)}
              >
                {formatClockLabel(value, true)}
              </span>
            )
          })
        : null}
    </div>
  )
}
