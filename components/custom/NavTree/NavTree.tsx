"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import Link, { useLinkStatus } from "next/link"
import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiArrowDownSLine, RiArrowRightSLine, RiLoader4Line } from "react-icons/ri"
import { cn } from "@/lib/cn"
import { Tooltip } from "@/components/ui/Tooltip"
import { isGroupActive, isHrefActive } from "@/components/custom/navigation"
import type { NavGroup, NavLeaf } from "@/components/custom/navigation.types"
import type { NavTreeDensity, NavTreeProps } from "./NavTree.types"

const EASE = [0.23, 1, 0.32, 1] as const
const INSTANT = { duration: 0 }
const LABEL_T = (delay = 0) => ({ duration: 0.18, ease: EASE, delay })
const FLYOUT_OPEN_DELAY = 250

const FLYOUT_VARIANTS = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    filter: "blur(1px)",
    transition: {
      opacity: { duration: 0.14, ease: EASE },
      filter: { duration: 0.14, ease: EASE },
      scale: { duration: 0.14, ease: EASE },
    },
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      opacity: { duration: 0.18, ease: EASE },
      filter: { duration: 0.18, ease: EASE },
      scale: { duration: 0.18, ease: EASE },
    },
  },
}

const FLYOUT_REDUCED = {
  hidden: { opacity: 0, transition: { duration: 0.1 } },
  visible: { opacity: 1, transition: { duration: 0.12 } },
}

const SCRIM_VARIANTS = {
  hidden: { opacity: 0, transition: { duration: 0.14, ease: EASE } },
  visible: { opacity: 1, transition: { duration: 0.18, ease: EASE } },
}

const SCRIM_REDUCED = {
  hidden: { opacity: 0, transition: { duration: 0.1 } },
  visible: { opacity: 1, transition: { duration: 0.12 } },
}

const TREE_STROKE = 2
const TREE_ICON_GAP = 4
const TREE_LIST_GAP = 4
const TREE_LIST_PAD_TOP = 8

const RAIL = {
  sidebar: {
    gutter: 12,
    childPad: 36,
    radius: 8,
    row: 40,
  },
  sheet: {
    gutter: 12,
    childPad: 44,
    radius: 8,
    row: 48,
  },
} as const

type Rail = (typeof RAIL)[NavTreeDensity]

function treeEndX(rail: Rail) {
  return rail.childPad - TREE_ICON_GAP
}

function treeChildY(index: number, rail: Rail) {
  return TREE_LIST_PAD_TOP + index * (rail.row + TREE_LIST_GAP) + rail.row / 2
}

function treeHeight(count: number, rail: Rail) {
  if (count <= 0) return 0
  return TREE_LIST_PAD_TOP + count * rail.row + (count - 1) * TREE_LIST_GAP
}

function treePath(count: number, rail: Rail) {
  if (count <= 0) return ""
  const x = rail.gutter
  const endX = treeEndX(rail)
  const last = count - 1
  const lastY = treeChildY(last, rail)
  const r = Math.min(rail.radius, lastY, endX - x)
  let d = `M ${x} 0 L ${x} ${lastY - r} Q ${x} ${lastY} ${x + r} ${lastY} L ${endX} ${lastY}`
  for (let i = 0; i < last; i++) {
    const y = treeChildY(i, rail)
    const cr = Math.min(r, y, endX - x)
    d += ` M ${x} ${y - cr} Q ${x} ${y} ${x + cr} ${y} L ${endX} ${y}`
  }
  return d
}

function TreeRail({ count, rail }: { count: number; rail: Rail }) {
  if (count <= 0) return null
  return (
    <svg
      aria-hidden
      width={treeEndX(rail) + TREE_STROKE}
      height={treeHeight(count, rail)}
      className="pointer-events-none absolute top-0 left-0 z-0 text-fg opacity-40 dark:opacity-[0.38]"
    >
      <path
        d={treePath(count, rail)}
        fill="none"
        stroke="currentColor"
        strokeWidth={TREE_STROKE}
        strokeLinejoin="round"
        strokeLinecap="butt"
      />
    </svg>
  )
}

function NavPendingSurface({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus()
  return (
    <>
      {children}
      {pending ? (
        <span
          aria-busy
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit]"
        >
          <span className="absolute inset-0 rounded-[inherit] bg-canvas/25 backdrop-blur-[2px] motion-reduce:backdrop-blur-none" />
          <RiLoader4Line size={16} aria-hidden className="relative animate-spin text-fg" />
        </span>
      ) : null}
    </>
  )
}

function SidebarLabel({
  children,
  expanded,
  animate,
  delay = 0,
}: {
  children: ReactNode
  expanded: boolean
  animate: boolean
  delay?: number
}) {
  return (
    <m.span
      className="overflow-hidden whitespace-nowrap leading-none"
      animate={{ maxWidth: expanded ? 200 : 0, opacity: expanded ? 1 : 0 }}
      transition={animate ? LABEL_T(delay) : INSTANT}
    >
      {children}
    </m.span>
  )
}

function SheetTreeChild({
  child,
  pathname,
}: {
  child: NavLeaf
  pathname: string
}) {
  const isActive = !child.disabled && isHrefActive(pathname, child.href)
  const Icon = child.icon

  const className = cn(
    "relative flex h-full w-full items-center gap-2.5 rounded-lg px-2.5 py-2 font-sans text-body-sm",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    child.disabled
      ? "cursor-not-allowed select-none opacity-35"
      : "[transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1),transform_110ms_ease-out] hover:bg-sidebar-active active:scale-[0.98]",
    isActive && "bg-sidebar-active dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]",
  )

  const inner = (
    <>
      {Icon && (
        <span className={cn("inline-flex shrink-0", isActive && "text-accent")}>
          <Icon size={20} aria-hidden />
        </span>
      )}
      <span className="min-w-0">
        <span
          className={cn(
            "block font-sans text-body-sm leading-none",
            isActive ? "font-semibold text-fg" : "font-medium text-fg-muted",
          )}
        >
          {child.label}
        </span>
        {child.description && (
          <span className="mt-1 block font-sans text-caption leading-none text-fg-muted">
            {child.description}
          </span>
        )}
      </span>
    </>
  )

  if (child.disabled) {
    return (
      <span aria-disabled="true" className={className}>
        {inner}
      </span>
    )
  }

  return (
    <Link href={child.href} aria-current={isActive ? "page" : undefined} className={className}>
      <NavPendingSurface>{inner}</NavPendingSurface>
    </Link>
  )
}

function NavChildLink({
  child,
  pathname,
  density,
  inset,
}: {
  child: NavLeaf
  pathname: string
  density: NavTreeDensity
  inset: "tree" | "flyout"
}) {
  if (density === "sheet" && inset === "tree") {
    return <SheetTreeChild child={child} pathname={pathname} />
  }

  const isActive = !child.disabled && isHrefActive(pathname, child.href)
  const isFlyout = inset === "flyout"
  const Icon = child.icon

  const className = cn(
    "relative z-10 flex w-full font-sans text-body-sm",
    "transition-colors duration-150",
    isFlyout
      ? "group/nav items-start gap-2.5 rounded-lg px-2 py-2"
      : "h-10 items-center gap-2 rounded-md px-2.5",
    child.disabled
      ? "cursor-not-allowed text-fg-muted opacity-40"
      : cn(
          "text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          isFlyout ? "hover:bg-hover" : "hover:bg-sidebar-active",
        ),
    isActive && "bg-sidebar-active font-semibold text-fg dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]",
  )

  const inner = isFlyout ? (
    <>
      {Icon && (
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            isActive ? "bg-accent-subtle text-accent" : "bg-hover text-fg-muted",
          )}
        >
          <Icon size={16} aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block leading-none",
            isActive ? "font-semibold text-fg" : "font-medium text-fg",
          )}
        >
          {child.label}
        </span>
        {child.description && (
          <span className="mt-1 block font-sans text-caption leading-snug text-fg-muted">
            {child.description}
          </span>
        )}
      </span>
      {!child.disabled && (
        <RiArrowRightSLine
          size={14}
          aria-hidden
          className="mt-1 shrink-0 text-fg-muted opacity-0 transition-opacity duration-150 group-hover/nav:opacity-100 group-focus-visible/nav:opacity-100"
        />
      )}
    </>
  ) : (
    <>
      {Icon && (
        <span className={cn("inline-flex shrink-0", isActive && "text-accent")}>
          <Icon size={16} aria-hidden />
        </span>
      )}
      {child.label}
    </>
  )

  if (child.disabled) {
    return (
      <span aria-disabled="true" className={className}>
        {inner}
      </span>
    )
  }

  return (
    <Link
      href={child.href}
      role={inset === "flyout" ? "menuitem" : undefined}
      aria-current={isActive ? "page" : undefined}
      className={className}
    >
      <NavPendingSurface>{inner}</NavPendingSurface>
    </Link>
  )
}

function NavLeafRow({
  item,
  index,
  pathname,
  density,
  collapsed,
  animate,
}: {
  item: NavLeaf
  index: number
  pathname: string
  density: NavTreeDensity
  collapsed: boolean
  animate: boolean
}) {
  const Icon = item.icon
  const isActive = !item.disabled && isHrefActive(pathname, item.href)
  const isSheet = density === "sheet"

  if (isSheet) {
    if (item.disabled) {
      return (
        <div
          aria-disabled="true"
          className="flex min-h-11 cursor-not-allowed select-none items-center gap-4 rounded-xl px-3 py-3 opacity-35"
        >
          {Icon && (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-hover text-fg-muted">
              <Icon size={20} aria-hidden />
            </span>
          )}
          <span>
            <span className="block font-sans text-body-sm font-semibold leading-none text-fg">
              {item.label}
            </span>
            {item.description && (
              <span className="mt-1 block font-sans text-caption leading-none text-fg-muted">
                {item.description}
              </span>
            )}
          </span>
        </div>
      )
    }

    return (
      <Link
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex min-h-11 items-center gap-4 rounded-xl px-3 py-3",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "[transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1),transform_110ms_ease-out]",
          "hover:bg-hover active:scale-[0.98]",
          isActive && "bg-sidebar-active",
        )}
      >
        <NavPendingSurface>
        {Icon && (
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-150",
              isActive ? "bg-accent text-accent-fg" : "bg-hover text-fg-muted",
            )}
          >
            <Icon size={20} aria-hidden />
          </span>
        )}
        <span className="min-w-0">
          <span
            className={cn(
              "block font-sans text-body-sm leading-none",
              isActive ? "font-semibold text-fg" : "font-medium text-fg-muted",
            )}
          >
            {item.label}
          </span>
          {item.description && (
            <span className="mt-1 block font-sans text-caption leading-none text-fg-muted">
              {item.description}
            </span>
          )}
        </span>
        </NavPendingSurface>
      </Link>
    )
  }

  if (!Icon) return null

  const rowClassName = cn(
    "relative flex h-10 w-full items-center rounded-md font-sans text-body-sm",
    "transition-colors duration-150",
    collapsed
      ? "justify-center gap-0 px-0 text-fg-muted"
      : "gap-3 px-3 text-fg-muted",
    item.disabled
      ? "cursor-not-allowed opacity-40"
      : "hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    isActive && "bg-sidebar-active font-semibold text-fg dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]",
  )

  const label = (
    <SidebarLabel expanded={!collapsed} animate={animate} delay={index * 0.03}>
      {item.label}
    </SidebarLabel>
  )

  const icon = (
    <span className={cn("inline-flex shrink-0", isActive && "text-accent")}>
      <Icon size={18} aria-hidden />
    </span>
  )

  const row = item.disabled ? (
    <span aria-disabled="true" className={rowClassName}>
      {icon}
      {label}
    </span>
  ) : (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={rowClassName}
    >
      <NavPendingSurface>
        {icon}
        {label}
      </NavPendingSurface>
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip content={item.label} side="right" arrow wrapperClassName="w-full">
        {row}
      </Tooltip>
    )
  }

  return row
}

function NavGroupBlock({
  item,
  index,
  pathname,
  density,
  collapsed,
  animate,
}: {
  item: NavGroup
  index: number
  pathname: string
  density: NavTreeDensity
  collapsed: boolean
  animate: boolean
}) {
  const groupActive = isGroupActive(pathname, item)
  const [open, setOpen] = useState(groupActive)
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelId = useId()
  const Icon = item.icon
  const isSheet = density === "sheet"
  const parentLit = open || groupActive
  const reduceMotion = !!useReducedMotion()

  function clearOpenTimer() {
    if (openTimer.current === null) return
    clearTimeout(openTimer.current)
    openTimer.current = null
  }

  function hideFlyout() {
    clearOpenTimer()
    setFlyoutOpen(false)
  }

  function showFlyout() {
    clearOpenTimer()
    openTimer.current = setTimeout(() => {
      setFlyoutOpen(true)
      openTimer.current = null
    }, FLYOUT_OPEN_DELAY)
  }

  function openFlyoutNow() {
    clearOpenTimer()
    setFlyoutOpen(true)
  }

  useEffect(() => {
    if (groupActive) setOpen(true)
  }, [pathname, groupActive])

  useEffect(() => {
    if (openTimer.current !== null) {
      clearTimeout(openTimer.current)
      openTimer.current = null
    }
    setFlyoutOpen(false)
  }, [pathname, collapsed])

  useEffect(() => {
    return () => {
      if (openTimer.current === null) return
      clearTimeout(openTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!flyoutOpen) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      hideFlyout()
    }

    function onPointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return
      hideFlyout()
    }

    window.addEventListener("keydown", onKeyDown)
    document.addEventListener("pointerdown", onPointerDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [flyoutOpen])

  const chevron = !collapsed && (
    <RiArrowDownSLine
      size={16}
      aria-hidden
      className={cn(
        "ml-auto shrink-0 transition-transform duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
        "motion-reduce:transition-none",
        open && "rotate-180",
      )}
    />
  )

  const rail = RAIL[density]

  const childrenList = (
    <div className="relative">
      <div aria-hidden className="mx-1 h-px" />
      <div className="relative">
        <TreeRail count={item.children.length} rail={rail} />
        <ul
          id={collapsed ? undefined : panelId}
          className="flex flex-col gap-1 pt-2 pb-1"
        >
          {item.children.map((child) => (
            <li
              key={child.href || child.label}
              className="relative z-10"
              style={{ paddingLeft: rail.childPad, height: rail.row }}
            >
              <NavChildLink
                child={child}
                pathname={pathname}
                density={density}
                inset="tree"
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )

  if (isSheet) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl p-0 transition-[padding,background-color] duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
          "motion-reduce:duration-0",
          open && "bg-hover p-1",
        )}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "relative z-10 flex min-h-11 w-full cursor-pointer items-center gap-4 px-3 py-3",
            open ? "rounded-t-xl" : "rounded-xl",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "[transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1),transform_110ms_ease-out]",
            "hover:bg-hover active:scale-[0.98]",
            !open && parentLit && "bg-sidebar-active",
          )}
        >
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-150",
              parentLit ? "bg-accent text-accent-fg" : "bg-hover text-fg-muted",
            )}
          >
            <Icon size={20} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span
              className={cn(
                "block font-sans text-body-sm leading-none",
                parentLit ? "font-semibold text-fg" : "font-medium text-fg-muted",
              )}
            >
              {item.label}
            </span>
            {item.description && (
              <span className="mt-1 block font-sans text-caption leading-none text-fg-muted">
                {item.description}
              </span>
            )}
          </span>
          {chevron}
        </button>
        <m.div
          initial={false}
          animate={{ height: open ? "auto" : 0 }}
          transition={reduceMotion ? INSTANT : { duration: 0.18, ease: EASE }}
          className="overflow-hidden"
          {...(!open ? { inert: true } : {})}
        >
          {childrenList}
        </m.div>
      </div>
    )
  }

  const flyoutVariants = reduceMotion ? FLYOUT_REDUCED : FLYOUT_VARIANTS

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative w-full",
        !collapsed &&
          "overflow-hidden rounded-md p-0 transition-[padding,background-color] duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:duration-0",
        !collapsed && open && "bg-hover p-1",
      )}
      onMouseEnter={() => {
        if (collapsed) showFlyout()
      }}
      onMouseLeave={() => {
        if (collapsed) hideFlyout()
      }}
      onFocusCapture={() => {
        if (collapsed) showFlyout()
      }}
      onBlurCapture={(e) => {
        if (!collapsed) return
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        hideFlyout()
      }}
    >
      <button
        type="button"
        aria-label={collapsed ? item.label : undefined}
        aria-expanded={collapsed ? flyoutOpen : open}
        aria-controls={collapsed ? (flyoutOpen ? panelId : undefined) : panelId}
        aria-haspopup={collapsed ? "menu" : undefined}
        onClick={() => {
          if (collapsed) {
            openFlyoutNow()
            return
          }
          setOpen((v) => !v)
        }}
        className={cn(
          "relative z-10 flex h-10 w-full cursor-pointer items-center font-sans text-body-sm",
          "transition-colors duration-150",
          collapsed
            ? "justify-center gap-0 rounded-md px-0 text-fg-muted"
            : cn("gap-3 px-3 text-fg-muted", open ? "rounded-t-md" : "rounded-md"),
          "hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          collapsed
            ? groupActive &&
              "bg-sidebar-active font-semibold text-fg dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]"
            : cn(
                parentLit && "font-semibold text-fg",
                !open &&
                  parentLit &&
                  "bg-sidebar-active dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]",
              ),
        )}
      >
        <span className={cn("inline-flex shrink-0", (collapsed ? groupActive : parentLit) && "text-accent")}>
          <Icon size={18} aria-hidden />
        </span>
        <SidebarLabel expanded={!collapsed} animate={animate} delay={index * 0.03}>
          {item.label}
        </SidebarLabel>
        {chevron}
      </button>
      <AnimatePresence>
        {collapsed && flyoutOpen && (
          <m.div
            key="scrim"
            aria-hidden
            variants={reduceMotion ? SCRIM_REDUCED : SCRIM_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className={cn(
              "pointer-events-none fixed inset-y-0 right-0 left-16 z-0 hidden md:block",
              reduceMotion ? "bg-canvas/70" : "bg-canvas/50 backdrop-blur-[6px]",
            )}
          />
        )}
        {collapsed && flyoutOpen && (
          <m.div
            key="flyout"
            id={panelId}
            role="menu"
            aria-label={item.label}
            variants={flyoutVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className={cn(
              "absolute top-0 left-full z-50 ml-3 w-72 overflow-visible",
              "rounded-xl border border-popover-border bg-elevated p-1.5 shadow-dialog",
            )}
            style={{ transformOrigin: "left 20px" }}
          >
            <div aria-hidden className="absolute top-0 right-full h-10 w-3" />
            <span
              aria-hidden
              className="absolute top-[15px] -left-[5px] z-10 size-2.5 rotate-45 border-b border-l border-popover-border bg-elevated"
            />
            <div className="relative mb-1 flex items-start gap-2.5 px-2 py-2">
              <span
                aria-hidden
                className="absolute top-2.5 bottom-2.5 left-0 w-0.5 rounded-full bg-accent"
              />
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                <Icon size={16} aria-hidden />
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="block font-sans text-body-sm font-semibold leading-none text-fg">
                  {item.label}
                </span>
                {item.description && (
                  <span className="mt-1 block font-sans text-caption leading-snug text-fg-muted">
                    {item.description}
                  </span>
                )}
              </span>
            </div>
            <div aria-hidden className="mx-1.5 mb-1 h-px bg-border-subtle" />
            <ul className="flex max-h-[min(24rem,calc(100dvh-6rem))] flex-col gap-0.5 overflow-y-auto">
              {item.children.map((child) => (
                <li key={child.href || child.label}>
                  <NavChildLink
                    child={child}
                    pathname={pathname}
                    density="sidebar"
                    inset="flyout"
                  />
                </li>
              ))}
            </ul>
          </m.div>
        )}
      </AnimatePresence>
      {!collapsed && (
        <m.div
          initial={false}
          animate={{ height: open ? "auto" : 0 }}
          transition={reduceMotion ? INSTANT : { duration: 0.18, ease: EASE }}
          className="overflow-hidden"
          {...(!open ? { inert: true } : {})}
        >
          {childrenList}
        </m.div>
      )}
    </div>
  )
}

export function NavTree({
  items,
  pathname,
  density,
  collapsed = false,
  animate = false,
}: NavTreeProps) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={item.kind === "group" ? item.id : item.label}>
          {item.kind === "group" ? (
            <NavGroupBlock
              item={item}
              index={index}
              pathname={pathname}
              density={density}
              collapsed={collapsed}
              animate={animate}
            />
          ) : (
            <NavLeafRow
              item={item}
              index={index}
              pathname={pathname}
              density={density}
              collapsed={collapsed}
              animate={animate}
            />
          )}
        </li>
      ))}
    </ul>
  )
}
