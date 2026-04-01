import type { ReactNode } from "react"

/**
 * Internal (same-origin) navigation link.
 *
 * Renders a plain anchor for client-side navigation. Use for all internal
 * hrefs (e.g. `/demos/effect-text`).
 */
export const InternalLink = ({
  children,
  className,
  href
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly href: string
}) => (
  <a className={className} href={href}>
    {children}
  </a>
)

/**
 * External (cross-origin) navigation link.
 *
 * Opens in a new tab with `noopener noreferrer`. Use for npm, GitHub, and
 * other third-party URLs.
 */
export const ExternalLink = ({
  children,
  className,
  href
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly href: string
}) => (
  <a className={className} href={href} rel="noopener noreferrer" target="_blank">
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
  <a className={`after:absolute after:inset-0 after:content-[''] ${className ?? ""}`} href={href}>
    {children}
  </a>
)
