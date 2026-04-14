import { Separator } from "@base-ui/react/separator"
import { Match } from "effect"
import type { ReactNode } from "react"

import type { SurfaceVariant } from "../../../contracts/presentation/program.js"

import { Section } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

export const surfaceBodyClass = (variant: SurfaceVariant): string =>
  Match.value(variant).pipe(
    Match.when("expanded", () => "grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"),
    Match.orElse(() => "grid gap-3")
  )

const surfaceShellClass = (variant: SurfaceVariant): string =>
  "relative flex flex-col overflow-hidden rounded-lg border"
  + Match.value(variant).pipe(
    Match.when("expanded", () => " col-span-full gap-4 p-5 sm:p-6"),
    Match.orElse(() => " gap-3.5 p-4")
  )

const panelClassName = (variant: SurfaceVariant): string =>
  Match.value(variant).pipe(
    Match.when("expanded", () => "rounded-md border p-4 sm:p-5"),
    Match.orElse(() => "rounded-md border p-3.5")
  )

export const SurfaceShell = ({
  className,
  children,
  variant
}: {
  readonly className: string
  readonly children: ReactNode
  readonly variant: SurfaceVariant
}) => <article className={`${surfaceShellClass(variant)} ${className}`}>{children}</article>

export const SurfacePanel = ({
  className,
  children,
  title,
  titleClassName,
  variant
}: {
  readonly className: string
  readonly children: ReactNode
  readonly title: string
  readonly titleClassName?: string
  readonly variant: SurfaceVariant
}) => (
  <Section className={`${panelClassName(variant)} ${className}`}>
    <SemanticText
      as="h3"
      className={titleClassName ?? "text-ink-900"}
      role="section-title"
      text={title}
      variant={variant}
    />
    <Separator className="mt-2 h-px bg-stage-200/90" />
    {children}
  </Section>
)
