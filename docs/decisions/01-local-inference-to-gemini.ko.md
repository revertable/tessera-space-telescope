# 01 — From Local Qwen/Ollama Inference to the Gemini API

[전체 사례](../../README.ko.md) · [English](01-local-inference-to-gemini.md) · [다음: 02](02-gitbook-to-local-knowledge.ko.md)

**근거 수준:** 코드 확인은 식별한 과거 소스, 당시 보고는 기록된 조건의 관측, 미확인은 해결되지 않은 사실·인과관계를 뜻합니다. 테스트는 당시 소스 근거로 수록합니다. 시각은 KST(UTC+09:00)이며 개발 사건과 근거 검증 날짜를 구분합니다.

**문서 편집:** 2026-10-30, 기준 `2fc5094`. 아래 과거 공개 검증 기록의 날짜와 범위를 유지합니다.

**개발 날짜:** 2026-09-26

**코드 분류:** 아래 연결한 소스·테스트12개 파일 모두 Excerpt.

**결과:** 로컬 추론 운영을 중단하고 Gemini API 직접 통합으로 전환했으며, 기록 기반 답변 흐름은 유지했습니다.

## 문제와 제약

초기 Synethos는 프로젝트 로컬 Ollama를 이용한 무료 자체 실행을 목표로 했습니다. 커밋된 기준본은 생성에 `qwen3:0.6b`, embedding에 `qwen3-embedding:0.6b`를 사용했습니다. 생성 context4096tokens, 로컬 요청 timeout120000ms, embedding batch16을 설정했습니다. Runtime/model 저장소는 프로젝트 내부에 두고, provisioning에서 `OLLAMA_NO_CLOUD=1`로 cloud 사용을 명시적으로 비활성화했습니다. 이는 당시 기준 설정입니다.

02:16:28 사용자는 영어 GitHub profile을 검색 근거로 삼을 때 한국어 질문에도 영어 답변이 나오는 문제를 보고했습니다. 비교에서는 생성 모델만 `qwen3:8b`로 바꾸고 embedding·retrieval·청킹·prompt·승인 knowledge·기존 index를 유지하려 했습니다. 언어 동작의 의도는 명시적인 언어 요청을 우선하고, 그 외에는 질문의 언어로 답하는 것이었습니다.

관련 장비는 Windows, Ryzen5 5600X, Radeon RX6800XT/16GiB VRAM, 시스템 RAM 약16GiB, Vulkan backend 조건이었습니다. 이 장비·backend 조건은 자원 실험의 실행 환경입니다.

## 실험과 철회한 선택

**당시 보고:** 02:30:27 사용자는 Qwen3 8B 검증 중 PC 전원이 예고 없이 완전히 차단됐고 수동 재부팅했다고 보고했습니다. 직후에는 모델·서버를 다시 시작하지 않고 기존 기록을 조사하도록 요청했습니다.

사용자가 마지막 정상 로그로 보고한 시각은02:26:07이지만, 보존된 HTTP stdout에는02:26:33/42/50/57의 chat 성공과02:26:57의 embedding 성공이 남아 있습니다. 각 항목을 개별 검증 질문에 대응시킬 요청 본문은 없습니다. **정확한 전원 차단 시각, 마지막 질문, 기술적 원인은 미확인입니다.** Driver 경고나 Vulkan 사용만으로 원인을 확정할 수 없습니다.

약03:06 사용자는 하드웨어 구매·설정 변경 없이 소프트웨어 조정으로 GPU 순간 부하를 낮추는 방안을 검토했습니다. CPU/RAM을 활용하고 응답 지연은 허용하는 방향이었습니다.03:21:21~03:23:30의 저부하 실행은 다음을 기록했습니다.

| 조건·관찰 | 보존된 결과 |
|---|---|
| 질문 | `What is Codex Session Observatory?` |
| 생성 | `qwen3:8b`;37layers 중18개 GPU offload |
| Embedding | `qwen3-embedding:0.6b`;CPU 실행 |
| 응답 | `answered`,출처3개,elapsed118301ms |
| 최소 가용 물리 RAM | 3693346816bytes,약3.44GiB |
| 설정된 메모리 중단 기준 | 3221225472bytes,3GiB |
| 종료 | `completed`, `abortReason=null`,잔여 listening ports 없음으로 보고 |

이 실행은 기록된 메모리 기준 안에서 생성 layer37개 중18개를 GPU에 배치해 완료했습니다. 영문 답변1회 이후 한국어 품질 개선, 장기 안정성, 앞선 전원 사건의 해결은 미확인으로 남았습니다.

## 판단

03:50:47 사용자는0.6B/8B 시도와 CPU/GPU 분담 실험 뒤 실행 안정성·자원·응답시간이 MVP에 부담이라고 판단했습니다. 로컬 추론 운영을 중단하고 당시 제공되던 Gemini API 무료 티어를 사용하기로 했습니다.

구현 범위도 좁혔습니다. 로컬/API 선택형 호환 계층을 유지하는 대신 로컬 추론 경로를 제거했습니다. 승인 knowledge, 검색, 기록 기반 생성 규칙과 인용 검증은 유지하고, 기존 Qwen embedding을 Gemini embedding으로 재사용하지 않도록 했습니다.

이 결정은 관찰한 제약과 위 실험 결과에 따른 제품 범위 판단입니다. 사용자는 2026년 9월 26일 당시 제공되던 Gemini API 무료 티어를 선택했습니다.

03:50:47 결정과 03:58:18 후속 요청을 사용자 입력 이력 원문에서 직접 확인했습니다. 후속 요청은 Ollama 정리와 Gemini 생성·embedding 연결을 하나의 완료 범위로 묶고 중간 미설정 상태의 별도 구현을 생략했습니다. 실제 API 호출과 새 index 생성은 key 입력 후 단계로 뒀습니다. [복구 근거 등록부](../evidence/recovered-source-register.json)에 session ID·메시지 시각·원문 hash를 보존합니다.

## 구현: 로컬 HTTP 호출에서 서버 API client로

기준본은02:15:03 커밋된 `cb299ce7f96888ab9ed4e49d69bfb3f6d59b30dc`입니다. 관련 코드·설정은 이전 prototype `801633a`와 같습니다. 전환 기준본은12:05:45의 `9a3df6134f3a68c012d98afa9fdc5f7f7cf5b264`이며 커밋 메시지는 `Replace local Ollama inference with Gemini API`입니다.

공개 기준본은 **0.6B 모델**을 사용하며 8B 실험 요청보다 앞선 코드입니다. 발췌본은 이 커밋의 기준 설정을 보존하며, 저부하 실험 설정은 실험 표에 기록했습니다.

**전환 전:** [로컬 POST client](../../cases/local-inference-to-gemini/before/ollama/client.ts#L10-L37)는 AbortController timeout을 적용하고 Ollama에 JSON을 보냅니다. [생성](../../cases/local-inference-to-gemini/before/ollama/generation.ts#L39-L53)은 `/api/chat`에서 streaming을 끄고 JSON schema와 temperature/context 옵션을 전달합니다. [Embedding](../../cases/local-inference-to-gemini/before/ollama/embeddings.ts#L13-L32)은 `/api/embed`를 batch로 호출하고 vector 개수·차원 일치·유한값을 검사합니다.

**전환 후:** [Gemini client](../../cases/local-inference-to-gemini/after/gemini/client.ts#L11-L16)는 서버 API key를 요구하고 `GoogleGenAI`를 만듭니다. [생성](../../cases/local-inference-to-gemini/after/gemini/generation.ts#L40-L68)은 `generateContent`에 JSON schema와 출력 한도를 전달하고 응답의 answer/citation 형태를 검사합니다. 실제 key 값은 발췌본에 포함하지 않습니다.

전환 당시 생성 모델은 **`gemini-3.8-flash`**, `maxOutputTokens=1200`이었고, embedding은 **`gemini-embedding-2`**,768차원이었습니다. 이 모델 설정은 전환 커밋 기준입니다. 이 구현은 로컬/provider fallback 경로를 유지하지 않았습니다.

## 구현: 제공자를 바꾸면서 grounding 유지

[Ollama의 prompt·record 구성](../../cases/local-inference-to-gemini/before/ollama/generation.ts#L29-L38)과 [Gemini의 대응 코드](../../cases/local-inference-to-gemini/after/gemini/generation.ts#L29-L38)는 같은 핵심 지시를 유지합니다. 제공된 record만 사용하고, record를 지시가 아닌 신뢰할 수 없는 근거로 취급하며, 사실을 만들지 않고, 확인 불가한 내용을 밝히고, 지원하는 record ID를 인용하도록 합니다.

제공자 요청 방식은 바뀌지만 이 grounding 의도는 유지됩니다. Gemini schema에는 `additionalProperties: false`도 추가됐습니다. [이전 schema](../../cases/local-inference-to-gemini/before/ollama/generation.ts#L14-L21)와 [이후 schema](../../cases/local-inference-to-gemini/after/gemini/generation.ts#L13-L21)를 비교할 수 있습니다.

두 구현에 응답 형태 검사와 citation 중복 제거가 있습니다. 형태 검사만으로 모든 문장이 해당 인용의 지원을 받는지 입증되지는 않습니다.

[당시 generation 테스트](../../cases/local-inference-to-gemini/verification/generation.test.ts#L5-L31)는 지시처럼 보이는 문자열을 포함한 합성 record와 mock model을 사용해 전송 prompt·구조화 응답 계약을 검사합니다. 실제 모델의 prompt injection 방어 성능과 의미적 grounding 정확성은 이 mock 테스트의 검증 범위 밖입니다.

## 구현: embedding 계약 변경과 새 index

Gemini adapter는 [질문 입력](../../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L32-L38)과 [문서 chunk 입력](../../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L40-L50)을 구분합니다. 각 chunk를 제목·본문과 함께 독립적으로 embedding합니다. [Vector 검사](../../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L8-L30)는 입력1개에 vector1개, 설정 차원, 숫자 원소와 유한값을 요구합니다.

이 버전의 문서 embedding은 순차 호출입니다. [Embedding 테스트](../../cases/local-inference-to-gemini/verification/embeddings.test.ts#L10-L47)는 mock 응답으로 chunk 순서와 query prefix 계약을 기록합니다.

Index 호환성도 함께 바뀝니다.

- [Corpus fingerprint](../../cases/local-inference-to-gemini/after/indexing/corpus.ts#L7-L44)는 청킹·source 식별 정보와 함께 schema version2, embedding model, 출력 차원과 embedding input version을 포함합니다.
- [Index builder](../../cases/local-inference-to-gemini/after/indexing/indexer.ts#L25-L43)는 새 Gemini vector를 얻고 chunk 개수와 일치하는지 검사하며 모델·차원 metadata를 기록합니다.
- [Index reader](../../cases/local-inference-to-gemini/after/indexing/store.ts#L20-L26)는 fingerprint/schema 불일치를 rebuild 오류로 거부합니다.
- [Fingerprint 테스트](../../cases/local-inference-to-gemini/verification/corpus.test.ts#L5-L26)는 생성 모델 변경과 embedding 모델·차원 변경을 구분합니다. 이 fingerprint는 후자에서 바뀝니다.

전환 커밋은 원본 indexer·retrieval·answer 경로의 import도 Ollama에서 Gemini로 바꿨습니다. 공개 발췌는 관련 provider·index 메커니즘을 보여줍니다.

## 검증 결과와 한계

전환 커밋의 개발 보고서는 별도의 Gemini 검증을 기록합니다.

| 관찰 | 당시 보고된 결과 |
|---|---|
| 입력 corpus | 승인 GitHub profile 문서1개 |
| Index | 독립 chunk vector8개,각768차원;설정 모델 metadata를 가진 current index |
| 질문 | `Riu Salze는 어떤 개발자인가요?` |
| 답변 | HTTP200,한국어 응답,profile의 `About Me` section 인용 |
| 시간 | Index 생성 약4.96초;전체 `/api/ask` 요청 약4.96초 |
| 추가 호출 | Retry·fallback·추가 질문 없음 |

보고서는 index 생성 약4.96초와 전체 답변 요청 약4.96초를 별도 작업으로 기록합니다. Gemini 검증은 profile 문서1개와 한국어 질문1개의 index·답변 경로 성공을 확인했습니다. Qwen 저부하 실행은 영문 질문과 실행 조건이 달라 통제된 속도·품질 비교는 미확인으로 남습니다. 전반적인 품질·quota 지속성·production 신뢰성도 검증 범위 밖입니다.

기록이 뒷받침하는 범위는 다음과 같습니다.

| 기록에서 확인한 범위 | 미확인 또는 검증 범위 밖 |
|---|---|
| 로컬 HTTP 추론을 Gemini 직접 통합으로 대체했고,grounding 지시와 새 index 호환성 검사가 코드에 존재합니다. | 전원 차단의 기술적 원인과 마지막 로컬 요청·개별 질문의 대응. |
| 보존 기록은 저부하 로컬 실행 완료와 별도 Gemini 한국어 질문 성공을 보고합니다. | 로컬 장기 안정성,8B 전환의 한국어 품질 개선,일반적인 Gemini 우위. |
| 당시 테스트는 요청·vector 순서·fingerprint 계약을 표현합니다. | Tessera에서 현재 애플리케이션 전체 테스트나 새 모델 실험을 수행한 결과. |

## 코드 원본성과 출처 추적

공개 코드 전체는 **Excerpt**입니다. 공개하지 않은 애플리케이션 파일을 참조하는 import도 포함해 원본 bytes를 보존합니다. 이름·제어 흐름·의존성 참조를 원래 구현대로 유지합니다. 출처표의 범위는 전체 파일 발췌의 유효 코드 행이며 파일 hash에는 원래 끝의 빈 줄도 포함합니다.

비공개 Synethos 원본은 커밋과 저장소 상대경로로 식별합니다. 비공개 저장소 URL,연구 대화 전문,원시 runtime 로그,로컬 사용자 경로와 API key 값은 공개하지 않습니다. 아래 표는 근거 식별자와 검증 한계를 기록합니다.


### 전환 전 기준본

`cb299ce7f96888ab9ed4e49d69bfb3f6d59b30dc` — 2026-09-26 02:15:03 KST

| 공개 Excerpt | 원본 경로 | 원본 행 → 공개 행 |
|---|---|---|
| [before/ollama/client.ts](../../cases/local-inference-to-gemini/before/ollama/client.ts#L1-L48) | `sveltekit/src/lib/server/ollama/client.ts` | 1–48 → 1–48 |
| [before/ollama/generation.ts](../../cases/local-inference-to-gemini/before/ollama/generation.ts#L1-L67) | `sveltekit/src/lib/server/ollama/generation.ts` | 1–67 → 1–67 |
| [before/ollama/embeddings.ts](../../cases/local-inference-to-gemini/before/ollama/embeddings.ts#L1-L33) | `sveltekit/src/lib/server/ollama/embeddings.ts` | 1–33 → 1–33 |

### 전환 후 구현·테스트 기준본

`9a3df6134f3a68c012d98afa9fdc5f7f7cf5b264` — 2026-09-26 12:05:45 KST

| 공개 Excerpt | 원본 경로 | 원본 행 → 공개 행 |
|---|---|---|
| [after/gemini/client.ts](../../cases/local-inference-to-gemini/after/gemini/client.ts#L1-L16) | `sveltekit/src/lib/server/gemini/client.ts` | 1–16 → 1–16 |
| [after/gemini/generation.ts](../../cases/local-inference-to-gemini/after/gemini/generation.ts#L1-L69) | `sveltekit/src/lib/server/gemini/generation.ts` | 1–69 → 1–69 |
| [after/gemini/embeddings.ts](../../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L1-L50) | `sveltekit/src/lib/server/gemini/embeddings.ts` | 1–50 → 1–50 |
| [after/indexing/corpus.ts](../../cases/local-inference-to-gemini/after/indexing/corpus.ts#L1-L45) | `sveltekit/src/lib/server/indexing/corpus.ts` | 1–45 → 1–45 |
| [after/indexing/indexer.ts](../../cases/local-inference-to-gemini/after/indexing/indexer.ts#L1-L43) | `sveltekit/src/lib/server/indexing/indexer.ts` | 1–43 → 1–43 |
| [after/indexing/store.ts](../../cases/local-inference-to-gemini/after/indexing/store.ts#L1-L36) | `sveltekit/src/lib/server/indexing/store.ts` | 1–36 → 1–36 |
| [verification/generation.test.ts](../../cases/local-inference-to-gemini/verification/generation.test.ts#L1-L31) | `sveltekit/src/lib/server/gemini/generation.test.ts` | 1–31 → 1–31 |
| [verification/embeddings.test.ts](../../cases/local-inference-to-gemini/verification/embeddings.test.ts#L1-L47) | `sveltekit/src/lib/server/gemini/embeddings.test.ts` | 1–47 → 1–47 |
| [verification/corpus.test.ts](../../cases/local-inference-to-gemini/verification/corpus.test.ts#L1-L26) | `sveltekit/src/lib/server/indexing/corpus.test.ts` | 1–26 → 1–26 |

<details>
<summary>공개 Excerpt의 SHA-256</summary>

| 공개 파일 | SHA-256 |
|---|---|
| `before/ollama/client.ts` | `08c4c0264dd0703b130860eb73fb0d2cdfc416930666c069b8082e74a2efcc48` |
| `before/ollama/generation.ts` | `5c31dd479995ee136fa14d71892b6efbf2f198cc43e59b7239bea4385396c4df` |
| `before/ollama/embeddings.ts` | `97fdb50a9747d2ca8988353a224850aefd1c081191b3a8897ff574b6afba66f1` |
| `after/gemini/client.ts` | `7d0659ba3192dd9c6ec329ce571e8004dfb115f356a7ce81a7e137f7ca712a0c` |
| `after/gemini/generation.ts` | `19c5ec506cb166d4dcc87149d3c73049373f568c15e6c1b1b6ab17bcba3dddf9` |
| `after/gemini/embeddings.ts` | `3984bf24b704c89d8cc9f2632c78da557ec6ff28cbc430b48fcbb8b19dcaf929` |
| `after/indexing/corpus.ts` | `86ce3b5e1c8140f9f8c3dad9005a8ef0e14587a16969742dcf064575da59e598` |
| `after/indexing/indexer.ts` | `db546753b7aa17e87fb08dfed2a6b5db22e9de591a281257c356bc7984fe18a6` |
| `after/indexing/store.ts` | `d288feaa0d65083cb4b427d1226fdddfc3e9763168a4eed754ca275fe87ff1c7` |
| `verification/generation.test.ts` | `399c9b9537c3fcfa98b15d0da3f291bff3ffb697988ed1c02121174a2bbd25b6` |
| `verification/embeddings.test.ts` | `35a7dc9871bf6875dc1a15bfc1d1238639bdaa2eb782b9339270ca96422c418e` |
| `verification/corpus.test.ts` | `3994caf385f5a73d8cd4df06a1408d47b4286381302318ca9cc28820bdf13b5d` |

</details>

### 개발 기록과 검증 근거

| 근거 | 출처 식별 | 뒷받침하는 내용·수준 |
|---|---|---|
| 기준 설정 | cb299ce의 config/mosaic.json, scripts/ollama.ps1 및 초기 runtime 기록 | 0.6B/4096context/120000ms/batch16,프로젝트 로컬 실행의 의도;코드 확인과 당시 기록 |
| 전환 구현 | 9a3df61의 위 소스와 config/mosaic.json | 로컬 호출 제거,Gemini3.8 생성·embedding2/768,새 index 계약;코드 확인 |
| 전환 검증 | 9a3df61의 docs/development-status.md, “Gemini Verification — 2026-09-26” | vector8개와한국어1질문·시간·retry/fallback없음;당시 보고 |
| 전환 결정 | 2026-09-26 03:50:47 KST의 보존된 개발자 요청 | 자원·안정성·응답시간을 이유로 로컬 중단·Gemini 전환;당시 판단의 기록 |
| 전원·저부하 기록 | 아래 식별한 보존 로그·산출물 | 환경·완료·측정값;전원 원인은 미확인 |

다음 6개 보존 원본을 집 PC에서 직접 읽고 SHA-256을 다시 계산했으며 기존 채록값과 모두 일치했습니다. Summary·응답·메모리 timeline·Ollama 로그는 위 저부하 실행의 완료·측정값·배치 조건을 뒷받침합니다. 원시 파일과 대화 전문은 비공개로 보존합니다.

| 보존 artifact 식별자 | 채록 SHA-256 |
|---|---|
| `qwen8b-ollama.err.log` | `e0136ac0b357a41caf1c7c2a35044cb36933d6ea39b20945f00ccfcc894b6032` |
| `qwen8b-ollama.out.log` | `a4c01228c7f3760075b7f0f051f9e9edd70239c2e2a293cfb77caff7ceddbcc5` |
| `low-load-validation-20260926-032121/summary.json` | `27d7170e3bfa75cb48c75ea149bfe1e53fda7b3082211b4b330cf6ebecf22668` |
| `low-load-validation-20260926-032121/response.json` | `d60f94b860af11ecdb337ab832c19111d3bcf7711c75f51aaab552f1d9f66ea3` |
| `low-load-validation-20260926-032121/ollama.err.log` | `5c26abd7230b0db96b57c3744c55727d0586b7c9e00761ba726701e9f3469321` |
| `low-load-validation-20260926-032121/memory-timeline.jsonl` | `d7689540ebbab20cbbf29af48a3232f211d29e35022627296f2ce52c98ae3bf3` |

검증 상태: Excerpt12개 원본 일치·TypeScript 구문·영문/한글 대응·파일/라인 링크를 확인했습니다. 모델 API,로컬 추론,애플리케이션 빌드와 당시 테스트 실행은 수행하지 않았습니다.

[전체 사례로 돌아가기](../../README.ko.md)
