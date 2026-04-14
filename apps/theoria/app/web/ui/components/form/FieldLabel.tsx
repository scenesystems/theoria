import type { ComponentPropsWithRef, ReactNode } from "react"

import { FieldBehavior } from "../../behavior/FieldBehavior.js"
import { fieldLabelClassName, type FieldTone } from "../../recipes/field.recipe.js"
import { withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"

type FieldLabelProps = Omit<ComponentPropsWithRef<typeof FieldBehavior.Label>, "children" | "className"> & {
  readonly children: ReactNode
  readonly className?: string
  readonly tone?: FieldTone
}

export const FieldLabel = ({ children, className, tone = "default", ...props }: FieldLabelProps) => (
  <FieldBehavior.Label {...props} className={fieldLabelClassName({ tone, ...withClassName(className) })}>
    <SemanticText role="label" tone="inherit">
      {children}
    </SemanticText>
  </FieldBehavior.Label>
)
