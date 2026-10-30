# 06 — Model Selection: Quality and Availability

[전체 사례](../../README.ko.md) · [English](06-model-selection-quality-and-availability.md) · [이전: 05](05-cross-pc-index-portability.ko.md) · [다음: 07](07-knowledge-index-consistency-and-recoverable-deployment.ko.md)

**근거 수준:** 코드 확인은 식별한 과거 소스, 당시 보고는 기록된 조건의 관측, 미확인은 해결되지 않은 사실·인과관계를 뜻합니다. 테스트는 당시 소스 근거로 수록합니다. 시각은 KST(UTC+09:00)이며 개발 사건과 근거 검증 날짜를 구분합니다.

**문서 편집:** 2026-10-30, 기준 `2fc5094`. 아래 과거 공개 검증 기록의 날짜와 범위를 유지합니다.

**개발 기간:** 2026-09-26 ~ 2026-10-16

**코드 분류:** Excerpt — 소스·테스트 15개; Reconstructed — 설정·근거 기록 5개.

**결과:** Generation은 Gemini 3.5 Flash Lite primary와 Groq GPT-OSS 120B fallback으로 정리됐다. 과제별 품질·관측된 가용성·무료 티어 용량·서비스 운영 범위를 함께 고려한 선택이다. 후보 도입, 로컬 실험, 커밋된 runtime 선택은 아래에서 각각의 시점으로 기록한다.

## 9월 26일: 모델 선택을 가용성 정책으로 구현

Gemini API 전환 커밋 9a3df61의 최초 설정은 gemini-3.8-flash였다. 14:14:51의 2e02e71은 gemini-3.5-flash-lite 다음 gemini-3.1-flash-lite를 사용하는 구성으로 바꿨고 출력 상한은 1200이었다. [설정 이력](../../cases/model-selection-quality-availability/evidence/model-selection-history.json#L1-L242)에 이후 모델 identity·옵션·runtime 순서를 보존했다.

**사용자 제공 ChatGPT 대화 검색에서 확인한 최초 전환 이유:** 9월 26일 13:39 KST경 사용자는 무료 티어 하루 20회 한도가 공개 서비스 운영에 부적합하다고 판단했다. 13:43경 Gemini 3.5 Flash-Lite 전환을 요청했고, 13:50경 3.5 Flash-Lite 실제 테스트 5건 성공이 보고됐다. 이 항목은 검색 보고 수준으로 보존하며 원본 대화 URL·전문은 확보되지 않았다. [보충 근거 기록](../../cases/model-selection-quality-availability/evidence/developer-clarification-20261029.json#L1-L184)에 세 시각의 근사성과 출처 범위를 표시했다. 14:14:51 설정 커밋에서 전환된 구성을 확인한다. 10월 3일의 3.8 재평가는 이후 별도 사건이다.

[초기 Generation 구현](../../cases/model-selection-quality-availability/baseline/generation.ts#L18-L126)은 prompt를 한 번 구성하고 설정된 모델을 순서대로 방문하며 확인된 quota exhaustion에서만 다음 모델로 진행했다. 같은 모델의 HTTP 503 retry는 SDK 요청 설정이 맡았다.

당시 설정은 최대 4 attempts와 코드에 남은 backoff 값이다. [실패 분류](../../cases/model-selection-quality-availability/baseline/generation-fallback.ts#L23-L70)는 기계 판독 가능한 quota 근거를 확인하고 다른 429를 구분했다. [분류 테스트](../../cases/model-selection-quality-availability/baseline/generation-fallback.test.ts#L1-L52)와 [Generation 테스트](../../cases/model-selection-quality-availability/baseline/generation.test.ts#L37-L162)는 응답 검증·안전한 진단을 포함한 초기 조건을 보존한다.

## 9월 30일~10월 2일: 명시적 후보 비교와 runtime 역할 선택

9월 30일 18:15:43의 b00bf59는 Gemini 3.5·Gemini 3.1·Cohere command-a-plus-05-2026·Groq qwen/qwen3.8-27b를 별도 target으로 등록했다. Runtime은 Gemini 3.5→3.1을 유지했다.

Shared-evidence 비교는 target을 명시해 실행했으므로 후보 등록과 runtime 역할 지정은 분리됐다. [사례 03의 비교 구현](../../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.ts#L45-L90)과 [사례 04의 registry/runtime 선택](../../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.ts#L36-L69)에 해당한다.

보존된 연구에는 Groq Qwen Preview의 output/token-limit 429와 structured JSON 400 실패가 보고되어 있다. 22:22:54의 4125443은 해당 target과 adapter 경로를 제거하고 Gemini/Cohere 출력 상한을 32768로 올렸다. 현재 근거에서는 개별 모델의 실패 보고와 커밋된 제거를 확인하며, 정확한 원본 attempt ledger는 확보되지 않았다.

10월 1일 고정 context의 질문 대상 실험에서는 Cohere의 대상 유지가 우세했다. 보고된 두 단계 합계는 Cohere 54/54·Gemini 42/54였다. 후속 로컬 Cohere-only 실행에도 이름 표기·grounding/citation 문제가 남았다. [사례 03의 대상 유지 기록](03-cohere-evaluation-and-retirement.ko.md#10월-1일-질문-대상과-record-화자)은 prompt revision·표본·로컬 routing 적용 범위를 보존한다.

이 관측은 후보 검토의 배경이며, 10월 2일 02:37:05의 180cc30에서 Gemini 3.5 primary·Cohere Command A+ fallback 설정을 확인한다.

## 10월 3일: 품질 이점이 있어도 운영하기 어려웠던 Gemini 3.8

**관찰된 상황과 사용자 판단 — 10월 29일 직접 보충:** 운영 판단에 사용한 사용량 이력은 무료 티어 하루 20회 한도에서 정상 응답 3회·HTTP 503 실패 17회였으며, 이후 일일 한도 소진을 나타내는 HTTP 429가 발생했다.

| 운영 관측 | 결과 |
|---|---|
| 무료 티어 일일 호출 한도 | 20회 |
| 정상 응답 | 3회 |
| HTTP 503 실패 | 17회 |
| 이후 응답 | 일일 quota 소진을 나타내는 HTTP 429 |

**복구한 원본으로 확인한 요청 대응:** 집 PC의 직전 승인 실행과 후속 재시도 실행에서 ledger·요청 본문·provider 응답 원본을 직접 대조했습니다. 세 핵심 보고서·결정 파일의 해시는 기존 등록값과 일치했습니다. [원본 집계와 요청 원장](../../cases/model-selection-quality-availability/evidence/october03-reported-results.json)은 아래 대응과 24개 전체 요청의 시각·본문 hash·응답 hash를 보존합니다.

| Gemini 3.8 실행 범위 | 요청 | 성공 | HTTP 503 | HTTP 429 |
|---|---:|---:|---:|---:|
| 직전 승인 실행 | 6 | 1 | 5 | 0 |
| 후속 재시도 실행 | 15 | 2 | 12 | 1 |
| 429 직전까지 합계 | 20 | 3 | 17 | 0 |

직전 실행의 Gemini 3.5 성공 1회와 후속 실행의 성공 2회는 위 3.8 사용량에서 분리했습니다. 알려진 3.8의 21번째 요청이 반환한 실제 오류는 HTTP 429/RESOURCE_EXHAUSTED, quotaId GenerateRequestsPerDayPerProjectPerModel-FreeTier, quotaValue 20을 명시했습니다. 따라서 기존에 별도 이력으로 둔 20회와 재시도 실행의 요청별 대응을 확인했습니다.

사용자가 실패 요청도 일일 budget을 소모했다고 판단한 근거는 이 관측과 한도 소진입니다. Provider 측 개별 차감·다른 계정 활동·금전 청구는 확보된 기록으로 직접 확인되지 않았습니다.

사용자는 이 결과를 통해 503 실패 요청도 호출 한도에 포함된다고 판단했다. 정상 응답을 거의 얻지 못한 채 하루 사용량 대부분이 소진됐기 때문이다. 하루 20회라는 한도 자체도 Synethos 운영에 부족했고, 그마저 대부분 실패로 소진되는 상황에서는 Gemini 3.8을 운영 모델로 선택할 이유가 없었다.

사용자는 HTTP 503은 재시도하되 일일 한도 429가 발생하면 모델을 포기한다는 중단 조건을 직접 정했다. 실제 결과가 이 조건에 도달해 3.8을 Synethos 운영 후보에서 제외했다. 일부 질문에서 관찰한 품질 이점은 평가 결과로 유지했다.

사용자는 유료 전환으로 가용성 문제가 해결될지도 검토했다. 사용자 제공 ChatGPT 과거 대화 재검색 기록의 03:16:17 KST경 설명에는 무료 프로젝트와 유료 프로젝트 양쪽의 유사한 503 사례가 포함됐다. 사용자는 자신의 반복 실패와 이 정보를 함께 보고, 과금으로 안정적인 응답을 기대할 근거가 부족하다고 판단했다. 추가 비용을 들여 3.8을 채택할 이유가 없다는 결론이었다.

**개별 품질 비교 실험:** 재평가는 3.5가 놓친 근거를 3.8이 더 잘 사용하는지 확인하려는 목적이었다. 질문·근거·순서·citation·prompt·schema를 고정하고 4문항을 계획했다. 두 pair가 완료됐다.

| 문항 | 당시 품질 관측 |
|---|---|
| QB18 | 제공된 OCR 거주지·기간 파싱 설명을 포함해 3.8이 명확히 우세했다. |
| QB20 | 두 응답은 동등하다고 판정했다. |

[당시 보고의 재구성](../../cases/model-selection-quality-availability/evidence/october03-reported-results.json#L1-L4095)에 해당 실험의 집계를 보존했다. 3.8은 15회 요청 중 성공 2·HTTP 503 12·HTTP 429 1이었다. 3.5의 성공 2회를 포함한 전체 요청은 17회다. QB18에서 3.8 성공까지 742.410초가 걸렸고 성공 요청 자체는 16.564초였다. QB20의 3.8 성공 요청은 17.222초였다.

03:20:37 사용자 요청 원문을 history.jsonl에서 직접 확인했고 [복구 근거 등록부](../evidence/recovered-source-register.json)에 메시지 hash와 시각을 보존했습니다. 요청은 합의한 실패 조건에서 즉시 중단하고 후보를 기각하도록 했습니다. 03:35:46 daily quota 응답으로 중단 조건에 도달했습니다. 해당 429 뒤 요청은 0회이며 QB25의 A 요청과 QB11 양쪽은 호출하지 않았습니다.

**대화 재검색으로 확보한 당시 논의:** 10월 29일 사용자가 다음 ChatGPT 과거 대화 재검색 결과를 전달했다. 시각은 KST다. 사용자 제공 검색 기록이며 원본 대화 URL·식별자·전문은 아직 확보되지 않았다.

| 10월 3일 시각 | 검색 기록 내용 |
|---|---|
| 03:13:25 | 반복적인 HTTP 503 결과와 호출 한도 논의. |
| 03:14:41 | 사용자가 이 정도의 503이면 무료 티어를 사실상 사용하기 어렵다며 실효성에 의문 제기. |
| 03:15:45 | 사용자가 해외 커뮤니티의 유사 사례 조사 요청. |
| 03:16:17 | ChatGPT가 유료 프로젝트 보고를 포함한 Reddit·Google AI Developers Forum의 유사한 503 사례를 전달. |
| 03:19:52 | 사용자가 503 retry는 허용하되 일일 한도 429에서 3.8을 포기하도록 조건 지정. |
| 03:35:06 | 사용자가 실패가 쌓이는 동안 AI Studio 일일 사용량 17/20을 확인했다고 보고. |
| 03:49:02 | 테스트 정리: Gemini 3.8 요청 15회, 성공 2·503 12·429 1. |

최종 집계는 직접 확인한 실험 원본과 일치한다. 03:19:52 ChatGPT 검색 기록의 조건과 사용자 입력 이력의 Codex 03:20:37 요청은 내용이 대응하며 각 출처의 메시지 시각을 유지한다. AI Studio 17/20은 계정 사용량에 대한 당시 사용자 보고다.

**부차적인 외부 참고:** 사용자는 오류와 한도 소진 이후 비슷한 불만을 검색했던 것으로 기억한다. 원본 ChatGPT 대화 URL·식별자는 확보되지 않았다. [Google AI Developers Forum 게시글](https://discuss.ai.google.dev/t/gemini-api-503/183913)은 9월 21일 게시됐으며 이번 공개 준비 중 직접 확인했다. Google Apps Script·무료 티어에서 gemini-3.8-flash를 포함한 세 모델의 503이 반복됐다는 신고이며, 답글은 일시적 서비스 과부하를 설명한다. 이 자료는 의사결정의 중심인 운영 관측에 유사한 외부 실패 사례를 덧붙인다.

다음 공개 보고도 이번 공개 준비 중 직접 대조했다.

| 보고 | 모델·환경 | 게시자의 관측 |
|---|---|---|
| [9월 24일: 무료 티어 실패와 RPD](https://discuss.ai.google.dev/t/handling-429-503-errors-from-the-gemini-api/124640/79) | Gemini 3.7/3.8 Flash, 무료 티어 | 반복 503과 실패 호출 뒤 RPD 증가를 보고했다. 3.8은 관측한 호출이 모두 실패했는데도 8/20으로 표시됐다. |
| [8월 28일: 유료 티어 가용성](https://discuss.ai.google.dev/t/persistent-37-unavailable-503-on-generatecontent-with-gemini-3-6-flash-paid-tier-1-zero-429s-counttokens-unaffected/179971) | Gemini 3.6 Flash, Paid Tier 1 | 30일 GenerateContent 646회·오류 37.46%를 HTTP 503으로 보고했고 429는 0회였다. |

유료 티어 실패율은 해당 Gemini 3.6 Flash/Tier 1 작업 부하의 신고값이다. 사용자는 이를 과금만으로 안정적인 운영을 기대하기 어렵다는 판단의 참고로 사용했다. 무료 티어의 RPD 보고는 사용자가 겪은 한도 소진과 유사한 외부 관측을 제공한다.

[날짜를 구분한 보충 기록](../../cases/model-selection-quality-availability/evidence/developer-clarification-20261029.json#L1-L184)에 사용자 판단·검색 연표·직접 확인한 공개 자료를 보존했다. 위 10월 29일 사용자 보충은 정상 응답 3회·실패 17회의 사용량 이력에서 내린 판단과 운영 후보 제외 결정을 명시한다.

## 10월 3일: 다른 Groq 모델을 fallback으로 채택

별도의 fresh full40 비교는 같은 저장 evidence·질문·prompt·schema를 세 generator에 제공했고 각 40개 성공 응답을 기록했다.

| 모델 | Fully correct | Grounding failure | Contract failure | 평균 Generation 지연 |
|---|---:|---:|---:|---:|
| Gemini 3.5 Flash Lite | 27/40 | 0 | 1 | 1.508초 |
| Cohere Command A+ | 22/40 | 3 | 4 | 3.042초 |
| Groq GPT-OSS 120B | 25/40 | 2 | 0 | 1.524초 |

집 PC의 full40 원본은 10월 3일 05:10:24.134~05:53:01.835, HEAD bbac3a6d11993f3c3e3d80eec44df86e7779073d의 순차 실행을 기록한다.

요청·응답·결과·수동 판정 각 120개를 직접 대조했고, 40문항의 공통 입력 hash·120개 요청 본문 hash·원시 응답→결과·정규화 답변→당시 수동 판정의 대응이 모두 일치했다. [원본 결과 projection](../../cases/model-selection-quality-availability/evidence/october03-reported-results.json)에 문항별 identity와 재집계 결과를 보존했다.

Gemini·Cohere 출력 상한은 32768, GPT-OSS는 4096·strict JSON Schema였고 reasoning_effort는 당시 provider 기본 medium을 쓰도록 생략했다. Retry/fallback은 0회, Groq 요청 시작 간격은 최소 65초였다. 성공 응답 지연과 요청 사이 대기를 구분한다. 10월 1일 대상 유지 실험과 3.8 부분 비교는 각각의 지표·조건으로 유지한다.

보존된 04:05:58 사용자 요청은 이전 Groq 후보의 실패 이후 GPT-OSS를 재평가하도록 했다. 07:42:12의 0baebd9는 runtime을 Gemini 3.5 primary·Groq openai/gpt-oss-120b fallback으로 바꾸고 Cohere를 명시적 평가용으로 남겼다. 설정은 Gemini 출력 상한 32768, GPT-OSS 4096·reasoning effort medium이었다. [Routing 회귀 발췌](../../cases/model-selection-quality-availability/runtime/groq-fallback.excerpt.test.ts#L28-L93)는 출력 상한, quota에서 실제 Groq adapter로 진행하는 경로의 mocked HTTP 200/429/503, registry/runtime 독립성, 명시적 단일 target 실행을 확인한다.

최종 구성에는 앞서 제거한 Qwen 후보와 다른 GPT-OSS 모델을 사용했다. [사례 04의 GPT-OSS adapter](../../cases/embedding-batching-retry-pacing/architecture/groq/generation.ts#L1-L28)가 strict schema·reasoning 옵션의 매핑을 보존한다.

## 10월 3일: reasoning 설정을 비교한 뒤 기존 설정 유지

Full40 뒤 06:09:47 사용자는 Gemini 3.5 primary·GPT-OSS fallback 채택을 요청했고, 06:30:45에는 기존 입력과 baseline을 보존한 reasoning 추가 비교를 요청했다. 06:38:49.902~07:18:09.538 실행은 같은 HEAD에서 진행 중이던 Groq 연결 변경을 보존한 채 Gemini medium과 GPT-OSS high만 새로 호출했다. [Reasoning 비교 근거](../../cases/model-selection-quality-availability/evidence/october03-reasoning-results.json)에 옵션·분모·77개 요청의 hash와 당시 판정을 보존한다. 77개 요청은 baseline과 reasoning 옵션만 달랐고 공통 입력이 일치했다. Retry·fallback·embedding·retrieval·reranker·index rebuild는 모두 0회였다.

| 비교 | 동일 성공 문항 | 완전 정답 | 인용이 있는 required claim | 관측 |
|---|---:|---|---|---|
| Gemini default/minimal → medium | 40 | 27 → 27 | 31/49 → 31/49 | 평균 지연 1508.029 → 3339.448ms |
| GPT-OSS medium → high | 36 | 24 → 26 | 30/44 → 31/44 | Hard failure union 2 → 3 |

Gemini medium은 QB18의 OCR 파싱과 QB37의 records/citation 처리를 회복했지만 QB04·QB12에서 detail을 누락해 전체 완전 정답·coverage의 순증은 없었다. GPT-OSS high는 QB32의 근거 없는 unknown 처리 설명을 해소하고 QB33의 판단 순서를 회복했지만 QB12에 근거 없는 효과 설명, QB16에 이름 표기 오류가 생겼고 QB25의 entity conflation은 남았다. 이는 당시 수동 판정의 문항별 변화다.

Gemini medium은 40/40 성공했다. GPT-OSS high는 QB01~QB36 성공 후 QB37에서 HTTP 429 tokens-per-day 오류를 받아 종료했고 QB38~QB40은 미실행이었다. 오류가 반환한 limit 200000·used 198748·requested 3431은 당시 계정 누적 상태이며 high 실행만의 사용량으로 합산하지 않는다. High 비교의 품질 분모는 같은 성공 36문항으로 제한했다. 이 10월 3일 오류와 10월 15일의 rate-limit 실패는 별도 관측이다.

당시 보고서는 품질 변화·새 오류·지연·reasoning 사용량을 함께 검토해 기존 설정 유지를 권고했다. 07:34:34 사용자 원문은 Gemini default/minimal·GPT-OSS medium을 유지하고 이미 구현한 Groq fallback 교체만 마무리하도록 했다. 이후 07:42:12의 0baebd9가 이 설정을 커밋했다. [복구 근거 등록부](../evidence/recovered-source-register.json)는 실험 요청, 권고 보고서와 최종 사용자 결정을 각각 식별한다.

## 10월 6일: 운영 fallback과 명시적 평가의 실행 계약 분리

9월 26일과 10월 3일 runtime은 확인된 quota exhaustion에서 다음 모델로 진행했다.

후속 5b78e06 통합은 Generation에 공통 실패 정책을 사용했다. [보존한 10월 15일 정책 snapshot](../../cases/model-selection-quality-availability/availability/failure-policy.ts#L1-L93)은 quota exhaustion·rate limit·temporary unavailability·transport failure·timeout에서 독립 Provider로 진행할 수 있게 한다.

Authentication·configuration·invalid request·invalid response는 다음 Generation target으로 진행하지 않고 종료한다. [정책 테스트](../../cases/model-selection-quality-availability/availability/failure-policy.test.ts#L1-L46)에 단계별 조건이 남아 있다.

명시적 모델 평가는 retry를 끈 단일 target 실행을 유지했다. [고정 입력 runner](../../cases/model-selection-quality-availability/evaluation/fixed-input.excerpt.ts#L46-L98)는 evidence를 복제하고 실제 dispatch prompt를 확인하며 Provider identity/옵션·응답/검증 metadata를 기록한다.

실패 뒤에는 명시적으로 선택한 다음 비교 후보를 평가한다. [테스트 발췌](../../cases/model-selection-quality-availability/evaluation/fixed-input.excerpt.test.ts#L33-L100)는 비교 전용 옵션·동일 입력·실패 후보·citation·credential 경계를 다룬다. 운영 fallback과 비교 실행을 각자의 실행 계약으로 추적할 수 있다.

## 10월 15일: canonical evidence를 고정한 Generation 비교

Run e8fbc67f-9950-4c9e-92f6-c341a4f6ad6e는 22:00:09.922~22:04:29.995에 실행됐다. 당시 HEAD는 3ec5bb5fec373cc59b234197d8f838188dcd62ff였고 Generation-only 구현은 미커밋 상태였다. 22:31:13의 c5d615c가 구현과 결과를 보관했다. Integrity 기록은 원본 산출물 43개·구현/문서 10개를 식별하며, 이번 공개 준비에서 해당 SHA-256이 모두 일치했다.

Corpus는 27 sources·372 chunks였다.

Question bank canonical-portfolio content version 2와 full-40 profile version 1이 문항 집합을 고정했다. [Canonical snapshot 생성](../../cases/model-selection-quality-availability/evaluation/canonical-snapshots.ts#L36-L96)은 전체 source chunk로 reference를 검증하고 evidence/citation 순서와 입력 hash를 보존한다.

기대 claim·평가 metadata는 모델 입력 밖에 둔다. [Snapshot 테스트](../../cases/model-selection-quality-availability/evaluation/canonical-snapshots.test.ts#L1-L116)는 모호하거나 없는 reference, related/partial/unsupported evidence, dedupe, hash 재계산 후 drift를 다룬다.

[Generation-only runner](../../cases/model-selection-quality-availability/evaluation/canonical-generation.ts#L81-L153)는 dispatch 전에 전체 snapshot과 양쪽 credential을 검증하고 target 옵션을 고정하며 문항별 결과·완료 집계를 저장한다. [Runner 테스트](../../cases/model-selection-quality-availability/evaluation/canonical-generation.test.ts#L61-L149)는 80회 명시적 mock 호출·동일 입력·잘못되거나 없는 응답·credential 사전 검사·target drift를 확인한다.

두 모델의 질문·순서가 고정된 records·system instruction·response schema는 같았다. Gemini 출력 상한은 32768, Groq는 4096·reasoning effort medium이었다. Query embedding·vector search·classifier·retry·runtime fallback은 모두 0회였다.

| 관측 | Gemini 3.5 | Groq GPT-OSS |
|---|---:|---:|
| Generation 시도 | 40 | 40 |
| 성공 응답 | 40 | 12 |
| 실패 응답 | 0 | 28, 모두 HTTP 429 rate_limit |
| 성공 응답 JSON/schema/citation 구조 검사 | 40/40 | 12/12 |
| 성공 응답 지연 중앙값 | 3064ms, n=40 | 1855ms, n=12 |
| 성공 응답 평균 지연 | 5759.875ms, n=40 | 2098.833ms, n=12 |
| 수동 의미 평가 | 32 pass / 6 minor issue / 2 strict fail | 미수행 |

[관측 결과 재구성](../../cases/model-selection-quality-availability/evidence/october15-observed-results.json#L1-L2302)에 모든 문항의 집계·입력 hash·검증·지연·정규화된 실패·출처 identity를 보존했다. 위 지연 집계는 공개 준비 중 원본의 성공 결과에서 계산했다. 10월 15일 실행은 해당 evidence policy·옵션·prompt·평가 기준을 사용한 별도 실험이다.

[Groq client](../../cases/model-selection-quality-availability/availability/groq-client.ts#L9-L40)는 429를 분류하고 projection한 진단을 보존한다. [테스트](../../cases/model-selection-quality-availability/availability/groq-client.test.ts#L1-L44)는 요청 구성과 오류 분류를 다룬다.

기록된 Retry-After 값은 2~30초, resetAfterMs는 172800~1036800ms였다. [Projection](../../cases/model-selection-quality-availability/availability/failure-policy.ts#L24-L93)은 request/token reset header의 최댓값을 저장한다. 원본 raw header·error body는 폐기했다. 정확히 소진된 제한은 미확인이며 보존값은 당시 실패 진단의 범위를 나타낸다.

## 제품 운영 범위에서 primary 수용

의미 평가 기준은 질문 단위의 의미·grounding·required claim·언어·이름·basis·citation alignment를 살폈다. Unsupported/related evidence의 근거 부족 처리는 8/8 정상, false-premise는 3/3 통과였다. Strict fail 두 건은 다음과 같다.

- QB22: 근거는 모바일 도면 부재를 지원했지만 응답은 모바일 검증 미수행을 단정했다. 실제 검증 수행 여부는 미확인이다.
- QB35: 내용과 인용은 근거에 맞았지만 명시적 일본어 요청에도 한국어로 답했다.

기록된 제품 판단은 Gemini primary를 유지하고 production prompt를 추가 보정하지 않는 것이었다. 사용자는 QB22의 강한 부정 표현을 현재 제품에서 허용 가능한 오차로, 일본어 지시 준수를 한국어 중심 서비스의 핵심 품질 우선순위 밖으로 판단했다.

벤치마크 판정은 32/6/2를 유지했다. [재구성 자료](../../cases/model-selection-quality-availability/evidence/october15-observed-results.json#L1-L2302)에 두 실제 응답·판정 이유·제품 결정을 보존했다.

불완전한 비교 이후 Groq 의미 평가와 failed-only resume은 보류했다.

**사용자 제공 ChatGPT 대화 검색에 남은 10월 16일 운영 판단:** 사용자는 앞선 full40 품질 비교와 10월 15일 rate-limit 결과를 고려하며 무료 공개 서비스에서 Gemini+Groq 구성을 유지할지 검토했다. 당시 ChatGPT는 모델 사용 자격보다 호출 용량이 문제라고 설명하면서 8K TPM 등을 제시했다. 이 값은 당시 논의된 정보로 보존하며, 정확한 계정·모델별 적용 한도는 독립 확인하지 않았다. 10월 15일 429의 정확한 제한 종류는 미확인으로 유지한다.

사용자는 Gemini primary가 실패할 때 Groq를 호출하는 구성과 Groq를 주력 generator로 사용하는 구성의 운영 조건을 구분했다.

이 운영 판단에 따라 Gemini 3.5 primary → Groq GPT-OSS 120B fallback을 유지했다. [보충 근거 기록](../../cases/model-selection-quality-availability/evidence/developer-clarification-20261029.json#L1-L184)은 이 검색 기반 운영 판단과 두 실험의 원래 조건을 구분한다. 원본 대화 URL·전문은 확보되지 않았다.

10월 16일 21:32:34의 e700717은 Cohere 평가·지원 경로를 제거하면서 Gemini 3.5/Groq 조합을 유지했다. [사례 03의 제거 판단](03-cohere-evaluation-and-retirement.ko.md#제거-판단-규모운영-비용과-성능-이점의-비교)이 규모·대체 가능성·비용 맥락을 제공한다. 사례 06은 선택한 Generation 구성까지 다룬다.

## 근거 수준·공개 방식·남은 확인 사항

설정 변경과 공개한 당시 코드를 직접 확인했다. 10월 3일 원본 요청·응답·수동 판정·정확한 옵션·두 실행의 요청 대응과 reasoning 추가 비교를 직접 대조했다. 10월 15일 결과와 보관 해시도 직접 대조했으며 의미 판정·제품 수용은 보존된 수동 검토 기록이다. 사용자 제공 ChatGPT 검색 기록은 9월 26일 최초 전환 이유·5건 테스트 보고, 10월 3일 논의·사용량 보고, 10월 16일 fallback 유지 판단을 검색 근거 수준으로 보존한다. 10월 3일 Codex 중단 조건·설정 유지 결정은 별도로 사용자 입력 원문을 확인했다. 10월 29일 호출 용량 판단·한도 소진 회고·더 넓은 외부 반응에 대한 기억은 후속 사용자 진술로 구분했다.

남은 사항은 Provider 측 개별 요청 차감·다른 계정 활동·금전 청구, 초기 Qwen 실패 ledger, 원본 ChatGPT 대화·AI Studio 화면과 사용자가 기억하는 다른 외부 게시글이다. Groq의 10월 15일 의미 품질·정확한 quota 종류도 미확인이다. 10월 3일 원본 응답·옵션·요청 대응의 확인 결과와 역사적 한도는 각각의 기록 시점을 유지한다.

전체 파일 Excerpt는 초기 quota 처리·canonical evidence/runner 계약·transport/diagnostic 동작처럼 작은 구현·테스트 단위를 보존한다. 부분 Excerpt는 고정 입력 비교와 채택한 runtime의 회귀를 선택하고 원래 문장·import·참조를 유지한다. 공통 정책은 fallback 조건·header/body 파싱·안전한 projection이 함께 동작해 전체를 보존했다.

Reconstructed JSON은 원본 설정·결과를 선택하고 편집상 그룹화·집계 계산·이전 전사본·후속 사용자 진술을 구분한다. 선택한 실제 응답 두 개는 실패 근거를 보존하며 Knowledge 전체 payload와 credential은 비공개로 유지한다. Mixed 소스는 필요하지 않았다.

원본 커밋·경로·발췌 범위·전체 해시와 재구성 입력은 [전체 출처 대응표](06-source-ledger.ko.md)에 보존했습니다.

## 공개 준비 검증

전체 파일 Excerpt 12개는 Git 원본 바이트와, 부분 Excerpt 3개는 선언한 모든 원본 범위와 일치했다. TypeScript 15개는 구문 파싱을 통과했다. 기존 JSON 재구성 4개는 최초 공개 준비에서 파싱·입력 해시 57개 대조·설정 projection·원본 결과 집계·대표 응답 대조·출처 연결 검증을 통과했다. 10월 15일 보관 원본 43개와 구현/문서 10개도 기록된 SHA-256과 일치했다.

40문항 원본 결과로 단일 Generation dispatch 80회·성공 구조 검사 52개·rate-limit 실패 28개·성공 표본 지연 통계·수동 판정 32/6/2를 대조했다. 10월 3일 검색 시각 7개·9월 26일 근사 시각 3개·10월 16일 운영 판단·AI Studio 17/20 보고·사용자 quota 판단의 출처를 대조했다. 8K TPM 논의와 10월 15일 quota 원인 미확인은 범위를 구분했다. 영문·한글의 코드/외부 자료 링크 대상과 해시가 일치한다.

로컬 링크 622개의 파일·헤딩·라인 범위 검증을 통과했다. 사례 01~05의 공개 파일 112개를 보존했다. 이후 본문 근거 보강은 아래 추가 검증으로 구분한다.

새 코드·선택한 응답·문서에서 credential 값·비공개 Knowledge payload·비공개 저장소 URL·로컬 사용자 경로·운영 접근 정보를 점검했다. 검증은 당시 소스 열람·로컬 파싱/계산·연결한 공개 포럼 원문 열람으로 수행했다. 당시 애플리케이션 테스트·모델 호출·인덱스 빌드·실시간 서버 접근은 수행하지 않았다.

## 10월 29일 원본 복구·추가 검증

집 PC의 대표 원본 19개와 5개 실험 디렉터리의 파일 1146개를 byte hash로 대조했다. 원본 보관 세션의 메시지 11개와 사용자 입력 이력 14개의 text hash·UTC/KST 시각을 확인했다. 사례 01의 runtime 파일 6개, 사례 03·04의 보관 세션, 사례 06의 기존 등록 보고서·결정 파일 3개는 기존 해시와 일치했다.

Full40의 요청·응답·결과·당시 수동 판정 각 120개, 직전/재시도 ledger 24건과 reasoning 요청 77건을 대조했다. 요청 본문 hash와 응답 대응·분류 집계·성공 지연을 확인했으며 reasoning 요청은 baseline과 공통 입력이 같고 reasoning 옵션만 달랐다. GPT-OSS high의 품질 분모는 성공 36문항·required claim 44개·양성 질문 33개로 확인하고, 실패 QB37을 포함한 시도 전체 집계와 분리했다.

공개 JSON 14개가 파싱됐고 영문·한글의 파일/외부 링크와 SHA-256 집합이 일치했다. README 2개와 개발 기록 2개의 로컬 링크 656개는 파일·헤딩·라인 범위 검증을 통과했다. 기존 소스·테스트 119개와 Synethos 원본을 보존했으며 Synethos working tree는 clean이었다. 변경한 기존 파일은 개발 기록 2개와 근거 JSON 2개이고, reasoning 근거 JSON과 공통 복구 근거 등록부를 추가했다.

공개 대상에서 credential 값·로컬 사용자 경로·비공개 저장소 URL·Knowledge 전체 payload를 점검했다. 검증은 원본 열람과 로컬 계산으로 수행했으며 새 모델 호출·과거 실험 재실행·애플리케이션 테스트·index build·서버 접근은 수행하지 않았다.

[전체 사례로 돌아가기](../../README.ko.md)
