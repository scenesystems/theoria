import { useRender } from "@base-ui/react/use-render"
import { Match } from "effect"

import { classNames } from "./classNames.js"

/** The elements a layout slot renders by default. */
type LayoutTag = "div" | "header" | "main" | "nav" | "section"

/**
 * Props of a layout slot: the attributes and ref of its default element plus
 * Base UI's `render` prop, which swaps the rendered element for another tag
 * or composes the slot with another component (`render={<ul />}`,
 * `render={<m.div />}`). Base UI merges the slot's classes, handlers and
 * refs into whatever `render` supplies.
 */
export type LayoutSlotProps<Tag extends LayoutTag> = useRender.ComponentProps<Tag>

/**
 * A layout slot: a semantic element with the slot's base classes, rendered
 * through Base UI's {@link useRender} so the element is chosen the same way it
 * is for every other Base UI component in the app. The props are typed by the
 * slot's default element, so `<Main>` accepts what a `<main>` accepts.
 */
const useLayoutSlot = <Tag extends LayoutTag>(
  defaultTagName: Tag,
  baseClassName: string,
  { className, ref, render, ...props }: LayoutSlotProps<Tag>
) =>
  useRender({
    defaultTagName,
    props: { ...props, className: classNames(baseClassName, className ?? "") },
    ref,
    render
  })

const layoutSlot =
  <Tag extends LayoutTag>(defaultTagName: Tag, baseClassName: string) => (props: LayoutSlotProps<Tag>) =>
    useLayoutSlot(defaultTagName, baseClassName, props)

export const Layer = layoutSlot("div", "min-w-0")
export const Header = layoutSlot("header", "min-w-0")
export const Main = layoutSlot("main", "min-w-0")
export const Nav = layoutSlot("nav", "min-w-0")
export const Section = layoutSlot("section", "min-w-0")
export const Stack = layoutSlot("div", "flex min-w-0 flex-col")

/** How a flex row aligns its items on the cross axis. */
export type RowAlign = "baseline" | "center" | "start"

const rowAlignClassName = (align: RowAlign): string =>
  Match.value(align).pipe(
    Match.when("baseline", () => "items-baseline"),
    Match.when("center", () => "items-center"),
    Match.when("start", () => "items-start"),
    Match.exhaustive
  )

/**
 * A flex row: a layout slot plus its cross-axis alignment. Alignment is a
 * prop rather than a class so it cannot collide with the slot's base classes:
 * the slot's classes are joined, not merged, and two `items-*` utilities on
 * one element resolve by stylesheet order, not by which the caller wrote.
 */
const rowSlot =
  (baseClassName: string) => ({ align = "center", ...props }: LayoutSlotProps<"div"> & { readonly align?: RowAlign }) =>
    useLayoutSlot("div", `${baseClassName} ${rowAlignClassName(align)}`, props)

/** A single-line flex row. */
export const Rail = rowSlot("flex min-w-0")
/** A wrapping flex row. */
export const Cluster = rowSlot("flex min-w-0 flex-wrap")
