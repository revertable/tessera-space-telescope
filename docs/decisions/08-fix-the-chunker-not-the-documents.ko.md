# 08 — Fix the Chunker, Not the Documents

[전체 사례](../../README.ko.md) · [English](08-fix-the-chunker-not-the-documents.md) · [이전: 07](07-knowledge-index-consistency-and-recoverable-deployment.ko.md)

**근거 수준:** 코드 확인은 식별한 과거 소스, 당시 보고는 기록된 조건의 관측, 미확인은 해결되지 않은 사실·인과관계를 뜻합니다. 테스트는 당시 소스 근거로 수록합니다. 시각은 KST(UTC+09:00)이며 개발 사건과 근거 검증 날짜를 구분합니다.

**문서 편집:** 2026-10-30, 기준 `2fc5094`. 아래 과거 공개 검증 기록의 날짜와 범위를 유지합니다.

**개발 기간:** 2026-09-29 ~ 2026-10-02.

**코드 분류:** Excerpt — 전체 원본 4개·부분 테스트 발췌 4개. Reconstructed 근거 기록 4개가 원본·당시 보고·남은 질문을 연결한다.

**결과:** 사용자는 문서 workaround를 거부하고 정상 Markdown 계층과 경력 기록의 수행 내용·기술 단위를 유지하는 일반적인 청커 수정을 선택했다. 이후 offline lexical/hybrid 후보는 일부 coverage 지표를 개선하면서 유효한 근거를 잃었으며, 복구한 원본 보고서에는 모두 미채택으로 남아 있다.

## 순위 조정 기법을 선택하기 전에 실패 위치 구분

9월 29일 baseline은 원문 query, cosine 순위의 local chunks, minimumScore 0.25와 Top5 evidence를 사용했다. 보존된 38문항 calibration은 여러 실패 위치를 구분했다. MSA 근거는 8위였고, Observatory 검증의 직접 근거는 복합질문에서 125위·좁힌 질문에서 1위였다. 다른 실패에서는 필요한 자료가 이미 1·2위에 있었다. 원문 claim 해석, 답할 수 있는 부분의 생략, 출력 언어 지시 준수의 문제였다.

16:21:16.121 사용자는 reranking을 가설로 검토하고 후보 경계에서의 누락·질문 표현·근거 충분성·생성 실패를 구분하도록 요청했다. 16:39:40.627에는 입증된 비용 대비 효과로 MVP 변경을 선별하며 미채택도 허용하도록 했다. AI 제안은 후보 풀 확대와 그 안의 유효한 근거를 승격하는 문제를 구분했다. Top8 generation과 정답 근거를 직접 넣은 oracle 실행은 evidence 선택을 바꾼 진단이었다. 직접 확인한 9월 29일 기록에는 reranker 모델의 실측 결과가 없다.

별도의 9월 30일 retrieval-only 비교는 Cohere Embed v4/1536과 Gemini Embedding 2/768에 동일한 38문항·ground truth·525-chunk corpus·Top5·minimumScore 0.25를 사용했다. 저장 결과에는 target별 query embedding 38회가 기록돼 있다. 이번에 그 결과를 다시 집계했다.

| 저장 결과 지표 | Cohere1536 | Gemini768 |
|---|---:|---:|
| Production Top5로 확보한 supported claim | 29/32 | 31/32 |
| 지원 가능한 모든 claim을 확보한 문항 | 24/27 | 26/27 |

분모는 이 calibration의 지원 가능한 claim과 문항이다. Corpus fingerprint는 d047a7dc…52bdbf였다. 이 관측은 청커 v2 수정 전 provider 비교에 해당하며, 앞선 9월 29일 순위는 다른 fingerprint의 결과다. [판단·관측 기록](../../cases/fix-the-chunker/evidence/decisions-and-observations.json#L1-L253)에 두 범위와 저장 산출물을 식별했다.

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

## 후속 selection 실험: 사용자 기준과 AI의 비교

10월 2일 비교는 청커 수정 이후 HEAD bbac3a6·505 chunks·canonical-portfolio v1의 저장 Full40 순위를 사용했다. 사용자는 기존 production을 유지하면서 한 축씩 비교하고 coverage와 기존 지원 보존·다른 프로젝트 근거 유입을 함께 판단하도록 했다. 집 PC의 사용자 입력 이력에서 다음 순서를 확인했다.

| 시각 KST | 사용자가 요청한 비교와 조건 |
|---|---|
| 20:59:38 | Original-only Top5→Top6를 저장 순위로 비교; derived 경로 유지; coverage 증가와 오염·문맥 비용을 함께 평가 |
| 21:12:22 | 이미 선택된 한·영 동일 logical section만 축소; KR 우선·상위 순위 우선 비교; 빈자리 backfill 없이 직접 지원·중요 detail 보존 |
| 22:32:15 | Top5를 유지한 generic lexical/hybrid 비교; 질문·candidate 정보만 scoring에 사용; irrelevant 증가와 기존 지원 손실을 채택 판단에 포함 |

마지막 요청은 앞선 Top6와 bilingual collapse를 이미 미채택으로 설명한다. 사용자가 평가 범위·성공 조건을 정했고, Top30 후보 풀과 점수식·가중치의 구체화 및 offline 구현은 AI가 수행했다. [대안 비교 근거](../../cases/fix-the-chunker/evidence/october02-selection-alternatives.json#L1-L277)는 원본 요구의 UTC/KST·text hash와 각 실험의 원본 결과를 연결한다.

### Top6 확대와 한·영 중복 축소

| 저장 결과 | Required groups / all-required 문항 | Evidence / 직접 지원 레코드 |
|---|---|---|
| 공통 baseline | 40/49 · 30/36 | 199 · 51 |
| Original-only Top6 | 42/49 · 31/36 | 234 · 56 |
| 한·영 축소: KR 우선 | 40/49 · 30/36 | 191 · 47 |
| 한·영 축소: 상위 순위 우선 | 38/49 · 29/36 | 191 · 47 |

Top6는 required group 2개를 회수했지만 새 evidence 35개 중 30개가 배경·방해 자료로 분류됐다. 추가 자료에는 다른 프로젝트 7개·irrelevant 2개·image-only 1개가 있었고 prompt 내용 문자수는 약 15.22% 늘었다. AI의 decision.json은 이 전역 Top6를 미채택으로 기록한다.

한·영 축소의 KR 우선 방식은 strict coverage를 유지했다. 직접 지원 레코드 51→47은 중복 4개 제거에 따른 변화이며 **논리적 직접 지원 section은 46개로 유지**됐다. 당시 수동 검토는 중요한 claim·detail의 실질 손실을 확인하지 않았다. 사용자 조건에는 direct support 감소도 채택 제외 기준으로 있었고, 일반적인 runtime에서 내용 대응을 보장할 방법과 generation 이익도 확인되지 않아 두 전략 모두 미채택으로 기록됐다. 상위 순위 우선 방식은 strict required group 2개도 잃었다. 이 결과와 아래 hybrid의 실제 지원 손실은 각각의 조건으로 기록한다.

### Lexical/hybrid의 coverage 증가와 실제 지원 손실

[원본 점수 계산 코드](../../cases/fix-the-chunker/research/rules.mjs#L1-L11)는 기존 vector Top30 안에서 raw cosine 0.25 이상인 후보만 평가한다. NFKC·소문자·apostrophe 정규화 후 exact token recall 0.60과 한글 token 내부 bigram recall 0.40을 결합한다. B1은 본문·section·title·source metadata를 합친 coverage, B2는 pool-IDF와 body .65·section .20·title .10·source .05를 사용한다. H = raw cosine + λL이며 λ=.04/.10은 selection에 기록된 계획·규칙 hash로 확인했다. 동률은 cosine·기존 순위로 정한다. 예상 정답·required evidence·문항 ID는 scoring 입력에서 제외됐다.

| 저장 40문항 재집계 | Required groups | All-required 문항 | 다른 프로젝트·entity | Irrelevant |
|---|---:|---:|---:|---:|
| Baseline | 40/49 | 30/36 | 20 | 3 |
| B1 λ=.04 | 40/49 | 30/36 | 19 | 4 |
| B1 λ=.10 | 42/49 | 31/36 | 17 | 6 |
| B2 λ=.04 | 39/49 | 29/36 | 21 | 4 |
| B2 λ=.10 | 41/49 | 30/36 | 20 | 4 |

Coverage 최상 B1(.10)은 required group 3개를 회수하고 1개를 잃었다. 네 후보 모두 QB32의 직접 지원 근거가 5위에서 6위로 밀려 Top5에서 빠졌다. 저장 문항별 비교와 당시 수동 판정을 대조했으며, 원본 보고서는 이 손실을 실제 답변 가능성의 감소로 판단했다. 모든 후보의 irrelevant도 baseline보다 늘었다. AI는 네 후보를 모두 미채택으로 정리하고 현재 tuning 종료·production 유지를 권고했다. 이 권고를 수락하는 별도의 최종 사용자 승인 원문은 미확보다.

[리랭킹 연구 요약](../../cases/fix-the-chunker/evidence/reranking-research-summary.json#L1-L172)은 기존 연구 보고 수준의 기록에 이번 직접 대조 결과를 추가한다. 원본 report.md의 SHA-256은 등록값 9d303908…de8b55와 일치한다. 현재 재집계에서 baseline과 후보별 evidence는 각각 199개였고, derived 5문항의 evidence는 모두 동일했다. 새로 선택된 21개 문항·chunk 조합의 의미 판정은 당시 수동 검토 결과로 구분한다.

원본 verification은 외부 호출 0회·source 변경 0을 기록한다. 보존 기록의 tracked 188개·기준 artifact 542개 hash도 실험 전후 일치했다. 이번 공개 준비에서는 저장 결과와 hash를 대조했고 scoring·실험을 재실행하지 않았다. 직접 확인한 bbac3a6 production 경로는 cosine ranking·threshold/TopK·derived-intent 분기였다. 세 실험의 generation 효과와 청커 수정 전후 동일 조건 검색 품질 효과는 미측정 범위로 유지한다.

## 근거 범위와 후속 확인

[출처 등록부](../../cases/fix-the-chunker/evidence/source-register.json#L1-L882)는 기존 원본 session 01a0ea78-071a-7243-ac8e-1e5d7ee57aae의 압축·해제 hash와 선택 메시지 hash 32개, Git 연구 snapshot 3개, 초기 로컬 산출물 6개를 보존한다. homeRecovery에는 이번에 직접 읽은 10월 2일 원본 38개와 사용자 입력 이력 3건의 식별·hash·UTC/KST를 추가했다. 입력 이력은 사용자 요구를 확인하며 AI 응답·실행 전문은 포함하지 않는다.

9월 30일 원본 사용자 요청은 점검의 직접적인 유지보수·rebuild 맥락을 확인한다. 이 점검을 앞선 reranker 검토와 직접 연결하는 인과 메시지, 청커 v2 전후의 동일 조건 검색 품질 자료, 10월 2일 전체 제안·완료 대화와 hybrid 종료에 대한 별도 최종 사용자 승인은 추가 확인 대상으로 남긴다. 527→505 개수 변화와 문맥 보존 테스트는 구조적 정확성의 결과다.

공개 코드와 합성 테스트는 원본 import·애플리케이션 참조를 유지한다. 추가한 rules.mjs는 보존된 로컬 실험 코드 전체이며 Git commit 소스로 분류하지 않는다. 근거 기록에는 식별자·hash·집계 관측을 공개하고 Knowledge·QB 질문/정답·수동 판정 이유·대화 전문·자격증명·서버 접근 자료는 비공개로 유지한다.

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
| [research/rules.mjs](../../cases/fix-the-chunker/research/rules.mjs#L1-L11) | 보존된 로컬 실험 원본; Git commit 미지정<br>tmp/evaluation/hybrid-selection-calibration/2026-10-02-1/rules.mjs<br>1–11 → 1–11 | bdf4eb67fd7a9205d600e89e4e18ccd399f6d569271546e16d766fafec01300d → bdf4eb67fd7a9205d600e89e4e18ccd399f6d569271546e16d766fafec01300d |

부분 발췌는 원본 범위를 순서대로 선택해 한 빈 줄로 연결했다. 경로는 비공개 Synethos 저장소 상대경로다.

| 공개 근거 | 분류 | SHA-256 |
|---|---|---|
| [evidence/decisions-and-observations.json](../../cases/fix-the-chunker/evidence/decisions-and-observations.json#L1-L253) | Reconstructed | 992511919fc921b0830a4282ee1fc3c332d8ada4fbf311a2bd14c68a88bfe33d |
| [evidence/reranking-research-summary.json](../../cases/fix-the-chunker/evidence/reranking-research-summary.json#L1-L172) | Reconstructed | 6dbd754fe350a551721dd9b1f7b001a3bf27e8505c5e96ccee0f622d1e7dd846 |
| [evidence/source-register.json](../../cases/fix-the-chunker/evidence/source-register.json#L1-L882) | Reconstructed | 51bc5d77cba4da3cb5b550b9f7ba1c5a10c754ff8132f5edb0953da383da8b23 |
| [evidence/october02-selection-alternatives.json](../../cases/fix-the-chunker/evidence/october02-selection-alternatives.json#L1-L277) | Reconstructed | b071496d650366f5086f3ca7ce99e214273b09e9c5607df17cbcea64fedbebac |

</details>

## 공개 준비 검증

코드 7개가 선언한 과거 Git 범위·해시와 일치했고 TypeScript 구문 파싱 7개·JSON 파싱 3개를 통과했다. 압축·해제 세션 해시와 선택 메시지 해시 32개, Git 연구 snapshot 3개, 보존된 로컬 산출물 6개의 해시가 일치했다. Provider 비교의 저장 질문·ground truth·건수는 로컬 계산으로 대조했다. README 2개·개발 기록 2개의 로컬 링크 746개가 파일·헤딩·행 범위 검증을 통과했다. 영문·한글의 파일/외부 링크 대상과 SHA-256 집합이 일치했다.

기존 공개 파일 140개와 사례 01~07 본문, README 소개·저작권과 공통 근거 설명을 보존했다. 새 코드·근거 projection·사례 08 본문에서 비공개 payload·자격증명·운영 접근 정보를 점검했다. 검증은 원본 열람·로컬 파싱·해시와 건수 계산으로 수행했다. 과거 테스트·모델 호출·index build·배포는 실행하지 않았고 Synethos 원본을 보존했다. 위 기록은 최초 공개 준비 범위다. 10월 2일 원본 복구·대조는 아래 추가 검증으로 기록한다.

## 10월 30일 집 PC 원본 복구·추가 검증

원본 코드·선택 범위 8개를 대조했고 TypeScript 7개·JavaScript 1개의 구문과 공개 JSON 4개를 검사했다. 복구 원본 38개와 사용자 입력 3건의 hash가 일치했다. 저장 40문항의 세 실험을 각각 재집계해 baseline 포함 후보 집합 10개의 required·all-required·evidence·의미 분류 건수를 요약과 대조했고, 한·영 축소의 논리적 직접 지원 section도 확인했다. Hybrid의 derived 5문항은 동일했고 계획·규칙 hash와 실험 전후 보존 기록 188개·542개도 일치했다.

README와 docs Markdown의 로컬 링크 834개가 파일·헤딩·행 범위 검증을 통과했다. 사례 08의 영문·한글 파일/외부 링크 대상과 SHA-256 집합이 일치한다. 사례 01~07의 공개 파일 139개·본문과 공통 목차, 기존 청커 판단·구현 설명·코드 7개를 보존했다. 파일 대조는 Windows 체크아웃 개행을 정규화했다.

공개 대상에서 비공개 payload·자격증명·로컬 사용자 경로·비공개 저장소 URL·서버 접근 정보를 점검했다. 검증은 원본 열람·구문 파싱·저장 결과 산술·hash 계산으로 수행했다. 기존 scoring·실험·테스트·모델/API 호출·index build·서버 접근·배포는 실행하지 않았으며 Synethos working tree는 clean이다.

[전체 사례로 돌아가기](../../README.ko.md)
