# 05 — Cross-PC Index Portability

[All cases](../../README.md) · [한국어](05-cross-pc-index-portability.ko.md) · [Previous: 04](04-provider-architecture-and-embedding-reliability.md) · [Next: 06](06-model-selection-quality-and-availability.md)

**Evidence:** Code confirmed identifies historical source; reported at the time retains recorded observation conditions; unconfirmed marks unresolved facts or causal links. Tests are historical source evidence. Times are KST (UTC+09:00); development events and evidence-inspection dates retain their own labels.

**Document revision:** Split on 2026-10-30 from `2fc5094`. Historical publication checks below retain their dates and scope. On 2026-10-31, redundant explanations and verification-limit wording were revised from `f7fb082`.

**Development period:** 2026-09-28 ~ 2026-10-26

**Code classification:** Excerpt — 22 original source/test files, including selected ranges; Reconstructed — three evidence summaries.

**Outcome:** completed indexes became Git-managed artifacts identified by corpus and embedding space. Checkout-relative paths and canonical source content enabled reuse across PCs; Windows-built indexes later accompanied Ubuntu production releases.

## September 28: a shared artifact instead of repeated document embedding

A new office checkout had no dependencies or local index, while its environment still referenced the home checkout on another drive. At 09:27:40, the developer requested checkout-relative paths and npm.cmd, preserving the machine's PowerShell policy.

Commit 1261bf8 at 10:00:18 derived the project root from the script location, resolved npm.cmd through Get-Command, and placed cache/temp under the checkout: [development launcher](../../cases/cross-pc-index-portability/bootstrap/dev.ps1#L1-L14) and [index launcher](../../cases/cross-pc-index-portability/bootstrap/index.ps1#L1-L15). This was the initial missing-artifact/setup event.

At 19:59:19, the developer requested generating Gemini/Cohere indexes on one PC and sharing them through Git to save repeated document-embedding time and provider quota. Persistent identity needed to survive runtime target naming, priority, and credential-slot changes. At 23:19:09, the developer requested Git sharing, atomic publication, and stale-artifact cleanup after successful publication. These requests were directly inspected in original user-input history on the home PC.

The preceding schema-3 implementation included target.id in the [fingerprint](../../cases/cross-pc-index-portability/before/corpus.ts#L21-L33) and [storage directory/reader](../../cases/cross-pc-index-portability/before/store.ts#L8-L40). A runtime-role rename could change persistent artifact identity.

Commit 9e96d4f at 20:14:41 introduced schema 4: provider, model, dimensions, and embedding input version define the embedding space; corpus plus that contract determine the fingerprint. [Case 04's identity excerpt](../../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.ts#L1-L44) and [tests](../../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.test.ts#L1-L79) preserve that boundary.

Commit 9123e12 at 23:46:52 moved production artifacts from ignored cache/index to indexes. Local cache/temp and unfinished indexes/**/*.tmp remained ignored: [selected configuration/ignore history](../../cases/cross-pc-index-portability/evidence/storage-policy.sample.json#L1-L25). Storage became `indexes/provider=<encoded>/model=<encoded>/dimensions=N/input=vN/<fingerprint>.json`.

The [path implementation](../../cases/cross-pc-index-portability/storage/space-paths.excerpt.ts#L15-L44) deterministically encodes unsafe and uppercase bytes. [Tests](../../cases/cross-pc-index-portability/storage/space-paths.excerpt.test.ts#L76-L144) cover runtime metadata changes and copying to another checkout root.

Case 04 provides the later preserved [validation/publication snapshot](../../cases/embedding-batching-retry-pacing/publication/store.excerpt.ts#L1-L94), with its own provenance.

## September 30: line endings changed hashes while chunks stayed equal

At 21:16:48, the developer reported raw source hashes changing with checkout line endings while chunks remained equal, leaving a 505-vector artifact falsely stale. At 21:18:24, the requested outcome was immediate reuse of the office-built Git artifact on another PC. These times and observations were directly inspected in original user-input history on the home PC.

Commit de58671 at 22:23:36 added [canonical content](../../cases/cross-pc-index-portability/canonicalization/content.ts#L1-L4): CRLF and lone CR become LF.

The [source loader](../../cases/cross-pc-index-portability/canonicalization/manifest.ts#L1-L50) supplies canonical content to [corpus preparation](../../cases/cross-pc-index-portability/canonicalization/corpus.ts#L54-L73); [chunk section parsing](../../cases/cross-pc-index-portability/canonicalization/chunker.ts#L20-L74) uses the same transformation.

Corpus identity also includes chunker version, chunk limits, source ID, file, title, and public URL.

[Content tests](../../cases/cross-pc-index-portability/canonicalization/content.excerpt.test.ts#L14-L29) preserve Unicode composition, spaces, and trailing blank lines; Unicode normalization or substantive whitespace changes still change hashes. [Chunk tests](../../cases/cross-pc-index-portability/canonicalization/chunker.excerpt.test.ts#L14-L31) compare IDs, order, metadata, and content across LF, CRLF, CR, and mixed input. Newline representation became an explicit equivalence rule.

## Preserve vectors through explicit migration

The [migration](../../cases/cross-pc-index-portability/migration/migrate.ts#L8-L42) validates the selected legacy artifact's schema and embedding contract, removes vectors for comparison, and requires exact equality of chunk IDs, order, metadata, and content with the current corpus. It replaces fingerprint, corpus fingerprint, and document hashes while preserving vectors and creation time.

Destination conflicts fail; readback must match before the selected legacy file is deleted. [Tests](../../cases/cross-pc-index-portability/migration/migrate.test.ts#L1-L113) cover preservation, conflicts, failed writes/verification, and invalid fingerprints. This is an explicit offline migration within the validated schema-4 contract.

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

[The reconstructed comparison](../../cases/cross-pc-index-portability/evidence/identity-migration-summary.json#L1-L46) retains full paths, file/document-hash digests, and the calculation method. File hashes changed with identity metadata.

## CURRENT and the evolving portability contract

[Status evaluation](../../cases/cross-pc-index-portability/status/indexer.excerpt.ts#L23-L74) computes the corpus/target fingerprint and validates that exact file. The current state denotes a matching, validated artifact; an absent expected file with other JSON artifacts in that space produces stale. Other states distinguish missing, empty, invalid, corrupt, and dimension mismatch. [Menu formatting](../../cases/cross-pc-index-portability/status/menu.excerpt.ts#L15-L50) displays the computed state as CURRENT and reports reuse.

The [September 30 test](../../cases/cross-pc-index-portability/verification/portability-20260930.test.ts#L1-L114) copies the identical 505-chunk Cohere artifact into isolated LF/CRLF/CR/mixed checkouts. Assertions compare hashes, chunks, fingerprint, CURRENT, bytes, and search over 505 candidates. Query embedding is stubbed with the first stored vector; the first score is approximately 1. Document embedding, index builds, migration, and live fetch must remain unused. Adding real source content must produce stale.

Commit 572bb2c on October 15 at 20:36:12 extended [the contract](../../cases/cross-pc-index-portability/verification/portability-20261015.test.ts#L1-L137) to Gemini and Cohere against that revision's 27-source, 372-chunk corpus. Each provider's current artifact is resolved from corpus and contract, replacing the pinned September filename; checksums and four newline variants are evaluated separately. These are inspected historical assertions.

## October 22–26: Windows-built indexes in Ubuntu production

The requirement became an operating choice: build locally on Windows and distribute the index with the release to Ubuntu. October 22 deployment records identify Ubuntu 24.04.1 and Node.js 24.22.1. Application output, approved knowledge, configuration, and index were packaged locally; runtime dependencies were installed for Linux.

The retained October 22 [packaging excerpt](../../cases/cross-pc-index-portability/production/package-index.excerpt.mjs#L1-L22) selects and copies an existing Gemini index and records byte sizes/SHA-256. It is a local artifact associated with release 20261022-033e02f-01, identified by source hash. Selected statements preserve original references, including secrets supplied by omitted credential-loading code.

[Selected release evidence](../../cases/cross-pc-index-portability/evidence/production-reuse-summary.json#L1-L165) connects manifests, source commits, Git bytes, available local stages, and retained operating reports:

| Release/source | Artifact | Retained operating verification |
|---|---|---|
| Oct 22 / 033e02f | Gemini gemini-embedding-2 / 768 dimensions; 28 sources, 373 chunks; fingerprint 30886679…; 3,993,421 bytes; SHA-256 a0d705c70fbba84886ddae0a64c3811f69bdca4927290ae6282f69eb4c3640f6 | At 14:29:27, index check passed: current, 373 chunks, matching fingerprint; final health ok=true. |
| Oct 26 / 8fa463e | 28 sources, 382 chunks; fingerprint dfdb4bbe…; 4,097,925 bytes; SHA-256 1cb34a4f657c9dfec8b601b03eb215749f144f6e9ac209079e1e62ec0dbae5ff | Matching fingerprint, 382 chunks, 111 verified files, health true. |
| Oct 26 / e4aed0f, 876ea52, 189cf00 | Same 382-chunk fingerprint and file SHA-256 across these releases | Each retained report records matching fingerprint, 382 chunks, 111 verified files, health true. |

The October 22 and 26 indexes reflect their respective corpus revisions. For each release, Git bytes match its manifest; retained staged copies across all five selected releases also match. On October 29, the developer directly confirmed deploying Windows-built indexes to Ubuntu and using them without server-side rebuilding. That later clarification describes the operating outcome.

Deployment tooling committed as 4fddd61 on October 26 at 21:49:10 formalized the checks: [manifest validation](../../cases/cross-pc-index-portability/production/verify-manifest.excerpt.py#L23-L56) binds commit, file size/hash, index identity/counts, and package version; [offline tests](../../cases/cross-pc-index-portability/production/manifest-contract.excerpt.test.py#L19-L69) cover identity/counts, tampering, unlisted payload, and draft rejection.

The [runtime probe](../../cases/cross-pc-index-portability/production/probe.mjs#L1-L43) resolves the active release's config/knowledge/index and compares its loaded CURRENT artifact with the manifest. This later probe performs local checks and dependency imports. October 22 operating diagnostics also included separate API connectivity checks.

## Evidence level and remaining questions

**Code confirmed:** identified implementations/assertions, preservation of the two committed 505-vector artifacts, and release-specific Git/manifest/stage comparisons. **Reported at the time:** sharing requests, the false-stale diagnosis, and retained Ubuntu runtime/health results. The developer's October 29 operating clarification retains that later date.

Exact before/after execution logs from the second PC remain unavailable. A previously cited “6 batches / 10.22 MiB” run and search timestamp still lack a matched raw run ledger. The identified Git objects establish vector/content preservation; those additional historical run correspondences remain unconfirmed.

## Sources and publication choices

The September 28 09:27:40 request was directly inspected in session 01a0e55f-fed2-7973-93fb-e80d25f296b2, whose filename begins 09:17:48; compressed-file SHA-256 de5561f7093616ecfe76164289354fd8a99feb5e8b0d3766e22200ff68b0ee5b. Later September 28 requests and September 30 observations were directly inspected in original user-input history.

Their session IDs are 01a0e775-78b0-73b0-ad5a-902cc720edc7, 01a0e862-09ff-7d42-bd7e-6195ccaaa1a7, and 01a0f218-3b96-73e1-a0b9-a1696608e74f; complete parent sessions remain unavailable. The [recovered-source register](../evidence/recovered-source-register.json) retains message times and original-text hashes.

The 21:18:24 request explicitly required the same Git artifact to be CURRENT and immediately usable in CRLF/LF checkouts without additional embedding/build. The original October 22 session 01a1613d-e5c6-76f2-9e3d-42c9eeca696b has SHA-256 37823ca6529dfca51f56283ca715ad80e733df9ce371251e261692d25527baef. The private consolidated development history and evidence register supplied the chronology and unresolved questions.

Publication-time comparisons are identified above.

Whole-file Excerpts preserve complete selected snapshots. Partial Excerpts retain the listed source ranges with blank separators, original imports, identifiers, and application references. Storage/status/menu select reuse behavior; test excerpts select relevant assertions; production excerpts select packaging and validation while operational access details remain private. Reconstructed JSON selects recorded fields and labels digest calculations/editorial grouping. Full knowledge/vector payload remains private. All source code uses Excerpt.

<details>
<summary>Source snapshots, excerpt ranges, and SHA-256</summary>

Original paths are relative to private Synethos. Ranges refer to original snapshots; public links use excerpt-file lines. SHA-256 values hash file bytes.

| Public file | Original commit / path / lines | Original SHA-256 → public SHA-256 |
|---|---|---|
| [bootstrap/dev.ps1](../../cases/cross-pc-index-portability/bootstrap/dev.ps1#L1-L14) | `1261bf8962cf01e3ee88ed6b98724b5e0c4c6be4`<br>`scripts/dev.ps1`<br>1–14 | `c06135a469980330a23071ff0155077435047bbda090acede8dba5e9d28e300b` → `c06135a469980330a23071ff0155077435047bbda090acede8dba5e9d28e300b` |
| [bootstrap/index.ps1](../../cases/cross-pc-index-portability/bootstrap/index.ps1#L1-L15) | `1261bf8962cf01e3ee88ed6b98724b5e0c4c6be4`<br>`scripts/index.ps1`<br>1–15 | `0c252f74ca5ffabe6dc1a63c3a27904b6ea1fa95499d6ab4466a3c0a46c7fb43` → `0c252f74ca5ffabe6dc1a63c3a27904b6ea1fa95499d6ab4466a3c0a46c7fb43` |
| [before/corpus.ts](../../cases/cross-pc-index-portability/before/corpus.ts#L1-L56) | `646d8bc5303271dbfbd98b3d64a2b62c43cc327d`<br>`sveltekit/src/lib/server/indexing/corpus.ts`<br>1–56 | `7573377d6279a2dbf220214ef69dc3fc8add162c72e2f36b1ee915b87854f190` → `7573377d6279a2dbf220214ef69dc3fc8add162c72e2f36b1ee915b87854f190` |
| [before/store.ts](../../cases/cross-pc-index-portability/before/store.ts#L1-L50) | `646d8bc5303271dbfbd98b3d64a2b62c43cc327d`<br>`sveltekit/src/lib/server/indexing/store.ts`<br>1–50 | `a3884d8760564754183312e1c143b089b091b889ab231ff5f3f9cdbef85ddce8` → `a3884d8760564754183312e1c143b089b091b889ab231ff5f3f9cdbef85ddce8` |
| [storage/space-paths.excerpt.ts](../../cases/cross-pc-index-portability/storage/space-paths.excerpt.ts#L1-L44) | `9123e12ec742b501d435156573d448ce77a7ef3d`<br>`sveltekit/src/lib/server/indexing/store.ts`<br>1–44 | `fa0f799e3525b7a212f2d474a2488d3cc0608db26956e3c16e1ead2d68a90425` → `2c18008677d4135b2e414515bb14728c54d428243114e40abd1d20cbdee9d338` |
| [storage/space-paths.excerpt.test.ts](../../cases/cross-pc-index-portability/storage/space-paths.excerpt.test.ts#L1-L144) | `9123e12ec742b501d435156573d448ce77a7ef3d`<br>`sveltekit/src/lib/server/indexing/store.test.ts`<br>1–74, 76–144 | `f240326af3cfffc726ea809f18d3d396d6477d81e06a3029064c5a51f89db361` → `23df365cef17b9d2048a706d6d757a52f96a15e7889809e30b9266f1dfcdde07` |
| [canonicalization/content.ts](../../cases/cross-pc-index-portability/canonicalization/content.ts#L1-L4) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/knowledge/content.ts`<br>1–4 | `2346f73dcad254a9cd6a3bc05e19e2c0abff7a3c21985c411890db39c2102ed7` → `2346f73dcad254a9cd6a3bc05e19e2c0abff7a3c21985c411890db39c2102ed7` |
| [canonicalization/manifest.ts](../../cases/cross-pc-index-portability/canonicalization/manifest.ts#L1-L50) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/knowledge/manifest.ts`<br>1–50 | `34784adb5057779f26f2592dadacca5ae045978de3ec9948e1019c81db9f9904` → `34784adb5057779f26f2592dadacca5ae045978de3ec9948e1019c81db9f9904` |
| [canonicalization/chunker.ts](../../cases/cross-pc-index-portability/canonicalization/chunker.ts#L1-L110) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/knowledge/chunker.ts`<br>1–110 | `b92e6fffa7e77e903243abc6ef559943cf9f4ab253f9db3ec35065bb7cd35da5` → `b92e6fffa7e77e903243abc6ef559943cf9f4ab253f9db3ec35065bb7cd35da5` |
| [canonicalization/corpus.ts](../../cases/cross-pc-index-portability/canonicalization/corpus.ts#L1-L73) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/corpus.ts`<br>1–73 | `808b33161d3d6d254c5987d2845d81543a45be39126153a018fa257a6b8ca0f4` → `808b33161d3d6d254c5987d2845d81543a45be39126153a018fa257a6b8ca0f4` |
| [canonicalization/content.excerpt.test.ts](../../cases/cross-pc-index-portability/canonicalization/content.excerpt.test.ts#L1-L29) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/corpus.test.ts`<br>1–12, 315–330 | `926537eec4977e12072750199c76c1b8b58637204708ef828a23c5a16162896f` → `0e5dbc0065f6e3ca89cc005ef3e83290f08ce330509accd6d8f00b85909c622d` |
| [canonicalization/chunker.excerpt.test.ts](../../cases/cross-pc-index-portability/canonicalization/chunker.excerpt.test.ts#L1-L31) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/knowledge/chunker.test.ts`<br>1–12, 126–143 | `22effa4e723bca03a67bba435ab13eeaa31e19f7567a39bb99db587c69c0fa09` → `c60fbbfdee344dc41942a20024e905c4a19192611b5d890ba89de037761d0544` |
| [migration/migrate.ts](../../cases/cross-pc-index-portability/migration/migrate.ts#L1-L42) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/migrate.ts`<br>1–42 | `0033869f198ec9fd9dc2ab94d68f32a53eb08ec6fa0fd5e4f9a47dd1b6bd9bad` → `0033869f198ec9fd9dc2ab94d68f32a53eb08ec6fa0fd5e4f9a47dd1b6bd9bad` |
| [migration/migrate.test.ts](../../cases/cross-pc-index-portability/migration/migrate.test.ts#L1-L113) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/migrate.test.ts`<br>1–113 | `2522d9d44d87191cbcb0ea90332fd5981530618c74943df9f62fd56cfe94ce2d` → `2522d9d44d87191cbcb0ea90332fd5981530618c74943df9f62fd56cfe94ce2d` |
| [verification/portability-20260930.test.ts](../../cases/cross-pc-index-portability/verification/portability-20260930.test.ts#L1-L114) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/portability.test.ts`<br>1–114 | `86b50daef4e362fcfcf75edbd27f9d2a77ff200ab635f8ff2ce80564bfddd62e` → `86b50daef4e362fcfcf75edbd27f9d2a77ff200ab635f8ff2ce80564bfddd62e` |
| [status/indexer.excerpt.ts](../../cases/cross-pc-index-portability/status/indexer.excerpt.ts#L1-L74) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/indexer.ts`<br>1–74 | `d60c5a48c89d4e88107979dbb82bdfd79a17ff59fff48f48622ff9583cc3ebc3` → `06321da46c8faf9454070453c2b865e9efd0ba20bb5f9153a67b78d129298a12` |
| [status/menu.excerpt.ts](../../cases/cross-pc-index-portability/status/menu.excerpt.ts#L1-L50) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/menu.ts`<br>1–50 | `fe7290b9ff2367cf24bad9e823bedbfcebe30f5882238b29ed0d2f05d89634a0` → `f3aac3e567310195f9e9e33e142690c2971093e48cf4f59d734f3a9929f7a037` |
| [verification/portability-20261015.test.ts](../../cases/cross-pc-index-portability/verification/portability-20261015.test.ts#L1-L137) | `572bb2c159b21c5dcb2a4c2c9332d854775b793f`<br>`sveltekit/src/lib/server/indexing/portability.test.ts`<br>1–137 | `c3b89e675accfa1a27fbc9ef28f9fa976eb6d1a1b3fb42c0b3f9e39dc586b425` → `c3b89e675accfa1a27fbc9ef28f9fa976eb6d1a1b3fb42c0b3f9e39dc586b425` |
| [production/package-index.excerpt.mjs](../../cases/cross-pc-index-portability/production/package-index.excerpt.mjs#L1-L22) | `local 2026-10-22 packaging artifact`<br>`tmp/synethos-deploy/package-release.mjs`<br>1–3, 5–15, 19–24 | `e5e78784cdd9f73b6115253677f468a2747c0ce371135b080d4564e32a4381b5` → `a2352d834317b7804dec46e6c6369ac50ab43dba20ae53bf590fd7263533ca5a` |
| [production/verify-manifest.excerpt.py](../../cases/cross-pc-index-portability/production/verify-manifest.excerpt.py#L1-L56) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/deploy.py`<br>4–5, 7–8, 22–24, 34–36, 39–45, 62–95 | `8ec2db16cac2a5c77b46662ade526e779eca51c9c47fee517c4e1cb595a230ad` → `afc47670267bb7df95af49a16b7d49904db7fe1802a4d1e91c43cba96f44012b` |
| [production/manifest-contract.excerpt.test.py](../../cases/cross-pc-index-portability/production/manifest-contract.excerpt.test.py#L1-L69) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/test_deploy.py`<br>2–18, 21–71 | `07ceb585168a3e8a717fd6b520850a56bd7a748617323139f578481596548914` → `0bb4d5be0e2ec60db8d199c6ab399485c3edc98510c76ff86b1df49c4543fbdd` |
| [production/probe.mjs](../../cases/cross-pc-index-portability/production/probe.mjs#L1-L43) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/probe.mjs`<br>1–43 | `a4a6360520aada0d0fe5e7b91d07813c0753b89a2a405b7c3c9b39510e90cde1` → `a4a6360520aada0d0fe5e7b91d07813c0753b89a2a405b7c3c9b39510e90cde1` |
| [evidence/identity-migration-summary.json](../../cases/cross-pc-index-portability/evidence/identity-migration-summary.json#L1-L46) | Reconstructed; inputs below | `729e4158a5d0413ccfb199dc0334674f49e0d8b836e72465888f51a7f2f7d9ff` |
| [evidence/storage-policy.sample.json](../../cases/cross-pc-index-portability/evidence/storage-policy.sample.json#L1-L25) | Reconstructed; inputs below | `ec855da82a7dfebf2e25343f6d1ab536022e68e3a50bd38d136c0327945fc21b` |
| [evidence/production-reuse-summary.json](../../cases/cross-pc-index-portability/evidence/production-reuse-summary.json#L1-L165) | Reconstructed; inputs below | `d5b7554018bb99b54e9f56c46ace6e647b6067e1615861777a43914d558150dc` |

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

## Publication checks

The 13 whole-file Excerpts matched their originals byte-for-byte; all nine partial Excerpts matched the declared source ranges. Syntax parsing passed for 18 TypeScript/JavaScript files, two Python files, and two PowerShell scripts. All three JSON summaries passed parsing and input-hash checks; migration digests and release-specific Git/manifest/stage comparisons were checked.

English/Korean source targets and hashes match. All 522 local links passed file, heading-anchor, and line-range checks. Cases 01–04 retain their text and 87 code/evidence files. New material was reviewed for credential values, private knowledge payloads, private repository URLs, local user paths, and operational access details. Verification used local inspection, parsing, and calculations. Historical application tests, model calls, index builds, and live server inspection were not performed.

[Back to all cases](../../README.md)
