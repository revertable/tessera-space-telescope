# 06 — Model Selection: Quality and Availability

[All cases](../../README.md) · [한국어](06-model-selection-quality-and-availability.ko.md) · [Previous: 05](05-cross-pc-index-portability.md) · [Next: 07](07-knowledge-index-consistency-and-recoverable-deployment.md)

**Evidence:** Code confirmed identifies historical source; reported at the time retains recorded observation conditions; unconfirmed marks unresolved facts or causal links. Tests are historical source evidence. Times are KST (UTC+09:00); development events and evidence-inspection dates retain their own labels.

**Document revision:** Split on 2026-10-30 from `2fc5094`. Historical publication checks below retain their dates and scope. On 2026-10-31, redundant explanations and verification-limit wording were revised from `f7fb082`.

**Development period:** 2026-09-26 ~ 2026-10-16

**Code classification:** Excerpt — 15 source/test files; Reconstructed — five configuration/evidence records.

**Outcome:** Generation settled on Gemini 3.5 Flash Lite primary and Groq GPT-OSS 120B fallback. The choice combined task-specific quality, observed availability, free-tier capacity, and the service's operating scope. Candidate adoption, local experiments, and committed runtime selection are dated separately below.

## September 26: turn a model choice into an availability policy

The Gemini API transition in 9a3df61 initially configured gemini-3.8-flash. At 14:14:51, 2e02e71 changed the lineup to gemini-3.5-flash-lite followed by gemini-3.1-flash-lite, both with the configured 1200-token output cap. The [configuration history](../../cases/model-selection-quality-availability/evidence/model-selection-history.json#L1-L242) preserves successive model identities, options, and runtime order.

**Initial-switch rationale from user-supplied ChatGPT history search:** on September 26 at approximately 13:39 KST, the developer judged the 20-call daily free-tier allowance unsuitable for a public service. At approximately 13:43, the developer requested switching to Gemini 3.5 Flash-Lite; at approximately 13:50, five successful live tests of 3.5 Flash-Lite were reported. These entries retain their search-report level, with the original conversation URL and full messages unavailable. The [clarification record](../../cases/model-selection-quality-availability/evidence/developer-clarification-20261029.json#L1-L184) identifies the three approximate times and source scope. The 14:14:51 configuration commit records the resulting lineup. October 3's 3.8 re-evaluation remains a separate later event.

The [initial Generation implementation](../../cases/model-selection-quality-availability/baseline/generation.ts#L18-L126) constructed the prompt once, visited configured models in order, and advanced only on confirmed quota exhaustion. Same-model HTTP 503 retry belonged to the SDK request configuration: four attempts, with the recorded backoff settings. [Failure classification](../../cases/model-selection-quality-availability/baseline/generation-fallback.ts#L23-L70) recognized machine-readable quota evidence and kept other 429 responses distinct. [Classification tests](../../cases/model-selection-quality-availability/baseline/generation-fallback.test.ts#L1-L52) and [Generation tests](../../cases/model-selection-quality-availability/baseline/generation.test.ts#L37-L162) preserve these early conditions, including response validation and safe diagnostics.

## September 30–October 2: compare explicit candidates, then choose runtime roles

On September 30 at 18:15:43, b00bf59 registered Gemini 3.5, Gemini 3.1, Cohere command-a-plus-05-2026, and Groq qwen/qwen3.8-27b as distinct targets. Runtime still used Gemini 3.5 then 3.1. Shared-evidence comparisons used explicit targets, so registering a candidate did not assign it a runtime role. [Case 03's comparison implementation](../../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.ts#L45-L90) and [Case 04's registry/runtime selection](../../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.ts#L36-L69) provide that mechanism.

The retained research reports output/token-limit 429 and structured JSON 400 failures for the Groq Qwen Preview candidate. At 22:22:54, 4125443 removed that target and its adapter path, while raising Gemini/Cohere output caps to 32768. The available record establishes the model-specific failure report and committed removal; the exact original attempt ledger remains unavailable.

On October 1, fixed-context question-subject experiments favored Cohere in subject retention: the reported combined stages were Cohere 54/54 and Gemini 42/54.

A subsequent local Cohere-only run still showed name-format and grounding/citation issues. [Case 03's dated subject-retention record](03-cohere-evaluation-and-retirement.md#october-1-question-subject-and-record-speaker) preserves prompt revisions, sample sizes, and the locally applied routing scope. These observations informed candidate exploration.

Commit 180cc30 on October 2 at 02:37:05 then established Gemini 3.5 primary and Cohere Command A+ fallback.

## October 3: why a quality improvement did not make Gemini 3.8 usable

**Observed situation and developer decision, clarified directly on October 29:** the usage history considered for the operating decision contained three successful responses and seventeen HTTP 503 failures against a free-tier allowance of 20 calls per day. A subsequent HTTP 429 indicated that the daily allowance was exhausted.

| Operating observation | Result |
|---|---|
| Free-tier daily call allowance | 20 |
| Successful responses | 3 |
| HTTP 503 failures | 17 |
| Subsequent response | HTTP 429 indicating daily-quota exhaustion |

**Request correspondence established from recovered originals:** the home-PC prior approved run and subsequent retry run retain ledgers, request bodies, and native provider responses, which were directly compared. The three key report/decision-file hashes matched their registered values. The [original aggregates and request ledger](../../cases/model-selection-quality-availability/evidence/october03-reported-results.json) preserve this correspondence and timestamps/body hashes/response hashes for all 24 calls.

| Gemini 3.8 run scope | Requests | Successes | HTTP 503 | HTTP 429 |
|---|---:|---:|---:|---:|
| Prior approved run | 6 | 1 | 5 | 0 |
| Subsequent retry run | 15 | 2 | 12 | 1 |
| Total before the 429 | 20 | 3 | 17 | 0 |

One Gemini 3.5 success in the prior run and two in the retry run are separate from the 3.8 usage above. The twenty-first known 3.8 request returned an actual HTTP 429/RESOURCE_EXHAUSTED envelope specifying quotaId GenerateRequestsPerDayPerProjectPerModel-FreeTier and quotaValue 20. This establishes attempt-level correspondence between the previously separate 20-call history and the retry run.

These observations and quota exhaustion grounded the developer’s conclusion that failed requests consumed daily budget. Provider-side per-request quota deduction records are unavailable.

From this result, the developer concluded that 503 failures counted toward the call allowance: most of the day's capacity had been consumed while producing very few usable responses. Twenty calls per day was already insufficient for Synethos, and losing most of that allowance to failures removed the practical reason to select Gemini 3.8 for operation.

The developer directly set the stop condition: retry HTTP 503, but abandon the model when a daily-limit 429 occurred. The observed result met that condition, and the developer excluded 3.8 from Synethos's operating candidates. Its quality advantage on some questions remained part of the evaluation.

The developer also considered whether paid access could resolve the availability problem. The user-provided ChatGPT history-search record at approximately 03:16:17 KST described similar 503 reports from paid as well as free projects. Together with the developer's own failed requests, that information gave no basis to expect payment to provide reliably successful responses. The developer judged that the additional cost did not justify adopting 3.8.

**Paired quality experiment:** the recorded re-evaluation asked whether 3.8 used evidence that 3.5 omitted. Question, evidence, order, citations, prompt, and schema were held fixed; four questions were planned. Two pairs completed:

| Case | Reported quality observation |
|---|---|
| QB18 | 3.8 was clearly better at including the supplied OCR residence/period-parsing explanation. |
| QB20 | The answers were judged equivalent. |

[The historical report reconstruction](../../cases/model-selection-quality-availability/evidence/october03-reported-results.json#L1-L4095) retains this experiment's counts: 3.8 made 15 requests, with two successes, twelve HTTP 503 responses, and one HTTP 429. The two 3.5 successes bring the run total to 17 requests. QB18 took 742.410 seconds until a 3.8 success; that successful request itself took 16.564 seconds. QB20's 3.8 success took 17.222 seconds.

The original 03:20:37 developer request was directly read in history.jsonl; its message hash and time are preserved in the [recovered-source register](../evidence/recovered-source-register.json). It required immediate termination and candidate rejection on the agreed failure condition. At 03:35:46, the daily-quota response triggered that condition. Further requests after the 429 were zero; QB25’s A request and both QB11 requests were uncalled.

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

[The dated clarification record](../../cases/model-selection-quality-availability/evidence/developer-clarification-20261029.json#L1-L184) preserves the developer judgments, search chronology, and directly inspected public references. The developer's October 29 clarification above states the inference and exclusion decision drawn from the three-success/seventeen-failure usage history.

## October 3: select a different Groq model for fallback

A separate fresh full40 comparison used the same saved evidence, question, prompt, and schema across three generators, with 40 successful responses each:

| Model | Fully correct | Grounding failures | Contract failures | Mean Generation latency |
|---|---:|---:|---:|---:|
| Gemini 3.5 Flash Lite | 27/40 | 0 | 1 | 1.508s |
| Cohere Command A+ | 22/40 | 3 | 4 | 3.042s |
| Groq GPT-OSS 120B | 25/40 | 2 | 0 | 1.524s |

The recovered full40 originals record a sequential run on October 3 at 05:10:24.134–05:53:01.835, HEAD bbac3a6d11993f3c3e3d80eec44df86e7779073d. All 120 requests, responses, results, and manual reviews were compared. The common-input hashes for 40 questions, 120 request-body hashes, native-response-to-result correspondence, and normalized-answer-to-historical-review correspondence all matched.

The [original-result projection](../../cases/model-selection-quality-availability/evidence/october03-reported-results.json) retains per-case identities and recalculated aggregates. Gemini/Cohere output caps were 32768; GPT-OSS used a 4096 cap and strict JSON Schema, omitting reasoning_effort to use the recorded provider default medium. Retry/fallback counts were zero, with a minimum 65-second Groq request-start interval.

Successful-request latency is separate from between-request waits. October 1 subject retention and the partial 3.8 comparison retain their own measures and conditions.

At 04:05:58, the retained developer request asked to re-evaluate GPT-OSS after the earlier Groq candidate failures. At 07:42:12, 0baebd9 changed runtime to Gemini 3.5 primary and Groq openai/gpt-oss-120b fallback, retaining Cohere for explicit evaluation. The configured caps were Gemini 32768 and GPT-OSS 4096 with medium reasoning effort.

The [routing regression excerpt](../../cases/model-selection-quality-availability/runtime/groq-fallback.excerpt.test.ts#L28-L93) verifies those caps, quota-triggered dispatch through the actual Groq adapter with mocked HTTP 200/429/503 responses, registry/runtime independence, and one-target explicit execution.

The resulting lineup used the evaluated GPT-OSS model after the earlier Qwen candidate was removed. [Case 04's GPT-OSS adapter](../../cases/embedding-batching-retry-pacing/architecture/groq/generation.ts#L1-L28) preserves the corresponding strict-schema and reasoning-option mapping.

## October 3: compare reasoning settings and retain the existing configuration

After full40, the developer requested Gemini 3.5 primary/GPT-OSS fallback at 06:09:47, then a reasoning-only comparison preserving the inputs and baseline at 06:30:45. The 06:38:49.902–07:18:09.538 run used the same HEAD, preserving the in-progress Groq integration changes while making fresh calls only for Gemini medium and GPT-OSS high.

The [reasoning comparison evidence](../../cases/model-selection-quality-availability/evidence/october03-reasoning-results.json) retains options, denominators, hashes for all 77 calls, and historical ratings. All 77 requests matched baseline shared inputs and differed only in the reasoning option. Retry, fallback, embedding, retrieval, reranker, and index-rebuild counts were zero.

| Comparison | Same successful questions | Fully correct | Cited required claims | Observation |
|---|---:|---|---|---|
| Gemini default/minimal → medium | 40 | 27 → 27 | 31/49 → 31/49 | Mean latency 1508.029 → 3339.448ms |
| GPT-OSS medium → high | 36 | 24 → 26 | 30/44 → 31/44 | Hard failure union 2 → 3 |

Gemini medium recovered QB18 OCR parsing and QB37 records/citation handling but omitted details in QB04/QB12, leaving no net fully-correct or coverage gain. GPT-OSS high resolved QB32’s unsupported unknown-handling explanation and recovered QB33’s decision sequence, while introducing an unsupported effect in QB12 and a naming error in QB16; QB25 entity conflation remained. These are per-question changes in the historical manual ratings.

Gemini medium succeeded on 40/40 questions. GPT-OSS high succeeded on QB01–QB36, stopped on an HTTP 429 tokens-per-day error at QB37, and left QB38–QB40 unexecuted. The returned limit 200000, used 198748, and requested 3431 describe cumulative account state, rather than usage attributable to the high run alone. Quality comparisons with high use the same 36 successful questions. This October 3 error and the October 15 rate-limit failures are separate observations.

The historical report weighed quality changes, new errors, latency, and reasoning usage and recommended retaining existing settings. The original 07:34:34 developer message retained Gemini default/minimal and GPT-OSS medium and finalized only the already implemented Groq fallback replacement. Commit 0baebd9 at 07:42:12 then recorded these settings. The [recovered-source register](../evidence/recovered-source-register.json) identifies the experiment requests, recommendation report, and final developer decision separately.

## October 6: make runtime fallback and explicit evaluation serve different purposes

The September 26 and October 3 runtime versions advanced on confirmed quota exhaustion. The later 5b78e06 integration used a shared failure policy for Generation.

The [preserved October 15 policy snapshot](../../cases/model-selection-quality-availability/availability/failure-policy.ts#L1-L93) allows quota exhaustion, rate limiting, temporary unavailability, transport failures, and timeouts to reach an independent provider; authentication, configuration, invalid request, and invalid response end Generation without advancing. [Policy tests](../../cases/model-selection-quality-availability/availability/failure-policy.test.ts#L1-L46) preserve the stage-specific conditions.

Explicit model evaluation retained one-target execution with retry disabled.

The [fixed-input runner](../../cases/model-selection-quality-availability/evaluation/fixed-input.excerpt.ts#L46-L98) clones evidence, checks each dispatched prompt, records provider identity/options and response/validation metadata, and continues to the next explicitly selected candidate after a failure. [Selected tests](../../cases/model-selection-quality-availability/evaluation/fixed-input.excerpt.test.ts#L33-L100) exercise controlled option overrides, identical inputs, failed candidates, citations, and credential boundaries.

Operational fallback and comparison are therefore reproducible as their respective execution contracts.

## October 15: compare Generation with fixed canonical evidence

Run e8fbc67f-9950-4c9e-92f6-c341a4f6ad6e ran from 22:00:09.922 to 22:04:29.995. Its execution HEAD was 3ec5bb5fec373cc59b234197d8f838188dcd62ff, while the Generation-only implementation was still uncommitted. Commit c5d615c at 22:31:13 archived the implementation and results. The archive's integrity record identifies 43 raw artifacts and ten implementation/document files; their SHA-256 values matched during this publication.

The corpus contained 27 sources and 372 chunks; question-bank canonical-portfolio content version 2 and full-40 profile version 1 fixed question membership. [Canonical snapshot construction](../../cases/model-selection-quality-availability/evaluation/canonical-snapshots.ts#L36-L96) validates references against complete source chunks, preserves evidence/citation order, and hashes inputs. Expected claims and review metadata remain outside model input. [Snapshot tests](../../cases/model-selection-quality-availability/evaluation/canonical-snapshots.test.ts#L1-L116) cover ambiguous/missing references, related/partial/unsupported evidence, deduplication, and rehashed drift.

The [Generation-only runner](../../cases/model-selection-quality-availability/evaluation/canonical-generation.ts#L81-L153) verifies the whole snapshot and both credentials before dispatch, freezes target options, and writes per-case results and completion counters. [Runner tests](../../cases/model-selection-quality-availability/evaluation/canonical-generation.test.ts#L61-L149) inspect 80 explicit mock calls, identical input, malformed/unavailable responses, credential preflight, and target drift.

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

The [observed-results reconstruction](../../cases/model-selection-quality-availability/evidence/october15-observed-results.json#L1-L2302) preserves every case's counters, input hashes, validation, latency, normalized failures, and source identities. Latency aggregates above were calculated from successful original results during publication. The October 15 run used its own evidence policy, options, prompt, and review rubric.

The [Groq client](../../cases/model-selection-quality-availability/availability/groq-client.ts#L9-L40) classifies 429 and retains projected diagnostics; its [tests](../../cases/model-selection-quality-availability/availability/groq-client.test.ts#L1-L44) cover request construction and error categories. Recorded Retry-After values ranged from 2–30 seconds; resetAfterMs ranged from 172800–1036800ms.

The [projection](../../cases/model-selection-quality-availability/availability/failure-policy.ts#L24-L93) stores the maximum of request/token reset headers. Original raw headers and error bodies were discarded. The exact exhausted limit remains unconfirmed; these retained values describe the recorded failure diagnostics.

## Accept the primary within the product's operating scope

The semantic rubric assessed question-level meaning, grounding, required claims, language, naming, basis, and citation alignment. Unsupported/related-evidence handling was correct in 8/8 cases; false-premise handling passed 3/3. The two strict failures were:

- QB22: source evidence supported absence of a mobile design, while the answer asserted that mobile verification had not occurred. Whether verification occurred was unconfirmed.
- QB35: the content and citations were supported, but the model answered in Korean despite an explicit Japanese-language request.

The recorded product decision retained Gemini primary and accepted the result without additional production-prompt changes. The developer treated QB22's stronger negative wording as an acceptable error for the present product, and Japanese instruction-following as outside the core quality priorities of a Korean-centered service. Benchmark ratings remained 32/6/2. The [reconstruction](../../cases/model-selection-quality-availability/evidence/october15-observed-results.json#L1-L2302) preserves the actual two answers, review reasons, and the recorded product decision.

Groq semantic evaluation and failed-only resume were deferred after the incomplete comparison.

**October 16 operating judgment, preserved through user-supplied ChatGPT history search:** the developer reviewed whether to retain Gemini+Groq for the free public service, considering the earlier full40 quality comparison and the October 15 rate-limit results. ChatGPT described call capacity, rather than model eligibility, as the free-operation concern and cited limits including 8K TPM. That value is retained as information discussed at the time; its exact account/model applicability was not independently established. The precise limiting quota behind the October 15 429 responses remains unconfirmed.

The developer distinguished Groq calls after a Gemini primary failure from using Groq as the main generator. On that operating basis, the developer retained Gemini 3.5 primary → Groq GPT-OSS 120B fallback. The [clarification record](../../cases/model-selection-quality-availability/evidence/developer-clarification-20261029.json#L1-L184) separates this search-based operating judgment from both experiments and their original conditions. The original conversation URL and full messages remain unavailable.

On October 16 at 21:32:34, e700717 removed Cohere's evaluation/support paths while retaining the Gemini 3.5/Groq pair. [Case 03's retirement judgment](03-cohere-evaluation-and-retirement.md#retirement-decision-benefit-relative-to-scale-and-operating-cost) supplies the scale, substitutability, and cost context; Case 06 ends with the selected Generation lineup.

## Source levels, publication choices, and remaining questions

Configuration changes and published historical source are code-confirmed. Original October 3 requests, responses, manual ratings, exact options, correspondence between both runs, and the additional reasoning comparison were directly checked. October 15 results and archive hashes were also directly inspected; semantic ratings and product acceptance remain preserved manual-review records.

Developer-provided ChatGPT search records retain the initial September 26 switch rationale/five-test report, October 3 discussion/usage report, and October 16 fallback-retention judgment at their search-evidence level. October 3 Codex stop conditions and setting-retention decisions were separately confirmed in original user-input history.

The October 29 capacity rationale, recalled quota depletion, and broader external-reaction memory remain attributed later statements.

Remaining gaps are provider-side per-request quota deductions, the original Qwen failure ledger, the original ChatGPT conversation/AI Studio screenshot, and other external posts recalled by the developer. Groq’s October 15 semantic quality and exact limiting quota remain unconfirmed. Recovered October 3 responses, options, request correspondence, and historical limits retain their respective record dates.

Whole-file Excerpts keep small, coherent implementation/test units: baseline quota handling, canonical evidence/runner contracts, and transport/diagnostic behavior. Partial Excerpts isolate fixed-input comparison and the adopted runtime's regressions, preserving original statements, imports, and references. The common policy is retained whole because its fallback eligibility, header/body parsing, and safe projection work together.

Reconstructed JSON selects original settings/results and labels editorial grouping, aggregate calculations, earlier transcriptions, and later developer testimony. The two selected generated answers preserve actual failure evidence; full knowledge payloads and credentials remain private.

Original commits, paths, excerpt ranges, full hashes and reconstruction inputs are preserved in the [complete source ledger](06-source-ledger.md).

## Publication checks

Twelve whole-file Excerpts matched their Git source bytes; three partial Excerpts matched every declared source range. All 15 TypeScript files passed syntax parsing. The original four JSON reconstructions passed parsing, 57 hashed-input comparisons during initial publication preparation, configuration projection, original-result aggregation, representative-response comparison, and source-linkage checks. The October 15 archive’s 43 raw files and ten implementation/document files matched their recorded SHA-256 values.

The reconstructed counts were checked against all 40 case results, including 80 single Generation dispatches, 52 successful structural results, 28 rate-limit failures, success-only latency statistics, and the manual 32/6/2 ratings. The seven October 3 search times, three approximate September 26 times, October 16 operating judgment, AI Studio 17/20 report, and developer quota inference were checked for consistent attribution.

The 8K TPM discussion and unresolved October 15 quota cause retain separate scopes. English/Korean code and external-reference targets and hashes match. All 622 local links passed file, heading, and line-range validation. The 112 published files in cases 01–05 were preserved at that stage. Subsequent textual evidence additions are covered by the additional checks below.

New code, selected responses, and document sections were reviewed for credential values, private knowledge payloads, private repository URLs, local user paths, and operational access details. Verification used historical source inspection, local parsing/calculation, and direct reading of the linked public forum post. Historical application tests, model calls, index builds, and live server access were not performed.

## October 29 recovery and additional verification

Nineteen representative originals and all 1146 files across five experiment directories were checked through byte hashes. Text hashes and UTC/KST times were verified for eleven archived-session messages and fourteen original user inputs. Case 01’s six runtime files, the case 03/04 archive, and case 06’s three previously registered report/decision files matched their recorded hashes.

All 120 full40 requests, responses, results, and historical manual reviews, 24 prior/retry ledger entries, and 77 reasoning requests were cross-checked. Request-body hashes, response correspondence, classification counts, and successful-request latency were verified. Reasoning requests matched baseline shared inputs and differed only in the reasoning option. GPT-OSS high quality denominators were verified as 36 successful questions, 44 required claims, and 33 positive questions, separate from attempted-review totals that include failed QB37.

All fourteen public JSON files parsed. English/Korean file/external links and SHA-256 multisets matched. The two READMEs and two development records passed validation of all 656 local file, heading, and line-range links. The existing 119 source/test files and Synethos originals were preserved; the Synethos working tree was clean.

Existing-file changes cover two development records and two evidence JSON files; a reasoning-evidence JSON and shared recovered-source register were added. Published material was checked for credential values, local user paths, private repository URLs, and full knowledge payloads.

Verification used original-record inspection and local computation; no new model call, historical experiment rerun, application test, index build, or server access was performed.

[Back to all cases](../../README.md)
