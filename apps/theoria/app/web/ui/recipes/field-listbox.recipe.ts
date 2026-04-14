import { cn } from "../structure/Box.js"
import { fieldControlClassName, fieldControlSurfaceClassName, type FieldTone } from "./field.recipe.js"

export const fieldSelectTriggerClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: FieldTone
}): string =>
  fieldControlClassName({
    tone,
    className: cn(
      "inline-flex items-center justify-between gap-3 text-left data-[popup-open]:shadow-ui-floating",
      className
    )
  })

export const fieldSelectValueClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "min-w-0 flex-1 truncate font-family-(--ui-type-body-family) text-(length:--ui-type-body-size) leading-(--ui-type-body-leading) font-weight-(--ui-type-body-weight) tracking-(--ui-type-body-tracking) text-content-primary data-[placeholder]:text-content-subtle",
    className
  )

export const fieldComboboxInputGroupClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: FieldTone
}): string =>
  fieldControlSurfaceClassName({
    tone,
    className: cn(
      "flex min-h-11 items-center gap-2 px-3 py-2 outline-none data-[focused]:ring-4 data-[popup-open]:shadow-ui-floating",
      className
    )
  })

export const fieldComboboxInputClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "min-w-0 flex-1 border-none bg-transparent font-family-(--ui-type-body-family) text-(length:--ui-type-body-size) leading-(--ui-type-body-leading) font-weight-(--ui-type-body-weight) tracking-(--ui-type-body-tracking) text-content-primary outline-none placeholder:text-content-subtle disabled:cursor-not-allowed",
    className
  )

export const fieldComboboxTriggerClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "inline-flex size-8 shrink-0 items-center justify-center rounded-ui-pill text-content-muted transition-colors duration-150 ease-out hover:bg-surface-sunken hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/25 data-[popup-open]:text-content-primary",
    className
  )

export const fieldListboxPositionerClassName = ({ className }: { readonly className?: string }): string =>
  cn("z-50 w-[max(var(--anchor-width),16rem)]", className)

export const fieldListboxPopupClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "overflow-hidden rounded-ui-xl border border-border-muted bg-surface-elevated p-1 shadow-ui-floating origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 ease-out data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
    className
  )

export const fieldListboxListClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex max-h-[min(20rem,var(--available-height))] flex-col gap-1 overflow-auto outline-none", className)

export const fieldListboxItemClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "inline-flex min-h-10 w-full items-center justify-between gap-3 rounded-ui-md px-3 py-2 text-left text-content-muted outline-none transition-colors duration-150 ease-out data-[highlighted]:bg-surface-sunken data-[highlighted]:text-content-primary data-[selected]:text-content-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
    className
  )

export const fieldListboxIndicatorClassName = ({ className }: { readonly className?: string }): string =>
  cn("shrink-0 text-accent-solid", className)

export const fieldListboxEmptyClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "px-3 py-2 font-family-(--ui-type-body-sm-family) text-(length:--ui-type-body-sm-size) leading-(--ui-type-body-sm-leading) font-weight-(--ui-type-body-sm-weight) tracking-(--ui-type-body-sm-tracking) text-content-muted",
    className
  )
