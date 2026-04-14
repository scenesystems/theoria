import type { ComponentPropsWithRef, ReactNode } from "react"

import { FieldBehavior } from "../../behavior/FieldBehavior.js"
import { fieldMessageClassName } from "../../recipes/field.recipe.js"
import { SemanticText } from "../../structure/SemanticText.js"

type FieldMessageProps = Omit<ComponentPropsWithRef<typeof FieldBehavior.Error>, "children" | "className"> & {
  readonly children: ReactNode
  readonly className?: string
}

export const FieldMessage = ({ children, className, ...props }: FieldMessageProps) => (
  <FieldBehavior.Error {...props} className={[fieldMessageClassName, className].filter(Boolean).join(" ")}>
    <SemanticText role="body-sm" tone="inherit">
      {children}
    </SemanticText>
  </FieldBehavior.Error>
)
