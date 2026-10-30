# 03 — Introducing, Evaluating, and Retiring Cohere

[All cases](../../README.md) · [한국어](03-cohere-evaluation-and-retirement.ko.md) · [Previous: 02](02-gitbook-to-local-knowledge.md) · [Next: 04](04-provider-architecture-and-embedding-reliability.md)

**Evidence:** Code confirmed identifies historical source; reported at the time retains recorded observation conditions; unconfirmed marks unresolved facts or causal links. Tests are historical source evidence. Times are KST (UTC+09:00); development events and evidence-inspection dates retain their own labels.

**Document revision:** Split on 2026-10-30 from `2fc5094`. Historical publication checks below retain their dates and scope. On 2026-10-31, redundant explanations and verification-limit wording were revised from `f7fb082`.

**Development period:** 2026-09-28 ~ 2026-10-17

**Code classification:** 19 Excerpts and two Reconstructed JSON records.

**Outcome:** Cohere expanded from an embedding fallback into a generation and classifier evaluation target. The developer ultimately chose a Gemini-only embedding path and Gemini→Groq generation, weighing observed benefits against Synethos’s scale, available alternatives, and operating cost.

## Development sequence

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

## Introducing an alternative embedding space

The September 28 development report records an earlier Gemini document build reaching its daily quota after 50 successful chunk embeddings. The developer introduced `embed-v4.0` at 1536 dimensions after Gemini’s `gemini-embedding-2` at 768 dimensions.

The [initial HTTP client](../../cases/cohere-lifecycle/embedding/initial/client.ts#L22-L54) sends native `fetch` requests to `/v2/embed`, asking for float vectors with the target’s output dimension. The [initial adapter](../../cases/cohere-lifecycle/embedding/initial/embedding.ts#L19-L45) uses `search_query` for a question and `search_document` for title-plus-content document inputs, and validates returned vector counts. Each target requires an index in its own embedding space.

The [fallback loop](../../cases/cohere-lifecycle/embedding/initial/target-fallback.ts#L23-L44) evaluates index reachability and credentials, tries targets in order, and advances on classified fallbackable provider failures. A current-index credential blocker stops the operation. The [synthetic fallback tests](../../cases/cohere-lifecycle/embedding/initial/target-fallback.test.ts#L20-L42) express both paths.

The later [batching adapter](../../cases/cohere-lifecycle/embedding/batched/embedding.ts#L9-L51) declares preferred/maximum document batches of 96; its [tests](../../cases/cohere-lifecycle/embedding/batched/embedding.test.ts#L9-L39) verify multilingual document ordering and rejection of 97-input requests. The pre-retirement [HTTP failure tests](../../cases/cohere-lifecycle/embedding/pre-retirement/client.test.ts#L26-L53) preserve an unannotated 429 as neutral and fallbackable and normalize Retry-After. These files retain their separate source dates.

Build reports describe distinct runs: one historical build sent three successful 32-document Gemini requests before the fourth failed with insufficient retained diagnostics, while Cohere completed six requests and produced a then-current cache artifact. A separate September 29 attempt on 525 chunks completed five Cohere batches and received HTTP 429 on batch 6/6; the incomplete target was not published. The `5615b4c` report records mocked validation of the new bounded retry policy, with live retry verification still pending.

The [Reconstructed configuration history](../../cases/cohere-lifecycle/configuration/target-history.json#L1-L227) preserves selected generation/embedding fields from five committed example configurations. `1c0f28e` selected only Cohere for runtime embedding; `180cc30` later selected Gemini then Cohere.

## Extending evaluation to generation

On September 30, `b00bf59` added `command-a-plus-05-2026` to the generation registry. The [generation client](../../cases/cohere-lifecycle/generation/generation-client.ts#L7-L35) classifies HTTP, transport, and timeout failures.

The [generation adapter](../../cases/cohere-lifecycle/generation/generation.ts#L6-L26) translates the shared system/user prompt and response schema to `/v2/chat`, forwards supported options, requires a COMPLETE finish, and joins returned text blocks. The [contract tests](../../cases/cohere-lifecycle/generation/generation.test.ts#L12-L63) cover option translation, usage metadata, incomplete outputs, and normalized errors.

The published test snapshot uses the September 30 output limit of 1200; the later October 2 configuration records 32768.

The [shared-evidence comparison](../../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.ts#L45-L90) validates a saved retrieval snapshot, clones its evidence for each target, and records snapshot, prompt, evidence, and citation-order identities. Each explicit target gets its own result with retryPolicy `none`; response-shape and citation validation are recorded alongside pending claim review.

The [selected tests](../../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.test.ts#L27-L77) cover identical input, snapshot reuse, one-target failure, citation validation, and credential isolation.

## October 1: question subject and record speaker

A common prompt contained `Describe yourself as Synethos`, while retrieved records included first-person writing by Riu Salze. The developer investigated how the answering identity, the question’s subject, and the record’s actual speaker interacted. The retained session records several prompt revisions using fixed retrieval contexts.

| Report time | Conditions and reported result |
|---|---|
| 13:47:45.250 | Five questions × four combinations × three repetitions: 60 planned, 59 responses and one Gemini generation 429. |
| 16:43:18.624 | Two fixed contexts × two generation providers × eight questions × three repetitions: 96 calls. Subject retention was Cohere 48/48 and Gemini 42/48. |
| Follow-up in that report | Twelve additional checks of the problematic career question after wording revision. Across these two stages: Cohere 54/54 and Gemini 42/54 subject retention. |
| 17:04:10.538 | Local Cohere-only generation, two contexts × ten questions × three repetitions: 60 HTTP 200 responses. Subject changes and speaker confusion: zero observed. Name-format violations: 22/60; semantic citation omissions and grounding errors remained. New embedding and Gemini generation calls: zero. |

These figures are reported subject-retention and output-quality observations from their own prompt revisions. The session says the 60-response run created no result files, so response-level independent review is unavailable. At 17:13:29 the routing remained uncommitted, and the 17:32:44 Git declaration excluded its four files. `496e95e` committed the question-target simplification at 17:34:31. The local routing observation and that committed prompt change retain separate scopes.

## October 3: fixed-input generation results and fallback selection

The integrated research records a fresh three-way comparison with the same saved evidence, question, prompt, and schema for each model: 40 responses per model and 120 successful requests in total.

| Model | Fully correct | Grounding failures | Contract failures | Mean generation latency |
|---|---:|---:|---:|---:|
| Gemini 3.5 Flash Lite | 27/40 | 0 | 1 | 1.508s |
| Cohere Command A+ | 22/40 | 3 | 4 | 3.042s |
| Groq GPT-OSS 120B | 25/40 | 2 | 0 | 1.524s |

The original full40 directory and report were recovered on the home PC, and the registered report hash matched. All 120 requests, responses, results, and manual reviews were cross-checked and the table recalculated. Gemini and Cohere used output caps of 32768; GPT-OSS used strict JSON Schema and a 4096 cap, omitting reasoning_effort to use the recorded medium default.

The [original-result projection](../../cases/model-selection-quality-availability/evidence/october03-reported-results.json) preserves per-case identities, options, verification, and historical ratings. The committed 0baebd9 runtime uses Gemini generation primary and Groq GPT-OSS fallback, with Cohere retained for explicit evaluation.

October 1 subject retention, this full40 assessment, and the later retrieval diagnostic retain their own measures and conditions.

## October 6: a classifier gate stopped expansion

The Cohere experiment sent 20 questions once each to `command-a-plus-05-2026`, using only the question as input. Eighteen had fixed expected labels and two were exploratory. Requests used a two-field enum/boolean schema, a 512-token output cap, temperature 0, thinking disabled, and single dispatches with retry and provider fallback disabled. The artifact timestamps are 2026-10-06T07:05:37.753Z–07:05:47.618Z.

The [classifier contract](../../cases/cohere-lifecycle/evaluation/classifier-contract.excerpt.ts#L3-L22) requires exactly `intent` and `requiresCompleteSet`. Its [gate](../../cases/cohere-lifecycle/evaluation/classifier-contract.excerpt.ts#L24-L43) requires intent ≥17/18, complete-set 18/18, essential L1/A1/A6 correctness, zero lookup/aggregate swaps, compare/synthesis ≥6/7, JSON 20/20, and zero API failures. The [Reconstructed observation record](../../cases/cohere-lifecycle/evidence/observed-results.json#L3-L69) preserves the saved summary and call counts.

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

## October 15: retrieval retained measurable advantages

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

The [evidence-rank calculation](../../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L151-L167) evaluates OR alternatives and requires every member of an AND alternative, using its worst rank. [Case evaluation](../../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L236-L281) records original and merged ranks; the [diagnostic runner](../../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L302-L325) checks corpus/index identity and fixes one target. [Metric tests](../../cases/cohere-lifecycle/evaluation/retrieval-evaluate.test.ts#L107-L161) cover unsupported cases, AND/OR matching, and separation of selected evidence from diagnostic coverage. The [Reconstructed retrieval summary](../../cases/cohere-lifecycle/evidence/observed-results.json#L70-L137) recalculates aggregates from the preserved ranks and retains question-bank/profile identities.

## Retirement decision: benefit relative to scale and operating cost

**Recorded historical decision, October 16 at 21:02:47.996:** the original developer message in the recovered home-PC archive recognized Cohere’s retrieval quality and build speed/convenience while prioritizing free production operation. It specified the then-understood Trial-key production restrictions and paid Production-key requirement, and the need for same-space Cohere query embeddings even with a prebuilt index. The developer asked whether the recent quality difference justified cost and management complexity at Synethos’s scale, comparing development/evaluation-only retention with complete removal, and selected complete removal. The original archive hash matched the existing register; the [recovered-source register](../evidence/recovered-source-register.json) separates message locations for the developer decision and agent review/completion reports.

**Developer clarification during publication preparation, October 29, 2026:** the developer explicitly stated that Cohere outperformed Gemini in some evaluations, but the observed difference at Synethos’s scale was too small to justify payment. The developer would have considered paid adoption if the performance advantage had been much larger or the service larger and more complex. The final judgment weighed the actual performance difference, service scale, substitutability, and operating cost together.

Complete removal reduced credential, adapter, separate-index, evaluation-matrix, and test maintenance. It also gave up live embedding fallback, faster development indexing, and direct reruns of the retained Cohere comparison paths. The performance observations above remain part of that tradeoff.

## Removal implementation and index handover

Commit `e700717` removed the Cohere HTTP clients/adapters and tests, factory registrations, provider options, configuration/example bindings, and current evaluation choices. The clients used native `fetch`.

The [remaining embedding factory](../../cases/cohere-lifecycle/after-removal/embedding-provider-factory.ts#L12-L24) supports Gemini; the [generation factory](../../cases/cohere-lifecycle/after-removal/generation-provider-factory.ts#L17-L33) supports Gemini and Groq. [Option validation](../../cases/cohere-lifecycle/after-removal/target-options.ts#L4-L25) and the [selected configuration tests](../../cases/cohere-lifecycle/after-removal/runtime-selection.excerpt.test.ts#L22-L67) show the retained provider boundary and runtime selection.

Provider abstraction, historical comparison artifacts, common document-build progress logs, and Gemini-specific 22-second request-start pacing remained. Pacing addressed the separate document-build quota problem under investigation that evening. The recorded removal-completion report at 21:19:53.762 lists 939 passing tests, four existing skips, and successful static checks/build; the knowledge change left the Gemini index stale. The developer requested code first, excluding indexes, at 21:29:36.316.

On October 17 at 22:19:07.357 the developer reported a successful rebuild and CURRENT status. Commit `033e02f` at 22:20:44 added the new Gemini artifact and removed the old Gemini and retired Cohere artifacts. This separates code integration, index rebuild reporting, and artifact publication. Post-removal production behavior remains outside the independently verified evidence for this case.

## Verification scope and remaining questions

The October 1 quality results are contemporaneous reports in a directly inspected session. Original October 3 generation artifacts and October 6 classifier/October 15 retrieval files were directly compared. The original October 16/17 session was read for the removal decision, agent completion report, and developer CURRENT observation. Execution results retain each historical report’s conditions. The October 29 rationale is the developer’s later clarification in this publication task.

Remaining questions are the scope of the October 6 cost statement, independent historical key/terms evidence, the classifier output/block-handling cause, build-attempt ledgers, and post-removal production verification. No model request, index build, or historical application test was executed for this publication.

## Source traceability and publication form

Fifteen whole-file Excerpts preserve source bytes. Four partial Excerpts join the listed original declarations/test statements with blank lines; names, imports, and selected statements remain unchanged. The tests retain synthetic credentials and fixtures, plus references to omitted application modules. The classifier excerpt preserves the schema/parser/gate and references its original harness state. These selections are published for code reading. The local harness excerpt normalizes CRLF line endings to LF.

The two Reconstructed JSON files use new editorial envelopes. `target-history.json` copies complete generation/embedding fields from the identified example configurations. `observed-results.json` selects the saved classifier summary/counters and derives retrieval aggregates from original/final evidence ranks.

Added generationOctober03 links the recovered full40 aggregates/options/verification; retirementOctober16 selects the original-session developer decision, completion report, and next-day CURRENT report. Raw private records, full experimental responses, credentials, index vectors, and local user paths remain outside the published files.

### Source commits

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

### Code correspondence

Original paths are relative to the private repository. Ranges are inclusive and read `original → public`. The local harness is identified by its source-file hash.

| Public file | Source snapshot · path | Classification · ranges |
|---|---|---|
| [embedding/initial/client.ts](../../cases/cohere-lifecycle/embedding/initial/client.ts#L1-L54) | `5f71fbe` · `sveltekit/src/lib/server/providers/cohere/client.ts` | Excerpt (whole) · 1–54 → 1–54 |
| [embedding/initial/embedding.ts](../../cases/cohere-lifecycle/embedding/initial/embedding.ts#L1-L46) | `5f71fbe` · `sveltekit/src/lib/server/providers/cohere/embedding.ts` | Excerpt (whole) · 1–46 → 1–46 |
| [embedding/initial/target-fallback.ts](../../cases/cohere-lifecycle/embedding/initial/target-fallback.ts#L1-L44) | `5f71fbe` · `sveltekit/src/lib/server/embedding/target-fallback.ts` | Excerpt (whole) · 1–44 → 1–44 |
| [embedding/initial/target-fallback.test.ts](../../cases/cohere-lifecycle/embedding/initial/target-fallback.test.ts#L1-L43) | `5f71fbe` · `sveltekit/src/lib/server/embedding/target-fallback.test.ts` | Excerpt (whole) · 1–43 → 1–43 |
| [embedding/batched/embedding.ts](../../cases/cohere-lifecycle/embedding/batched/embedding.ts#L1-L51) | `dadffe3` · `sveltekit/src/lib/server/providers/cohere/embedding.ts` | Excerpt (whole) · 1–51 → 1–51 |
| [embedding/batched/embedding.test.ts](../../cases/cohere-lifecycle/embedding/batched/embedding.test.ts#L1-L40) | `dadffe3` · `sveltekit/src/lib/server/providers/cohere/embedding.test.ts` | Excerpt (whole) · 1–40 → 1–40 |
| [embedding/pre-retirement/client.test.ts](../../cases/cohere-lifecycle/embedding/pre-retirement/client.test.ts#L1-L54) | `c2efdac` · `sveltekit/src/lib/server/providers/cohere/client.test.ts` | Excerpt (whole) · 1–54 → 1–54 |
| [generation/generation-client.ts](../../cases/cohere-lifecycle/generation/generation-client.ts#L1-L35) | `b00bf59` · `sveltekit/src/lib/server/providers/cohere/generation-client.ts` | Excerpt (whole) · 1–35 → 1–35 |
| [generation/generation.ts](../../cases/cohere-lifecycle/generation/generation.ts#L1-L26) | `b00bf59` · `sveltekit/src/lib/server/providers/cohere/generation.ts` | Excerpt (whole) · 1–26 → 1–26 |
| [generation/generation.test.ts](../../cases/cohere-lifecycle/generation/generation.test.ts#L1-L63) | `b00bf59` · `sveltekit/src/lib/server/providers/cohere/generation.test.ts` | Excerpt (whole) · 1–63 → 1–63 |
| [evaluation/shared-evidence.excerpt.ts](../../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.ts#L1-L90) | `b00bf59` · `sveltekit/src/lib/server/retrieval/evaluation/run.ts` | Excerpt · 1–13 → 1–13; 15–31 → 15–31; 44–54 → 33–43; 56–101 → 45–90 |
| [evaluation/shared-evidence.excerpt.test.ts](../../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.test.ts#L1-L77) | `b00bf59` · `sveltekit/src/lib/server/retrieval/evaluation/run.test.ts` | Excerpt · 1–8 → 1–8; 10–11 → 10–11; 13–25 → 13–25; 58–69 → 27–38; 71–80 → 40–49; 82–91 → 51–60; 93–98 → 62–67; 100–108 → 69–77 |
| [evaluation/classifier-contract.excerpt.ts](../../cases/cohere-lifecycle/evaluation/classifier-contract.excerpt.ts#L1-L43) | Retained local file · `tmp/cohere-retrieval-intent-experiment/run.ts` | Excerpt · 1–1 → 1–1; 40–40 → 3–3; 42–59 → 5–22; 143–162 → 24–43 |
| [evaluation/retrieval-evaluate.ts](../../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L1-L325) | `927415e` · `sveltekit/src/lib/server/retrieval/evaluation/evaluate.ts` | Excerpt (whole) · 1–325 → 1–325 |
| [evaluation/retrieval-evaluate.test.ts](../../cases/cohere-lifecycle/evaluation/retrieval-evaluate.test.ts#L1-L162) | `927415e` · `sveltekit/src/lib/server/retrieval/evaluation/evaluate.test.ts` | Excerpt (whole) · 1–162 → 1–162 |
| [after-removal/embedding-provider-factory.ts](../../cases/cohere-lifecycle/after-removal/embedding-provider-factory.ts#L1-L24) | `e700717` · `sveltekit/src/lib/server/embedding/provider-factory.ts` | Excerpt (whole) · 1–24 → 1–24 |
| [after-removal/generation-provider-factory.ts](../../cases/cohere-lifecycle/after-removal/generation-provider-factory.ts#L1-L33) | `e700717` · `sveltekit/src/lib/server/generation/provider-factory.ts` | Excerpt (whole) · 1–33 → 1–33 |
| [after-removal/target-options.ts](../../cases/cohere-lifecycle/after-removal/target-options.ts#L1-L25) | `e700717` · `sveltekit/src/lib/server/generation/target-options.ts` | Excerpt (whole) · 1–25 → 1–25 |
| [after-removal/runtime-selection.excerpt.test.ts](../../cases/cohere-lifecycle/after-removal/runtime-selection.excerpt.test.ts#L1-L67) | `e700717` · `sveltekit/src/lib/server/config.test.ts` | Excerpt · 1–12 → 1–12; 15–15 → 14–14; 17–21 → 16–20; 40–59 → 22–41; 62–65 → 43–46; 67–73 → 48–54; 76–87 → 56–67 |
| [configuration/target-history.json](../../cases/cohere-lifecycle/configuration/target-history.json#L1-L227) | Inputs specified in the assembly rules below | Reconstructed · Selection / new envelope |
| [evidence/observed-results.json](../../cases/cohere-lifecycle/evidence/observed-results.json#L1-L224) | Inputs specified in the assembly rules below | Reconstructed · Selection / new envelope |

### Reconstruction rules

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
| `evidence/observed-results.json` · recovered full40 and retirement session | [Recovered-source register](../evidence/recovered-source-register.json), HOME06-3WAY and HOME03-04-SESSION | Original report/archive hashes verified 2026-10-29; historical ratings and report scope retained. |

### Non-code evidence and availability

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

The originals below were recovered on the home PC and matched their registered SHA-256 values. Message locations and additional source identities are preserved in the [recovered-source register](../evidence/recovered-source-register.json).

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

## Publication checks

The 15 whole-file Excerpts passed byte-for-byte and SHA-256 comparison with their Git objects. All source ranges in the four partial Excerpts matched the retained originals, with the local harness’s documented LF normalization. All 19 TypeScript files passed syntax parsing. The two JSON reconstructions passed syntax, configuration-field comparison, classifier counter/median checks, and retrieval aggregate checks against their inputs.

English/Korean facts, source mappings, and code links were compared. All 238 local documentation links across the READMEs and detailed records passed file, heading-anchor, and line-range checks. The previous two cases’ text and 27 code files were preserved. The new files were reviewed for credentials, private document content, private repository URLs, and local user paths. Historical application tests and provider calls were outside this publication verification.

[Back to all cases](../../README.md)
