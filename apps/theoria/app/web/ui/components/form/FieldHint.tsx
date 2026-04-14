import type { ComponentPropsWithRef, ReactNode } from "react"

import { FieldBehavior } from "../../behavior/FieldBehavior.js"
import { fieldDescriptionClassName } from "../../recipes/field.recipe.js"
import { SemanticText } from "../../structure/SemanticText.js"

type FieldHintProps = Omit<ComponentPropsWithRef<typeof FieldBehavior.Description>, "children" | "className"> & {
  readonly children: ReactNode
  readonly className?: string
}

export const FieldHint = ({ children, className, ...props }: FieldHintProps) => (
  <FieldBehavior.Description {...props} className={[fieldDescriptionClassName, className].filter(Boolean).join(" ")}>
    <SemanticText role="body-sm" tone="inherit">
      {children}
    </SemanticText>
  </FieldBehavior.Description>
)
