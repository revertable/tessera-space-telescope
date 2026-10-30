# 08 — Fix the Chunker, Not the Documents

[All cases](../../README.md) · [한국어](08-fix-the-chunker-not-the-documents.ko.md) · [Previous: 07](07-knowledge-index-consistency-and-recoverable-deployment.md)

**Evidence:** Code confirmed identifies historical source; reported at the time retains recorded observation conditions; unconfirmed marks unresolved facts or causal links. Tests are historical source evidence. Times are KST (UTC+09:00); development events and evidence-inspection dates retain their own labels.

**Document revision:** Split on 2026-10-30 from `2fc5094`. Historical publication checks below retain their dates and scope.

**Development period:** 2026-09-29 ~ 2026-10-02.

**Code classification:** Excerpt — three whole original files and four selected test extracts. Three Reconstructed evidence records connect the originals, historical reports and remaining questions.

**Outcome:** The developer rejected a document workaround and chose a general chunker correction that preserved normal Markdown hierarchy and the distinct work/tools sections of career records. Later offline lexical/hybrid candidates improved some coverage measures while losing valid support, and the research record reports all candidates as unadopted.

## Diagnose the failure before choosing a ranking technique

The September 29 baseline used an original query, cosine-ranked local chunks, minimumScore 0.25 and Top5 evidence. The retained 38-case calibration distinguished several failure locations. MSA support ranked 8; direct Observatory verification support ranked 125 for a compound question but 1 for a narrower question. Other failures occurred with supporting material already at ranks 1 or 2: claim interpretation, omitted answerable content and output-language compliance.

At 16:21:16.121 the developer asked to review reranking as a hypothesis and separate candidate-boundary loss, query representation, evidence sufficiency and generation failure. At 16:39:40.627 the developer asked to select MVP changes by demonstrated cost and benefit, allowing non-adoption. The AI's proposal distinguished a wider candidate pool from the later ability to promote useful evidence. The Top8 generation trial and the oracle trial that inserted known support were diagnostic evidence-selection variations. The inspected September 29 record contains no measured reranker-model result.

A separate September 30 retrieval-only comparison used the same 38 questions, ground truth, 525-chunk corpus, Top5 and minimumScore 0.25 for Cohere Embed v4/1536 and Gemini Embedding 2/768. Stored outputs contain 38 query-embedding attempts per target. Recounting those outputs gives:

| Stored-result measure | Cohere1536 | Gemini768 |
|---|---:|---:|
| Supported claims covered in production Top5 | 29/32 | 31/32 |
| Questions with all supported claims covered | 24/27 | 26/27 |

The denominators cover supported claims and supportable questions in this calibration. The corpus fingerprint was d047a7dc…52bdbf. These observations belong to the provider comparison before chunker v2; the earlier September 29 ranking used another fingerprint. The [decision and observation record](../../cases/fix-the-chunker/evidence/decisions-and-observations.json#L1-L228) identifies both scopes and the stored artifacts.

## The corpus audit exposed a hierarchy problem

The immediate September 30 audit request came from corpus maintenance. Removing Voyage exposed current provider and operational facts duplicated in visitor-facing Knowledge. At 11:51:19.568 the developer requested stable product/design/history material in the corpus and current operational state in config/docs. At 12:17:51.973 the developer requested a complete corpus review before rebuilding the index, including actual chunk boundaries.

The AI found repeated career headings such as “work performed” and “tools.” The [previous chunker](../../cases/fix-the-chunker/before/chunker.ts#L1-L60) retained only the latest heading. Its section parser and chunk construction discarded the parent project context from the child's metadata and retrieval text. The document-level title could not identify each project.

The original diagnosis identified 24 child chunks with missing parent-heading metadata. Twelve tools chunks also lacked project identifiers in their bodies; other work chunks retained varying clues. The defect was loss of identifying context during chunk construction. A general whole-paragraph loss was not established.

At 12:43:07.931 the AI proposed replacing 24 child headings with bold labels, combining each career group. Its preview predicted career chunks 38→14 and corpus chunks 527→503. This was a proposed alternative, retained here with its predicted counts.

## The developer kept the document and changed the processing layer

At 12:46:37.586 the developer withheld approval for the career-document change. The original hierarchy—project heading, work heading, tools heading—was normal Markdown. The developer requested a general way for child chunks to inherit identifying context while keeping the work/tools units separate, and required an explicit impact analysis for IDs, content, fingerprint and evidence references.

At 13:01:32.183 the developer added two requirements. Heading-like lines inside fenced examples had been interpreted as real boundaries and heading-state changes. They should remain section content. The developer also required inspection of actual embedding inputs so the chunker would add missing section ancestry while avoiding duplicated document titles.

The adopted implementation is the [complete chunker v2](../../cases/fix-the-chunker/after/chunker.ts#L1-L109) from fce18cee:

| Mechanism | Historical implementation |
|---|---|
| Heading ancestry | A level-aware stack removes same-level/deeper siblings and carries parent section headings into each child. [Section parsing](../../cases/fix-the-chunker/after/chunker.ts#L20-L73) |
| Fenced examples | Matching backtick/tilde fences keep internal heading-like lines as content and preserve the real heading stack. [Fence handling](../../cases/fix-the-chunker/after/chunker.ts#L39-L55) |
| Document title | The first heading, when H1, retains its boundary and is treated as the document title; later H1s remain section context. [Heading state](../../cases/fix-the-chunker/after/chunker.ts#L56-L65) |
| Chunk construction | Existing body splitting runs first; ancestry and leaf heading are added to each resulting part. Public title remains a separate field. [Content construction](../../cases/fix-the-chunker/after/chunker.ts#L92-L109) |

The source career document was preserved across the implementation commit. The rejected 38→14 merge remained a proposal.

## Approval depended on a consistent impact analysis

The first AI impact table confused English/Korean source counts with before/after counts. At 13:18:30.643 the developer withheld approval and required independent calculations for ancestry, fence parsing and title handling across all 44 sources.

The corrected report gave ancestry-only 527 chunks, fence-only 505, title-only 527, and combined 505. Only Blueprint EN/KR changed counts, each 24→13. The developer required independent implementation checks against the declared invariants at 13:32:36.808 and approved at 13:33:38.322.

During implementation, a body-comparison assertion failed and the AI stopped. The subsequent diagnosis found that the checker had omitted CRLF→LF normalization already performed by both chunkers. The developer directed continuation at 13:49:13.663. The completion report at 14:09:45.154 recorded:

| Historical verification | Reported result |
|---|---|
| Corpus | 44 sources; 527→505 chunks |
| Career records | 38 chunks retained; correct parent context in 24 child chunks |
| Blueprint | Two sources, each 24→13 chunks |
| Other sources | 42 retain chunk IDs and leaf sections |
| Non-live tests / type check | 67 passed / 0 errors, 0 warnings |
| Index state immediately after the change | Cohere1536 STALE; Gemini768 STALE; Gemini1536 MISSING |

The [original chunker tests](../../cases/fix-the-chunker/verification/chunker.test.ts#L1-L123) cover hierarchy, sibling isolation, skipped levels, title handling, long sections and fence edge cases. The [corpus tests](../../cases/fix-the-chunker/verification/corpus-context.excerpt.test.ts#L14-L76) independently match all 24 career child contexts, check Blueprint sections and include chunker-version identity checks.

The remaining extracts connect the same context to [document embedding](../../cases/fix-the-chunker/verification/embedding-context.excerpt.test.ts#L17-L36), [search evidence](../../cases/fix-the-chunker/verification/search-context.excerpt.test.ts#L24-L36) and [generation input](../../cases/fix-the-chunker/verification/generation-context.excerpt.test.ts#L5-L16). Their assertions describe input propagation. Search-quality before/after effects remain unmeasured in the recovered records.

Commit fce18cee958785252a7f07259c13dafb536086c3 at 15:07:49 records the implementation and tests. Commit 29d2b21d8c0331575478ec5e9d13470729d30b0d at 15:08:38 records subsequent index publication. Code integration and artifact publication retain their own evidence; production-server deployment at this date is outside the recovered verification.

## Later lexical/hybrid tuning improved coverage and lost support

The October 2 comparison used stored Full40 rankings at HEAD bbac3a6, 505 chunks and canonical-portfolio v1. Original 35 and derived 5 question paths retained their selection conditions. The existing research record describes four offline lexical/hybrid rules.

| Research-reported measure | Baseline | Best coverage candidate B1, λ=0.10 |
|---|---:|---:|
| Required groups | 40/49 | 42/49 |
| All-required questions | 30/36 | 31/36 |
| Irrelevant evidence | 3 | 6 |

QB32 lost direct supporting evidence, and the record reports that loss across all four candidates. All were recorded as unadopted; ending this tuning round and keeping production was recommended. The inspected bbac3a6 production path uses cosine ranking, threshold/TopK selection and the derived-intent branch. It contains no lexical/hybrid reranking stage.

The [reranking research summary](../../cases/fix-the-chunker/evidence/reranking-research-summary.json#L1-L92) preserves these reported numbers, conditions and the original report's registered hash. Its raw report, exact rule/formula, rankings and manual ratings are currently unavailable in this checkout. Generation effects were unmeasured.

## Evidence boundaries and follow-up

The [source register](../../cases/fix-the-chunker/evidence/source-register.json#L1-L521) identifies original session 01a0ea78-071a-7243-ac8e-1e5d7ee57aae, its compressed/decompressed hashes and 32 selected message hashes with roles and UTC/KST times. The developer's decisions are directly visible in historical messages. Test counts and execution outcomes retain their contemporary report status. Three private Git research snapshots support the October 2 summary, and six retained local artifacts support the earlier diagnostic/provider comparison.

The September 30 audit request establishes its immediate maintenance and rebuild context. A direct causal message tying that audit to the earlier reranker review remains unrecovered. The initial recollection guided the search; the dated originals determine this sequence.

Home follow-up targets the registered hybrid-selection-calibration/2026-10-02-1 report, plan, per-question comparison and manual semantic review; bilingual-collapse and original-top6 runs retain separate scopes. The register also requests the October 2 proposal/approval/decision messages and any matched retrieval-quality runs before/after chunker v2. The 527→505 count change and context-preservation tests describe structural correctness.

The published code and synthetic tests retain original imports and application references. Evidence records expose identifiers, hashes and selected observations while keeping source Knowledge, complete conversations, credentials and server access material private.

<details>
<summary>Original excerpts, ranges and SHA-256</summary>

| Public Excerpt | Original commit / path / original lines → public lines | Original SHA-256 → public SHA-256 |
|---|---|---|
| [before/chunker.ts](../../cases/fix-the-chunker/before/chunker.ts#L1-L60) | da1dfe04192658973f12596fcad29cbf11ea9d71<br>sveltekit/src/lib/server/knowledge/chunker.ts<br>1–60 → 1–60 | 9e0337d881286d99d9fbd25cfd8fea68605726b7a18e0b8752ae63c97d61a1fd → 9e0337d881286d99d9fbd25cfd8fea68605726b7a18e0b8752ae63c97d61a1fd |
| [after/chunker.ts](../../cases/fix-the-chunker/after/chunker.ts#L1-L109) | fce18cee958785252a7f07259c13dafb536086c3<br>sveltekit/src/lib/server/knowledge/chunker.ts<br>1–109 → 1–109 | db887b35a4da9d07d4095f2347782c57123d902508536eff79574b1e9e9b5bfa → db887b35a4da9d07d4095f2347782c57123d902508536eff79574b1e9e9b5bfa |
| [verification/chunker.test.ts](../../cases/fix-the-chunker/verification/chunker.test.ts#L1-L123) | fce18cee958785252a7f07259c13dafb536086c3<br>sveltekit/src/lib/server/knowledge/chunker.test.ts<br>1–123 → 1–123 | c1fc3e368b54d3f4985244ba7dd25c152cd1b02fc825721f3b7bcfd944fc6f3f → c1fc3e368b54d3f4985244ba7dd25c152cd1b02fc825721f3b7bcfd944fc6f3f |
| [verification/corpus-context.excerpt.test.ts](../../cases/fix-the-chunker/verification/corpus-context.excerpt.test.ts#L1-L76) | fce18cee958785252a7f07259c13dafb536086c3<br>sveltekit/src/lib/server/indexing/corpus.test.ts<br>1–12 → 1–12; 249–311 → 14–76 | 709c64f845c49e627fab702a6bcf4bed0ad60c52a6c7b418136cc7507c3385e0 → 094f04dc22c65c836f0b5430ead4947e62a91e802fa4e2a12ddfe39f00502102 |
| [verification/embedding-context.excerpt.test.ts](../../cases/fix-the-chunker/verification/embedding-context.excerpt.test.ts#L1-L36) | fce18cee958785252a7f07259c13dafb536086c3<br>sveltekit/src/lib/server/embedding/embeddings.test.ts<br>1–15 → 1–15; 258–277 → 17–36 | b8a5c207e4811c8789ad50d15b6d285e743fd8cb3b0376608dcfa5ee26b2d24f → 6ba9ca851d69b45d0717a4aa760749b5591bbff0cac4449b0bcd8e4bff4ad25f |
| [verification/search-context.excerpt.test.ts](../../cases/fix-the-chunker/verification/search-context.excerpt.test.ts#L1-L36) | fce18cee958785252a7f07259c13dafb536086c3<br>sveltekit/src/lib/server/retrieval/search.test.ts<br>1–22 → 1–22; 112–124 → 24–36 | cab05bd9679702bd2c5505d4dade1430c1ab86fadf5dc707fa9ac02f8f497905 → 3d65fea226f76d9761229bea0df2a3eaf721de3011e68dcf7d3b1a08011db7cc |
| [verification/generation-context.excerpt.test.ts](../../cases/fix-the-chunker/verification/generation-context.excerpt.test.ts#L1-L16) | fce18cee958785252a7f07259c13dafb536086c3<br>sveltekit/src/lib/server/generation/answer-prompt.test.ts<br>1–3 → 1–3; 55–66 → 5–16 | 1bc8e67aa4bfafa1b4b600d52ff7aceb6a2439f00c1708fb2bad4f2160ee3aab → 9752be9d33d1e03ea302e16ed01516b426c20fca12104d158334c5ac01fa7ef4 |

Selected extracts join original ranges in order with one blank line. Source paths are relative to the private Synethos repository.

| Public evidence | Classification | SHA-256 |
|---|---|---|
| [evidence/decisions-and-observations.json](../../cases/fix-the-chunker/evidence/decisions-and-observations.json#L1-L228) | Reconstructed | 0768365d0864cd47e3bfd976ba275265e74d7e6323d5947b50d00966e9709d82 |
| [evidence/reranking-research-summary.json](../../cases/fix-the-chunker/evidence/reranking-research-summary.json#L1-L92) | Reconstructed | 509793479306f9a1c0daf3854b1503c2b5f7c03c2b1d15ffc6f93e331ba65227 |
| [evidence/source-register.json](../../cases/fix-the-chunker/evidence/source-register.json#L1-L521) | Reconstructed | 337c58ddd11659a16e03a0c952742a15f59c00e7f454053a71c987b90343961d |

</details>

## Publication checks

All seven code files matched the declared historical Git ranges and hashes; seven TypeScript syntax parses and three JSON parses passed. The compressed/decompressed session hashes and 32 selected message hashes matched, together with three Git research snapshots and six retained local artifacts. Stored provider-comparison questions, ground truth and counts were checked by local calculation.

The two READMEs and two engineering records passed 746 local file, heading and line-range links. English/Korean file and external-link targets and SHA-256 sets matched. Existing public files 140 and case 01–07 prose were preserved; README introduction/copyright and common evidence guidance were preserved. New code, evidence projections and case 08 prose were reviewed for private payloads, credentials and operating access details.

Verification used original reads, local parsing and hash/count calculations. Historical tests, model calls, index builds and deployment were not executed. Synethos remained unchanged. October 2 raw-artifact verification remains pending.

[Back to all cases](../../README.md)
