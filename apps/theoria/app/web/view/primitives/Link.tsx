import { useAtomSet } from "@effect-atom/atom-react"
import { Option } from "effect"
import type { ComponentProps, MouseEvent, ReactNode } from "react"

import { navigateAtom, shouldNavigateInBrowser } from "../../atoms/navigation.js"

import { classNames } from "./classNames.js"

/**
 * Internal (same-origin) navigation link.
 *
 * Preserves native anchor behavior while handling known application routes
 * through the browser navigation atom. Accepts React 19's `ref` prop so a
 * caller can move focus to the link.
 */
export const InternalLink = ({
  children,
  href,
  onClick,
  ...props
}: ComponentProps<"a"> & { readonly href: string }) => {
  const navigate = useAtomSet(navigateAtom)

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)

    if (
      shouldNavigateInBrowser({
        altKey: event.altKey,
        button: event.button,
        ctrlKey: event.ctrlKey,
        defaultPrevented: event.defaultPrevented,
        href,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        target: Option.fromNullable(props.target)
      })
    ) {
      event.preventDefault()
      navigate(href)
    }
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

/** Same-document anchor (`#fragment`) link; native scrolling, no router involvement. */
export const AnchorLink = ({ children, href, ...props }: ComponentProps<"a"> & { readonly href: string }) => (
  <a {...props} href={href}>
    {children}
  </a>
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
