import { Boolean as Bool, Match, Option, Predicate } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"
import type { ReactNode } from "react"

import type { ApiDocPart, GuideInline } from "@theoria/docs-model"
import { linkTextClassName } from "../primitives/designSystem.js"
import { ExternalLink, InternalLink } from "../primitives/Link.js"

type RichPart = ApiDocPart | GuideInline

/** A link into this site — a path or a fragment — stays a client-side link; any other leaves it. */
const staysOnSite: Predicate.Predicate<string> = Predicate.some([Str.startsWith("/"), Str.startsWith("#")])

const richLink = (href: string, text: string, key: string): ReactNode => {
  const className = `font-medium text-ink ${linkTextClassName}`

  return Bool.match(staysOnSite(href), {
    onTrue: () => <InternalLink className={className} href={href} key={key}>{text}</InternalLink>,
    onFalse: () => <ExternalLink className={className} href={href} key={key}>{text}</ExternalLink>
  })
}

/** A guide's link always has a target; an API part's may have none, and then reads as plain text. */
const linkTarget = (href: string | Option.Option<string>): Option.Option<string> =>
  Match.value(href).pipe(
    Match.when(Predicate.isString, (target) => Option.some(target)),
    Match.orElse((target) => target)
  )

const richPart = (part: RichPart, key: string): ReactNode =>
  Match.value(part).pipe(
    Match.when({ kind: "text" }, ({ text }) => text),
    Match.when({ kind: "code" }, ({ text }) => (
      <code
        className="rounded-mark border border-hairline-glass bg-instrument-glass px-1.5 py-0.5 font-mono text-[0.88em] text-ink"
        key={key}
      >
        {text}
      </code>
    )),
    Match.when({ kind: "link" }, ({ href, text }) =>
      Option.match(linkTarget(href), {
        onNone: () => text,
        onSome: (target) => richLink(target, text, key)
      })),
    Match.exhaustive
  )

export const DocsRichText = ({ parts }: { readonly parts: ReadonlyArray<RichPart> }) => (
  <>
    {Arr.map(parts, (part, index) => richPart(part, `${part.kind}:${String(index)}:${String(Str.length(part.text))}`))}
  </>
)
