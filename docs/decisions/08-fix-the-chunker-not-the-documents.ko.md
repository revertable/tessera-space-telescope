# 08 — Fix the Chunker, Not the Documents

[전체 사례](../../README.ko.md) · [English](08-fix-the-chunker-not-the-documents.md) · [이전: 07](07-knowledge-index-consistency-and-recoverable-deployment.ko.md)

**근거 수준:** 코드 확인은 식별한 과거 소스, 당시 보고는 기록된 조건의 관측, 미확인은 해결되지 않은 사실·인과관계를 뜻합니다. 테스트는 당시 소스 근거로 수록합니다. 시각은 KST(UTC+09:00)이며 개발 사건과 근거 검증 날짜를 구분합니다.

**문서 편집:** 2026-10-30, 기준 `2fc5094`. 아래 과거 공개 검증 기록의 날짜와 범위를 유지합니다.

**개발 기간:** 2026-09-29 ~ 2026-10-02.

**코드 분류:** Excerpt — 전체 원본 3개·부분 테스트 발췌 4개. Reconstructed 근거 기록 3개가 원본·당시 보고·남은 질문을 연결한다.

**결과:** 사용자는 문서 workaround를 거부하고 정상 Markdown 계층과 경력 기록의 수행 내용·기술 단위를 유지하는 일반적인 청커 수정을 선택했다. 이후 offline lexical/hybrid 후보는 일부 coverage 지표를 개선하면서 유효한 근거를 잃었으며, 기존 연구 기록에는 모두 미채택으로 남아 있다.

## 순위 조정 기법을 선택하기 전에 실패 위치 구분

9월 29일 baseline은 원문 query, cosine 순위의 local chunks, minimumScore 0.25와 Top5 evidence를 사용했다. 보존된 38문항 calibration은 여러 실패 위치를 구분했다. MSA 근거는 8위였고, Observatory 검증의 직접 근거는 복합질문에서 125위·좁힌 질문에서 1위였다. 다른 실패에서는 필요한 자료가 이미 1·2위에 있었다. 원문 claim 해석, 답할 수 있는 부분의 생략, 출력 언어 지시 준수의 문제였다.

16:21:16.121 사용자는 reranking을 가설로 검토하고 후보 경계에서의 누락·질문 표현·근거 충분성·생성 실패를 구분하도록 요청했다. 16:39:40.627에는 입증된 비용 대비 효과로 MVP 변경을 선별하며 미채택도 허용하도록 했다. AI 제안은 후보 풀 확대와 그 안의 유효한 근거를 승격하는 문제를 구분했다. Top8 generation과 정답 근거를 직접 넣은 oracle 실행은 evidence 선택을 바꾼 진단이었다. 직접 확인한 9월 29일 기록에는 reranker 모델의 실측 결과가 없다.

별도의 9월 30일 retrieval-only 비교는 Cohere Embed v4/1536과 Gemini Embedding 2/768에 동일한 38문항·ground truth·525-chunk corpus·Top5·minimumScore 0.25를 사용했다. 저장 결과에는 target별 query embedding 38회가 기록돼 있다. 이번에 그 결과를 다시 집계했다.

| 저장 결과 지표 | Cohere1536 | Gemini768 |
|---|---:|---:|
| Production Top5로 확보한 supported claim | 29/32 | 31/32 |
| 지원 가능한 모든 claim을 확보한 문항 | 24/27 | 26/27 |

분모는 이 calibration의 지원 가능한 claim과 문항이다. Corpus fingerprint는 d047a7dc…52bdbf였다. 이 관측은 청커 v2 수정 전 provider 비교에 해당하며, 앞선 9월 29일 순위는 다른 fingerprint의 결과다. [판단·관측 기록](../../cases/fix-the-chunker/evidence/decisions-and-observations.json#L1-L228)에 두 범위와 저장 산출물을 식별했다.

## Corpus 점검에서 드러난 계층 문제

9월 30일 점검의 직접적인 배경은 corpus 유지보수였다. Voyage 제거 과정에서 visitor-facing Knowledge에 현재 provider·운영 정보가 중복된 문제가 드러났다. 11:51:19.568 사용자는 corpus에 안정적인 제품·설계·역사적 기록을 두고 현재 운영 상태는 config/docs에서 관리하도록 요청했다. 12:17:51.973에는 index rebuild 전 실제 chunk 경계를 포함한 전체 corpus 점검을 요청했다.

AI는 경력 문서의 반복되는 ‘주요 수행 내용’·‘사용 기술’ heading을 확인했다. [이전 청커](../../cases/fix-the-chunker/before/chunker.ts#L1-L60)는 마지막 heading만 유지했다. Section parser와 chunk 구성에서 상위 프로젝트 문맥이 하위 chunk의 metadata와 retrieval text에서 빠졌다. 문서 전체의 title로는 각 프로젝트를 식별할 수 없었다.

원본 진단은 상위 제목 metadata가 빠진 child chunk 24개를 식별했다. 사용 기술 12개는 본문에도 프로젝트 식별 정보가 없었으며, 다른 수행 내용에는 서로 다른 정도의 단서가 남았다. 결함은 chunk 구성 중 식별 문맥의 손실이었다. 일반적인 단락 전체 누락은 확인되지 않았다.

12:43:07.931 AI는 하위 heading 24개를 bold label로 바꿔 경력 묶음별로 합치는 안을 제안했다. 미리보기의 예상값은 경력 38→14 chunks, 전체 527→503 chunks였다. 이 수치는 채택 전 대안의 예상값으로 보존한다.

## 문서는 유지하고 처리 계층을 수정한 사용자 판단

12:46:37.586 사용자는 경력 문서 변경을 승인하지 않았다. 프로젝트 제목 아래 수행 내용·사용 기술을 둔 원래 계층은 정상적인 Markdown이었다. 사용자는 수행 내용·기술 단위를 따로 유지하면서 child chunk가 식별 문맥을 계승하는 일반적인 방법을 요구하고, ID·content·fingerprint·evidence reference의 영향을 명시하도록 했다.

13:01:32.183에는 두 요구를 추가했다. Fenced example 내부의 heading-like line이 실제 경계와 heading 상태 변경으로 해석되고 있었으므로 section content로 보존해야 했다. 실제 embedding 입력도 확인해 누락된 section ancestry만 보완하고 문서 제목 중복을 줄이도록 했다.

채택한 구현은 fce18cee의 [청커 v2 전체 원본](../../cases/fix-the-chunker/after/chunker.ts#L1-L109)이다.

| 메커니즘 | 당시 구현 |
|---|---|
| Heading ancestry | Level-aware stack에서 같은 level·하위 sibling을 제거하고 상위 section을 child에 계승한다. [Section 파싱](../../cases/fix-the-chunker/after/chunker.ts#L20-L73) |
| Fenced example | Backtick·tilde fence를 맞춰 내부 heading-like line을 content로 보존하고 실제 heading stack을 유지한다. [Fence 처리](../../cases/fix-the-chunker/after/chunker.ts#L39-L55) |
| 문서 제목 | 첫 heading이 H1이면 경계를 유지하면서 문서 제목으로 처리하고, 이후 H1은 section 문맥으로 유지한다. [Heading 상태](../../cases/fix-the-chunker/after/chunker.ts#L56-L65) |
| Chunk 구성 | 기존 본문 분할 뒤 각 part에 ancestry와 leaf heading을 붙인다. 공개 title은 별도 필드로 유지한다. [Content 구성](../../cases/fix-the-chunker/after/chunker.ts#L92-L109) |

구현 커밋 전후 경력 원문은 보존됐다. 거부한 38→14 병합은 제안으로 남았다.

## 일관된 영향 분석을 확인한 뒤 승인

AI의 첫 영향 표는 영어·한국어 source별 개수를 전후 개수와 혼동했다. 13:18:30.643 사용자는 승인을 보류하고 ancestry·fence parsing·title 처리의 영향을 44개 source 전체에서 각각 계산하도록 했다.

정정된 보고는 ancestry만 적용하면 527개, fence만 적용하면 505개, title만 적용하면 527개, 최종 조합은 505개였다. 개수가 바뀌는 것은 Blueprint EN/KR뿐이며 각각 24→13이었다. 사용자는 13:32:36.808 선언한 불변조건과 실제 결과의 독립 대조를 요구하고 13:33:38.322 승인했다.

구현 중 본문 대조 assertion이 실패하자 AI는 중단했다. 이후 진단에서 기존·새 청커가 모두 수행하는 CRLF→LF 정규화를 검사기가 빠뜨린 것으로 확인했다. 사용자는 13:49:13.663 계속 진행하도록 했다. 14:09:45.154 완료 보고는 다음을 기록했다.

| 당시 검증 | 보고된 결과 |
|---|---|
| Corpus | 44 sources; 527→505 chunks |
| 경력 기록 | 38개 유지, child 24개에 올바른 상위 문맥 |
| Blueprint | 두 source 각각 24→13 chunks |
| 나머지 source | 42개 ID·leaf section 유지 |
| 비-live 테스트 / type check | 67개 통과 / 오류·경고 0 |
| 변경 직후 index 상태 | Cohere1536 STALE; Gemini768 STALE; Gemini1536 MISSING |

[원본 청커 테스트](../../cases/fix-the-chunker/verification/chunker.test.ts#L1-L123)는 계층·sibling 격리·건너뛴 level·제목·긴 section·fence 경계 조건을 다룬다. [Corpus 테스트](../../cases/fix-the-chunker/verification/corpus-context.excerpt.test.ts#L14-L76)는 경력 child 24개의 문맥을 독립 대조하고 Blueprint section과 chunker version identity를 검사한다.

나머지 발췌는 같은 문맥이 [document embedding](../../cases/fix-the-chunker/verification/embedding-context.excerpt.test.ts#L17-L36), [search evidence](../../cases/fix-the-chunker/verification/search-context.excerpt.test.ts#L24-L36), [generation 입력](../../cases/fix-the-chunker/verification/generation-context.excerpt.test.ts#L5-L16)으로 전달되는 계약을 연결한다.

Assertion은 입력 전달을 검사한다. 복원된 기록에서 검색 품질의 동일 조건 전후 효과는 미측정 상태다.

15:07:49 커밋 fce18cee958785252a7f07259c13dafb536086c3은 구현과 테스트를, 15:08:38 커밋 29d2b21d8c0331575478ec5e9d13470729d30b0d는 후속 index publish를 기록한다. 코드 반영과 artifact publish는 각각의 근거를 유지하며, 해당 날짜의 운영 서버 배포는 복원한 검증 범위 밖이다.

## 후속 lexical/hybrid 보정의 coverage 증가와 근거 손실

10월 2일 비교는 HEAD bbac3a6·505 chunks·canonical-portfolio v1의 저장 Full40 순위를 사용했다. 원문 35문항·derived 5문항의 선택 조건을 유지했다. 기존 연구 기록에는 offline lexical/hybrid 규칙 4개가 남아 있다.

| 연구 기록의 지표 | Baseline | Coverage 최상 B1, λ=0.10 |
|---|---:|---:|
| Required groups | 40/49 | 42/49 |
| All-required 문항 | 30/36 | 31/36 |
| Irrelevant evidence | 3 | 6 |

QB32의 직접 지원 근거가 사라졌고 기록에는 네 후보 모두에서 해당 손실이 발생했다고 남아 있다. 모두 미채택으로 기록됐으며 해당 tuning 종료·production 유지가 권고됐다. 직접 확인한 bbac3a6의 production 경로는 cosine ranking·threshold/TopK 선택·derived-intent 분기이며 lexical/hybrid reranking 단계는 없다.

[리랭킹 연구 요약](../../cases/fix-the-chunker/evidence/reranking-research-summary.json#L1-L92)에 당시 보고 수치·조건·원본 보고서의 등록 해시를 보존했다. 원본 report·정확한 규칙과 결합식·순위·수동 판정은 현재 checkout에서 미확보다. Generation 효과는 미측정이었다.

## 근거 범위와 후속 확인

[출처 등록부](../../cases/fix-the-chunker/evidence/source-register.json#L1-L521)는 원본 session 01a0ea78-071a-7243-ac8e-1e5d7ee57aae, 압축·해제 해시, 주체·UTC/KST 시각을 가진 선택 메시지 해시 32개를 식별한다. 사용자 판단은 당시 메시지에서 직접 확인했다. 테스트 건수와 실행 결과는 당시 보고의 범위를 유지한다. 비공개 Git 연구 snapshot 3개가 10월 2일 요약을, 보존된 로컬 산출물 6개가 앞선 진단·provider 비교를 뒷받침한다.

9월 30일 요청은 점검의 직접적인 유지보수·rebuild 맥락을 확인한다. 이 점검을 앞선 reranker 검토와 직접 연결하는 인과 메시지는 미확보다. 최초 사용자 기억은 조사 가설로 활용했으며 사건 순서는 시각이 남은 원본을 따른다.

집에서 보강할 대상은 등록된 hybrid-selection-calibration/2026-10-02-1의 report·plan·문항별 비교·수동 의미 판정이다. Bilingual-collapse와 original-top6는 별도 실행 범위를 유지한다. 등록부에는 10월 2일 제안·승인·결정 메시지와 청커 v2 전후의 동일 조건 검색 품질 자료도 확인 대상으로 남겼다. 527→505 개수 변화와 문맥 보존 테스트는 구조적 정확성의 결과다.

공개 코드와 합성 테스트는 원본 import·애플리케이션 참조를 유지한다. 근거 기록에는 식별자·해시·선택한 관측을 공개하고 Knowledge 원문·대화 전문·자격증명·서버 접근 자료는 비공개로 유지한다.

<details>
<summary>발췌 원본·범위·SHA-256</summary>

| 공개 Excerpt | 원본 commit / 경로 / 원본 행 → 공개 행 | 원본 SHA-256 → 공개 SHA-256 |
|---|---|---|
| [before/chunker.ts](../../cases/fix-the-chunker/before/chunker.ts#L1-L60) | da1dfe04192658973f12596fcad29cbf11ea9d71<br>sveltekit/src/lib/server/knowledge/chunker.ts<br>1–60 → 1–60 | 9e0337d881286d99d9fbd25cfd8fea68605726b7a18e0b8752ae63c97d61a1fd → 9e0337d881286d99d9fbd25cfd8fea68605726b7a18e0b8752ae63c97d61a1fd |
| [after/chunker.ts](../../cases/fix-the-chunker/after/chunker.ts#L1-L109) | fce18cee958785252a7f07259c13dafb536086c3<br>sveltekit/src/lib/server/knowledge/chunker.ts<br>1–109 → 1–109 | db887b35a4da9d07d4095f2347782c57123d902508536eff79574b1e9e9b5bfa → db887b35a4da9d07d4095f2347782c57123d902508536eff79574b1e9e9b5bfa |
| [verification/chunker.test.ts](../../cases/fix-the-chunker/verification/chunker.test.ts#L1-L123) | fce18cee958785252a7f07259c13dafb536086c3<br>sveltekit/src/lib/server/knowledge/chunker.test.ts<br>1–123 → 1–123 | c1fc3e368b54d3f4985244ba7dd25c152cd1b02fc825721f3b7bcfd944fc6f3f → c1fc3e368b54d3f4985244ba7dd25c152cd1b02fc825721f3b7bcfd944fc6f3f |
| [verification/corpus-context.excerpt.test.ts](../../cases/fix-the-chunker/verification/corpus-context.excerpt.test.ts#L1-L76) | fce18cee958785252a7f07259c13dafb536086c3<br>sveltekit/src/lib/server/indexing/corpus.test.ts<br>1–12 → 1–12; 249–311 → 14–76 | 709c64f845c49e627fab702a6bcf4bed0ad60c52a6c7b418136cc7507c3385e0 → 094f04dc22c65c836f0b5430ead4947e62a91e802fa4e2a12ddfe39f00502102 |
| [verification/embedding-context.excerpt.test.ts](../../cases/fix-the-chunker/verification/embedding-context.excerpt.test.ts#L1-L36) | fce18cee958785252a7f07259c13dafb536086c3<br>sveltekit/src/lib/server/embedding/embeddings.test.ts<br>1–15 → 1–15; 258–277 → 17–36 | b8a5c207e4811c8789ad50d15b6d285e743fd8cb3b0376608dcfa5ee26b2d24f → 6ba9ca851d69b45d0717a4aa760749b5591bbff0cac4449b0bcd8e4bff4ad25f |
| [verification/search-context.excerpt.test.ts](../../cases/fix-the-chunker/verification/search-context.excerpt.test.ts#L1-L36) | fce18cee958785252a7f07259c13dafb536086c3<br>sveltekit/src/lib/server/retrieval/search.test.ts<br>1–22 → 1–22; 112–124 → 24–36 | cab05bd9679702bd2c5505d4dade1430c1ab86fadf5dc707fa9ac02f8f497905 → 3d65fea226f76d9761229bea0df2a3eaf721de3011e68dcf7d3b1a08011db7cc |
| [verification/generation-context.excerpt.test.ts](../../cases/fix-the-chunker/verification/generation-context.excerpt.test.ts#L1-L16) | fce18cee958785252a7f07259c13dafb536086c3<br>sveltekit/src/lib/server/generation/answer-prompt.test.ts<br>1–3 → 1–3; 55–66 → 5–16 | 1bc8e67aa4bfafa1b4b600d52ff7aceb6a2439f00c1708fb2bad4f2160ee3aab → 9752be9d33d1e03ea302e16ed01516b426c20fca12104d158334c5ac01fa7ef4 |

부분 발췌는 원본 범위를 순서대로 선택해 한 빈 줄로 연결했다. 경로는 비공개 Synethos 저장소 상대경로다.

| 공개 근거 | 분류 | SHA-256 |
|---|---|---|
| [evidence/decisions-and-observations.json](../../cases/fix-the-chunker/evidence/decisions-and-observations.json#L1-L228) | Reconstructed | 0768365d0864cd47e3bfd976ba275265e74d7e6323d5947b50d00966e9709d82 |
| [evidence/reranking-research-summary.json](../../cases/fix-the-chunker/evidence/reranking-research-summary.json#L1-L92) | Reconstructed | 509793479306f9a1c0daf3854b1503c2b5f7c03c2b1d15ffc6f93e331ba65227 |
| [evidence/source-register.json](../../cases/fix-the-chunker/evidence/source-register.json#L1-L521) | Reconstructed | 337c58ddd11659a16e03a0c952742a15f59c00e7f454053a71c987b90343961d |

</details>

## 공개 준비 검증

코드 7개가 선언한 과거 Git 범위·해시와 일치했고 TypeScript 구문 파싱 7개·JSON 파싱 3개를 통과했다. 압축·해제 세션 해시와 선택 메시지 해시 32개, Git 연구 snapshot 3개, 보존된 로컬 산출물 6개의 해시가 일치했다. Provider 비교의 저장 질문·ground truth·건수는 로컬 계산으로 대조했다. README 2개·개발 기록 2개의 로컬 링크 746개가 파일·헤딩·행 범위 검증을 통과했다. 영문·한글의 파일/외부 링크 대상과 SHA-256 집합이 일치했다.

기존 공개 파일 140개와 사례 01~07 본문, README 소개·저작권과 공통 근거 설명을 보존했다. 새 코드·근거 projection·사례 08 본문에서 비공개 payload·자격증명·운영 접근 정보를 점검했다. 검증은 원본 열람·로컬 파싱·해시와 건수 계산으로 수행했다. 과거 테스트·모델 호출·index build·배포는 실행하지 않았고 Synethos 원본을 보존했다. 10월 2일 원본 산출물 대조는 후속 확인으로 남아 있다.

[전체 사례로 돌아가기](../../README.ko.md)
