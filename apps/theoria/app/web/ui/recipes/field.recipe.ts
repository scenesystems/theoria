import { cn } from "../structure/Box.js"

export type FieldTone = "default" | "accent" | "danger"

const fieldControlToneClassNames: Record<FieldTone, string> = {
  default: "border-border-muted bg-surface-panel text-content-primary placeholder:text-content-subtle",
  accent: "border-accent-border bg-surface-panel text-content-primary placeholder:text-content-subtle",
  danger: "border-intent-danger-border bg-intent-danger-surface text-content-primary placeholder:text-content-subtle"
}

const fieldFocusToneClassNames: Record<FieldTone, string> = {
  default:
    "focus-visible:border-border-strong focus-visible:ring-focus-ring/25 data-[focused]:border-border-strong data-[focused]:ring-focus-ring/25",
  accent:
    "focus-visible:border-accent-solid focus-visible:ring-focus-ring/25 data-[focused]:border-accent-solid data-[focused]:ring-focus-ring/25",
  danger:
    "focus-visible:border-intent-danger-content focus-visible:ring-intent-danger-border/30 data-[focused]:border-intent-danger-content data-[focused]:ring-intent-danger-border/30"
}

const fieldSwitchStatusToneClassNames: Record<FieldTone, string> = {
  default: "group-data-[checked]:text-content-primary",
  accent: "group-data-[checked]:text-accent-solid",
  danger: "group-data-[checked]:text-intent-danger-content"
}

const fieldSwitchTrackToneClassNames: Record<FieldTone, string> = {
  default: "group-data-[checked]:border-content-primary/20 group-data-[checked]:bg-content-primary/14",
  accent: "group-data-[checked]:border-accent-border group-data-[checked]:bg-accent-soft",
  danger: "group-data-[checked]:border-intent-danger-border group-data-[checked]:bg-intent-danger-surface"
}

const fieldSwitchThumbToneClassNames: Record<FieldTone, string> = {
  default: "group-data-[checked]:bg-content-primary",
  accent: "group-data-[checked]:bg-accent-solid",
  danger: "group-data-[checked]:bg-intent-danger-content"
}

const fieldSliderIndicatorToneClassNames: Record<FieldTone, string> = {
  default: "bg-content-primary",
  accent: "bg-accent-solid",
  danger: "bg-intent-danger-content"
}

const fieldSliderValueToneClassNames: Record<FieldTone, string> = {
  default: "text-content-primary",
  accent: "text-accent-solid",
  danger: "text-intent-danger-content"
}

const fieldLabelToneClassNames: Record<FieldTone, string> = {
  default: "text-content-muted",
  accent: "text-accent-solid",
  danger: "text-intent-danger-content"
}

export const fieldRootClassName = "flex min-w-0 flex-col gap-2"
export const fieldDescriptionClassName = "text-content-muted"
export const fieldMessageClassName = "text-intent-danger-content"

export const fieldLabelClassName = (
  { className, tone }: { readonly className?: string; readonly tone: FieldTone }
): string => cn(fieldLabelToneClassNames[tone], className)

const fieldSurfaceClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: FieldTone
}): string =>
  cn(
    "w-full rounded-ui-lg border shadow-ui-chip transition-[background-color,border-color,box-shadow,color] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 data-[invalid]:border-intent-danger-border data-[invalid]:ring-intent-danger-border/30",
    fieldControlToneClassNames[tone],
    fieldFocusToneClassNames[tone],
    className
  )

export const fieldControlSurfaceClassName = fieldSurfaceClassName

export const fieldControlClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: FieldTone
}): string =>
  fieldSurfaceClassName({
    tone,
    className: cn("min-h-11 px-4 py-3 focus-visible:outline-none focus-visible:ring-4", className)
  })

export const fieldTextAreaClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: FieldTone
}): string =>
  fieldControlClassName({
    tone,
    className: cn("min-h-28 resize-y leading-relaxed", className)
  })

export const fieldSwitchRootClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: FieldTone
}): string =>
  fieldSurfaceClassName({
    tone,
    className: cn(
      "group inline-flex min-h-11 items-center justify-between gap-4 px-4 py-3 outline-none data-[focused]:ring-4",
      className
    )
  })

export const fieldSwitchStatusClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: FieldTone
}): string =>
  cn(
    "font-family-(--ui-type-body-sm-family) text-(length:--ui-type-body-sm-size) leading-(--ui-type-body-sm-leading) font-weight-(--ui-type-body-sm-weight) tracking-(--ui-type-body-sm-tracking) text-content-muted transition-colors duration-150 ease-out",
    fieldSwitchStatusToneClassNames[tone],
    className
  )

export const fieldSwitchTrackClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: FieldTone
}): string =>
  cn(
    "relative inline-flex h-7 w-12 shrink-0 items-center rounded-ui-pill border border-border-subtle bg-surface-sunken transition-colors duration-150 ease-out group-data-[disabled]:opacity-60",
    fieldSwitchTrackToneClassNames[tone],
    className
  )

export const fieldSwitchThumbClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: FieldTone
}): string =>
  cn(
    "block size-5 translate-x-1 rounded-full border border-border-subtle bg-surface-panel shadow-ui-chip transition-transform duration-150 ease-out group-data-[checked]:translate-x-6",
    fieldSwitchThumbToneClassNames[tone],
    className
  )

export const fieldSliderRootClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: FieldTone
}): string =>
  fieldSurfaceClassName({
    tone,
    className: cn("flex min-h-11 flex-col gap-3 px-4 py-3 outline-none data-[focused]:ring-4", className)
  })

export const fieldSliderControlClassName = ({ className }: { readonly className?: string }): string =>
  cn("relative flex h-6 w-full touch-none items-center", className)

export const fieldSliderTrackClassName = ({ className }: { readonly className?: string }): string =>
  cn("h-2 w-full rounded-ui-pill bg-surface-sunken", className)

export const fieldSliderIndicatorClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: FieldTone
}): string => cn("h-full rounded-ui-pill", fieldSliderIndicatorToneClassNames[tone], className)

export const fieldSliderThumbClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: FieldTone
}): string =>
  cn(
    "block size-4 rounded-full border border-border-subtle bg-surface-panel shadow-ui-chip transition-[transform,box-shadow] duration-150 ease-out data-[dragging]:scale-110 data-[focused]:outline-none data-[focused]:ring-4",
    tone === "danger" ? "data-[focused]:ring-intent-danger-border/30" : "data-[focused]:ring-focus-ring/25",
    className
  )

export const fieldSliderValueClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: FieldTone
}): string =>
  cn(
    "font-family-(--ui-type-body-sm-family) text-(length:--ui-type-body-sm-size) leading-(--ui-type-body-sm-leading) font-weight-(--ui-type-body-sm-weight) tracking-(--ui-type-body-sm-tracking) tabular-nums",
    fieldSliderValueToneClassNames[tone],
    className
  )
