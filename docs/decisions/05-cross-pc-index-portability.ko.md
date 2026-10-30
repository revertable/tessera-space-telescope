# 05 — Cross-PC Index Portability

[전체 사례](../../README.ko.md) · [English](05-cross-pc-index-portability.md) · [이전: 04](04-provider-architecture-and-embedding-reliability.ko.md) · [다음: 06](06-model-selection-quality-and-availability.ko.md)

**근거 수준:** 코드 확인은 식별한 과거 소스, 당시 보고는 기록된 조건의 관측, 미확인은 해결되지 않은 사실·인과관계를 뜻합니다. 테스트는 당시 소스 근거로 수록합니다. 시각은 KST(UTC+09:00)이며 개발 사건과 근거 검증 날짜를 구분합니다.

**문서 편집:** 2026-10-30, 기준 `2fc5094`. 아래 과거 공개 검증 기록의 날짜와 범위를 유지합니다. 2026-10-31에는 `f7fb082` 기준으로 중복 설명과 검증 한계 표현을 정리했고, `0228ffe` 기준으로 확보한 자료의 출처·검증 범위를 중심으로 후속 확인 목록을 정리했습니다.

**개발 기간:** 2026-09-28 ~ 2026-10-26

**코드 분류:** Excerpt — 일부 범위 발췌를 포함한 원본 소스·테스트 22개; Reconstructed — 근거 요약 3개.

**결과:** 완성된 인덱스를 corpus와 embedding space로 식별하는 Git 관리 산출물로 전환했다. Checkout 기준 경로와 source canonicalization으로 PC 사이에서 재사용하고, 이후 Windows에서 만든 인덱스를 Ubuntu 운영 릴리스에 포함했다.

## 9월 28일: 문서 Embedding 반복 대신 산출물 공유

새 사무실 checkout에는 의존성과 로컬 인덱스가 없었고, 환경 설정은 다른 드라이브의 집 checkout을 가리켰다. 09:27:40 사용자는 시스템 PowerShell 정책을 유지하면서 checkout 기준 경로와 npm.cmd 사용을 요청했다. 10:00:18의 1261bf8은 스크립트 위치에서 프로젝트 루트를 구하고 Get-Command로 npm.cmd를 찾으며 cache/temp를 checkout 아래에 두었다. [개발 실행 스크립트](../../cases/cross-pc-index-portability/bootstrap/dev.ps1#L1-L14)와 [인덱스 실행 스크립트](../../cases/cross-pc-index-portability/bootstrap/index.ps1#L1-L15)에서 확인된다. 이는 초기 산출물 부재·환경 설정 사건이다.

19:59:19 사용자는 한 PC에서 Gemini/Cohere 인덱스를 생성하고 Git으로 공유하여 문서 Embedding에 드는 시간과 Provider quota를 절약하기를 요청했다. 영구 identity는 runtime target 이름·우선순위·credential slot 변경에도 유지되어야 했다. 23:19:09에는 Git 공유·atomic publication·publish 성공 후 stale 산출물 정리를 요청했다. 이 요청들은 집 PC 사용자 입력 이력 원문에서 직접 확인했다.

직전 schema 3 구현은 [fingerprint](../../cases/cross-pc-index-portability/before/corpus.ts#L21-L33)와 [저장 디렉터리·reader](../../cases/cross-pc-index-portability/before/store.ts#L8-L40)에 target.id를 반영했다. Runtime 역할의 이름 변경이 영구 산출물 identity를 바꿀 수 있었다. 20:14:41의 9e96d4f는 schema 4를 도입했다.

Provider·모델·차원·embedding input version으로 embedding space를 정의하고 corpus와 이 계약으로 fingerprint를 정했다. [사례 04의 identity 발췌](../../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.ts#L1-L44)와 [테스트](../../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.test.ts#L1-L79)가 이 경계를 보존한다.

23:46:52의 9123e12는 운영용 산출물을 ignored cache/index에서 indexes로 옮겼다. 로컬 cache/temp와 작성 중인 indexes/**/*.tmp는 계속 ignore했다. [설정·ignore 이력 요약](../../cases/cross-pc-index-portability/evidence/storage-policy.sample.json#L1-L25)에 대응한다.

저장 경로는 `indexes/provider=<encoded>/model=<encoded>/dimensions=N/input=vN/<fingerprint>.json`이 되었다. [경로 구현](../../cases/cross-pc-index-portability/storage/space-paths.excerpt.ts#L15-L44)은 안전하지 않은 바이트와 대문자 바이트를 일정하게 인코딩한다. [테스트](../../cases/cross-pc-index-portability/storage/space-paths.excerpt.test.ts#L76-L144)는 runtime metadata 변경과 다른 checkout 루트로의 복사를 다룬다.

사례 04에는 별도 출처를 가진 후속 [검증·publication snapshot](../../cases/embedding-batching-retry-pacing/publication/store.excerpt.ts#L1-L94)이 공개되어 있다.

## 9월 30일: 청크는 같지만 개행에 따라 바뀌는 해시

21:16:48 사용자는 checkout의 개행에 따라 raw source hash가 달라지지만 청크는 같아 505-vector 산출물이 false-stale이 된다고 보고했다. 21:18:24에는 사무실에서 만든 Git 산출물을 다른 PC에서 바로 재사용하기를 요청했다. 이 시각과 관측은 집 PC 사용자 입력 이력 원문에서 직접 확인했다.

22:23:36의 de58671은 [canonical content](../../cases/cross-pc-index-portability/canonicalization/content.ts#L1-L4)를 추가해 CRLF와 단독 CR을 LF로 바꿨다. [Source 로더](../../cases/cross-pc-index-portability/canonicalization/manifest.ts#L1-L50)는 [corpus 준비](../../cases/cross-pc-index-portability/canonicalization/corpus.ts#L54-L73)에 canonical content를 공급하고, [청크 section 파싱](../../cases/cross-pc-index-portability/canonicalization/chunker.ts#L20-L74)도 같은 변환을 사용한다. Corpus identity에는 chunker version·청크 크기 제한·source ID·파일·제목·공개 URL도 들어간다.

[Content 테스트](../../cases/cross-pc-index-portability/canonicalization/content.excerpt.test.ts#L14-L29)는 Unicode 조합·공백·끝의 빈 줄을 보존한다.

Unicode 정규화나 의미 있는 공백 변경은 해시를 바꾼다. [청크 테스트](../../cases/cross-pc-index-portability/canonicalization/chunker.excerpt.test.ts#L14-L31)는 LF·CRLF·CR·mixed 입력의 ID·순서·metadata·내용을 비교한다. 개행 표현의 동등성을 명시적인 규칙으로 정했다.

## 명시적 migration으로 벡터 보존

[Migration](../../cases/cross-pc-index-portability/migration/migrate.ts#L8-L42)은 선택한 legacy 산출물의 schema·embedding 계약을 검증하고 비교용 청크에서 벡터를 제거한 뒤 현재 corpus와 청크 ID·순서·metadata·내용이 정확히 같은지 확인한다. Fingerprint·corpus fingerprint·document hashes를 바꾸고 벡터와 생성 시각을 유지한다.

목적지 충돌은 실패하며, 다시 읽은 결과가 일치해야 선택한 legacy 파일을 삭제한다. [테스트](../../cases/cross-pc-index-portability/migration/migrate.test.ts#L1-L113)는 보존·충돌·쓰기/검증 실패·잘못된 fingerprint를 다룬다. 이는 검증된 schema 4 계약 안에서 수행하는 명시적 offline migration이다.

커밋된 Cohere 산출물을 직접 대조해 보존을 확인했다.

| 항목 | 변경 전 → 후 |
|---|---|
| Fingerprint | 1c66bbb8… → 23601dde… |
| Corpus fingerprint | 2133e693… → e33efbad… |
| 파일 bytes | 10,338,795 → 10,338,795 |
| Provider / 모델 / 차원 | Cohere / embed-v4.0 / 1536 유지 |
| Schema / input version / 청크 | 4 / 2 / 505 유지 |
| createdAt | 2026-09-30T05:44:06.336Z 유지 |
| 벡터 배열 SHA-256 | 662bf30f36c66af0a78fd294ed7dfe2346dea6182e1a5710752839fe68d68e80 유지 |
| vector만 제거한 청크 SHA-256 | 24f1841328849ed0f930b8796fb3c803f0b0aa824a71067424f73a5e1d6ed18b 유지 |

[재구성한 비교 자료](../../cases/cross-pc-index-portability/evidence/identity-migration-summary.json#L1-L46)에 전체 경로·파일/document hash digest·계산 방법을 보존했다. Identity metadata 변경에 따라 파일 해시는 바뀌었다.

## CURRENT와 확장된 이식성 계약

[상태 평가](../../cases/cross-pc-index-portability/status/indexer.excerpt.ts#L23-L74)는 corpus/target fingerprint를 계산하고 정확한 파일을 검증한다. Current는 일치하는 산출물이 검증을 통과한 상태다. 필요한 파일이 없고 같은 space에 다른 JSON 산출물이 있으면 stale이다.

다른 상태는 missing·empty·invalid·corrupt·dimension mismatch를 구분한다. [메뉴 표시](../../cases/cross-pc-index-portability/status/menu.excerpt.ts#L15-L50)는 계산한 상태를 CURRENT로 출력하고 재사용을 알린다.

[9월 30일 테스트](../../cases/cross-pc-index-portability/verification/portability-20260930.test.ts#L1-L114)는 동일한 505-chunk Cohere 산출물을 LF·CRLF·CR·mixed checkout의 격리된 루트로 복사한다. 해시·청크·fingerprint·CURRENT·바이트·505개 후보 검색을 assertion으로 확인한다. Query embedding은 첫 저장 벡터로 stub해 첫 score가 약 1인지 확인한다.

Document embedding·index build·migration·live fetch 호출은 없어야 한다. 실제 source 내용 추가는 stale이 되어야 한다.

10월 15일 20:36:12의 572bb2c는 [계약](../../cases/cross-pc-index-portability/verification/portability-20261015.test.ts#L1-L137)을 Gemini와 Cohere 양쪽으로 확장했다. 해당 revision의 corpus는 27 sources·372 chunks다. 9월의 고정 파일명 대신 corpus와 계약으로 각 Provider의 current 산출물을 구하고 checksum과 네 개행 조건을 별도로 평가한다.

이는 이번에 확인한 당시 테스트의 assertion이다.

## 10월 22~26일: Windows 인덱스의 Ubuntu 운영 적용

요구는 Windows 로컬에서 빌드한 인덱스를 릴리스에 포함해 Ubuntu로 배포하는 운영 방식으로 이어졌다. 10월 22일 배포 기록의 환경은 Ubuntu 24.04.1·Node.js 24.22.1이다. 애플리케이션 빌드 결과·승인 Knowledge·설정·인덱스는 로컬에서 패키징하고 runtime 의존성은 Linux에 맞게 설치했다.

보존된 10월 22일 [패키징 발췌](../../cases/cross-pc-index-portability/production/package-index.excerpt.mjs#L1-L22)는 기존 Gemini 인덱스를 선택·복사하고 bytes/SHA-256을 기록한다. 원본은 릴리스 20261022-033e02f-01에 대응하는 로컬 산출물이며 source hash로 식별한다. 선택한 문장은 생략한 credential 로딩 코드가 제공하는 secrets 등 원래 참조를 유지한다.

[선택한 릴리스 근거](../../cases/cross-pc-index-portability/evidence/production-reuse-summary.json#L1-L165)는 manifest·source commit·Git 바이트·확보된 로컬 stage·보존된 운영 보고를 연결한다.

| 릴리스/source | 산출물 | 보존된 운영 검증 |
|---|---|---|
| 10월 22일 / 033e02f | Gemini gemini-embedding-2 / 768차원; 28 sources, 373 chunks; fingerprint 30886679…; 3,993,421 bytes; SHA-256 a0d705c70fbba84886ddae0a64c3811f69bdca4927290ae6282f69eb4c3640f6 | 14:29:27 index check 통과: current·373 chunks·fingerprint 일치; final health ok=true. |
| 10월 26일 / 8fa463e | 28 sources, 382 chunks; fingerprint dfdb4bbe…; 4,097,925 bytes; SHA-256 1cb34a4f657c9dfec8b601b03eb215749f144f6e9ac209079e1e62ec0dbae5ff | Fingerprint 일치·382 chunks·111개 파일 검증·health true. |
| 10월 26일 / e4aed0f·876ea52·189cf00 | 해당 릴리스들에서 같은 382-chunk fingerprint와 파일 SHA-256 유지 | 각 보존 보고에 fingerprint 일치·382 chunks·111개 파일 검증·health true 기록. |

10월 22일과 26일 인덱스는 각 시점의 corpus revision을 반영한다. 각 릴리스의 Git 바이트는 manifest와 일치하며, 선택한 다섯 릴리스의 보존된 stage 사본도 모두 일치한다. 10월 29일 사용자는 Windows에서 만든 인덱스를 Ubuntu에 배포해 서버 재빌드 없이 사용한다고 직접 확인했다. 이 후속 설명은 운영 적용 결과를 나타낸다.

10월 26일 21:49:10의 4fddd61로 커밋한 배포 도구는 검증을 코드화했다. [Manifest 검증](../../cases/cross-pc-index-portability/production/verify-manifest.excerpt.py#L23-L56)은 commit·파일 크기/해시·인덱스 identity/수량·package version을 묶는다. [Offline 테스트](../../cases/cross-pc-index-portability/production/manifest-contract.excerpt.test.py#L19-L69)는 identity/수량·변조·미등록 payload·draft 거부를 다룬다. [Runtime probe](../../cases/cross-pc-index-portability/production/probe.mjs#L1-L43)는 활성 릴리스의 config·Knowledge·인덱스를 구하고 읽은 CURRENT 산출물을 manifest와 비교한다. 이 후속 probe는 로컬 검증과 의존성 import를 수행한다. 10월 22일 운영 진단에는 별도의 API 연결 확인도 포함됐다.

<a id="근거-수준과-남은-확인-사항"></a>

## 근거 수준과 검증 범위

**코드 확인:** 식별한 구현·assertion, 커밋된 505-vector 산출물 두 개의 보존, 릴리스별 Git/manifest/stage 대조. **당시 보고:** 공유 요청·false-stale 진단·보존된 Ubuntu runtime/health 결과. 사용자가 10월 29일 밝힌 운영 설명에는 해당 후속 날짜를 유지했다.

PC 간 이식성은 개행별 CURRENT·재사용 계약을 표현한 당시 테스트와 커밋된 산출물의 벡터·내용 보존으로 설명한다. 기존 “6 batches / 10.22 MiB” 실행·검색 시각은 당시 보고 수준의 기록이며, 운영 적용은 위의 릴리스별 manifest·stage·runtime/health 결과로 설명한다.

## 출처와 공개 방식

9월 28일 09:27:40 요청은 session 01a0e55f-fed2-7973-93fb-e80d25f296b2 원본에서 직접 확인했다. 파일명 시작 시각은 09:17:48이고 압축 파일 SHA-256은 de5561f7093616ecfe76164289354fd8a99feb5e8b0d3766e22200ff68b0ee5b다. 이후 9월 28일 요청과 30일 관측은 사용자 입력 이력 원문에서 직접 확인했다.

Session ID는 01a0e775-78b0-73b0-ad5a-902cc720edc7·01a0e862-09ff-7d42-bd7e-6195ccaaa1a7·01a0f218-3b96-73e1-a0b9-a1696608e74f이며 전체 부모 세션은 확보되지 않았다. [복구 근거 등록부](../evidence/recovered-source-register.json)에 메시지 시각·원문 hash를 보존했다. 21:18:24 요구는 같은 Git 산출물이 CRLF/LF 환경에서 CURRENT가 되고 추가 embedding/build 없이 즉시 사용되는 것을 완료 기준으로 명시했다. 10월 22일 원본 session 01a1613d-e5c6-76f2-9e3d-42c9eeca696b의 SHA-256은 37823ca6529dfca51f56283ca715ad80e733df9ce371251e261692d25527baef다.

비공개 통합 개발사·근거 등록부에서 연표와 자료별 검증 범위를 가져왔으며 공개 준비 중 대조한 결과는 위에 구분했다.

전체 파일 Excerpt는 선택한 snapshot을 완전하게 보존한다. 부분 Excerpt는 아래 원본 범위와 구간 사이 빈 줄을 사용하고 import·식별자·애플리케이션 참조를 유지한다. Storage/status/menu는 재사용 동작을, 테스트는 관련 assertion을, 운영 발췌는 패키징·검증을 선택하고 운영 접근 정보는 비공개로 유지한다. Reconstructed JSON은 기록의 필드를 선택하고 digest 계산·편집상 그룹화를 표시한다. Knowledge·벡터 전체 payload는 비공개로 유지한다.

모든 소스 코드는 Excerpt다.

<details>
<summary>원본 snapshot·발췌 범위·SHA-256</summary>

원본 경로는 비공개 Synethos 저장소 기준이다. 라인 번호는 각 원본 snapshot 기준이며 공개 링크는 발췌 파일 기준이다. SHA-256은 파일 바이트를 대상으로 한다.

| 공개 파일 | 원본 commit / 경로 / 라인 | 원본 SHA-256 → 공개 SHA-256 |
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
| [evidence/identity-migration-summary.json](../../cases/cross-pc-index-portability/evidence/identity-migration-summary.json#L1-L46) | Reconstructed; 아래 입력표 | `729e4158a5d0413ccfb199dc0334674f49e0d8b836e72465888f51a7f2f7d9ff` |
| [evidence/storage-policy.sample.json](../../cases/cross-pc-index-portability/evidence/storage-policy.sample.json#L1-L25) | Reconstructed; 아래 입력표 | `ec855da82a7dfebf2e25343f6d1ab536022e68e3a50bd38d136c0327945fc21b` |
| [evidence/production-reuse-summary.json](../../cases/cross-pc-index-portability/evidence/production-reuse-summary.json#L1-L165) | Reconstructed; 아래 입력표 | `d5b7554018bb99b54e9f56c46ace6e647b6067e1615861777a43914d558150dc` |

| 재구성 파일 | 입력 식별자 / SHA-256 |
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

## 공개 준비 검증

전체 파일 Excerpt 13개는 원본 바이트와 일치하고 부분 Excerpt 9개는 선언한 원본 범위와 일치했다. TypeScript/JavaScript 18개·Python 2개·PowerShell 2개의 구문 파싱을 통과했다. JSON 요약 3개는 파싱·입력 해시 검증을 통과했고 migration digest와 릴리스별 Git/manifest/stage 대조를 확인했다.

영문·한글의 source 링크 대상과 해시가 일치한다. 로컬 링크 522개의 파일·헤딩 anchor·라인 범위 검증을 통과했다. 사례 01~04의 본문과 코드·근거 87개 파일을 보존했다. 새 자료에서 credential 값·비공개 Knowledge payload·비공개 저장소 URL·로컬 사용자 경로·운영 접근 정보를 점검했다. 검증은 로컬 열람·파싱·계산으로 수행했다. 당시 애플리케이션 테스트·모델 호출·인덱스 빌드·실시간 서버 점검은 수행하지 않았다.

[전체 사례로 돌아가기](../../README.ko.md)
