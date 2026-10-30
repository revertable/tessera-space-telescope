# 04 — Provider Architecture and Embedding Reliability

[All cases](../../README.md) · [한국어](04-provider-architecture-and-embedding-reliability.ko.md) · [Previous: 03](03-cohere-evaluation-and-retirement.md) · [Next: 05](05-cross-pc-index-portability.md)

**Evidence:** Code confirmed identifies historical source; reported at the time retains recorded observation conditions; unconfirmed marks unresolved facts or causal links. Tests are historical source evidence. Times are KST (UTC+09:00); development events and evidence-inspection dates retain their own labels.

**Document revision:** Split on 2026-10-30 from `2fc5094`. Historical publication checks below retain their dates and scope. On 2026-10-31, redundant explanations and verification-limit wording were revised from `f7fb082`; follow-up lists were then revised from `0228ffe` to describe the sources and verification scope of the available materials.

**Development period:** 2026-09-26 ~ 2026-10-17

**Code classification:** 37 Excerpts and two Reconstructed JSON records.

**Outcome:** role-specific Provider contracts, factories, and target selection supported changes among Gemini, Cohere, and Groq. Document embedding evolved from single-chunk requests to provider-owned batches, bounded current-batch retry, and Gemini request-start pacing, with validated index publication.

## The problem and the sequence of changes

After the direct Gemini integration in case 01, the implementation separated model operations from the code that prepares evidence, validates vectors and answers, and writes indexes. Later provider additions and quota failures exercised those boundaries. This case follows the architecture and recovery controls; case 03 records the provider quality evaluations and the retirement decision.

| Development time KST / commit | Change or observation |
|---|---|
| September 26, 23:10:00 · `fc509b0` | Separated Embedding/Generation contracts, factories, Gemini adapters, and common callers. |
| September 28, 14:50:04 · `5f71fbe` | Added query/document embedding contracts and a Cohere embedding fallback with its own target/index space. |
| September 28, 23:59:41 · `dadffe3` | Added provider-owned batching and ordered vector validation. |
| September 29, 00:32:59 · `19e634d` | Preserved normalized failure and batch diagnostics after a build lost useful error details. |
| September 29, 09:35:29 / 10:08:01 · `c7610ed` / `de197a5` | Separated build targets, runtime order, and credential bindings. |
| September 29, 10:37:00 · `5615b4c` | Added bounded retry of the current fallbackable HTTP 429 document batch. |
| September 30, 18:15:43 · `b00bf59` | Added generation registry/options, independent runtime selection, and explicit shared-evidence evaluation. |
| September 30, 22:22:54 · `4125443`; October 3, 07:42:12 · `0baebd9` | Removed the initial Groq model path, then introduced GPT-OSS as generation fallback. |
| October 16, 20:22–20:41 reports; 21:32:34 commit · `e700717` | Investigated batch 9/quota observations, introduced 22-second pacing, and made build/retry logging provider-neutral. Cohere integration was removed in the same commit. |
| October 17, 22:17:33.825 artifact; 22:19:07.357 report; 22:20:44 commit · `033e02f` | Produced a complete Gemini artifact, recorded CURRENT status, and committed the index handover. |

## Separating contracts, factories, adapters, and common behavior

The September 26 [Embedding contract](../../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider.ts#L1-L21) accepts provider/model/dimensions and returns a vector. The [Generation contract](../../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider.ts#L1-L40) accepts contents, system instruction, response schema, and output limit, returning content or a categorized failure.

The initial [embedding factory](../../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider-factory.ts#L1-L14) and [generation factory](../../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider-factory.ts#L1-L14) instantiate Gemini adapters. The same commit changed index/retrieval/answer imports to common embedding and generation modules.

| Responsibility | Implementation boundary |
|---|---|
| Target definitions and runtime order | Configuration parsing and validated target IDs. |
| Credential selection and adapter construction | Binding helpers and role-specific factories. |
| Provider request/response translation | Gemini, Cohere, and Groq adapters. |
| Document splitting, vector validation, bounded retry, progress logs | Common embedding orchestration; provider batching capabilities and the Gemini pacing condition supply specific policy. |
| Prompt/evidence construction and answer validation | Common generation orchestration. |
| Index compatibility and publication | Embedding-space identity, candidate validation, and index storage. |

The September 28 [expanded embedding factory](../../cases/embedding-batching-retry-pacing/architecture/embedding-provider-factory.ts#L1-L26) selects Gemini or Cohere from a target, requires that target’s bound credential, and caches adapter instances by target ID. The [evolved request contract](../../cases/embedding-batching-retry-pacing/batching/provider-contract.excerpt.ts#L1-L33) distinguishes question input from title/content document input and exposes an optional batching capability.

Existing targets can be selected through configuration. Introducing a new provider requires a contract implementation, factory registration, supported-option validation, and tests. The actual additions and removals below followed those code boundaries.

## From single-document requests to provider-owned batches

The [pre-batching loop](../../cases/embedding-batching-retry-pacing/before/embeddings.ts#L31-L49) sends one chunk per `embedDocuments()` call and validates its vector. The earlier Gemini build was reported to have completed 50 chunk embeddings before daily-quota HTTP 429. With the larger imported corpus, the next change bounded request payloads and failure units through batches.

The [batching implementation](../../cases/embedding-batching-retry-pacing/batching/embeddings.ts#L31-L70) uses the provider’s preferred batch size, defaults to one when the capability is absent, and validates positive integer limits. The Gemini adapter declares a project preference of 32 documents. Cohere’s [published adapter](../../cases/cohere-lifecycle/embedding/batched/embedding.ts#L9-L51) declares preferred/maximum 96. The common loop slices full and partial batches, validates vector count/dimensions/finite values, and appends vectors in input order.

The [batching tests](../../cases/embedding-batching-retry-pacing/batching/embeddings.test.ts#L1-L98) cover ordered full/partial batches, empty input, wrong vector counts/dimensions, middle-batch failure, and the query path. Partial vectors stay within the active call until all batches succeed.

## Diagnosing failure before choosing recovery

The `19e634d` development report describes one build in which three 32-document Gemini requests succeeded and the fourth failed after its useful HTTP/provider details were discarded. That failure’s exact classification remains unconfirmed. In the same recorded run, Cohere completed six requests and produced a then-current artifact. Target-level failure isolation preserved the successful result.

The [Gemini failure normalization](../../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.ts#L33-L133) parses typed RetryInfo and QuotaFailure details, preserves HTTP status and allowlisted provider/quota identifiers, and projects a retry delay. An unannotated HTTP 429/RESOURCE_EXHAUSTED stays neutral while remaining fallbackable. The [adapter tests](../../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.test.ts#L1-L173) cover those shapes, safe identifiers, and ordered multi-input translation.

The later [common failure helpers](../../cases/embedding-batching-retry-pacing/diagnostics/failure.ts#L1-L133) carry validated Retry-After delay and batch number/offset/size into a serializable diagnostic report. Their [tests](../../cases/embedding-batching-retry-pacing/diagnostics/failure.test.ts#L1-L79) distinguish failure categories, timeout/cancellation, and safe delay forms. Raw causes remain internal to error propagation.

## Separating build targets, runtime order, and credentials

The September 29 changes first separated the build target registry from `runtimeTargetIds`, then bound credentials independently of runtime priority. The [selection functions](../../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.ts#L10-L88) validate target identity, bind numbered environment targets to credential slots, and resolve runtime IDs.

The [credential helpers](../../cases/embedding-batching-retry-pacing/architecture/credentials.ts#L1-L29) load and require a named slot. The [selection tests](../../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.test.ts#L32-L131) verify reordered runtime targets, fixed credential bindings, a synthetic third target, and rejected duplicate/incomplete bindings.

This snapshot required complete consecutive numbered bindings.

By September 30, the shared [numbered binding helper](../../cases/embedding-batching-retry-pacing/architecture/generation/credentials.ts#L31-L65) supported embedding and generation, including sparse numbered slots.

The [generation parser](../../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.ts#L36-L69) validates unique registry IDs, provider options, binding slots, and a runtime order referencing known targets.

Its [tests](../../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.test.ts#L46-L73) preserve registry/slot/runtime independence, multiple option profiles for a model, and optional evaluation credentials. These are successive versions of the binding design.

The [Reconstructed configuration history](../../cases/embedding-batching-retry-pacing/architecture/config-selection-history.json#L1-L176) selects the generation/embedding sections at four commits, from the initial Gemini fields to a multi-target registry. Later committed runtime choices are also available in case 03’s [configuration history](../../cases/cohere-lifecycle/configuration/target-history.json#L1-L227). Credential values remain local.

## Retrying the current document batch

A separate September 29 report describes a 525-chunk build: five Cohere batches succeeded, then batch 6/6 returned HTTP 429; another configured target failed at its first batch. Neither incomplete target was published. `5615b4c` introduced bounded retry in the common document orchestration.

The [retry loop and delay decision](../../cases/embedding-batching-retry-pacing/retry/embeddings.ts#L69-L98) accept an `EmbeddingProviderError` marked fallbackable with HTTP 429, for up to three retries after the initial attempt. A safe explicit delay from 0 through 60000 ms takes priority. When absent, delays are 15000/30000/60000 ms; an unsafe explicit delay stops retry. Other statuses and validation failures end that operation. Earlier successful batches remain in memory while the current batch is retried.

The [selected retry tests](../../cases/embedding-batching-retry-pacing/retry/embeddings.excerpt.test.ts#L37-L150) verify current-batch-only recovery, delay precedence, the four-attempt bound, final batch diagnostics, non-429/unsafe-delay rejection, and immediate query failure. The historical report describes mocked timers and HTTP responses for this policy; live retry verification was pending at that checkpoint.

## Applying the same architecture to generation replacement

The September 30 [Generation target/request contract](../../cases/embedding-batching-retry-pacing/architecture/generation/provider.ts#L1-L72) adds target IDs, credential slots, target-specific options, native usage metadata, and explicit execution diagnostics.

The [three-provider factory](../../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.ts#L1-L36) registers Gemini, Cohere, and Groq and caches by target ID. The [factory tests](../../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.test.ts#L1-L30) verify bound generation slots and stable instances across runtime-order changes.

The [common generation orchestrator](../../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.ts#L1-L170) chooses configured runtime IDs or one explicit evaluation target, builds shared evidence/prompt input, calls the factory-produced adapter, and validates response shape and citations. Its September 30 runtime fallback condition was confirmed quota exhaustion.

The [selected tests](../../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.excerpt.test.ts#L27-L105) exercise runtime/evaluation selection and preservation of grounding validation. The later provider-failure policy evolved separately; each published snapshot keeps its original conditions.

Cohere’s [published generation adapter](../../cases/cohere-lifecycle/generation/generation.ts#L6-L26) translates the shared request to its chat API. Groq’s initial model path was removed in `4125443`; `0baebd9` later added GPT-OSS as fallback and kept Cohere for evaluation.

The [GPT-OSS adapter](../../cases/embedding-batching-retry-pacing/architecture/groq/generation.ts#L1-L28) maps the same contract to strict JSON Schema, a completion limit, and reasoning effort.

The [option validator](../../cases/embedding-batching-retry-pacing/architecture/generation/target-options.ts#L1-L29) and [selected adapter tests](../../cases/embedding-batching-retry-pacing/architecture/groq/generation.excerpt.test.ts#L21-L51) establish the request/response translation. This replacement changed generation configuration and adapters while leaving embedding/index implementation unchanged in that commit.

Cohere removal in `e700717` deleted its adapters/tests, factory registrations, options, configuration, and evaluation choices. The retained [embedding factory](../../cases/cohere-lifecycle/after-removal/embedding-provider-factory.ts#L12-L24) and [generation factory](../../cases/cohere-lifecycle/after-removal/generation-provider-factory.ts#L17-L33) show Gemini embedding and Gemini/Groq generation after removal. Common contracts and orchestration continued to carry the remaining providers.

## October 16: from reactive retry to request-start pacing

At 20:22:30.299, a developer report recorded Gemini HTTP 429/RESOURCE_EXHAUSTED at batch 9, document offset 256, size 32, with about 59 seconds of provider retry delay. The retained investigation distinguished the code’s maximum four attempts from the unavailable per-attempt ledger. At 20:27:38.961, the developer supplied AI Studio observations: RPM 160/100, TPM 35.21K/30K, and RPD 256/1K.

| Design calculation | Recorded basis and scope |
|---|---|
| Document-unit interpretation | 160=32×5 and 256=32×8 supported a document-unit accounting hypothesis. |
| RPM average | 60×32/100=19.2 seconds per batch. |
| Boundary concentration | Starts at 0/20/40/60 seconds can place four batches on a 60-second boundary; an interval above 20 seconds was considered. |
| TPM estimate | Assuming the 35.21K peak represented the same five-batch interval: 60×(35.21K/5)/30K≈14.1 seconds per batch. |
| Selected policy | Minimum 22 seconds between Gemini document-request starts, including retry attempts. |

The archived session containing these user observations and design calculations was directly read on the home PC; its original hash matched the register. Exact quota accounting, alignment of RPM/TPM peaks, batch 9 attempt count, and actual provider waits remain unconfirmed. The [recovered-source register](../evidence/recovered-source-register.json) separates observation, design, and implementation-report times and sources.

## One build-local gate, common retry logging

The [final document loop](../../cases/embedding-batching-retry-pacing/pacing/embeddings.ts#L37-L94) stores one `lastRequestStartedAt` per build call. Before each Gemini document attempt it waits only for the remaining interval, using `performance.now()`. The [retry loop](../../cases/embedding-batching-retry-pacing/pacing/embeddings.ts#L96-L140) invokes the same gate before initial attempts and retries. Response and backoff time count toward the interval; state is shared across batches within that build invocation.

The initial proposal placed progress logging under Gemini-specific behavior. At 20:41:35.648 the developer requested provider-neutral build/retry logging while retaining Gemini-specific pacing. The final code derives the log prefix from `target.provider` and reports attempt starts, validated completion, HTTP/kind failure, pacing/retry waits, and exhaustion. Vector validation failures are reported as failed completion.

| Historical fake-timer contract | Expected provider-call start times / result |
|---|---|
| 373 chunks, batch 32 | Twelve batches at 0,22,…,242 seconds; final batch 21. |
| Response duration 5 seconds /25 seconds | Next request at 22 seconds /25 seconds. |
| Retry delay absent /2.5 seconds /59 seconds | Retry at 22 seconds /22 seconds /59 seconds, then next batch 22 seconds later. |
| Repeated 429 with fallback delays | Starts at 0,22000,52000,112000 ms; four attempts total. |
| Fixture-provider | Immediate document batches; common logs still apply. |
| Query embedding | Immediate query path with document retry/pacing/logging outside that path. |

The [logging tests](../../cases/embedding-batching-retry-pacing/pacing/embeddings.excerpt.test.ts#L45-L113) cover Gemini and synthetic future providers, retry exhaustion, invalid vectors, and query logging boundaries. The [pacing tests](../../cases/embedding-batching-retry-pacing/pacing/embeddings.excerpt.test.ts#L115-L248) encode the start-time expectations above.

The 20:31:07.589 implementation checkpoint reported 43 related tests and static checks passing, with live build still pending; the later completion report recorded 939 passing tests and four existing skips plus successful check/build.

## Index compatibility and failure-safe publication

The [embedding-space identity](../../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.ts#L15-L44) includes provider, model, dimensions, and embedding input version. The target index fingerprint also includes corpus identity.

The [identity tests](../../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.test.ts#L11-L79) show generation changes leaving the index identity intact, runtime IDs/credentials/priorities remaining independent, and provider/model/dimension/input/corpus changes affecting compatibility. This lets runtime selection and provider replacement use an explicit artifact contract.

The [index builder](../../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.ts#L23-L87) waits for the complete vector set, checks count, assembles source/vector pairs, writes and reads the artifact, then prunes stale artifacts in that space. It records each target’s result so later targets can proceed after a failure.

The [storage excerpt](../../cases/embedding-batching-retry-pacing/publication/store.excerpt.ts#L16-L94) validates schema, identity, vectors, and source URLs; writes a temporary candidate; validates it; and renames it to the destination, cleaning failed candidates.

The [builder tests](../../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.test.ts#L44-L120) and [storage tests](../../cases/embedding-batching-retry-pacing/publication/store.excerpt.test.ts#L75-L116) preserve successful targets and older artifacts across failed candidate/write/publication validation. Current-artifact validation precedes stale cleanup. Batch retry retains earlier vectors during that active call; the historical build had no persistent batch checkpoint/resume, so a terminated build’s incomplete work was discarded.

## Completing the rebuilt artifact

The developer separated code and index commits on October 16. A user report at October 17 22:19:07.357 recorded rebuild success and CURRENT status. `033e02f` at 22:20:44 added the new Gemini artifact and removed the older Gemini/Cohere artifacts. The [Reconstructed artifact summary](../../cases/embedding-batching-retry-pacing/evidence/published-index-summary.json#L1-L21) selects metadata and structural checks from that committed JSON.

| Directly inspected artifact property | Value |
|---|---|
| Created at | 2026-10-17T13:17:33.825Z /22:17:33.825 KST |
| Schema / input version | 4 /2 |
| Embedding provider/model | gemini /gemini-embedding-2 |
| Chunk count / dimension | 373 /768 |
| Document-hash entries | 28 |
| Vector structure | All 373 vectors have 768 finite numeric elements. |
| Fingerprint | `30886679a306cf2ee9a3cd10532e6a7cfb5549f85baf3f595f672c9273e4b150` |

This artifact confirms the completed stored vector structure. The per-attempt wire ledger, actual pacing waits, quota deductions, and production query behavior remain unverified in the available records. Generation 3-way results, classifier quality, and the Cohere cost decision are recorded in case 03 under their own conditions.

## Verification levels and source selection

Code and commit differences, published test assertions, historical tracked development reports, and the final committed index were directly inspected. October 16/17 user observations and implementation checkpoints were directly read in the recovered archived session. Original failed/completed build ledgers remain unavailable. Arithmetic retains its historical assumptions; next-day completion is attributed to the developer’s successful-rebuild/CURRENT report.

The core embedding orchestration, Gemini adapter, and common embedding failure implementation are described using the `e700717` snapshot identified in the source ledger below. This publication reads retained records and source objects; it executes no model request, index build, or historical application test.

## Source traceability and publication form

In the source paths below, `server/` abbreviates `sveltekit/src/lib/server/`.

Twenty-two whole-file Excerpts retain original bytes. Fifteen partial Excerpts retain the selected original declarations and test statements, joined with blank lines; suite wrappers and unrelated sections are omitted. Imports, names, synthetic fixtures, and references to unpublished modules remain as originally written. The generation orchestrator is included whole to preserve target dispatch through final response validation.

The two Reconstructed JSON records use editorial envelopes: one selects historical generation/embedding configuration fields; the other selects committed artifact metadata and calculates chunk/document-hash counts and vector-structure booleans. Full private records, vectors, credential values, local user paths, and raw runtime/session transcripts are excluded.

### Source commits

| Original commit | Commit time KST | Change |
|---|---|---|
| `fc509b07cbc33035ae12bd6b837d93b3045d216b` | 2026-09-26 23:10:00 | Refactor AI capabilities behind provider boundaries |
| `5f71fbece8a7d7caa28d01d655d8b02d614472cf` | 2026-09-28 14:50:04 | feat: localize knowledge retrieval with embedding fallback |
| `9e96d4f87e90b505e9dfb72f842a9dc4c8560a9e` | 2026-09-28 20:14:41 | refactor(indexing): decouple index identity from runtime targets |
| `dadffe361c617c9db9840696b615b7cc3a0e8fcd` | 2026-09-28 23:59:41 | feat(embedding): batch document embeddings |
| `19e634d80cd7025a572461e639bd2db01038272a` | 2026-09-29 00:32:59 | Improve embedding failure diagnostics |
| `c7610edd7223be7fe77cd7ae9722c58c27e81690` | 2026-09-29 09:35:29 | feat(embedding): add Voyage and separate runtime priority |
| `de197a5c0c245f64034c94542e96b09f3361dd63` | 2026-09-29 10:08:01 | refactor(embedding): decouple credential bindings from runtime priority |
| `5615b4ca89e24204a3bf25ea4ab2eaa333872c73` | 2026-09-29 10:37:00 | feat(embedding): retry rate-limited document batches |
| `cb0055eb71203e3e77249a9abfcc002c4e4a963f` | 2026-09-29 11:04:53 | feat(embedding): activate Gemini and publish Cohere index |
| `b00bf595439bd71540ace4e34d6f56a803eb5719` | 2026-09-30 18:15:43 | feat(generation): add target registry and shared-evidence evaluation |
| `4125443b5de06bea988b9776a4e85d8a5d608a1b` | 2026-09-30 22:22:54 | refactor(generation): remove Groq and set output limits to 32768 |
| `0baebd9f242d88ffa15ef1953204c391ae97e623` | 2026-10-03 07:42:12 | feat(generation): replace Cohere fallback with Groq GPT-OSS |
| `5b78e06e889eb888aa8a92ccb6f9e0a05c0004e3` | 2026-10-06 20:42:47 | feat(answering): add intent-driven retrieval and provider fallback |
| `e7007172cc7a5171948659c4f1ceb6fd65dd1332` | 2026-10-16 21:32:34 | refactor: remove Cohere support and add document build pacing and logs |
| `033e02fabe868a14cd8a4a932b50fbdba9a064fa` | 2026-10-17 22:20:44 | chore(index): refresh Gemini artifact and remove retired indexes |

### Code correspondence

Original paths are relative to the private repository. Inclusive ranges read `original → public`. Inputs to the configuration and index summaries are recorded in the next table.

| Public file | Original commit · path | Classification · ranges |
|---|---|---|
| [before/embeddings.ts](../../cases/embedding-batching-retry-pacing/before/embeddings.ts#L1-L49) | `5f71fbe` · `server/embedding/embeddings.ts` | Excerpt (whole) · 1–49 → 1–49 |
| [batching/embeddings.ts](../../cases/embedding-batching-retry-pacing/batching/embeddings.ts#L1-L70) | `dadffe3` · `server/embedding/embeddings.ts` | Excerpt (whole) · 1–70 → 1–70 |
| [batching/embeddings.test.ts](../../cases/embedding-batching-retry-pacing/batching/embeddings.test.ts#L1-L98) | `dadffe3` · `server/embedding/embeddings.test.ts` | Excerpt (whole) · 1–98 → 1–98 |
| [batching/provider-contract.excerpt.ts](../../cases/embedding-batching-retry-pacing/batching/provider-contract.excerpt.ts#L1-L33) | `dadffe3` · `server/embedding/provider.ts` | Excerpt · 1–7 → 1–7; 9–12 → 9–12; 14–17 → 14–17; 19–22 → 19–22; 24–27 → 24–27; 29–33 → 29–33 |
| [diagnostics/gemini-embedding.ts](../../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.ts#L1-L174) | `19e634d` · `server/providers/gemini/embedding.ts` | Excerpt (whole) · 1–174 → 1–174 |
| [diagnostics/gemini-embedding.test.ts](../../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.test.ts#L1-L173) | `19e634d` · `server/providers/gemini/embedding.test.ts` | Excerpt (whole) · 1–173 → 1–173 |
| [diagnostics/failure.ts](../../cases/embedding-batching-retry-pacing/diagnostics/failure.ts#L1-L133) | `e700717` · `server/embedding/failure.ts` | Excerpt (whole) · 1–133 → 1–133 |
| [diagnostics/failure.test.ts](../../cases/embedding-batching-retry-pacing/diagnostics/failure.test.ts#L1-L79) | `e700717` · `server/embedding/failure.test.ts` | Excerpt (whole) · 1–79 → 1–79 |
| [retry/embeddings.ts](../../cases/embedding-batching-retry-pacing/retry/embeddings.ts#L1-L116) | `5615b4c` · `server/embedding/embeddings.ts` | Excerpt (whole) · 1–116 → 1–116 |
| [retry/embeddings.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/retry/embeddings.excerpt.test.ts#L1-L150) | `5615b4c` · `server/embedding/embeddings.test.ts` | Excerpt · 1–10 → 1–10; 12–14 → 12–14; 16–25 → 16–25; 27–35 → 27–35; 130–172 → 37–79; 174–194 → 81–101; 196–217 → 103–124; 219–232 → 126–139; 245–254 → 141–150 |
| [pacing/embeddings.ts](../../cases/embedding-batching-retry-pacing/pacing/embeddings.ts#L1-L158) | `e700717` · `server/embedding/embeddings.ts` | Excerpt (whole) · 1–158 → 1–158 |
| [pacing/embeddings.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/pacing/embeddings.excerpt.test.ts#L1-L248) | `e700717` · `server/embedding/embeddings.test.ts` | Excerpt · 1–11 → 1–11; 13–15 → 13–15; 17–26 → 17–26; 28–36 → 28–36; 38–39 → 38–39; 41–43 → 41–43; 46–72 → 45–71; 74–95 → 73–94; 111–118 → 96–103; 120–128 → 105–113; 352–384 → 115–147; 386–409 → 149–172; 411–441 → 174–204; 443–464 → 206–227; 466–485 → 229–248 |
| [publication/indexer.excerpt.ts](../../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.ts#L1-L87) | `e700717` · `server/indexing/indexer.ts` | Excerpt · 1–21 → 1–21; 76–111 → 23–58; 113–118 → 60–65; 120–140 → 67–87 |
| [publication/indexer.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.test.ts#L1-L120) | `e700717` · `server/indexing/indexer.test.ts` | Excerpt · 1–7 → 1–7; 9–23 → 9–23; 25–30 → 25–30; 32–42 → 32–42; 68–92 → 44–68; 126–134 → 70–78; 136–143 → 80–87; 145–153 → 89–97; 155–165 → 99–109; 167–176 → 111–120 |
| [publication/store.excerpt.ts](../../cases/embedding-batching-retry-pacing/publication/store.excerpt.ts#L1-L94) | `e700717` · `server/indexing/store.ts` | Excerpt · 1–14 → 1–14; 56–97 → 16–57; 99–101 → 59–61; 103–105 → 63–65; 107–121 → 67–81; 123–134 → 83–94 |
| [publication/store.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/publication/store.excerpt.test.ts#L1-L116) | `e700717` · `server/indexing/store.test.ts` | Excerpt · 1–20 → 1–20; 22–28 → 22–28; 30–41 → 30–41; 43–44 → 43–44; 46–62 → 46–62; 64–69 → 64–69; 71–73 → 71–73; 99–105 → 75–81; 216–230 → 83–97; 232–249 → 99–116 |
| [architecture/initial/embedding/provider.ts](../../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider.ts#L1-L21) | `fc509b0` · `server/embedding/provider.ts` | Excerpt (whole) · 1–21 → 1–21 |
| [architecture/initial/embedding/provider-factory.ts](../../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider-factory.ts#L1-L14) | `fc509b0` · `server/embedding/provider-factory.ts` | Excerpt (whole) · 1–14 → 1–14 |
| [architecture/initial/generation/provider.ts](../../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider.ts#L1-L40) | `fc509b0` · `server/generation/provider.ts` | Excerpt (whole) · 1–40 → 1–40 |
| [architecture/initial/generation/provider-factory.ts](../../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider-factory.ts#L1-L14) | `fc509b0` · `server/generation/provider-factory.ts` | Excerpt (whole) · 1–14 → 1–14 |
| [architecture/embedding-provider-factory.ts](../../cases/embedding-batching-retry-pacing/architecture/embedding-provider-factory.ts#L1-L26) | `5f71fbe` · `server/embedding/provider-factory.ts` | Excerpt (whole) · 1–26 → 1–26 |
| [architecture/credentials.ts](../../cases/embedding-batching-retry-pacing/architecture/credentials.ts#L1-L29) | `de197a5` · `server/credentials.ts` | Excerpt (whole) · 1–29 → 1–29 |
| [architecture/embedding-selection.excerpt.ts](../../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.ts#L1-L106) | `de197a5` · `server/config.ts` | Excerpt · 1–6 → 1–6; 8–8 → 8–8; 27–55 → 10–38; 57–89 → 40–72; 91–105 → 74–88; 119–122 → 90–93; 124–129 → 95–100; 131–135 → 102–106 |
| [architecture/embedding-selection.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.test.ts#L1-L131) | `de197a5` · `server/config.test.ts` | Excerpt · 1–9 → 1–9; 11–14 → 11–14; 16–30 → 16–30; 47–62 → 32–47; 64–77 → 49–62; 79–99 → 64–84; 101–116 → 86–101; 118–123 → 103–108; 125–146 → 110–131 |
| [architecture/generation/provider.ts](../../cases/embedding-batching-retry-pacing/architecture/generation/provider.ts#L1-L72) | `b00bf59` · `server/generation/provider.ts` | Excerpt (whole) · 1–72 → 1–72 |
| [architecture/generation/provider-factory.ts](../../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.ts#L1-L36) | `b00bf59` · `server/generation/provider-factory.ts` | Excerpt (whole) · 1–36 → 1–36 |
| [architecture/generation/provider-factory.test.ts](../../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.test.ts#L1-L30) | `b00bf59` · `server/generation/provider-factory.test.ts` | Excerpt (whole) · 1–30 → 1–30 |
| [architecture/generation/credentials.ts](../../cases/embedding-batching-retry-pacing/architecture/generation/credentials.ts#L1-L65) | `b00bf59` · `server/credentials.ts` | Excerpt (whole) · 1–65 → 1–65 |
| [architecture/generation-selection.excerpt.ts](../../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.ts#L1-L69) | `b00bf59` · `server/config.ts` | Excerpt · 1–7 → 1–7; 9–16 → 9–16; 98–101 → 18–21; 103–108 → 23–28; 110–114 → 30–34; 116–149 → 36–69 |
| [architecture/generation-selection.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.test.ts#L1-L73) | `b00bf59` · `server/config.test.ts` | Excerpt · 1–10 → 1–10; 12–17 → 12–17; 19–33 → 19–33; 53–58 → 35–40; 61–63 → 42–44; 82–98 → 46–62; 112–121 → 64–73 |
| [architecture/generation/orchestrator.ts](../../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.ts#L1-L170) | `b00bf59` · `server/generation/orchestrator.ts` | Excerpt (whole) · 1–170 → 1–170 |
| [architecture/generation/orchestrator.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.excerpt.test.ts#L1-L105) | `b00bf59` · `server/generation/orchestrator.test.ts` | Excerpt · 1–7 → 1–7; 9–13 → 9–13; 15–18 → 15–18; 20–22 → 20–22; 24–25 → 24–25; 28–38 → 27–37; 40–46 → 39–45; 48–78 → 47–77; 80–97 → 79–96; 120–127 → 98–105 |
| [architecture/generation/target-options.ts](../../cases/embedding-batching-retry-pacing/architecture/generation/target-options.ts#L1-L29) | `0baebd9` · `server/generation/target-options.ts` | Excerpt (whole) · 1–29 → 1–29 |
| [architecture/groq/generation.ts](../../cases/embedding-batching-retry-pacing/architecture/groq/generation.ts#L1-L28) | `0baebd9` · `server/providers/groq/generation.ts` | Excerpt (whole) · 1–28 → 1–28 |
| [architecture/groq/generation.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/architecture/groq/generation.excerpt.test.ts#L1-L51) | `0baebd9` · `server/providers/groq/generation.test.ts` | Excerpt · 1–9 → 1–9; 11–19 → 11–19; 22–39 → 21–38; 54–65 → 40–51 |
| [architecture/embedding-space.excerpt.ts](../../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.ts#L1-L44) | `9e96d4f` · `server/indexing/corpus.ts` | Excerpt · 1–6 → 1–6; 8–9 → 8–9; 11–13 → 11–13; 21–26 → 15–20; 28–38 → 22–32; 40–50 → 34–44 |
| [architecture/embedding-space.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.test.ts#L1-L79) | `9e96d4f` · `server/indexing/corpus.test.ts` | Excerpt · 1–9 → 1–9; 173–184 → 11–22; 186–201 → 24–39; 203–217 → 41–55; 219–225 → 57–63; 227–233 → 65–71; 235–241 → 73–79 |
| [architecture/config-selection-history.json](../../cases/embedding-batching-retry-pacing/architecture/config-selection-history.json#L1-L176) | Selected/calculated inputs listed below | Reconstructed · Editorial envelope |
| [evidence/published-index-summary.json](../../cases/embedding-batching-retry-pacing/evidence/published-index-summary.json#L1-L21) | Selected/calculated inputs listed below | Reconstructed · Editorial envelope |

### Reconstruction rules and inputs

- `architecture/config-selection-history.json`: copies the entire generation and embedding objects from each commit’s `config/mosaic.example.json`, adding stage, sourceCommit, and classification. Stage order is initial-contracts → independent-build-and-runtime → credential-binding-separated → generation-registry.
- `evidence/published-index-summary.json`: selects schemaVersion, createdAt, fingerprint, corpusFingerprint, embeddingProvider, embeddingModel, embeddingInputVersion, and vectorDimension. It counts chunks and documentHashes entries and checks all vector lengths and numeric/finite elements. Source commit, source SHA-256, and classification are traceability fields.

| Public reconstruction · input | Original commit | Source SHA-256 |
|---|---|---|
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `fc509b07cbc33035ae12bd6b837d93b3045d216b` | `b1321cdcb932d14b391b8303f72ce1ba9046228f479cf944f887e9d59e5ea6df` |
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `c7610edd7223be7fe77cd7ae9722c58c27e81690` | `4f62fc99f58b0dcfaec117b9ca5243bba6fb22297007d065c643258d87cdb5bd` |
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `de197a5c0c245f64034c94542e96b09f3361dd63` | `dbd3763070c18ba8dded16693266660d72b6d3e59d54a5199fe7d9a3d7af83d3` |
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `b00bf595439bd71540ace4e34d6f56a803eb5719` | `19976e438024e926ccdf1453c7d4145d9bdf1f52677b0fad4a1aa798f4061488` |
| `evidence/published-index-summary.json` · `indexes/provider=gemini/model=gemini-embedding-2/dimensions=768/input=v2/30886679a306cf2ee9a3cd10532e6a7cfb5549f85baf3f595f672c9273e4b150.json` | `033e02fabe868a14cd8a4a932b50fbdba9a064fa` | `a0d705c70fbba84886ddae0a64c3811f69bdca4927290ae6282f69eb4c3640f6` |

### Development reports and research records

These hashes were computed from entire source bytes for this publication. The baseline HEAD for retained research records is `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218`.

| Original path | Snapshot commit | Source SHA-256 |
|---|---|---|
| `docs/development-status.md` | `fc509b07cbc33035ae12bd6b837d93b3045d216b` | `bf86fc39c7c6fd9b67605c80271bedbd969db7d5529d211b8874277aeaad5200` |
| `docs/development-status.md` | `5f71fbece8a7d7caa28d01d655d8b02d614472cf` | `cd391e419000613362ac2c09cc48db13304dee65cfecad3cdd50b0bfc03423d5` |
| `docs/development-status.md` | `19e634d80cd7025a572461e639bd2db01038272a` | `58d31efbf3bca688989431906a88700de41f63156d30e202704bcb231db7080c` |
| `docs/development-status.md` | `5615b4ca89e24204a3bf25ea4ab2eaa333872c73` | `8b7ab55609094b52027b08b431d286741dfc8e4ae74cacde851b24ca088bacdd` |
| `docs/development-status.md` | `e7007172cc7a5171948659c4f1ceb6fd65dd1332` | `b557e0b331e1e7a6b3eec2d16e220ccaf2a2dadb28b4891eb3920ed7aa724cf5` |
| `docs/research/synethos-development-history.md` | `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218` | `31c98a7c6b2fe222ca9b116130a857c316008b8cb79550425aba50e491ebd2a3` |
| `docs/research/synethos-evidence-register.md` | `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218` | `6f173ba83687e68daaa115623404e159af8efa37fc454c0e42559e761303bdf7` |
| `docs/research/decision-candidates.md` | `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218` | `6a1a2b0c4ab1dc25ee94a253f96c987d9d6d8ec6cf80d2f075b2be77fa1b06cc` |

The archived session is `rollout-2026-10-16T20-10-29-01a14468-00a5-7ff2-8053-0e588b0c1335.jsonl.zst`. Its home-PC original SHA-256, `9a167a56794bb628bd58e92581435b4efcacab3568d01e83d9dbf36ad79f9b99`, matched the existing register. The messages below were directly checked against the original; the [recovered-source register](../evidence/recovered-source-register.json) adds per-message text hashes.

| UTC message time | KST | Record |
|---|---|---|
| 2026-10-16T11:22:30.299Z | 20:22:30.299 | Developer batch9 failure report and no-rerun request |
| 2026-10-16T11:25:31.863Z | 20:25:31.863 | Investigation: actual attempts/waits unconfirmed |
| 2026-10-16T11:27:38.961Z | 20:27:38.961 | Developer quota-screen observations |
| 2026-10-16T11:28:39.623Z | 20:28:39.623 | 22-second design calculation and assumptions |
| 2026-10-16T11:31:07.589Z | 20:31:07.589 | Implementation report: 43 tests/check; live build pending |
| 2026-10-16T11:41:35.648Z | 20:41:35.648 | Developer: common logging, provider-specific pacing |
| 2026-10-16T12:19:53.762Z | 21:19:53.762 | Completion report: 939 tests/4 existing skips/check/build; stale index |
| 2026-10-16T12:29:36.316Z | 21:29:36.316 | Developer: commit code first, excluding indexes |
| 2026-10-17T13:19:07.357Z | 22:19:07.357 | Developer: rebuild success and CURRENT, request separate index commit |

The artifact’s createdAt is separate stored metadata. Request/report and commit times remain distinct; original failed/completed build attempt ledgers are unavailable. Application build logs from other dates were excluded from this execution’s evidence.

<details>
<summary>Original and public file SHA-256</summary>

Original hashes cover entire source files; public hashes cover Tessera files. Reconstruction input hashes are listed above.

| Public file | Entire original file SHA-256 | Public file SHA-256 |
|---|---|---|
| `before/embeddings.ts` | `b18a61d6a09dca484e4a247d3899956796e2a65f492596c374a287679352bfc2` | `b18a61d6a09dca484e4a247d3899956796e2a65f492596c374a287679352bfc2` |
| `batching/embeddings.ts` | `7f431702470dde83babc1fc13678ac83aa6278c5075bce6045029f6fbdd471a9` | `7f431702470dde83babc1fc13678ac83aa6278c5075bce6045029f6fbdd471a9` |
| `batching/embeddings.test.ts` | `02e9d7ff6de9f4011941d88ec95ef8a2956ddaa138a94cb65144d96cdfe521bf` | `02e9d7ff6de9f4011941d88ec95ef8a2956ddaa138a94cb65144d96cdfe521bf` |
| `batching/provider-contract.excerpt.ts` | `db08855810a023ea3524800bf442355e93297e2ecef4ac6284c934cdd25688cd` | `8ce2105a5d56a1662525e639b2a621b35ebbf7854969153428b5fdfa69b26c7e` |
| `diagnostics/gemini-embedding.ts` | `d8c890eaa7fc688e83695c8fd01ff925fcb212b3924d46cddd314c74f2011abd` | `d8c890eaa7fc688e83695c8fd01ff925fcb212b3924d46cddd314c74f2011abd` |
| `diagnostics/gemini-embedding.test.ts` | `2ffcbe47eba996bfacdb6d250e3be6a44208d824095d5ea3e3265441ff24992a` | `2ffcbe47eba996bfacdb6d250e3be6a44208d824095d5ea3e3265441ff24992a` |
| `diagnostics/failure.ts` | `c83a5ba51091e48ffbe497023043045fadff869d46a9682e4928da82cee0ea22` | `c83a5ba51091e48ffbe497023043045fadff869d46a9682e4928da82cee0ea22` |
| `diagnostics/failure.test.ts` | `a71c88aa3e5edfed06c5025dd8683bd10b7a5dc3e5f35f9b9f51a439b0da197d` | `a71c88aa3e5edfed06c5025dd8683bd10b7a5dc3e5f35f9b9f51a439b0da197d` |
| `retry/embeddings.ts` | `c6ae7241cc74dfbf0845c9c0790339660f1b59d6777308077005fd92411c4c2e` | `c6ae7241cc74dfbf0845c9c0790339660f1b59d6777308077005fd92411c4c2e` |
| `retry/embeddings.excerpt.test.ts` | `4581c27e2a33c1609061b4d372040ec6cbda84c090b859dd597505442cff02f5` | `6a8f5e5061d6b438db4ec2cfc90773b8128b458e52e8cb7297853c5e06fbe47d` |
| `pacing/embeddings.ts` | `666e51e9891c65f8105607640d77afd69eac300457aa19e6451fba322b97d905` | `666e51e9891c65f8105607640d77afd69eac300457aa19e6451fba322b97d905` |
| `pacing/embeddings.excerpt.test.ts` | `fb16a38313d8302f6b4a89510831057f4ac343d9dd0a3c4113f743fba8b8238b` | `ee8a4763fb9a7f2fc343472bc4c73eeee275edabda52e96a70244aa515c06275` |
| `publication/indexer.excerpt.ts` | `d60c5a48c89d4e88107979dbb82bdfd79a17ff59fff48f48622ff9583cc3ebc3` | `d1b14330191eb52fd8b0e9b45d6d77c78b0f4cef0a3a336a8c92879f307515b9` |
| `publication/indexer.excerpt.test.ts` | `7d22260691e6e0c5b18bcc0f7647673304f1846fa9d4fc3bb8bff0f93d7fc9c0` | `9215375f57a3073f28903f8911dab463103a67f1b3afb6e746aeb7704d3b1f04` |
| `publication/store.excerpt.ts` | `2737de9c8731f6791c9dcc4ca1055cc4097c29525aa9fa4cdaa02e427b21d8e4` | `1da6c9bad15933d4fb6bdc2de136219be43b3283f4640b958cb7fa9e382f442a` |
| `publication/store.excerpt.test.ts` | `39f0976c4f5fd0846111c4794bd614966574e3196dcb26a5b99f81ae70ab9ef8` | `25cb74e041dec1b510ce9ff36d71389d0168f71a26844ed636051ecd7289b214` |
| `architecture/initial/embedding/provider.ts` | `889096cf3463b46679c5272d6d541023125073a36d7e1f96fe8250a3b7964c3a` | `889096cf3463b46679c5272d6d541023125073a36d7e1f96fe8250a3b7964c3a` |
| `architecture/initial/embedding/provider-factory.ts` | `0edbe7530f859410cec8e97b298103f8c12ae289be7180e5d32d46e21f335847` | `0edbe7530f859410cec8e97b298103f8c12ae289be7180e5d32d46e21f335847` |
| `architecture/initial/generation/provider.ts` | `808b885d6fb512d9fba479ff5ffe3a981c9999dad5739db6764ff9b997752a3e` | `808b885d6fb512d9fba479ff5ffe3a981c9999dad5739db6764ff9b997752a3e` |
| `architecture/initial/generation/provider-factory.ts` | `d71a75a0827af954b0c7f5ba6ef7f0d0d8b371815753cef3ad608540a28088e9` | `d71a75a0827af954b0c7f5ba6ef7f0d0d8b371815753cef3ad608540a28088e9` |
| `architecture/embedding-provider-factory.ts` | `5fea6628a1b81713d2c4d46712944e6a5e12937402b0d2425f1932c259cb0722` | `5fea6628a1b81713d2c4d46712944e6a5e12937402b0d2425f1932c259cb0722` |
| `architecture/credentials.ts` | `70641a5750053e84ad21815c46eeb62894a8abe5498dfb3cdfb1f05a48605f31` | `70641a5750053e84ad21815c46eeb62894a8abe5498dfb3cdfb1f05a48605f31` |
| `architecture/embedding-selection.excerpt.ts` | `d6890ead1d23084b98aa6ec3966966d4c87acef49d5ffb1eb1f8bae1490bc392` | `4ff21d2e1532bbd6d07a22e93dd4cb53e42b4def6680799928bfed011b906ac8` |
| `architecture/embedding-selection.excerpt.test.ts` | `74f25260035987842fb27c9971792c33e3b2e1a0fb1ba12aea210115a48d1605` | `e04e3088121bba5b2611c82fb9cd7f803fd74041b44996c8842d78f6c99c736a` |
| `architecture/generation/provider.ts` | `68b0911512ab1f6f69293e3da7cb7fd4663e5bc247b91f8adf1cc0fb319d3fb9` | `68b0911512ab1f6f69293e3da7cb7fd4663e5bc247b91f8adf1cc0fb319d3fb9` |
| `architecture/generation/provider-factory.ts` | `cb2ba7c1d97b1a1b4b4ca0c0a0cf7c8d4b021442505f9aa80256130244088a7d` | `cb2ba7c1d97b1a1b4b4ca0c0a0cf7c8d4b021442505f9aa80256130244088a7d` |
| `architecture/generation/provider-factory.test.ts` | `0baf359b9213106c7a7a7dfdaf53a8d5d5836320c3677c74657f7b0c24255d3d` | `0baf359b9213106c7a7a7dfdaf53a8d5d5836320c3677c74657f7b0c24255d3d` |
| `architecture/generation/credentials.ts` | `096f3a7562e59060bd856aa6ee4710ecf10c3334411df10ef1dfc49e0061e63f` | `096f3a7562e59060bd856aa6ee4710ecf10c3334411df10ef1dfc49e0061e63f` |
| `architecture/generation-selection.excerpt.ts` | `cdb12c9f0097db6538f39370973668fe2228413a886d6103d6d2c6959afc4f27` | `4db63cbf061d8ee543fcb3f8f25e0002524e55951bd56671dca535bd6db7ae88` |
| `architecture/generation-selection.excerpt.test.ts` | `e6783be754407e23c82e4050e86bbb28b639c4387f823c372191fbf5d0fe374c` | `27923c9e7b55437708f2b48ed3f8cff0f83754a17c194b67645a7ace3602bf12` |
| `architecture/generation/orchestrator.ts` | `c8b18306e68f1d12ee705ff49bfcbd0d4bcf5d3028fa9b7866bba3e98fa8337c` | `c8b18306e68f1d12ee705ff49bfcbd0d4bcf5d3028fa9b7866bba3e98fa8337c` |
| `architecture/generation/orchestrator.excerpt.test.ts` | `a51babca786bb05a66b96ffcaf4ccb144ba849a023eab5970d047a2eedf8f326` | `1d24920a658fbe0a99ba5127ff6570da4545048cc969a4e9f10ce59971bc6d56` |
| `architecture/generation/target-options.ts` | `264e26068fe613a1a4bbec58480a6c884afce9cb0f9d147d2feeef61116ff454` | `264e26068fe613a1a4bbec58480a6c884afce9cb0f9d147d2feeef61116ff454` |
| `architecture/groq/generation.ts` | `d859e5eeabd81f943645013b80a94b13c48cfaee0a2a545b02f89e02b5878df6` | `d859e5eeabd81f943645013b80a94b13c48cfaee0a2a545b02f89e02b5878df6` |
| `architecture/groq/generation.excerpt.test.ts` | `8274403ede21cf588856bdc5de15116b73341dda3c3af9f8ea59b091e26c79fa` | `9f27bceec5d46000b7ffd33646019c719925e4ce780bdec2bdd1db1b138c31e3` |
| `architecture/embedding-space.excerpt.ts` | `808b33161d3d6d254c5987d2845d81543a45be39126153a018fa257a6b8ca0f4` | `4ef17cf842bd211dec79420605410a6c0dca0b7f2d5774de20bef7e803f3c997` |
| `architecture/embedding-space.excerpt.test.ts` | `3f67e3e7a5f9641d2ab4bead05aebf0ac705e7f7d0e3690c56c1eb3951871e6e` | `b1b65537beb4266e29caf657a54b0429c5649965441015463a52b0af74398b15` |
| `architecture/config-selection-history.json` | See input table | `95bdfa3d3fd7e9bae1176dbb28bbc41039919e55ae4d13d0e8ee544d47e6484d` |
| `evidence/published-index-summary.json` | See input table | `12e6a4002ca8ed47b9749f0ece819444fcc1d61a0f9812dcec30f2f152a9cebb` |

</details>

## Publication checks

The 22 whole-file Excerpts matched their Git objects byte-for-byte and by SHA-256. All selected ranges in the 15 partial Excerpts matched their source statements; all 37 TypeScript files passed syntax parsing. The two JSON reconstructions passed syntax, historical configuration-field comparison, source-hash checks, and the committed index’s metadata/vector-structure checks. The recorded RPM/TPM arithmetic was checked with its stated assumptions.

English/Korean facts, source mappings, and code targets were compared. All 412 local links across the READMEs and detailed records passed file, heading-anchor, and line-range checks. The previous three cases’ text and 48 published files were preserved. New files were reviewed for credential values, private document content, private repository URLs, and local user paths. Verification used source inspection and local parsing/calculation; historical application tests, API calls, and index builds were outside this publication run.

[Back to all cases](../../README.md)
