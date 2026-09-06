/**
 * The server tests' side of the host boundary: the one module in the server
 * tests that names a host object, just as `apps/theoria/app/web/platform/` is
 * the one module in shipped code that does. `HttpServerRequest.fromWeb` is
 * Effect's constructor for a server request, and it takes the web `Request`
 * the host would hand the Worker; this module builds that one object.
 */
import { HttpServerRequest } from "@effect/platform"

/** A server request for `url`, as the host would deliver it. */
export const serverRequest = (url: string, init: RequestInit): HttpServerRequest.HttpServerRequest =>
  HttpServerRequest.fromWeb(new Request(url, init))
