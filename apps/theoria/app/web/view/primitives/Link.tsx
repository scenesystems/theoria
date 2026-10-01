import { useAtomSet } from "@effect-atom/atom-react"
import { Boolean as Bool, Function, Option } from "effect"
import type { ComponentProps, MouseEvent, ReactNode } from "react"

import { navigateAtom, shouldNavigateInBrowser } from "../../atoms/navigation.js"

import { classNames } from "./classNames.js"

/**
 * Internal (same-origin) navigation link.
 *
 * Plain clicks go through `navigateAtom`, which changes the route in place
 * for application paths and performs a full navigation for anything else;
 * modified clicks and new-tab targets keep the browser's own behaviour.
 * Accepts React 19's `ref` prop so a caller can move focus to the link.
 */
export const InternalLink = ({
  children,
  href,
  onClick,
  ...props
}: ComponentProps<"a"> & { readonly href: string }) => {
  const navigate = useAtomSet(navigateAtom)

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    Option.match(Option.fromNullable(onClick), {
      onNone: Function.constVoid,
      onSome: (click) => click(event)
    })

    Bool.match(
      shouldNavigateInBrowser({
        altKey: event.altKey,
        button: event.button,
        ctrlKey: event.ctrlKey,
        defaultPrevented: event.defaultPrevented,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        target: Option.fromNullable(props.target)
      }),
      {
        onTrue: () => {
          event.preventDefault()
          navigate(href)
        },
        onFalse: Function.constVoid
      }
    )
  }

  return (
    <a {...props} href={href} onClick={handleClick}>
      {children}
    </a>
  )
}

/**
 * External (cross-origin) navigation link.
 *
 * Opens in a new tab with `noopener noreferrer`. Use for npm, GitHub, and
 * other third-party URLs.
 */
export const ExternalLink = ({
  children,
  href,
  ...props
}: ComponentProps<"a"> & { readonly href: string }) => (
  <a {...props} href={href} rel="noopener noreferrer" target="_blank">
    {children}
  </a>
)

/** Same-document anchor (`#fragment`) link; plain clicks honor the visitor's motion preference. */
export const AnchorLink = ({ children, href, ...props }: ComponentProps<"a"> & { readonly href: string }) => (
  <InternalLink {...props} href={href}>
    {children}
  </InternalLink>
)

/**
 * Stretched-link overlay for full-surface clickable cards.
 *
 * Place inside a `relative` container. The `after:` pseudo-element covers the
 * entire card surface, making the whole area clickable. Sibling interactive
 * elements must use `relative z-10` to sit above the overlay.
 */
export const CardLink = ({
  children,
  className = "",
  href
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly href: string
}) => (
  <InternalLink className={classNames("after:absolute after:inset-0 after:content-['']", className)} href={href}>
    {children}
  </InternalLink>
)
