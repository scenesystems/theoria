import { Match, Option, Schema } from "effect"

import { EntryId, type EntryId as EntryIdType, isEntryId } from "./id.js"

const entryApiPathnamePrefix = "/api/entries"

const EntryApiRouteTag = Schema.Literal("run", "preload", "stream")

type EntryApiRouteTag = typeof EntryApiRouteTag.Type

const isEntryApiRouteTag = Schema.is(EntryApiRouteTag)

const pathnameSegments = (pathname: string): ReadonlyArray<string> =>
  pathname.split("/").filter((segment) => segment.length > 0)

const entryApiRouteParts = (
  pathname: string
): Option.Option<{ readonly id: EntryIdType; readonly tag: EntryApiRouteTag }> => {
  const segments = pathnameSegments(pathname)
  const id = segments[2]
  const tag = segments[3]

  return segments.length === 4
      && segments[0] === "api"
      && segments[1] === "entries"
      && isEntryId(id)
      && isEntryApiRouteTag(tag)
    ? Option.some({ id, tag })
    : Option.none()
}

export class EntryRunRoute extends Schema.TaggedClass<EntryRunRoute>()("run", {
  id: EntryId
}) {
  static fromEntryId(id: EntryIdType): EntryRunRoute {
    return EntryRunRoute.make({ id })
  }

  static fromPathname(pathname: string): Option.Option<EntryRunRoute> {
    return entryApiRouteParts(pathname).pipe(
      Option.filter(({ tag }) => tag === "run"),
      Option.map(({ id }) => EntryRunRoute.fromEntryId(id))
    )
  }

  static matches(pathname: string): boolean {
    return Option.isSome(EntryRunRoute.fromPathname(pathname))
  }

  path(): string {
    return `${entryApiPathnamePrefix}/${this.id}/run`
  }
}

export class EntryPreloadRoute extends Schema.TaggedClass<EntryPreloadRoute>()("preload", {
  id: EntryId
}) {
  static fromEntryId(id: EntryIdType): EntryPreloadRoute {
    return EntryPreloadRoute.make({ id })
  }

  static fromPathname(pathname: string): Option.Option<EntryPreloadRoute> {
    return entryApiRouteParts(pathname).pipe(
      Option.filter(({ tag }) => tag === "preload"),
      Option.map(({ id }) => EntryPreloadRoute.fromEntryId(id))
    )
  }

  static matches(pathname: string): boolean {
    return Option.isSome(EntryPreloadRoute.fromPathname(pathname))
  }

  path(): string {
    return `${entryApiPathnamePrefix}/${this.id}/preload`
  }
}

export class EntryStreamRoute extends Schema.TaggedClass<EntryStreamRoute>()("stream", {
  id: EntryId
}) {
  static fromEntryId(id: EntryIdType): EntryStreamRoute {
    return EntryStreamRoute.make({ id })
  }

  static fromPathname(pathname: string): Option.Option<EntryStreamRoute> {
    return entryApiRouteParts(pathname).pipe(
      Option.filter(({ tag }) => tag === "stream"),
      Option.map(({ id }) => EntryStreamRoute.fromEntryId(id))
    )
  }

  static matches(pathname: string): boolean {
    return Option.isSome(EntryStreamRoute.fromPathname(pathname))
  }

  path(): string {
    return `${entryApiPathnamePrefix}/${this.id}/stream`
  }

  url(request: string): string {
    const params = new URLSearchParams({ request })

    return `${this.path()}?${params.toString()}`
  }
}

export const EntryApiRouteSchema = Schema.Union(EntryRunRoute, EntryPreloadRoute, EntryStreamRoute)

export type EntryApiRoute = typeof EntryApiRouteSchema.Type

export const entryApiRouteFromPathname = (pathname: string): Option.Option<EntryApiRoute> =>
  Option.match(entryApiRouteParts(pathname), {
    onNone: () => Option.none(),
    onSome: ({ id, tag }) =>
      Match.value(tag).pipe(
        Match.when("run", () => Option.some<EntryApiRoute>(EntryRunRoute.fromEntryId(id))),
        Match.when("preload", () => Option.some<EntryApiRoute>(EntryPreloadRoute.fromEntryId(id))),
        Match.when("stream", () => Option.some<EntryApiRoute>(EntryStreamRoute.fromEntryId(id))),
        Match.exhaustive
      )
  })
