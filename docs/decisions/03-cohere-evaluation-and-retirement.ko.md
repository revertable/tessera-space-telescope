# 03 — Cohere 도입·평가·제거

[전체 사례](../../README.ko.md) · [English](03-cohere-evaluation-and-retirement.md) · [이전: 02](02-gitbook-to-local-knowledge.ko.md) · [다음: 04](04-provider-architecture-and-embedding-reliability.ko.md)

**근거 수준:** 코드 확인은 식별한 과거 소스, 당시 보고는 기록된 조건의 관측, 미확인은 해결되지 않은 사실·인과관계를 뜻합니다. 테스트는 당시 소스 근거로 수록합니다. 시각은 KST(UTC+09:00)이며 개발 사건과 근거 검증 날짜를 구분합니다.

**문서 편집:** 2026-10-30, 기준 `2fc5094`. 아래 과거 공개 검증 기록의 날짜와 범위를 유지합니다.

**개발 시기:** 2026-09-28 ~ 2026-10-17

**코드 분류:** Excerpt 19개와 Reconstructed JSON 기록 2개입니다.

**결과:** Cohere는 embedding fallback에서 generation·classifier 평가 대상으로 확대됐습니다. 사용자는 관측된 이점과 Synethos의 규모, 대체 가능성, 운영 비용을 종합해 최종적으로 Gemini 단일 embedding과 Gemini→Groq generation을 선택했습니다.

## 개발 순서

아래 연표는 커밋된 설정, 로컬 runtime 변경과 실험 관측을 구분합니다. 사건 시각과 커밋 시각을 각각 기록하며 UTC 표기 외 시각은 KST입니다.

| 시점 / 커밋 | 개발 사건 |
|---|---|
| 9월 28일 14:50:04 · `5f71fbe` | Gemini 뒤에 Cohere embedding을 도입하고 target·호환 index를 분리. |
| 9월 28일 23:59:41 · `dadffe3` | Provider 소유 document batching 추가. |
| 9월 29일 10:37:00 · `5615b4c` | 현재 실패한 HTTP 429 document batch의 bounded retry 추가. |
| 9월 29일 17:46:25 · `1c0f28e` | Runtime embedding을 Cohere 단독으로 선택하고 Gemini build target 등록은 유지. |
| 9월 30일 18:15:43 · `b00bf59` | Command A+와 shared-evidence generation 비교 추가. |
| 10월 1일 13:47·16:43·17:04 보고 | 질문 대상 유지 비교와 로컬 Cohere 단독 generation 검증. Routing 변경은 17:32 Git 범위에서 제외. |
| 10월 2일 02:37:05 · `180cc30` | Embedding·generation 모두 Gemini→Cohere로 설정. |
| 10월 3일 07:42:12 · `0baebd9` | Generation fallback을 Groq로 변경하고 Cohere generation은 명시적 평가 대상으로 유지. |
| 10월 6일 16:05:37.753~16:05:47.618 | Cohere classifier 실험 후 gate에 따라 retrieval·generation 중단. 19:17 인수인계에서는 fallback/evaluation 자산으로 유지. |
| 10월 15일 21:22~21:24 · 실행 HEAD `927415e` | 같은 current corpus·question bank에서 Gemini/Cohere 검색 비교. |
| 10월 16일 판단 21:02:47·커밋 21:32:34 · `e700717` | 완전 제거를 선택하고 Cohere 통합 제거. |
| 10월 17일 성공 보고 22:19:07·커밋 22:20:44 · `033e02f` | Gemini rebuild 성공·CURRENT 보고 후 artifact 공개와 retired index 정리. |

## 대체 embedding space 도입

9월 28일 개발 보고서는 앞선 Gemini 문서 build에서 chunk embedding 50개 성공 뒤 daily quota에 도달했다고 기록합니다. Gemini의 `gemini-embedding-2` 768차원 뒤에 `embed-v4.0` 1536차원을 도입했습니다. 최초 도입 동기의 전체 우선순위를 확인할 대화 기록은 아직 불완전합니다.

[최초 HTTP client](../../cases/cohere-lifecycle/embedding/initial/client.ts#L22-L54)는 native `fetch`로 `/v2/embed`를 호출하고 target 출력 차원의 float vector를 요청합니다. [최초 adapter](../../cases/cohere-lifecycle/embedding/initial/embedding.ts#L19-L45)는 질문에 `search_query`, 제목·본문 문서에 `search_document`를 사용하고 반환 vector 개수를 검사합니다. 각 target은 자신의 embedding space에 맞는 index를 요구합니다.

[Fallback loop](../../cases/cohere-lifecycle/embedding/initial/target-fallback.ts#L23-L44)는 index 도달 가능성과 credential을 확인하고 순서대로 target을 시도하며 분류된 fallbackable provider 실패에서 다음 target으로 이동합니다. Current index의 credential blocker는 작업을 중단합니다. [합성 fallback 테스트](../../cases/cohere-lifecycle/embedding/initial/target-fallback.test.ts#L20-L42)가 두 경로를 표현합니다.

이후 [batching adapter](../../cases/cohere-lifecycle/embedding/batched/embedding.ts#L9-L51)는 선호·최대 document batch를 96개로 선언합니다. [테스트](../../cases/cohere-lifecycle/embedding/batched/embedding.test.ts#L9-L39)는 다국어 문서 순서와 97개 입력 거부를 확인합니다.

제거 직전 [HTTP 실패 테스트](../../cases/cohere-lifecycle/embedding/pre-retirement/client.test.ts#L26-L53)는 부가 정보 없는 429를 neutral·fallbackable로 유지하고 Retry-After를 정규화합니다. 각 파일은 해당 원본 시점을 유지합니다.

Build 보고서에는 별도 실행들이 기록돼 있습니다. 한 과거 build는 Gemini 32문서 요청 3회 성공 뒤 네 번째 요청에서 실패했으며 진단 정보가 충분히 보존되지 않았습니다. 같은 실행의 Cohere는 6회 요청을 완료하고 당시 current cache artifact를 만들었습니다.

별도 9월 29일 525chunks 실행은 Cohere batch 5개 성공 뒤 6/6에서 HTTP 429를 받았고 미완성 target은 publish하지 않았습니다. `5615b4c` 보고의 새 bounded retry 정책 검증은 mock 기반이며 live retry 검증은 대기 상태였습니다.

[Reconstructed 설정 이력](../../cases/cohere-lifecycle/configuration/target-history.json#L1-L227)은 커밋된 example 설정 5개의 generation·embedding 필드를 선택해 보존합니다. `1c0f28e`는 runtime embedding에 Cohere만 선택했고, 이후 `180cc30`은 Gemini 다음 Cohere를 선택했습니다. 최초 Cohere 단독 전환 이유는 미확인입니다.

## Generation으로 평가 확대

9월 30일 `b00bf59`에서 generation registry에 `command-a-plus-05-2026`을 추가했습니다. [Generation client](../../cases/cohere-lifecycle/generation/generation-client.ts#L7-L35)는 HTTP·transport·timeout 실패를 분류합니다. [Generation adapter](../../cases/cohere-lifecycle/generation/generation.ts#L6-L26)는 공통 system/user prompt와 response schema를 `/v2/chat` 요청으로 옮기고 지원 옵션을 전달하며 COMPLETE 종료를 요구하고 text block을 결합합니다. [계약 테스트](../../cases/cohere-lifecycle/generation/generation.test.ts#L12-L63)는 옵션 변환, usage metadata, 미완료 출력과 정규화 오류를 다룹니다. 공개 테스트 기준본의 출력 한도는 9월 30일의 1200이며 이후 10월 2일 설정에는 32768이 기록돼 있습니다.

[Shared-evidence 비교](../../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.ts#L45-L90)는 저장 retrieval snapshot을 검증하고 target별 evidence를 복제하며 snapshot·prompt·evidence·citation 순서의 identity를 기록합니다. 각 명시적 target은 retryPolicy `none`으로 별도 결과를 남기며 응답 형태·인용 검증과 claim review 대기 상태를 함께 기록합니다. [선택한 테스트](../../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.test.ts#L27-L77)는 입력 동일성, snapshot 재사용, 개별 target 실패, 인용 검사와 credential 분리를 다룹니다.

## 10월 1일: 질문 대상과 record 화자

공통 prompt에는 `Describe yourself as Synethos`가 있었고 검색 record에는 류승원의 1인칭 글이 포함돼 있었습니다. 사용자는 응답자 정체성, 질문 대상과 record의 실제 화자가 만나는 문제를 조사했습니다. 보존 세션은 고정 retrieval context를 사용한 여러 prompt 수정 단계를 기록합니다.

| 보고 시각 | 조건과 당시 보고 결과 |
|---|---|
| 13:47:45.250 | 질문 5개×조합 4개×반복 3회: 계획 60회, 응답 59개와 Gemini generation 429 1회. |
| 16:43:18.624 | 고정 context 2개×generation provider 2개×질문 8개×반복 3회: 96회. 대상 유지 Cohere 48/48, Gemini 42/48. |
| 같은 보고의 후속 단계 | 표현 수정 뒤 문제 경력 질문 12회 추가 확인. 두 단계 합계 대상 유지 Cohere 54/54, Gemini 42/54. |
| 17:04:10.538 | 로컬 Cohere 단독 generation, context 2개×질문 10개×반복 3회: HTTP 200 응답 60개. 대상 변경·화자 혼동 관측 0회. 이름 표기 위반 22/60, 의미적 citation 누락·grounding 오류 잔존. 신규 embedding·Gemini generation 호출 0회. |

이 수치는 각 prompt revision에서 보고된 대상 유지·출력 품질 관측입니다. 세션은 60응답 실행의 결과 파일을 만들지 않았다고 기록하므로 응답별 독립 검토 자료는 확보되지 않았습니다. 17:13:29 routing은 미커밋 상태였고 17:32:44 Git 선언은 해당 4개 파일을 제외했습니다. `496e95e`는 17:34:31 질문 대상 규칙 단순화를 커밋했습니다. 로컬 routing 관측과 커밋된 prompt 변경은 각각의 범위로 기록합니다.

## 10월 3일: 고정 입력 generation 결과와 fallback 선택

통합 조사에는 모델마다 같은 저장 evidence·질문·prompt·schema를 사용한 fresh 3-way 비교가 기록돼 있습니다. 모델별 응답 40개, 전체 성공 요청 120회입니다.

| 모델 | Fully correct | Grounding 실패 | Contract 실패 | 평균 generation 지연 |
|---|---:|---:|---:|---:|
| Gemini 3.5 Flash Lite | 27/40 | 0 | 1 | 1.508초 |
| Cohere Command A+ | 22/40 | 3 | 4 | 3.042초 |
| Groq GPT-OSS 120B | 25/40 | 2 | 0 | 1.524초 |

집 PC에서 원본 full40 디렉터리와 보고서를 확보했고 등록 해시가 일치했습니다. 요청·응답·결과·수동 판정 각 120개를 대조하고 위 집계를 다시 계산했습니다.

Gemini·Cohere 출력 상한은 32768, GPT-OSS는 strict JSON Schema와 상한 4096을 사용했으며 reasoning_effort는 기본 medium을 사용하도록 생략했습니다. [원본 결과 projection](../../cases/model-selection-quality-availability/evidence/october03-reported-results.json)은 문항별 identity·옵션·검증과 당시 판정을 보존합니다.

커밋된 0baebd9의 runtime은 Gemini generation primary·Groq GPT-OSS fallback이고 Cohere는 명시적 평가 대상으로 남았습니다. 10월 1일 대상 유지, 이 full40 판정과 이후 검색 diagnostic은 각각의 지표·조건을 유지합니다.

## 10월 6일: classifier gate에서 후속 실험 중단

Cohere 실험은 질문만 입력으로 사용해 `command-a-plus-05-2026`에 질문 20개를 각각 1회 보냈습니다. 정답 label 고정 18개와 탐색 2개이며, 두 필드 enum/boolean schema, 출력 한도 512tokens, temperature 0, thinking 비활성화, retry·provider fallback 없는 단일 dispatch 조건이었습니다. Artifact 시각은 2026-10-06T07:05:37.753Z~07:05:47.618Z입니다.

[Classifier 계약](../../cases/cohere-lifecycle/evaluation/classifier-contract.excerpt.ts#L3-L22)은 정확히 `intent`·`requiresCompleteSet`을 요구합니다. [Gate](../../cases/cohere-lifecycle/evaluation/classifier-contract.excerpt.ts#L24-L43)는 intent ≥17/18, complete-set 18/18, 필수 L1/A1/A6 정답, lookup/aggregate 혼동 0, compare/synthesis ≥6/7, JSON 20/20과 API 실패 0을 요구합니다. [Reconstructed 관측 기록](../../cases/cohere-lifecycle/evidence/observed-results.json#L3-L69)은 저장된 summary·호출 수를 보존합니다.

| 관측 | Cohere 결과 |
|---|---:|
| HTTP 200 / API 실패 | 20/20 · 0 |
| 유효한 단일 JSON | 17/20 |
| Intent / complete-set | 13/18 · 14/18 |
| Compare/synthesis | 5/7 |
| 성공 classifier 응답 latency 중앙값 | 409ms |
| 후속 embedding / 답변 generation 호출 | 0 / 0 |

L2/L3/S4는 설명문·중복 JSON으로 엄격한 parsing에 실패했습니다. S1은 compare, A4는 lookup/false로 분류됐습니다. Raw provider block이 저장되지 않아 모델 출력과 adapter의 text block 처리 중 원인 기여는 미확인입니다. Gate 실패에 따라 계획한 dynamic retrieval과 답변 generation 2회를 건너뛰었습니다.

조사에 보존된 비교에서 Groq·Gemini 3.1은 intent 18/18, complete-set 18/18, JSON 20/20이며 성공 응답 latency 중앙값은 927ms·2327ms였습니다. 최초 실행은 각각 16·15개 성공 뒤 429로 중단됐고, 후속 실행은 성공 결과를 재사용해 남은 질문만 완료했습니다. 19:17:35 인수인계에는 Cohere를 fallback/evaluation으로 유지한다는 사용자 결정이 기록돼 있습니다. 별도 “추가 비용 없음” 발언의 정확한 적용 범위는 미확인입니다.

## 10월 15일: 검색에서 관측된 이점

검색 diagnostic은 HEAD `927415e`에서 target마다 1회 실행했습니다. 27sources·372chunks, question-bank content version 2, profile full-40 version 1이며 양쪽 index는 CURRENT였습니다. Gemini 다음 Cohere 순서로 target별 질문 40개·query embedding 52회를 실행했습니다. Recall은 supported 질문 32개·evidence group 41개 기준이며 unsupported 8개는 양성 recall 분모에서 제외합니다.

| 지표 | Gemini 768 | Cohere 1536 |
|---|---:|---:|
| Original macro recall@5 | 85.94% | 89.06% |
| Merged macro recall@5 | 90.63% | 90.63% |
| Merged macro recall@10 | 92.19% | 95.31% |
| Merged group hit @5 | 35/41 | 36/41 |
| Merged group hit @10 | 36/41 | 38/41 |
| 전체 group 충족 질문 @10 | 27/32 | 29/32 |
| Diagnostic 전체 경과 시간 | 28.27초 | 20.64초 |

이 실행에서 Cohere는 @10의 group 2개와 전체 group 충족 질문 2개를 더 확보했습니다. 양쪽 모두 QB11/QB26/QB39의 지정 group 일부를 @10에서 놓쳤고, 해당 group은 전체 순위의 cutoff 아래에 있었습니다. 실행은 서버 검색 직접 호출이며 classifier·generation·HTTP는 경로 밖이었습니다.

[근거 순위 계산](../../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L151-L167)은 OR 대안을 평가하고 AND 대안의 모든 항목을 요구하며 그중 가장 낮은 순위를 사용합니다. [문항 평가](../../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L236-L281)는 original·merged 순위를 기록하고, [diagnostic runner](../../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L302-L325)는 corpus/index identity를 확인하고 target 하나를 고정합니다. [지표 테스트](../../cases/cohere-lifecycle/evaluation/retrieval-evaluate.test.ts#L107-L161)는 unsupported 문항, AND/OR 대응과 선택 evidence·diagnostic coverage 분리를 다룹니다. [Reconstructed 검색 summary](../../cases/cohere-lifecycle/evidence/observed-results.json#L70-L137)는 보존 순위에서 집계값을 다시 계산하고 question-bank/profile identity를 유지합니다.

## 제거 판단: 규모·운영 비용과 성능 이점의 비교

**당시 판단, 10월 16일 21:02:47.996:** 집 PC에서 확보한 보관 세션의 사용자 원문은 Cohere 검색 품질과 build 속도·편의성을 인정하면서 무료 production 운영을 우선했습니다. 당시 이해한 Trial key의 production 제약·Production key 과금 조건과, 사전 생성 index를 사용해도 같은 space의 Cohere query embedding 호출이 필요하다는 점을 명시했습니다. 최근 품질 차이가 Synethos 규모에서 비용과 관리 복잡도를 감수할 정도인지 검토하며 개발/evaluation 전용 유지와 완전 제거를 비교하도록 했고, 사용자는 완전 제거를 선택했습니다. 세션 원본 해시는 기존 등록값과 일치하며 [복구 근거 등록부](../evidence/recovered-source-register.json)에 사용자 결정과 agent 검토·완료 보고의 메시지 위치를 구분합니다.

**공개 준비 중 사용자가 직접 밝힌 판단 근거, 2026년 10월 29일:** Cohere는 일부 평가에서 Gemini보다 좋은 성능을 보였지만, Synethos 규모에서는 관측된 차이가 과금을 정당화할 만큼 크지 않았습니다. 성능 차이가 훨씬 크거나 서비스가 더 크고 복잡했다면 비용을 지불하는 도입도 고려했을 것입니다. 최종 판단은 실제 성능 차이, 서비스 규모, 대체 가능성과 운영 비용을 종합한 결정이었습니다.

완전 제거는 credential·adapter·별도 index·평가 matrix·테스트 관리 범위를 줄였습니다. 동시에 실제 embedding fallback, 빠른 개발 인덱싱과 Cohere 비교 경로의 직접 재실행을 포기했습니다. 위 성능 관측은 이 tradeoff의 근거로 유지합니다. 실측 청구 총액과 수치화된 비용·편익 임계값은 기록에서 확인되지 않습니다.

## 제거 구현과 index 인계

`e700717`은 Cohere HTTP client·adapter와 테스트, factory 등록, provider 옵션, 설정·example binding과 현재 평가 선택지를 제거했습니다. Client는 native `fetch` 구현이었습니다. [제거 후 embedding factory](../../cases/cohere-lifecycle/after-removal/embedding-provider-factory.ts#L12-L24)는 Gemini를, [generation factory](../../cases/cohere-lifecycle/after-removal/generation-provider-factory.ts#L17-L33)는 Gemini·Groq를 지원합니다. [옵션 검사](../../cases/cohere-lifecycle/after-removal/target-options.ts#L4-L25)와 [선택한 설정 테스트](../../cases/cohere-lifecycle/after-removal/runtime-selection.excerpt.test.ts#L22-L67)는 유지된 provider 경계와 runtime 선택을 보여줍니다.

Provider abstraction, 과거 비교 artifact, 공통 document-build 진행 로그와 Gemini 전용 요청 시작 간격 22초 pacing을 유지했습니다. Pacing은 그날 저녁 조사하던 별도 document-build quota 문제에 대응한 변경입니다. 21:19:53.762 원본 세션의 agent 완료 보고는 테스트 939개 통과·기존 skip 4개·static check/build 통과와 knowledge 변경에 따른 Gemini index stale 상태를 함께 기록합니다.

사용자는 21:29:36.316 index를 제외하고 코드를 먼저 커밋하도록 했습니다.

10월 17일 22:19:07.357 사용자는 rebuild 성공·CURRENT 상태를 보고했습니다. 22:20:44의 `033e02f`는 새 Gemini artifact를 추가하고 이전 Gemini·retired Cohere artifact를 제거했습니다. 코드 통합, index rebuild 보고와 artifact 공개를 각각 구분합니다. 제거 후 production 동작은 이 사례에서 독립 검증한 근거 범위 밖입니다.

## 검증 범위와 남은 사항

10월 1일 품질 결과는 직접 읽은 원본 세션의 당시 보고입니다. 10월 3일 generation 원본과 10월 6일 classifier·10월 15일 검색 파일은 직접 대조했습니다. 10월 16~17일 원본 세션에서 제거 판단·agent 완료 보고·사용자의 CURRENT 확인을 직접 읽었습니다. 실행 결과는 각 당시 보고의 조건으로 유지합니다. 10월 29일 근거는 이 공개 작업에서 사용자가 직접 밝힌 후속 설명입니다.

남은 사항은 최초 도입·Cohere 단독 전환의 전체 동기, 10월 6일 비용 발언의 적용 범위, 당시 key·약관의 독립 자료, classifier 출력·block 처리 원인, build 시도별 ledger와 제거 후 production 검증입니다. 이번 공개에서는 모델 요청·index build·당시 애플리케이션 테스트를 실행하지 않았습니다.

## 출처 추적과 공개 방식

전체 파일 Excerpt 15개는 원본 bytes를 보존합니다. 일부 Excerpt 4개는 아래 원본 선언·테스트 문장을 빈 줄로 연결하며 이름·import·선택 문장을 유지합니다. 테스트에는 합성 credential·fixture와 생략한 애플리케이션 모듈 참조가 남아 있습니다. Classifier 발췌는 schema·parser·gate와 원래 harness 상태 참조를 보존합니다. 선택한 코드는 열람 목적으로 공개합니다. 로컬 harness 발췌의 줄바꿈은 CRLF에서 LF로 정규화했습니다.

Reconstructed JSON 2개는 새 편집 구조를 사용합니다. `target-history.json`은 식별한 example 설정의 generation·embedding 필드 전체를 복사합니다. `observed-results.json`은 저장 classifier summary·counter를 선택하고 original/final 근거 순위에서 검색 집계를 계산합니다.

추가한 generationOctober03은 복구한 full40 집계·옵션·검증을 연결하고 retirementOctober16은 원본 세션의 사용자 판단·완료 보고·다음 날 CURRENT 보고를 선택합니다. 비공개 원문, 실험 응답 전문, credential, index vector와 로컬 사용자 경로는 공개 파일 범위에서 제외합니다.

### 기준 커밋

| 커밋 | 커밋 시각 KST | 변경 |
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

### 코드 대응표

원본 경로는 비공개 저장소 기준입니다. 구간은 양 끝을 포함하며 `원본 → 공개` 순서입니다. 로컬 harness는 원본 파일 hash로 식별합니다.

| 공개 파일 | 원본 기준 · 경로 | 분류 · 구간 |
|---|---|---|
| [embedding/initial/client.ts](../../cases/cohere-lifecycle/embedding/initial/client.ts#L1-L54) | `5f71fbe` · `sveltekit/src/lib/server/providers/cohere/client.ts` | Excerpt (전체) · 1–54 → 1–54 |
| [embedding/initial/embedding.ts](../../cases/cohere-lifecycle/embedding/initial/embedding.ts#L1-L46) | `5f71fbe` · `sveltekit/src/lib/server/providers/cohere/embedding.ts` | Excerpt (전체) · 1–46 → 1–46 |
| [embedding/initial/target-fallback.ts](../../cases/cohere-lifecycle/embedding/initial/target-fallback.ts#L1-L44) | `5f71fbe` · `sveltekit/src/lib/server/embedding/target-fallback.ts` | Excerpt (전체) · 1–44 → 1–44 |
| [embedding/initial/target-fallback.test.ts](../../cases/cohere-lifecycle/embedding/initial/target-fallback.test.ts#L1-L43) | `5f71fbe` · `sveltekit/src/lib/server/embedding/target-fallback.test.ts` | Excerpt (전체) · 1–43 → 1–43 |
| [embedding/batched/embedding.ts](../../cases/cohere-lifecycle/embedding/batched/embedding.ts#L1-L51) | `dadffe3` · `sveltekit/src/lib/server/providers/cohere/embedding.ts` | Excerpt (전체) · 1–51 → 1–51 |
| [embedding/batched/embedding.test.ts](../../cases/cohere-lifecycle/embedding/batched/embedding.test.ts#L1-L40) | `dadffe3` · `sveltekit/src/lib/server/providers/cohere/embedding.test.ts` | Excerpt (전체) · 1–40 → 1–40 |
| [embedding/pre-retirement/client.test.ts](../../cases/cohere-lifecycle/embedding/pre-retirement/client.test.ts#L1-L54) | `c2efdac` · `sveltekit/src/lib/server/providers/cohere/client.test.ts` | Excerpt (전체) · 1–54 → 1–54 |
| [generation/generation-client.ts](../../cases/cohere-lifecycle/generation/generation-client.ts#L1-L35) | `b00bf59` · `sveltekit/src/lib/server/providers/cohere/generation-client.ts` | Excerpt (전체) · 1–35 → 1–35 |
| [generation/generation.ts](../../cases/cohere-lifecycle/generation/generation.ts#L1-L26) | `b00bf59` · `sveltekit/src/lib/server/providers/cohere/generation.ts` | Excerpt (전체) · 1–26 → 1–26 |
| [generation/generation.test.ts](../../cases/cohere-lifecycle/generation/generation.test.ts#L1-L63) | `b00bf59` · `sveltekit/src/lib/server/providers/cohere/generation.test.ts` | Excerpt (전체) · 1–63 → 1–63 |
| [evaluation/shared-evidence.excerpt.ts](../../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.ts#L1-L90) | `b00bf59` · `sveltekit/src/lib/server/retrieval/evaluation/run.ts` | Excerpt · 1–13 → 1–13; 15–31 → 15–31; 44–54 → 33–43; 56–101 → 45–90 |
| [evaluation/shared-evidence.excerpt.test.ts](../../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.test.ts#L1-L77) | `b00bf59` · `sveltekit/src/lib/server/retrieval/evaluation/run.test.ts` | Excerpt · 1–8 → 1–8; 10–11 → 10–11; 13–25 → 13–25; 58–69 → 27–38; 71–80 → 40–49; 82–91 → 51–60; 93–98 → 62–67; 100–108 → 69–77 |
| [evaluation/classifier-contract.excerpt.ts](../../cases/cohere-lifecycle/evaluation/classifier-contract.excerpt.ts#L1-L43) | 로컬 보존본 · `tmp/cohere-retrieval-intent-experiment/run.ts` | Excerpt · 1–1 → 1–1; 40–40 → 3–3; 42–59 → 5–22; 143–162 → 24–43 |
| [evaluation/retrieval-evaluate.ts](../../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L1-L325) | `927415e` · `sveltekit/src/lib/server/retrieval/evaluation/evaluate.ts` | Excerpt (전체) · 1–325 → 1–325 |
| [evaluation/retrieval-evaluate.test.ts](../../cases/cohere-lifecycle/evaluation/retrieval-evaluate.test.ts#L1-L162) | `927415e` · `sveltekit/src/lib/server/retrieval/evaluation/evaluate.test.ts` | Excerpt (전체) · 1–162 → 1–162 |
| [after-removal/embedding-provider-factory.ts](../../cases/cohere-lifecycle/after-removal/embedding-provider-factory.ts#L1-L24) | `e700717` · `sveltekit/src/lib/server/embedding/provider-factory.ts` | Excerpt (전체) · 1–24 → 1–24 |
| [after-removal/generation-provider-factory.ts](../../cases/cohere-lifecycle/after-removal/generation-provider-factory.ts#L1-L33) | `e700717` · `sveltekit/src/lib/server/generation/provider-factory.ts` | Excerpt (전체) · 1–33 → 1–33 |
| [after-removal/target-options.ts](../../cases/cohere-lifecycle/after-removal/target-options.ts#L1-L25) | `e700717` · `sveltekit/src/lib/server/generation/target-options.ts` | Excerpt (전체) · 1–25 → 1–25 |
| [after-removal/runtime-selection.excerpt.test.ts](../../cases/cohere-lifecycle/after-removal/runtime-selection.excerpt.test.ts#L1-L67) | `e700717` · `sveltekit/src/lib/server/config.test.ts` | Excerpt · 1–12 → 1–12; 15–15 → 14–14; 17–21 → 16–20; 40–59 → 22–41; 62–65 → 43–46; 67–73 → 48–54; 76–87 → 56–67 |
| [configuration/target-history.json](../../cases/cohere-lifecycle/configuration/target-history.json#L1-L227) | 입력 파일은 아래 구성 규칙에 명시 | Reconstructed · 선택·새 구조 |
| [evidence/observed-results.json](../../cases/cohere-lifecycle/evidence/observed-results.json#L1-L224) | 입력 파일은 아래 구성 규칙에 명시 | Reconstructed · 선택·새 구조 |

### 재구성 규칙

- `configuration/target-history.json`: 순서는 initial-fallback, cohere-only-embedding, independent-primary-fallback, groq-generation-fallback, cohere-removed입니다. 각 입력 `config/mosaic.example.json`의 generation·embedding 객체 전체를 복사하고 stage·sourceCommit·classification을 추가했습니다.
- `evidence/observed-results.json`: classifier의 시작·종료·모델·summary·호출 counter·skip 사유·retry/fallback 필드를 선택했습니다. 검색은 embedding·retrieval·questionBank·profile identity를 복사하고 supported 문항별 group hit 비율의 평균을 macro recall로 계산했습니다. Group hit은 합계, completeCases는 모든 group이 cutoff 안인 문항 수입니다. JSON은 원래 정밀도를 유지하고 본문 백분율은 소수 둘째 자리로 반올림합니다.

| 재구성 파일 · 입력 | 원본 커밋 / 식별 | 원본 SHA-256 |
|---|---|---|
| `configuration/target-history.json` · `config/mosaic.example.json` | `5f71fbece8a7d7caa28d01d655d8b02d614472cf` | `1cc124c5c25098d7461b43870d6fc7c051d5ffd3fda47d942bb3e2c3d9520fc3` |
| `configuration/target-history.json` · `config/mosaic.example.json` | `1c0f28e58c6499f1bd107b9767ef9801e59f56e5` | `f96298d785ddfd25ef905d4e6919581a933eef52683120f7a143348b3ba9cb2b` |
| `configuration/target-history.json` · `config/mosaic.example.json` | `180cc306fafc191a21ea4f6886b48c0d1913b882` | `637b4dbb6c73ef341e549dd44d0b2338dfe7bee938797bb0a6a666b54a08e63c` |
| `configuration/target-history.json` · `config/mosaic.example.json` | `0baebd9f242d88ffa15ef1953204c391ae97e623` | `6184230713d6717c9c702f39b75f4de77b7a90f1e81654922e59dc3210fb6b27` |
| `configuration/target-history.json` · `config/mosaic.example.json` | `e7007172cc7a5171948659c4f1ceb6fd65dd1332` | `fade19dc3b7d4080c23a66518e4716b9419f6af70e377e573958216bf65dee20` |
| `evidence/observed-results.json` · `tmp/cohere-retrieval-intent-experiment/results.json` | 보존 파일 | `ac60cd7bfd1514b9fcc0659b04b3cea18732eb3e3b3ab745a38101fca7bd470c` |
| `evidence/observed-results.json` · `docs/evaluation/retrieval/2026-10-15/gemini.json` | 보존 파일 | `f40fc07305a3b8542f6e82b34e494d139a85963a8c5f08490a5a0f3bda1ca85c` |
| `evidence/observed-results.json` · `docs/evaluation/retrieval/2026-10-15/cohere.json` | 보존 파일 | `2eb76f90c94d3092b2246e4e6bac342ab738f73dde284aa800cd4e3e50adc801` |
| `evidence/observed-results.json` · 복구한 full40·제거 세션 | [복구 근거 등록부](../evidence/recovered-source-register.json), HOME06-3WAY·HOME03-04-SESSION | 보고서·보관 원본 hash를 2026-10-29 대조; 당시 판정·보고 범위 유지. |

### 코드 외 근거와 접근 상태

아래 hash는 별도 채록 표기 외 이번 작업에서 원본 bytes로 계산했습니다. 기존 조사 파일의 기준 HEAD는 `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218`입니다.

| 자료 | 기준 / SHA-256 |
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

다음 원본은 집 PC에서 확보해 기존 등록 SHA-256과 모두 일치함을 확인했습니다. 메시지 위치와 추가 원본 identity는 [복구 근거 등록부](../evidence/recovered-source-register.json)에 보존합니다.

| 기존 채록 원본 | 채록 SHA-256 · 적용 범위 |
|---|---|
| `generation-model-comparison/2026-10-03-full40-3way-1/final-report.md` | `a82073631b743462c5a31051071ba994f9339b346849e29bbe171375ace7c231` · 10월 3일 generation 표 |
| `rollout-2026-10-16T20-10-29-01a14468-00a5-7ff2-8053-0e588b0c1335.jsonl.zst` | `9a167a56794bb628bd58e92581435b4efcacab3568d01e83d9dbf36ad79f9b99` · 제거 판단·완료·index 분리 보고 |

메시지 위치: 10월 1일 원본의 UTC 04:47:45.250Z·07:43:18.624Z·08:04:10.538Z·08:13:29Z·08:32:44Z는 각각 KST 13:47:45.250·16:43:18.624·17:04:10.538·17:13:29·17:32:44입니다. 직접 읽은 제거 세션은 10월 16일 UTC 12:02:47.996Z(사용자 판단), 12:19:53.762Z(완료 보고), 12:29:36.316Z(index 제외 요청), 10월 17일 13:19:07.357Z(CURRENT 보고)로 식별합니다. 10월 6일 19:17:35.774 인수인계는 UTC 10:17:35.774Z이며 기존 조사 채록을 사용했습니다.

사용자 추가 설명: 2026-10-29 이 공개 사례 준비 대화에서 사용자가 직접 제공했습니다. 성능 차이·서비스 규모·대체 가능성·운영 비용과 유료 도입을 고려할 조건을 명시한 문장을 위 판단 절에 반영했습니다.

<details>
<summary>원본·공개 파일 SHA-256</summary>

원본 hash는 전체 원본 파일 기준, 공개 hash는 Tessera 파일 기준입니다. 일부 발췌·줄바꿈 정규화·재구성의 hash 차이를 유지합니다. 재구성 입력 hash는 위 표에 있습니다.

| 공개 파일 | 원본 전체 파일 SHA-256 | 공개 파일 SHA-256 |
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
| `configuration/target-history.json` | 입력 표 참조 | `3dc01f1d86c74fc0e59d49ae8afb46562b064d1e1b36c108d9cf7e3e834ca5fe` |
| `evidence/observed-results.json` | 입력 표 참조 | `6b8b177f791e5a01a99ede6109fded3927cb29aed5c3d1820a89e44be2d11933` |

</details>

## 공개본 검증

전체 파일 Excerpt 15개는 Git 객체와 bytes·SHA-256이 일치했습니다. 일부 Excerpt 4개의 모든 원본 구간도 보존 원본과 일치하며 로컬 harness에는 명시한 LF 정규화를 적용했습니다. TypeScript 19개는 구문 분석을 통과했습니다. 재구성 JSON 2개는 문법, 설정 필드 대조, classifier counter·중앙값 확인과 검색 집계 대조를 통과했습니다.

영문·한글 사실관계, 출처 대응과 코드 링크를 대조했습니다. README·상세 기록의 로컬 링크 238개는 파일·헤딩 앵커·라인 범위를 확인했습니다. 앞선 두 사례의 본문과 코드 27개를 보존했습니다. 신규 파일의 credential·비공개 문서 본문·비공개 저장소 URL·로컬 사용자 경로를 점검했습니다. 당시 애플리케이션 테스트 실행과 provider 호출은 이번 공개 검증 범위 밖입니다.

[전체 사례로 돌아가기](../../README.ko.md)
