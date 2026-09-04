import type { HTMLAttributes, RefCallback } from "react"

import { classNames } from "./classNames.js"

/**
 * The elements a layout slot may render as. Every slot accepts the same
 * generic HTML attributes and a callback ref over `HTMLElement`, so any tag
 * here is sound for any slot; element-specific attributes (`href`, `type`)
 * belong on the element itself, not on a layout slot.
 */
export type LayoutTag =
  | "article"
  | "aside"
  | "blockquote"
  | "dd"
  | "div"
  | "dl"
  | "dt"
  | "figcaption"
  | "figure"
  | "footer"
  | "header"
  | "li"
  | "main"
  | "nav"
  | "ol"
  | "p"
  | "pre"
  | "section"
  | "span"
  | "ul"

/**
 * A layout slot: a semantic element with the slot's base classes and a
 * caller-chosen tag. The ref is a callback so the slot can hand any element
 * in {@link LayoutTag} to an observer; an object ref would pin one element type.
 */
const layoutSlot = (defaultTag: LayoutTag, baseClassName: string) =>
({
  as: Component = defaultTag,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & { readonly as?: LayoutTag; readonly ref?: RefCallback<HTMLElement> }) => (
  <Component {...props} className={classNames(baseClassName, className)} />
)

export const Layer = layoutSlot("div", "min-w-0")
export const Header = layoutSlot("header", "min-w-0")
export const Main = layoutSlot("main", "min-w-0")
export const Nav = layoutSlot("nav", "min-w-0")
export const Section = layoutSlot("section", "min-w-0")
export const Stack = layoutSlot("div", "flex min-w-0 flex-col")
export const Rail = layoutSlot("div", "flex min-w-0 items-center")
export const Cluster = layoutSlot("div", "flex min-w-0 flex-wrap items-center")
