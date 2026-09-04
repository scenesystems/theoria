/**
 * Theoria Cloudflare Worker entrypoint (see `wrangler.jsonc`).
 *
 * The Effect runtime is built once per isolate on the first request and
 * reused afterwards; `env` bindings are stable for the isolate's lifetime.
 */
import { MutableRef, Option, Schema } from "effect"

import { makeWorkerHandler, WorkerEnv, type WorkerHandler } from "./app/server/worker.js"

const cached = MutableRef.make(Option.none<WorkerHandler>())

const handlerFor = (env: unknown): WorkerHandler =>
  Option.getOrElse(MutableRef.get(cached), () => {
    const created = makeWorkerHandler(Schema.decodeUnknownSync(WorkerEnv)(env))
    MutableRef.set(cached, Option.some(created))
    return created
  })

export default {
  fetch: (request: Request, env: unknown): Promise<Response> => handlerFor(env).handler(request)
}
