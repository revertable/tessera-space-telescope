# Engineering Decisions

[Tessera](../README.md) · [한국어](engineering-decisions.ko.md)

These records connect implementation code to the problems, experiments, and decisions that shaped Synethos. Dates refer to development events; all times below are Korea Standard Time (KST, UTC+09:00).

## Reading the evidence

- **Code confirmed:** behavior visible in the identified historical source snapshot, or the byte-for-byte source comparison used to prepare these excerpts.
- **Reported at the time:** a retained development request, experiment artifact, or verification report describes the observation. These observations retain their original execution conditions and verification scope.
- **Unconfirmed:** the available records do not establish the cause, correspondence, or broader effect.

Each case includes a source ledger identifying its code snapshots and retained evidence. Historical tests are published as implementation evidence; this repository does not provide their dependencies or a test runner.

Retained originals on the home PC were additionally inspected on October 29, 2026. The [recovered-source register](evidence/recovered-source-register.json) preserves original file hashes, session/message times, observation conditions, and remaining questions for cases 01–06. User-input history identifies original requests and decisions; experiment results and completion reports retain their historical execution conditions.

## Contents

- [01 — From Local Qwen/Ollama Inference to the Gemini API](#01--from-local-qwenollama-inference-to-the-gemini-api) — 2026-09-26
- [02 — From GitBook MCP to Local Knowledge](#02--from-gitbook-mcp-to-local-knowledge) — 2026-09-26 ~ 2026-09-28
- [03 — Introducing, Evaluating, and Retiring Cohere](#03--introducing-evaluating-and-retiring-cohere) — 2026-09-28 ~ 2026-10-17
- [04 — Provider Architecture and Embedding Reliability](#04--provider-architecture-and-embedding-reliability) — 2026-09-26 ~ 2026-10-17
- [05 — Cross-PC Index Portability](#05--cross-pc-index-portability) — 2026-09-28 ~ 2026-10-26
- [06 — Model Selection: Quality and Availability](#06--model-selection-quality-and-availability) — 2026-09-26 ~ 2026-10-16
- [07 — Knowledge–Index Consistency and Recoverable Deployment](#07--knowledgeindex-consistency-and-recoverable-deployment) — 2026-10-22 ~ 2026-10-26

## 01 — From Local Qwen/Ollama Inference to the Gemini API

**Development date:** 2026-09-26

**Code classification:** Excerpt — all 12 source and test files linked below.

**Outcome:** local inference was retired in favor of direct Gemini API integration; the record-based answering workflow was retained.

### Problem and constraints

Synethos initially pursued free, self-hosted inference with project-local Ollama. The committed baseline used `qwen3:0.6b` for generation and `qwen3-embedding:0.6b` for embeddings. It configured a 4096-token generation context, a 120000ms local request timeout, and embedding batches of 16. Runtime/model storage stayed within the project, and provisioning explicitly disabled cloud use through `OLLAMA_NO_CLOUD=1`. These settings describe the historical baseline.

At 02:16:28, the developer reported that Korean questions could produce English answers when the retrieved material was an English GitHub profile. The proposed comparison changed only the generation model to `qwen3:8b`, preserving embeddings, retrieval, chunking, prompts, approved knowledge, and the existing index. The intended language behavior was to follow an explicit language request first and otherwise answer in the question's language.

The relevant machine ran Windows with a Ryzen 5 5600X, Radeon RX 6800 XT with 16GiB VRAM, roughly 16GiB system RAM, and the Vulkan backend. These hardware and backend conditions describe the resource experiment's environment.

### Experiments and the option that was retired

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

### Decision

At 03:50:47, the developer judged execution stability, resource demands, and response time to be too burdensome for the MVP after the 0.6B/8B attempts and CPU/GPU split experiment. The chosen direction was to stop operating local inference and use the Gemini API free tier available at the time.

The decision also narrowed implementation scope: remove the local inference path rather than maintain a selectable local/API compatibility layer. Approved knowledge, retrieval, record-grounding rules, and citation checks were to remain. Existing Qwen embeddings were not to be reused as Gemini embeddings.

This was a product-scope decision based on the observed constraints and the experiments recorded above. The developer selected the Gemini API free tier available on September 26, 2026.

The 03:50:47 decision and 03:58:18 follow-up were directly inspected in original user-input history. The follow-up combined Ollama cleanup and Gemini generation/embedding integration into one completion scope, skipping a separate intermediate unconfigured-state implementation. Actual API calls and a new index were deferred until key entry. The [recovered-source register](evidence/recovered-source-register.json) preserves session IDs, message times, and original-text hashes.

### Implementation: local HTTP calls to a server-side API client

The baseline snapshot is `cb299ce7f96888ab9ed4e49d69bfb3f6d59b30dc`, committed at 02:15:03. Its relevant code and configuration match the earlier prototype snapshot `801633a`. The transition snapshot is `9a3df6134f3a68c012d98afa9fdc5f7f7cf5b264`, committed at 12:05:45 with the message `Replace local Ollama inference with Gemini API`.

The published baseline uses the **0.6B model** and precedes the 8B experiment request. The excerpts preserve this committed baseline; the low-load experiment's settings are recorded in the experiment table.

**Before:** [the local POST client](../cases/local-inference-to-gemini/before/ollama/client.ts#L10-L37) applies an AbortController timeout and sends JSON to Ollama. [Generation](../cases/local-inference-to-gemini/before/ollama/generation.ts#L39-L53) uses `/api/chat`, disables streaming, supplies a JSON response schema, and passes temperature/context options. [Embedding](../cases/local-inference-to-gemini/before/ollama/embeddings.ts#L13-L32) batches `/api/embed` calls and checks vector counts, consistent dimensions, and finite values.

**After:** [the Gemini client](../cases/local-inference-to-gemini/after/gemini/client.ts#L11-L16) requires a server-side API key and constructs `GoogleGenAI`. [Generation](../cases/local-inference-to-gemini/after/gemini/generation.ts#L40-L68) calls `generateContent`, requests JSON with the response schema, applies the output limit, and validates the returned answer/citation shape. The key value is not part of the excerpt.

The transition's generation model was **`gemini-3.8-flash`**, with `maxOutputTokens=1200`; embeddings used **`gemini-embedding-2`**, with 768 output dimensions. These model settings belong to the transition commit. The implementation did not retain a local/provider fallback path.

### Implementation: preserve grounding while changing the provider

The [Ollama prompt and record construction](../cases/local-inference-to-gemini/before/ollama/generation.ts#L29-L38) and the [Gemini counterpart](../cases/local-inference-to-gemini/after/gemini/generation.ts#L29-L38) retain the same core instructions: use supplied records, treat records as untrusted evidence rather than instructions, avoid invented facts, state what cannot be confirmed, and cite supporting record IDs.

The provider request mechanism changes, while that grounding intent remains. The Gemini response schema additionally sets `additionalProperties: false`; compare [the earlier schema](../cases/local-inference-to-gemini/before/ollama/generation.ts#L14-L21) with [the later schema](../cases/local-inference-to-gemini/after/gemini/generation.ts#L13-L21). The response-shape checks and citation deduplication are visible in both implementations. Shape validation alone does not prove that each statement is supported by its citation.

The [historical generation test](../cases/local-inference-to-gemini/verification/generation.test.ts#L5-L31) uses a synthetic record containing an instruction-like string. It checks the outgoing prompt and structured response contract using a mock model. Live prompt-injection resistance and semantic grounding accuracy were outside this mock test's verification scope.

### Implementation: a new embedding contract requires a new index

The Gemini adapter separates [query input](../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L32-L38) from [document-chunk input](../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L40-L50). Each chunk is embedded independently with its title and text. [Vector validation](../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L8-L30) requires one returned vector for one input, the configured dimension, numeric elements, and finite values.

This version embeds document chunks sequentially. The [embedding tests](../cases/local-inference-to-gemini/verification/embeddings.test.ts#L10-L47) record the intended per-chunk order and query prefix using mock responses.

The migration also changes index compatibility:

- [The corpus fingerprint](../cases/local-inference-to-gemini/after/indexing/corpus.ts#L7-L44) includes schema version2, embedding model, output dimensions, and embedding input version, alongside chunking and source identity.
- [The index builder](../cases/local-inference-to-gemini/after/indexing/indexer.ts#L25-L43) obtains new Gemini vectors, checks their count against the chunks, and writes model/dimension metadata.
- [The index reader](../cases/local-inference-to-gemini/after/indexing/store.ts#L20-L26) rejects a fingerprint/schema mismatch with a rebuild error.
- [The fingerprint tests](../cases/local-inference-to-gemini/verification/corpus.test.ts#L5-L26) distinguish generation-model changes from embedding-model/dimension changes: only the latter invalidate this fingerprint.

The original indexer, retrieval, and answer path imports were switched from Ollama to Gemini in the transition commit. The excerpt set covers the provider and index mechanisms.

### Verification results and their limits

The transition commit's development report records a separate Gemini check:

| Observation | Reported result |
|---|---|
| Input corpus | One approved GitHub profile document |
| Index | Eight independent chunk vectors, each 768 dimensions; index current with the configured model metadata |
| Question | `Riu Salze는 어떤 개발자인가요?` |
| Answer | HTTP200, Korean response, citation to the profile's `About Me` section |
| Timing | Index creation approximately4.96seconds; complete `/api/ask` request approximately4.96seconds |
| Further calls | No retry, fallback, or additional question used |

The report records approximately4.96seconds for index creation and approximately4.96seconds for the complete answer request as separate operations. The Gemini check verified the index-and-answer path for one profile document and one Korean question. The Qwen low-load run used a different English question and execution conditions, so a controlled speed/quality comparison remains unavailable. Broader quality, quota sustainability, and production reliability remain unverified.

The evidence supports the following boundaries:

| Established in the record | Still unconfirmed or outside the verification |
|---|---|
| Local HTTP inference was replaced by direct Gemini integration, with grounding instructions and new index compatibility checks visible in code. | The technical cause of the power loss and the mapping of the final local requests to individual questions. |
| A lower-load local run completed, and a separate Gemini Korean question succeeded according to retained records. | Sustained local stability, Korean quality improvement from the 8B change, or general Gemini superiority. |
| Historical tests express request, vector-order, and fingerprint contracts. | A current full application test run or fresh model experiment in Tessera. |

### Source traceability

All published code is **Excerpt**. The files preserve the original bytes, including imports and references to application files that are not published here. Names, control flow, and dependency references remain as originally implemented. The source table identifies the meaningful line span of each full-file excerpt; trailing blank lines remain preserved in the file hashes.

The private Synethos source is identified by commit and repository-relative path. Private repository URLs, private research transcripts, raw runtime logs, local user paths, and API key values are not published. The ledger below records evidence identities and verification limits.


#### Before snapshot

`cb299ce7f96888ab9ed4e49d69bfb3f6d59b30dc` — 2026-09-26 02:15:03 KST

| Public Excerpt | Original path | Original lines → public lines |
|---|---|---|
| [before/ollama/client.ts](../cases/local-inference-to-gemini/before/ollama/client.ts#L1-L48) | `sveltekit/src/lib/server/ollama/client.ts` | 1–48 → 1–48 |
| [before/ollama/generation.ts](../cases/local-inference-to-gemini/before/ollama/generation.ts#L1-L67) | `sveltekit/src/lib/server/ollama/generation.ts` | 1–67 → 1–67 |
| [before/ollama/embeddings.ts](../cases/local-inference-to-gemini/before/ollama/embeddings.ts#L1-L33) | `sveltekit/src/lib/server/ollama/embeddings.ts` | 1–33 → 1–33 |

#### After implementation and test snapshot

`9a3df6134f3a68c012d98afa9fdc5f7f7cf5b264` — 2026-09-26 12:05:45 KST

| Public Excerpt | Original path | Original lines → public lines |
|---|---|---|
| [after/gemini/client.ts](../cases/local-inference-to-gemini/after/gemini/client.ts#L1-L16) | `sveltekit/src/lib/server/gemini/client.ts` | 1–16 → 1–16 |
| [after/gemini/generation.ts](../cases/local-inference-to-gemini/after/gemini/generation.ts#L1-L69) | `sveltekit/src/lib/server/gemini/generation.ts` | 1–69 → 1–69 |
| [after/gemini/embeddings.ts](../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L1-L50) | `sveltekit/src/lib/server/gemini/embeddings.ts` | 1–50 → 1–50 |
| [after/indexing/corpus.ts](../cases/local-inference-to-gemini/after/indexing/corpus.ts#L1-L45) | `sveltekit/src/lib/server/indexing/corpus.ts` | 1–45 → 1–45 |
| [after/indexing/indexer.ts](../cases/local-inference-to-gemini/after/indexing/indexer.ts#L1-L43) | `sveltekit/src/lib/server/indexing/indexer.ts` | 1–43 → 1–43 |
| [after/indexing/store.ts](../cases/local-inference-to-gemini/after/indexing/store.ts#L1-L36) | `sveltekit/src/lib/server/indexing/store.ts` | 1–36 → 1–36 |
| [verification/generation.test.ts](../cases/local-inference-to-gemini/verification/generation.test.ts#L1-L31) | `sveltekit/src/lib/server/gemini/generation.test.ts` | 1–31 → 1–31 |
| [verification/embeddings.test.ts](../cases/local-inference-to-gemini/verification/embeddings.test.ts#L1-L47) | `sveltekit/src/lib/server/gemini/embeddings.test.ts` | 1–47 → 1–47 |
| [verification/corpus.test.ts](../cases/local-inference-to-gemini/verification/corpus.test.ts#L1-L26) | `sveltekit/src/lib/server/indexing/corpus.test.ts` | 1–26 → 1–26 |

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

#### Development records and verification evidence

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

## 02 — From GitBook MCP to Local Knowledge

**Development period:** 2026-09-26 ~ 2026-09-28

**Code classification:** 14 Excerpts and one Reconstructed manifest sample.

**Outcome:** the remote documentation candidate path was retired, approved Markdown became the only knowledge retrieval source, and intent-coverage evaluation was retained. Importing the documents and preparing the corpus did not complete the full index build.

### Problem and initial choice

GitBook was the platform that published Cosmic Horizon’s English and Korean documentation and exposed it through MCP. Synethos evaluated these documents as an external KnowledgeSource before importing approved Markdown into Local Knowledge. The initial investigation kept document retrieval separate from answer generation. A retained request on September 26 called for a reversible probe that preserved Local RAG, API/UI behavior, the index, and ranking.

The foundation commit, f2914de at 03:54:45 on September 27, defines a [source contract](../cases/gitbook-mcp-to-local-knowledge/foundation/source.ts#L1-L17) and a [factory selecting Local or GitBook sources](../cases/gitbook-mcp-to-local-knowledge/foundation/source-factory.ts#L11-L24). The [adapter's allowed tool type](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L1-L37) contains only searchDocumentation and getPage. Although the server advertised askQuestion and sendFeedback, the adapter had no corresponding executable methods. [Capability observation](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L111-L121) listed those capabilities without using them to answer visitors or submit feedback.

The distinction mattered: acquiring evidence, interpreting it, and generating an answer remained different responsibilities. The probe did not feed retrieval, generation, /api/ask, or /api/search in that foundation snapshot.

### What the endpoint observations established

Three records describe different observations:

| Observation | Retained evidence and scope |
|---|---|
| September 26 Single-Space probe | The historical probe report identifies a raw observation of the earlier Single-Space layout. |
| September 27 Two-Space/Site observation | A tracked report describes Cosmic Horizon Global and Korean Spaces combined as Site variants. It reports independent checks of the Global and Korean MCP endpoints. No new raw topology-probe file was written for that check. |
| September 28 09:44:31.093 Site-root probe | A separately retained JSON artifact records four searches, each with ten text blocks and two page results: 40 search blocks and eight page results in total. Its timestamp is 2026-09-28T00:44:31.093Z. The September 27 two-endpoint comparison and this Site-root run are separate observations. |

The September 27 report says the Global endpoint and the endpoint under /kr/ returned the same server identity, tool schemas, capabilities, search corpus, distributions, and URLs. For each endpoint, the returned page-URL variants had the following distribution:

| Query | Global-variant URLs | Korean /kr/ URLs |
|---|---:|---:|
| Why We Study | 9 | 1 |
| 왜 우리는 공부하는가? | 0 | 10 |

These columns distinguish the languages/variants of returned URLs. Registering both endpoints as independent knowledge sources would query the same multilingual corpus twice.

Search responses contained text blocks with Title, Link, and Content lines. The report found no structuredContent, typed locale, Space identity, page/section ID, translation-pair relationship, or search score; only array order was available. Both language versions of Why We Study could have the same title, so title equality was insufficient to identify locale. Repository inspection established a reviewed 16-to-16 document-pair matrix. The /kr/ URL path was the observed locale signal.

The September 28 artifact independently records server version 0.27.2, the four advertised tools, and search responses without structuredContent or reported tool errors. The saved observation was reviewed during publication preparation. Raw page contents are not published here.

Additional raw probes recovered on the home PC are MCP root-endpoint runs at September 26 23:45:48.199 and September 27 21:05:46.310. Each retains four searches, two page results per search, server version 0.27.2, and four tools. The [recovered-source register](evidence/recovered-source-register.json) adds both original hashes, observation times, and per-search response shapes. The September 26 file is the original Single-Space observation above; the September 27 file supports its own root-endpoint observation; the two-endpoint comparison and September 28 09:44:31.093 run retain their separate records.

### Implementing a defensive evidence boundary

The [adapter](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L67-L109) validates its HTTPS endpoint, refuses disabled-source use, limits page reads to the documentation origin, and exposes the two allowed operations. The [probe excerpt](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-probe.excerpt.ts#L7-L54) preserves the original question set, result types, per-query page limit, and search/page orchestration. The file-writing CLI and raw-report persistence code are omitted from this excerpt.

The later [search-result parser](../cases/gitbook-mcp-to-local-knowledge/multi-source/gitbook-search-results.ts#L15-L75), committed in 26a5409, extracts text fields and rejects unsuitable URLs. Its URL checks cover origin and Site path, credentials, query/fragment components, encoded path separators/traversal, and the MCP endpoint itself. It retains the original resultIndex; it does not assign a provider score or infer a typed locale/pair identity. Empty results and nonempty results with no usable entries are different outcomes.

The [historical adapter tests](../cases/gitbook-mcp-to-local-knowledge/verification/gitbook-mcp-source.test.ts#L27-L104) use a synthetic client to check tool restrictions, capability observation without execution, disabled sources, and cross-origin page rejection. The tests verify the adapter contract with a synthetic client.

### Combining sources revealed a different class of problems

The September 27 sequence separated Local candidates from final answer evidence, added multi-source collection, and then ranking. In the later multi-source snapshot, [collection](../cases/gitbook-mcp-to-local-knowledge/multi-source/source-candidates.ts#L23-L58) preserves each configured knowledgeSourceId and keeps Local candidates separate from parsed GitBook hits. GitBook clients are closed in finally. Final citation assignment occurs at evidence selection.

[Ranking](../cases/gitbook-mcp-to-local-knowledge/multi-source/relevance.ts#L23-L64) retains Local cosine scores and embeds the GitBook query and document hits to derive cosine-based relevance scores. The original MCP result position is retained as metadata. Cross-source score calibration remains unverified.

The [multi-source intent excerpt](../cases/gitbook-mcp-to-local-knowledge/multi-source/intent-orchestration.excerpt.ts#L1-L22) shows the next layer: plan original/derived queries, collect and rank for each query, and delegate merging. Identity includes both the configured source and the document identity or public URL. With this identity rule, the same URL under two configured source IDs has distinct candidate identities; cross-source translation-pair deduplication is absent from this implementation.

At 10:38:04 on September 28, a retained developer message reported that derived queries brought Verification Philosophy from rank 25 to 2 and Human Auditor from 9 to 2. However, the initial full round-robin merge pushed an existing AI-role result from 4 to 9, leaving the mixed question's recall@5 at 0.5. Total live-harness time rose from approximately 19.3 seconds to 34.3 seconds, and an embedding-provider error was observed. The developer asked to reconsider merge placement using actual lane order and candidate identity rather than discard the decomposition improvement.

That message's UTC timestamp is 2026-09-28T01:38:04.008Z. The published snapshot contains the revised orchestration. Its retained merge policy used a holistic seed, top intent anchors, and an original-query backbone before derived tails.

At 11:45:32, a further request recorded roughly six embedding calls and three GitBook searches for a two-intent question, along with a 100 RPM free-tier 429 observation. This prompted investigation of fan-out and duplicated embedding work. These observations come from contemporaneous reports. Their relative weight in the MCP retirement decision remains unconfirmed.

The [collection test](../cases/gitbook-mcp-to-local-knowledge/verification/source-candidates.test.ts#L6-L85) expresses provenance and original ranking-signal preservation with synthetic fixtures. The multi-source and intent work was exercised by evaluation; the production answer/search routes still used their existing single-query Local retrieval path.

### Decision: import first, then remove the remote source

At 12:07:16.238 on September 28, the developer explicitly chose to incorporate the supplied English/Korean Markdown snapshots into Local Knowledge and simplify future retrieval around Local Knowledge. The immediate task was import, manifest registration, and index preparation; MCP code removal was deferred to the next step.

At 12:45:49.898, the developer reported 42 documents/475 chunks imported but index rebuilding blocked by the daily embedding quota, and requested the MCP-removal scope analysis. At 13:50:33, a subsequent request described the import and MCP-removal changes as existing uncommitted work to preserve while beginning the next embedding-target task. The combined implementation was committed at 14:50:04 as5f71fbe.

The source simplification and phased scope are recorded user choices. The records do not establish whether metadata limitations, duplicate corpus access, request cost, reproducibility, or manual approval boundaries were the dominant motivation.

### Implementation: approved local files with public citation provenance

The transition removed the GitBook adapter, parser, probe, source factory/contracts, common remote-result relevance layer, and MCP dependency. The runtime retrieval source became approved Markdown registered in knowledge/sources.json; public documentation URLs remained citation metadata rather than live retrieval endpoints. Knowledge import remained manual, with no automatic remote synchronization introduced.

The [approved-source loader](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/manifest.ts#L16-L49) checks the manifest shape, IDs and duplicates, file/title fields, path containment, Markdown extensions, and allowed publicUrl protocols, then reads the registered files. Registration is controlled by the manifest.

The [Reconstructed manifest sample](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/approved-sources.sample.json#L1-L17) contains only the two Why We Study entries, taken from the transition manifest and placed in a newly assembled two-entry document. They have distinct IDs, local file paths, and public URLs despite sharing a title. The sample is selected from the 42-document manifest; the full manifest and document contents remain private.

The [Local search path](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/search.ts#L47-L121) requires a matching usable target index, embeds the question, ranks Local chunks, and selects evidence. [Evidence selection](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/search.ts#L99-L113) retains sourceId, title, section, content, and publicUrl, then assigns citation IDs to selected records. Local-only refers to the knowledge retrieval source: query embedding can still call an external provider.

The [Local intent excerpt](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/intent-orchestration.excerpt.ts#L1-L25) retains planning and merge delegation while replacing remote-source collection/ranking with Local candidate searches. Its default path executes the query bundle on one embedding target, returning that target with the runs. Source identity becomes a Local chunk identity. The same transition also added embedding-provider fallback for query embeddings. Provider adapters and their broader implementation are outside this excerpt set.

The [Local-query test excerpt](../cases/gitbook-mcp-to-local-knowledge/verification/local-query-search.excerpt.test.ts#L13-L42) uses an injected search function to check one Local search per planned query. It does not exercise a real target index, provider fallback, or live answer quality.

### Corpus readiness was not index readiness

The transition report distinguishes these states:

| State on September 28 | Recorded result and limit |
|---|---|
| Approved documents | Existing 10 plus 16 Global and 16 Korean Cosmic Horizon documents:42 total. |
| Corpus preparation | 475 chunks prepared from registered Markdown. |
| Earlier Gemini build | 50 successful chunk embeddings, then HTTP 429 RESOURCE_EXHAUSTED. No partial index was written. |
| Prior singleton artifact | The old 55 chunk index was invalid for the current corpus and target-specific storage schema. |
| Full target indexes at5f71fbe | Builds deferred until document-embedding batching was addressed. Live relevance/API retrieval verification still had to wait. |
| Later report atdadffe3,23:59:41 | Provider-owned batching was implemented, but a full live build remained deferred pending separate approval. This report records the subsequent 23:59 state. |
| Disposable provider smoke in that later report | Two synthetic documents and one query per target, at 768/1536 dimensions; relevant document ranked first; temporary mini-index removed. This did not create a production index. |

The implementation and prepared corpus support the Local Knowledge direction, but the retained records within this case do not establish a completed full 475 chunk production index. The planned architecture, successful small smoke, full-corpus build, and production retrieval quality have different completion conditions.

### What changed, what stayed, and what remains unconfirmed

The remote documentation source was removed, while approved document registration, vector retrieval, public citation provenance, deterministic intent planning, and evaluation of coverage were retained or adapted. The priorities behind retirement and full-index retrieval quality remain unconfirmed as listed below.

Still unconfirmed are the relative weight of the final retirement motivations, the complete correspondence of earlier raw probe runs, and end-to-end retrieval quality with a finished full index at the transition point. The initial round-robin regression remains a reported failure, and the published code records the subsequent revision. No MCP probe, embedding request, index build, or application test was rerun for this publication.

### Source traceability and publication form

Whole-file Excerpts preserve original bytes. Partial Excerpts preserve the listed source ranges without renaming or rewriting their statements; blank separators join selected declarations. Original imports and references to omitted application types/helpers are retained where selected. The partial tests omit the enclosing suite while preserving the selected imports, fixture helper, and test body. These excerpts retain references to the surrounding application.

The only Reconstructed file is the two-entry JSON sample. Its version and entry fields are copied from the identified manifest, while selection and the new envelope are editorial assembly. Private raw responses, private repository URLs, secrets, local user paths, and unrelated approved-source entries are excluded.

The commits below identify private source snapshots. Times are KST (UTC+09:00) unless explicitly marked UTC; commit times and development-event times are distinct.

| Snapshot | Original commit | Commit time |
|---|---|---|
| foundation | `f2914dee1d602a8ff1e3b7c7f800ed5e92f8edaf` | 2026-09-27 03:54:45 |
| parser | `26a5409614fc17af1a01e83295f6d017392c87a3` | 2026-09-27 21:30:17 |
| multi | `430c3755aabe94aa5b7c6b18798ea41af8bc11ab` | 2026-09-28 11:46:31 |
| local | `5f71fbece8a7d7caa28d01d655d8b02d614472cf` | 2026-09-28 14:50:04 |
| later | `dadffe361c617c9db9840696b615b7cc3a0e8fcd` | 2026-09-28 23:59:41 |

#### Code correspondence

Original paths are relative to the private repository; public links open Tessera files. Ranges are inclusive and read `original → public`. Whole-file publication is also classified as Excerpt.

| Public file | Snapshot · original path | Classification · range mapping |
|---|---|---|
| [foundation/source.ts](../cases/gitbook-mcp-to-local-knowledge/foundation/source.ts#L1-L17) | foundation · `sveltekit/src/lib/server/knowledge/source.ts` | Excerpt (whole) · 1–17 → 1–17 |
| [foundation/source-factory.ts](../cases/gitbook-mcp-to-local-knowledge/foundation/source-factory.ts#L1-L24) | foundation · `sveltekit/src/lib/server/knowledge/source-factory.ts` | Excerpt (whole) · 1–24 → 1–24 |
| [foundation/gitbook-mcp-source.ts](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L1-L129) | foundation · `sveltekit/src/lib/server/knowledge/gitbook-mcp-source.ts` | Excerpt (whole) · 1–129 → 1–129 |
| [foundation/gitbook-probe.excerpt.ts](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-probe.excerpt.ts#L1-L54) | foundation · `sveltekit/src/lib/server/knowledge/gitbook-mcp-probe.ts` | Excerpt · 5–9 → 1–5; 12–17 → 7–12; 19–19 → 14–14; 21–26 → 16–21; 28–33 → 23–28; 66–90 → 30–54 |
| [multi-source/gitbook-search-results.ts](../cases/gitbook-mcp-to-local-knowledge/multi-source/gitbook-search-results.ts#L1-L75) | parser · `sveltekit/src/lib/server/knowledge/gitbook-search-results.ts` | Excerpt (whole) · 1–75 → 1–75 |
| [multi-source/source-candidates.ts](../cases/gitbook-mcp-to-local-knowledge/multi-source/source-candidates.ts#L1-L58) | multi · `sveltekit/src/lib/server/retrieval/source-candidates.ts` | Excerpt (whole) · 1–58 → 1–58 |
| [multi-source/relevance.ts](../cases/gitbook-mcp-to-local-knowledge/multi-source/relevance.ts#L1-L64) | multi · `sveltekit/src/lib/server/retrieval/relevance.ts` | Excerpt (whole) · 1–64 → 1–64 |
| [multi-source/intent-orchestration.excerpt.ts](../cases/gitbook-mcp-to-local-knowledge/multi-source/intent-orchestration.excerpt.ts#L1-L22) | multi · `sveltekit/src/lib/server/retrieval/intent-coverage.ts` | Excerpt · 51–55 → 1–5; 127–142 → 7–22 |
| [local-knowledge/manifest.ts](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/manifest.ts#L1-L49) | local · `sveltekit/src/lib/server/knowledge/manifest.ts` | Excerpt (whole) · 1–49 → 1–49 |
| [local-knowledge/search.ts](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/search.ts#L1-L121) | local · `sveltekit/src/lib/server/retrieval/search.ts` | Excerpt (whole) · 1–121 → 1–121 |
| [local-knowledge/intent-orchestration.excerpt.ts](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/intent-orchestration.excerpt.ts#L1-L25) | local · `sveltekit/src/lib/server/retrieval/intent-coverage.ts` | Excerpt · 45–47 → 1–3; 119–139 → 5–25 |
| [verification/gitbook-mcp-source.test.ts](../cases/gitbook-mcp-to-local-knowledge/verification/gitbook-mcp-source.test.ts#L1-L104) | foundation · `sveltekit/src/lib/server/knowledge/gitbook-mcp-source.test.ts` | Excerpt (whole) · 1–104 → 1–104 |
| [verification/source-candidates.test.ts](../cases/gitbook-mcp-to-local-knowledge/verification/source-candidates.test.ts#L1-L85) | multi · `sveltekit/src/lib/server/retrieval/source-candidates.test.ts` | Excerpt (whole) · 1–85 → 1–85 |
| [verification/local-query-search.excerpt.test.ts](../cases/gitbook-mcp-to-local-knowledge/verification/local-query-search.excerpt.test.ts#L1-L42) | local · `sveltekit/src/lib/server/retrieval/intent-coverage.test.ts` | Excerpt · 1–1 → 1–1; 2–2 → 3–3; 3–3 → 5–5; 4–8 → 7–11; 10–20 → 13–23; 85–102 → 25–42 |
| [local-knowledge/approved-sources.sample.json](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/approved-sources.sample.json#L1-L17) | local · `knowledge/sources.json` | Reconstructed · Selected IDs listed below; newly assembled JSON |

JSON selection:
- `cosmic-horizon-en-perspective-why-we-study`
- `cosmic-horizon-kr-perspective-why-we-study`

#### Non-code evidence

| Record | Identifier · scope |
|---|---|
| foundation · `docs/gitbook-mcp-probe.md` | `f2914dee1d602a8ff1e3b7c7f800ed5e92f8edaf`; SHA-256 `e661c51b09bc84a0b0224fd7c1063ab10b8618a4761f7fc6f1f45c451614c11f` |
| parser · `docs/development-status.md` | `26a5409614fc17af1a01e83295f6d017392c87a3`; SHA-256 `bf86fc39c7c6fd9b67605c80271bedbd969db7d5529d211b8874277aeaad5200` |
| multi · `docs/development-status.md` | `430c3755aabe94aa5b7c6b18798ea41af8bc11ab`; SHA-256 `bf86fc39c7c6fd9b67605c80271bedbd969db7d5529d211b8874277aeaad5200` |
| local · `docs/development-status.md` | `5f71fbece8a7d7caa28d01d655d8b02d614472cf`; SHA-256 `cd391e419000613362ac2c09cc48db13304dee65cfecad3cdd50b0bfc03423d5` |
| later · `docs/development-status.md` | `dadffe361c617c9db9840696b615b7cc3a0e8fcd`; SHA-256 `76bd9837403684e0d0137da558d7c438a020fab212588d046b81eb359f51a1c1` |
| Retained Site-root probe | `gitbook-2026-09-28T00-44-31.093Z.json`; SHA-256 `8989e48c4fc7b5422290c7c3d8d87af871768bb35090679726725fdc73b24f43`. Used only for the September 28 run distinguished above. |
| Retained developer requests | September 26 initial probe scope; September 28 10:38:04.008 merge regression, 11:45:32 fan-out, 12:07:16.238 import decision, 12:45:49.898 import/index status, and 13:50:33 preservation of existing changes. Original messages remain private. |

The original UTC timestamp for 10:38:04.008 is `2026-09-28T01:38:04.008Z`. The integrated research document's 11:38 rendering was corrected against that original for this publication. Development events are dated by their original records.

<details>
<summary>Original and public code SHA-256</summary>

Original hashes cover entire files at their source commits. Public hashes cover Tessera files; partial excerpts and the reconstruction therefore have different hashes.

| Public file | Entire original file SHA-256 | Public file SHA-256 |
|---|---|---|
| `foundation/source.ts` | `3561b60540947e349086dbfe78d904e23081867c3d4b6fc6a23aa2f41262e724` | `3561b60540947e349086dbfe78d904e23081867c3d4b6fc6a23aa2f41262e724` |
| `foundation/source-factory.ts` | `c22b6faac2aa4ae25ceabcbec13c2cc69417403ea7df38a2197ee1b7f37fc70b` | `c22b6faac2aa4ae25ceabcbec13c2cc69417403ea7df38a2197ee1b7f37fc70b` |
| `foundation/gitbook-mcp-source.ts` | `41ba8cbad6602c106649529b51ce6eb4b2fd9fc84bc7b4c041a7dbf3988e9cdc` | `41ba8cbad6602c106649529b51ce6eb4b2fd9fc84bc7b4c041a7dbf3988e9cdc` |
| `foundation/gitbook-probe.excerpt.ts` | `66957c2d9d74b2b9c75c0ccd3f112e8767f06e9cb034c5442d7311f87112f15c` | `4e38d14fe7a0e40d18a8510a9a2e029475a934c61f5fde45bbfd4b60acb746ad` |
| `multi-source/gitbook-search-results.ts` | `3c0f8d12aae578987fd4e2162cc6c28bf9ef39a8bd29d5427fca9f7a56087fe3` | `3c0f8d12aae578987fd4e2162cc6c28bf9ef39a8bd29d5427fca9f7a56087fe3` |
| `multi-source/source-candidates.ts` | `073ef8659ef58f88c498253447639fcd40d9508f027ba2cf8e75433923281282` | `073ef8659ef58f88c498253447639fcd40d9508f027ba2cf8e75433923281282` |
| `multi-source/relevance.ts` | `9af7447eac44a31f9310ce665b1420e92231ec2aeb6ed43b50c0aa434ccee0bc` | `9af7447eac44a31f9310ce665b1420e92231ec2aeb6ed43b50c0aa434ccee0bc` |
| `multi-source/intent-orchestration.excerpt.ts` | `5cc35973726a1efe5fde0054b6b5d6c1d17d9b3e9d37c376bdbc72b22d9a07b5` | `96a789a8f1a95c60a984d04bde6aabd3952275f79423b7ca281d086b08da5d42` |
| `local-knowledge/manifest.ts` | `cec89c673310a6e308cec4ab77001006641407c767ff4ad73531c99c6362f034` | `cec89c673310a6e308cec4ab77001006641407c767ff4ad73531c99c6362f034` |
| `local-knowledge/search.ts` | `e07a61b8fef8ecb3a2beed38c92a2f6c610c829a83df074875f893c16ba052f9` | `e07a61b8fef8ecb3a2beed38c92a2f6c610c829a83df074875f893c16ba052f9` |
| `local-knowledge/intent-orchestration.excerpt.ts` | `ceec91ca7af9e2229e167361d303b4f202e5721bc81c489904012541942de186` | `a7919d04f415d8da78d8e0cdb5ee737942b508b72475eff464b7a32817ae0409` |
| `verification/gitbook-mcp-source.test.ts` | `0d44e4dc6d03aafadf0258d710bfeb2ef0b1cef664c17e732e37270816898cbb` | `0d44e4dc6d03aafadf0258d710bfeb2ef0b1cef664c17e732e37270816898cbb` |
| `verification/source-candidates.test.ts` | `d712774bbd6c9e2043f195f84e5bd398c3355edaa906a8f71d34dc07bc287075` | `d712774bbd6c9e2043f195f84e5bd398c3355edaa906a8f71d34dc07bc287075` |
| `verification/local-query-search.excerpt.test.ts` | `4e3a715b5c852a03f897305c5c4d017d40d88d303f3b72b5279adec3456785d0` | `0c351e821cf2c253a49351d2747a0c6c98d1d3ce27505fb15f4ef48a6abbbabb` |
| `local-knowledge/approved-sources.sample.json` | `e350834f62a54a0578459651edf8cc05c5360aaa415975262f661991ee060e09` | `457c5e9888b4725004a0ac7ad4b5c7781e8d269a3875576a9f7749f192c7f125` |

</details>

### Publication checks

All ten whole-file Excerpts were compared byte-for-byte and by SHA-256 with their Git objects; all source ranges in the four partial Excerpts were compared with the originals. The reconstructed JSON version and both entries match the source manifest. All 14 TypeScript files passed syntax parsing. These checks are distinct from executing the historical contract tests or live retrieval/embedding verification.

English and Korean events, dates, numbers, conditions, source mappings, and code links were compared. README → case heading → code-line links were checked for files, anchors, and range bounds. All 12 code files from the first case and its body outside the shared-evidence move were preserved. Public files were reviewed for credential values, private repository URLs, local user paths, and original document contents.

## 03 — Introducing, Evaluating, and Retiring Cohere

**Development period:** 2026-09-28 ~ 2026-10-17

**Code classification:** 19 Excerpts and two Reconstructed JSON records.

**Outcome:** Cohere expanded from an embedding fallback into a generation and classifier evaluation target. The developer ultimately chose a Gemini-only embedding path and Gemini→Groq generation, weighing observed benefits against Synethos’s scale, available alternatives, and operating cost.

### Development sequence

The sequence below separates committed configurations, local runtime changes, and experimental observations. Event times and commit times are recorded separately; times are KST unless marked UTC.

| Date / commit | Development event |
|---|---|
| September 28, 14:50:04 · `5f71fbe` | Introduced Cohere embedding after Gemini, with separate targets and compatible indexes. |
| September 28, 23:59:41 · `dadffe3` | Added provider-owned document batching. |
| September 29, 10:37:00 · `5615b4c` | Added bounded retry for the current failed HTTP 429 document batch. |
| September 29, 17:46:25 · `1c0f28e` | Selected Cohere-only runtime embedding while retaining Gemini in the build target registry. |
| September 30, 18:15:43 · `b00bf59` | Added Command A+ and shared-evidence generation comparisons. |
| October 1, reports at 13:47, 16:43, and 17:04 | Compared question-subject retention and tested local Cohere-only generation. The routing changes were excluded from the 17:32 Git scope. |
| October 2, 02:37:05 · `180cc30` | Configured Gemini→Cohere for both embedding and generation. |
| October 3, 07:42:12 · `0baebd9` | Changed generation fallback to Groq; Cohere generation remained available for explicit evaluation. |
| October 6, 16:05:37.753–16:05:47.618 | Ran the Cohere classifier experiment; the gate stopped subsequent retrieval/generation. A 19:17 handoff retained Cohere as a fallback/evaluation asset. |
| October 15, 21:22–21:24 · execution HEAD `927415e` | Compared Gemini and Cohere retrieval on the same current corpus and question bank. |
| October 16, decision at 21:02:47; commit at 21:32:34 · `e700717` | Selected complete retirement and removed Cohere integration. |
| October 17, success report at 22:19:07; commit at 22:20:44 · `033e02f` | Recorded a successful current Gemini rebuild, published its artifact, and removed retired indexes. |

### Introducing an alternative embedding space

The September 28 development report records an earlier Gemini document build reaching its daily quota after 50 successful chunk embeddings. The developer introduced `embed-v4.0` at 1536 dimensions after Gemini’s `gemini-embedding-2` at 768 dimensions. The original conversations establishing the complete priority of introduction motives remain incomplete.

The [initial HTTP client](../cases/cohere-lifecycle/embedding/initial/client.ts#L22-L54) sends native `fetch` requests to `/v2/embed`, asking for float vectors with the target’s output dimension. The [initial adapter](../cases/cohere-lifecycle/embedding/initial/embedding.ts#L19-L45) uses `search_query` for a question and `search_document` for title-plus-content document inputs, and validates returned vector counts. Each target requires an index in its own embedding space.

The [fallback loop](../cases/cohere-lifecycle/embedding/initial/target-fallback.ts#L23-L44) evaluates index reachability and credentials, tries targets in order, and advances on classified fallbackable provider failures. A current-index credential blocker stops the operation. The [synthetic fallback tests](../cases/cohere-lifecycle/embedding/initial/target-fallback.test.ts#L20-L42) express both paths.

The later [batching adapter](../cases/cohere-lifecycle/embedding/batched/embedding.ts#L9-L51) declares preferred/maximum document batches of 96; its [tests](../cases/cohere-lifecycle/embedding/batched/embedding.test.ts#L9-L39) verify multilingual document ordering and rejection of 97-input requests. The pre-retirement [HTTP failure tests](../cases/cohere-lifecycle/embedding/pre-retirement/client.test.ts#L26-L53) preserve an unannotated 429 as neutral and fallbackable and normalize Retry-After. These files retain their separate source dates.

Build reports describe distinct runs: one historical build sent three successful 32-document Gemini requests before the fourth failed with insufficient retained diagnostics, while Cohere completed six requests and produced a then-current cache artifact. A separate September 29 attempt on 525 chunks completed five Cohere batches and received HTTP 429 on batch 6/6; the incomplete target was not published. The `5615b4c` report records mocked validation of the new bounded retry policy, with live retry verification still pending.

The [Reconstructed configuration history](../cases/cohere-lifecycle/configuration/target-history.json#L1-L227) preserves selected generation/embedding fields from five committed example configurations. `1c0f28e` selected only Cohere for runtime embedding; `180cc30` later selected Gemini then Cohere. The reason for the initial Cohere-only switch remains unconfirmed.

### Extending evaluation to generation

On September 30, `b00bf59` added `command-a-plus-05-2026` to the generation registry. The [generation client](../cases/cohere-lifecycle/generation/generation-client.ts#L7-L35) classifies HTTP, transport, and timeout failures. The [generation adapter](../cases/cohere-lifecycle/generation/generation.ts#L6-L26) translates the shared system/user prompt and response schema to `/v2/chat`, forwards supported options, requires a COMPLETE finish, and joins returned text blocks. The [contract tests](../cases/cohere-lifecycle/generation/generation.test.ts#L12-L63) cover option translation, usage metadata, incomplete outputs, and normalized errors. The published test snapshot uses the September 30 output limit of 1200; the later October 2 configuration records 32768.

The [shared-evidence comparison](../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.ts#L45-L90) validates a saved retrieval snapshot, clones its evidence for each target, and records snapshot, prompt, evidence, and citation-order identities. Each explicit target gets its own result with retryPolicy `none`; response-shape and citation validation are recorded alongside pending claim review. The [selected tests](../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.test.ts#L27-L77) cover identical input, snapshot reuse, one-target failure, citation validation, and credential isolation.

### October 1: question subject and record speaker

A common prompt contained `Describe yourself as Synethos`, while retrieved records included first-person writing by Riu Salze. The developer investigated how the answering identity, the question’s subject, and the record’s actual speaker interacted. The retained session records several prompt revisions using fixed retrieval contexts.

| Report time | Conditions and reported result |
|---|---|
| 13:47:45.250 | Five questions × four combinations × three repetitions: 60 planned, 59 responses and one Gemini generation 429. |
| 16:43:18.624 | Two fixed contexts × two generation providers × eight questions × three repetitions: 96 calls. Subject retention was Cohere 48/48 and Gemini 42/48. |
| Follow-up in that report | Twelve additional checks of the problematic career question after wording revision. Across these two stages: Cohere 54/54 and Gemini 42/54 subject retention. |
| 17:04:10.538 | Local Cohere-only generation, two contexts × ten questions × three repetitions: 60 HTTP 200 responses. Subject changes and speaker confusion: zero observed. Name-format violations: 22/60; semantic citation omissions and grounding errors remained. New embedding and Gemini generation calls: zero. |

These figures are reported subject-retention and output-quality observations from their own prompt revisions. The session says the 60-response run created no result files, so response-level independent review is unavailable. At 17:13:29 the routing remained uncommitted, and the 17:32:44 Git declaration excluded its four files. `496e95e` committed the question-target simplification at 17:34:31. The local routing observation and that committed prompt change retain separate scopes.

### October 3: fixed-input generation results and fallback selection

The integrated research records a fresh three-way comparison with the same saved evidence, question, prompt, and schema for each model: 40 responses per model and 120 successful requests in total.

| Model | Fully correct | Grounding failures | Contract failures | Mean generation latency |
|---|---:|---:|---:|---:|
| Gemini 3.5 Flash Lite | 27/40 | 0 | 1 | 1.508s |
| Cohere Command A+ | 22/40 | 3 | 4 | 3.042s |
| Groq GPT-OSS 120B | 25/40 | 2 | 0 | 1.524s |

The original full40 directory and report were recovered on the home PC, and the registered report hash matched. All 120 requests, responses, results, and manual reviews were cross-checked and the table recalculated. Gemini and Cohere used output caps of 32768; GPT-OSS used strict JSON Schema and a 4096 cap, omitting reasoning_effort to use the recorded medium default. The [original-result projection](../cases/model-selection-quality-availability/evidence/october03-reported-results.json) preserves per-case identities, options, verification, and historical ratings. The committed 0baebd9 runtime uses Gemini generation primary and Groq GPT-OSS fallback, with Cohere retained for explicit evaluation. October 1 subject retention, this full40 assessment, and the later retrieval diagnostic retain their own measures and conditions.

### October 6: a classifier gate stopped expansion

The Cohere experiment sent 20 questions once each to `command-a-plus-05-2026`, using only the question as input. Eighteen had fixed expected labels and two were exploratory. Requests used a two-field enum/boolean schema, a 512-token output cap, temperature 0, thinking disabled, and single dispatches with retry and provider fallback disabled. The artifact timestamps are 2026-10-06T07:05:37.753Z–07:05:47.618Z.

The [classifier contract](../cases/cohere-lifecycle/evaluation/classifier-contract.excerpt.ts#L3-L22) requires exactly `intent` and `requiresCompleteSet`. Its [gate](../cases/cohere-lifecycle/evaluation/classifier-contract.excerpt.ts#L24-L43) requires intent ≥17/18, complete-set 18/18, essential L1/A1/A6 correctness, zero lookup/aggregate swaps, compare/synthesis ≥6/7, JSON 20/20, and zero API failures. The [Reconstructed observation record](../cases/cohere-lifecycle/evidence/observed-results.json#L3-L69) preserves the saved summary and call counts.

| Observation | Cohere result |
|---|---:|
| HTTP 200 / API failures | 20/20 · 0 |
| Valid single JSON | 17/20 |
| Intent / complete-set | 13/18 · 14/18 |
| Compare/synthesis | 5/7 |
| Successful classifier response latency median | 409ms |
| Follow-up embedding / answer-generation calls | 0 / 0 |

L2/L3/S4 contained explanatory text or duplicated JSON and failed strict parsing. S1 was classified as compare; A4 as lookup/false. Raw provider blocks were not saved, leaving the contribution of model output versus adapter text-block handling unconfirmed. The gate failed and the planned dynamic retrieval and two answer-generation calls were skipped.

The broader comparison retained in the research records Groq and Gemini 3.1 at 18/18 intent, 18/18 complete-set, and 20/20 JSON, with successful-response latency medians of 927ms and 2327ms. Their first runs stopped after 16 and 15 successes on 429; subsequent runs reused those successes and completed only the remaining questions. A 19:17:35 handoff recorded the developer’s decision to retain Cohere for fallback/evaluation. The precise scope of a separate “no additional cost” statement remains unconfirmed.

### October 15: retrieval retained measurable advantages

The retrieval diagnostic ran once per target at HEAD `927415e`: 27 sources, 372 chunks, question-bank content version 2, profile full-40 version 1, and both indexes CURRENT. Execution order was Gemini then Cohere, 40 questions and 52 query embeddings per target. Recall uses 32 supported questions with 41 evidence groups; the eight unsupported questions are outside its positive-recall denominator.

| Metric | Gemini 768 | Cohere 1536 |
|---|---:|---:|
| Original macro recall@5 | 85.94% | 89.06% |
| Merged macro recall@5 | 90.63% | 90.63% |
| Merged macro recall@10 | 92.19% | 95.31% |
| Merged group hits @5 | 35/41 | 36/41 |
| Merged group hits @10 | 36/41 | 38/41 |
| Questions satisfying all groups @10 | 27/32 | 29/32 |
| Total diagnostic wall time | 28.27s | 20.64s |

Cohere covered two additional groups and fully satisfied two additional questions at @10 in this run. Both targets still missed designated groups for QB11/QB26/QB39 at @10; the missing groups existed in the full rankings below the cutoff. The diagnostic used direct server-side retrieval, with classifier, generation, and HTTP outside the execution path.

The [evidence-rank calculation](../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L151-L167) evaluates OR alternatives and requires every member of an AND alternative, using its worst rank. [Case evaluation](../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L236-L281) records original and merged ranks; the [diagnostic runner](../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L302-L325) checks corpus/index identity and fixes one target. [Metric tests](../cases/cohere-lifecycle/evaluation/retrieval-evaluate.test.ts#L107-L161) cover unsupported cases, AND/OR matching, and separation of selected evidence from diagnostic coverage. The [Reconstructed retrieval summary](../cases/cohere-lifecycle/evidence/observed-results.json#L70-L137) recalculates aggregates from the preserved ranks and retains question-bank/profile identities.

### Retirement decision: benefit relative to scale and operating cost

**Recorded historical decision, October 16 at 21:02:47.996:** the original developer message in the recovered home-PC archive recognized Cohere’s retrieval quality and build speed/convenience while prioritizing free production operation. It specified the then-understood Trial-key production restrictions and paid Production-key requirement, and the need for same-space Cohere query embeddings even with a prebuilt index. The developer asked whether the recent quality difference justified cost and management complexity at Synethos’s scale, comparing development/evaluation-only retention with complete removal, and selected complete removal. The original archive hash matched the existing register; the [recovered-source register](evidence/recovered-source-register.json) separates message locations for the developer decision and agent review/completion reports.

**Developer clarification during publication preparation, October 29, 2026:** the developer explicitly stated that Cohere outperformed Gemini in some evaluations, but the observed difference at Synethos’s scale was too small to justify payment. The developer would have considered paid adoption if the performance advantage had been much larger or the service larger and more complex. The final judgment weighed the actual performance difference, service scale, substitutability, and operating cost together.

Complete removal reduced credential, adapter, separate-index, evaluation-matrix, and test maintenance. It also gave up live embedding fallback, faster development indexing, and direct reruns of the retained Cohere comparison paths. The performance observations above remain part of that tradeoff. The records contain no measured billing total or numerical cost/benefit threshold.

### Removal implementation and index handover

Commit `e700717` removed the Cohere HTTP clients/adapters and tests, factory registrations, provider options, configuration/example bindings, and current evaluation choices. The clients used native `fetch`. The [remaining embedding factory](../cases/cohere-lifecycle/after-removal/embedding-provider-factory.ts#L12-L24) supports Gemini; the [generation factory](../cases/cohere-lifecycle/after-removal/generation-provider-factory.ts#L17-L33) supports Gemini and Groq. [Option validation](../cases/cohere-lifecycle/after-removal/target-options.ts#L4-L25) and the [selected configuration tests](../cases/cohere-lifecycle/after-removal/runtime-selection.excerpt.test.ts#L22-L67) show the retained provider boundary and runtime selection.

Provider abstraction, historical comparison artifacts, common document-build progress logs, and Gemini-specific 22-second request-start pacing remained. Pacing addressed the separate document-build quota problem under investigation that evening. The recorded removal-completion report at 21:19:53.762 lists 939 passing tests, four existing skips, and successful static checks/build; the knowledge change left the Gemini index stale. The developer requested code first, excluding indexes, at 21:29:36.316.

On October 17 at 22:19:07.357 the developer reported a successful rebuild and CURRENT status. Commit `033e02f` at 22:20:44 added the new Gemini artifact and removed the old Gemini and retired Cohere artifacts. This separates code integration, index rebuild reporting, and artifact publication. Post-removal production behavior remains outside the independently verified evidence for this case.

### Verification scope and remaining questions

The October 1 quality results are contemporaneous reports in a directly inspected session. Original October 3 generation artifacts and October 6 classifier/October 15 retrieval files were directly compared. The original October 16/17 session was read for the removal decision, agent completion report, and developer CURRENT observation. Execution results retain each historical report’s conditions. The October 29 rationale is the developer’s later clarification in this publication task.

Remaining questions are the full introduction/Cohere-only-switch motives, the scope of the October 6 cost statement, independent historical key/terms evidence, the classifier output/block-handling cause, build-attempt ledgers, and post-removal production verification. No model request, index build, or historical application test was executed for this publication.

### Source traceability and publication form

Fifteen whole-file Excerpts preserve source bytes. Four partial Excerpts join the listed original declarations/test statements with blank lines; names, imports, and selected statements remain unchanged. The tests retain synthetic credentials and fixtures, plus references to omitted application modules. The classifier excerpt preserves the schema/parser/gate and references its original harness state. These selections are published for code reading. The local harness excerpt normalizes CRLF line endings to LF.

The two Reconstructed JSON files use new editorial envelopes. `target-history.json` copies complete generation/embedding fields from the identified example configurations. `observed-results.json` selects the saved classifier summary/counters and derives retrieval aggregates from original/final evidence ranks. Added generationOctober03 links the recovered full40 aggregates/options/verification; retirementOctober16 selects the original-session developer decision, completion report, and next-day CURRENT report. Raw private records, full experimental responses, credentials, index vectors, and local user paths remain outside the published files.

#### Source commits

| Commit | Commit time KST | Change |
|---|---|---|
| `5f71fbece8a7d7caa28d01d655d8b02d614472cf` | 2026-09-28 14:50:04 | feat: localize knowledge retrieval with embedding fallback |
| `dadffe361c617c9db9840696b615b7cc3a0e8fcd` | 2026-09-28 23:59:41 | feat(embedding): batch document embeddings |
| `5615b4ca89e24204a3bf25ea4ab2eaa333872c73` | 2026-09-29 10:37:00 | feat(embedding): retry rate-limited document batches |
| `cb0055eb71203e3e77249a9abfcc002c4e4a963f` | 2026-09-29 11:04:53 | feat(embedding): activate Gemini and publish Cohere index |
| `1c0f28e58c6499f1bd107b9767ef9801e59f56e5` | 2026-09-29 17:46:25 | feat(embedding): use Cohere-only runtime and add calibration baseline |
| `b00bf595439bd71540ace4e34d6f56a803eb5719` | 2026-09-30 18:15:43 | feat(generation): add target registry and shared-evidence evaluation |
| `496e95ed2a161f30b6dbedc21f1011d95e208740` | 2026-10-01 17:34:31 | fix(generation): simplify question target resolution |
| `180cc306fafc191a21ea4f6886b48c0d1913b882` | 2026-10-02 02:37:05 | chore(models): finalize independent primary and fallback targets |
| `0baebd9f242d88ffa15ef1953204c391ae97e623` | 2026-10-03 07:42:12 | feat(generation): replace Cohere fallback with Groq GPT-OSS |
| `927415ea2b64472c5afa492adc5c85525342f632` | 2026-10-15 21:16:49 | feat(eval): add retrieval diagnostic run command |
| `c2efdace71eca66f28ac133826ea3c3976377445` | 2026-10-16 20:15:46 | docs(knowledge): clarify validation emphasis and add public personal facts |
| `e7007172cc7a5171948659c4f1ceb6fd65dd1332` | 2026-10-16 21:32:34 | refactor: remove Cohere support and add document build pacing and logs |
| `033e02fabe868a14cd8a4a932b50fbdba9a064fa` | 2026-10-17 22:20:44 | chore(index): refresh Gemini artifact and remove retired indexes |

#### Code correspondence

Original paths are relative to the private repository. Ranges are inclusive and read `original → public`. The local harness is identified by its source-file hash.

| Public file | Source snapshot · path | Classification · ranges |
|---|---|---|
| [embedding/initial/client.ts](../cases/cohere-lifecycle/embedding/initial/client.ts#L1-L54) | `5f71fbe` · `sveltekit/src/lib/server/providers/cohere/client.ts` | Excerpt (whole) · 1–54 → 1–54 |
| [embedding/initial/embedding.ts](../cases/cohere-lifecycle/embedding/initial/embedding.ts#L1-L46) | `5f71fbe` · `sveltekit/src/lib/server/providers/cohere/embedding.ts` | Excerpt (whole) · 1–46 → 1–46 |
| [embedding/initial/target-fallback.ts](../cases/cohere-lifecycle/embedding/initial/target-fallback.ts#L1-L44) | `5f71fbe` · `sveltekit/src/lib/server/embedding/target-fallback.ts` | Excerpt (whole) · 1–44 → 1–44 |
| [embedding/initial/target-fallback.test.ts](../cases/cohere-lifecycle/embedding/initial/target-fallback.test.ts#L1-L43) | `5f71fbe` · `sveltekit/src/lib/server/embedding/target-fallback.test.ts` | Excerpt (whole) · 1–43 → 1–43 |
| [embedding/batched/embedding.ts](../cases/cohere-lifecycle/embedding/batched/embedding.ts#L1-L51) | `dadffe3` · `sveltekit/src/lib/server/providers/cohere/embedding.ts` | Excerpt (whole) · 1–51 → 1–51 |
| [embedding/batched/embedding.test.ts](../cases/cohere-lifecycle/embedding/batched/embedding.test.ts#L1-L40) | `dadffe3` · `sveltekit/src/lib/server/providers/cohere/embedding.test.ts` | Excerpt (whole) · 1–40 → 1–40 |
| [embedding/pre-retirement/client.test.ts](../cases/cohere-lifecycle/embedding/pre-retirement/client.test.ts#L1-L54) | `c2efdac` · `sveltekit/src/lib/server/providers/cohere/client.test.ts` | Excerpt (whole) · 1–54 → 1–54 |
| [generation/generation-client.ts](../cases/cohere-lifecycle/generation/generation-client.ts#L1-L35) | `b00bf59` · `sveltekit/src/lib/server/providers/cohere/generation-client.ts` | Excerpt (whole) · 1–35 → 1–35 |
| [generation/generation.ts](../cases/cohere-lifecycle/generation/generation.ts#L1-L26) | `b00bf59` · `sveltekit/src/lib/server/providers/cohere/generation.ts` | Excerpt (whole) · 1–26 → 1–26 |
| [generation/generation.test.ts](../cases/cohere-lifecycle/generation/generation.test.ts#L1-L63) | `b00bf59` · `sveltekit/src/lib/server/providers/cohere/generation.test.ts` | Excerpt (whole) · 1–63 → 1–63 |
| [evaluation/shared-evidence.excerpt.ts](../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.ts#L1-L90) | `b00bf59` · `sveltekit/src/lib/server/retrieval/evaluation/run.ts` | Excerpt · 1–13 → 1–13; 15–31 → 15–31; 44–54 → 33–43; 56–101 → 45–90 |
| [evaluation/shared-evidence.excerpt.test.ts](../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.test.ts#L1-L77) | `b00bf59` · `sveltekit/src/lib/server/retrieval/evaluation/run.test.ts` | Excerpt · 1–8 → 1–8; 10–11 → 10–11; 13–25 → 13–25; 58–69 → 27–38; 71–80 → 40–49; 82–91 → 51–60; 93–98 → 62–67; 100–108 → 69–77 |
| [evaluation/classifier-contract.excerpt.ts](../cases/cohere-lifecycle/evaluation/classifier-contract.excerpt.ts#L1-L43) | Retained local file · `tmp/cohere-retrieval-intent-experiment/run.ts` | Excerpt · 1–1 → 1–1; 40–40 → 3–3; 42–59 → 5–22; 143–162 → 24–43 |
| [evaluation/retrieval-evaluate.ts](../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L1-L325) | `927415e` · `sveltekit/src/lib/server/retrieval/evaluation/evaluate.ts` | Excerpt (whole) · 1–325 → 1–325 |
| [evaluation/retrieval-evaluate.test.ts](../cases/cohere-lifecycle/evaluation/retrieval-evaluate.test.ts#L1-L162) | `927415e` · `sveltekit/src/lib/server/retrieval/evaluation/evaluate.test.ts` | Excerpt (whole) · 1–162 → 1–162 |
| [after-removal/embedding-provider-factory.ts](../cases/cohere-lifecycle/after-removal/embedding-provider-factory.ts#L1-L24) | `e700717` · `sveltekit/src/lib/server/embedding/provider-factory.ts` | Excerpt (whole) · 1–24 → 1–24 |
| [after-removal/generation-provider-factory.ts](../cases/cohere-lifecycle/after-removal/generation-provider-factory.ts#L1-L33) | `e700717` · `sveltekit/src/lib/server/generation/provider-factory.ts` | Excerpt (whole) · 1–33 → 1–33 |
| [after-removal/target-options.ts](../cases/cohere-lifecycle/after-removal/target-options.ts#L1-L25) | `e700717` · `sveltekit/src/lib/server/generation/target-options.ts` | Excerpt (whole) · 1–25 → 1–25 |
| [after-removal/runtime-selection.excerpt.test.ts](../cases/cohere-lifecycle/after-removal/runtime-selection.excerpt.test.ts#L1-L67) | `e700717` · `sveltekit/src/lib/server/config.test.ts` | Excerpt · 1–12 → 1–12; 15–15 → 14–14; 17–21 → 16–20; 40–59 → 22–41; 62–65 → 43–46; 67–73 → 48–54; 76–87 → 56–67 |
| [configuration/target-history.json](../cases/cohere-lifecycle/configuration/target-history.json#L1-L227) | Inputs specified in the assembly rules below | Reconstructed · Selection / new envelope |
| [evidence/observed-results.json](../cases/cohere-lifecycle/evidence/observed-results.json#L1-L224) | Inputs specified in the assembly rules below | Reconstructed · Selection / new envelope |

#### Reconstruction rules

- `configuration/target-history.json`: ordered stages are initial-fallback, cohere-only-embedding, independent-primary-fallback, groq-generation-fallback, and cohere-removed. Each source contributes its entire generation and embedding objects; stage, sourceCommit, and classification are editorial fields.
- `evidence/observed-results.json`: selects classifier start/end, model, summary, call counters, skip reason, and retry/fallback fields. Retrieval copies embedding/retrieval/questionBank/profile identities and calculates macro recall as the mean group-hit fraction across supported questions. Group hits are totals; completeCases counts questions with every group within the cutoff. JSON retains full precision; narrative percentages are rounded to two decimal places.

| Reconstruction · input | Source commit / identity | Source SHA-256 |
|---|---|---|
| `configuration/target-history.json` · `config/mosaic.example.json` | `5f71fbece8a7d7caa28d01d655d8b02d614472cf` | `1cc124c5c25098d7461b43870d6fc7c051d5ffd3fda47d942bb3e2c3d9520fc3` |
| `configuration/target-history.json` · `config/mosaic.example.json` | `1c0f28e58c6499f1bd107b9767ef9801e59f56e5` | `f96298d785ddfd25ef905d4e6919581a933eef52683120f7a143348b3ba9cb2b` |
| `configuration/target-history.json` · `config/mosaic.example.json` | `180cc306fafc191a21ea4f6886b48c0d1913b882` | `637b4dbb6c73ef341e549dd44d0b2338dfe7bee938797bb0a6a666b54a08e63c` |
| `configuration/target-history.json` · `config/mosaic.example.json` | `0baebd9f242d88ffa15ef1953204c391ae97e623` | `6184230713d6717c9c702f39b75f4de77b7a90f1e81654922e59dc3210fb6b27` |
| `configuration/target-history.json` · `config/mosaic.example.json` | `e7007172cc7a5171948659c4f1ceb6fd65dd1332` | `fade19dc3b7d4080c23a66518e4716b9419f6af70e377e573958216bf65dee20` |
| `evidence/observed-results.json` · `tmp/cohere-retrieval-intent-experiment/results.json` | Retained file | `ac60cd7bfd1514b9fcc0659b04b3cea18732eb3e3b3ab745a38101fca7bd470c` |
| `evidence/observed-results.json` · `docs/evaluation/retrieval/2026-10-15/gemini.json` | Retained file | `f40fc07305a3b8542f6e82b34e494d139a85963a8c5f08490a5a0f3bda1ca85c` |
| `evidence/observed-results.json` · `docs/evaluation/retrieval/2026-10-15/cohere.json` | Retained file | `2eb76f90c94d3092b2246e4e6bac342ab738f73dde284aa800cd4e3e50adc801` |
| `evidence/observed-results.json` · recovered full40 and retirement session | [Recovered-source register](evidence/recovered-source-register.json), HOME06-3WAY and HOME03-04-SESSION | Original report/archive hashes verified 2026-10-29; historical ratings and report scope retained. |

#### Non-code evidence and availability

Hashes below were computed from source bytes for this publication except where explicitly marked as previously recorded. The baseline HEAD for the existing research files is `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218`.

| Record | Snapshot / SHA-256 |
|---|---|
| `docs/development-status.md` | `5f71fbece8a7d7caa28d01d655d8b02d614472cf`; `cd391e419000613362ac2c09cc48db13304dee65cfecad3cdd50b0bfc03423d5` |
| `docs/development-status.md` | `dadffe361c617c9db9840696b615b7cc3a0e8fcd`; `76bd9837403684e0d0137da558d7c438a020fab212588d046b81eb359f51a1c1` |
| `docs/development-status.md` | `5615b4ca89e24204a3bf25ea4ab2eaa333872c73`; `8b7ab55609094b52027b08b431d286741dfc8e4ae74cacde851b24ca088bacdd` |
| `docs/development-status.md` | `cb0055eb71203e3e77249a9abfcc002c4e4a963f`; `30355f951b74bd3a660b0a5a11230a89796f95ab6150b961a07a0838ded8ed9a` |
| `docs/development-status.md` | `e7007172cc7a5171948659c4f1ceb6fd65dd1332`; `b557e0b331e1e7a6b3eec2d16e220ccaf2a2dadb28b4891eb3920ed7aa724cf5` |
| `docs/research/synethos-development-history.md` | `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218`; `31c98a7c6b2fe222ca9b116130a857c316008b8cb79550425aba50e491ebd2a3` |
| `docs/research/synethos-evidence-register.md` | `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218`; `6f173ba83687e68daaa115623404e159af8efa37fc454c0e42559e761303bdf7` |
| `docs/research/decision-candidates.md` | `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218`; `6a1a2b0c4ab1dc25ee94a253f96c987d9d6d8ec6cf80d2f075b2be77fa1b06cc` |
| `docs/evaluation/retrieval/2026-10-15/report.md` | `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218`; `4e6b3d26dd1d327b1c8cea36d6150934cd2a1a20aa07fc60b1678d2279691315` |
| `tmp/cohere-retrieval-intent-experiment/report.md` | `3a25e4e7d35739be14f1fcbaef2cb2b7cbc1d79bb9067d5f78b37f214642cab3` |
| `tmp/cohere-retrieval-intent-experiment/run.ts` | `3ca9d09dc962c3ff7ceb0ca8cee72ec1a007a59552a5c34bff4149a34355d605` |
| `tmp/cohere-retrieval-intent-experiment/results.json` | `ac60cd7bfd1514b9fcc0659b04b3cea18732eb3e3b3ab745a38101fca7bd470c` |
| `docs/evaluation/retrieval/2026-10-15/gemini.json` | `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218`; `f40fc07305a3b8542f6e82b34e494d139a85963a8c5f08490a5a0f3bda1ca85c` |
| `docs/evaluation/retrieval/2026-10-15/cohere.json` | `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218`; `2eb76f90c94d3092b2246e4e6bac342ab738f73dde284aa800cd4e3e50adc801` |
| `rollout-2026-10-01T13-14-09-01a0f5ab-72f3-70c1-84fa-31f27c25d590.jsonl.zst` | `d181117b3c4d2f997b997bccb7c3bc8279de40abc53a50e29127a93239a0d37b` |

The originals below were recovered on the home PC and matched their registered SHA-256 values. Message locations and additional source identities are preserved in the [recovered-source register](evidence/recovered-source-register.json).

| Previously recorded original | Recorded SHA-256 · scope |
|---|---|
| `generation-model-comparison/2026-10-03-full40-3way-1/final-report.md` | `a82073631b743462c5a31051071ba994f9339b346849e29bbe171375ace7c231` · October 3 generation table |
| `rollout-2026-10-16T20-10-29-01a14468-00a5-7ff2-8053-0e588b0c1335.jsonl.zst` | `9a167a56794bb628bd58e92581435b4efcacab3568d01e83d9dbf36ad79f9b99` · Retirement decision, completion, and index separation |

Message locations: the inspected October 1 session’s UTC 04:47:45.250Z, 07:43:18.624Z, 08:04:10.538Z, 08:13:29Z, and 08:32:44Z correspond to KST 13:47:45.250, 16:43:18.624, 17:04:10.538, 17:13:29, and 17:32:44. Directly inspected retirement-session locations are October 16 UTC 12:02:47.996Z (developer decision), 12:19:53.762Z (completion report), 12:29:36.316Z (exclude indexes), and October 17 13:19:07.357Z (CURRENT report). The October 6 19:17:35.774 handoff is UTC 10:17:35.774Z and is cited through the existing research transcription.

Developer clarification: supplied directly by the developer in this publication-preparation conversation on 2026-10-29. The decision section incorporates the stated performance difference, service scale, substitutability, operating cost, and conditions under which paid adoption would be considered.

<details>
<summary>Original and public file SHA-256</summary>

Original hashes cover entire source files; public hashes cover Tessera files. Partial selection, line-ending normalization, and reconstruction are reflected in differing hashes. Reconstruction input hashes are listed above.

| Public file | Entire original file SHA-256 | Public file SHA-256 |
|---|---|---|
| `embedding/initial/client.ts` | `63c0b440209b5490bf05e7b247b1e3fa04bf9f12e3473d2d987b983bdc1708e4` | `63c0b440209b5490bf05e7b247b1e3fa04bf9f12e3473d2d987b983bdc1708e4` |
| `embedding/initial/embedding.ts` | `50e89c85d453e7f35d1302c29560b16db233a960294f14497d65761fdcf58691` | `50e89c85d453e7f35d1302c29560b16db233a960294f14497d65761fdcf58691` |
| `embedding/initial/target-fallback.ts` | `b6a7a3570e47a3f94a4deb9fc7468c304c3323d1c04113d22087665239198388` | `b6a7a3570e47a3f94a4deb9fc7468c304c3323d1c04113d22087665239198388` |
| `embedding/initial/target-fallback.test.ts` | `9a550b4f5176c47c26f3130110d19da2b249c8c31fed4fb784590c7aa9efb530` | `9a550b4f5176c47c26f3130110d19da2b249c8c31fed4fb784590c7aa9efb530` |
| `embedding/batched/embedding.ts` | `62602b8a216a2b0ecda928b1dcd948ad9f401e76edd5fb45a9d6faf155ded859` | `62602b8a216a2b0ecda928b1dcd948ad9f401e76edd5fb45a9d6faf155ded859` |
| `embedding/batched/embedding.test.ts` | `eae12d1f126c0fb8830de2b08190093d7cb7912f710de0fc19c23edb6baacbd4` | `eae12d1f126c0fb8830de2b08190093d7cb7912f710de0fc19c23edb6baacbd4` |
| `embedding/pre-retirement/client.test.ts` | `59329d3fce0498967f381d2f55ac25895ff29b6468874aa6a2c510f59c8f3242` | `59329d3fce0498967f381d2f55ac25895ff29b6468874aa6a2c510f59c8f3242` |
| `generation/generation-client.ts` | `444e2a2c1ceae8edacc2b3f909d88371cf4082c365a5d4f93b785d5f3bf98fda` | `444e2a2c1ceae8edacc2b3f909d88371cf4082c365a5d4f93b785d5f3bf98fda` |
| `generation/generation.ts` | `8074bcddf593ae98852d20ba67ec92f34e55c1cdc71086fd016e4da00ddb961a` | `8074bcddf593ae98852d20ba67ec92f34e55c1cdc71086fd016e4da00ddb961a` |
| `generation/generation.test.ts` | `65c1cf7a3b1caffa60a8a4a1b5d2dacba629a5ec04bcaa76808fffc50f9bb1e8` | `65c1cf7a3b1caffa60a8a4a1b5d2dacba629a5ec04bcaa76808fffc50f9bb1e8` |
| `evaluation/shared-evidence.excerpt.ts` | `08ca123bfa0db961f116a8421e898c06a76619a8059a2d2409de317fca8f7a47` | `a735b41310d67b74ca390dc7d99c8ac30a578bd34cd1124cb1c281df82609fb5` |
| `evaluation/shared-evidence.excerpt.test.ts` | `96928b231c8b08d767cf59d1f6fbdb0b5316f5d0bb1ad099edcac6b90504066b` | `e8ac4055a5e2a2ad4775b4284c510fc55deaba51340beaf3e6aeec34d45eab5f` |
| `evaluation/classifier-contract.excerpt.ts` | `3ca9d09dc962c3ff7ceb0ca8cee72ec1a007a59552a5c34bff4149a34355d605` | `79c08ff2a7040c0f4c8899a330e81d1070a8ce38d434604d46c2cf800227e2c5` |
| `evaluation/retrieval-evaluate.ts` | `f02b98990eca8ebd1ce339f815b21e6f485c869e0ee18f279380cad273ff5d1f` | `f02b98990eca8ebd1ce339f815b21e6f485c869e0ee18f279380cad273ff5d1f` |
| `evaluation/retrieval-evaluate.test.ts` | `a78e77981697624e1a17a5924b4aa53c199986964ae13670c8f5adc730499f1f` | `a78e77981697624e1a17a5924b4aa53c199986964ae13670c8f5adc730499f1f` |
| `after-removal/embedding-provider-factory.ts` | `935e72cab7b41ce064e26c9b0dc20ec23a2636e185c1e10b0c00974a02ff0c46` | `935e72cab7b41ce064e26c9b0dc20ec23a2636e185c1e10b0c00974a02ff0c46` |
| `after-removal/generation-provider-factory.ts` | `9fb874cb5f32eb8673c355e634fa571ed26c9a0b418b5df146a88dbdb7cbfd0f` | `9fb874cb5f32eb8673c355e634fa571ed26c9a0b418b5df146a88dbdb7cbfd0f` |
| `after-removal/target-options.ts` | `a50ca17941224e1da6854283a2269feabe3509a0f96020f86dfaebdbeab42a3b` | `a50ca17941224e1da6854283a2269feabe3509a0f96020f86dfaebdbeab42a3b` |
| `after-removal/runtime-selection.excerpt.test.ts` | `9fa7424e052d1c60b19dbdc5fecfb1ad2cc898539475f461c0ccb43f8b078a31` | `777fd0be16eed54245d7e6eadbb2d0a363e96fb6495dcd3fed6ec8c22c80e709` |
| `configuration/target-history.json` | See input table | `3dc01f1d86c74fc0e59d49ae8afb46562b064d1e1b36c108d9cf7e3e834ca5fe` |
| `evidence/observed-results.json` | See input table | `6b8b177f791e5a01a99ede6109fded3927cb29aed5c3d1820a89e44be2d11933` |

</details>

### Publication checks

The 15 whole-file Excerpts passed byte-for-byte and SHA-256 comparison with their Git objects. All source ranges in the four partial Excerpts matched the retained originals, with the local harness’s documented LF normalization. All 19 TypeScript files passed syntax parsing. The two JSON reconstructions passed syntax, configuration-field comparison, classifier counter/median checks, and retrieval aggregate checks against their inputs.

English/Korean facts, source mappings, and code links were compared. All 238 local documentation links across the READMEs and detailed records passed file, heading-anchor, and line-range checks. The previous two cases’ text and 27 code files were preserved. The new files were reviewed for credentials, private document content, private repository URLs, and local user paths. Historical application tests and provider calls were outside this publication verification.

## 04 — Provider Architecture and Embedding Reliability

**Development period:** 2026-09-26 ~ 2026-10-17

**Code classification:** 37 Excerpts and two Reconstructed JSON records.

**Outcome:** role-specific Provider contracts, factories, and target selection supported changes among Gemini, Cohere, and Groq. Document embedding evolved from single-chunk requests to provider-owned batches, bounded current-batch retry, and Gemini request-start pacing, with validated index publication.

### The problem and the sequence of changes

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

### Separating contracts, factories, adapters, and common behavior

The September 26 [Embedding contract](../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider.ts#L1-L21) accepts provider/model/dimensions and returns a vector. The [Generation contract](../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider.ts#L1-L40) accepts contents, system instruction, response schema, and output limit, returning content or a categorized failure. The initial [embedding factory](../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider-factory.ts#L1-L14) and [generation factory](../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider-factory.ts#L1-L14) instantiate Gemini adapters. The same commit changed index/retrieval/answer imports to common embedding and generation modules.

| Responsibility | Implementation boundary |
|---|---|
| Target definitions and runtime order | Configuration parsing and validated target IDs. |
| Credential selection and adapter construction | Binding helpers and role-specific factories. |
| Provider request/response translation | Gemini, Cohere, and Groq adapters. |
| Document splitting, vector validation, bounded retry, progress logs | Common embedding orchestration; provider batching capabilities and the Gemini pacing condition supply specific policy. |
| Prompt/evidence construction and answer validation | Common generation orchestration. |
| Index compatibility and publication | Embedding-space identity, candidate validation, and index storage. |

The September 28 [expanded embedding factory](../cases/embedding-batching-retry-pacing/architecture/embedding-provider-factory.ts#L1-L26) selects Gemini or Cohere from a target, requires that target’s bound credential, and caches adapter instances by target ID. The [evolved request contract](../cases/embedding-batching-retry-pacing/batching/provider-contract.excerpt.ts#L1-L33) distinguishes question input from title/content document input and exposes an optional batching capability.

Existing targets can be selected through configuration. Introducing a new provider requires a contract implementation, factory registration, supported-option validation, and tests. The actual additions and removals below followed those code boundaries.

### From single-document requests to provider-owned batches

The [pre-batching loop](../cases/embedding-batching-retry-pacing/before/embeddings.ts#L31-L49) sends one chunk per `embedDocuments()` call and validates its vector. The earlier Gemini build was reported to have completed 50 chunk embeddings before daily-quota HTTP 429. With the larger imported corpus, the next change bounded request payloads and failure units through batches.

The [batching implementation](../cases/embedding-batching-retry-pacing/batching/embeddings.ts#L31-L70) uses the provider’s preferred batch size, defaults to one when the capability is absent, and validates positive integer limits. The Gemini adapter declares a project preference of 32 documents. Cohere’s [published adapter](../cases/cohere-lifecycle/embedding/batched/embedding.ts#L9-L51) declares preferred/maximum 96. The common loop slices full and partial batches, validates vector count/dimensions/finite values, and appends vectors in input order.

The [batching tests](../cases/embedding-batching-retry-pacing/batching/embeddings.test.ts#L1-L98) cover ordered full/partial batches, empty input, wrong vector counts/dimensions, middle-batch failure, and the query path. Partial vectors stay within the active call until all batches succeed.

### Diagnosing failure before choosing recovery

The `19e634d` development report describes one build in which three 32-document Gemini requests succeeded and the fourth failed after its useful HTTP/provider details were discarded. That failure’s exact classification remains unconfirmed. In the same recorded run, Cohere completed six requests and produced a then-current artifact. Target-level failure isolation preserved the successful result.

The [Gemini failure normalization](../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.ts#L33-L133) parses typed RetryInfo and QuotaFailure details, preserves HTTP status and allowlisted provider/quota identifiers, and projects a retry delay. An unannotated HTTP 429/RESOURCE_EXHAUSTED stays neutral while remaining fallbackable. The [adapter tests](../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.test.ts#L1-L173) cover those shapes, safe identifiers, and ordered multi-input translation.

The later [common failure helpers](../cases/embedding-batching-retry-pacing/diagnostics/failure.ts#L1-L133) carry validated Retry-After delay and batch number/offset/size into a serializable diagnostic report. Their [tests](../cases/embedding-batching-retry-pacing/diagnostics/failure.test.ts#L1-L79) distinguish failure categories, timeout/cancellation, and safe delay forms. Raw causes remain internal to error propagation.

### Separating build targets, runtime order, and credentials

The September 29 changes first separated the build target registry from `runtimeTargetIds`, then bound credentials independently of runtime priority. The [selection functions](../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.ts#L10-L88) validate target identity, bind numbered environment targets to credential slots, and resolve runtime IDs. The [credential helpers](../cases/embedding-batching-retry-pacing/architecture/credentials.ts#L1-L29) load and require a named slot. The [selection tests](../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.test.ts#L32-L131) verify reordered runtime targets, fixed credential bindings, a synthetic third target, and rejected duplicate/incomplete bindings. This snapshot required complete consecutive numbered bindings.

By September 30, the shared [numbered binding helper](../cases/embedding-batching-retry-pacing/architecture/generation/credentials.ts#L31-L65) supported embedding and generation, including sparse numbered slots. The [generation parser](../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.ts#L36-L69) validates unique registry IDs, provider options, binding slots, and a runtime order referencing known targets. Its [tests](../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.test.ts#L46-L73) preserve registry/slot/runtime independence, multiple option profiles for a model, and optional evaluation credentials. These are successive versions of the binding design.

The [Reconstructed configuration history](../cases/embedding-batching-retry-pacing/architecture/config-selection-history.json#L1-L176) selects the generation/embedding sections at four commits, from the initial Gemini fields to a multi-target registry. Later committed runtime choices are also available in case 03’s [configuration history](../cases/cohere-lifecycle/configuration/target-history.json#L1-L227). Credential values remain local.

### Retrying the current document batch

A separate September 29 report describes a 525-chunk build: five Cohere batches succeeded, then batch 6/6 returned HTTP 429; another configured target failed at its first batch. Neither incomplete target was published. `5615b4c` introduced bounded retry in the common document orchestration.

The [retry loop and delay decision](../cases/embedding-batching-retry-pacing/retry/embeddings.ts#L69-L98) accept an `EmbeddingProviderError` marked fallbackable with HTTP 429, for up to three retries after the initial attempt. A safe explicit delay from 0 through 60000 ms takes priority. When absent, delays are 15000/30000/60000 ms; an unsafe explicit delay stops retry. Other statuses and validation failures end that operation. Earlier successful batches remain in memory while the current batch is retried.

The [selected retry tests](../cases/embedding-batching-retry-pacing/retry/embeddings.excerpt.test.ts#L37-L150) verify current-batch-only recovery, delay precedence, the four-attempt bound, final batch diagnostics, non-429/unsafe-delay rejection, and immediate query failure. The historical report describes mocked timers and HTTP responses for this policy; live retry verification was pending at that checkpoint.

### Applying the same architecture to generation replacement

The September 30 [Generation target/request contract](../cases/embedding-batching-retry-pacing/architecture/generation/provider.ts#L1-L72) adds target IDs, credential slots, target-specific options, native usage metadata, and explicit execution diagnostics. The [three-provider factory](../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.ts#L1-L36) registers Gemini, Cohere, and Groq and caches by target ID. The [factory tests](../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.test.ts#L1-L30) verify bound generation slots and stable instances across runtime-order changes.

The [common generation orchestrator](../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.ts#L1-L170) chooses configured runtime IDs or one explicit evaluation target, builds shared evidence/prompt input, calls the factory-produced adapter, and validates response shape and citations. Its September 30 runtime fallback condition was confirmed quota exhaustion. The [selected tests](../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.excerpt.test.ts#L27-L105) exercise runtime/evaluation selection and preservation of grounding validation. The later provider-failure policy evolved separately; each published snapshot keeps its original conditions.

Cohere’s [published generation adapter](../cases/cohere-lifecycle/generation/generation.ts#L6-L26) translates the shared request to its chat API. Groq’s initial model path was removed in `4125443`; `0baebd9` later added GPT-OSS as fallback and kept Cohere for evaluation. The [GPT-OSS adapter](../cases/embedding-batching-retry-pacing/architecture/groq/generation.ts#L1-L28) maps the same contract to strict JSON Schema, a completion limit, and reasoning effort. The [option validator](../cases/embedding-batching-retry-pacing/architecture/generation/target-options.ts#L1-L29) and [selected adapter tests](../cases/embedding-batching-retry-pacing/architecture/groq/generation.excerpt.test.ts#L21-L51) establish the request/response translation. This replacement changed generation configuration and adapters while leaving embedding/index implementation unchanged in that commit.

Cohere removal in `e700717` deleted its adapters/tests, factory registrations, options, configuration, and evaluation choices. The retained [embedding factory](../cases/cohere-lifecycle/after-removal/embedding-provider-factory.ts#L12-L24) and [generation factory](../cases/cohere-lifecycle/after-removal/generation-provider-factory.ts#L17-L33) show Gemini embedding and Gemini/Groq generation after removal. Common contracts and orchestration continued to carry the remaining providers.

### October 16: from reactive retry to request-start pacing

At 20:22:30.299, a developer report recorded Gemini HTTP 429/RESOURCE_EXHAUSTED at batch 9, document offset 256, size 32, with about 59 seconds of provider retry delay. The retained investigation distinguished the code’s maximum four attempts from the unavailable per-attempt ledger. At 20:27:38.961, the developer supplied AI Studio observations: RPM 160/100, TPM 35.21K/30K, and RPD 256/1K.

| Design calculation | Recorded basis and scope |
|---|---|
| Document-unit interpretation | 160=32×5 and 256=32×8 supported a document-unit accounting hypothesis. |
| RPM average | 60×32/100=19.2 seconds per batch. |
| Boundary concentration | Starts at 0/20/40/60 seconds can place four batches on a 60-second boundary; an interval above 20 seconds was considered. |
| TPM estimate | Assuming the 35.21K peak represented the same five-batch interval: 60×(35.21K/5)/30K≈14.1 seconds per batch. |
| Selected policy | Minimum 22 seconds between Gemini document-request starts, including retry attempts. |

The archived session containing these user observations and design calculations was directly read on the home PC; its original hash matched the register. Exact quota accounting, alignment of RPM/TPM peaks, batch 9 attempt count, and actual provider waits remain unconfirmed. The [recovered-source register](evidence/recovered-source-register.json) separates observation, design, and implementation-report times and sources.

### One build-local gate, common retry logging

The [final document loop](../cases/embedding-batching-retry-pacing/pacing/embeddings.ts#L37-L94) stores one `lastRequestStartedAt` per build call. Before each Gemini document attempt it waits only for the remaining interval, using `performance.now()`. The [retry loop](../cases/embedding-batching-retry-pacing/pacing/embeddings.ts#L96-L140) invokes the same gate before initial attempts and retries. Response and backoff time count toward the interval; state is shared across batches within that build invocation.

The initial proposal placed progress logging under Gemini-specific behavior. At 20:41:35.648 the developer requested provider-neutral build/retry logging while retaining Gemini-specific pacing. The final code derives the log prefix from `target.provider` and reports attempt starts, validated completion, HTTP/kind failure, pacing/retry waits, and exhaustion. Vector validation failures are reported as failed completion.

| Historical fake-timer contract | Expected provider-call start times / result |
|---|---|
| 373 chunks, batch 32 | Twelve batches at 0,22,…,242 seconds; final batch 21. |
| Response duration 5 seconds /25 seconds | Next request at 22 seconds /25 seconds. |
| Retry delay absent /2.5 seconds /59 seconds | Retry at 22 seconds /22 seconds /59 seconds, then next batch 22 seconds later. |
| Repeated 429 with fallback delays | Starts at 0,22000,52000,112000 ms; four attempts total. |
| Fixture-provider | Immediate document batches; common logs still apply. |
| Query embedding | Immediate query path with document retry/pacing/logging outside that path. |

The [logging tests](../cases/embedding-batching-retry-pacing/pacing/embeddings.excerpt.test.ts#L45-L113) cover Gemini and synthetic future providers, retry exhaustion, invalid vectors, and query logging boundaries. The [pacing tests](../cases/embedding-batching-retry-pacing/pacing/embeddings.excerpt.test.ts#L115-L248) encode the start-time expectations above. The 20:31:07.589 implementation checkpoint reported 43 related tests and static checks passing, with live build still pending; the later completion report recorded 939 passing tests and four existing skips plus successful check/build.

### Index compatibility and failure-safe publication

The [embedding-space identity](../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.ts#L15-L44) includes provider, model, dimensions, and embedding input version. The target index fingerprint also includes corpus identity. The [identity tests](../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.test.ts#L11-L79) show generation changes leaving the index identity intact, runtime IDs/credentials/priorities remaining independent, and provider/model/dimension/input/corpus changes affecting compatibility. This lets runtime selection and provider replacement use an explicit artifact contract.

The [index builder](../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.ts#L23-L87) waits for the complete vector set, checks count, assembles source/vector pairs, writes and reads the artifact, then prunes stale artifacts in that space. It records each target’s result so later targets can proceed after a failure. The [storage excerpt](../cases/embedding-batching-retry-pacing/publication/store.excerpt.ts#L16-L94) validates schema, identity, vectors, and source URLs; writes a temporary candidate; validates it; and renames it to the destination, cleaning failed candidates.

The [builder tests](../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.test.ts#L44-L120) and [storage tests](../cases/embedding-batching-retry-pacing/publication/store.excerpt.test.ts#L75-L116) preserve successful targets and older artifacts across failed candidate/write/publication validation. Current-artifact validation precedes stale cleanup. Batch retry retains earlier vectors during that active call; the historical build had no persistent batch checkpoint/resume, so a terminated build’s incomplete work was discarded.

### Completing the rebuilt artifact

The developer separated code and index commits on October 16. A user report at October 17 22:19:07.357 recorded rebuild success and CURRENT status. `033e02f` at 22:20:44 added the new Gemini artifact and removed the older Gemini/Cohere artifacts. The [Reconstructed artifact summary](../cases/embedding-batching-retry-pacing/evidence/published-index-summary.json#L1-L21) selects metadata and structural checks from that committed JSON.

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

### Verification levels and source selection

Code and commit differences, published test assertions, historical tracked development reports, and the final committed index were directly inspected. October 16/17 user observations and implementation checkpoints were directly read in the recovered archived session. Original failed/completed build ledgers remain unavailable. Arithmetic retains its historical assumptions; next-day completion is attributed to the developer’s successful-rebuild/CURRENT report.

The core embedding orchestration, Gemini adapter, and common embedding failure implementation at `e700717` match the current private HEAD for those paths. This publication reads retained records and source objects; it executes no model request, index build, or historical application test.

### Source traceability and publication form

Twenty-two whole-file Excerpts retain original bytes. Fifteen partial Excerpts retain the selected original declarations and test statements, joined with blank lines; suite wrappers and unrelated sections are omitted. Imports, names, synthetic fixtures, and references to unpublished modules remain as originally written. The generation orchestrator is included whole to preserve target dispatch through final response validation.

The two Reconstructed JSON records use editorial envelopes: one selects historical generation/embedding configuration fields; the other selects committed artifact metadata and calculates chunk/document-hash counts and vector-structure booleans. Full private records, vectors, credential values, local user paths, and raw runtime/session transcripts are excluded.

#### Source commits

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

#### Code correspondence

Original paths are relative to the private repository. Inclusive ranges read `original → public`. Inputs to the configuration and index summaries are recorded in the next table.

| Public file | Original commit · path | Classification · ranges |
|---|---|---|
| [before/embeddings.ts](../cases/embedding-batching-retry-pacing/before/embeddings.ts#L1-L49) | `5f71fbe` · `sveltekit/src/lib/server/embedding/embeddings.ts` | Excerpt (whole) · 1–49 → 1–49 |
| [batching/embeddings.ts](../cases/embedding-batching-retry-pacing/batching/embeddings.ts#L1-L70) | `dadffe3` · `sveltekit/src/lib/server/embedding/embeddings.ts` | Excerpt (whole) · 1–70 → 1–70 |
| [batching/embeddings.test.ts](../cases/embedding-batching-retry-pacing/batching/embeddings.test.ts#L1-L98) | `dadffe3` · `sveltekit/src/lib/server/embedding/embeddings.test.ts` | Excerpt (whole) · 1–98 → 1–98 |
| [batching/provider-contract.excerpt.ts](../cases/embedding-batching-retry-pacing/batching/provider-contract.excerpt.ts#L1-L33) | `dadffe3` · `sveltekit/src/lib/server/embedding/provider.ts` | Excerpt · 1–7 → 1–7; 9–12 → 9–12; 14–17 → 14–17; 19–22 → 19–22; 24–27 → 24–27; 29–33 → 29–33 |
| [diagnostics/gemini-embedding.ts](../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.ts#L1-L174) | `19e634d` · `sveltekit/src/lib/server/providers/gemini/embedding.ts` | Excerpt (whole) · 1–174 → 1–174 |
| [diagnostics/gemini-embedding.test.ts](../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.test.ts#L1-L173) | `19e634d` · `sveltekit/src/lib/server/providers/gemini/embedding.test.ts` | Excerpt (whole) · 1–173 → 1–173 |
| [diagnostics/failure.ts](../cases/embedding-batching-retry-pacing/diagnostics/failure.ts#L1-L133) | `e700717` · `sveltekit/src/lib/server/embedding/failure.ts` | Excerpt (whole) · 1–133 → 1–133 |
| [diagnostics/failure.test.ts](../cases/embedding-batching-retry-pacing/diagnostics/failure.test.ts#L1-L79) | `e700717` · `sveltekit/src/lib/server/embedding/failure.test.ts` | Excerpt (whole) · 1–79 → 1–79 |
| [retry/embeddings.ts](../cases/embedding-batching-retry-pacing/retry/embeddings.ts#L1-L116) | `5615b4c` · `sveltekit/src/lib/server/embedding/embeddings.ts` | Excerpt (whole) · 1–116 → 1–116 |
| [retry/embeddings.excerpt.test.ts](../cases/embedding-batching-retry-pacing/retry/embeddings.excerpt.test.ts#L1-L150) | `5615b4c` · `sveltekit/src/lib/server/embedding/embeddings.test.ts` | Excerpt · 1–10 → 1–10; 12–14 → 12–14; 16–25 → 16–25; 27–35 → 27–35; 130–172 → 37–79; 174–194 → 81–101; 196–217 → 103–124; 219–232 → 126–139; 245–254 → 141–150 |
| [pacing/embeddings.ts](../cases/embedding-batching-retry-pacing/pacing/embeddings.ts#L1-L158) | `e700717` · `sveltekit/src/lib/server/embedding/embeddings.ts` | Excerpt (whole) · 1–158 → 1–158 |
| [pacing/embeddings.excerpt.test.ts](../cases/embedding-batching-retry-pacing/pacing/embeddings.excerpt.test.ts#L1-L248) | `e700717` · `sveltekit/src/lib/server/embedding/embeddings.test.ts` | Excerpt · 1–11 → 1–11; 13–15 → 13–15; 17–26 → 17–26; 28–36 → 28–36; 38–39 → 38–39; 41–43 → 41–43; 46–72 → 45–71; 74–95 → 73–94; 111–118 → 96–103; 120–128 → 105–113; 352–384 → 115–147; 386–409 → 149–172; 411–441 → 174–204; 443–464 → 206–227; 466–485 → 229–248 |
| [publication/indexer.excerpt.ts](../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.ts#L1-L87) | `e700717` · `sveltekit/src/lib/server/indexing/indexer.ts` | Excerpt · 1–21 → 1–21; 76–111 → 23–58; 113–118 → 60–65; 120–140 → 67–87 |
| [publication/indexer.excerpt.test.ts](../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.test.ts#L1-L120) | `e700717` · `sveltekit/src/lib/server/indexing/indexer.test.ts` | Excerpt · 1–7 → 1–7; 9–23 → 9–23; 25–30 → 25–30; 32–42 → 32–42; 68–92 → 44–68; 126–134 → 70–78; 136–143 → 80–87; 145–153 → 89–97; 155–165 → 99–109; 167–176 → 111–120 |
| [publication/store.excerpt.ts](../cases/embedding-batching-retry-pacing/publication/store.excerpt.ts#L1-L94) | `e700717` · `sveltekit/src/lib/server/indexing/store.ts` | Excerpt · 1–14 → 1–14; 56–97 → 16–57; 99–101 → 59–61; 103–105 → 63–65; 107–121 → 67–81; 123–134 → 83–94 |
| [publication/store.excerpt.test.ts](../cases/embedding-batching-retry-pacing/publication/store.excerpt.test.ts#L1-L116) | `e700717` · `sveltekit/src/lib/server/indexing/store.test.ts` | Excerpt · 1–20 → 1–20; 22–28 → 22–28; 30–41 → 30–41; 43–44 → 43–44; 46–62 → 46–62; 64–69 → 64–69; 71–73 → 71–73; 99–105 → 75–81; 216–230 → 83–97; 232–249 → 99–116 |
| [architecture/initial/embedding/provider.ts](../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider.ts#L1-L21) | `fc509b0` · `sveltekit/src/lib/server/embedding/provider.ts` | Excerpt (whole) · 1–21 → 1–21 |
| [architecture/initial/embedding/provider-factory.ts](../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider-factory.ts#L1-L14) | `fc509b0` · `sveltekit/src/lib/server/embedding/provider-factory.ts` | Excerpt (whole) · 1–14 → 1–14 |
| [architecture/initial/generation/provider.ts](../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider.ts#L1-L40) | `fc509b0` · `sveltekit/src/lib/server/generation/provider.ts` | Excerpt (whole) · 1–40 → 1–40 |
| [architecture/initial/generation/provider-factory.ts](../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider-factory.ts#L1-L14) | `fc509b0` · `sveltekit/src/lib/server/generation/provider-factory.ts` | Excerpt (whole) · 1–14 → 1–14 |
| [architecture/embedding-provider-factory.ts](../cases/embedding-batching-retry-pacing/architecture/embedding-provider-factory.ts#L1-L26) | `5f71fbe` · `sveltekit/src/lib/server/embedding/provider-factory.ts` | Excerpt (whole) · 1–26 → 1–26 |
| [architecture/credentials.ts](../cases/embedding-batching-retry-pacing/architecture/credentials.ts#L1-L29) | `de197a5` · `sveltekit/src/lib/server/credentials.ts` | Excerpt (whole) · 1–29 → 1–29 |
| [architecture/embedding-selection.excerpt.ts](../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.ts#L1-L106) | `de197a5` · `sveltekit/src/lib/server/config.ts` | Excerpt · 1–6 → 1–6; 8–8 → 8–8; 27–55 → 10–38; 57–89 → 40–72; 91–105 → 74–88; 119–122 → 90–93; 124–129 → 95–100; 131–135 → 102–106 |
| [architecture/embedding-selection.excerpt.test.ts](../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.test.ts#L1-L131) | `de197a5` · `sveltekit/src/lib/server/config.test.ts` | Excerpt · 1–9 → 1–9; 11–14 → 11–14; 16–30 → 16–30; 47–62 → 32–47; 64–77 → 49–62; 79–99 → 64–84; 101–116 → 86–101; 118–123 → 103–108; 125–146 → 110–131 |
| [architecture/generation/provider.ts](../cases/embedding-batching-retry-pacing/architecture/generation/provider.ts#L1-L72) | `b00bf59` · `sveltekit/src/lib/server/generation/provider.ts` | Excerpt (whole) · 1–72 → 1–72 |
| [architecture/generation/provider-factory.ts](../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.ts#L1-L36) | `b00bf59` · `sveltekit/src/lib/server/generation/provider-factory.ts` | Excerpt (whole) · 1–36 → 1–36 |
| [architecture/generation/provider-factory.test.ts](../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.test.ts#L1-L30) | `b00bf59` · `sveltekit/src/lib/server/generation/provider-factory.test.ts` | Excerpt (whole) · 1–30 → 1–30 |
| [architecture/generation/credentials.ts](../cases/embedding-batching-retry-pacing/architecture/generation/credentials.ts#L1-L65) | `b00bf59` · `sveltekit/src/lib/server/credentials.ts` | Excerpt (whole) · 1–65 → 1–65 |
| [architecture/generation-selection.excerpt.ts](../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.ts#L1-L69) | `b00bf59` · `sveltekit/src/lib/server/config.ts` | Excerpt · 1–7 → 1–7; 9–16 → 9–16; 98–101 → 18–21; 103–108 → 23–28; 110–114 → 30–34; 116–149 → 36–69 |
| [architecture/generation-selection.excerpt.test.ts](../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.test.ts#L1-L73) | `b00bf59` · `sveltekit/src/lib/server/config.test.ts` | Excerpt · 1–10 → 1–10; 12–17 → 12–17; 19–33 → 19–33; 53–58 → 35–40; 61–63 → 42–44; 82–98 → 46–62; 112–121 → 64–73 |
| [architecture/generation/orchestrator.ts](../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.ts#L1-L170) | `b00bf59` · `sveltekit/src/lib/server/generation/orchestrator.ts` | Excerpt (whole) · 1–170 → 1–170 |
| [architecture/generation/orchestrator.excerpt.test.ts](../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.excerpt.test.ts#L1-L105) | `b00bf59` · `sveltekit/src/lib/server/generation/orchestrator.test.ts` | Excerpt · 1–7 → 1–7; 9–13 → 9–13; 15–18 → 15–18; 20–22 → 20–22; 24–25 → 24–25; 28–38 → 27–37; 40–46 → 39–45; 48–78 → 47–77; 80–97 → 79–96; 120–127 → 98–105 |
| [architecture/generation/target-options.ts](../cases/embedding-batching-retry-pacing/architecture/generation/target-options.ts#L1-L29) | `0baebd9` · `sveltekit/src/lib/server/generation/target-options.ts` | Excerpt (whole) · 1–29 → 1–29 |
| [architecture/groq/generation.ts](../cases/embedding-batching-retry-pacing/architecture/groq/generation.ts#L1-L28) | `0baebd9` · `sveltekit/src/lib/server/providers/groq/generation.ts` | Excerpt (whole) · 1–28 → 1–28 |
| [architecture/groq/generation.excerpt.test.ts](../cases/embedding-batching-retry-pacing/architecture/groq/generation.excerpt.test.ts#L1-L51) | `0baebd9` · `sveltekit/src/lib/server/providers/groq/generation.test.ts` | Excerpt · 1–9 → 1–9; 11–19 → 11–19; 22–39 → 21–38; 54–65 → 40–51 |
| [architecture/embedding-space.excerpt.ts](../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.ts#L1-L44) | `9e96d4f` · `sveltekit/src/lib/server/indexing/corpus.ts` | Excerpt · 1–6 → 1–6; 8–9 → 8–9; 11–13 → 11–13; 21–26 → 15–20; 28–38 → 22–32; 40–50 → 34–44 |
| [architecture/embedding-space.excerpt.test.ts](../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.test.ts#L1-L79) | `9e96d4f` · `sveltekit/src/lib/server/indexing/corpus.test.ts` | Excerpt · 1–9 → 1–9; 173–184 → 11–22; 186–201 → 24–39; 203–217 → 41–55; 219–225 → 57–63; 227–233 → 65–71; 235–241 → 73–79 |
| [architecture/config-selection-history.json](../cases/embedding-batching-retry-pacing/architecture/config-selection-history.json#L1-L176) | Selected/calculated inputs listed below | Reconstructed · Editorial envelope |
| [evidence/published-index-summary.json](../cases/embedding-batching-retry-pacing/evidence/published-index-summary.json#L1-L21) | Selected/calculated inputs listed below | Reconstructed · Editorial envelope |

#### Reconstruction rules and inputs

- `architecture/config-selection-history.json`: copies the entire generation and embedding objects from each commit’s `config/mosaic.example.json`, adding stage, sourceCommit, and classification. Stage order is initial-contracts → independent-build-and-runtime → credential-binding-separated → generation-registry.
- `evidence/published-index-summary.json`: selects schemaVersion, createdAt, fingerprint, corpusFingerprint, embeddingProvider, embeddingModel, embeddingInputVersion, and vectorDimension. It counts chunks and documentHashes entries and checks all vector lengths and numeric/finite elements. Source commit, source SHA-256, and classification are traceability fields.

| Public reconstruction · input | Original commit | Source SHA-256 |
|---|---|---|
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `fc509b07cbc33035ae12bd6b837d93b3045d216b` | `b1321cdcb932d14b391b8303f72ce1ba9046228f479cf944f887e9d59e5ea6df` |
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `c7610edd7223be7fe77cd7ae9722c58c27e81690` | `4f62fc99f58b0dcfaec117b9ca5243bba6fb22297007d065c643258d87cdb5bd` |
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `de197a5c0c245f64034c94542e96b09f3361dd63` | `dbd3763070c18ba8dded16693266660d72b6d3e59d54a5199fe7d9a3d7af83d3` |
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `b00bf595439bd71540ace4e34d6f56a803eb5719` | `19976e438024e926ccdf1453c7d4145d9bdf1f52677b0fad4a1aa798f4061488` |
| `evidence/published-index-summary.json` · `indexes/provider=gemini/model=gemini-embedding-2/dimensions=768/input=v2/30886679a306cf2ee9a3cd10532e6a7cfb5549f85baf3f595f672c9273e4b150.json` | `033e02fabe868a14cd8a4a932b50fbdba9a064fa` | `a0d705c70fbba84886ddae0a64c3811f69bdca4927290ae6282f69eb4c3640f6` |

#### Development reports and research records

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

The archived session is `rollout-2026-10-16T20-10-29-01a14468-00a5-7ff2-8053-0e588b0c1335.jsonl.zst`. Its home-PC original SHA-256, `9a167a56794bb628bd58e92581435b4efcacab3568d01e83d9dbf36ad79f9b99`, matched the existing register. The messages below were directly checked against the original; the [recovered-source register](evidence/recovered-source-register.json) adds per-message text hashes.

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

### Publication checks

The 22 whole-file Excerpts matched their Git objects byte-for-byte and by SHA-256. All selected ranges in the 15 partial Excerpts matched their source statements; all 37 TypeScript files passed syntax parsing. The two JSON reconstructions passed syntax, historical configuration-field comparison, source-hash checks, and the committed index’s metadata/vector-structure checks. The recorded RPM/TPM arithmetic was checked with its stated assumptions.

English/Korean facts, source mappings, and code targets were compared. All 412 local links across the READMEs and detailed records passed file, heading-anchor, and line-range checks. The previous three cases’ text and 48 published files were preserved. New files were reviewed for credential values, private document content, private repository URLs, and local user paths. Verification used source inspection and local parsing/calculation; historical application tests, API calls, and index builds were outside this publication run.

## 05 — Cross-PC Index Portability

**Development period:** 2026-09-28 ~ 2026-10-26

**Code classification:** Excerpt — 22 original source/test files, including selected ranges; Reconstructed — three evidence summaries.

**Outcome:** completed indexes became Git-managed artifacts identified by corpus and embedding space. Checkout-relative paths and canonical source content enabled reuse across PCs; Windows-built indexes later accompanied Ubuntu production releases.

### September 28: a shared artifact instead of repeated document embedding

A new office checkout had no dependencies or local index, while its environment still referenced the home checkout on another drive. At 09:27:40, the developer requested checkout-relative paths and npm.cmd, preserving the machine's PowerShell policy. Commit 1261bf8 at 10:00:18 derived the project root from the script location, resolved npm.cmd through Get-Command, and placed cache/temp under the checkout: [development launcher](../cases/cross-pc-index-portability/bootstrap/dev.ps1#L1-L14) and [index launcher](../cases/cross-pc-index-portability/bootstrap/index.ps1#L1-L15). This was the initial missing-artifact/setup event.

At 19:59:19, the developer requested generating Gemini/Cohere indexes on one PC and sharing them through Git to save repeated document-embedding time and provider quota. Persistent identity needed to survive runtime target naming, priority, and credential-slot changes. At 23:19:09, the developer requested Git sharing, atomic publication, and stale-artifact cleanup after successful publication. These requests were directly inspected in original user-input history on the home PC.

The preceding schema-3 implementation included target.id in the [fingerprint](../cases/cross-pc-index-portability/before/corpus.ts#L21-L33) and [storage directory/reader](../cases/cross-pc-index-portability/before/store.ts#L8-L40). A runtime-role rename could change persistent artifact identity. Commit 9e96d4f at 20:14:41 introduced schema 4: provider, model, dimensions, and embedding input version define the embedding space; corpus plus that contract determine the fingerprint. [Case 04's identity excerpt](../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.ts#L1-L44) and [tests](../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.test.ts#L1-L79) preserve that boundary.

Commit 9123e12 at 23:46:52 moved production artifacts from ignored cache/index to indexes. Local cache/temp and unfinished indexes/**/*.tmp remained ignored: [selected configuration/ignore history](../cases/cross-pc-index-portability/evidence/storage-policy.sample.json#L1-L25). Storage became `indexes/provider=<encoded>/model=<encoded>/dimensions=N/input=vN/<fingerprint>.json`. The [path implementation](../cases/cross-pc-index-portability/storage/space-paths.excerpt.ts#L15-L44) deterministically encodes unsafe and uppercase bytes. [Tests](../cases/cross-pc-index-portability/storage/space-paths.excerpt.test.ts#L76-L144) cover runtime metadata changes and copying to another checkout root. Case 04 provides the later preserved [validation/publication snapshot](../cases/embedding-batching-retry-pacing/publication/store.excerpt.ts#L1-L94), with its own provenance.

### September 30: line endings changed hashes while chunks stayed equal

At 21:16:48, the developer reported raw source hashes changing with checkout line endings while chunks remained equal, leaving a 505-vector artifact falsely stale. At 21:18:24, the requested outcome was immediate reuse of the office-built Git artifact on another PC. These times and observations were directly inspected in original user-input history on the home PC.

Commit de58671 at 22:23:36 added [canonical content](../cases/cross-pc-index-portability/canonicalization/content.ts#L1-L4): CRLF and lone CR become LF. The [source loader](../cases/cross-pc-index-portability/canonicalization/manifest.ts#L1-L50) supplies canonical content to [corpus preparation](../cases/cross-pc-index-portability/canonicalization/corpus.ts#L54-L73); [chunk section parsing](../cases/cross-pc-index-portability/canonicalization/chunker.ts#L20-L74) uses the same transformation. Corpus identity also includes chunker version, chunk limits, source ID, file, title, and public URL.

[Content tests](../cases/cross-pc-index-portability/canonicalization/content.excerpt.test.ts#L14-L29) preserve Unicode composition, spaces, and trailing blank lines; Unicode normalization or substantive whitespace changes still change hashes. [Chunk tests](../cases/cross-pc-index-portability/canonicalization/chunker.excerpt.test.ts#L14-L31) compare IDs, order, metadata, and content across LF, CRLF, CR, and mixed input. Newline representation became an explicit equivalence rule.

### Preserve vectors through explicit migration

The [migration](../cases/cross-pc-index-portability/migration/migrate.ts#L8-L42) validates the selected legacy artifact's schema and embedding contract, removes vectors for comparison, and requires exact equality of chunk IDs, order, metadata, and content with the current corpus. It replaces fingerprint, corpus fingerprint, and document hashes while preserving vectors and creation time. Destination conflicts fail; readback must match before the selected legacy file is deleted. [Tests](../cases/cross-pc-index-portability/migration/migrate.test.ts#L1-L113) cover preservation, conflicts, failed writes/verification, and invalid fingerprints. This is an explicit offline migration within the validated schema-4 contract.

Direct comparison of the committed Cohere artifacts confirmed the preservation:

| Field | Before → after |
|---|---|
| Fingerprint | 1c66bbb8… → 23601dde… |
| Corpus fingerprint | 2133e693… → e33efbad… |
| File bytes | 10,338,795 → 10,338,795 |
| Provider / model / dimensions | Cohere / embed-v4.0 / 1536, retained |
| Schema / input version / chunks | 4 / 2 / 505, retained |
| createdAt | 2026-09-30T05:44:06.336Z, retained |
| Vector-array SHA-256 | 662bf30f36c66af0a78fd294ed7dfe2346dea6182e1a5710752839fe68d68e80, retained |
| SHA-256 of chunks with only vector removed | 24f1841328849ed0f930b8796fb3c803f0b0aa824a71067424f73a5e1d6ed18b, retained |

[The reconstructed comparison](../cases/cross-pc-index-portability/evidence/identity-migration-summary.json#L1-L46) retains full paths, file/document-hash digests, and the calculation method. File hashes changed with identity metadata.

### CURRENT and the evolving portability contract

[Status evaluation](../cases/cross-pc-index-portability/status/indexer.excerpt.ts#L23-L74) computes the corpus/target fingerprint and validates that exact file. The current state denotes a matching, validated artifact; an absent expected file with other JSON artifacts in that space produces stale. Other states distinguish missing, empty, invalid, corrupt, and dimension mismatch. [Menu formatting](../cases/cross-pc-index-portability/status/menu.excerpt.ts#L15-L50) displays the computed state as CURRENT and reports reuse.

The [September 30 test](../cases/cross-pc-index-portability/verification/portability-20260930.test.ts#L1-L114) copies the identical 505-chunk Cohere artifact into isolated LF/CRLF/CR/mixed checkouts. Assertions compare hashes, chunks, fingerprint, CURRENT, bytes, and search over 505 candidates. Query embedding is stubbed with the first stored vector; the first score is approximately 1. Document embedding, index builds, migration, and live fetch must remain unused. Adding real source content must produce stale.

Commit 572bb2c on October 15 at 20:36:12 extended [the contract](../cases/cross-pc-index-portability/verification/portability-20261015.test.ts#L1-L137) to Gemini and Cohere against that revision's 27-source, 372-chunk corpus. Each provider's current artifact is resolved from corpus and contract, replacing the pinned September filename; checksums and four newline variants are evaluated separately. These are inspected historical assertions.

### October 22–26: Windows-built indexes in Ubuntu production

The requirement became an operating choice: build locally on Windows and distribute the index with the release to Ubuntu. October 22 deployment records identify Ubuntu 24.04.1 and Node.js 24.22.1. Application output, approved knowledge, configuration, and index were packaged locally; runtime dependencies were installed for Linux.

The retained October 22 [packaging excerpt](../cases/cross-pc-index-portability/production/package-index.excerpt.mjs#L1-L22) selects and copies an existing Gemini index and records byte sizes/SHA-256. It is a local artifact associated with release 20261022-033e02f-01, identified by source hash. Selected statements preserve original references, including secrets supplied by omitted credential-loading code.

[Selected release evidence](../cases/cross-pc-index-portability/evidence/production-reuse-summary.json#L1-L165) connects manifests, source commits, Git bytes, available local stages, and retained operating reports:

| Release/source | Artifact | Retained operating verification |
|---|---|---|
| Oct 22 / 033e02f | Gemini gemini-embedding-2 / 768 dimensions; 28 sources, 373 chunks; fingerprint 30886679…; 3,993,421 bytes; SHA-256 a0d705c70fbba84886ddae0a64c3811f69bdca4927290ae6282f69eb4c3640f6 | At 14:29:27, index check passed: current, 373 chunks, matching fingerprint; final health ok=true. |
| Oct 26 / 8fa463e | 28 sources, 382 chunks; fingerprint dfdb4bbe…; 4,097,925 bytes; SHA-256 1cb34a4f657c9dfec8b601b03eb215749f144f6e9ac209079e1e62ec0dbae5ff | Matching fingerprint, 382 chunks, 111 verified files, health true. |
| Oct 26 / e4aed0f, 876ea52, 189cf00 | Same 382-chunk fingerprint and file SHA-256 across these releases | Each retained report records matching fingerprint, 382 chunks, 111 verified files, health true. |

The October 22 and 26 indexes reflect their respective corpus revisions. For each release, Git bytes match its manifest; retained staged copies across all five selected releases also match. On October 29, the developer directly confirmed deploying Windows-built indexes to Ubuntu and using them without server-side rebuilding. That later clarification describes the operating outcome.

Deployment tooling committed as 4fddd61 on October 26 at 21:49:10 formalized the checks: [manifest validation](../cases/cross-pc-index-portability/production/verify-manifest.excerpt.py#L23-L56) binds commit, file size/hash, index identity/counts, and package version; [offline tests](../cases/cross-pc-index-portability/production/manifest-contract.excerpt.test.py#L19-L69) cover identity/counts, tampering, unlisted payload, and draft rejection. The [runtime probe](../cases/cross-pc-index-portability/production/probe.mjs#L1-L43) resolves the active release's config/knowledge/index and compares its loaded CURRENT artifact with the manifest. This later probe performs local checks and dependency imports. October 22 operating diagnostics also included separate API connectivity checks.

### Evidence level and remaining questions

**Code confirmed:** identified implementations/assertions, preservation of the two committed 505-vector artifacts, and release-specific Git/manifest/stage comparisons. **Reported at the time:** sharing requests, the false-stale diagnosis, and retained Ubuntu runtime/health results. The developer's October 29 operating clarification retains that later date.

Exact before/after execution logs from the second PC remain unavailable. A previously cited “6 batches / 10.22 MiB” run and search timestamp still lack a matched raw run ledger. The identified Git objects establish vector/content preservation; those additional historical run correspondences remain unconfirmed.

### Sources and publication choices

The September 28 09:27:40 request was directly inspected in session 01a0e55f-fed2-7973-93fb-e80d25f296b2, whose filename begins 09:17:48; compressed-file SHA-256 de5561f7093616ecfe76164289354fd8a99feb5e8b0d3766e22200ff68b0ee5b. Later September 28 requests and September 30 observations were directly inspected in original user-input history. Their session IDs are 01a0e775-78b0-73b0-ad5a-902cc720edc7, 01a0e862-09ff-7d42-bd7e-6195ccaaa1a7, and 01a0f218-3b96-73e1-a0b9-a1696608e74f; complete parent sessions remain unavailable. The [recovered-source register](evidence/recovered-source-register.json) retains message times and original-text hashes. The 21:18:24 request explicitly required the same Git artifact to be CURRENT and immediately usable in CRLF/LF checkouts without additional embedding/build. The original October 22 session 01a1613d-e5c6-76f2-9e3d-42c9eeca696b has SHA-256 37823ca6529dfca51f56283ca715ad80e733df9ce371251e261692d25527baef. The private consolidated development history and evidence register supplied the chronology and unresolved questions. Publication-time comparisons are identified above.

Whole-file Excerpts preserve complete selected snapshots. Partial Excerpts retain the listed source ranges with blank separators, original imports, identifiers, and application references. Storage/status/menu select reuse behavior; test excerpts select relevant assertions; production excerpts select packaging and validation while operational access details remain private. Reconstructed JSON selects recorded fields and labels digest calculations/editorial grouping. Full knowledge/vector payload remains private. All source code uses Excerpt; no Mixed reconstruction was needed.

<details>
<summary>Source snapshots, excerpt ranges, and SHA-256</summary>

Original paths are relative to private Synethos. Ranges refer to original snapshots; public links use excerpt-file lines. SHA-256 values hash file bytes.

| Public file | Original commit / path / lines | Original SHA-256 → public SHA-256 |
|---|---|---|
| [bootstrap/dev.ps1](../cases/cross-pc-index-portability/bootstrap/dev.ps1#L1-L14) | `1261bf8962cf01e3ee88ed6b98724b5e0c4c6be4`<br>`scripts/dev.ps1`<br>1–14 | `c06135a469980330a23071ff0155077435047bbda090acede8dba5e9d28e300b` → `c06135a469980330a23071ff0155077435047bbda090acede8dba5e9d28e300b` |
| [bootstrap/index.ps1](../cases/cross-pc-index-portability/bootstrap/index.ps1#L1-L15) | `1261bf8962cf01e3ee88ed6b98724b5e0c4c6be4`<br>`scripts/index.ps1`<br>1–15 | `0c252f74ca5ffabe6dc1a63c3a27904b6ea1fa95499d6ab4466a3c0a46c7fb43` → `0c252f74ca5ffabe6dc1a63c3a27904b6ea1fa95499d6ab4466a3c0a46c7fb43` |
| [before/corpus.ts](../cases/cross-pc-index-portability/before/corpus.ts#L1-L56) | `646d8bc5303271dbfbd98b3d64a2b62c43cc327d`<br>`sveltekit/src/lib/server/indexing/corpus.ts`<br>1–56 | `7573377d6279a2dbf220214ef69dc3fc8add162c72e2f36b1ee915b87854f190` → `7573377d6279a2dbf220214ef69dc3fc8add162c72e2f36b1ee915b87854f190` |
| [before/store.ts](../cases/cross-pc-index-portability/before/store.ts#L1-L50) | `646d8bc5303271dbfbd98b3d64a2b62c43cc327d`<br>`sveltekit/src/lib/server/indexing/store.ts`<br>1–50 | `a3884d8760564754183312e1c143b089b091b889ab231ff5f3f9cdbef85ddce8` → `a3884d8760564754183312e1c143b089b091b889ab231ff5f3f9cdbef85ddce8` |
| [storage/space-paths.excerpt.ts](../cases/cross-pc-index-portability/storage/space-paths.excerpt.ts#L1-L44) | `9123e12ec742b501d435156573d448ce77a7ef3d`<br>`sveltekit/src/lib/server/indexing/store.ts`<br>1–44 | `fa0f799e3525b7a212f2d474a2488d3cc0608db26956e3c16e1ead2d68a90425` → `2c18008677d4135b2e414515bb14728c54d428243114e40abd1d20cbdee9d338` |
| [storage/space-paths.excerpt.test.ts](../cases/cross-pc-index-portability/storage/space-paths.excerpt.test.ts#L1-L144) | `9123e12ec742b501d435156573d448ce77a7ef3d`<br>`sveltekit/src/lib/server/indexing/store.test.ts`<br>1–74, 76–144 | `f240326af3cfffc726ea809f18d3d396d6477d81e06a3029064c5a51f89db361` → `23df365cef17b9d2048a706d6d757a52f96a15e7889809e30b9266f1dfcdde07` |
| [canonicalization/content.ts](../cases/cross-pc-index-portability/canonicalization/content.ts#L1-L4) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/knowledge/content.ts`<br>1–4 | `2346f73dcad254a9cd6a3bc05e19e2c0abff7a3c21985c411890db39c2102ed7` → `2346f73dcad254a9cd6a3bc05e19e2c0abff7a3c21985c411890db39c2102ed7` |
| [canonicalization/manifest.ts](../cases/cross-pc-index-portability/canonicalization/manifest.ts#L1-L50) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/knowledge/manifest.ts`<br>1–50 | `34784adb5057779f26f2592dadacca5ae045978de3ec9948e1019c81db9f9904` → `34784adb5057779f26f2592dadacca5ae045978de3ec9948e1019c81db9f9904` |
| [canonicalization/chunker.ts](../cases/cross-pc-index-portability/canonicalization/chunker.ts#L1-L110) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/knowledge/chunker.ts`<br>1–110 | `b92e6fffa7e77e903243abc6ef559943cf9f4ab253f9db3ec35065bb7cd35da5` → `b92e6fffa7e77e903243abc6ef559943cf9f4ab253f9db3ec35065bb7cd35da5` |
| [canonicalization/corpus.ts](../cases/cross-pc-index-portability/canonicalization/corpus.ts#L1-L73) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/corpus.ts`<br>1–73 | `808b33161d3d6d254c5987d2845d81543a45be39126153a018fa257a6b8ca0f4` → `808b33161d3d6d254c5987d2845d81543a45be39126153a018fa257a6b8ca0f4` |
| [canonicalization/content.excerpt.test.ts](../cases/cross-pc-index-portability/canonicalization/content.excerpt.test.ts#L1-L29) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/corpus.test.ts`<br>1–12, 315–330 | `926537eec4977e12072750199c76c1b8b58637204708ef828a23c5a16162896f` → `0e5dbc0065f6e3ca89cc005ef3e83290f08ce330509accd6d8f00b85909c622d` |
| [canonicalization/chunker.excerpt.test.ts](../cases/cross-pc-index-portability/canonicalization/chunker.excerpt.test.ts#L1-L31) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/knowledge/chunker.test.ts`<br>1–12, 126–143 | `22effa4e723bca03a67bba435ab13eeaa31e19f7567a39bb99db587c69c0fa09` → `c60fbbfdee344dc41942a20024e905c4a19192611b5d890ba89de037761d0544` |
| [migration/migrate.ts](../cases/cross-pc-index-portability/migration/migrate.ts#L1-L42) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/migrate.ts`<br>1–42 | `0033869f198ec9fd9dc2ab94d68f32a53eb08ec6fa0fd5e4f9a47dd1b6bd9bad` → `0033869f198ec9fd9dc2ab94d68f32a53eb08ec6fa0fd5e4f9a47dd1b6bd9bad` |
| [migration/migrate.test.ts](../cases/cross-pc-index-portability/migration/migrate.test.ts#L1-L113) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/migrate.test.ts`<br>1–113 | `2522d9d44d87191cbcb0ea90332fd5981530618c74943df9f62fd56cfe94ce2d` → `2522d9d44d87191cbcb0ea90332fd5981530618c74943df9f62fd56cfe94ce2d` |
| [verification/portability-20260930.test.ts](../cases/cross-pc-index-portability/verification/portability-20260930.test.ts#L1-L114) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/portability.test.ts`<br>1–114 | `86b50daef4e362fcfcf75edbd27f9d2a77ff200ab635f8ff2ce80564bfddd62e` → `86b50daef4e362fcfcf75edbd27f9d2a77ff200ab635f8ff2ce80564bfddd62e` |
| [status/indexer.excerpt.ts](../cases/cross-pc-index-portability/status/indexer.excerpt.ts#L1-L74) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/indexer.ts`<br>1–74 | `d60c5a48c89d4e88107979dbb82bdfd79a17ff59fff48f48622ff9583cc3ebc3` → `06321da46c8faf9454070453c2b865e9efd0ba20bb5f9153a67b78d129298a12` |
| [status/menu.excerpt.ts](../cases/cross-pc-index-portability/status/menu.excerpt.ts#L1-L50) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/menu.ts`<br>1–50 | `fe7290b9ff2367cf24bad9e823bedbfcebe30f5882238b29ed0d2f05d89634a0` → `f3aac3e567310195f9e9e33e142690c2971093e48cf4f59d734f3a9929f7a037` |
| [verification/portability-20261015.test.ts](../cases/cross-pc-index-portability/verification/portability-20261015.test.ts#L1-L137) | `572bb2c159b21c5dcb2a4c2c9332d854775b793f`<br>`sveltekit/src/lib/server/indexing/portability.test.ts`<br>1–137 | `c3b89e675accfa1a27fbc9ef28f9fa976eb6d1a1b3fb42c0b3f9e39dc586b425` → `c3b89e675accfa1a27fbc9ef28f9fa976eb6d1a1b3fb42c0b3f9e39dc586b425` |
| [production/package-index.excerpt.mjs](../cases/cross-pc-index-portability/production/package-index.excerpt.mjs#L1-L22) | `local 2026-10-22 packaging artifact`<br>`tmp/synethos-deploy/package-release.mjs`<br>1–3, 5–15, 19–24 | `e5e78784cdd9f73b6115253677f468a2747c0ce371135b080d4564e32a4381b5` → `a2352d834317b7804dec46e6c6369ac50ab43dba20ae53bf590fd7263533ca5a` |
| [production/verify-manifest.excerpt.py](../cases/cross-pc-index-portability/production/verify-manifest.excerpt.py#L1-L56) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/deploy.py`<br>4–5, 7–8, 22–24, 34–36, 39–45, 62–95 | `8ec2db16cac2a5c77b46662ade526e779eca51c9c47fee517c4e1cb595a230ad` → `afc47670267bb7df95af49a16b7d49904db7fe1802a4d1e91c43cba96f44012b` |
| [production/manifest-contract.excerpt.test.py](../cases/cross-pc-index-portability/production/manifest-contract.excerpt.test.py#L1-L69) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/test_deploy.py`<br>2–18, 21–71 | `07ceb585168a3e8a717fd6b520850a56bd7a748617323139f578481596548914` → `0bb4d5be0e2ec60db8d199c6ab399485c3edc98510c76ff86b1df49c4543fbdd` |
| [production/probe.mjs](../cases/cross-pc-index-portability/production/probe.mjs#L1-L43) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/probe.mjs`<br>1–43 | `a4a6360520aada0d0fe5e7b91d07813c0753b89a2a405b7c3c9b39510e90cde1` → `a4a6360520aada0d0fe5e7b91d07813c0753b89a2a405b7c3c9b39510e90cde1` |
| [evidence/identity-migration-summary.json](../cases/cross-pc-index-portability/evidence/identity-migration-summary.json#L1-L46) | Reconstructed; inputs below | `729e4158a5d0413ccfb199dc0334674f49e0d8b836e72465888f51a7f2f7d9ff` |
| [evidence/storage-policy.sample.json](../cases/cross-pc-index-portability/evidence/storage-policy.sample.json#L1-L25) | Reconstructed; inputs below | `ec855da82a7dfebf2e25343f6d1ab536022e68e3a50bd38d136c0327945fc21b` |
| [evidence/production-reuse-summary.json](../cases/cross-pc-index-portability/evidence/production-reuse-summary.json#L1-L165) | Reconstructed; inputs below | `d5b7554018bb99b54e9f56c46ace6e647b6067e1615861777a43914d558150dc` |

| Reconstructed file | Input identifier / SHA-256 |
|---|---|
| `evidence/identity-migration-summary.json` | `4125443b5de06bea988b9776a4e85d8a5d608a1b` / `indexes/provider=cohere/model=embed-v4.0/dimensions=1536/input=v2/1c66bbb8a28b77fe50735992339da8e43dd50f0388a71809617b2f7e68d0fe57.json`<br>`8ba6e3e9eb1f6443ff33b51b6e291ee1f0099c573c853d334b5f598434073d58` |
| `evidence/identity-migration-summary.json` | `de586719e463e324e18658c87bfe937e9506c1c0` / `indexes/provider=cohere/model=embed-v4.0/dimensions=1536/input=v2/23601dded9d2a9722d12e9083f23061d6c53d71c5e7d8ba884df87f2e7716f61.json`<br>`d2d1e548f8910b77662e0ff76b243d6183a1cd460100d2bc2e1f4d46ab3bf63a` |
| `evidence/storage-policy.sample.json` | `9123e12^` / `config/mosaic.json`<br>`1cc124c5c25098d7461b43870d6fc7c051d5ffd3fda47d942bb3e2c3d9520fc3` |
| `evidence/storage-policy.sample.json` | `9123e12^` / `.gitignore`<br>`9ab4c886b4d9331107d5c870351eb9a3e53590fa4b4f0b7b90d75092bf718c83` |
| `evidence/storage-policy.sample.json` | `9123e12` / `config/mosaic.json`<br>`b3d755eafecdcbc4be638bcfd820741da0b3e35e63dcde0878cf6a524bd2801f` |
| `evidence/storage-policy.sample.json` | `9123e12` / `.gitignore`<br>`570b0ba4f928b4a0b8cedb84c532dcc3d7c3eeaca04c6dd339cdeff94039e3d1` |
| `evidence/production-reuse-summary.json` | `tmp/synethos-deploy/release-manifest.json`<br>`657c0b5754c451be5c033a78a8a551567cb380c8257e90a9e4a6599f383eac3e` |
| `evidence/production-reuse-summary.json` | `tmp/synethos-deploy/final-verification.json`<br>`b1d6105d63585a2aa0964e0d2251262bfdc8b8d01df2fe671c25216c3f89e9c3` |
| `evidence/production-reuse-summary.json` | `tmp/synethos-deploy-20261026-8fa463e/release-manifest.json`<br>`7b30943da831466b821b72a2b2adf76d472d357c643178b3ad858e1866258c82` |
| `evidence/production-reuse-summary.json` | `tmp/synethos-deploy-20261026-8fa463e/verification.json`<br>`ccf8195faebfe86c10914d85f70fc4500907fb313758d1256ebf44cf64dab039` |
| `evidence/production-reuse-summary.json` | `tmp/synethos-footer-20261026-e4aed0f/release-manifest.json`<br>`9fddef2b26bed77546828711d70324c2417f255d869b4beb956ee4a6c595206b` |
| `evidence/production-reuse-summary.json` | `tmp/synethos-footer-20261026-e4aed0f/verification.json`<br>`b9b77eb5be222d4b8817d3a996f6c8eb87f22e1808e5c83ffe339253e1743d1b` |
| `evidence/production-reuse-summary.json` | `tmp/release-1.0.1/release-manifest.json`<br>`d6b739977683c83a3406a7647be25c033ab538ac32ae9069d566a0bef10d10f4` |
| `evidence/production-reuse-summary.json` | `tmp/release-1.0.1/verification.json`<br>`a5e575e65ad001c92402eca854afd4c0d46ae069b82266bbf3f6d2a913545947` |
| `evidence/production-reuse-summary.json` | `tmp/release-1.0.2/release-manifest.json`<br>`de8f1263c057f349d8bced77a77178504de4efd2d8a5f9f45bbd3039fed610b3` |
| `evidence/production-reuse-summary.json` | `tmp/release-1.0.2/verification.json`<br>`9bfdc0ac6fc0c7751f685f64121f8bacf5870f520135eeeaaa3b849915724855` |

</details>

### Publication checks

The 13 whole-file Excerpts matched their originals byte-for-byte; all nine partial Excerpts matched the declared source ranges. Syntax parsing passed for 18 TypeScript/JavaScript files, two Python files, and two PowerShell scripts. All three JSON summaries passed parsing and input-hash checks; migration digests and release-specific Git/manifest/stage comparisons were checked.

English/Korean source targets and hashes match. All 522 local links passed file, heading-anchor, and line-range checks. Cases 01–04 retain their text and 87 code/evidence files. New material was reviewed for credential values, private knowledge payloads, private repository URLs, local user paths, and operational access details. Verification used local inspection, parsing, and calculations. Historical application tests, model calls, index builds, and live server inspection were not performed.

## 06 — Model Selection: Quality and Availability

**Development period:** 2026-09-26 ~ 2026-10-16

**Code classification:** Excerpt — 15 source/test files; Reconstructed — five configuration/evidence records.

**Outcome:** Generation settled on Gemini 3.5 Flash Lite primary and Groq GPT-OSS 120B fallback. The choice combined task-specific quality, observed availability, free-tier capacity, and the service's operating scope. Candidate adoption, local experiments, and committed runtime selection are dated separately below.

### September 26: turn a model choice into an availability policy

The Gemini API transition in 9a3df61 initially configured gemini-3.8-flash. At 14:14:51, 2e02e71 changed the lineup to gemini-3.5-flash-lite followed by gemini-3.1-flash-lite, both with the configured 1200-token output cap. The [configuration history](../cases/model-selection-quality-availability/evidence/model-selection-history.json#L1-L242) preserves successive model identities, options, and runtime order.

**Initial-switch rationale from user-supplied ChatGPT history search:** on September 26 at approximately 13:39 KST, the developer judged the 20-call daily free-tier allowance unsuitable for a public service. At approximately 13:43, the developer requested switching to Gemini 3.5 Flash-Lite; at approximately 13:50, five successful live tests of 3.5 Flash-Lite were reported. These entries retain their search-report level, with the original conversation URL and full messages unavailable. The [clarification record](../cases/model-selection-quality-availability/evidence/developer-clarification-20261029.json#L1-L184) identifies the three approximate times and source scope. The 14:14:51 configuration commit records the resulting lineup. October 3's 3.8 re-evaluation remains a separate later event.

The [initial Generation implementation](../cases/model-selection-quality-availability/baseline/generation.ts#L18-L126) constructed the prompt once, visited configured models in order, and advanced only on confirmed quota exhaustion. Same-model HTTP 503 retry belonged to the SDK request configuration: four attempts, with the recorded backoff settings. [Failure classification](../cases/model-selection-quality-availability/baseline/generation-fallback.ts#L23-L70) recognized machine-readable quota evidence and kept other 429 responses distinct. [Classification tests](../cases/model-selection-quality-availability/baseline/generation-fallback.test.ts#L1-L52) and [Generation tests](../cases/model-selection-quality-availability/baseline/generation.test.ts#L37-L162) preserve these early conditions, including response validation and safe diagnostics.

### September 30–October 2: compare explicit candidates, then choose runtime roles

On September 30 at 18:15:43, b00bf59 registered Gemini 3.5, Gemini 3.1, Cohere command-a-plus-05-2026, and Groq qwen/qwen3.8-27b as distinct targets. Runtime still used Gemini 3.5 then 3.1. Shared-evidence comparisons used explicit targets, so registering a candidate did not assign it a runtime role. [Case 03's comparison implementation](../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.ts#L45-L90) and [Case 04's registry/runtime selection](../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.ts#L36-L69) provide that mechanism.

The retained research reports output/token-limit 429 and structured JSON 400 failures for the Groq Qwen Preview candidate. At 22:22:54, 4125443 removed that target and its adapter path, while raising Gemini/Cohere output caps to 32768. The available record establishes the model-specific failure report and committed removal; the exact original attempt ledger remains unavailable.

On October 1, fixed-context question-subject experiments favored Cohere in subject retention: the reported combined stages were Cohere 54/54 and Gemini 42/54. A subsequent local Cohere-only run still showed name-format and grounding/citation issues. [Case 03's dated subject-retention record](#october-1-question-subject-and-record-speaker) preserves prompt revisions, sample sizes, and the locally applied routing scope. These observations informed candidate exploration. Commit 180cc30 on October 2 at 02:37:05 then established Gemini 3.5 primary and Cohere Command A+ fallback.

### October 3: why a quality improvement did not make Gemini 3.8 usable

**Observed situation and developer decision, clarified directly on October 29:** the usage history considered for the operating decision contained three successful responses and seventeen HTTP 503 failures against a free-tier allowance of 20 calls per day. A subsequent HTTP 429 indicated that the daily allowance was exhausted.

| Operating observation | Result |
|---|---|
| Free-tier daily call allowance | 20 |
| Successful responses | 3 |
| HTTP 503 failures | 17 |
| Subsequent response | HTTP 429 indicating daily-quota exhaustion |

**Request correspondence established from recovered originals:** the home-PC prior approved run and subsequent retry run retain ledgers, request bodies, and native provider responses, which were directly compared. The three key report/decision-file hashes matched their registered values. The [original aggregates and request ledger](../cases/model-selection-quality-availability/evidence/october03-reported-results.json) preserve this correspondence and timestamps/body hashes/response hashes for all 24 calls.

| Gemini 3.8 run scope | Requests | Successes | HTTP 503 | HTTP 429 |
|---|---:|---:|---:|---:|
| Prior approved run | 6 | 1 | 5 | 0 |
| Subsequent retry run | 15 | 2 | 12 | 1 |
| Total before the 429 | 20 | 3 | 17 | 0 |

One Gemini 3.5 success in the prior run and two in the retry run are separate from the 3.8 usage above. The twenty-first known 3.8 request returned an actual HTTP 429/RESOURCE_EXHAUSTED envelope specifying quotaId GenerateRequestsPerDayPerProjectPerModel-FreeTier and quotaValue 20. This establishes attempt-level correspondence between the previously separate 20-call history and the retry run. These observations and quota exhaustion grounded the developer’s conclusion that failed requests consumed daily budget. The retained records do not directly establish provider-side individual deductions, other account activity, or monetary billing.

From this result, the developer concluded that 503 failures counted toward the call allowance: most of the day's capacity had been consumed while producing very few usable responses. Twenty calls per day was already insufficient for Synethos, and losing most of that allowance to failures removed the practical reason to select Gemini 3.8 for operation.

The developer directly set the stop condition: retry HTTP 503, but abandon the model when a daily-limit 429 occurred. The observed result met that condition, and the developer excluded 3.8 from Synethos's operating candidates. Its quality advantage on some questions remained part of the evaluation.

The developer also considered whether paid access could resolve the availability problem. The user-provided ChatGPT history-search record at approximately 03:16:17 KST described similar 503 reports from paid as well as free projects. Together with the developer's own failed requests, that information gave no basis to expect payment to provide reliably successful responses. The developer judged that the additional cost did not justify adopting 3.8.

**Paired quality experiment:** the recorded re-evaluation asked whether 3.8 used evidence that 3.5 omitted. Question, evidence, order, citations, prompt, and schema were held fixed; four questions were planned. Two pairs completed:

| Case | Reported quality observation |
|---|---|
| QB18 | 3.8 was clearly better at including the supplied OCR residence/period-parsing explanation. |
| QB20 | The answers were judged equivalent. |

[The historical report reconstruction](../cases/model-selection-quality-availability/evidence/october03-reported-results.json#L1-L4095) retains this experiment's counts: 3.8 made 15 requests, with two successes, twelve HTTP 503 responses, and one HTTP 429. The two 3.5 successes bring the run total to 17 requests. QB18 took 742.410 seconds until a 3.8 success; that successful request itself took 16.564 seconds. QB20's 3.8 success took 17.222 seconds.

The original 03:20:37 developer request was directly read in history.jsonl; its message hash and time are preserved in the [recovered-source register](evidence/recovered-source-register.json). It required immediate termination and candidate rejection on the agreed failure condition. At 03:35:46, the daily-quota response triggered that condition. Further requests after the 429 were zero; QB25’s A request and both QB11 requests were uncalled.

**Contemporaneous discussion recovered through history search:** on October 29, the developer supplied the following ChatGPT past-conversation search results. Times are KST. These are user-provided search records; the original conversation URL, identifier, and full messages remain unavailable.

| October 3 time | Search-record content |
|---|---|
| 03:13:25 | Discussion of repeated HTTP 503 results and call limits. |
| 03:14:41 | The developer questioned the free tier's usefulness after this volume of 503 failures. |
| 03:15:45 | The developer requested investigation of similar overseas-community reports. |
| 03:16:17 | ChatGPT returned similar 503 reports from Reddit and Google AI Developers Forum, including paid-project reports. |
| 03:19:52 | The developer permitted 503 retry and specified abandoning 3.8 on a daily-limit 429. |
| 03:35:06 | The developer reported AI Studio daily usage of 17/20 while failures accumulated. |
| 03:49:02 | Test summary: 15 Gemini 3.8 requests, two successes, twelve 503s, one 429. |

The final counts agree with the directly inspected experiment originals. The condition in the 03:19:52 ChatGPT search record corresponds to the Codex 03:20:37 original user-input message; each source retains its own message time. AI Studio 17/20 remains the developer’s contemporaneous account-usage report.

**Additional external context:** the developer recalls searching for similar complaints after the errors and quota depletion. The original ChatGPT conversation URL/identifier is unavailable. A [Google AI Developers Forum post](https://discuss.ai.google.dev/t/gemini-api-503/183913), published September 21 and directly inspected for this publication, reports recurring 503s on the free tier in Google Apps Script, including gemini-3.8-flash among three affected models. A reply describes temporary service overload. This supplies a similar external failure observation alongside the operating results that drove the decision.

The following public reports were also directly inspected for this publication:

| Report | Model and environment | Author's reported observation |
|---|---|---|
| [September 24: free-tier failures and RPD](https://discuss.ai.google.dev/t/handling-429-503-errors-from-the-gemini-api/124640/79) | Gemini 3.7/3.8 Flash, free tier | Repeated 503s and an RPD counter increasing after failed calls; 3.8 showed 8/20 with every observed call failing. |
| [August 28: paid-tier availability](https://discuss.ai.google.dev/t/persistent-37-unavailable-503-on-generatecontent-with-gemini-3-6-flash-paid-tier-1-zero-429s-counttokens-unaffected/179971) | Gemini 3.6 Flash, Paid Tier 1 | A 30-day GenerateContent record of 646 requests and 37.46% errors, reported as HTTP 503; zero 429s. |

The paid-tier percentage belongs to the reported Gemini 3.6 Flash/Tier 1 workload. It supplied context for the developer's judgment that paying for access offered insufficient assurance of stable operation. The free-tier RPD report supplied an external observation similar to the developer's own quota-depletion experience.

[The dated clarification record](../cases/model-selection-quality-availability/evidence/developer-clarification-20261029.json#L1-L184) preserves the developer judgments, search chronology, and directly inspected public references. The developer's October 29 clarification above states the inference and exclusion decision drawn from the three-success/seventeen-failure usage history.

### October 3: select a different Groq model for fallback

A separate fresh full40 comparison used the same saved evidence, question, prompt, and schema across three generators, with 40 successful responses each:

| Model | Fully correct | Grounding failures | Contract failures | Mean Generation latency |
|---|---:|---:|---:|---:|
| Gemini 3.5 Flash Lite | 27/40 | 0 | 1 | 1.508s |
| Cohere Command A+ | 22/40 | 3 | 4 | 3.042s |
| Groq GPT-OSS 120B | 25/40 | 2 | 0 | 1.524s |

The recovered full40 originals record a sequential run on October 3 at 05:10:24.134–05:53:01.835, HEAD bbac3a6d11993f3c3e3d80eec44df86e7779073d. All 120 requests, responses, results, and manual reviews were compared. The common-input hashes for 40 questions, 120 request-body hashes, native-response-to-result correspondence, and normalized-answer-to-historical-review correspondence all matched. The [original-result projection](../cases/model-selection-quality-availability/evidence/october03-reported-results.json) retains per-case identities and recalculated aggregates. Gemini/Cohere output caps were 32768; GPT-OSS used a 4096 cap and strict JSON Schema, omitting reasoning_effort to use the recorded provider default medium. Retry/fallback counts were zero, with a minimum 65-second Groq request-start interval. Successful-request latency is separate from between-request waits. October 1 subject retention and the partial 3.8 comparison retain their own measures and conditions.

At 04:05:58, the retained developer request asked to re-evaluate GPT-OSS after the earlier Groq candidate failures. At 07:42:12, 0baebd9 changed runtime to Gemini 3.5 primary and Groq openai/gpt-oss-120b fallback, retaining Cohere for explicit evaluation. The configured caps were Gemini 32768 and GPT-OSS 4096 with medium reasoning effort. The [routing regression excerpt](../cases/model-selection-quality-availability/runtime/groq-fallback.excerpt.test.ts#L28-L93) verifies those caps, quota-triggered dispatch through the actual Groq adapter with mocked HTTP 200/429/503 responses, registry/runtime independence, and one-target explicit execution.

The resulting lineup used the evaluated GPT-OSS model after the earlier Qwen candidate was removed. [Case 04's GPT-OSS adapter](../cases/embedding-batching-retry-pacing/architecture/groq/generation.ts#L1-L28) preserves the corresponding strict-schema and reasoning-option mapping.

### October 3: compare reasoning settings and retain the existing configuration

After full40, the developer requested Gemini 3.5 primary/GPT-OSS fallback at 06:09:47, then a reasoning-only comparison preserving the inputs and baseline at 06:30:45. The 06:38:49.902–07:18:09.538 run used the same HEAD, preserving the in-progress Groq integration changes while making fresh calls only for Gemini medium and GPT-OSS high. The [reasoning comparison evidence](../cases/model-selection-quality-availability/evidence/october03-reasoning-results.json) retains options, denominators, hashes for all 77 calls, and historical ratings. All 77 requests matched baseline shared inputs and differed only in the reasoning option. Retry, fallback, embedding, retrieval, reranker, and index-rebuild counts were zero.

| Comparison | Same successful questions | Fully correct | Cited required claims | Observation |
|---|---:|---|---|---|
| Gemini default/minimal → medium | 40 | 27 → 27 | 31/49 → 31/49 | Mean latency 1508.029 → 3339.448ms |
| GPT-OSS medium → high | 36 | 24 → 26 | 30/44 → 31/44 | Hard failure union 2 → 3 |

Gemini medium recovered QB18 OCR parsing and QB37 records/citation handling but omitted details in QB04/QB12, leaving no net fully-correct or coverage gain. GPT-OSS high resolved QB32’s unsupported unknown-handling explanation and recovered QB33’s decision sequence, while introducing an unsupported effect in QB12 and a naming error in QB16; QB25 entity conflation remained. These are per-question changes in the historical manual ratings.

Gemini medium succeeded on 40/40 questions. GPT-OSS high succeeded on QB01–QB36, stopped on an HTTP 429 tokens-per-day error at QB37, and left QB38–QB40 unexecuted. The returned limit 200000, used 198748, and requested 3431 describe cumulative account state, rather than usage attributable to the high run alone. Quality comparisons with high use the same 36 successful questions. This October 3 error and the October 15 rate-limit failures are separate observations.

The historical report weighed quality changes, new errors, latency, and reasoning usage and recommended retaining existing settings. The original 07:34:34 developer message retained Gemini default/minimal and GPT-OSS medium and finalized only the already implemented Groq fallback replacement. Commit 0baebd9 at 07:42:12 then recorded these settings. The [recovered-source register](evidence/recovered-source-register.json) identifies the experiment requests, recommendation report, and final developer decision separately.

### October 6: make runtime fallback and explicit evaluation serve different purposes

The September 26 and October 3 runtime versions advanced on confirmed quota exhaustion. The later 5b78e06 integration used a shared failure policy for Generation. The [preserved October 15 policy snapshot](../cases/model-selection-quality-availability/availability/failure-policy.ts#L1-L93) allows quota exhaustion, rate limiting, temporary unavailability, transport failures, and timeouts to reach an independent provider; authentication, configuration, invalid request, and invalid response end Generation without advancing. [Policy tests](../cases/model-selection-quality-availability/availability/failure-policy.test.ts#L1-L46) preserve the stage-specific conditions.

Explicit model evaluation retained one-target execution with retry disabled. The [fixed-input runner](../cases/model-selection-quality-availability/evaluation/fixed-input.excerpt.ts#L46-L98) clones evidence, checks each dispatched prompt, records provider identity/options and response/validation metadata, and continues to the next explicitly selected candidate after a failure. [Selected tests](../cases/model-selection-quality-availability/evaluation/fixed-input.excerpt.test.ts#L33-L100) exercise controlled option overrides, identical inputs, failed candidates, citations, and credential boundaries. Operational fallback and comparison are therefore reproducible as their respective execution contracts.

### October 15: compare Generation with fixed canonical evidence

Run e8fbc67f-9950-4c9e-92f6-c341a4f6ad6e ran from 22:00:09.922 to 22:04:29.995. Its execution HEAD was 3ec5bb5fec373cc59b234197d8f838188dcd62ff, while the Generation-only implementation was still uncommitted. Commit c5d615c at 22:31:13 archived the implementation and results. The archive's integrity record identifies 43 raw artifacts and ten implementation/document files; their SHA-256 values matched during this publication.

The corpus contained 27 sources and 372 chunks; question-bank canonical-portfolio content version 2 and full-40 profile version 1 fixed question membership. [Canonical snapshot construction](../cases/model-selection-quality-availability/evaluation/canonical-snapshots.ts#L36-L96) validates references against complete source chunks, preserves evidence/citation order, and hashes inputs. Expected claims and review metadata remain outside model input. [Snapshot tests](../cases/model-selection-quality-availability/evaluation/canonical-snapshots.test.ts#L1-L116) cover ambiguous/missing references, related/partial/unsupported evidence, deduplication, and rehashed drift.

The [Generation-only runner](../cases/model-selection-quality-availability/evaluation/canonical-generation.ts#L81-L153) verifies the whole snapshot and both credentials before dispatch, freezes target options, and writes per-case results and completion counters. [Runner tests](../cases/model-selection-quality-availability/evaluation/canonical-generation.test.ts#L61-L149) inspect 80 explicit mock calls, identical input, malformed/unavailable responses, credential preflight, and target drift.

Both models received identical question, ordered records, system instruction, and response schema. Gemini's output cap was 32768; Groq's was 4096 with medium reasoning effort. The run used zero query embeddings, vector searches, classifier calls, retries, and runtime fallbacks.

| Observation | Gemini 3.5 | Groq GPT-OSS |
|---|---:|---:|
| Generation attempts | 40 | 40 |
| Successful responses | 40 | 12 |
| Failed responses | 0 | 28, all HTTP 429 rate_limit |
| Successful-response JSON/schema/citation structural checks | 40/40 | 12/12 |
| Successful-response median latency | 3064ms, n=40 | 1855ms, n=12 |
| Successful-response mean latency | 5759.875ms, n=40 | 2098.833ms, n=12 |
| Manual semantic review | 32 pass / 6 minor issue / 2 strict fail | Not performed |

The [observed-results reconstruction](../cases/model-selection-quality-availability/evidence/october15-observed-results.json#L1-L2302) preserves every case's counters, input hashes, validation, latency, normalized failures, and source identities. Latency aggregates above were calculated from successful original results during publication. The October 15 run used its own evidence policy, options, prompt, and review rubric.

The [Groq client](../cases/model-selection-quality-availability/availability/groq-client.ts#L9-L40) classifies 429 and retains projected diagnostics; its [tests](../cases/model-selection-quality-availability/availability/groq-client.test.ts#L1-L44) cover request construction and error categories. Recorded Retry-After values ranged from 2–30 seconds; resetAfterMs ranged from 172800–1036800ms. The [projection](../cases/model-selection-quality-availability/availability/failure-policy.ts#L24-L93) stores the maximum of request/token reset headers. Original raw headers and error bodies were discarded. The exact exhausted limit remains unconfirmed; these retained values describe the recorded failure diagnostics.

### Accept the primary within the product's operating scope

The semantic rubric assessed question-level meaning, grounding, required claims, language, naming, basis, and citation alignment. Unsupported/related-evidence handling was correct in 8/8 cases; false-premise handling passed 3/3. The two strict failures were:

- QB22: source evidence supported absence of a mobile design, while the answer asserted that mobile verification had not occurred. Whether verification occurred was unconfirmed.
- QB35: the content and citations were supported, but the model answered in Korean despite an explicit Japanese-language request.

The recorded product decision retained Gemini primary and accepted the result without additional production-prompt changes. The developer treated QB22's stronger negative wording as an acceptable error for the present product, and Japanese instruction-following as outside the core quality priorities of a Korean-centered service. Benchmark ratings remained 32/6/2. The [reconstruction](../cases/model-selection-quality-availability/evidence/october15-observed-results.json#L1-L2302) preserves the actual two answers, review reasons, and the recorded product decision.

Groq semantic evaluation and failed-only resume were deferred after the incomplete comparison.

**October 16 operating judgment, preserved through user-supplied ChatGPT history search:** the developer reviewed whether to retain Gemini+Groq for the free public service, considering the earlier full40 quality comparison and the October 15 rate-limit results. ChatGPT described call capacity, rather than model eligibility, as the free-operation concern and cited limits including 8K TPM. That value is retained as information discussed at the time; its exact account/model applicability was not independently established. The precise limiting quota behind the October 15 429 responses remains unconfirmed.

The developer distinguished Groq calls after a Gemini primary failure from using Groq as the main generator. On that operating basis, the developer retained Gemini 3.5 primary → Groq GPT-OSS 120B fallback. The [clarification record](../cases/model-selection-quality-availability/evidence/developer-clarification-20261029.json#L1-L184) separates this search-based operating judgment from both experiments and their original conditions. The original conversation URL and full messages remain unavailable.

On October 16 at 21:32:34, e700717 removed Cohere's evaluation/support paths while retaining the Gemini 3.5/Groq pair. [Case 03's retirement judgment](#retirement-decision-benefit-relative-to-scale-and-operating-cost) supplies the scale, substitutability, and cost context; Case 06 ends with the selected Generation lineup.

### Source levels, publication choices, and remaining questions

Configuration changes and published historical source are code-confirmed. Original October 3 requests, responses, manual ratings, exact options, correspondence between both runs, and the additional reasoning comparison were directly checked. October 15 results and archive hashes were also directly inspected; semantic ratings and product acceptance remain preserved manual-review records. Developer-provided ChatGPT search records retain the initial September 26 switch rationale/five-test report, October 3 discussion/usage report, and October 16 fallback-retention judgment at their search-evidence level. October 3 Codex stop conditions and setting-retention decisions were separately confirmed in original user-input history. The October 29 capacity rationale, recalled quota depletion, and broader external-reaction memory remain attributed later statements.

Remaining gaps are provider-side individual request deductions, other account activity, monetary billing, the original Qwen failure ledger, the original ChatGPT conversation/AI Studio screenshot, and other external posts recalled by the developer. Groq’s October 15 semantic quality and exact limiting quota remain unconfirmed. Recovered October 3 responses, options, request correspondence, and historical limits retain their respective record dates.

Whole-file Excerpts keep small, coherent implementation/test units: baseline quota handling, canonical evidence/runner contracts, and transport/diagnostic behavior. Partial Excerpts isolate fixed-input comparison and the adopted runtime's regressions, preserving original statements, imports, and references. The common policy is retained whole because its fallback eligibility, header/body parsing, and safe projection work together. Reconstructed JSON selects original settings/results and labels editorial grouping, aggregate calculations, earlier transcriptions, and later developer testimony. The two selected generated answers preserve actual failure evidence; full knowledge payloads and credentials remain private. No Mixed source was needed.

<details>
<summary>Source snapshots, excerpt ranges, hashes, and reconstruction inputs</summary>

Original paths are relative to private Synethos. Ranges identify original snapshot lines; public links use public-file lines. SHA-256 values hash file bytes.

| Public file / form | Original commit / path / lines | Original SHA-256 → public SHA-256 |
|---|---|---|
| [baseline/generation.ts](../cases/model-selection-quality-availability/baseline/generation.ts#L1-L126)<br>Excerpt · whole original | `2e02e710421abfda880339d7692654e7c69178de`<br>`sveltekit/src/lib/server/gemini/generation.ts`<br>1–126 | `2fa335e96fa837c7d93c4b0172737c705bc42c216598d571ab9fca137928a881` → `2fa335e96fa837c7d93c4b0172737c705bc42c216598d571ab9fca137928a881` |
| [baseline/generation.test.ts](../cases/model-selection-quality-availability/baseline/generation.test.ts#L1-L163)<br>Excerpt · whole original | `2e02e710421abfda880339d7692654e7c69178de`<br>`sveltekit/src/lib/server/gemini/generation.test.ts`<br>1–163 | `93138049a1cb84db68a04d34a08dafc8c41433d7911757963c615f6d06c88d9f` → `93138049a1cb84db68a04d34a08dafc8c41433d7911757963c615f6d06c88d9f` |
| [baseline/generation-fallback.ts](../cases/model-selection-quality-availability/baseline/generation-fallback.ts#L1-L70)<br>Excerpt · whole original | `2e02e710421abfda880339d7692654e7c69178de`<br>`sveltekit/src/lib/server/gemini/generation-fallback.ts`<br>1–70 | `310aaf1b28ec988a48ddf7d52d53017ee9f7866b4952dc2ef5c7d68b3437403c` → `310aaf1b28ec988a48ddf7d52d53017ee9f7866b4952dc2ef5c7d68b3437403c` |
| [baseline/generation-fallback.test.ts](../cases/model-selection-quality-availability/baseline/generation-fallback.test.ts#L1-L52)<br>Excerpt · whole original | `2e02e710421abfda880339d7692654e7c69178de`<br>`sveltekit/src/lib/server/gemini/generation-fallback.test.ts`<br>1–52 | `e8f5f9ccc76cd484b719cac157b6f0e20cc4698b979928f859d35bec0dfe055d` → `e8f5f9ccc76cd484b719cac157b6f0e20cc4698b979928f859d35bec0dfe055d` |
| [evaluation/canonical-snapshots.ts](../cases/model-selection-quality-availability/evaluation/canonical-snapshots.ts#L1-L96)<br>Excerpt · whole original | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc`<br>`sveltekit/src/lib/server/retrieval/evaluation/canonical-snapshots.ts`<br>1–96 | `25dc842bad7e7497950536b98662a9a8151d9d2096552c2d2758faf8d3182af2` → `25dc842bad7e7497950536b98662a9a8151d9d2096552c2d2758faf8d3182af2` |
| [evaluation/canonical-snapshots.test.ts](../cases/model-selection-quality-availability/evaluation/canonical-snapshots.test.ts#L1-L116)<br>Excerpt · whole original | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc`<br>`sveltekit/src/lib/server/retrieval/evaluation/canonical-snapshots.test.ts`<br>1–116 | `5b105c81336a52d9b587e217d6e8184a229cc19dc87baf605e4cb9031f0d0f1d` → `5b105c81336a52d9b587e217d6e8184a229cc19dc87baf605e4cb9031f0d0f1d` |
| [evaluation/canonical-generation.ts](../cases/model-selection-quality-availability/evaluation/canonical-generation.ts#L1-L153)<br>Excerpt · whole original | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc`<br>`sveltekit/src/lib/server/retrieval/evaluation/canonical-generation.ts`<br>1–153 | `5258541cd9a440f233daf4a97de3928d9160bf7544e0b425a46d46c1dd2697d6` → `5258541cd9a440f233daf4a97de3928d9160bf7544e0b425a46d46c1dd2697d6` |
| [evaluation/canonical-generation.test.ts](../cases/model-selection-quality-availability/evaluation/canonical-generation.test.ts#L1-L150)<br>Excerpt · whole original | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc`<br>`sveltekit/src/lib/server/retrieval/evaluation/canonical-generation.test.ts`<br>1–150 | `12676305deb43720e288736e24a5a8fce5b22299f469578ab86f1228588a3d01` → `12676305deb43720e288736e24a5a8fce5b22299f469578ab86f1228588a3d01` |
| [evaluation/fixed-input.excerpt.ts](../cases/model-selection-quality-availability/evaluation/fixed-input.excerpt.ts#L1-L98)<br>Excerpt · selected ranges | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc`<br>`sveltekit/src/lib/server/retrieval/evaluation/run.ts`<br>1–33, 46–56, 70–121 | `2a3a27ff55ee3c44bfd665d1719b2d4f7fa78bb7a2dc3f98b2319383de52c89c` → `b10cf9a10fa62ecfd12b83331a8c61b1001d22a76deff7e6513900fe6c035de5` |
| [evaluation/fixed-input.excerpt.test.ts](../cases/model-selection-quality-availability/evaluation/fixed-input.excerpt.test.ts#L1-L100)<br>Excerpt · selected ranges | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc`<br>`sveltekit/src/lib/server/retrieval/evaluation/run.test.ts`<br>1–31, 34–73, 86–112 | `76de31ab091cc434102466920931857aff7d5e11e95fb636c54399a9a62610c6` → `86822df00bbe40fef8549fb9547138eadc2c1ec093e432b1178bb6e4826de536` |
| [availability/groq-client.ts](../cases/model-selection-quality-availability/availability/groq-client.ts#L1-L40)<br>Excerpt · whole original | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc`<br>`sveltekit/src/lib/server/providers/groq/client.ts`<br>1–40 | `fb8e094bd542acdbedd6898a04c12c74601a84ca9f868bf3f4669997c8e5fe9b` → `fb8e094bd542acdbedd6898a04c12c74601a84ca9f868bf3f4669997c8e5fe9b` |
| [availability/groq-client.test.ts](../cases/model-selection-quality-availability/availability/groq-client.test.ts#L1-L44)<br>Excerpt · whole original | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc`<br>`sveltekit/src/lib/server/providers/groq/client.test.ts`<br>1–44 | `c8188ed8c687101a23fbfd5bf600e83d3901d6b49b88e89bba9d782678ff1edf` → `c8188ed8c687101a23fbfd5bf600e83d3901d6b49b88e89bba9d782678ff1edf` |
| [availability/failure-policy.ts](../cases/model-selection-quality-availability/availability/failure-policy.ts#L1-L93)<br>Excerpt · whole original | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc`<br>`sveltekit/src/lib/server/providers/failure-policy.ts`<br>1–93 | `a9d15fa419fa650f396050a879085398141152088397df5284d4966bf6560af2` → `a9d15fa419fa650f396050a879085398141152088397df5284d4966bf6560af2` |
| [availability/failure-policy.test.ts](../cases/model-selection-quality-availability/availability/failure-policy.test.ts#L1-L46)<br>Excerpt · whole original | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc`<br>`sveltekit/src/lib/server/providers/failure-policy.test.ts`<br>1–46 | `20484a0a6bd6dbc11079b434c2b817250a24ef105fe160db546214d1a94101b3` → `20484a0a6bd6dbc11079b434c2b817250a24ef105fe160db546214d1a94101b3` |
| [runtime/groq-fallback.excerpt.test.ts](../cases/model-selection-quality-availability/runtime/groq-fallback.excerpt.test.ts#L1-L93)<br>Excerpt · selected ranges | `0baebd9f242d88ffa15ef1953204c391ae97e623`<br>`sveltekit/src/lib/server/generation/orchestrator.test.ts`<br>1–26, 29–94 | `b14c3609ddc9b572f5d30caf2b1748bc9904166ffbf0380bf162448e5dbf5024` → `605f8bfae3d99425f5ad72d7330a9313a69297df277fbb65413e2ef5baff9092` |
| [evidence/model-selection-history.json](../cases/model-selection-quality-availability/evidence/model-selection-history.json#L1-L242)<br>Reconstructed | Reconstructed; inputs below | `c63e9034f76e2e24b41cb0f5fd20b2bab45badf7558bb39abfff598bc33e5223` |
| [evidence/october03-reported-results.json](../cases/model-selection-quality-availability/evidence/october03-reported-results.json#L1-L4095)<br>Reconstructed | Reconstructed; inputs below | `a5fef1700b72c31ce09a565f2273077858a67cd00d0a603120d387d393b61875` |
| [evidence/october03-reasoning-results.json](../cases/model-selection-quality-availability/evidence/october03-reasoning-results.json#L1-L1709)<br>Reconstructed | Reconstructed; inputs below | `49b5f81c218db20296ef99e42b3eb74d29c2680c7bf684fe413df2e82c4f72b2` |
| [evidence/developer-clarification-20261029.json](../cases/model-selection-quality-availability/evidence/developer-clarification-20261029.json#L1-L184)<br>Reconstructed | Reconstructed; inputs below | `d209fd34242c8932f6488f187a56f37bfbffa77e90f78ef032887c261c0f3069` |
| [evidence/october15-observed-results.json](../cases/model-selection-quality-availability/evidence/october15-observed-results.json#L1-L2302)<br>Reconstructed | Reconstructed; inputs below | `927ed5e3880e8915d0865cbdb44d6cb834f89b67c137a7df3b4b248e2ae910e8` |

| Reconstructed file | Input / verification |
|---|---|
| `evidence/model-selection-history.json` | `9a3df6134f3a68c012d98afa9fdc5f7f7cf5b264` / `config/mosaic.json`<br>`f07359812518b6b75962f60e1f179856dc4d091602b123e96b9d2737b7ec6c6a` |
| `evidence/model-selection-history.json` | `2e02e710421abfda880339d7692654e7c69178de` / `config/mosaic.json`<br>`fc69844b39f33334e553633d73cf7ed9fd3ca8d7c94aac59d316552967b42f8c` |
| `evidence/model-selection-history.json` | `b00bf595439bd71540ace4e34d6f56a803eb5719` / `config/mosaic.json`<br>`19976e438024e926ccdf1453c7d4145d9bdf1f52677b0fad4a1aa798f4061488` |
| `evidence/model-selection-history.json` | `4125443b5de06bea988b9776a4e85d8a5d608a1b` / `config/mosaic.json`<br>`15c76f86c442b6e34f53d6c95e6daea4634efd983558e6fe890703188010dbab` |
| `evidence/model-selection-history.json` | `180cc306fafc191a21ea4f6886b48c0d1913b882` / `config/mosaic.json`<br>`637b4dbb6c73ef341e549dd44d0b2338dfe7bee938797bb0a6a666b54a08e63c` |
| `evidence/model-selection-history.json` | `0baebd9f242d88ffa15ef1953204c391ae97e623` / `config/mosaic.json`<br>`6184230713d6717c9c702f39b75f4de77b7a90f1e81654922e59dc3210fb6b27` |
| `evidence/model-selection-history.json` | `5b78e06e889eb888aa8a92ccb6f9e0a05c0004e3` / `config/mosaic.json`<br>`efb42607955c7ff9f1ac55c79d4e0df3a88eb791897402940ae7e2168bb587b8` |
| `evidence/model-selection-history.json` | `e7007172cc7a5171948659c4f1ceb6fd65dd1332` / `config/mosaic.json`<br>`fade19dc3b7d4080c23a66518e4716b9419f6af70e377e573958216bf65dee20` |
| `evidence/october03-reported-results.json` | `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218` / `docs/research/synethos-development-history.md`<br>`31c98a7c6b2fe222ca9b116130a857c316008b8cb79550425aba50e491ebd2a3` |
| `evidence/october03-reported-results.json` | `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218` / `docs/research/synethos-evidence-register.md`<br>`6f173ba83687e68daaa115623404e159af8efa37fc454c0e42559e761303bdf7` |
| `evidence/october03-reported-results.json` | HOME06-3WAY/HOME06-PRIOR/HOME06-RETRY/HOME06-LEDGER/HOME06-DECISION/HOME06-QUOTA in the [recovered-source register](evidence/recovered-source-register.json): original hashes, 120 results and 24-call correspondence checked 2026-10-29. |
| `evidence/october03-reasoning-results.json` | HOME06-REASONING/HOME06-REASONING-METRICS/HOME06-REASONING-EXECUTION in the [recovered-source register](evidence/recovered-source-register.json): report/metrics/execution hashes and 77 request/response/review projections. |
| `evidence/developer-clarification-20261029.json` | `Tessera case 06 user statements and ChatGPT history-search results supplied on 2026-10-29`<br>Direct statements and user-delivered search results in this task; original ChatGPT messages unavailable, no Git object or file hash. |
| `evidence/developer-clarification-20261029.json` | `https://discuss.ai.google.dev/t/handling-429-503-errors-from-the-gemini-api/124640/79`<br>Public forum user report directly inspected on 2026-10-29; model/tier/sample identified in the record. |
| `evidence/developer-clarification-20261029.json` | `https://discuss.ai.google.dev/t/persistent-37-unavailable-503-on-generatecontent-with-gemini-3-6-flash-paid-tier-1-zero-429s-counttokens-unaffected/179971`<br>Public forum user report directly inspected on 2026-10-29; model/tier/sample identified in the record. |
| `evidence/developer-clarification-20261029.json` | `https://discuss.ai.google.dev/t/gemini-api-503/183913`<br>Public forum post dated 2026-09-21 directly read on 2026-10-29; user report and reply. |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/manifest.json`<br>`beefae97c6d92daa61cf630567eab26ea03f7b531f0303c7694f652d36f25cc8` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/snapshot.json`<br>`0aef25fe6b4226db4dbac75d903fa85c3b3a37a1886ac04e0ecb9a2b17bed36b` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/completion.json`<br>`ac5cd3763ee762907373eb7a074683dd3b4333d16a9f280003645a9f249b2fd9` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/integrity.json`<br>`a5c41d1f91e86a4f6d8290b8cf16775dd4b0d545ecc80cc1c46fbcf8bcac4030` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/gemini-semantic-review.json`<br>`af58f37e7f5019919a14445fc9a3ed30390060914e6d5e7720d0c6c509b9c23b` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/groq-rate-limit-diagnostics.json`<br>`44ce34e99d43ef5eadfcef44196c4772202fb5e1b80d34a526b9cb34bcd29e5b` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/report.md`<br>`1f302132c301dc642338846b8de05bef3aa75bd2e950a8a60c40884c6c627aa0` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB01.json`<br>`1ef7e0d3c919214e0724c6900fd859236c7595cf9a7913da9518e66bfa5aa9db` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB02.json`<br>`31121ebe05fbcab075f629d745011f505af85251a048831de8669eeb27271fee` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB03.json`<br>`52ecffbe064d5f38f5be34859d41b24ebc202360c4e291dd9ab72e8fa99ac02f` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB04.json`<br>`6eae76b6b6b94c4b99e710f560f2bfa5504a708cb54c7a7ea89aa181b5eb2380` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB05.json`<br>`e1d5e354fce99deb18fce53ce2b560365d1d004d14bd6f04b14381b8c4830349` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB06.json`<br>`0cdb98f322bff08f4aeb4829600bbf0e8de564eb15b7ff18d6dd2ec8800b3c23` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB07.json`<br>`b14f85300369fe5133f2dd5a43a671e65e288dabe9295e9fcaf696478ca512d4` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB08.json`<br>`10159c5698b88b60ce4379ae5535761efda3871c707cc27caff986db0d0a458f` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB09.json`<br>`8b6cc09b43dcc532ee8c98561d7a7e48a0cf7a6eb65ae0b636b1899693dfa7ae` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB10.json`<br>`a936fafb7a32ce42c40c7b7ea18cda848fde0636fa750d3893c0d01230e5e852` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB11.json`<br>`d5f90c4a6197536ebd2db7256dd2dcb8be9d060f4d5a3fce9532d50ee6e4222e` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB12.json`<br>`6fda35b810c5ae84373938f898296608b0ffa9a2f363d7272d5212818025a6e5` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB13.json`<br>`f1e5019d9f046b50341d177d6f7132e3de506fd5753f75d93a3c0232fe601ed5` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB14.json`<br>`ab6b9b8c21bef767c911d4858b9ce85f427c7e20c1283fc2e41c5c617028386c` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB15.json`<br>`9ebd07f19053ad0d5ff0019a77ac059f75e8257a6fd35e247f40f0cfec5c15ea` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB16.json`<br>`e04ab0e22834f23c9aa1260a54a54c35752c6693afe2d60125db2e28f4bbf350` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB17.json`<br>`e26fbfe77888b76f88566bd414276754ff952c4b39b67372ab235d9b2de6e88e` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB18.json`<br>`4de94eab427c464fbf0491c8dae67e6308d9f24ac8aa32942c9667f8cbb3bd15` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB19.json`<br>`bed812cf9a90a34e2363bb4d5182174e9ea711e2b614107991118b9f70dcc6e7` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB20.json`<br>`a0c91cb32fa46dbca88e1fb7136084db67631537edda3454204d94eb0051d690` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB21.json`<br>`9173b5113747352d379727d425c89a915b61323ff1c92b13859f7eff5395e6ca` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB22.json`<br>`73fedfc7b2a6e55889ded8aefb0f38a5327f87280d8b5281e7ac34a106014416` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB23.json`<br>`768f4ce6b8b84a884c736446bc98f05c8846a187e74a09045394f9cfc114345e` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB24.json`<br>`2fb72b2e9750cd1782b1513ab18ad8f8126e2e94ee8ba55c33d80fe03ea315d2` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB25.json`<br>`d92bb1aaead13e640acd8b03a7875fe18872dc86d5adffb69d4ce1b1334e47ed` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB26.json`<br>`7102c08cac927be9ea9ee523482def55e0725b20a0c2457085dfddbc57c72b21` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB27.json`<br>`f02a9acd4d9d204f9185a0498191a26b48f6bb1a8da86bb9c3f29f5abd3f83dc` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB28.json`<br>`fa7985728576bf70fbd75171ac18a874deda0c785b09e74811e14ae35501bb4c` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB29.json`<br>`cf3e8a641a38d245fe34f8e0685417ed59e31a0d46e2d3a92aaf5987dcaf9964` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB30.json`<br>`a886534af60796d7c91f69f5d9286c2317407c6a78d23f11b55d476447896a1a` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB31.json`<br>`d98386d20c968ad0e7c0bf362a16fdfe2ef448ee4a37eb9a5ae6e68cb754241b` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB32.json`<br>`62c2d73adec91771cb5fb51e48af546b4610e483797413b00f87d777cc74dc71` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB33.json`<br>`f85847675aca4bc4f13c555473cc25056c40bb5478e7e90ef6870f7ffcbaec8f` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB34.json`<br>`a156242bc05316348ce98350039486f74be5da7f29aa577fcb47c397484b3139` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB35.json`<br>`1cce041ee0d479a04377df807fad617469ce11d6a40295289bc4fbb0c7d844d7` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB36.json`<br>`bdc9dbd6ed0ae6f018a5ae22768ce6327b84b985100333369a6c12415576b726` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB37.json`<br>`abfd533b39111cc80a1355908487eba8df4eadaca89d1f866947e32f042f5d09` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB38.json`<br>`e81ff2a49578a4087e481359bbac72e97a98109c2650a83838872d691b138ce5` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB39.json`<br>`7e08a96ab034ae1e444e611908ebc0fb2a49c24e3dc07f3c578cbc6773a9032c` |
| `evidence/october15-observed-results.json` | `c5d615c6d4068a14daaa841c15dc8992ffda2fdc` / `docs/evaluation/generation/2026-10-15/results/QB40.json`<br>`cf5b2a0f0580870e1b8b81b8d847bd132200a61342c948c1d05dbffa3ecae113` |

</details>

### Publication checks

Twelve whole-file Excerpts matched their Git source bytes; three partial Excerpts matched every declared source range. All 15 TypeScript files passed syntax parsing. The original four JSON reconstructions passed parsing, 57 hashed-input comparisons during initial publication preparation, configuration projection, original-result aggregation, representative-response comparison, and source-linkage checks. The October 15 archive’s 43 raw files and ten implementation/document files matched their recorded SHA-256 values.

The reconstructed counts were checked against all 40 case results, including 80 single Generation dispatches, 52 successful structural results, 28 rate-limit failures, success-only latency statistics, and the manual 32/6/2 ratings. The seven October 3 search times, three approximate September 26 times, October 16 operating judgment, AI Studio 17/20 report, and developer quota inference were checked for consistent attribution. The 8K TPM discussion and unresolved October 15 quota cause retain separate scopes. English/Korean code and external-reference targets and hashes match. All 622 local links passed file, heading, and line-range validation. The 112 published files in cases 01–05 were preserved at that stage. Subsequent textual evidence additions are covered by the additional checks below.

New code, selected responses, and document sections were reviewed for credential values, private knowledge payloads, private repository URLs, local user paths, and operational access details. Verification used historical source inspection, local parsing/calculation, and direct reading of the linked public forum post. Historical application tests, model calls, index builds, and live server access were not performed.

### October 29 recovery and additional verification

Nineteen representative originals and all 1146 files across five experiment directories were checked through byte hashes. Text hashes and UTC/KST times were verified for eleven archived-session messages and fourteen original user inputs. Case 01’s six runtime files, the case 03/04 archive, and case 06’s three previously registered report/decision files matched their recorded hashes.

All 120 full40 requests, responses, results, and historical manual reviews, 24 prior/retry ledger entries, and 77 reasoning requests were cross-checked. Request-body hashes, response correspondence, classification counts, and successful-request latency were verified. Reasoning requests matched baseline shared inputs and differed only in the reasoning option. GPT-OSS high quality denominators were verified as 36 successful questions, 44 required claims, and 33 positive questions, separate from attempted-review totals that include failed QB37.

All fourteen public JSON files parsed. English/Korean file/external links and SHA-256 multisets matched. The two READMEs and two development records passed validation of all 656 local file, heading, and line-range links. The existing 119 source/test files and Synethos originals were preserved; the Synethos working tree was clean. Existing-file changes cover two development records and two evidence JSON files; a reasoning-evidence JSON and shared recovered-source register were added. Published material was checked for credential values, local user paths, private repository URLs, and full knowledge payloads. Verification used original-record inspection and local computation; no new model call, historical experiment rerun, application test, index build, or server access was performed.

## 07 — Knowledge–Index Consistency and Recoverable Deployment

**Development period:** 2026-10-22 ~ 2026-10-26. The developer directly clarified operating constraints, retention choice, and design delegation on 2026-10-29.

**Code classification:** Excerpt — one whole original file and three partial selections; Reconstructed — three evidence records.

**Outcome:** operations retained a total of three releases within limited server space, switching/restoring application code, Knowledge, and Index together. The developer provided the environment, materials, constraints, and retention policy and delegated detailed deployment design/implementation to AI. The approved October 26 deployment activated a new release and verified readiness to restore the previous version.

### Operating environment and usable space

Synethos ran on a Naver Cloud free-tier Ubuntu server with Cloudflare Tunnel already in use. October 22 Git documentation records systemd operation, separately prepared Linux production dependencies, and the existing Tunnel’s Ubuntu connector/public-service verification. The observed October 26 environment was Ubuntu 24.04.1 and Node v24.22.1.

**Operating experience directly clarified by the developer on October 29:** the nominal 10GB initially seemed fully usable. After the operating system and accumulated security updates, available space was approximately 3–4GB. The provisioned environment’s security patches were also out of date.

| Historical source | Recorded space |
|---|---|
| Original tool output, October 26 21:04:59.201 | Filesystem 9.8G, used 6.0G, available 3.3G, 65% usage |
| Same-day predeployment report | 3,516,506,112 available bytes, approximately 3.28GiB; existing releases approximately 38MiB each |

This measurement corroborates available space within the developer’s stated range. Per-OS/update byte attribution and initial before/after measurements were not recovered. The [constraints and decisions evidence](../cases/knowledge-index-release-consistency/evidence/decisions-and-constraints.json#L1-L119) separates historical measurements from the later developer account.

### Total three releases: developer choice and AI design

The developer explained choosing a total of three releases, adding one to the initially considered total of two under the space constraint. Three was an operating choice, rather than the result of a detailed optimization calculation. The approximately 38MiB release measurement is not used to derive that choice.

The earlier October 26 server script already contained a three-release policy; the original 21:22:05.529 developer request explicitly retained the latest three after success. The original two-to-three conversation was not recovered. Its rationale and design delegation are attributed to the October 29 direct clarification at that later date.

| Actor/source | Established role |
|---|---|
| Developer direct clarification | Provided environment/materials/constraints, chose total three, delegated detailed design/implementation to AI |
| October 26 developer request | Retain the existing release structure, switch/restore Knowledge and Index together, check Linux dependencies, preserve environment/Tunnel |
| AI design/implementation | Specify manifest/hash checks, candidate preparation, service-account checks, atomic activation/failure recovery, retention ordering and deletion safety |

Adopting an existing structure as a later requirement is distinguished from first devising it. The release count is attributed to the developer; the checks and switching procedure implementing those conditions are attributed to AI’s detailed design.

### Earlier deployment issues and the new candidate

The original October 26 developer request required preserving earlier fixes to Linux production dependency file/directory access and the active Knowledge/Index root. The prior server script also contained post-install permission normalization, service-account dotenv/@google/genai imports, and current-root checks. The first exception, exact occurrence time, and repair-approval text were not recovered.

The requirement to avoid copying Windows dependencies directly to Linux is in the October 29 developer account. The actual archive contained no node_modules, and Ubuntu prepared/checked Linux production dependencies. The Windows-copy constraint and the confirmed Linux permission issue retain their respective evidence.

The previous deployment script was fixed to a particular release, commit, index, and 382 chunks. The new candidate changed approved documents and index to 28 sources/381 chunks. Its old same-content conditions could not simply be reused; the developer requested a reusable procedure independent of one candidate.

### Bundle code, Knowledge, and Index into one release

The [bundle implementation](../cases/knowledge-index-release-consistency/release/bundle.py#L1-L82) packages approved-manifest Knowledge, Index, configuration, application build, package, and lockfile into one candidate. Its manifest connects sourceCommit, release, file sizes/SHA-256, and index identity. Credentials and Windows node_modules are excluded. Candidate verification and activation use this release unit.

| Stage | AI-implemented behavior |
|---|---|
| Preparation | Check expected existing release, archive/manifest/payload/source commit, Node compatibility, available space, and protected configuration |
| Linux preflight | Normalize permissions after production dependency installation; check imports and compiled index loading with the service account/actual environment |
| Activation | Atomically replace current, restart service, check actual root/cwd/loaded index/internal and external health/homepage |
| Activation/verification failure | Restore previous link, restart, and reverify the previous release and its Knowledge/Index |
| Post-success retention | Keep active, previous, and newest other; check deletion paths and process use before removing others |

The [permissions/activation/recovery excerpt](../cases/knowledge-index-release-consistency/release/activation.excerpt.py#L1-L40) normalizes installed access permissions after a restrictive umask. switch uses a temporary symlink and os.replace; activate restores the previous link and runs restart/rollback_verify when post-switch restart/verify fails. Preparation failure leaves the active release in place.

The [retention/deletion-safety excerpt](../cases/knowledge-index-release-consistency/release/retention.excerpt.py#L1-L30) implements total three as active/previous/newest other. Cleanup follows successful verification and checks paths outside the release root, symlinks, and in-use process cwd/executables. Cleanup failure leaves the verified active release running and requires follow-up.

Index identity and loader contracts connect to case 05’s [manifest verification](../cases/cross-pc-index-portability/production/verify-manifest.excerpt.py#L23-L56) and [runtime probe](../cases/cross-pc-index-portability/production/probe.mjs#L1-L43). This case focuses on binding those materials into one operating release and switching/restoring them under the selected space/retention conditions.

### Original requests, declarations, approvals, and execution

| KST time | Event/actor |
|---|---|
| October 22 | Git operating document reports Ubuntu/systemd, separate Linux dependencies, and existing Tunnel operation |
| October 26 around 21:10 | Tool output reads the prior server script’s permission checks, active-root checks, and three-release policy |
| 21:22:05.529 | Developer requests reusable deployment, preservation of earlier fixes, Knowledge/Index consistency, Linux preflight, and total three |
| 21:28:01.646 → 21:28:25.746 | AI implementation/verification/candidate declaration → developer approval |
| 21:39:59.309 / 21:42:03.125 | Original Linux deployment safety outputs each show eight passing tests |
| 21:44:39.175 → 21:48:38.896 | AI candidate results/Git declaration → developer commit/push approval |
| 21:49:10 | 4fddd61 commits reusable deployment implementation and records |
| 21:51:33–21:51:48 → 21:52:55.532 | AI declares exact switch/verification/recovery/retention scope → developer production approval |
| 21:59:22.934 | AI completion report: new release, actual index/health, total three, and restoration readiness |

Requests, declarations, and approvals were directly read in original session 01a177b0-1d84-7cc0-aedb-4a06f6d9c661. The [source register](../cases/knowledge-index-release-consistency/evidence/source-register.json#L1-L385) preserves UTC/KST timestamps, roles, and message-text hashes. Other test changes in 4fddd61 belong to their separate scope; this case selects deployment design and operating results.

### Actual operation and restoration verified in tests

The [observed-results projection](../cases/knowledge-index-release-consistency/evidence/deployment-observed-results.json#L1-L78) compares original deployment JSON, logs, completion report, and archive. The retained approved deployment script matches the Git original bytes/SHA-256.

| Actual October 26 observation | Result |
|---|---|
| Active release/source commit | 20261026-4fddd61-01 / 4fddd619640fbbf77fbc58f2a80e8aaa2065f231 |
| Actual loaded data | 28 sources/381 chunks; candidate index/corpus identities match |
| Linux dependency imports/active root/process cwd | Checks passed |
| Internal/external health/homepage | HTTP 200/200/200; application/existing Tunnel reported healthy |
| Actual retention | New/189cf00/876ea52, total three; 8fa463e removed after successful verification |
| Restoration readiness | Previous 189cf00 loader/import preflight and rollbackReady confirmed |
| Production rollback/provider calls | Rollback unnecessary/zero calls |

During publication preparation, the retained archive was read in memory and its archive/manifest hashes and all 112 payload file sizes/SHA-256 compared. All matched, with zero node_modules/evaluation-fixture entries. Ordinary 1033-pass/4-skip tests and passing static checks/build remain historical candidate-code verification. Health/loader success and semantic answer quality concern different verification targets.

The [rollback/retention test excerpt](../cases/knowledge-index-release-consistency/verification/rollback-retention.excerpt.test.py#L1-L65) injects failure while using an actual POSIX symlink and synthetic Knowledge/Index files, checking restoration of both old contents. Separate assertions check retention ordering. The historical eight-test Linux pass includes these checks. The production deployment succeeded, so automatic rollback was unnecessary. Operating evidence establishes new-release consistency and readiness to restore the previous release.

During the October 26 deployment, Cloudflare returned HTTP 403 for default Python urllib User-Agent requests. The same health checks returned 200 with an explicit deployment client identity. Existing security settings, health checks, and the approved archive/manifest/deployment-script hashes were preserved.

### Evidence scope and remaining questions

Operating constraints, the two-to-three rationale, and design delegation are the October 29 direct developer account; October 26 requirements/approvals are original messages; detailed design is the historical AI declaration/code; operating state is historical tool output/verification JSON. Initial server-provisioning/security-update logs and before/after space measurements, the original two-to-three conversation, the early Windows-copy requirement, and original Linux/root failures/repair approvals remain unavailable.

Code selections explain the mechanisms behind the constraints and results. Partial excerpts join declared ranges with one blank line, preserving original statements, identifiers, and references. Original application references remain, including retention’s ROOT and the tests’ deploy.py import. Private Knowledge, question-bank text, credentials, access information, protected-setting contents, full operating commands, and complete conversations remain outside publication.

<details>
<summary>Original sources, ranges, and SHA-256</summary>

| Public Excerpt | Original commit/path/original lines → public lines | Original SHA-256 → public SHA-256 |
|---|---|---|
| [release/bundle.py](../cases/knowledge-index-release-consistency/release/bundle.py#L1-L82) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/bundle.py`<br>1–82 → 1–82 | `d0e38d5162f8309eecd6f44673aed6f0d8e9425e0292d342f42f62f1c37af33e` → `d0e38d5162f8309eecd6f44673aed6f0d8e9425e0292d342f42f62f1c37af33e` |
| [release/activation.excerpt.py](../cases/knowledge-index-release-consistency/release/activation.excerpt.py#L1-L40) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/deploy.py`<br>6–6 → 1–1; 22–24 → 3–5; 98–131 → 7–40 | `8ec2db16cac2a5c77b46662ade526e779eca51c9c47fee517c4e1cb595a230ad` → `11fdfdc060ffe222fbbf2e821d7a6d1e308471840805f9129bbd22ef445aea8e` |
| [release/retention.excerpt.py](../cases/knowledge-index-release-consistency/release/retention.excerpt.py#L1-L30) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/deploy.py`<br>7–7 → 1–1; 22–24 → 3–5; 173–196 → 7–30 | `8ec2db16cac2a5c77b46662ade526e779eca51c9c47fee517c4e1cb595a230ad` → `77723432da30fa2382dae6a97ce48d972e388c6f2078683e66041db613138f82` |
| [verification/rollback-retention.excerpt.test.py](../cases/knowledge-index-release-consistency/verification/rollback-retention.excerpt.test.py#L1-L65) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/test_deploy.py`<br>1–28 → 1–28; 122–157 → 30–65 | `07ceb585168a3e8a717fd6b520850a56bd7a748617323139f578481596548914` → `525e2fe3a8d94b32c1fabe0f65032427f4268a3df17c76194984572c6a6c96a1` |

| Public evidence | Classification | SHA-256 |
|---|---|---|
| [evidence/decisions-and-constraints.json](../cases/knowledge-index-release-consistency/evidence/decisions-and-constraints.json#L1-L119) | Reconstructed | `ccd5b7bd9c248ea3fdb3a61a1fd44b0512128e46d37ded2349bd5ffe584dfcbc` |
| [evidence/deployment-observed-results.json](../cases/knowledge-index-release-consistency/evidence/deployment-observed-results.json#L1-L78) | Reconstructed | `4d6ec007c67cfd014471053f9bd02761417a82c2ffc3c8e1b5e96aaf5146a899` |
| [evidence/source-register.json](../cases/knowledge-index-release-consistency/evidence/source-register.json#L1-L385) | Reconstructed | `0195a7c968cd0f7224c3cee20b5b21b6913da297f55f92ce4fe617fb425b67e2` |

Original paths are private Synethos repository-relative paths. The source register links 4fddd61 documents/deployment code, retained preflight/approval/execution/completion hashes, the full-session identity, and selected message hashes. Original materials containing server access/operating details remain private.

</details>

### Publication checks

All four complete/selected code extracts matched their originals; four Python syntax parses and three public JSON parses passed. Seven Git document/code/research hashes, eight retained-artifact hashes, the full-session hash, and ten selected message text hashes matched. All 112 archived payloads matched their sizes and SHA-256 values; runtime index identity and counts also matched the manifest.

The two READMEs and two engineering records passed file, heading, and line-range checks for 692 local links. English/Korean file and external-link targets and SHA-256 sets match. Cases 01–06 prose and 132 public files retain their baseline content. File comparisons normalized Windows checkout line endings.

Published code, evidence projections, and case 07 prose were reviewed for credential values, private Knowledge/QB payloads, private repository URLs, local user paths, and server access details. Verification used original inspection and local parsing/hash calculations. No new application tests, model calls, index builds, server access, or deployment were performed. The Synethos working tree remains clean and its originals are preserved.
