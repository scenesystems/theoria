import { ArrowUturnLeftIcon } from "@heroicons/react/24/outline"

import { Button } from "../action/Button.js"

type ReopenInteractionActionProps = {
  readonly disabled?: boolean
  readonly label?: string
  readonly onPress?: () => void
}

export const ReopenInteractionAction = ({
  disabled = false,
  label = "Return to interaction",
  onPress
}: ReopenInteractionActionProps) => (
  <Button
    disabled={disabled || onPress === undefined}
    leadingIcon={ArrowUturnLeftIcon}
    onClick={onPress}
    size="sm"
    tone="ghost"
  >
    {label}
  </Button>
)
