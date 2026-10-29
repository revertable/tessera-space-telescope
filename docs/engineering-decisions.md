# Engineering Decisions

[Tessera](../README.md) · [한국어](engineering-decisions.ko.md)

These records connect implementation code to the problems, experiments, and decisions that shaped Synethos. Dates refer to development events; all times below are Korea Standard Time (KST, UTC+09:00).

## Reading the evidence

- **Code confirmed:** behavior visible in the identified historical source snapshot, or the byte-for-byte source comparison used to prepare these excerpts.
- **Reported at the time:** a retained development request, experiment artifact, or verification report describes the observation. These observations retain their original execution conditions and verification scope.
- **Unconfirmed:** the available records do not establish the cause, correspondence, or broader effect.

Each case includes a source ledger identifying its code snapshots and retained evidence. Historical tests are published as implementation evidence; this repository does not provide their dependencies or a test runner.

## Contents

- [01 — From Local Qwen/Ollama Inference to the Gemini API](#01--from-local-qwenollama-inference-to-the-gemini-api) — 2026-09-26
- [02 — From GitBook MCP to Local Knowledge](#02--from-gitbook-mcp-to-local-knowledge) — 2026-09-26 ~ 2026-09-28
- [03 — Introducing, Evaluating, and Retiring Cohere](#03--introducing-evaluating-and-retiring-cohere) — 2026-09-28 ~ 2026-10-17

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

The following hashes identify retained artifacts as recorded in the existing research. The code hashes above were recomputed for this publication; the experiment files below were not rerun or all independently reverified for it. Raw files and complete transcripts are not included.

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

The original full40 directory is unavailable in the current checkout; its report identity and recorded hash are retained in the source ledger. This table remains a previously transcribed experimental report. The committed `0baebd9` configuration establishes the next runtime state: Gemini generation primary, Groq GPT-OSS fallback, and Cohere registered for explicit evaluation. October 1 subject retention, this full40 assessment, and the later retrieval diagnostic each retain their own measures and conditions.

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

**Recorded historical decision, October 16 at 21:02:47.996:** the earlier research transcribed a developer request recognizing Cohere’s retrieval quality and build speed/convenience while prioritizing free production operation. It recorded the then-understood Trial-key production restrictions and paid Production-key requirement, and the need for Cohere query embeddings in the same space even with a prebuilt index. The request compared development/evaluation-only retention with complete removal. The original archived session is unavailable at its registered path in this checkout; this account retains the earlier research’s transcription level.

**Developer clarification during publication preparation, October 29, 2026:** the developer explicitly stated that Cohere outperformed Gemini in some evaluations, but the observed difference at Synethos’s scale was too small to justify payment. The developer would have considered paid adoption if the performance advantage had been much larger or the service larger and more complex. The final judgment weighed the actual performance difference, service scale, substitutability, and operating cost together.

Complete removal reduced credential, adapter, separate-index, evaluation-matrix, and test maintenance. It also gave up live embedding fallback, faster development indexing, and direct reruns of the retained Cohere comparison paths. The performance observations above remain part of that tradeoff. The records contain no measured billing total or numerical cost/benefit threshold.

### Removal implementation and index handover

Commit `e700717` removed the Cohere HTTP clients/adapters and tests, factory registrations, provider options, configuration/example bindings, and current evaluation choices. The clients used native `fetch`. The [remaining embedding factory](../cases/cohere-lifecycle/after-removal/embedding-provider-factory.ts#L12-L24) supports Gemini; the [generation factory](../cases/cohere-lifecycle/after-removal/generation-provider-factory.ts#L17-L33) supports Gemini and Groq. [Option validation](../cases/cohere-lifecycle/after-removal/target-options.ts#L4-L25) and the [selected configuration tests](../cases/cohere-lifecycle/after-removal/runtime-selection.excerpt.test.ts#L22-L67) show the retained provider boundary and runtime selection.

Provider abstraction, historical comparison artifacts, common document-build progress logs, and Gemini-specific 22-second request-start pacing remained. Pacing addressed the separate document-build quota problem under investigation that evening. The recorded removal-completion report at 21:19:53.762 lists 939 passing tests, four existing skips, and successful static checks/build; the knowledge change left the Gemini index stale. The developer requested code first, excluding indexes, at 21:29:36.316.

On October 17 at 22:19:07.357 the developer reported a successful rebuild and CURRENT status. Commit `033e02f` at 22:20:44 added the new Gemini artifact and removed the old Gemini and retired Cohere artifacts. This separates code integration, index rebuild reporting, and artifact publication. Post-removal production behavior remains outside the independently verified evidence for this case.

### Verification scope and remaining questions

The October 1 quality results are contemporaneous reports in a directly inspected session. The October 6 classifier and October 15 retrieval aggregates are traceable to files inspected for this publication. The October 3 generation results and October 16 removal reports retain the earlier research’s recorded source identities and verification limits. The October 29 rationale is the developer’s direct clarification in this publication task.

Remaining questions are the full introduction/Cohere-only-switch motives, the scope of the October 6 cost statement, independent historical key/terms evidence, the classifier output/block-handling cause, unavailable raw generation responses and build-attempt ledgers, and post-removal production verification. No model request, index build, or historical application test was executed for this publication.

### Source traceability and publication form

Fifteen whole-file Excerpts preserve source bytes. Four partial Excerpts join the listed original declarations/test statements with blank lines; names, imports, and selected statements remain unchanged. The tests retain synthetic credentials and fixtures, plus references to omitted application modules. The classifier excerpt preserves the schema/parser/gate and references its original harness state. These selections are published for code reading. The local harness excerpt normalizes CRLF line endings to LF.

The two Reconstructed JSON files use new editorial envelopes. `target-history.json` copies complete generation/embedding fields from the identified example configurations. `observed-results.json` selects the saved classifier summary/counters and derives retrieval aggregates from original/final evidence ranks. Raw private records, full experimental responses, credentials, index vectors, and local user paths remain outside the published files.

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
| [evidence/observed-results.json](../cases/cohere-lifecycle/evidence/observed-results.json#L1-L138) | Inputs specified in the assembly rules below | Reconstructed · Selection / new envelope |

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

The following originals were unavailable at their registered paths. Identifiers and hashes are retained from the existing evidence register.

| Previously recorded original | Recorded SHA-256 · scope |
|---|---|
| `generation-model-comparison/2026-10-03-full40-3way-1/final-report.md` | `a82073631b743462c5a31051071ba994f9339b346849e29bbe171375ace7c231` · October 3 generation table |
| `rollout-2026-10-16T20-10-29-01a14468-00a5-7ff2-8053-0e588b0c1335.jsonl.zst` | `9a167a56794bb628bd58e92581435b4efcacab3568d01e83d9dbf36ad79f9b99` · Retirement decision, completion, and index separation |

Message locations: the inspected October 1 session’s UTC 04:47:45.250Z, 07:43:18.624Z, 08:04:10.538Z, 08:13:29Z, and 08:32:44Z correspond to KST 13:47:45.250, 16:43:18.624, 17:04:10.538, 17:13:29, and 17:32:44. Previously recorded retirement-session locations are October 16 UTC 12:02:47.996Z (developer decision), 12:19:53.762Z (completion report), 12:29:36.316Z (exclude indexes), and October 17 13:19:07.357Z (CURRENT report). The October 6 19:17:35.774 handoff is UTC 10:17:35.774Z and is cited through the existing research transcription.

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
| `evidence/observed-results.json` | See input table | `3561e1aad43a2b782760dc3adc3b993312f7b00304b76eb1c724560659c43a5d` |

</details>

### Publication checks

The 15 whole-file Excerpts passed byte-for-byte and SHA-256 comparison with their Git objects. All source ranges in the four partial Excerpts matched the retained originals, with the local harness’s documented LF normalization. All 19 TypeScript files passed syntax parsing. The two JSON reconstructions passed syntax, configuration-field comparison, classifier counter/median checks, and retrieval aggregate checks against their inputs.

English/Korean facts, source mappings, and code links were compared. All 238 local documentation links across the READMEs and detailed records passed file, heading-anchor, and line-range checks. The previous two cases’ text and 27 code files were preserved. The new files were reviewed for credentials, private document content, private repository URLs, and local user paths. Historical application tests and provider calls were outside this publication verification.
