# Engineering Decisions

[Tessera](../README.md) · [한국어](engineering-decisions.ko.md)

These records connect implementation code to the problems, experiments, and decisions that shaped Synethos. Dates refer to development events; all times below are Korea Standard Time (KST, UTC+09:00).

## Reading the evidence

- **Code confirmed:** behavior visible in the identified historical source snapshot, or the byte-for-byte source comparison used to prepare these excerpts.
- **Reported at the time:** a retained development request, experiment artifact, or verification report describes the observation. Publishing the record does not reproduce the experiment.
- **Unconfirmed:** the available records do not establish the cause, correspondence, or broader effect.

Each case includes a source ledger identifying its code snapshots and retained evidence. Historical tests are published as implementation evidence; this repository does not provide their dependencies or a test runner.

## Contents

- [01 — From Local Qwen/Ollama Inference to the Gemini API](#01--from-local-qwenollama-inference-to-the-gemini-api) — 2026-09-26
- [02 — From GitBook MCP to Local Knowledge](#02--from-gitbook-mcp-to-local-knowledge) — 2026-09-26 ~ 2026-09-28

## 01 — From Local Qwen/Ollama Inference to the Gemini API

**Development date:** 2026-09-26

**Code classification:** Excerpt — all 12 source and test files linked below.

**Outcome:** local inference was retired in favor of direct Gemini API integration; the record-based answering workflow was retained.

### Problem and constraints

Synethos initially pursued free, self-hosted inference with project-local Ollama. The committed baseline used `qwen3:0.6b` for generation and `qwen3-embedding:0.6b` for embeddings. It configured a 4096-token generation context, a 120000ms local request timeout, and embedding batches of 16. Runtime/model storage stayed within the project, and provisioning explicitly disabled cloud use through `OLLAMA_NO_CLOUD=1`. These settings describe the historical baseline, not an installation guide.

At 02:16:28, the developer reported that Korean questions could produce English answers when the retrieved material was an English GitHub profile. The proposed comparison changed only the generation model to `qwen3:8b`, preserving embeddings, retrieval, chunking, prompts, approved knowledge, and the existing index. The intended language behavior was to follow an explicit language request first and otherwise answer in the question's language.

The relevant machine ran Windows with a Ryzen 5 5600X, Radeon RX 6800 XT with 16GiB VRAM, roughly 16GiB system RAM, and the Vulkan backend. These hardware and backend conditions matter to the resource experiment; they are not evidence of a particular failure mechanism.

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

The run completed within its recorded memory threshold. Layer offload is not a measurement or guarantee of a 50% power limit. The single English response did not establish improved Korean response quality, sustained stability, or resolution of the earlier power incident. The completed response and the limits of that result were both retained.

### Decision

At 03:50:47, the developer judged execution stability, resource demands, and response time to be too burdensome for the MVP after the 0.6B/8B attempts and CPU/GPU split experiment. The chosen direction was to stop operating local inference and use the Gemini API free tier available at the time.

The decision also narrowed implementation scope: remove the local inference path rather than maintain a selectable local/API compatibility layer. Approved knowledge, retrieval, record-grounding rules, and citation checks were to remain. Existing Qwen embeddings were not to be reused as Gemini embeddings.

This was a product-scope decision based on the observed constraints. The records do not show that every possible local optimization was exhausted. The free-tier choice is a historical decision, not a statement about present-day provider pricing or terms.

### Implementation: local HTTP calls to a server-side API client

The baseline snapshot is `cb299ce7f96888ab9ed4e49d69bfb3f6d59b30dc`, committed at 02:15:03. Its relevant code and configuration match the earlier prototype snapshot `801633a`. The transition snapshot is `9a3df6134f3a68c012d98afa9fdc5f7f7cf5b264`, committed at 12:05:45 with the message `Replace local Ollama inference with Gemini API`.

The baseline still names the **0.6B model**. It precedes the 8B experiment request; the published baseline must not be read as the experiment's exact low-load configuration. No missing experiment controls have been reconstructed into these files.

**Before:** [the local POST client](../cases/local-inference-to-gemini/before/ollama/client.ts#L10-L37) applies an AbortController timeout and sends JSON to Ollama. [Generation](../cases/local-inference-to-gemini/before/ollama/generation.ts#L39-L53) uses `/api/chat`, disables streaming, supplies a JSON response schema, and passes temperature/context options. [Embedding](../cases/local-inference-to-gemini/before/ollama/embeddings.ts#L13-L32) batches `/api/embed` calls and checks vector counts, consistent dimensions, and finite values.

**After:** [the Gemini client](../cases/local-inference-to-gemini/after/gemini/client.ts#L11-L16) requires a server-side API key and constructs `GoogleGenAI`. [Generation](../cases/local-inference-to-gemini/after/gemini/generation.ts#L40-L68) calls `generateContent`, requests JSON with the response schema, applies the output limit, and validates the returned answer/citation shape. The key value is not part of the excerpt.

The transition's generation model was **`gemini-3.8-flash`**, with `maxOutputTokens=1200`; embeddings used **`gemini-embedding-2`**, with 768 output dimensions. These are the models in that commit, not later Synethos defaults. The implementation did not retain a local/provider fallback path.

### Implementation: preserve grounding while changing the provider

The [Ollama prompt and record construction](../cases/local-inference-to-gemini/before/ollama/generation.ts#L29-L38) and the [Gemini counterpart](../cases/local-inference-to-gemini/after/gemini/generation.ts#L29-L38) retain the same core instructions: use supplied records, treat records as untrusted evidence rather than instructions, avoid invented facts, state what cannot be confirmed, and cite supporting record IDs.

The provider request mechanism changes, while that grounding intent remains. The Gemini response schema additionally sets `additionalProperties: false`; compare [the earlier schema](../cases/local-inference-to-gemini/before/ollama/generation.ts#L14-L21) with [the later schema](../cases/local-inference-to-gemini/after/gemini/generation.ts#L13-L21). The response-shape checks and citation deduplication are visible in both implementations. Shape validation alone does not prove that each statement is supported by its citation.

The [historical generation test](../cases/local-inference-to-gemini/verification/generation.test.ts#L5-L31) uses a synthetic record containing an instruction-like string. It checks the outgoing prompt and structured response contract using a mock model. It does not establish live resistance to every prompt injection or semantic grounding error.

### Implementation: a new embedding contract requires a new index

The Gemini adapter separates [query input](../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L32-L38) from [document-chunk input](../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L40-L50). Each chunk is embedded independently with its title and text. [Vector validation](../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L8-L30) requires one returned vector for one input, the configured dimension, numeric elements, and finite values.

This version embeds document chunks sequentially; it does not implement the later document-batching or pacing policies. The [embedding tests](../cases/local-inference-to-gemini/verification/embeddings.test.ts#L10-L47) record the intended per-chunk order and query prefix using mock responses.

The migration also changes index compatibility:

- [The corpus fingerprint](../cases/local-inference-to-gemini/after/indexing/corpus.ts#L7-L44) includes schema version2, embedding model, output dimensions, and embedding input version, alongside chunking and source identity.
- [The index builder](../cases/local-inference-to-gemini/after/indexing/indexer.ts#L25-L43) obtains new Gemini vectors, checks their count against the chunks, and writes model/dimension metadata.
- [The index reader](../cases/local-inference-to-gemini/after/indexing/store.ts#L20-L26) rejects a fingerprint/schema mismatch with a rebuild error.
- [The fingerprint tests](../cases/local-inference-to-gemini/verification/corpus.test.ts#L5-L26) distinguish generation-model changes from embedding-model/dimension changes: only the latter invalidate this fingerprint.

The original indexer, retrieval, and answer path imports were switched from Ollama to Gemini in the transition commit. The excerpt set shows the relevant provider and index mechanisms; it does not reproduce the entire application wiring.

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

The two approximately4.96second measurements concern different operations in the report and are not added together. This Korean question and the low-load Qwen English question used different conditions. **They are not a controlled speed or quality comparison.** The Gemini check supports a successful index-and-answer path for that one corpus/question, not broad quality, quota sustainability, or production reliability.

The evidence supports the following boundaries:

| Established in the record | Still unconfirmed or outside the verification |
|---|---|
| Local HTTP inference was replaced by direct Gemini integration, with grounding instructions and new index compatibility checks visible in code. | The technical cause of the power loss and the mapping of the final local requests to individual questions. |
| A lower-load local run completed, and a separate Gemini Korean question succeeded according to retained records. | Sustained local stability, Korean quality improvement from the 8B change, or general Gemini superiority. |
| Historical tests express request, vector-order, and fingerprint contracts. | A current full application test run or fresh model experiment in Tessera. |

### Source traceability

All published code is **Excerpt**. The files preserve the original bytes, including imports and references to application files that are not published here. No names, control flow, placeholders, or dependency scaffolding were rewritten. The source table identifies the meaningful line span of each full-file excerpt; trailing blank lines remain preserved in the file hashes.

The private Synethos source is identified by commit and repository-relative path. Private repository URLs, private research transcripts, raw runtime logs, local user paths, and API key values are not published. The ledger below records evidence identities and verification limits without making inaccessible private URLs appear to be public references.


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

**Code classification:** 14 Excerpts and one Reconstructed manifest sample; no Mixed files.

**Outcome:** the remote documentation candidate path was retired, approved Markdown became the only knowledge retrieval source, and intent-coverage evaluation was retained. Importing the documents and preparing the corpus did not complete the full index build.

### Problem and initial choice

GitBook was the platform that published Cosmic Horizon’s English and Korean documentation and exposed it through MCP. Synethos evaluated these documents as an external KnowledgeSource before importing approved Markdown into Local Knowledge. The initial investigation kept document retrieval separate from answer generation. A retained request on September 26 called for a reversible probe that preserved Local RAG, API/UI behavior, the index, and ranking.

The foundation commit, f2914de at 03:54:45 on September 27, defines a [source contract](../cases/gitbook-mcp-to-local-knowledge/foundation/source.ts#L1-L17) and a [factory selecting Local or GitBook sources](../cases/gitbook-mcp-to-local-knowledge/foundation/source-factory.ts#L11-L24). The [adapter's allowed tool type](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L1-L37) contains only searchDocumentation and getPage. Although the server advertised askQuestion and sendFeedback, the adapter had no corresponding executable methods. [Capability observation](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L111-L121) listed those capabilities without using them to answer visitors or submit feedback.

The distinction mattered: acquiring evidence, interpreting it, and generating an answer remained different responsibilities. The probe did not feed retrieval, generation, /api/ask, or /api/search in that foundation snapshot.

### What the endpoint observations established

Three records describe different observations:

| Observation | Retained evidence and scope |
|---|---|
| September 26 Single-Space probe | The historical probe report identifies a raw observation of the earlier Single-Space layout. It is not a record of the later Site variants. |
| September 27 Two-Space/Site observation | A tracked report describes Cosmic Horizon Global and Korean Spaces combined as Site variants. It reports independent checks of the Global and Korean MCP endpoints. No new raw topology-probe file was written for that check. |
| September 28 09:44:31.093 Site-root probe | A separately retained JSON artifact records four searches, each with ten text blocks and two page results: 40 search blocks and eight page results in total. Its timestamp is 2026-09-28T00:44:31.093Z. It does not substitute for the September 27 two-endpoint comparison. |

The September 27 report says the Global endpoint and the endpoint under /kr/ returned the same server identity, tool schemas, capabilities, search corpus, distributions, and URLs. For each endpoint, the returned page-URL variants had the following distribution:

| Query | Global-variant URLs | Korean /kr/ URLs |
|---|---:|---:|
| Why We Study | 9 | 1 |
| 왜 우리는 공부하는가? | 0 | 10 |

These columns describe the languages/variants of returned URLs, not separate endpoint success counts. Registering both endpoints as independent knowledge sources would query the same multilingual corpus twice.

Search responses contained text blocks with Title, Link, and Content lines. The report found no structuredContent, typed locale, Space identity, page/section ID, translation-pair relationship, or search score; only array order was available. Both language versions of Why We Study could have the same title, so title equality was insufficient to identify locale. A reviewed 16-to-16 document-pair matrix came from repository inspection, not from an MCP pairing guarantee. The /kr/ URL path was the observed locale signal.

The September 28 artifact independently records server version 0.27.2, the four advertised tools, and search responses without structuredContent or reported tool errors. It is a saved observation read during publication preparation, not a new MCP call. Raw page contents are not published here.

### Implementing a defensive evidence boundary

The [adapter](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L67-L109) validates its HTTPS endpoint, refuses disabled-source use, limits page reads to the documentation origin, and exposes the two allowed operations. The [probe excerpt](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-probe.excerpt.ts#L7-L54) preserves the original question set, result types, per-query page limit, and search/page orchestration. The file-writing CLI and raw-report persistence code are omitted from this excerpt.

The later [search-result parser](../cases/gitbook-mcp-to-local-knowledge/multi-source/gitbook-search-results.ts#L15-L75), committed in 26a5409, extracts text fields and rejects unsuitable URLs rather than inventing missing metadata. Its URL checks cover origin and Site path, credentials, query/fragment components, encoded path separators/traversal, and the MCP endpoint itself. It retains the original resultIndex; it does not assign a provider score or infer a typed locale/pair identity. Empty results and nonempty results with no usable entries are different outcomes.

The [historical adapter tests](../cases/gitbook-mcp-to-local-knowledge/verification/gitbook-mcp-source.test.ts#L27-L104) use a synthetic client to check tool restrictions, capability observation without execution, disabled sources, and cross-origin page rejection. These are contract tests, not fresh live-tool verification.

### Combining sources revealed a different class of problems

The September 27 sequence separated Local candidates from final answer evidence, added multi-source collection, and then ranking. In the later multi-source snapshot, [collection](../cases/gitbook-mcp-to-local-knowledge/multi-source/source-candidates.ts#L23-L58) preserves each configured knowledgeSourceId and keeps Local candidates separate from parsed GitBook hits. GitBook clients are closed in finally. Candidate collection does not itself create final citations.

[Ranking](../cases/gitbook-mcp-to-local-knowledge/multi-source/relevance.ts#L23-L64) retains Local cosine scores and embeds the GitBook query and document hits to derive cosine-based relevance scores. It does not equate MCP result position with a Local similarity score. This creates a common ranking mechanism; the code alone does not establish that the scores are perfectly calibrated across sources.

The [multi-source intent excerpt](../cases/gitbook-mcp-to-local-knowledge/multi-source/intent-orchestration.excerpt.ts#L1-L22) shows the next layer: plan original/derived queries, collect and rank for each query, and delegate merging. Identity includes both the configured source and the document identity or public URL. Merely pointing two differently named sources at the same corpus does not create a cross-source translation-pair deduplication policy.

At 10:38:04 on September 28, a retained developer message reported that derived queries brought Verification Philosophy from rank 25 to 2 and Human Auditor from 9 to 2. However, the initial full round-robin merge pushed an existing AI-role result from 4 to 9, leaving the mixed question's recall@5 at 0.5. Total live-harness time rose from approximately 19.3 seconds to 34.3 seconds, and an embedding-provider error was observed. The developer asked to reconsider merge placement using actual lane order and candidate identity rather than discard the decomposition improvement.

That message's UTC timestamp is 2026-09-28T01:38:04.008Z. The published later snapshot is the revised orchestration, not a reconstruction of the earlier failing working tree. Its retained merge policy used a holistic seed, top intent anchors, and an original-query backbone before derived tails.

At 11:45:32, a further request recorded roughly six embedding calls and three GitBook searches for a two-intent question, along with a 100 RPM free-tier 429 observation. This prompted investigation of fan-out and duplicated embedding work. These are contemporaneous reports, not new measurements made for Tessera. They do not by themselves prove the complete or highest-priority reason for retiring MCP.

The [collection test](../cases/gitbook-mcp-to-local-knowledge/verification/source-candidates.test.ts#L6-L85) expresses provenance and original ranking-signal preservation with synthetic fixtures. The multi-source and intent work was exercised by evaluation; the production answer/search routes still used their existing single-query Local retrieval path. The publication does not describe an MCP-backed production answer service being replaced.

### Decision: import first, then remove the remote source

At 12:07:16.238 on September 28, the developer explicitly chose to incorporate the supplied English/Korean Markdown snapshots into Local Knowledge and simplify future retrieval around Local Knowledge. The immediate task was import, manifest registration, and index preparation; MCP code removal was deferred to the next step.

At 12:45:49.898, the developer reported 42 documents/475 chunks imported but index rebuilding blocked by the daily embedding quota, and requested the MCP-removal scope analysis. At 13:50:33, a subsequent request described the import and MCP-removal changes as existing uncommitted work to preserve while beginning the next embedding-target task. The combined implementation was committed at 14:50:04 as5f71fbe.

The source simplification and phased scope are recorded user choices. The records do not establish whether metadata limitations, duplicate corpus access, request cost, reproducibility, or manual approval boundaries were the dominant motivation. Those observations and design pressures are reported without turning their coexistence into an invented causal ranking.

### Implementation: approved local files with public citation provenance

The transition removed the GitBook adapter, parser, probe, source factory/contracts, common remote-result relevance layer, and MCP dependency. The runtime retrieval source became approved Markdown registered in knowledge/sources.json; public documentation URLs remained citation metadata rather than live retrieval endpoints. Knowledge import remained manual, with no automatic remote synchronization introduced.

The [approved-source loader](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/manifest.ts#L16-L49) checks the manifest shape, IDs and duplicates, file/title fields, path containment, Markdown extensions, and allowed publicUrl protocols, then reads the registered files. It does not treat the existence of a file as automatic registration.

The [Reconstructed manifest sample](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/approved-sources.sample.json#L1-L17) contains only the two Why We Study entries, taken from the transition manifest and placed in a newly assembled two-entry document. They have distinct IDs, local file paths, and public URLs despite sharing a title. This sample is not the complete 42 document manifest, an added runtime configuration, or evidence of automated translation pairing. The full private manifest and document contents are not copied.

The [Local search path](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/search.ts#L47-L121) requires a matching usable target index, embeds the question, ranks Local chunks, and selects evidence. [Evidence selection](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/search.ts#L99-L113) retains sourceId, title, section, content, and publicUrl, then assigns citation IDs to selected records. Local-only refers to the knowledge retrieval source: query embedding can still call an external provider.

The [Local intent excerpt](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/intent-orchestration.excerpt.ts#L1-L25) retains planning and merge delegation while replacing remote-source collection/ranking with Local candidate searches. Its default path executes the query bundle on one embedding target, returning that target with the runs. Source identity becomes a Local chunk identity. The same transition also added embedding-provider fallback; this is separate from retaining an MCP knowledge source. Provider adapters and their broader implementation are outside this excerpt set.

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
| Later report atdadffe3,23:59:41 | Provider-owned batching was implemented, but a full live build remained deferred pending separate approval. This is a later snapshot, not the 14:50 transition state. |
| Disposable provider smoke in that later report | Two synthetic documents and one query per target, at 768/1536 dimensions; relevant document ranked first; temporary mini-index removed. This did not create a production index. |

The implementation and prepared corpus support the Local Knowledge direction, but the retained records within this case do not establish a completed full 475 chunk production index. The planned architecture, successful small smoke, full-corpus build, and production retrieval quality have different completion conditions.

### What changed, what stayed, and what remains unconfirmed

The remote documentation source was removed, while approved document registration, vector retrieval, public citation provenance, deterministic intent planning, and evaluation of coverage were retained or adapted. The priorities behind retirement and full-index retrieval quality remain unconfirmed as listed below.

Still unconfirmed are the relative weight of the final retirement motivations, the complete correspondence of earlier raw probe runs, and end-to-end retrieval quality with a finished full index at the transition point. The initial round-robin regression remains a reported failure; the later published code must not be presented as that exact failing implementation. No MCP probe, embedding request, index build, or application test was rerun for this publication.

### Source traceability and publication form

Whole-file Excerpts preserve original bytes. Partial Excerpts preserve the listed source ranges without renaming or rewriting their statements; blank separators join selected declarations. Original imports and references to omitted application types/helpers are retained where selected. The partial tests omit the enclosing suite while preserving the selected imports, fixture helper, and test body. These are readable excerpts, not standalone modules.

The only Reconstructed file is the two-entry JSON sample. Its version and entry fields are copied from the identified manifest, but selection and the new envelope are editorial assembly; no in-source comment syntax is introduced into JSON. There are no Mixed files requiring reconstructed-block comments. Private raw responses, private repository URLs, secrets, local user paths, and unrelated approved-source entries are excluded.

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

The original UTC timestamp for 10:38:04.008 is `2026-09-28T01:38:04.008Z`. The integrated research document's 11:38 rendering was corrected against that original for this publication. Evidence discovery time is not used as development-event time.

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
