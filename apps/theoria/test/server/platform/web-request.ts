/**
 * The server tests' side of the host boundary: the one module in the server
 * tests that names a host object, just as `apps/theoria/app/web/platform/` is
 * the one module in shipped code that does. The Worker's `fetch` export and
 * Effect's `HttpServerRequest.fromWeb` both take the web `Request` the host
 * would hand the Worker; this module builds that one object.
 */
import { HttpServerRequest } from "@effect/platform"

/** The web request for `url`, as the host would deliver it. */
export const webRequest = (url: string, init: RequestInit): Request => new Request(url, init)

/** A server request for `url`, as the host would deliver it. */
export const serverRequest = (url: string, init: RequestInit): HttpServerRequest.HttpServerRequest =>
  HttpServerRequest.fromWeb(webRequest(url, init))
