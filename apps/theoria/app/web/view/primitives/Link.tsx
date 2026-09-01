import { useAtomSet } from "@effect-atom/atom-react"
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react"

import { navigateAtom, shouldNavigateInBrowser } from "../../atoms/navigation.js"

type InternalLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  readonly href: string
}

/**
 * Internal (same-origin) navigation link.
 *
 * Preserves native anchor behavior while handling known application routes
 * through the browser navigation atom.
 */
export const InternalLink = ({
  children,
  href,
  onClick,
  ...props
}: InternalLinkProps) => {
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
        target: props.target ?? null
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
}: InternalLinkProps) => (
  <a {...props} href={href} rel="noopener noreferrer" target="_blank">
    {children}
  </a>
)

type AnchorLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  readonly href: string
}

export const AnchorLink = ({ children, href, ...props }: AnchorLinkProps) => (
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
  className,
  href
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly href: string
}) => (
  <InternalLink className={`after:absolute after:inset-0 after:content-[''] ${className ?? ""}`} href={href}>
    {children}
  </InternalLink>
)
