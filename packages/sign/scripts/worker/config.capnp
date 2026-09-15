# Local verification only; no deployed service or Node compatibility flag.
using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "verification", worker = (
      modules = [(name = "worker.mjs", esModule = embed "worker.mjs")],
      compatibilityDate = "2026-08-31"
    ))
  ],
  sockets = [(name = "http", http = (), service = "verification")]
);
