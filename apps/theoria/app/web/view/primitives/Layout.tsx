import { useRender } from "@base-ui/react/use-render"

import { classNames } from "./classNames.js"

/** The elements a layout slot renders by default. */
type LayoutTag = "div" | "header" | "main" | "nav" | "section"

/**
 * Props of a layout slot: the attributes and ref of its default element plus
 * Base UI's `render` prop, which swaps the rendered element for another tag
 * or composes the slot with another component (`render={<ul />}`,
 * `render={<motion.div />}`). Base UI merges the slot's classes, handlers and
 * refs into whatever `render` supplies.
 */
export type LayoutSlotProps<Tag extends LayoutTag> = useRender.ComponentProps<Tag>

/**
 * A layout slot: a semantic element with the slot's base classes, rendered
 * through Base UI's {@link useRender} so the element is chosen the same way it
 * is for every other Base UI component in the app. The props are typed by the
 * slot's default element, so `<Main>` accepts what a `<main>` accepts.
 */
const layoutSlot =
  <Tag extends LayoutTag>(defaultTagName: Tag, baseClassName: string) =>
  ({ className, ref, render, ...props }: LayoutSlotProps<Tag>) =>
    useRender({
      defaultTagName,
      props: { ...props, className: classNames(baseClassName, className ?? "") },
      ref,
      render
    })

export const Layer = layoutSlot("div", "min-w-0")
export const Header = layoutSlot("header", "min-w-0")
export const Main = layoutSlot("main", "min-w-0")
export const Nav = layoutSlot("nav", "min-w-0")
export const Section = layoutSlot("section", "min-w-0")
export const Stack = layoutSlot("div", "flex min-w-0 flex-col")
export const Rail = layoutSlot("div", "flex min-w-0 items-center")
export const Cluster = layoutSlot("div", "flex min-w-0 flex-wrap items-center")
