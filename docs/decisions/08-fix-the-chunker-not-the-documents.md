# 08 — Fix the Chunker, Not the Documents

[All cases](../../README.md) · [한국어](08-fix-the-chunker-not-the-documents.ko.md) · [Previous: 07](07-knowledge-index-consistency-and-recoverable-deployment.md)

**Evidence:** Code confirmed identifies historical source; reported at the time retains recorded observation conditions; unconfirmed marks unresolved facts or causal links. Tests are historical source evidence. Times are KST (UTC+09:00); development events and evidence-inspection dates retain their own labels.

**Document revision:** Split on 2026-10-30 from `2fc5094`. Historical publication checks below retain their dates and scope. On 2026-10-31, redundant explanations and verification-limit wording were revised from `f7fb082`.

**Development period:** 2026-09-29 ~ 2026-10-02.

**Code classification:** Excerpt — four whole original files and four selected test extracts. Four Reconstructed evidence records connect the originals, historical reports and remaining questions.

**Outcome:** The developer rejected a document workaround and chose a general chunker correction that preserved normal Markdown hierarchy and the distinct work/tools sections of career records. Later offline lexical/hybrid candidates improved some coverage measures while losing valid support, and the recovered original reports record all candidates as unadopted.

## Diagnose the failure before choosing a ranking technique

The September 29 baseline used an original query, cosine-ranked local chunks, minimumScore 0.25 and Top5 evidence. The retained 38-case calibration distinguished several failure locations. MSA support ranked 8; direct Observatory verification support ranked 125 for a compound question but 1 for a narrower question. Other failures occurred with supporting material already at ranks 1 or 2: claim interpretation, omitted answerable content and output-language compliance.

At 16:21:16.121 the developer asked to review reranking as a hypothesis and separate candidate-boundary loss, query representation, evidence sufficiency and generation failure. At 16:39:40.627 the developer asked to select MVP changes by demonstrated cost and benefit, allowing non-adoption. The AI's proposal distinguished a wider candidate pool from the later ability to promote useful evidence. The Top8 generation trial and the oracle trial that inserted known support were diagnostic evidence-selection variations. The inspected September 29 record contains no measured reranker-model result.

A separate September 30 retrieval-only comparison used the same 38 questions, ground truth, 525-chunk corpus, Top5 and minimumScore 0.25 for Cohere Embed v4/1536 and Gemini Embedding 2/768. Stored outputs contain 38 query-embedding attempts per target. Recounting those outputs gives:

| Stored-result measure | Cohere1536 | Gemini768 |
|---|---:|---:|
| Supported claims covered in production Top5 | 29/32 | 31/32 |
| Questions with all supported claims covered | 24/27 | 26/27 |

The denominators cover supported claims and supportable questions in this calibration. The corpus fingerprint was d047a7dc…52bdbf. These observations belong to the provider comparison before chunker v2; the earlier September 29 ranking used another fingerprint. The [decision and observation record](../../cases/fix-the-chunker/evidence/decisions-and-observations.json#L1-L253) identifies both scopes and the stored artifacts.

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

Commit fce18cee958785252a7f07259c13dafb536086c3 at 15:07:49 records the implementation and tests. Commit 29d2b21d8c0331575478ec5e9d13470729d30b0d at 15:08:38 records subsequent index publication. Code integration and artifact publication retain their own evidence.

## Later selection experiments: developer criteria and AI comparisons

The October 2 comparisons followed the chunker correction and used stored Full40 rankings at HEAD bbac3a6, 505 chunks and canonical-portfolio v1. The developer kept production unchanged, varied one axis at a time, and weighed coverage against preserved support and wrong-project evidence. Original user-input history establishes this sequence:

| Time KST | Developer-requested comparison and constraints |
|---|---|
| 20:59:38 | Compare original-only Top5→Top6 from saved rankings; preserve the derived path; evaluate coverage alongside contamination and context cost |
| 21:12:22 | Collapse only selected EN/KR pairs for the same logical section; compare KR preference with higher-rank preference; preserve direct support and important details without backfill |
| 22:32:15 | Compare generic lexical/hybrid selection within Top5; score only question/candidate information; include irrelevant-evidence growth and existing support loss in adoption decisions |

The last request describes Top6 and bilingual collapse as already unadopted. The developer set the evaluation boundaries and success criteria; the AI specified the Top30 pool, scoring formulas and weights and implemented the offline comparison. The [selection-alternatives record](../../cases/fix-the-chunker/evidence/october02-selection-alternatives.json#L1-L277) links original-request UTC/KST timestamps and text hashes to each experiment's retained results.

### Top6 expansion and bilingual collapse

| Stored result | Required groups / all-required questions | Evidence / direct-support records |
|---|---|---|
| Shared baseline | 40/49 · 30/36 | 199 · 51 |
| Original-only Top6 | 42/49 · 31/36 | 234 · 56 |
| Bilingual collapse: KR preferred | 40/49 · 30/36 | 191 · 47 |
| Bilingual collapse: higher rank preferred | 38/49 · 29/36 | 191 · 47 |

Top6 rescued two required groups, but 30 of its 35 added evidence records were classified as background or distractors. Additions included seven wrong-project records, two irrelevant records and one image-only record; prompt-content character count grew by about 15.22%. The AI's decision.json rejects this global Top6 policy.

KR-preferred bilingual collapse preserved strict coverage. Direct-support records fell from 51 to 47 through removal of four duplicates, while **logical direct-support sections remained 46**. The historical manual review found no substantive loss of important claims or details. The developer's criteria also excluded direct-support decreases; a generic runtime content-correspondence guarantee and generation benefit remained unverified, so both strategies were recorded as unadopted. Higher-rank preference additionally lost two strict required groups. These results retain their own conditions alongside the actual support loss in hybrid selection below.

### Lexical/hybrid coverage gains and actual support loss

The [original scoring code](../../cases/fix-the-chunker/research/rules.mjs#L1-L11) evaluates only candidates within vector Top30 whose raw cosine is at least 0.25. After NFKC, lowercase and apostrophe normalization, it combines exact-token recall .60 with within-token Hangul-bigram recall .40. B1 measures coverage over combined body, section, title and source metadata; B2 uses pool-IDF and field weights body .65, section .20, title .10 and source .05. H = raw cosine + λL, with λ=.04/.10 confirmed by the plan/rule hashes stored in selection. Ties resolve by cosine and original rank. Expected answers, required evidence and question IDs are excluded from scoring inputs.

| Recount of stored 40-question results | Required groups | All-required questions | Wrong project/entity | Irrelevant |
|---|---:|---:|---:|---:|
| Baseline | 40/49 | 30/36 | 20 | 3 |
| B1 λ=.04 | 40/49 | 30/36 | 19 | 4 |
| B1 λ=.10 | 42/49 | 31/36 | 17 | 6 |
| B2 λ=.04 | 39/49 | 29/36 | 21 | 4 |
| B2 λ=.10 | 41/49 | 30/36 | 20 | 4 |

Coverage-best B1(.10) rescued three required groups and lost one. All four candidates pushed QB32's direct supporting evidence from rank 5 to 6, outside Top5. Stored per-question comparisons were checked against historical manual ratings; the original report judged this a genuine loss of answerability. Every candidate also increased irrelevant evidence over baseline. The AI rejected all four and recommended ending this tuning round while retaining production. A separate final user approval accepting that recommendation remains unrecovered.

The [reranking research summary](../../cases/fix-the-chunker/evidence/reranking-research-summary.json#L1-L172) adds direct original comparisons to the earlier research-report evidence. The original report.md SHA-256 matches its registered value, 9d303908…de8b55. Current recounts confirm 199 evidence records for baseline and every candidate, with exact equality for all five derived questions. Semantic labels for 21 newly selected question/chunk combinations retain their historical manual-review status.

Original verification records report zero external calls and zero source changes. Preservation records also match all 188 tracked-file hashes and 542 baseline-artifact hashes before and after the experiment. Publication preparation compared stored results and hashes without rerunning scoring or experiments. The inspected bbac3a6 production path used cosine ranking, threshold/TopK and the derived-intent branch. Generation effects of the three experiments and matched retrieval-quality effects before/after the chunker correction remain unmeasured.

## Evidence boundaries and follow-up

The [source register](../../cases/fix-the-chunker/evidence/source-register.json#L1-L882) preserves the compressed/decompressed hashes and 32 selected message hashes for original session 01a0ea78-071a-7243-ac8e-1e5d7ee57aae, three Git research snapshots and six earlier local artifacts. Its homeRecovery adds identities, hashes and UTC/KST timestamps for 38 directly inspected October 2 originals and three user-input records. Input history confirms developer requests and contains no complete AI replies or execution transcript.

The September 30 original user request establishes the audit's immediate maintenance/rebuild context. Remaining questions cover matched retrieval-quality runs before/after chunker v2, the complete October 2 proposal/completion conversation, and separate final user approval for ending hybrid tuning. The 527→505 count change and context-preservation tests establish structural correctness.

Published code and synthetic tests retain original imports and application references. Added rules.mjs is the complete retained local experiment file, with no Git-commit attribution. Evidence records publish identifiers, hashes and aggregate observations while keeping Knowledge, QB question/answer text, manual-rating rationales, complete conversations, credentials and server access material private.

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
| [research/rules.mjs](../../cases/fix-the-chunker/research/rules.mjs#L1-L11) | Retained local experiment original; no Git commit attributed<br>tmp/evaluation/hybrid-selection-calibration/2026-10-02-1/rules.mjs<br>1–11 → 1–11 | bdf4eb67fd7a9205d600e89e4e18ccd399f6d569271546e16d766fafec01300d → bdf4eb67fd7a9205d600e89e4e18ccd399f6d569271546e16d766fafec01300d |

Selected extracts join original ranges in order with one blank line. Source paths are relative to the private Synethos repository.

| Public evidence | Classification | SHA-256 |
|---|---|---|
| [evidence/decisions-and-observations.json](../../cases/fix-the-chunker/evidence/decisions-and-observations.json#L1-L253) | Reconstructed | 992511919fc921b0830a4282ee1fc3c332d8ada4fbf311a2bd14c68a88bfe33d |
| [evidence/reranking-research-summary.json](../../cases/fix-the-chunker/evidence/reranking-research-summary.json#L1-L172) | Reconstructed | 6dbd754fe350a551721dd9b1f7b001a3bf27e8505c5e96ccee0f622d1e7dd846 |
| [evidence/source-register.json](../../cases/fix-the-chunker/evidence/source-register.json#L1-L882) | Reconstructed | 51bc5d77cba4da3cb5b550b9f7ba1c5a10c754ff8132f5edb0953da383da8b23 |
| [evidence/october02-selection-alternatives.json](../../cases/fix-the-chunker/evidence/october02-selection-alternatives.json#L1-L277) | Reconstructed | b071496d650366f5086f3ca7ce99e214273b09e9c5607df17cbcea64fedbebac |

</details>

## Publication checks

All seven code files matched the declared historical Git ranges and hashes; seven TypeScript syntax parses and three JSON parses passed. The compressed/decompressed session hashes and 32 selected message hashes matched, together with three Git research snapshots and six retained local artifacts. Stored provider-comparison questions, ground truth and counts were checked by local calculation.

The two READMEs and two engineering records passed 746 local file, heading and line-range links. English/Korean file and external-link targets and SHA-256 sets matched. Existing public files 140 and case 01–07 prose were preserved; README introduction/copyright and common evidence guidance were preserved. New code, evidence projections and case 08 prose were reviewed for private payloads, credentials and operating access details.

Verification used original reads, local parsing and hash/count calculations. Historical tests, model calls, index builds and deployment were not executed. Synethos remained unchanged. That paragraph records the initial publication scope; October 2 original recovery and comparisons are recorded in the additional verification below.

## October 30 home-original recovery and additional verification

Eight complete/selected code originals matched; seven TypeScript and one JavaScript syntax checks and four public JSON parses passed. Hashes matched for 38 recovered originals and three user inputs. Three stored 40-question experiments were recounted, matching required groups, all-required questions, evidence and semantic-label totals for ten candidate sets including baselines; logical direct-support sections in bilingual collapse were also checked. All five hybrid derived questions matched exactly, together with recorded plan/rule hashes and before/after preservation maps for 188 tracked files and 542 baseline artifacts.

The READMEs and docs Markdown passed 834 local file, heading and line-range checks. Case 08 English/Korean file and external-link targets and SHA-256 sets match. The 139 public files and prose for cases 01–07, common index documents, and the original chunker decision/implementation account and seven code files were preserved. File comparisons normalized Windows checkout line endings.

Published material was reviewed for private payloads, credentials, local user paths, private repository URLs and server access information. Verification used original reads, syntax parsing, stored-result arithmetic and hash calculations. Original scoring, experiments, tests, model/API calls, index builds, server access and deployment were not executed; the Synethos working tree remains clean.

[Back to all cases](../../README.md)
