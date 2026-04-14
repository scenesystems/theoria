import { Match } from "effect"
import * as Arr from "effect/Array"
import type { CSSProperties } from "react"

import type { SurfaceVariant } from "../../../contracts/presentation/program.js"
import {
  fontFamilyCss,
  fontWeightNumeric,
  maxWidthFor,
  semanticsFor,
  type TextProjection,
  type TextRole,
  type TextWrapAuthority
} from "../../../contracts/presentation/text.js"
import { useTextProjection } from "../../atoms/text.js"

type SemanticTextElement = "span" | "p" | "h1" | "h2" | "h3" | "dt" | "dd" | "code"

type BlockElement = "p" | "h1" | "h2" | "h3" | "dt" | "dd"

const isBlockElement = (el: SemanticTextElement): el is BlockElement => el !== "span" && el !== "code"

const textTransformFor = (role: TextRole): string => role === "row-label" ? "uppercase" : ""

const textStyleFor = (role: TextRole): CSSProperties => {
  const semantics = semanticsFor(role)

  return {
    fontFamily: fontFamilyCss(semantics.family),
    fontSize: `${String(semantics.fontSize)}px`,
    fontWeight: fontWeightNumeric(semantics.weight),
    letterSpacing: semantics.tracking === 0 ? undefined : `${String(semantics.tracking)}em`,
    lineHeight: `${String(semantics.lineHeight)}px`,
    textTransform: textTransformFor(role)
  }
}

const constrainedTextStyle = (role: TextRole, variant: SurfaceVariant): CSSProperties =>
  shouldConstrainWidth(role)
    ? { maxWidth: `${String(maxWidthFor(role, variant))}px` }
    : {}

const shouldConstrainWidth = (role: TextRole): boolean =>
  Match.value(role).pipe(
    Match.when("button-label", () => false),
    Match.when("tab-label", () => false),
    Match.orElse(() => true)
  )

const projectedLineWhitespaceClass = (preserveWhitespace: boolean): string =>
  preserveWhitespace ? "whitespace-pre" : "whitespace-nowrap"

const projectedLineText = (text: string): string => text.length === 0 ? "\u00a0" : text

type ProjectionLine = TextProjection["lines"][number]

const reservedLineStyle = (role: TextRole, reserveLines: number | undefined): CSSProperties | undefined =>
  reserveLines === undefined
    ? undefined
    : { minHeight: `${String(semanticsFor(role).lineHeight * reserveLines)}px` }

const limitedProjectionLines = ({
  maxLines,
  projection
}: {
  readonly maxLines: number | undefined
  readonly projection: TextProjection
}): ReadonlyArray<ProjectionLine> => {
  if (maxLines === undefined || projection.lines.length <= maxLines) {
    return projection.lines
  }

  const visibleLines = projection.lines.slice(0, maxLines)

  return visibleLines.length === 0 ? projection.lines : visibleLines
}

const lineClampStyle = ({
  maxLines,
  reserveLines,
  role
}: {
  readonly maxLines: number | undefined
  readonly reserveLines: number | undefined
  readonly role: TextRole
}): CSSProperties | undefined =>
  maxLines === undefined && reserveLines === undefined
    ? undefined
    : {
      ...reservedLineStyle(role, reserveLines),
      ...(maxLines === undefined
        ? {}
        : {
          overflow: "hidden",
          maxHeight: `${String(semanticsFor(role).lineHeight * maxLines)}px`
        })
    }

const combinedClassName = (contractClassName: string, className: string | undefined): string =>
  className === undefined ? contractClassName : `${className} ${contractClassName}`

const combinedStyle = (
  base: CSSProperties,
  extension: CSSProperties | undefined
): CSSProperties => ({
  ...base,
  ...(extension ?? {})
})

const ProjectedLines = ({
  preserveWhitespace,
  projection
}: {
  readonly preserveWhitespace: boolean
  readonly projection: TextProjection
}) => (
  <>
    {Arr.map(
      projection.lines,
      (line) => (
        <span key={line.index} className={`block ${projectedLineWhitespaceClass(preserveWhitespace)}`}>
          {projectedLineText(line.text)}
        </span>
      )
    )}
  </>
)

const InlineText = ({
  as,
  className,
  role,
  text
}: {
  readonly as: SemanticTextElement
  readonly className: string | undefined
  readonly role: TextRole
  readonly text: string
}) => {
  const Component = as

  return (
    <Component className={combinedClassName("whitespace-nowrap", className)} style={textStyleFor(role)}>
      {text}
    </Component>
  )
}

const NoWrapBlockText = ({
  as,
  className,
  role,
  text
}: {
  readonly as: BlockElement
  readonly className: string | undefined
  readonly role: TextRole
  readonly text: string
}) => {
  const Component = as

  return (
    <Component className={combinedClassName("whitespace-nowrap", className)} style={textStyleFor(role)}>
      {text}
    </Component>
  )
}

const BrowserWrappedBlockText = ({
  as,
  className,
  maxLines,
  reserveLines,
  role,
  text,
  variant
}: {
  readonly as: BlockElement
  readonly className: string | undefined
  readonly maxLines: number | undefined
  readonly reserveLines: number | undefined
  readonly role: TextRole
  readonly text: string
  readonly variant: SurfaceVariant
}) => {
  const semantics = semanticsFor(role)
  const Component = as
  const whiteSpace = Match.value(semantics.whiteSpace).pipe(
    Match.when("pre-wrap", () => "whitespace-pre-wrap"),
    Match.orElse(() => "whitespace-normal")
  )

  return (
    <Component
      className={combinedClassName(whiteSpace, className)}
      style={combinedStyle(
        {
          ...textStyleFor(role),
          ...constrainedTextStyle(role, variant)
        },
        lineClampStyle({ maxLines, reserveLines, role })
      )}
    >
      {text}
    </Component>
  )
}

const ProjectedWrappedBlockText = ({
  as,
  className,
  maxLines,
  reserveLines,
  role,
  text,
  variant
}: {
  readonly as: BlockElement
  readonly className: string | undefined
  readonly maxLines: number | undefined
  readonly reserveLines: number | undefined
  readonly role: TextRole
  readonly text: string
  readonly variant: SurfaceVariant
}) => {
  const { projection, ref } = useTextProjection({ role, text, variant })
  const semantics = semanticsFor(role)
  const Component = as

  if (projection !== null) {
    const visibleLines = limitedProjectionLines({ maxLines, projection })

    return (
      <Component
        ref={ref}
        className={className}
        data-lines={visibleLines.length}
        data-height={visibleLines.length * semantics.lineHeight}
        data-max-line-width={projection.summary.maxLineWidth}
        style={combinedStyle(
          {
            ...textStyleFor(role),
            ...constrainedTextStyle(role, variant)
          },
          reservedLineStyle(role, reserveLines)
        )}
      >
        <ProjectedLines
          preserveWhitespace={semantics.whiteSpace === "pre-wrap"}
          projection={{ ...projection, lines: visibleLines }}
        />
      </Component>
    )
  }

  return (
    <BrowserWrappedBlockText
      as={as}
      className={className}
      maxLines={maxLines}
      reserveLines={reserveLines}
      role={role}
      text={text}
      variant={variant}
    />
  )
}

export const SemanticText = ({
  as,
  className,
  lineLimit,
  role,
  reserveLines,
  text,
  wrapAuthority,
  variant = "expanded"
}: {
  readonly as?: SemanticTextElement
  readonly className?: string
  readonly lineLimit?: number
  readonly role: TextRole
  readonly reserveLines?: number
  readonly text: string
  readonly wrapAuthority?: TextWrapAuthority
  readonly variant?: SurfaceVariant
}) => {
  const element = as ?? "p"
  const semantics = semanticsFor(role)
  const resolvedWrapAuthority = wrapAuthority ?? semantics.wrapAuthority

  if (!isBlockElement(element)) {
    return <InlineText as={element} className={className} role={role} text={text} />
  }

  if (semantics.lineBreaks === "nowrap") {
    return <NoWrapBlockText as={element} className={className} role={role} text={text} />
  }

  if (resolvedWrapAuthority === "native-browser") {
    return (
      <BrowserWrappedBlockText
        as={element}
        className={className}
        maxLines={lineLimit}
        reserveLines={reserveLines}
        role={role}
        text={text}
        variant={variant}
      />
    )
  }

  return (
    <ProjectedWrappedBlockText
      as={element}
      className={className}
      maxLines={lineLimit}
      reserveLines={reserveLines}
      role={role}
      text={text}
      variant={variant}
    />
  )
}
