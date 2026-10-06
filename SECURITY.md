# Security Policy

## Supported versions

Security fixes are released for the latest published version only.

## Reporting a vulnerability

Please use GitHub's **private security advisories** ("Report a vulnerability" on the
Security tab) rather than a public issue.

## Design guarantees that reduce attack surface

SlopHound is a static, offline scanner:

- **No network access.** The code contains no HTTP clients, sockets, or fetch calls.
  Your source code never leaves your machine.
- **No telemetry.** Nothing is collected, stored remotely, or phoned home.
- **No subprocesses.** The CLI performs no shell-outs and no dynamic code
  evaluation (`eval` / `new Function` are never used).
- **Zero runtime dependencies.** The entire dependency tree is the Node.js
  standard library, which eliminates supply-chain exposure through third-party
  packages.

If a release ever behaves otherwise, treat that release as compromised and
report it immediately.
