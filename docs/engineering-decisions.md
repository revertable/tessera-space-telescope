# Engineering Decisions

[Tessera case list](../README.md) · [한국어](engineering-decisions.ko.md)

Detailed records are now individual case documents. Each summary links to its full record; existing URLs and subsection anchors lead to the corresponding case summary.

<a id="contents"></a>

## Reading the evidence

These development records draw on retained materials compared and supplemented through Codex at home and in the office, together with context restored as far as available through ChatGPT and supplied by the developer. Code, historical observations, and developer decisions are described according to their sources and execution conditions.

- **Code confirmed:** behavior visible in the identified historical source snapshot, or the byte-for-byte source comparison used to prepare these excerpts.
- **Reported at the time:** a retained development request, experiment artifact, or verification report describes the observation. These observations retain their original execution conditions and verification scope.
- **Unconfirmed:** the available records do not establish the cause, correspondence, or broader effect.

Each case includes a source ledger identifying its code snapshots and retained evidence. Historical tests are published as implementation evidence; this repository does not provide their dependencies or a test runner.

Retained originals on the home PC were additionally inspected on October 29, 2026. The [recovered-source register](evidence/recovered-source-register.json) preserves original file hashes, session/message times, observation conditions, and the verification scope of each source for cases 01–06. User-input history identifies original requests and decisions; experiment results and completion reports retain their historical execution conditions.

## 01 — From Local Qwen/Ollama Inference to the Gemini API

<a id="problem-and-constraints"></a>
<a id="experiments-and-the-option-that-was-retired"></a>
<a id="decision"></a>
<a id="implementation-local-http-calls-to-a-server-side-api-client"></a>
<a id="implementation-preserve-grounding-while-changing-the-provider"></a>
<a id="implementation-a-new-embedding-contract-requires-a-new-index"></a>
<a id="verification-results-and-their-limits"></a>
<a id="source-traceability"></a>
<a id="before-snapshot"></a>
<a id="after-implementation-and-test-snapshot"></a>
<a id="development-records-and-verification-evidence"></a>

**Development date:** 2026-09-26

Local Qwen inference exposed hardware and response-time constraints. The developer retired local inference, selected the Gemini API and preserved grounding while replacing the model and embedding integration.

[Read the full development record](decisions/01-local-inference-to-gemini.md)

## 02 — From GitBook MCP to Local Knowledge

<a id="problem-and-initial-choice"></a>
<a id="what-the-endpoint-observations-established"></a>
<a id="implementing-a-defensive-evidence-boundary"></a>
<a id="combining-sources-revealed-a-different-class-of-problems"></a>
<a id="decision-import-first-then-remove-the-remote-source"></a>
<a id="implementation-approved-local-files-with-public-citation-provenance"></a>
<a id="corpus-readiness-was-not-index-readiness"></a>
<a id="what-changed-what-stayed-and-what-remains-unconfirmed"></a>
<a id="source-traceability-and-publication-form"></a>
<a id="code-correspondence"></a>
<a id="non-code-evidence"></a>
<a id="publication-checks"></a>

**Development period:** 2026-09-26 ~ 2026-09-28

GitBook MCP exposed Cosmic Horizon documents through a remote KnowledgeSource. After endpoint and multi-source observations, the developer chose approved local documents and separated document import, index readiness and MCP removal.

[Read the full development record](decisions/02-gitbook-to-local-knowledge.md)

## 03 — Introducing, Evaluating, and Retiring Cohere

<a id="development-sequence"></a>
<a id="introducing-an-alternative-embedding-space"></a>
<a id="extending-evaluation-to-generation"></a>
<a id="october-1-question-subject-and-record-speaker"></a>
<a id="october-3-fixed-input-generation-results-and-fallback-selection"></a>
<a id="october-6-a-classifier-gate-stopped-expansion"></a>
<a id="october-15-retrieval-retained-measurable-advantages"></a>
<a id="retirement-decision-benefit-relative-to-scale-and-operating-cost"></a>
<a id="removal-implementation-and-index-handover"></a>
<a id="verification-scope-and-remaining-questions"></a>
<a id="source-traceability-and-publication-form-1"></a>
<a id="source-commits"></a>
<a id="code-correspondence-1"></a>
<a id="reconstruction-rules"></a>
<a id="non-code-evidence-and-availability"></a>
<a id="publication-checks-1"></a>

**Development period:** 2026-09-28 ~ 2026-10-17

Cohere added alternative embedding and generation capabilities. Role-specific evaluations showed advantages and failures; the developer ultimately weighed the observed difference against Synethos's scale, alternatives and operating cost and chose removal.

[Read the full development record](decisions/03-cohere-evaluation-and-retirement.md)

## 04 — Provider Architecture and Embedding Reliability

<a id="the-problem-and-the-sequence-of-changes"></a>
<a id="separating-contracts-factories-adapters-and-common-behavior"></a>
<a id="from-single-document-requests-to-provider-owned-batches"></a>
<a id="diagnosing-failure-before-choosing-recovery"></a>
<a id="separating-build-targets-runtime-order-and-credentials"></a>
<a id="retrying-the-current-document-batch"></a>
<a id="applying-the-same-architecture-to-generation-replacement"></a>
<a id="october-16-from-reactive-retry-to-request-start-pacing"></a>
<a id="one-build-local-gate-common-retry-logging"></a>
<a id="index-compatibility-and-failure-safe-publication"></a>
<a id="completing-the-rebuilt-artifact"></a>
<a id="verification-levels-and-source-selection"></a>
<a id="source-traceability-and-publication-form-2"></a>
<a id="source-commits-1"></a>
<a id="code-correspondence-2"></a>
<a id="reconstruction-rules-and-inputs"></a>
<a id="development-reports-and-research-records"></a>
<a id="publication-checks-2"></a>

**Development period:** 2026-09-26 ~ 2026-10-17

Separate provider contracts, factories and configuration supported changes among Gemini, Cohere and Groq. Document embedding evolved through provider-owned batching, bounded retry, request-start pacing and validated index publication.

[Read the full development record](decisions/04-provider-architecture-and-embedding-reliability.md)

## 05 — Cross-PC Index Portability

<a id="september-28-a-shared-artifact-instead-of-repeated-document-embedding"></a>
<a id="september-30-line-endings-changed-hashes-while-chunks-stayed-equal"></a>
<a id="preserve-vectors-through-explicit-migration"></a>
<a id="current-and-the-evolving-portability-contract"></a>
<a id="october-2226-windows-built-indexes-in-ubuntu-production"></a>
<a id="evidence-level-and-remaining-questions"></a>
<a id="sources-and-publication-choices"></a>
<a id="publication-checks-3"></a>

**Development period:** 2026-09-28 ~ 2026-10-26

The developer wanted to reuse built indexes across PCs and checkouts. Identity, line-ending canonicalization and compatibility checks preserved reuse, which later extended from Windows builds to Ubuntu production.

[Read the full development record](decisions/05-cross-pc-index-portability.md)

## 06 — Model Selection: Quality and Availability

<a id="september-26-turn-a-model-choice-into-an-availability-policy"></a>
<a id="september-30october-2-compare-explicit-candidates-then-choose-runtime-roles"></a>
<a id="october-3-why-a-quality-improvement-did-not-make-gemini-38-usable"></a>
<a id="october-3-select-a-different-groq-model-for-fallback"></a>
<a id="october-3-compare-reasoning-settings-and-retain-the-existing-configuration"></a>
<a id="october-6-make-runtime-fallback-and-explicit-evaluation-serve-different-purposes"></a>
<a id="october-15-compare-generation-with-fixed-canonical-evidence"></a>
<a id="accept-the-primary-within-the-products-operating-scope"></a>
<a id="source-levels-publication-choices-and-remaining-questions"></a>
<a id="publication-checks-4"></a>
<a id="october-29-recovery-and-additional-verification"></a>

**Development period:** 2026-09-26 ~ 2026-10-16

Fixed-input evaluations connected answer quality, grounding, citation, schema, latency and availability to runtime model choices. Free-tier limits and repeated failures shaped the Gemini primary and Groq fallback configuration.

[Read the full development record](decisions/06-model-selection-quality-and-availability.md)

## 07 — Knowledge–Index Consistency and Recoverable Deployment

<a id="operating-environment-and-usable-space"></a>
<a id="total-three-releases-developer-choice-and-ai-design"></a>
<a id="earlier-deployment-issues-and-the-new-candidate"></a>
<a id="bundle-code-knowledge-and-index-into-one-release"></a>
<a id="original-requests-declarations-approvals-and-execution"></a>
<a id="actual-operation-and-restoration-verified-in-tests"></a>
<a id="evidence-scope-and-remaining-questions"></a>
<a id="publication-checks-5"></a>

**Development period:** 2026-10-22 ~ 2026-10-26. The developer directly clarified operating constraints, retention choice, and design delegation on 2026-10-29.

Limited Ubuntu disk space shaped a three-release retention choice. Deployment tied code, Knowledge and Index together, checked Linux dependencies and active roots, and verified activation and recovery under their distinct execution scopes.

[Read the full development record](decisions/07-knowledge-index-consistency-and-recoverable-deployment.md)

## 08 — Fix the Chunker, Not the Documents

<a id="diagnose-the-failure-before-choosing-a-ranking-technique"></a>
<a id="the-corpus-audit-exposed-a-hierarchy-problem"></a>
<a id="the-developer-kept-the-document-and-changed-the-processing-layer"></a>
<a id="approval-depended-on-a-consistent-impact-analysis"></a>
<a id="later-lexicalhybrid-tuning-improved-coverage-and-lost-support"></a>
<a id="evidence-boundaries-and-follow-up"></a>
<a id="publication-checks-6"></a>

**Development period:** 2026-09-29 ~ 2026-10-02.

Retrieval diagnosis distinguished missing support from generation failures. The developer rejected reshaping normal Markdown around the parser, chose a general chunker correction, and later lexical/hybrid candidates remained unadopted after valid support was lost.

[Read the full development record](decisions/08-fix-the-chunker-not-the-documents.md)
