import { Effect, Schema } from "effect"

import { EntryId } from "../../contracts/entry/id.js"

class EntryRunRoute extends Schema.TaggedClass<EntryRunRoute>()("run", {
  id: EntryId
}) {}

class EntryPreloadRoute extends Schema.TaggedClass<EntryPreloadRoute>()("preload", {
  id: EntryId
}) {}

class EntryStreamRoute extends Schema.TaggedClass<EntryStreamRoute>()("stream", {
  id: EntryId
}) {}

const EntryRoute = Schema.Union(EntryRunRoute, EntryPreloadRoute, EntryStreamRoute)

const EntryRouteSegments = Schema.Tuple(
  Schema.Literal("api"),
  Schema.Literal("entries"),
  Schema.String,
  Schema.String
)

export type EntryRoute = typeof EntryRoute.Type

export class InvalidEntryRoute extends Schema.TaggedError<InvalidEntryRoute>()(
  "InvalidEntryRoute",
  {
    pathname: Schema.String
  }
) {}

const pathnameSegments = (pathname: string): ReadonlyArray<string> =>
  pathname.split("/").filter((segment) => segment.length > 0)

const routeInputFromSegments = (pathname: string) =>
  Schema.decodeUnknown(EntryRouteSegments)(pathnameSegments(pathname)).pipe(
    Effect.map(([_, __, id, _tag]) => ({ _tag, id })),
    Effect.mapError(() => new InvalidEntryRoute({ pathname }))
  )

export const decodeEntryRoute = (pathname: string): Effect.Effect<EntryRoute, InvalidEntryRoute> =>
  routeInputFromSegments(pathname).pipe(
    Effect.flatMap((route) => Schema.decodeUnknown(EntryRoute)(route)),
    Effect.mapError(() => new InvalidEntryRoute({ pathname }))
  )
