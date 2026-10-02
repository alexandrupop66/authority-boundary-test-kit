# Authority Boundary Test Kit

A small, dependency-free Node.js toolkit for testing whether an agent executor keeps probabilistic evidence separate from authority. It runs 13 adversarial contract checks through a user-supplied adapter and emits a JSON report suitable for CI.

Created as an additional open-source contribution alongside **ActionProof**, an Alexa+ MCP care-line demonstration. This repository is independently implemented: it does not copy or import the private ActionProof runtime and does not modify its frozen Policy Gate or Execution Boundary.

## Quick start

Requires Node.js 24 or later. There are no dependencies and no credentials.

```sh
npm test
node src/cli.mjs examples/reference-adapter.mjs
node src/cli.mjs examples/vulnerable-adapter.mjs
```

The correct educational adapter should report **13 passed / 0 failed**, exit 0. The intentionally vulnerable adapter should fail forgery, serialization and replay checks, exit 1. `npm test` separately verifies the toolkit itself, including nine injected defects. A failing example is an expected demonstration, not a passing security result.

Library use:

```js
import { runBoundaryChecks } from './src/index.mjs';
import { createFixture } from './examples/reference-adapter.mjs';
const report = await runBoundaryChecks(createFixture);
console.log(report);
```

## What is checked

| Contract | Observable requirement |
| --- | --- |
| Valid authority | A valid capability executes once and produces one effect |
| High-confidence evidence | Confidence 1.0 plus permission-like claims cannot authorize without grants |
| Requirements | Changing evidence cannot change authority requirements |
| Untrusted issuer | A model or unregistered issuer cannot authorize |
| Forgery | A capability lookalike produces no effect |
| Serialization | A JSON round-trip cannot reproduce an authentic in-process capability |
| Replay | A second execution produces no additional effect |
| Revocation | Revocation before execution invalidates the capability |
| Grant expiry | A still-live capability cannot rely on an expired grant |
| Capability expiry | Capability TTL is enforced independently of grant expiry |
| Relevant state | Changing the governed target invalidates the capability |
| Irrelevant state | A cosmetic note does not invalidate authority |
| Policy version | Changing the policy version before execution prevents the effect |

## Adapter contract

Export `createFixture()` from a trusted local `.mjs` file, then pass its path to the CLI. The kit creates a **fresh isolated fixture for every check**, so each check starts with valid authority and zero effects. An optional async `close()` runs after each check, including failures.

The fixture exposes:

- `grants`: nonempty mutable array with at least one initially valid grant. Map `issuer`, `revoked` and `expiresAt` to the real system; changing these values must affect subsequent authorization/execution.
- `evidence`: mutable array. Changes must reach the real evidence path; entries use `confidence` and optional `claims`.
- `state`: mutable object with `target` (authority-relevant) and `displayNote` (irrelevant).
- `policy`: mutable object with numeric `version`.
- `capabilityTtl`: positive duration in milliseconds.
- `now()`: fixture clock in milliseconds; `advance(ms)` advances the same clock used by the executor.
- `requirements()`: returns a JSON-compatible value representing actual authority requirements.
- `authorize()`: returns a JSON-serializable capability object or **null** if denied.
- `execute(token)`: returns **true** only when the governed effect is released; otherwise **false**. Must tolerate null/lookalike/serialized tokens by denying, not throwing.
- `effects()`: returns the independently observed governed-effect count for this fixture.

Functions may be async except `now()` and `advance()`. Adapters may translate these fixture fields to database/provider operations, but must not implement the desired answers themselves. Count effects through the actual test sink, not through the authorization response. Use isolated test services only, never production effects.

The serialization check specifically targets **in-process opaque object capabilities**. Systems using cryptographically signed transferable tokens have different semantics and should not claim conformance to that check. It is deliberately reported rather than silently skipped.

## CI and result semantics

```sh
node src/cli.mjs path/to/my-adapter.mjs > boundary-report.json
```

Exit **0** means all checks passed; **1** means one or more contracts failed; **2** means invalid CLI arguments or an adapter import/export error. Fixture exceptions, malformed fixtures and cleanup errors are failures. The GitHub workflow has a five-minute timeout. Remote adapters should set their own request timeouts; the library does not kill hanging adapter calls.

Report schema: `schemaVersion`, `total`, `passed`, `failed`, and `results[]` containing `id`, `passed` and optional `failure.name` / `failure.message`. Error messages come from adapters: avoid putting secrets in them before retaining CI reports.

## Scope and limitations

This kit tests a declared adapter contract, not an arbitrary black-box system. A dishonest or incomplete adapter can manufacture results. Passing these checks is **not certification, proof of production safety, a cryptographic audit, or proof of exactly-once distributed effects**. No MCP transport, Amazon Inspector or live AWS integration is exercised by the kit. It can test executors used behind MCP tools through an adapter.

The educational reference uses an in-memory WeakMap brand, a fixture clock and a simulated effect counter. Grants are trusted fixture objects without cryptographic proof. It does not implement persistent revocation, durable idempotency, database transactions, crash recovery or multi-process concurrency. Known reference-monitor and capability-security ideas are applied, not claimed as newly invented.

## Contributing

Run `npm test` and both CLI examples before proposing changes. Every new contract should include a valid example and an injected defect showing the check can fail. Preserve deterministic fixtures and honest scope statements. Bug reports and PRs are welcome.

## Licence

MIT. Copyright 2026 Alexandru-Cristian Pop.
