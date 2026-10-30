# 02 — From GitBook MCP to Local Knowledge

[All cases](../../README.md) · [한국어](02-gitbook-to-local-knowledge.ko.md) · [Previous: 01](01-local-inference-to-gemini.md) · [Next: 03](03-cohere-evaluation-and-retirement.md)

**Evidence:** Code confirmed identifies historical source; reported at the time retains recorded observation conditions; unconfirmed marks unresolved facts or causal links. Tests are historical source evidence. Times are KST (UTC+09:00); development events and evidence-inspection dates retain their own labels.

**Document revision:** Split on 2026-10-30 from `2fc5094`. Historical publication checks below retain their dates and scope. On 2026-10-31, redundant explanations and verification-limit wording were revised from `f7fb082`.

**Development period:** 2026-09-26 ~ 2026-09-28

**Code classification:** 14 Excerpts and one Reconstructed manifest sample.

**Outcome:** the remote documentation candidate path was retired, approved Markdown became the only knowledge retrieval source, and intent-coverage evaluation was retained. Importing the documents and preparing the corpus did not complete the full index build.

## Problem and initial choice

GitBook was the platform that published Cosmic Horizon’s English and Korean documentation and exposed it through MCP. Synethos evaluated these documents as an external KnowledgeSource before importing approved Markdown into Local Knowledge. The initial investigation kept document retrieval separate from answer generation. A retained request on September 26 called for a reversible probe that preserved Local RAG, API/UI behavior, the index, and ranking.

The foundation commit, f2914de at 03:54:45 on September 27, defines a [source contract](../../cases/gitbook-mcp-to-local-knowledge/foundation/source.ts#L1-L17) and a [factory selecting Local or GitBook sources](../../cases/gitbook-mcp-to-local-knowledge/foundation/source-factory.ts#L11-L24).

The [adapter's allowed tool type](../../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L1-L37) contains only searchDocumentation and getPage.

Although the server advertised askQuestion and sendFeedback, the adapter had no corresponding executable methods. [Capability observation](../../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L111-L121) listed those capabilities without using them to answer visitors or submit feedback.

The distinction mattered: acquiring evidence, interpreting it, and generating an answer remained different responsibilities. The probe did not feed retrieval, generation, /api/ask, or /api/search in that foundation snapshot.

## What the endpoint observations established

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

Additional raw probes recovered on the home PC are MCP root-endpoint runs at September 26 23:45:48.199 and September 27 21:05:46.310. Each retains four searches, two page results per search, server version 0.27.2, and four tools. The [recovered-source register](../evidence/recovered-source-register.json) adds both original hashes, observation times, and per-search response shapes.

The September 26 file is the original Single-Space observation above; the September 27 file supports its own root-endpoint observation; the two-endpoint comparison and September 28 09:44:31.093 run retain their separate records.

## Implementing a defensive evidence boundary

The [adapter](../../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L67-L109) validates its HTTPS endpoint, refuses disabled-source use, limits page reads to the documentation origin, and exposes the two allowed operations. The [probe excerpt](../../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-probe.excerpt.ts#L7-L54) preserves the original question set, result types, per-query page limit, and search/page orchestration. The file-writing CLI and raw-report persistence code are omitted from this excerpt.

The later [search-result parser](../../cases/gitbook-mcp-to-local-knowledge/multi-source/gitbook-search-results.ts#L15-L75), committed in 26a5409, extracts text fields and rejects unsuitable URLs. Its URL checks cover origin and Site path, credentials, query/fragment components, encoded path separators/traversal, and the MCP endpoint itself. It retains the original resultIndex; it does not assign a provider score or infer a typed locale/pair identity. Empty results and nonempty results with no usable entries are different outcomes.

The [historical adapter tests](../../cases/gitbook-mcp-to-local-knowledge/verification/gitbook-mcp-source.test.ts#L27-L104) use a synthetic client to check tool restrictions, capability observation without execution, disabled sources, and cross-origin page rejection. The tests verify the adapter contract with a synthetic client.

## Combining sources revealed a different class of problems

The September 27 sequence separated Local candidates from final answer evidence, added multi-source collection, and then ranking. In the later multi-source snapshot, [collection](../../cases/gitbook-mcp-to-local-knowledge/multi-source/source-candidates.ts#L23-L58) preserves each configured knowledgeSourceId and keeps Local candidates separate from parsed GitBook hits. GitBook clients are closed in finally. Final citation assignment occurs at evidence selection.

[Ranking](../../cases/gitbook-mcp-to-local-knowledge/multi-source/relevance.ts#L23-L64) retains Local cosine scores and embeds the GitBook query and document hits to derive cosine-based relevance scores. The original MCP result position is retained as metadata. Cross-source score calibration remains unverified.

The [multi-source intent excerpt](../../cases/gitbook-mcp-to-local-knowledge/multi-source/intent-orchestration.excerpt.ts#L1-L22) shows the next layer: plan original/derived queries, collect and rank for each query, and delegate merging. Identity includes both the configured source and the document identity or public URL. With this identity rule, the same URL under two configured source IDs has distinct candidate identities; cross-source translation-pair deduplication is absent from this implementation.

At 10:38:04 on September 28, a retained developer message reported that derived queries brought Verification Philosophy from rank 25 to 2 and Human Auditor from 9 to 2. However, the initial full round-robin merge pushed an existing AI-role result from 4 to 9, leaving the mixed question's recall@5 at 0.5. Total live-harness time rose from approximately 19.3 seconds to 34.3 seconds, and an embedding-provider error was observed. The developer asked to reconsider merge placement using actual lane order and candidate identity rather than discard the decomposition improvement.

That message's UTC timestamp is 2026-09-28T01:38:04.008Z. The published snapshot contains the revised orchestration. Its retained merge policy used a holistic seed, top intent anchors, and an original-query backbone before derived tails.

At 11:45:32, a further request recorded roughly six embedding calls and three GitBook searches for a two-intent question, along with a 100 RPM free-tier 429 observation. This prompted investigation of fan-out and duplicated embedding work. These observations come from contemporaneous reports.

The [collection test](../../cases/gitbook-mcp-to-local-knowledge/verification/source-candidates.test.ts#L6-L85) expresses provenance and original ranking-signal preservation with synthetic fixtures. The multi-source and intent work was exercised by evaluation; the production answer/search routes still used their existing single-query Local retrieval path.

## Decision: import first, then remove the remote source

At 12:07:16.238 on September 28, the developer explicitly chose to incorporate the supplied English/Korean Markdown snapshots into Local Knowledge and simplify future retrieval around Local Knowledge. The immediate task was import, manifest registration, and index preparation; MCP code removal was deferred to the next step.

At 12:45:49.898, the developer reported 42 documents/475 chunks imported but index rebuilding blocked by the daily embedding quota, and requested the MCP-removal scope analysis. At 13:50:33, a subsequent request described the import and MCP-removal changes as existing uncommitted work to preserve while beginning the next embedding-target task. The combined implementation was committed at 14:50:04 as5f71fbe.

The source simplification and phased scope are recorded user choices.

## Implementation: approved local files with public citation provenance

The transition removed the GitBook adapter, parser, probe, source factory/contracts, common remote-result relevance layer, and MCP dependency. The runtime retrieval source became approved Markdown registered in knowledge/sources.json; public documentation URLs remained citation metadata rather than live retrieval endpoints. Knowledge import remained manual, with no automatic remote synchronization introduced.

The [approved-source loader](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/manifest.ts#L16-L49) checks the manifest shape, IDs and duplicates, file/title fields, path containment, Markdown extensions, and allowed publicUrl protocols, then reads the registered files. Registration is controlled by the manifest.

The [Reconstructed manifest sample](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/approved-sources.sample.json#L1-L17) contains only the two Why We Study entries, taken from the transition manifest and placed in a newly assembled two-entry document. They have distinct IDs, local file paths, and public URLs despite sharing a title. The sample is selected from the 42-document manifest; the full manifest and document contents remain private.

The [Local search path](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/search.ts#L47-L121) requires a matching usable target index, embeds the question, ranks Local chunks, and selects evidence. [Evidence selection](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/search.ts#L99-L113) retains sourceId, title, section, content, and publicUrl, then assigns citation IDs to selected records. Local-only refers to the knowledge retrieval source: query embedding can still call an external provider.

The [Local intent excerpt](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/intent-orchestration.excerpt.ts#L1-L25) retains planning and merge delegation while replacing remote-source collection/ranking with Local candidate searches. Its default path executes the query bundle on one embedding target, returning that target with the runs. Source identity becomes a Local chunk identity. The same transition also added embedding-provider fallback for query embeddings. Provider adapters and their broader implementation are outside this excerpt set.

The [Local-query test excerpt](../../cases/gitbook-mcp-to-local-knowledge/verification/local-query-search.excerpt.test.ts#L13-L42) uses an injected search function to check one Local search per planned query. Integration checks using a real target index and provider fallback have a separate scope.

## Corpus readiness was not index readiness

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

## What changed, what stayed, and what remains unconfirmed

The remote documentation source was removed, while approved document registration, vector retrieval, public citation provenance, deterministic intent planning, and evaluation of coverage were retained or adapted. The scope of full-index retrieval quality and probe-run correspondence is recorded below.

Still unconfirmed are the complete correspondence of earlier raw probe runs and end-to-end retrieval quality with a finished full index at the transition point. The initial round-robin regression remains a reported failure, and the published code records the subsequent revision. No MCP probe, embedding request, index build, or application test was rerun for this publication.

## Source traceability and publication form

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

### Code correspondence

Original paths are relative to the private repository; public links open Tessera files. Ranges are inclusive and read `original → public`. Whole-file publication is also classified as Excerpt.

| Public file | Snapshot · original path | Classification · range mapping |
|---|---|---|
| [foundation/source.ts](../../cases/gitbook-mcp-to-local-knowledge/foundation/source.ts#L1-L17) | foundation · `sveltekit/src/lib/server/knowledge/source.ts` | Excerpt (whole) · 1–17 → 1–17 |
| [foundation/source-factory.ts](../../cases/gitbook-mcp-to-local-knowledge/foundation/source-factory.ts#L1-L24) | foundation · `sveltekit/src/lib/server/knowledge/source-factory.ts` | Excerpt (whole) · 1–24 → 1–24 |
| [foundation/gitbook-mcp-source.ts](../../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L1-L129) | foundation · `sveltekit/src/lib/server/knowledge/gitbook-mcp-source.ts` | Excerpt (whole) · 1–129 → 1–129 |
| [foundation/gitbook-probe.excerpt.ts](../../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-probe.excerpt.ts#L1-L54) | foundation · `sveltekit/src/lib/server/knowledge/gitbook-mcp-probe.ts` | Excerpt · 5–9 → 1–5; 12–17 → 7–12; 19–19 → 14–14; 21–26 → 16–21; 28–33 → 23–28; 66–90 → 30–54 |
| [multi-source/gitbook-search-results.ts](../../cases/gitbook-mcp-to-local-knowledge/multi-source/gitbook-search-results.ts#L1-L75) | parser · `sveltekit/src/lib/server/knowledge/gitbook-search-results.ts` | Excerpt (whole) · 1–75 → 1–75 |
| [multi-source/source-candidates.ts](../../cases/gitbook-mcp-to-local-knowledge/multi-source/source-candidates.ts#L1-L58) | multi · `sveltekit/src/lib/server/retrieval/source-candidates.ts` | Excerpt (whole) · 1–58 → 1–58 |
| [multi-source/relevance.ts](../../cases/gitbook-mcp-to-local-knowledge/multi-source/relevance.ts#L1-L64) | multi · `sveltekit/src/lib/server/retrieval/relevance.ts` | Excerpt (whole) · 1–64 → 1–64 |
| [multi-source/intent-orchestration.excerpt.ts](../../cases/gitbook-mcp-to-local-knowledge/multi-source/intent-orchestration.excerpt.ts#L1-L22) | multi · `sveltekit/src/lib/server/retrieval/intent-coverage.ts` | Excerpt · 51–55 → 1–5; 127–142 → 7–22 |
| [local-knowledge/manifest.ts](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/manifest.ts#L1-L49) | local · `sveltekit/src/lib/server/knowledge/manifest.ts` | Excerpt (whole) · 1–49 → 1–49 |
| [local-knowledge/search.ts](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/search.ts#L1-L121) | local · `sveltekit/src/lib/server/retrieval/search.ts` | Excerpt (whole) · 1–121 → 1–121 |
| [local-knowledge/intent-orchestration.excerpt.ts](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/intent-orchestration.excerpt.ts#L1-L25) | local · `sveltekit/src/lib/server/retrieval/intent-coverage.ts` | Excerpt · 45–47 → 1–3; 119–139 → 5–25 |
| [verification/gitbook-mcp-source.test.ts](../../cases/gitbook-mcp-to-local-knowledge/verification/gitbook-mcp-source.test.ts#L1-L104) | foundation · `sveltekit/src/lib/server/knowledge/gitbook-mcp-source.test.ts` | Excerpt (whole) · 1–104 → 1–104 |
| [verification/source-candidates.test.ts](../../cases/gitbook-mcp-to-local-knowledge/verification/source-candidates.test.ts#L1-L85) | multi · `sveltekit/src/lib/server/retrieval/source-candidates.test.ts` | Excerpt (whole) · 1–85 → 1–85 |
| [verification/local-query-search.excerpt.test.ts](../../cases/gitbook-mcp-to-local-knowledge/verification/local-query-search.excerpt.test.ts#L1-L42) | local · `sveltekit/src/lib/server/retrieval/intent-coverage.test.ts` | Excerpt · 1–1 → 1–1; 2–2 → 3–3; 3–3 → 5–5; 4–8 → 7–11; 10–20 → 13–23; 85–102 → 25–42 |
| [local-knowledge/approved-sources.sample.json](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/approved-sources.sample.json#L1-L17) | local · `knowledge/sources.json` | Reconstructed · Selected IDs listed below; newly assembled JSON |

JSON selection:
- `cosmic-horizon-en-perspective-why-we-study`
- `cosmic-horizon-kr-perspective-why-we-study`

### Non-code evidence

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

## Publication checks

All ten whole-file Excerpts were compared byte-for-byte and by SHA-256 with their Git objects; all source ranges in the four partial Excerpts were compared with the originals. The reconstructed JSON version and both entries match the source manifest. All 14 TypeScript files passed syntax parsing. These checks are distinct from executing the historical contract tests or live retrieval/embedding verification.

English and Korean events, dates, numbers, conditions, source mappings, and code links were compared. README → case heading → code-line links were checked for files, anchors, and range bounds. All 12 code files from the first case and its body outside the shared-evidence move were preserved. Public files were reviewed for credential values, private repository URLs, local user paths, and original document contents.

[Back to all cases](../../README.md)
