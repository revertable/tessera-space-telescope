# 01 — From Local Qwen/Ollama Inference to the Gemini API

[All cases](../../README.md) · [한국어](01-local-inference-to-gemini.ko.md) · [Next: 02](02-gitbook-to-local-knowledge.md)

**Evidence:** Code confirmed identifies historical source; reported at the time retains recorded observation conditions; unconfirmed marks unresolved facts or causal links. Tests are historical source evidence. Times are KST (UTC+09:00); development events and evidence-inspection dates retain their own labels.

**Document revision:** Split on 2026-10-30 from `2fc5094`. Historical publication checks below retain their dates and scope. On 2026-10-31, redundant explanations and verification-limit wording were revised from `f7fb082`.

**Development date:** 2026-09-26

**Code classification:** Excerpt — all 12 source and test files linked below.

**Outcome:** local inference was retired in favor of direct Gemini API integration; the record-based answering workflow was retained.

## Problem and constraints

Synethos initially pursued free, self-hosted inference with project-local Ollama. The committed baseline used `qwen3:0.6b` for generation and `qwen3-embedding:0.6b` for embeddings. It configured a 4096-token generation context, a 120000ms local request timeout, and embedding batches of 16. Runtime/model storage stayed within the project, and provisioning explicitly disabled cloud use through `OLLAMA_NO_CLOUD=1`. These settings describe the historical baseline.

At 02:16:28, the developer reported that Korean questions could produce English answers when the retrieved material was an English GitHub profile. The proposed comparison changed only the generation model to `qwen3:8b`, preserving embeddings, retrieval, chunking, prompts, approved knowledge, and the existing index. The intended language behavior was to follow an explicit language request first and otherwise answer in the question's language.

The relevant machine ran Windows with a Ryzen 5 5600X, Radeon RX 6800 XT with 16GiB VRAM, roughly 16GiB system RAM, and the Vulkan backend. These hardware and backend conditions describe the resource experiment's environment.

## Experiments and the option that was retired

**Reported at the time:** at 02:30:27, the developer reported an abrupt, complete power loss during Qwen3 8B validation, followed by a manual reboot. The immediate request was to inspect existing records without restarting the model or server.

The last successful log time reported by the developer was 02:26:07, while the retained HTTP stdout contains later successful chat responses at 02:26:33, :42, :50, and :57, followed by a successful embedding at 02:26:57. The log lacks request bodies needed to associate those entries with individual validation questions. **The exact shutdown time, final question, and technical cause remain unconfirmed.** Driver warnings and the use of Vulkan do not establish causation.

At approximately 03:06, the developer explored reducing instantaneous GPU load through software controls, using CPU/RAM capacity and accepting slower responses without buying hardware or changing hardware settings. A lower-load run completed between 03:21:21 and 03:23:30:

| Condition or observation | Retained result |
|---|---|
| Question | `What is Codex Session Observatory?` |
| Generation | `qwen3:8b`; 18 of 37 layers offloaded to the GPU |
| Embeddings | `qwen3-embedding:0.6b`; CPU execution |
| Response | `answered`, three sources, 118301ms elapsed |
| Minimum available physical RAM | 3693346816bytes, approximately 3.44GiB |
| Configured memory stop threshold | 3221225472bytes, 3GiB |
| Completion | `completed`, `abortReason=null`, no remaining listening ports reported |

The run completed within its recorded memory threshold, with 18 of 37 generation layers on the GPU. Korean response quality, sustained stability, and resolution of the earlier power incident remain unconfirmed after this single English response.

## Decision

At 03:50:47, the developer judged execution stability, resource demands, and response time to be too burdensome for the MVP after the 0.6B/8B attempts and CPU/GPU split experiment. The chosen direction was to stop operating local inference and use the Gemini API free tier available at the time.

The decision also narrowed implementation scope: remove the local inference path rather than maintain a selectable local/API compatibility layer. Approved knowledge, retrieval, record-grounding rules, and citation checks were to remain. Existing Qwen embeddings were not to be reused as Gemini embeddings.

This was a product-scope decision based on the observed constraints and the experiments recorded above. The developer selected the Gemini API free tier available on September 26, 2026.

The 03:50:47 decision and 03:58:18 follow-up were directly inspected in original user-input history. The follow-up combined Ollama cleanup and Gemini generation/embedding integration into one completion scope, skipping a separate intermediate unconfigured-state implementation. Actual API calls and a new index were deferred until key entry. The [recovered-source register](../evidence/recovered-source-register.json) preserves session IDs, message times, and original-text hashes.

## Implementation: local HTTP calls to a server-side API client

The baseline snapshot is `cb299ce7f96888ab9ed4e49d69bfb3f6d59b30dc`, committed at 02:15:03. Its relevant code and configuration match the earlier prototype snapshot `801633a`. The transition snapshot is `9a3df6134f3a68c012d98afa9fdc5f7f7cf5b264`, committed at 12:05:45 with the message `Replace local Ollama inference with Gemini API`.

The published baseline uses the **0.6B model** and precedes the 8B experiment request. The excerpts preserve this committed baseline; the low-load experiment's settings are recorded in the experiment table.

**Before:** [the local POST client](../../cases/local-inference-to-gemini/before/ollama/client.ts#L10-L37) applies an AbortController timeout and sends JSON to Ollama. [Generation](../../cases/local-inference-to-gemini/before/ollama/generation.ts#L39-L53) uses `/api/chat`, disables streaming, supplies a JSON response schema, and passes temperature/context options. [Embedding](../../cases/local-inference-to-gemini/before/ollama/embeddings.ts#L13-L32) batches `/api/embed` calls and checks vector counts, consistent dimensions, and finite values.

**After:** [the Gemini client](../../cases/local-inference-to-gemini/after/gemini/client.ts#L11-L16) requires a server-side API key and constructs `GoogleGenAI`. [Generation](../../cases/local-inference-to-gemini/after/gemini/generation.ts#L40-L68) calls `generateContent`, requests JSON with the response schema, applies the output limit, and validates the returned answer/citation shape. The key value is not part of the excerpt.

The transition's generation model was **`gemini-3.8-flash`**, with `maxOutputTokens=1200`; embeddings used **`gemini-embedding-2`**, with 768 output dimensions. These model settings belong to the transition commit. The implementation did not retain a local/provider fallback path.

## Implementation: preserve grounding while changing the provider

The [Ollama prompt and record construction](../../cases/local-inference-to-gemini/before/ollama/generation.ts#L29-L38) and the [Gemini counterpart](../../cases/local-inference-to-gemini/after/gemini/generation.ts#L29-L38) retain the same core instructions: use supplied records, treat records as untrusted evidence rather than instructions, avoid invented facts, state what cannot be confirmed, and cite supporting record IDs.

The provider request mechanism changes, while that grounding intent remains. The Gemini response schema additionally sets `additionalProperties: false`; compare [the earlier schema](../../cases/local-inference-to-gemini/before/ollama/generation.ts#L14-L21) with [the later schema](../../cases/local-inference-to-gemini/after/gemini/generation.ts#L13-L21). The response-shape checks and citation deduplication are visible in both implementations. Shape validation alone does not prove that each statement is supported by its citation.

The [historical generation test](../../cases/local-inference-to-gemini/verification/generation.test.ts#L5-L31) uses a synthetic record containing an instruction-like string. It checks the outgoing prompt and structured response contract using a mock model. Live prompt-injection resistance and semantic grounding accuracy were outside this mock test's verification scope.

## Implementation: a new embedding contract requires a new index

The Gemini adapter separates [query input](../../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L32-L38) from [document-chunk input](../../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L40-L50). Each chunk is embedded independently with its title and text. [Vector validation](../../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L8-L30) requires one returned vector for one input, the configured dimension, numeric elements, and finite values.

This version embeds document chunks sequentially. The [embedding tests](../../cases/local-inference-to-gemini/verification/embeddings.test.ts#L10-L47) record the intended per-chunk order and query prefix using mock responses.

The migration also changes index compatibility:

- [The corpus fingerprint](../../cases/local-inference-to-gemini/after/indexing/corpus.ts#L7-L44) includes schema version2, embedding model, output dimensions, and embedding input version, alongside chunking and source identity.
- [The index builder](../../cases/local-inference-to-gemini/after/indexing/indexer.ts#L25-L43) obtains new Gemini vectors, checks their count against the chunks, and writes model/dimension metadata.
- [The index reader](../../cases/local-inference-to-gemini/after/indexing/store.ts#L20-L26) rejects a fingerprint/schema mismatch with a rebuild error.
- [The fingerprint tests](../../cases/local-inference-to-gemini/verification/corpus.test.ts#L5-L26) distinguish generation-model changes from embedding-model/dimension changes: only the latter invalidate this fingerprint.

The original indexer, retrieval, and answer path imports were switched from Ollama to Gemini in the transition commit. The excerpt set covers the provider and index mechanisms.

## Verification results and their limits

The transition commit's development report records a separate Gemini check:

| Observation | Reported result |
|---|---|
| Input corpus | One approved GitHub profile document |
| Index | Eight independent chunk vectors, each 768 dimensions; index current with the configured model metadata |
| Question | `Riu Salze는 어떤 개발자인가요?` |
| Answer | HTTP200, Korean response, citation to the profile's `About Me` section |
| Timing | Index creation approximately4.96seconds; complete `/api/ask` request approximately4.96seconds |
| Further calls | No retry, fallback, or additional question used |

The Gemini check verified the index-and-answer path for one profile document and one Korean question. The table's index creation and complete answer request timings measure separate operations. The Qwen low-load run used an English question and different execution conditions, limiting direct speed/quality comparison between the two runs.

The implementation and historical tests establish the following:

| Item | Confirmed behavior |
|---|---|
| Provider transition | Local HTTP inference was replaced by direct Gemini integration. |
| Grounding and index | Grounding instructions and new index compatibility checks are visible in code. |
| Historical tests | They express request, vector-order, and fingerprint contracts. |

## Source traceability

All published code is **Excerpt**. The files preserve the original bytes, including imports and references to application files that are not published here. Names, control flow, and dependency references remain as originally implemented. The source table identifies the meaningful line span of each full-file excerpt; trailing blank lines remain preserved in the file hashes.

The private Synethos source is identified by commit and repository-relative path. Private repository URLs, private research transcripts, raw runtime logs, local user paths, and API key values are not published. The ledger below records evidence identities and verification limits.


### Before snapshot

`cb299ce7f96888ab9ed4e49d69bfb3f6d59b30dc` — 2026-09-26 02:15:03 KST

| Public Excerpt | Original path | Original lines → public lines |
|---|---|---|
| [before/ollama/client.ts](../../cases/local-inference-to-gemini/before/ollama/client.ts#L1-L48) | `sveltekit/src/lib/server/ollama/client.ts` | 1–48 → 1–48 |
| [before/ollama/generation.ts](../../cases/local-inference-to-gemini/before/ollama/generation.ts#L1-L67) | `sveltekit/src/lib/server/ollama/generation.ts` | 1–67 → 1–67 |
| [before/ollama/embeddings.ts](../../cases/local-inference-to-gemini/before/ollama/embeddings.ts#L1-L33) | `sveltekit/src/lib/server/ollama/embeddings.ts` | 1–33 → 1–33 |

### After implementation and test snapshot

`9a3df6134f3a68c012d98afa9fdc5f7f7cf5b264` — 2026-09-26 12:05:45 KST

| Public Excerpt | Original path | Original lines → public lines |
|---|---|---|
| [after/gemini/client.ts](../../cases/local-inference-to-gemini/after/gemini/client.ts#L1-L16) | `sveltekit/src/lib/server/gemini/client.ts` | 1–16 → 1–16 |
| [after/gemini/generation.ts](../../cases/local-inference-to-gemini/after/gemini/generation.ts#L1-L69) | `sveltekit/src/lib/server/gemini/generation.ts` | 1–69 → 1–69 |
| [after/gemini/embeddings.ts](../../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L1-L50) | `sveltekit/src/lib/server/gemini/embeddings.ts` | 1–50 → 1–50 |
| [after/indexing/corpus.ts](../../cases/local-inference-to-gemini/after/indexing/corpus.ts#L1-L45) | `sveltekit/src/lib/server/indexing/corpus.ts` | 1–45 → 1–45 |
| [after/indexing/indexer.ts](../../cases/local-inference-to-gemini/after/indexing/indexer.ts#L1-L43) | `sveltekit/src/lib/server/indexing/indexer.ts` | 1–43 → 1–43 |
| [after/indexing/store.ts](../../cases/local-inference-to-gemini/after/indexing/store.ts#L1-L36) | `sveltekit/src/lib/server/indexing/store.ts` | 1–36 → 1–36 |
| [verification/generation.test.ts](../../cases/local-inference-to-gemini/verification/generation.test.ts#L1-L31) | `sveltekit/src/lib/server/gemini/generation.test.ts` | 1–31 → 1–31 |
| [verification/embeddings.test.ts](../../cases/local-inference-to-gemini/verification/embeddings.test.ts#L1-L47) | `sveltekit/src/lib/server/gemini/embeddings.test.ts` | 1–47 → 1–47 |
| [verification/corpus.test.ts](../../cases/local-inference-to-gemini/verification/corpus.test.ts#L1-L26) | `sveltekit/src/lib/server/indexing/corpus.test.ts` | 1–26 → 1–26 |

<details>
<summary>SHA-256 of the public Excerpts</summary>

| Public file | SHA-256 |
|---|---|
| `before/ollama/client.ts` | `08c4c0264dd0703b130860eb73fb0d2cdfc416930666c069b8082e74a2efcc48` |
| `before/ollama/generation.ts` | `5c31dd479995ee136fa14d71892b6efbf2f198cc43e59b7239bea4385396c4df` |
| `before/ollama/embeddings.ts` | `97fdb50a9747d2ca8988353a224850aefd1c081191b3a8897ff574b6afba66f1` |
| `after/gemini/client.ts` | `7d0659ba3192dd9c6ec329ce571e8004dfb115f356a7ce81a7e137f7ca712a0c` |
| `after/gemini/generation.ts` | `19c5ec506cb166d4dcc87149d3c73049373f568c15e6c1b1b6ab17bcba3dddf9` |
| `after/gemini/embeddings.ts` | `3984bf24b704c89d8cc9f2632c78da557ec6ff28cbc430b48fcbb8b19dcaf929` |
| `after/indexing/corpus.ts` | `86ce3b5e1c8140f9f8c3dad9005a8ef0e14587a16969742dcf064575da59e598` |
| `after/indexing/indexer.ts` | `db546753b7aa17e87fb08dfed2a6b5db22e9de591a281257c356bc7984fe18a6` |
| `after/indexing/store.ts` | `d288feaa0d65083cb4b427d1226fdddfc3e9763168a4eed754ca275fe87ff1c7` |
| `verification/generation.test.ts` | `399c9b9537c3fcfa98b15d0da3f291bff3ffb697988ed1c02121174a2bbd25b6` |
| `verification/embeddings.test.ts` | `35a7dc9871bf6875dc1a15bfc1d1238639bdaa2eb782b9339270ca96422c418e` |
| `verification/corpus.test.ts` | `3994caf385f5a73d8cd4df06a1408d47b4286381302318ca9cc28820bdf13b5d` |

</details>

### Development records and verification evidence

| Evidence | Source identity | Supported claim and level |
|---|---|---|
| Baseline settings | config/mosaic.json and scripts/ollama.ps1 at cb299ce; initial runtime records | 0.6B/4096 context/120000ms/batch16 and intent to run locally; source confirmation and retained records |
| Transition implementation | Sources above and config/mosaic.json at 9a3df61 | Local call removal, Gemini3.8 generation and embedding2/768, new index contract; source confirmation |
| Transition verification | docs/development-status.md at 9a3df61, “Gemini Verification — 2026-09-26” | Eight vectors, one Korean question, timings, no retry/fallback; reported at the time |
| Transition decision | Retained developer request dated 2026-09-26 03:50:47 KST | Local retirement and API choice because of resources, stability, and response time; recorded judgment |
| Power/low-load records | Retained logs and artifacts identified below | Environment, completion, and measurements; power-loss cause unconfirmed |

All six retained originals below were directly read on the home PC and their SHA-256 values recomputed; every value matched the existing register. The summary, response, memory timeline, and Ollama logs support the low-load run’s completion, measurements, and placement conditions above. Raw files and complete transcripts remain privately retained.

| Retained artifact identity | Recorded SHA-256 |
|---|---|
| `qwen8b-ollama.err.log` | `e0136ac0b357a41caf1c7c2a35044cb36933d6ea39b20945f00ccfcc894b6032` |
| `qwen8b-ollama.out.log` | `a4c01228c7f3760075b7f0f051f9e9edd70239c2e2a293cfb77caff7ceddbcc5` |
| `low-load-validation-20260926-032121/summary.json` | `27d7170e3bfa75cb48c75ea149bfe1e53fda7b3082211b4b330cf6ebecf22668` |
| `low-load-validation-20260926-032121/response.json` | `d60f94b860af11ecdb337ab832c19111d3bcf7711c75f51aaab552f1d9f66ea3` |
| `low-load-validation-20260926-032121/ollama.err.log` | `5c26abd7230b0db96b57c3744c55727d0586b7c9e00761ba726701e9f3469321` |
| `low-load-validation-20260926-032121/memory-timeline.jsonl` | `d7689540ebbab20cbbf29af48a3232f211d29e35022627296f2ce52c98ae3bf3` |

Publication checks: the 12 Excerpts were checked against their originals, along with TypeScript syntax, English/Korean correspondence, and file/line links. No model API call, local inference, application build, or historical test execution was performed.

[Back to all cases](../../README.md)
