import { HttpMiddleware, HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"

export const securityHeaders = HttpMiddleware.make((app) =>
  Effect.map(
    app,
    HttpServerResponse.setHeaders({
      "content-security-policy": [
        "default-src 'self'",
        "base-uri 'self'",
        "connect-src 'self'",
        "font-src 'self' https://fonts.gstatic.com",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "img-src 'self' data:",
        "object-src 'none'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "worker-src 'self'"
      ].join("; "),
      "cross-origin-opener-policy": "same-origin",
      "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
      "referrer-policy": "strict-origin-when-cross-origin",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY"
    })
  )
)
