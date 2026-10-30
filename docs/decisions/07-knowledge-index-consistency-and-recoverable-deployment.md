# 07 — Knowledge–Index Consistency and Recoverable Deployment

[All cases](../../README.md) · [한국어](07-knowledge-index-consistency-and-recoverable-deployment.ko.md) · [Previous: 06](06-model-selection-quality-and-availability.md) · [Next: 08](08-fix-the-chunker-not-the-documents.md)

**Evidence:** Code confirmed identifies historical source; reported at the time retains recorded observation conditions; unconfirmed marks unresolved facts or causal links. Tests are historical source evidence. Times are KST (UTC+09:00); development events and evidence-inspection dates retain their own labels.

**Document revision:** Split on 2026-10-30 from `2fc5094`. Historical publication checks below retain their dates and scope.

**Development period:** 2026-10-22 ~ 2026-10-26. The developer directly clarified operating constraints, retention choice, and design delegation on 2026-10-29.

**Code classification:** Excerpt — one whole original file and three partial selections; Reconstructed — three evidence records.

**Outcome:** operations retained a total of three releases within limited server space, switching/restoring application code, Knowledge, and Index together. The developer provided the environment, materials, constraints, and retention policy and delegated detailed deployment design/implementation to AI. The approved October 26 deployment activated a new release and verified readiness to restore the previous version.

## Operating environment and usable space

Synethos ran on a Naver Cloud free-tier Ubuntu server with Cloudflare Tunnel already in use. October 22 Git documentation records systemd operation, separately prepared Linux production dependencies, and the existing Tunnel’s Ubuntu connector/public-service verification. The observed October 26 environment was Ubuntu 24.04.1 and Node v24.22.1.

**Operating experience directly clarified by the developer on October 29:** the nominal 10GB initially seemed fully usable. After the operating system and accumulated security updates, available space was approximately 3–4GB. The provisioned environment’s security patches were also out of date.

The original October 22 request supplied the 10GB constraint. Historical tool output and reports now identify the stages behind the available-space observations. Times are KST; G values retain the original df display.

| Time/source | Recorded observation |
|---|---|
| October 22 10:34:22.014 · tool output | Filesystem 9.8G, used 5.3G, available 4.0G, before these updates |
| 11:12:20.521 · developer report; 11:12–11:15 tool inspection/AI diagnosis | Available space fell after dry-run; 224 downloaded packages occupied 806,196,658bytes, approximately 769MiB. Installed versions were still unchanged. |
| 13:11:30.055 approval → 13:35:30.875 completion report | 246 security packages installed and checked; reported free space 2.90GiB and observed minimum 2.44GiB; three kernel holds retained |
| 14:01:14.138 · tool output | 3,148,894,208 available bytes, approximately 2.93GiB |
| 14:27:56.360 · tool output | 3,740,782,592 available bytes, approximately 3.48GiB, after cache cleanup and runtime/application setup |
| October 26 21:04:59.201 · original tool output | Filesystem 9.8G, used 6.0G, available 3.3G, 65% usage |
| Same-day predeployment report | 3,516,506,112 available bytes, approximately 3.28GiB; existing releases approximately 38MiB each |

The 338 general update candidates in the initial inspection and the 246 approved security updates have separate scopes. The AI investigated the dry-run space reduction through existing APT/cache/installed-version records, then calculated an installation budget. The developer approved the declared security-update installation; the completion report preserves the installed count, monitored minimum, and held kernel packages. Later setup also removed approximately 850MiB of downloaded cache while installing the runtime and application.

The [constraints and decisions evidence](../../cases/knowledge-index-release-consistency/evidence/decisions-and-constraints.json#L1-L289) separates direct tool measurements, contemporaneous reports, and the October 29 account. The sequence shows transient downloads and later cleanup as well as installation. Free space immediately after provider provisioning and a complete per-package attribution of filesystem use remain unavailable.

## Total three releases: developer choice and AI design

The original October 26 conversation establishes the policy change:

| KST time | Actor and decision |
|---|---|
| 14:50:51.474 | Developer requests a disk/retention comparison. |
| 14:51:56.708 | AI compares retaining all/latest plus previous/latest only, and recommends two releases. |
| 14:52:21.066 | Developer adopts latest plus previous and requests that policy be documented. |
| 14:53:15.017 | AI reports documenting two-release retention, with server files unchanged. |
| 15:11:50.447 | Developer asks for “one more” version: latest, previous, and the version before that, total three. |
| 15:12:43.106 | AI reports documenting three for subsequent deployments, with server files unchanged at that step. |

The AI's comparison recorded approximately 37.20MiB for the new release, 74.29MiB for the two present releases, and 37.09MiB recoverable by removing the previous version. It favored keeping the previous version for immediate recovery. These measurements explain the comparison the developer reviewed. The developer subsequently chose an additional version as operating headroom; three remains an operating choice.

The earlier server script read later that evening already contained three-release retention. The 21:22:05.529 developer request inherited that policy for the reusable procedure.

| Actor/source | Established role |
|---|---|
| Developer decisions and clarification | Provided environment/materials/constraints, adopted two, then chose total three; delegated detailed design/implementation to AI |
| October 26 later developer request | Retain the existing release structure, switch/restore Knowledge and Index together, check Linux dependencies, preserve environment/Tunnel |
| AI comparison/design/implementation | Recommend two from measured storage/recovery tradeoffs; specify manifest/hash checks, candidate and service-account checks, atomic activation/recovery, retention ordering and deletion safety |

The contemporaneous messages now provide the two-to-three transition that was previously available only through the October 29 clarification. Adopting the existing architecture in a later request and choosing its retention count retain their respective sources and roles.

## Earlier deployment issues and the new candidate

**October 22 platform choice:** at 14:06:56.302 the AI proposed building locally and preparing Linux production dependencies separately, excluding Windows node_modules. Its analysis identified the prepare script's svelte-kit sync and proposed ignore-scripts for production installation. At 14:14:09.781 the developer explicitly required no Windows node_modules copy and separate Linux dependencies. The refined setup/loopback-deployment scope was approved at 14:15:58.713. At 14:30:30.300 the AI reported the separate Linux installation, successful service checks, and reuse of the current 373-chunk index. Retained setup, manifest and verification artifacts identify release 20261022-033e02f-01.

**October 26 root diagnosis:** the developer approved the revised 8fa463e deployment scope at 14:42:49.628. Before activation, the AI found MOSAIC_PROJECT_ROOT pinned to the October 22 release. The correction preserved the relative index directory while pointing project root through current; failure recovery would restore the previous link and environment file. This is the recorded configuration finding, with public answers using old Knowledge still unconfirmed.

**October 26 actual activation failure:** at 14:47:50.309 the tool output reported rollback=true, restoration of the previous release and healthy recovery after the new release failed loopback health. The 14:48:18.359 journal output showed ERR_MODULE_NOT_FOUND for dotenv. At 14:49:08.659, node_modules and dotenv directories were root-owned 0700, and dotenv/package.json was root-owned 0600.

The AI diagnosed missing read/traverse access after ownership changes and reported the correction at 14:49:16.271. The retained corrected script applies directory/read permissions while preserving executable bits and imports dotenv/@google/genai as the service account before activation. The failed-execution/correction interval contains no separate developer approval message; it follows the recorded deployment-scope approval.

The corrected redeployment passed: the 14:50:27.509 follow-up output verified 111 files and healthy services. Its verification report and script check process cwd, current and the changed environment root; its packaged index identifies 28 sources/382 chunks. The report's rollback=false belongs to that successful attempt. The earlier failed attempt's actual recovery remains a separate observation in the [deployment evidence](../../cases/knowledge-index-release-consistency/evidence/deployment-observed-results.json#L1-L138).

The previous script was fixed to a particular release, commit, index and 382 chunks. The later candidate changed approved documents and index to 28 sources/381 chunks. The developer therefore requested a reusable candidate-aware procedure that inherited the root and Linux permission/import corrections.

## Bundle code, Knowledge, and Index into one release

The [bundle implementation](../../cases/knowledge-index-release-consistency/release/bundle.py#L1-L82) packages approved-manifest Knowledge, Index, configuration, application build, package, and lockfile into one candidate. Its manifest connects sourceCommit, release, file sizes/SHA-256, and index identity. Credentials and Windows node_modules are excluded. Candidate verification and activation use this release unit.

| Stage | AI-implemented behavior |
|---|---|
| Preparation | Check expected existing release, archive/manifest/payload/source commit, Node compatibility, available space, and protected configuration |
| Linux preflight | Normalize permissions after production dependency installation; check imports and compiled index loading with the service account/actual environment |
| Activation | Atomically replace current, restart service, check actual root/cwd/loaded index/internal and external health/homepage |
| Activation/verification failure | Restore previous link, restart, and reverify the previous release and its Knowledge/Index |
| Post-success retention | Keep active, previous, and newest other; check deletion paths and process use before removing others |

The [permissions/activation/recovery excerpt](../../cases/knowledge-index-release-consistency/release/activation.excerpt.py#L1-L40) normalizes installed access permissions after a restrictive umask. switch uses a temporary symlink and os.replace; activate restores the previous link and runs restart/rollback_verify when post-switch restart/verify fails. Preparation failure leaves the active release in place.

The [retention/deletion-safety excerpt](../../cases/knowledge-index-release-consistency/release/retention.excerpt.py#L1-L30) implements total three as active/previous/newest other. Cleanup follows successful verification and checks paths outside the release root, symlinks, and in-use process cwd/executables. Cleanup failure leaves the verified active release running and requires follow-up.

Index identity and loader contracts connect to case 05’s [manifest verification](../../cases/cross-pc-index-portability/production/verify-manifest.excerpt.py#L23-L56) and [runtime probe](../../cases/cross-pc-index-portability/production/probe.mjs#L1-L43). This case focuses on binding those materials into one operating release and switching/restoring them under the selected space/retention conditions.

## Original requests, declarations, approvals, and execution

| KST time | Event/actor |
|---|---|
| October 22 13:11:30.055 → 13:35:30.875 | Developer security-update approval → AI installation/verification report |
| 14:06:56.302 → 14:14:09.781 → 14:15:58.713 | AI separate-Linux proposal → developer platform requirement → setup/deployment approval |
| 14:30:30.300 | AI loopback-deployment completion report; 373-chunk index reused |
| October 26 14:42:49.628 → 14:44:51.004 | Developer deployment approval → AI old-root diagnosis |
| 14:47:50.309 | Tool records failed activation and actual healthy recovery of previous release/environment |
| 14:48:18.359 → 14:49:08.659 → 14:49:16.271 | Journal error → access-mode inspection → AI permission/import correction report |
| 14:50:27.509 | Tool verifies corrected deployment and 111 payload files |
| 14:51:56.708 → 14:52:21.066 → 15:11:50.447 | AI recommends two → developer adopts two → developer chooses three |
| Around 21:10 | Tool output reads the prior server script's permission checks, active-root checks and three-release policy |
| 21:22:05.529 | Developer requests reusable deployment, preservation of earlier fixes, Knowledge/Index consistency, Linux preflight and total three |
| 21:28:01.646 → 21:28:25.746 | AI implementation/verification/candidate declaration → developer approval |
| 21:39:59.309 / 21:42:03.125 | Original Linux deployment safety outputs each show eight passing tests |
| 21:44:39.175 → 21:48:38.896 | AI candidate results/Git declaration → developer commit/push approval |
| 21:49:10 | 4fddd61 commits reusable deployment implementation and records |
| 21:51:33–21:51:48 → 21:52:55.532 | AI declares exact switch/verification/recovery/retention scope → developer production approval |
| 21:59:22.934 | AI completion report: new release, actual index/health, total three and restoration readiness |

The [source register](../../cases/knowledge-index-release-consistency/evidence/source-register.json#L1-L838) retains original session 01a177b0-1d84-7cc0-aedb-4a06f6d9c661 for the later deployment. The October 30 supplement adds original sessions 01a1613d-e5c6-76f2-9e3d-42c9eeca696b and 01a176a3-862a-7e82-adc0-b4aeda57dd12, with 34 selected message/tool-output hashes.

Their JSONL hashes match earlier private research registrations; the added evidence selects earlier event intervals. The compressed October 22 file and its decompressed JSONL each have their own hash. Other test changes in 4fddd61 retain their separate scope.

## Actual operation and restoration verified in tests

The [observed-results projection](../../cases/knowledge-index-release-consistency/evidence/deployment-observed-results.json#L1-L138) retains the original 4fddd61 JSON/log/report/archive comparison and adds the earlier deployment as a separate execution. The original publication verified that the retained approved script matched the Git source bytes/SHA-256.

| Actual October 26 4fddd61 deployment | Result |
|---|---|
| Active release/source commit | 20261026-4fddd61-01 / 4fddd619640fbbf77fbc58f2a80e8aaa2065f231 |
| Actual loaded data | 28 sources/381 chunks; candidate index/corpus identities match |
| Linux dependency imports/active root/process cwd | Checks passed |
| Internal/external health/homepage | HTTP 200/200/200; application/existing Tunnel reported healthy |
| Actual retention | New/189cf00/876ea52, total three; 8fa463e removed after successful verification |
| Restoration readiness | Previous 189cf00 loader/import preflight and rollbackReady confirmed |
| Production rollback/provider calls | Rollback unnecessary/zero calls |

During the original October 29 publication preparation, the retained archive was read in memory and its archive/manifest hashes and all 112 payload file sizes/SHA-256 compared. All matched, with zero node_modules/evaluation-fixture entries. Ordinary 1033-pass/4-skip tests and passing static checks/build remain historical candidate-code verification. Health/loader success and semantic answer quality concern different verification targets.

The [rollback/retention test excerpt](../../cases/knowledge-index-release-consistency/verification/rollback-retention.excerpt.test.py#L1-L65) injects failure while using an actual POSIX symlink and synthetic Knowledge/Index files, checking restoration of both old contents. Separate assertions check retention ordering. The historical eight-test Linux pass includes these checks.

The 4fddd61 production execution succeeded, so automatic rollback was unnecessary in that execution. Its operating evidence establishes new-release consistency and readiness to restore the previous release. The earlier 8fa463e failed activation/actual recovery has its own records above.

During the October 26 deployment, Cloudflare returned HTTP 403 for default Python urllib User-Agent requests. The same health checks returned 200 with an explicit deployment client identity. Existing security settings, health checks, and the approved archive/manifest/deployment-script hashes were preserved.

## Evidence scope and remaining questions

The October 29 direct developer account supplies operating experience and design delegation. Original October 22 messages now connect the AI platform proposal, developer requirement and scoped approval. Original October 26 messages establish the AI's two-release recommendation, the developer's adoption and later choice of three, and the later reusable-deployment approvals. Initial module/root findings, actual failed-activation recovery and corrected execution are identified through historical tool output, AI reports, retained scripts and verification JSON.

Source types remain distinct: tool measurements and journal/access-mode output; developer instructions/approvals; AI proposals/diagnoses/completion reports; retained operating reports; and the later developer account. The original October 29 verification of the 4fddd61 archive/session remains in the register. Its eight private artifact paths are unavailable in this checkout; the October 30 supplement verifies the earlier sessions and six retained earlier artifacts.

Remaining gaps are exact free space immediately after provider provisioning, complete per-OS/package/update byte attribution, and evidence that public answers actually used old Knowledge before the root correction. The original policy-choice conversation, early Windows-copy requirement and initial Linux failure/recovery sequence are now linked.

Code selections explain the mechanisms behind the constraints and results. Partial excerpts join declared ranges with one blank line, preserving original statements, identifiers and references. Original application references remain, including retention's ROOT and the tests' deploy.py import. Private Knowledge, question-bank text, credentials, access information, protected-setting contents, full operating commands and complete conversations remain private. New summaries publish counts/modes/results and original identifiers/hashes; literal operating paths and access data are omitted.

<details>
<summary>Original sources, ranges, and SHA-256</summary>

| Public Excerpt | Original commit/path/original lines → public lines | Original SHA-256 → public SHA-256 |
|---|---|---|
| [release/bundle.py](../../cases/knowledge-index-release-consistency/release/bundle.py#L1-L82) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/bundle.py`<br>1–82 → 1–82 | `d0e38d5162f8309eecd6f44673aed6f0d8e9425e0292d342f42f62f1c37af33e` → `d0e38d5162f8309eecd6f44673aed6f0d8e9425e0292d342f42f62f1c37af33e` |
| [release/activation.excerpt.py](../../cases/knowledge-index-release-consistency/release/activation.excerpt.py#L1-L40) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/deploy.py`<br>6–6 → 1–1; 22–24 → 3–5; 98–131 → 7–40 | `8ec2db16cac2a5c77b46662ade526e779eca51c9c47fee517c4e1cb595a230ad` → `11fdfdc060ffe222fbbf2e821d7a6d1e308471840805f9129bbd22ef445aea8e` |
| [release/retention.excerpt.py](../../cases/knowledge-index-release-consistency/release/retention.excerpt.py#L1-L30) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/deploy.py`<br>7–7 → 1–1; 22–24 → 3–5; 173–196 → 7–30 | `8ec2db16cac2a5c77b46662ade526e779eca51c9c47fee517c4e1cb595a230ad` → `77723432da30fa2382dae6a97ce48d972e388c6f2078683e66041db613138f82` |
| [verification/rollback-retention.excerpt.test.py](../../cases/knowledge-index-release-consistency/verification/rollback-retention.excerpt.test.py#L1-L65) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/test_deploy.py`<br>1–28 → 1–28; 122–157 → 30–65 | `07ceb585168a3e8a717fd6b520850a56bd7a748617323139f578481596548914` → `525e2fe3a8d94b32c1fabe0f65032427f4268a3df17c76194984572c6a6c96a1` |

| Public evidence | Classification | SHA-256 |
|---|---|---|
| [evidence/decisions-and-constraints.json](../../cases/knowledge-index-release-consistency/evidence/decisions-and-constraints.json#L1-L289) | Reconstructed | `17573b0648b9ce9bb2b076a805da15a3b25d10d745ee3d646911511ffbf6d1f6` |
| [evidence/deployment-observed-results.json](../../cases/knowledge-index-release-consistency/evidence/deployment-observed-results.json#L1-L138) | Reconstructed | `3a3daee81835efacc6b600c4c79218289fe8dfb59ad2f7ecb6a25b976a11ddc6` |
| [evidence/source-register.json](../../cases/knowledge-index-release-consistency/evidence/source-register.json#L1-L838) | Reconstructed | `bc72617c6de1369c0d9e99e15f62ac324fda3abd81e4d9c5170e5c12593317a3` |

Original paths are private Synethos repository-relative paths. The source register links 4fddd61 documents/deployment code, retained preflight/approval/execution/completion hashes, the full-session identity, and selected message hashes. Original materials containing server access/operating details remain private.

</details>

## Publication checks

**Original October 29 publication checks:**

All four complete/selected code extracts matched their originals; four Python syntax parses and three public JSON parses passed. Seven Git document/code/research hashes, eight retained-artifact hashes, the full-session hash, and ten selected message text hashes matched. All 112 archived payloads matched their sizes and SHA-256 values; runtime index identity and counts also matched the manifest.

The two READMEs and two engineering records passed file, heading, and line-range checks for 692 local links. English/Korean file and external-link targets and SHA-256 sets match. Cases 01–06 prose and 132 public files retain their baseline content. File comparisons normalized Windows checkout line endings.

Published code, evidence projections, and case 07 prose were reviewed for credential values, private Knowledge/QB payloads, private repository URLs, local user paths, and server access details. Verification used original inspection and local parsing/hash calculations. No new application tests, model calls, index builds, server access, or deployment were performed. The Synethos working tree remains clean and its originals are preserved.

**October 30 evidence supplement:** Two original session files, 34 selected message/tool-output hashes and six retained deployment artifacts matched their registered hashes. The three evidence JSON files parsed, and 694 local links across both READMEs and both development histories passed file, heading and line-range checks. English/Korean file and external links and SHA-256 sets matched. Byte hashes confirmed preservation of 139 files, including code/tests, non-target evidence, READMEs and local AGENTS.md, and the case 01–06 document prefixes. Original October 29 publication results remain recorded separately. The new projections and case 07 prose were reviewed for private payloads, credentials and operating access details. Verification used local reads, parsing and hash calculations; Synethos remained unchanged.

[Back to all cases](../../README.md)
