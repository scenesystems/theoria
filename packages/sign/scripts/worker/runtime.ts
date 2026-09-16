/** Scoped workerd process and HTTP transport shared by verification and measurement. */
import { Command, FileSystem, HttpClient, HttpClientRequest, HttpClientResponse, Path, Url } from "@effect/platform"
import { Array as Arr, Config, Data, Effect, Number as N, Option, Schema, Stream, String as Str } from "effect"

import { RequestBody, Result } from "./protocol.js"

class WorkerUnavailable extends Schema.TaggedError<WorkerUnavailable>()("WorkerUnavailable", {
  reason: Schema.String
}) {}

const Listening = Schema.parseJson(Schema.Struct({
  event: Schema.Literal("listen"),
  socket: Schema.Literal("http"),
  port: Schema.Int.pipe(Schema.positive())
}))

export const startWorker = Effect.gen(function*() {
  const binary = yield* Config.string("SIGN_WORKERD")
  const path = yield* Path.Path
  const root = yield* path.fromFileUrl(yield* Url.fromString("../../", import.meta.url))
  const child = yield* Command.start(
    Command.make(
      binary,
      "serve",
      path.join(root, "config.capnp"),
      "--socket-addr=http=127.0.0.1:0",
      "--control-fd=1"
    ).pipe(Command.stderr("inherit"))
  )
  const listening = yield* child.stdout.pipe(
    Stream.decodeText(),
    Stream.splitLines,
    Stream.mapEffect(Schema.decode(Listening)),
    Stream.runHead,
    Effect.flatMap(Option.match({
      onNone: () => Effect.fail(new WorkerUnavailable({ reason: "workerd exited before listening" })),
      onSome: Effect.succeed
    })),
    Effect.timeout("10 seconds")
  )
  const origin = Str.concat("http://127.0.0.1:", yield* Schema.encode(Schema.NumberFromString)(listening.port))
  const client = yield* HttpClient.HttpClient
  const request = (body: typeof RequestBody.Type) =>
    HttpClientRequest.schemaBodyJson(RequestBody)(HttpClientRequest.post(origin), body).pipe(
      Effect.flatMap(client.execute),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(Result))
    )
  const fs = yield* FileSystem.FileSystem
  const pid = yield* Schema.encode(Schema.NumberFromString)(child.pid)
  const cpuTicks = fs.readFileString(path.join("/proc", pid, "stat")).pipe(
    // The command name is parenthesized and may itself contain spaces or ')'.
    Effect.flatMap((stat) =>
      Option.match(Arr.last(Str.split(stat, ")")), {
        onNone: () => Effect.fail(new WorkerUnavailable({ reason: "malformed process stat" })),
        onSome: (suffix) => Effect.succeed(Str.split(/\s+/)(Str.trim(suffix)))
      })
    ),
    Effect.flatMap((fields) => Effect.all(Arr.make(Arr.get(fields, 11), Arr.get(fields, 12)))),
    Effect.flatMap(Effect.forEach((field) => Schema.decode(Schema.NumberFromString)(field))),
    Effect.map(N.sumAll)
  )
  return Data.struct({ request, cpuTicks, binary })
})
