import type { ComponentPropsWithRef, ReactNode } from "react"

import { FieldBehavior } from "../../behavior/FieldBehavior.js"
import { fieldRootClassName, type FieldTone } from "../../recipes/field.recipe.js"
import { withClassName } from "../../structure/Box.js"
import { Stack } from "../../structure/Stack.js"
import { FieldHint } from "./FieldHint.js"
import { FieldLabel } from "./FieldLabel.js"
import { FieldMessage } from "./FieldMessage.js"

type FieldProps = Omit<ComponentPropsWithRef<typeof FieldBehavior.Root>, "children" | "className"> & {
  readonly children: ReactNode
  readonly className?: string
  readonly hint?: ReactNode
  readonly label?: ReactNode
  readonly message?: ReactNode
  readonly tone?: FieldTone
}

export const Field = ({
  children,
  className,
  hint,
  label,
  message,
  tone = "default",
  ...props
}: FieldProps) => (
  <FieldBehavior.Root {...props} {...withClassName([fieldRootClassName, className].filter(Boolean).join(" "))}>
    <Stack gap="sm">
      {label === undefined ? null : <FieldLabel tone={tone}>{label}</FieldLabel>}
      {hint === undefined ? null : <FieldHint>{hint}</FieldHint>}
      {children}
      {message === undefined ? null : <FieldMessage>{message}</FieldMessage>}
    </Stack>
  </FieldBehavior.Root>
)
