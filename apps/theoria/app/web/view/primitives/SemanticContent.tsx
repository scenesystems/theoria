import { Option, Schema } from "effect"
import type { ReactNode } from "react"

import type { SurfaceVariant } from "../../../contracts/presentation.js"
import type { TextRole } from "../../../contracts/text.js"
import { classNames } from "./classNames.js"
import { semanticClassName } from "./semanticTextClasses.js"

/** The elements arbitrary content may be set in with a text role's glyphs. */
export const SemanticContentElement = Schema.Literal(
  "span",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "dt",
  "dd",
  "code"
)
export type SemanticContentElement = typeof SemanticContentElement.Type

export const SemanticContent = ({
  as = "p",
  children,
  className,
  role,
  variant = "expanded"
}: {
  readonly as?: SemanticContentElement
  readonly children: ReactNode
  readonly className?: string
  readonly role: TextRole
  readonly variant?: SurfaceVariant
}) => {
  const Component = as

  return (
    <Component
      className={classNames(
        semanticClassName(role, variant),
        "whitespace-normal",
        Option.getOrElse(Option.fromNullable(className), () => "")
      )}
    >
      {children}
    </Component>
  )
}
