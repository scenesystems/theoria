import type { ElementType, ReactNode } from "react"

import type { SurfaceVariant } from "../../../contracts/presentation.js"
import type { TextRole } from "../../../contracts/text.js"
import { semanticClassName } from "./semanticTextClasses.js"

type SemanticContentElement = "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "dt" | "dd" | "code"

export const SemanticContent = ({
  as,
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
  const Component: ElementType = as ?? "p"

  return (
    <Component
      className={`${semanticClassName(role, variant)} whitespace-pre-wrap ${className ?? ""}`}
    >
      {children}
    </Component>
  )
}
