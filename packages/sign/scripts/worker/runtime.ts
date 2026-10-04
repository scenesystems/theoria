/** Scoped workerd process and HTTP transport shared by verification and measurement. */
import {
  Array as Arr,
  Config,
  Data,
  Effect,
  FileSystem,
  Number as N,
  Option,
  Path,
  Schema,
  Stream,
  String as Str
} from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import { RequestBody, Result } from "./protocol.js"

class WorkerUnavailable extends Data.TaggedError("WorkerUnavailable")<{
  readonly reason: string
}> {}

const Listening = Schema.fromJsonString(Schema.Struct({
  event: Schema.Literal("listen"),
  socket: Schema.Literal("http"),
  port: Schema.Int.check(Schema.isGreaterThan(0))
}))

export const startWorker = Effect.gen(function*() {
  const binary = yield* Config.String("SIGN_WORKERD")
  const path = yield* Path.Path
  const script = yield* path.fromFileUrl(yield* Schema.decodeEffect(Schema.URLFromString)(import.meta.url))
  const root = path.resolve(path.dirname(script), "../..")
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const child = yield* spawner.spawn(
    ChildProcess.make(
      binary,
      ["serve", path.join(root, "config.capnp"), "--socket-addr=http=127.0.0.1:0", "--control-fd=1"],
      { stderr: "inherit" }
    )
  )
  const listening = yield* child.stdout.pipe(
    Stream.decodeText(),
    Stream.splitLines,
    Stream.mapEffect((line) => Schema.decodeEffect(Listening)(line)),
    Stream.runHead,
    Effect.flatMap(Option.match({
      onNone: () => Effect.fail(new WorkerUnavailable({ reason: "workerd exited before listening" })),
      onSome: Effect.succeed
    })),
    Effect.timeout("10 seconds")
  )
  const origin = Str.concat("http://127.0.0.1:", yield* Schema.encodeEffect(Schema.FiniteFromString)(listening.port))
  const client = yield* HttpClient.HttpClient
  const request = (body: typeof RequestBody.Type) =>
    HttpClientRequest.schemaBodyJson(RequestBody)(HttpClientRequest.post(origin), body).pipe(
      Effect.flatMap(client.execute),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(Result))
    )
  const fs = yield* FileSystem.FileSystem
  const pid = yield* Schema.encodeEffect(Schema.FiniteFromString)(child.pid)
  const cpuTicks = fs.readFileString(path.join("/proc", pid, "stat")).pipe(
    // The command name is parenthesized and may itself contain spaces or ')'.
    Effect.flatMap((stat) =>
      Option.match(Arr.last(Str.split(stat, ")")), {
        onNone: () => Effect.fail(new WorkerUnavailable({ reason: "malformed process stat" })),
        onSome: (suffix) => Effect.succeed(Str.split(/\s+/)(Str.trim(suffix)))
      })
    ),
    Effect.flatMap((fields) =>
      Effect.forEach(Arr.make(Arr.get(fields, 11), Arr.get(fields, 12)), (field) => Effect.fromOption(field))
    ),
    Effect.flatMap(Effect.forEach((field) => Schema.decodeEffect(Schema.FiniteFromString)(field))),
    Effect.map(N.sumAll)
  )
  return { request, cpuTicks, binary }
})
