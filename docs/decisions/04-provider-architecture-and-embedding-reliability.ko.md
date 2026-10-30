# 04 — Provider 교체 설계와 Embedding 안정화

[전체 사례](../../README.ko.md) · [English](04-provider-architecture-and-embedding-reliability.md) · [이전: 03](03-cohere-evaluation-and-retirement.ko.md) · [다음: 05](05-cross-pc-index-portability.ko.md)

**근거 수준:** 코드 확인은 식별한 과거 소스, 당시 보고는 기록된 조건의 관측, 미확인은 해결되지 않은 사실·인과관계를 뜻합니다. 테스트는 당시 소스 근거로 수록합니다. 시각은 KST(UTC+09:00)이며 개발 사건과 근거 검증 날짜를 구분합니다.

**문서 편집:** 2026-10-30, 기준 `2fc5094`. 아래 과거 공개 검증 기록의 날짜와 범위를 유지합니다.

**개발 시기:** 2026-09-26 ~ 2026-10-17

**코드 분류:** Excerpt 37개와 Reconstructed JSON 기록 2개입니다.

**결과:** 역할별 Provider 계약·Factory·target 선택 구조로 Gemini·Cohere·Groq 변경을 수용했습니다. 문서 embedding은 chunk별 요청에서 provider 소유 batching, 현재 배치의 bounded retry와 Gemini 요청 시작 pacing으로 발전했으며 검증된 index를 publish하도록 했습니다.

## 문제와 변경 순서

사례 01의 Gemini 직접 통합 이후 모델 연산과 근거 준비·vector/답변 검증·index 저장 코드를 분리했습니다. 이후 provider 추가와 quota 실패를 거치며 그 경계를 실제로 사용했습니다. 이 사례는 구조와 복구 제어를 따라가며, provider 품질 평가와 제거 판단은 사례 03에 기록돼 있습니다.

| 개발 시각 KST / 커밋 | 변경·관측 |
|---|---|
| 9월 26일 23:10:00 · `fc509b0` | Embedding/Generation 계약·Factory·Gemini adapter·공통 호출부 분리. |
| 9월 28일 14:50:04 · `5f71fbe` | Query/document embedding 계약과 별도 target/index space의 Cohere fallback 추가. |
| 9월 28일 23:59:41 · `dadffe3` | Provider 소유 batching과 순서 기반 vector 검증 추가. |
| 9월 29일 00:32:59 · `19e634d` | Build 오류 상세 정보 유실 뒤 정규화 실패·batch 진단 보존. |
| 9월 29일 09:35:29 / 10:08:01 · `c7610ed` / `de197a5` | Build target·runtime 순서·credential binding 분리. |
| 9월 29일 10:37:00 · `5615b4c` | 현재 실패한 fallbackable HTTP 429 document batch의 bounded retry 추가. |
| 9월 30일 18:15:43 · `b00bf59` | Generation registry·옵션, 독립 runtime 선택과 명시적 shared-evidence 평가 추가. |
| 9월 30일 22:22:54 · `4125443`; 10월 3일 07:42:12 · `0baebd9` | 초기 Groq 모델 경로 제거 후 GPT-OSS를 generation fallback으로 도입. |
| 10월 16일 20:22~20:41 보고·21:32:34 커밋 · `e700717` | Batch 9/quota 관측 조사, 22초 pacing 도입과 build/retry logging 공통화. 같은 커밋에서 Cohere 통합 제거. |
| 10월 17일 artifact 22:17:33.825·보고 22:19:07.357·커밋 22:20:44 · `033e02f` | 완성 Gemini artifact 생성, CURRENT 보고와 index 인계 커밋. |

## 계약·Factory·adapter·공통 동작의 분리

9월 26일 [Embedding 계약](../../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider.ts#L1-L21)은 provider/model/dimensions를 받아 vector를 반환합니다. [Generation 계약](../../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider.ts#L1-L40)은 contents·system instruction·response schema·출력 한도를 받아 content 또는 분류된 실패를 반환합니다.

초기 [embedding Factory](../../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider-factory.ts#L1-L14)와 [generation Factory](../../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider-factory.ts#L1-L14)는 Gemini adapter를 만듭니다.

같은 커밋에서 index·검색·답변의 import를 공통 embedding·generation 모듈로 옮겼습니다.

| 책임 | 구현 경계 |
|---|---|
| Target 정의·runtime 순서 | 설정 parser와 검증된 target ID. |
| Credential 선택·adapter 생성 | Binding helper와 역할별 Factory. |
| Provider 요청·응답 변환 | Gemini·Cohere·Groq adapter. |
| 문서 분할·vector 검증·bounded retry·진행 로그 | 공통 embedding orchestration. Provider batching capability와 Gemini pacing 조건으로 개별 정책 적용. |
| Prompt·evidence 구성·답변 검증 | 공통 generation orchestration. |
| Index 호환성·publish | Embedding-space identity·candidate 검증·index 저장. |

9월 28일 [확장 embedding Factory](../../cases/embedding-batching-retry-pacing/architecture/embedding-provider-factory.ts#L1-L26)는 target에 따라 Gemini/Cohere를 선택하고 해당 target에 연결된 credential을 요구하며 target ID별 adapter 인스턴스를 재사용합니다. [발전한 요청 계약](../../cases/embedding-batching-retry-pacing/batching/provider-contract.excerpt.ts#L1-L33)은 질문과 제목·본문 문서 입력을 구분하고 선택적 batching capability를 제공합니다.

기존 target은 설정에서 선택합니다. 새 provider 도입은 계약 구현·Factory 등록·지원 옵션 검증·테스트 추가로 진행합니다. 아래 실제 추가·제거는 이 코드 경계를 따라 이뤄졌습니다.

## 문서별 요청에서 provider 소유 batch로

[Batching 이전 loop](../../cases/embedding-batching-retry-pacing/before/embeddings.ts#L31-L49)는 `embedDocuments()` 호출마다 chunk 1개를 보내고 vector를 검사합니다. 앞선 Gemini build는 chunk embedding 50개 성공 뒤 daily-quota HTTP 429를 받았다고 보고됐습니다. 문서 편입으로 커진 corpus에 대해 다음 변경은 batch로 요청 payload와 실패 단위를 조절했습니다.

[Batching 구현](../../cases/embedding-batching-retry-pacing/batching/embeddings.ts#L31-L70)은 provider의 선호 크기를 사용하고 capability가 없으면 1개로 처리하며 양의 정수 한도를 검증합니다. Gemini adapter는 프로젝트 선호 크기 32개를 선언합니다.

Cohere의 [기존 공개 adapter](../../cases/cohere-lifecycle/embedding/batched/embedding.ts#L9-L51)는 선호·최대 96개를 선언합니다. 공통 loop는 full/partial batch를 나누고 vector 개수·차원·유한값을 검사하며 입력 순서대로 vector를 연결합니다.

[Batching 테스트](../../cases/embedding-batching-retry-pacing/batching/embeddings.test.ts#L1-L98)는 full/partial batch 순서, 빈 입력, 잘못된 vector 개수·차원, 중간 batch 실패와 query 경로를 다룹니다. 부분 vector는 모든 batch가 성공할 때까지 해당 호출 내부에 보관합니다.

## 복구 정책에 앞선 실패 진단

`19e634d` 개발 보고서는 Gemini 32문서 요청 3회 성공 뒤 네 번째가 실패했고 유용한 HTTP/provider 상세 정보가 유실됐다고 기록합니다. 해당 실패의 정확한 분류는 미확인입니다. 같은 기록의 Cohere는 요청 6회를 완료해 당시 current artifact를 만들었습니다. Target별 실패 격리로 성공 결과를 보존했습니다.

[Gemini 실패 정규화](../../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.ts#L33-L133)는 typed RetryInfo·QuotaFailure를 읽고 HTTP status·허용된 provider/quota 식별자·retry delay를 보존합니다. 부가 정보 없는 HTTP 429/RESOURCE_EXHAUSTED는 neutral·fallbackable로 유지합니다. [Adapter 테스트](../../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.test.ts#L1-L173)는 해당 형태·안전한 식별자·다중 입력 순서 변환을 다룹니다.

이후 [공통 실패 helper](../../cases/embedding-batching-retry-pacing/diagnostics/failure.ts#L1-L133)는 검증한 Retry-After delay와 batch 번호·offset·size를 직렬화 진단 보고로 전달합니다. [테스트](../../cases/embedding-batching-retry-pacing/diagnostics/failure.test.ts#L1-L79)는 실패 분류, timeout/cancellation과 안전한 지연 형태를 확인합니다. Raw cause는 오류 전달 내부에 유지합니다.

## Build target·runtime 순서·credential 분리

9월 29일 변경은 build target 등록과 `runtimeTargetIds`를 먼저 분리한 뒤 credential을 runtime 우선순위와 독립적으로 연결했습니다. [선택 함수](../../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.ts#L10-L88)는 target identity를 검사하고 번호 있는 환경 target을 credential slot에 연결하며 runtime ID를 해석합니다. [Credential helper](../../cases/embedding-batching-retry-pacing/architecture/credentials.ts#L1-L29)는 지정 slot을 로드·요구합니다. [선택 테스트](../../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.test.ts#L32-L131)는 runtime 순서 변경, credential 연결 유지, 합성 세 번째 target과 중복·불완전 binding 거부를 확인합니다. 이 기준본은 완전한 연속 번호 binding을 요구했습니다.

9월 30일에는 공통 [numbered binding helper](../../cases/embedding-batching-retry-pacing/architecture/generation/credentials.ts#L31-L65)가 embedding·generation과 비연속 번호 slot을 지원했습니다. [Generation parser](../../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.ts#L36-L69)는 고유 registry ID·provider 옵션·binding slot과 알려진 target의 runtime 순서를 검사합니다. [테스트](../../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.test.ts#L46-L73)는 registry·slot·runtime 독립성, 같은 모델의 복수 옵션 profile과 선택적 평가 credential을 보존합니다. 이 두 기준본은 binding 설계의 순차적 발전을 보여줍니다.

[Reconstructed 설정 이력](../../cases/embedding-batching-retry-pacing/architecture/config-selection-history.json#L1-L176)은 초기 Gemini 필드부터 다중 target registry까지 커밋 4개의 generation·embedding 구간을 선택합니다.

이후 커밋의 runtime 선택은 사례 03의 [설정 이력](../../cases/cohere-lifecycle/configuration/target-history.json#L1-L227)으로도 확인할 수 있습니다. Credential 값은 로컬에 유지합니다.

## 현재 실패한 document batch의 retry

별도 9월 29일 보고에는 525 chunks build에서 Cohere batch 5개 성공 뒤 6/6에 HTTP 429가 발생했고 다른 설정 target도 첫 batch에서 실패했다고 기록돼 있습니다. 미완성 target은 publish하지 않았습니다. `5615b4c`에서 공통 document orchestration에 bounded retry를 추가했습니다.

[Retry loop·지연 결정](../../cases/embedding-batching-retry-pacing/retry/embeddings.ts#L69-L98)은 fallbackable인 `EmbeddingProviderError`의 HTTP 429에 최초 시도 뒤 최대 3회 retry를 허용합니다. 명시 지연은 0~60000 ms의 안전한 값이면 우선 사용합니다. 값이 없으면 15000/30000/60000 ms를 사용하고 안전 범위를 벗어난 명시 지연은 retry를 중단합니다.

다른 status와 검증 실패도 해당 작업을 종료합니다. 현재 batch를 다시 시도하는 동안 앞선 성공 batch는 메모리에 유지합니다.

[선택한 retry 테스트](../../cases/embedding-batching-retry-pacing/retry/embeddings.excerpt.test.ts#L37-L150)는 현재 batch만 복구, 지연 우선순위, 최대 4회 시도, 최종 batch 진단, 비 429·안전 범위 밖 지연 거부와 query 실패 즉시 전달을 확인합니다. 당시 보고의 정책 검증은 mock timer·HTTP 응답 기반이며 그 시점의 live retry 검증은 대기 상태였습니다.

## 같은 구조를 Generation 교체에 활용

9월 30일 [Generation target·요청 계약](../../cases/embedding-batching-retry-pacing/architecture/generation/provider.ts#L1-L72)은 target ID·credential slot·target별 옵션·native usage metadata·명시적 실행 진단을 추가합니다. [세 provider Factory](../../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.ts#L1-L36)는 Gemini·Cohere·Groq를 등록하고 target ID별 인스턴스를 재사용합니다. [Factory 테스트](../../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.test.ts#L1-L30)는 generation slot 연결과 runtime 순서 변경 후 인스턴스 유지를 확인합니다.

[공통 generation orchestrator](../../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.ts#L1-L170)는 설정 runtime ID 또는 명시적 평가 target 하나를 선택하고 공통 evidence·prompt 입력을 구성하며 Factory의 adapter를 호출한 뒤 응답 형태·인용을 검사합니다.

이 9월 30일 기준본의 runtime fallback 조건은 확인된 quota exhaustion이었습니다. [선택한 테스트](../../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.excerpt.test.ts#L27-L105)는 runtime·평가 선택과 grounding 검증 유지를 다룹니다. 이후 provider 실패 정책은 별도로 발전했으며 공개한 각 기준본은 원래 조건을 유지합니다.

Cohere의 [기존 공개 generation adapter](../../cases/cohere-lifecycle/generation/generation.ts#L6-L26)는 공통 요청을 해당 chat API로 옮깁니다.

초기 Groq 모델 경로는 `4125443`에서 제거됐고, 이후 `0baebd9`는 GPT-OSS를 fallback으로 추가하면서 Cohere를 평가 대상으로 유지했습니다. [GPT-OSS adapter](../../cases/embedding-batching-retry-pacing/architecture/groq/generation.ts#L1-L28)는 같은 계약을 strict JSON Schema·completion 한도·reasoning effort로 변환합니다. [옵션 검사](../../cases/embedding-batching-retry-pacing/architecture/generation/target-options.ts#L1-L29)와 [선택한 adapter 테스트](../../cases/embedding-batching-retry-pacing/architecture/groq/generation.excerpt.test.ts#L21-L51)가 요청·응답 변환을 확인합니다.

이 교체 커밋에서는 generation 설정·adapter가 바뀌고 embedding/index 구현은 유지됐습니다.

`e700717`의 Cohere 제거는 adapter·테스트·Factory 등록·옵션·설정·평가 선택지를 삭제했습니다.

유지된 [embedding Factory](../../cases/cohere-lifecycle/after-removal/embedding-provider-factory.ts#L12-L24)와 [generation Factory](../../cases/cohere-lifecycle/after-removal/generation-provider-factory.ts#L17-L33)에서 제거 후 Gemini embedding·Gemini/Groq generation을 확인할 수 있습니다.

공통 계약·orchestration은 남은 provider를 계속 연결했습니다.

## 10월 16일: retry에 요청 시작 pacing 추가

20:22:30.299 사용자 보고는 Gemini의 batch 9·document offset 256·size 32에서 HTTP 429/RESOURCE_EXHAUSTED와 약 59초 provider retry delay를 기록합니다. 보존 조사는 코드의 최대 4회 시도와 미확보 시도별 ledger를 구분했습니다. 20:27:38.961 사용자는 AI Studio 관측 RPM 160/100, TPM 35.21K/30K, RPD 256/1K를 추가했습니다.

| 설계 계산 | 당시 근거·범위 |
|---|---|
| Document 단위 해석 | 160=32×5, 256=32×8이 document 단위 집계 가설을 뒷받침. |
| RPM 평균 | 60×32/100=배치당 19.2초. |
| 경계 집중 | 0/20/40/60초 시작은 60초 경계에 4배치가 포함될 수 있어 20초 초과 간격 검토. |
| TPM 추정 | 35.21K peak가 같은 5배치 구간이라는 가정에서 60×(35.21K/5)/30K≈배치당 14.1초. |
| 선택 정책 | Retry를 포함한 Gemini document 요청 시작 사이 최소 22초. |

집 PC에서 해당 사용자 관측과 설계 계산이 담긴 보관 세션을 직접 읽었고 원본 해시는 기존 등록값과 일치했습니다. 정확한 quota 차감, RPM/TPM peak의 시간 대응, batch 9 실제 시도 수와 provider 대기 경과는 미확인입니다. [복구 근거 등록부](../evidence/recovered-source-register.json)에 관측·설계·구현 보고의 시각과 출처를 구분합니다.

## Build 내부 gate와 공통 retry logging

[최종 document loop](../../cases/embedding-batching-retry-pacing/pacing/embeddings.ts#L37-L94)는 build 호출마다 `lastRequestStartedAt` 하나를 유지합니다.

각 Gemini document 시도 전에 `performance.now()`로 남은 간격만 기다립니다. [Retry loop](../../cases/embedding-batching-retry-pacing/pacing/embeddings.ts#L96-L140)는 최초 시도·retry 전에 같은 gate를 호출합니다. 응답·backoff 시간도 간격에 포함하며 그 build 호출의 batch들이 상태를 공유합니다.

초기 제안은 진행 로그를 Gemini 전용 동작에 뒀습니다. 20:41:35.648 사용자는 build/retry logging은 provider 공통으로, pacing은 Gemini 전용으로 유지하도록 수정했습니다. 최종 코드는 `target.provider`에서 로그 prefix를 만들고 시도 시작·검증 완료·HTTP/kind 실패·pacing/retry 대기·소진을 기록합니다. Vector 검증 실패는 완료 실패로 기록합니다.

| 당시 fake-timer 계약 | 예상 provider 호출 시작 시각·결과 |
|---|---|
| 373 chunks·batch 32 | 0,22,…,242초에 12배치, 마지막 21개. |
| 응답 시간 5초 /25초 | 다음 요청 시작 22초 /25초. |
| Retry delay 없음 /2.5초 /59초 | Retry 시작 22초 /22초 /59초, 다음 batch는 그로부터 22초 뒤. |
| 429 반복·fallback 지연 | 0,22000,52000,112000 ms에 시작, 총 4회 시도. |
| Fixture-provider | Document batch 즉시 호출, 공통 로그 유지. |
| Query embedding | Query는 즉시 실행하고 document retry·pacing·logging은 해당 경로 밖에 유지. |

[Logging 테스트](../../cases/embedding-batching-retry-pacing/pacing/embeddings.excerpt.test.ts#L45-L113)는 Gemini·합성 미래 provider, retry 소진, 잘못된 vector와 query 로그 경계를 다룹니다. [Pacing 테스트](../../cases/embedding-batching-retry-pacing/pacing/embeddings.excerpt.test.ts#L115-L248)에 위 시작 시각 기대값이 명시돼 있습니다. 20:31:07.589 구현 checkpoint는 관련 43테스트·static check 통과와 live build 대기를 보고했습니다. 이후 완료 보고는 939테스트 통과·기존 skip 4개·check/build 통과를 기록합니다.

## Index 호환성과 실패 시 산출물 보호

[Embedding-space identity](../../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.ts#L15-L44)는 provider·model·dimensions·embedding input version을 포함합니다.

Target index fingerprint에는 corpus identity도 들어갑니다. [Identity 테스트](../../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.test.ts#L11-L79)는 generation 변경 시 index identity 유지, runtime ID·credential·우선순위 독립성과 provider·model·dimension·input·corpus 변경의 호환성 영향을 보여줍니다.

Runtime 선택과 provider 교체는 이 artifact 계약을 사용합니다.

[Index builder](../../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.ts#L23-L87)는 전체 vector를 기다리고 개수를 검사한 뒤 source/vector를 결합해 artifact를 기록·다시 읽고 해당 space의 stale artifact를 정리합니다. Target별 결과를 기록해 하나가 실패해도 다음 target을 진행할 수 있습니다. [저장 발췌](../../cases/embedding-batching-retry-pacing/publication/store.excerpt.ts#L16-L94)는 schema·identity·vector·source URL을 검사하고 임시 candidate를 기록·검증한 뒤 destination으로 rename하며 실패 candidate를 정리합니다.

[Builder 테스트](../../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.test.ts#L44-L120)와 [저장 테스트](../../cases/embedding-batching-retry-pacing/publication/store.excerpt.test.ts#L75-L116)는 candidate·write·publish 검증 실패에 따른 성공 target·기존 artifact 보존을 다룹니다.

Current artifact 검증 뒤 stale 정리를 진행합니다. Batch retry는 해당 실행 중 앞선 vector를 유지하며, 당시 build에는 영속 batch checkpoint/resume이 없어 종료된 미완성 작업은 폐기했습니다.

## Rebuild 완료 산출물 확인

사용자는 10월 16일 코드와 index 커밋을 분리했습니다. 10월 17일 22:19:07.357 사용자 보고는 rebuild 성공·CURRENT 상태를 기록합니다. 22:20:44의 `033e02f`는 새 Gemini artifact를 추가하고 이전 Gemini/Cohere artifact를 제거했습니다. [Reconstructed artifact summary](../../cases/embedding-batching-retry-pacing/evidence/published-index-summary.json#L1-L21)는 해당 커밋 JSON의 metadata·구조 검사 결과를 선택합니다.

| 직접 확인한 artifact 속성 | 값 |
|---|---|
| 생성 시각 | 2026-10-17T13:17:33.825Z /22:17:33.825 KST |
| Schema / input version | 4 /2 |
| Embedding provider/model | gemini /gemini-embedding-2 |
| Chunk 수 / 차원 | 373 /768 |
| Document-hash 항목 | 28 |
| Vector 구조 | 373개 모두 768개 유한 숫자 원소. |
| Fingerprint | `30886679a306cf2ee9a3cd10532e6a7cfb5549f85baf3f595f672c9273e4b150` |

이 artifact는 완성된 저장 vector 구조를 확인해 줍니다. 요청 시도별 wire ledger·실제 pacing 대기·quota 차감·production query 동작은 확보 자료에서 미검증으로 남습니다. Generation 3-way 결과·classifier 품질·Cohere 비용 판단은 사례 03에서 각 조건으로 기록합니다.

## 검증 수준과 원본 선택

코드·커밋 차이, 공개 테스트 assertion, 과거 tracked 개발 보고서와 최종 커밋 index를 직접 확인했습니다. 10월 16~17일 사용자 관측·구현 checkpoint는 확보한 보관 세션 원문에서 직접 확인했습니다. 실패/완료 build의 원시 ledger는 확보되지 않았습니다. 계산은 당시 가정을 함께 제시하며, 다음 날 완료는 사용자의 재빌드 성공·CURRENT 확인 보고로 구분합니다.

`e700717`의 핵심 embedding orchestration·Gemini adapter·공통 embedding 실패 구현은 해당 경로의 현재 비공개 HEAD와 일치합니다. 이번 공개는 보존 기록·원본 객체를 읽어 작성하며 모델 요청·index build·당시 애플리케이션 테스트를 실행하지 않습니다.

## 출처 추적과 공개 방식

아래 표의 원본 경로에서 `server/`는 `sveltekit/src/lib/server/`의 약칭입니다.

전체 파일 Excerpt 22개는 원본 bytes를 보존합니다. 일부 Excerpt 15개는 선택한 원본 선언·테스트 문장을 빈 줄로 연결하고 suite wrapper·무관한 구간을 제외합니다. Import·이름·합성 fixture·미공개 모듈 참조는 원래대로 유지합니다. Generation orchestrator는 target dispatch부터 최종 응답 검증까지 보존하도록 전체 원본을 포함했습니다.

Reconstructed JSON 2개는 편집한 구조를 사용합니다. 하나는 과거 generation·embedding 설정 필드를 선택하고, 다른 하나는 커밋 artifact metadata를 선택한 뒤 chunk·document-hash 수와 vector 구조 boolean을 계산합니다. 비공개 원문·vector·credential 값·로컬 사용자 경로·raw runtime/세션 전문은 제외합니다.

### 기준 커밋

| 원본 커밋 | 커밋 시각 KST | 변경 |
|---|---|---|
| `fc509b07cbc33035ae12bd6b837d93b3045d216b` | 2026-09-26 23:10:00 | Refactor AI capabilities behind provider boundaries |
| `5f71fbece8a7d7caa28d01d655d8b02d614472cf` | 2026-09-28 14:50:04 | feat: localize knowledge retrieval with embedding fallback |
| `9e96d4f87e90b505e9dfb72f842a9dc4c8560a9e` | 2026-09-28 20:14:41 | refactor(indexing): decouple index identity from runtime targets |
| `dadffe361c617c9db9840696b615b7cc3a0e8fcd` | 2026-09-28 23:59:41 | feat(embedding): batch document embeddings |
| `19e634d80cd7025a572461e639bd2db01038272a` | 2026-09-29 00:32:59 | Improve embedding failure diagnostics |
| `c7610edd7223be7fe77cd7ae9722c58c27e81690` | 2026-09-29 09:35:29 | feat(embedding): add Voyage and separate runtime priority |
| `de197a5c0c245f64034c94542e96b09f3361dd63` | 2026-09-29 10:08:01 | refactor(embedding): decouple credential bindings from runtime priority |
| `5615b4ca89e24204a3bf25ea4ab2eaa333872c73` | 2026-09-29 10:37:00 | feat(embedding): retry rate-limited document batches |
| `cb0055eb71203e3e77249a9abfcc002c4e4a963f` | 2026-09-29 11:04:53 | feat(embedding): activate Gemini and publish Cohere index |
| `b00bf595439bd71540ace4e34d6f56a803eb5719` | 2026-09-30 18:15:43 | feat(generation): add target registry and shared-evidence evaluation |
| `4125443b5de06bea988b9776a4e85d8a5d608a1b` | 2026-09-30 22:22:54 | refactor(generation): remove Groq and set output limits to 32768 |
| `0baebd9f242d88ffa15ef1953204c391ae97e623` | 2026-10-03 07:42:12 | feat(generation): replace Cohere fallback with Groq GPT-OSS |
| `5b78e06e889eb888aa8a92ccb6f9e0a05c0004e3` | 2026-10-06 20:42:47 | feat(answering): add intent-driven retrieval and provider fallback |
| `e7007172cc7a5171948659c4f1ceb6fd65dd1332` | 2026-10-16 21:32:34 | refactor: remove Cohere support and add document build pacing and logs |
| `033e02fabe868a14cd8a4a932b50fbdba9a064fa` | 2026-10-17 22:20:44 | chore(index): refresh Gemini artifact and remove retired indexes |

### 코드 대응표

원본 경로는 비공개 저장소 기준이며 구간은 양 끝을 포함한 `원본 → 공개` 순서입니다. 설정·index summary의 입력은 다음 표에 기록합니다.

| 공개 파일 | 원본 커밋 · 경로 | 분류 · 구간 |
|---|---|---|
| [before/embeddings.ts](../../cases/embedding-batching-retry-pacing/before/embeddings.ts#L1-L49) | `5f71fbe` · `server/embedding/embeddings.ts` | Excerpt (전체) · 1–49 → 1–49 |
| [batching/embeddings.ts](../../cases/embedding-batching-retry-pacing/batching/embeddings.ts#L1-L70) | `dadffe3` · `server/embedding/embeddings.ts` | Excerpt (전체) · 1–70 → 1–70 |
| [batching/embeddings.test.ts](../../cases/embedding-batching-retry-pacing/batching/embeddings.test.ts#L1-L98) | `dadffe3` · `server/embedding/embeddings.test.ts` | Excerpt (전체) · 1–98 → 1–98 |
| [batching/provider-contract.excerpt.ts](../../cases/embedding-batching-retry-pacing/batching/provider-contract.excerpt.ts#L1-L33) | `dadffe3` · `server/embedding/provider.ts` | Excerpt · 1–7 → 1–7; 9–12 → 9–12; 14–17 → 14–17; 19–22 → 19–22; 24–27 → 24–27; 29–33 → 29–33 |
| [diagnostics/gemini-embedding.ts](../../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.ts#L1-L174) | `19e634d` · `server/providers/gemini/embedding.ts` | Excerpt (전체) · 1–174 → 1–174 |
| [diagnostics/gemini-embedding.test.ts](../../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.test.ts#L1-L173) | `19e634d` · `server/providers/gemini/embedding.test.ts` | Excerpt (전체) · 1–173 → 1–173 |
| [diagnostics/failure.ts](../../cases/embedding-batching-retry-pacing/diagnostics/failure.ts#L1-L133) | `e700717` · `server/embedding/failure.ts` | Excerpt (전체) · 1–133 → 1–133 |
| [diagnostics/failure.test.ts](../../cases/embedding-batching-retry-pacing/diagnostics/failure.test.ts#L1-L79) | `e700717` · `server/embedding/failure.test.ts` | Excerpt (전체) · 1–79 → 1–79 |
| [retry/embeddings.ts](../../cases/embedding-batching-retry-pacing/retry/embeddings.ts#L1-L116) | `5615b4c` · `server/embedding/embeddings.ts` | Excerpt (전체) · 1–116 → 1–116 |
| [retry/embeddings.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/retry/embeddings.excerpt.test.ts#L1-L150) | `5615b4c` · `server/embedding/embeddings.test.ts` | Excerpt · 1–10 → 1–10; 12–14 → 12–14; 16–25 → 16–25; 27–35 → 27–35; 130–172 → 37–79; 174–194 → 81–101; 196–217 → 103–124; 219–232 → 126–139; 245–254 → 141–150 |
| [pacing/embeddings.ts](../../cases/embedding-batching-retry-pacing/pacing/embeddings.ts#L1-L158) | `e700717` · `server/embedding/embeddings.ts` | Excerpt (전체) · 1–158 → 1–158 |
| [pacing/embeddings.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/pacing/embeddings.excerpt.test.ts#L1-L248) | `e700717` · `server/embedding/embeddings.test.ts` | Excerpt · 1–11 → 1–11; 13–15 → 13–15; 17–26 → 17–26; 28–36 → 28–36; 38–39 → 38–39; 41–43 → 41–43; 46–72 → 45–71; 74–95 → 73–94; 111–118 → 96–103; 120–128 → 105–113; 352–384 → 115–147; 386–409 → 149–172; 411–441 → 174–204; 443–464 → 206–227; 466–485 → 229–248 |
| [publication/indexer.excerpt.ts](../../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.ts#L1-L87) | `e700717` · `server/indexing/indexer.ts` | Excerpt · 1–21 → 1–21; 76–111 → 23–58; 113–118 → 60–65; 120–140 → 67–87 |
| [publication/indexer.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.test.ts#L1-L120) | `e700717` · `server/indexing/indexer.test.ts` | Excerpt · 1–7 → 1–7; 9–23 → 9–23; 25–30 → 25–30; 32–42 → 32–42; 68–92 → 44–68; 126–134 → 70–78; 136–143 → 80–87; 145–153 → 89–97; 155–165 → 99–109; 167–176 → 111–120 |
| [publication/store.excerpt.ts](../../cases/embedding-batching-retry-pacing/publication/store.excerpt.ts#L1-L94) | `e700717` · `server/indexing/store.ts` | Excerpt · 1–14 → 1–14; 56–97 → 16–57; 99–101 → 59–61; 103–105 → 63–65; 107–121 → 67–81; 123–134 → 83–94 |
| [publication/store.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/publication/store.excerpt.test.ts#L1-L116) | `e700717` · `server/indexing/store.test.ts` | Excerpt · 1–20 → 1–20; 22–28 → 22–28; 30–41 → 30–41; 43–44 → 43–44; 46–62 → 46–62; 64–69 → 64–69; 71–73 → 71–73; 99–105 → 75–81; 216–230 → 83–97; 232–249 → 99–116 |
| [architecture/initial/embedding/provider.ts](../../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider.ts#L1-L21) | `fc509b0` · `server/embedding/provider.ts` | Excerpt (전체) · 1–21 → 1–21 |
| [architecture/initial/embedding/provider-factory.ts](../../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider-factory.ts#L1-L14) | `fc509b0` · `server/embedding/provider-factory.ts` | Excerpt (전체) · 1–14 → 1–14 |
| [architecture/initial/generation/provider.ts](../../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider.ts#L1-L40) | `fc509b0` · `server/generation/provider.ts` | Excerpt (전체) · 1–40 → 1–40 |
| [architecture/initial/generation/provider-factory.ts](../../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider-factory.ts#L1-L14) | `fc509b0` · `server/generation/provider-factory.ts` | Excerpt (전체) · 1–14 → 1–14 |
| [architecture/embedding-provider-factory.ts](../../cases/embedding-batching-retry-pacing/architecture/embedding-provider-factory.ts#L1-L26) | `5f71fbe` · `server/embedding/provider-factory.ts` | Excerpt (전체) · 1–26 → 1–26 |
| [architecture/credentials.ts](../../cases/embedding-batching-retry-pacing/architecture/credentials.ts#L1-L29) | `de197a5` · `server/credentials.ts` | Excerpt (전체) · 1–29 → 1–29 |
| [architecture/embedding-selection.excerpt.ts](../../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.ts#L1-L106) | `de197a5` · `server/config.ts` | Excerpt · 1–6 → 1–6; 8–8 → 8–8; 27–55 → 10–38; 57–89 → 40–72; 91–105 → 74–88; 119–122 → 90–93; 124–129 → 95–100; 131–135 → 102–106 |
| [architecture/embedding-selection.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.test.ts#L1-L131) | `de197a5` · `server/config.test.ts` | Excerpt · 1–9 → 1–9; 11–14 → 11–14; 16–30 → 16–30; 47–62 → 32–47; 64–77 → 49–62; 79–99 → 64–84; 101–116 → 86–101; 118–123 → 103–108; 125–146 → 110–131 |
| [architecture/generation/provider.ts](../../cases/embedding-batching-retry-pacing/architecture/generation/provider.ts#L1-L72) | `b00bf59` · `server/generation/provider.ts` | Excerpt (전체) · 1–72 → 1–72 |
| [architecture/generation/provider-factory.ts](../../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.ts#L1-L36) | `b00bf59` · `server/generation/provider-factory.ts` | Excerpt (전체) · 1–36 → 1–36 |
| [architecture/generation/provider-factory.test.ts](../../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.test.ts#L1-L30) | `b00bf59` · `server/generation/provider-factory.test.ts` | Excerpt (전체) · 1–30 → 1–30 |
| [architecture/generation/credentials.ts](../../cases/embedding-batching-retry-pacing/architecture/generation/credentials.ts#L1-L65) | `b00bf59` · `server/credentials.ts` | Excerpt (전체) · 1–65 → 1–65 |
| [architecture/generation-selection.excerpt.ts](../../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.ts#L1-L69) | `b00bf59` · `server/config.ts` | Excerpt · 1–7 → 1–7; 9–16 → 9–16; 98–101 → 18–21; 103–108 → 23–28; 110–114 → 30–34; 116–149 → 36–69 |
| [architecture/generation-selection.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.test.ts#L1-L73) | `b00bf59` · `server/config.test.ts` | Excerpt · 1–10 → 1–10; 12–17 → 12–17; 19–33 → 19–33; 53–58 → 35–40; 61–63 → 42–44; 82–98 → 46–62; 112–121 → 64–73 |
| [architecture/generation/orchestrator.ts](../../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.ts#L1-L170) | `b00bf59` · `server/generation/orchestrator.ts` | Excerpt (전체) · 1–170 → 1–170 |
| [architecture/generation/orchestrator.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.excerpt.test.ts#L1-L105) | `b00bf59` · `server/generation/orchestrator.test.ts` | Excerpt · 1–7 → 1–7; 9–13 → 9–13; 15–18 → 15–18; 20–22 → 20–22; 24–25 → 24–25; 28–38 → 27–37; 40–46 → 39–45; 48–78 → 47–77; 80–97 → 79–96; 120–127 → 98–105 |
| [architecture/generation/target-options.ts](../../cases/embedding-batching-retry-pacing/architecture/generation/target-options.ts#L1-L29) | `0baebd9` · `server/generation/target-options.ts` | Excerpt (전체) · 1–29 → 1–29 |
| [architecture/groq/generation.ts](../../cases/embedding-batching-retry-pacing/architecture/groq/generation.ts#L1-L28) | `0baebd9` · `server/providers/groq/generation.ts` | Excerpt (전체) · 1–28 → 1–28 |
| [architecture/groq/generation.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/architecture/groq/generation.excerpt.test.ts#L1-L51) | `0baebd9` · `server/providers/groq/generation.test.ts` | Excerpt · 1–9 → 1–9; 11–19 → 11–19; 22–39 → 21–38; 54–65 → 40–51 |
| [architecture/embedding-space.excerpt.ts](../../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.ts#L1-L44) | `9e96d4f` · `server/indexing/corpus.ts` | Excerpt · 1–6 → 1–6; 8–9 → 8–9; 11–13 → 11–13; 21–26 → 15–20; 28–38 → 22–32; 40–50 → 34–44 |
| [architecture/embedding-space.excerpt.test.ts](../../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.test.ts#L1-L79) | `9e96d4f` · `server/indexing/corpus.test.ts` | Excerpt · 1–9 → 1–9; 173–184 → 11–22; 186–201 → 24–39; 203–217 → 41–55; 219–225 → 57–63; 227–233 → 65–71; 235–241 → 73–79 |
| [architecture/config-selection-history.json](../../cases/embedding-batching-retry-pacing/architecture/config-selection-history.json#L1-L176) | 선택·계산한 입력은 아래 표 참조 | Reconstructed · 편집 구조 |
| [evidence/published-index-summary.json](../../cases/embedding-batching-retry-pacing/evidence/published-index-summary.json#L1-L21) | 선택·계산한 입력은 아래 표 참조 | Reconstructed · 편집 구조 |

### 재구성 규칙과 입력

- `architecture/config-selection-history.json`: 커밋별 `config/mosaic.example.json`의 generation·embedding 객체 전체를 복사하고 stage·sourceCommit·classification을 추가했습니다. 순서는 initial-contracts → independent-build-and-runtime → credential-binding-separated → generation-registry입니다.
- `evidence/published-index-summary.json`: 원본의 schemaVersion·createdAt·fingerprint·corpusFingerprint·embeddingProvider·embeddingModel·embeddingInputVersion·vectorDimension을 선택했습니다. Chunk 수와 documentHashes 항목 수를 세고, 모든 vector 길이·숫자·유한값 조건을 검사한 boolean을 기록했습니다. Source commit·원본 SHA-256·classification은 추적 필드입니다.

| 공개 재구성 · 입력 | 원본 커밋 | 원본 SHA-256 |
|---|---|---|
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `fc509b07cbc33035ae12bd6b837d93b3045d216b` | `b1321cdcb932d14b391b8303f72ce1ba9046228f479cf944f887e9d59e5ea6df` |
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `c7610edd7223be7fe77cd7ae9722c58c27e81690` | `4f62fc99f58b0dcfaec117b9ca5243bba6fb22297007d065c643258d87cdb5bd` |
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `de197a5c0c245f64034c94542e96b09f3361dd63` | `dbd3763070c18ba8dded16693266660d72b6d3e59d54a5199fe7d9a3d7af83d3` |
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `b00bf595439bd71540ace4e34d6f56a803eb5719` | `19976e438024e926ccdf1453c7d4145d9bdf1f52677b0fad4a1aa798f4061488` |
| `evidence/published-index-summary.json` · `indexes/provider=gemini/model=gemini-embedding-2/dimensions=768/input=v2/30886679a306cf2ee9a3cd10532e6a7cfb5549f85baf3f595f672c9273e4b150.json` | `033e02fabe868a14cd8a4a932b50fbdba9a064fa` | `a0d705c70fbba84886ddae0a64c3811f69bdca4927290ae6282f69eb4c3640f6` |

### 개발 보고·연구 기록

다음 hash는 이번 공개 작업에서 전체 원본 bytes로 계산했습니다. 보존 연구 기록의 기준 HEAD는 `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218`입니다.

| 원본 경로 | 기준 커밋 | 원본 SHA-256 |
|---|---|---|
| `docs/development-status.md` | `fc509b07cbc33035ae12bd6b837d93b3045d216b` | `bf86fc39c7c6fd9b67605c80271bedbd969db7d5529d211b8874277aeaad5200` |
| `docs/development-status.md` | `5f71fbece8a7d7caa28d01d655d8b02d614472cf` | `cd391e419000613362ac2c09cc48db13304dee65cfecad3cdd50b0bfc03423d5` |
| `docs/development-status.md` | `19e634d80cd7025a572461e639bd2db01038272a` | `58d31efbf3bca688989431906a88700de41f63156d30e202704bcb231db7080c` |
| `docs/development-status.md` | `5615b4ca89e24204a3bf25ea4ab2eaa333872c73` | `8b7ab55609094b52027b08b431d286741dfc8e4ae74cacde851b24ca088bacdd` |
| `docs/development-status.md` | `e7007172cc7a5171948659c4f1ceb6fd65dd1332` | `b557e0b331e1e7a6b3eec2d16e220ccaf2a2dadb28b4891eb3920ed7aa724cf5` |
| `docs/research/synethos-development-history.md` | `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218` | `31c98a7c6b2fe222ca9b116130a857c316008b8cb79550425aba50e491ebd2a3` |
| `docs/research/synethos-evidence-register.md` | `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218` | `6f173ba83687e68daaa115623404e159af8efa37fc454c0e42559e761303bdf7` |
| `docs/research/decision-candidates.md` | `3a6e2e477fa5a66fe67656b802c4bf9bdaf59218` | `6a1a2b0c4ab1dc25ee94a253f96c987d9d6d8ec6cf80d2f075b2be77fa1b06cc` |

보관 세션 식별자는 `rollout-2026-10-16T20-10-29-01a14468-00a5-7ff2-8053-0e588b0c1335.jsonl.zst`이며, 집 PC 원본의 SHA-256 `9a167a56794bb628bd58e92581435b4efcacab3568d01e83d9dbf36ad79f9b99`가 기존 채록값과 일치했습니다. 다음 메시지를 원문에서 직접 대조했으며 [복구 근거 등록부](../evidence/recovered-source-register.json)에 메시지별 text hash를 추가했습니다.

| UTC 메시지 시각 | KST | 기록 |
|---|---|---|
| 2026-10-16T11:22:30.299Z | 20:22:30.299 | 사용자 batch9 실패 보고·재실행 금지 요청 |
| 2026-10-16T11:25:31.863Z | 20:25:31.863 | 조사: 실제 시도·대기 미확인 |
| 2026-10-16T11:27:38.961Z | 20:27:38.961 | 사용자 quota 화면 관측 |
| 2026-10-16T11:28:39.623Z | 20:28:39.623 | 22초 설계 계산·가정 |
| 2026-10-16T11:31:07.589Z | 20:31:07.589 | 구현 보고: 43테스트·check, live build 대기 |
| 2026-10-16T11:41:35.648Z | 20:41:35.648 | 사용자: 공통 logging·provider별 pacing |
| 2026-10-16T12:19:53.762Z | 21:19:53.762 | 완료 보고: 939테스트·기존 skip4·check/build, index stale |
| 2026-10-16T12:29:36.316Z | 21:29:36.316 | 사용자: index 제외·코드 우선 커밋 |
| 2026-10-17T13:19:07.357Z | 22:19:07.357 | 사용자: rebuild 성공·CURRENT, index 별도 커밋 요청 |

Artifact의 `createdAt`은 별도 저장 metadata입니다. 요청/보고·커밋 시각과 함께 기록했으며 실패/완료 build의 원시 시도 ledger는 미확보입니다. 다른 날짜의 application build 로그는 해당 실행 근거에 합치지 않았습니다.

<details>
<summary>원본·공개 파일 SHA-256</summary>

원본 hash는 전체 원본 파일 기준, 공개 hash는 Tessera 파일 기준입니다. 재구성 입력 hash는 위 표에 있습니다.

| 공개 파일 | 원본 전체 파일 SHA-256 | 공개 파일 SHA-256 |
|---|---|---|
| `before/embeddings.ts` | `b18a61d6a09dca484e4a247d3899956796e2a65f492596c374a287679352bfc2` | `b18a61d6a09dca484e4a247d3899956796e2a65f492596c374a287679352bfc2` |
| `batching/embeddings.ts` | `7f431702470dde83babc1fc13678ac83aa6278c5075bce6045029f6fbdd471a9` | `7f431702470dde83babc1fc13678ac83aa6278c5075bce6045029f6fbdd471a9` |
| `batching/embeddings.test.ts` | `02e9d7ff6de9f4011941d88ec95ef8a2956ddaa138a94cb65144d96cdfe521bf` | `02e9d7ff6de9f4011941d88ec95ef8a2956ddaa138a94cb65144d96cdfe521bf` |
| `batching/provider-contract.excerpt.ts` | `db08855810a023ea3524800bf442355e93297e2ecef4ac6284c934cdd25688cd` | `8ce2105a5d56a1662525e639b2a621b35ebbf7854969153428b5fdfa69b26c7e` |
| `diagnostics/gemini-embedding.ts` | `d8c890eaa7fc688e83695c8fd01ff925fcb212b3924d46cddd314c74f2011abd` | `d8c890eaa7fc688e83695c8fd01ff925fcb212b3924d46cddd314c74f2011abd` |
| `diagnostics/gemini-embedding.test.ts` | `2ffcbe47eba996bfacdb6d250e3be6a44208d824095d5ea3e3265441ff24992a` | `2ffcbe47eba996bfacdb6d250e3be6a44208d824095d5ea3e3265441ff24992a` |
| `diagnostics/failure.ts` | `c83a5ba51091e48ffbe497023043045fadff869d46a9682e4928da82cee0ea22` | `c83a5ba51091e48ffbe497023043045fadff869d46a9682e4928da82cee0ea22` |
| `diagnostics/failure.test.ts` | `a71c88aa3e5edfed06c5025dd8683bd10b7a5dc3e5f35f9b9f51a439b0da197d` | `a71c88aa3e5edfed06c5025dd8683bd10b7a5dc3e5f35f9b9f51a439b0da197d` |
| `retry/embeddings.ts` | `c6ae7241cc74dfbf0845c9c0790339660f1b59d6777308077005fd92411c4c2e` | `c6ae7241cc74dfbf0845c9c0790339660f1b59d6777308077005fd92411c4c2e` |
| `retry/embeddings.excerpt.test.ts` | `4581c27e2a33c1609061b4d372040ec6cbda84c090b859dd597505442cff02f5` | `6a8f5e5061d6b438db4ec2cfc90773b8128b458e52e8cb7297853c5e06fbe47d` |
| `pacing/embeddings.ts` | `666e51e9891c65f8105607640d77afd69eac300457aa19e6451fba322b97d905` | `666e51e9891c65f8105607640d77afd69eac300457aa19e6451fba322b97d905` |
| `pacing/embeddings.excerpt.test.ts` | `fb16a38313d8302f6b4a89510831057f4ac343d9dd0a3c4113f743fba8b8238b` | `ee8a4763fb9a7f2fc343472bc4c73eeee275edabda52e96a70244aa515c06275` |
| `publication/indexer.excerpt.ts` | `d60c5a48c89d4e88107979dbb82bdfd79a17ff59fff48f48622ff9583cc3ebc3` | `d1b14330191eb52fd8b0e9b45d6d77c78b0f4cef0a3a336a8c92879f307515b9` |
| `publication/indexer.excerpt.test.ts` | `7d22260691e6e0c5b18bcc0f7647673304f1846fa9d4fc3bb8bff0f93d7fc9c0` | `9215375f57a3073f28903f8911dab463103a67f1b3afb6e746aeb7704d3b1f04` |
| `publication/store.excerpt.ts` | `2737de9c8731f6791c9dcc4ca1055cc4097c29525aa9fa4cdaa02e427b21d8e4` | `1da6c9bad15933d4fb6bdc2de136219be43b3283f4640b958cb7fa9e382f442a` |
| `publication/store.excerpt.test.ts` | `39f0976c4f5fd0846111c4794bd614966574e3196dcb26a5b99f81ae70ab9ef8` | `25cb74e041dec1b510ce9ff36d71389d0168f71a26844ed636051ecd7289b214` |
| `architecture/initial/embedding/provider.ts` | `889096cf3463b46679c5272d6d541023125073a36d7e1f96fe8250a3b7964c3a` | `889096cf3463b46679c5272d6d541023125073a36d7e1f96fe8250a3b7964c3a` |
| `architecture/initial/embedding/provider-factory.ts` | `0edbe7530f859410cec8e97b298103f8c12ae289be7180e5d32d46e21f335847` | `0edbe7530f859410cec8e97b298103f8c12ae289be7180e5d32d46e21f335847` |
| `architecture/initial/generation/provider.ts` | `808b885d6fb512d9fba479ff5ffe3a981c9999dad5739db6764ff9b997752a3e` | `808b885d6fb512d9fba479ff5ffe3a981c9999dad5739db6764ff9b997752a3e` |
| `architecture/initial/generation/provider-factory.ts` | `d71a75a0827af954b0c7f5ba6ef7f0d0d8b371815753cef3ad608540a28088e9` | `d71a75a0827af954b0c7f5ba6ef7f0d0d8b371815753cef3ad608540a28088e9` |
| `architecture/embedding-provider-factory.ts` | `5fea6628a1b81713d2c4d46712944e6a5e12937402b0d2425f1932c259cb0722` | `5fea6628a1b81713d2c4d46712944e6a5e12937402b0d2425f1932c259cb0722` |
| `architecture/credentials.ts` | `70641a5750053e84ad21815c46eeb62894a8abe5498dfb3cdfb1f05a48605f31` | `70641a5750053e84ad21815c46eeb62894a8abe5498dfb3cdfb1f05a48605f31` |
| `architecture/embedding-selection.excerpt.ts` | `d6890ead1d23084b98aa6ec3966966d4c87acef49d5ffb1eb1f8bae1490bc392` | `4ff21d2e1532bbd6d07a22e93dd4cb53e42b4def6680799928bfed011b906ac8` |
| `architecture/embedding-selection.excerpt.test.ts` | `74f25260035987842fb27c9971792c33e3b2e1a0fb1ba12aea210115a48d1605` | `e04e3088121bba5b2611c82fb9cd7f803fd74041b44996c8842d78f6c99c736a` |
| `architecture/generation/provider.ts` | `68b0911512ab1f6f69293e3da7cb7fd4663e5bc247b91f8adf1cc0fb319d3fb9` | `68b0911512ab1f6f69293e3da7cb7fd4663e5bc247b91f8adf1cc0fb319d3fb9` |
| `architecture/generation/provider-factory.ts` | `cb2ba7c1d97b1a1b4b4ca0c0a0cf7c8d4b021442505f9aa80256130244088a7d` | `cb2ba7c1d97b1a1b4b4ca0c0a0cf7c8d4b021442505f9aa80256130244088a7d` |
| `architecture/generation/provider-factory.test.ts` | `0baf359b9213106c7a7a7dfdaf53a8d5d5836320c3677c74657f7b0c24255d3d` | `0baf359b9213106c7a7a7dfdaf53a8d5d5836320c3677c74657f7b0c24255d3d` |
| `architecture/generation/credentials.ts` | `096f3a7562e59060bd856aa6ee4710ecf10c3334411df10ef1dfc49e0061e63f` | `096f3a7562e59060bd856aa6ee4710ecf10c3334411df10ef1dfc49e0061e63f` |
| `architecture/generation-selection.excerpt.ts` | `cdb12c9f0097db6538f39370973668fe2228413a886d6103d6d2c6959afc4f27` | `4db63cbf061d8ee543fcb3f8f25e0002524e55951bd56671dca535bd6db7ae88` |
| `architecture/generation-selection.excerpt.test.ts` | `e6783be754407e23c82e4050e86bbb28b639c4387f823c372191fbf5d0fe374c` | `27923c9e7b55437708f2b48ed3f8cff0f83754a17c194b67645a7ace3602bf12` |
| `architecture/generation/orchestrator.ts` | `c8b18306e68f1d12ee705ff49bfcbd0d4bcf5d3028fa9b7866bba3e98fa8337c` | `c8b18306e68f1d12ee705ff49bfcbd0d4bcf5d3028fa9b7866bba3e98fa8337c` |
| `architecture/generation/orchestrator.excerpt.test.ts` | `a51babca786bb05a66b96ffcaf4ccb144ba849a023eab5970d047a2eedf8f326` | `1d24920a658fbe0a99ba5127ff6570da4545048cc969a4e9f10ce59971bc6d56` |
| `architecture/generation/target-options.ts` | `264e26068fe613a1a4bbec58480a6c884afce9cb0f9d147d2feeef61116ff454` | `264e26068fe613a1a4bbec58480a6c884afce9cb0f9d147d2feeef61116ff454` |
| `architecture/groq/generation.ts` | `d859e5eeabd81f943645013b80a94b13c48cfaee0a2a545b02f89e02b5878df6` | `d859e5eeabd81f943645013b80a94b13c48cfaee0a2a545b02f89e02b5878df6` |
| `architecture/groq/generation.excerpt.test.ts` | `8274403ede21cf588856bdc5de15116b73341dda3c3af9f8ea59b091e26c79fa` | `9f27bceec5d46000b7ffd33646019c719925e4ce780bdec2bdd1db1b138c31e3` |
| `architecture/embedding-space.excerpt.ts` | `808b33161d3d6d254c5987d2845d81543a45be39126153a018fa257a6b8ca0f4` | `4ef17cf842bd211dec79420605410a6c0dca0b7f2d5774de20bef7e803f3c997` |
| `architecture/embedding-space.excerpt.test.ts` | `3f67e3e7a5f9641d2ab4bead05aebf0ac705e7f7d0e3690c56c1eb3951871e6e` | `b1b65537beb4266e29caf657a54b0429c5649965441015463a52b0af74398b15` |
| `architecture/config-selection-history.json` | 입력 표 참조 | `95bdfa3d3fd7e9bae1176dbb28bbc41039919e55ae4d13d0e8ee544d47e6484d` |
| `evidence/published-index-summary.json` | 입력 표 참조 | `12e6a4002ca8ed47b9749f0ece819444fcc1d61a0f9812dcec30f2f152a9cebb` |

</details>

## 공개본 검증

전체 파일 Excerpt 22개는 Git 객체와 bytes·SHA-256이 일치했습니다. 일부 Excerpt 15개의 선택 구간은 원본 문장과 일치했고 TypeScript 37개는 구문 분석을 통과했습니다. 재구성 JSON 2개는 문법·과거 설정 필드 대조·입력 hash 확인과 커밋 index의 metadata/vector 구조 검사를 통과했습니다. 기록된 RPM/TPM 계산도 명시한 가정과 함께 확인했습니다.

영문·한글 사실관계·출처 대응·코드 대상을 대조했습니다. README·상세 기록의 로컬 링크 412개는 파일·헤딩 앵커·라인 범위를 확인했습니다. 앞선 세 사례의 본문과 공개 파일 48개를 보존했습니다. 신규 파일의 credential 값·비공개 문서 본문·비공개 저장소 URL·로컬 사용자 경로를 점검했습니다. 검증은 원본 확인과 로컬 parsing·계산으로 진행했으며 당시 애플리케이션 테스트·API 호출·index build는 이번 공개 실행 범위 밖입니다.

[전체 사례로 돌아가기](../../README.ko.md)
