# Engineering Decisions

[Tessera](../README.ko.md) · [English](engineering-decisions.md)

이 기록은 Synethos의 실제 구현을 그 구현에 영향을 준 문제·실험·판단과 연결합니다. 날짜는 개발 사건의 날짜이며, 아래 시각은 모두 한국 시각(KST, UTC+09:00)입니다.

## 근거를 읽는 방법

- **코드로 확인:** 식별된 당시 코드에서 확인되는 동작 또는 공개 발췌본과 원본 bytes의 일치 확인입니다.
- **당시 보고:** 보존된 개발 요청·실험 산출물·검증 보고서에 적힌 관찰입니다. 각 관찰의 실행 조건과 검증 범위를 함께 기록합니다.
- **미확인:** 확보된 기록으로 원인·실행 대응·일반적인 효과가 입증되지 않은 내용입니다.

각 사례의 출처표에 코드 기준본과 보존 근거를 식별합니다. 당시 테스트도 구현 근거로 공개하며, 이 저장소에는 해당 의존성이나 테스트 실행기를 제공하지 않습니다.

## 목차

- [01 — From Local Qwen/Ollama Inference to the Gemini API](#01--from-local-qwenollama-inference-to-the-gemini-api) — 2026-09-26
- [02 — From GitBook MCP to Local Knowledge](#02--from-gitbook-mcp-to-local-knowledge) — 2026-09-26 ~ 2026-09-28
- [03 — Cohere 도입·평가·제거](#03--cohere-도입평가제거) — 2026-09-28 ~ 2026-10-17
- [04 — Provider 교체 설계와 Embedding 안정화](#04--provider-교체-설계와-embedding-안정화) — 2026-09-26 ~ 2026-10-17
- [05 — Cross-PC Index Portability](#05--cross-pc-index-portability) — 2026-09-28 ~ 2026-10-26

## 01 — From Local Qwen/Ollama Inference to the Gemini API

**개발 날짜:** 2026-09-26

**코드 분류:** 아래 연결한 소스·테스트12개 파일 모두 Excerpt.

**결과:** 로컬 추론 운영을 중단하고 Gemini API 직접 통합으로 전환했으며, 기록 기반 답변 흐름은 유지했습니다.

### 문제와 제약

초기 Synethos는 프로젝트 로컬 Ollama를 이용한 무료 자체 실행을 목표로 했습니다. 커밋된 기준본은 생성에 `qwen3:0.6b`, embedding에 `qwen3-embedding:0.6b`를 사용했습니다. 생성 context4096tokens, 로컬 요청 timeout120000ms, embedding batch16을 설정했습니다. Runtime/model 저장소는 프로젝트 내부에 두고, provisioning에서 `OLLAMA_NO_CLOUD=1`로 cloud 사용을 명시적으로 비활성화했습니다. 이는 당시 기준 설정입니다.

02:16:28 사용자는 영어 GitHub profile을 검색 근거로 삼을 때 한국어 질문에도 영어 답변이 나오는 문제를 보고했습니다. 비교에서는 생성 모델만 `qwen3:8b`로 바꾸고 embedding·retrieval·청킹·prompt·승인 knowledge·기존 index를 유지하려 했습니다. 언어 동작의 의도는 명시적인 언어 요청을 우선하고, 그 외에는 질문의 언어로 답하는 것이었습니다.

관련 장비는 Windows, Ryzen5 5600X, Radeon RX6800XT/16GiB VRAM, 시스템 RAM 약16GiB, Vulkan backend 조건이었습니다. 이 장비·backend 조건은 자원 실험의 실행 환경입니다.

### 실험과 철회한 선택

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

### 판단

03:50:47 사용자는0.6B/8B 시도와 CPU/GPU 분담 실험 뒤 실행 안정성·자원·응답시간이 MVP에 부담이라고 판단했습니다. 로컬 추론 운영을 중단하고 당시 제공되던 Gemini API 무료 티어를 사용하기로 했습니다.

구현 범위도 좁혔습니다. 로컬/API 선택형 호환 계층을 유지하는 대신 로컬 추론 경로를 제거했습니다. 승인 knowledge, 검색, 기록 기반 생성 규칙과 인용 검증은 유지하고, 기존 Qwen embedding을 Gemini embedding으로 재사용하지 않도록 했습니다.

이 결정은 관찰한 제약과 위 실험 결과에 따른 제품 범위 판단입니다. 사용자는 2026년 9월 26일 당시 제공되던 Gemini API 무료 티어를 선택했습니다.

### 구현: 로컬 HTTP 호출에서 서버 API client로

기준본은02:15:03 커밋된 `cb299ce7f96888ab9ed4e49d69bfb3f6d59b30dc`입니다. 관련 코드·설정은 이전 prototype `801633a`와 같습니다. 전환 기준본은12:05:45의 `9a3df6134f3a68c012d98afa9fdc5f7f7cf5b264`이며 커밋 메시지는 `Replace local Ollama inference with Gemini API`입니다.

공개 기준본은 **0.6B 모델**을 사용하며 8B 실험 요청보다 앞선 코드입니다. 발췌본은 이 커밋의 기준 설정을 보존하며, 저부하 실험 설정은 실험 표에 기록했습니다.

**전환 전:** [로컬 POST client](../cases/local-inference-to-gemini/before/ollama/client.ts#L10-L37)는 AbortController timeout을 적용하고 Ollama에 JSON을 보냅니다. [생성](../cases/local-inference-to-gemini/before/ollama/generation.ts#L39-L53)은 `/api/chat`에서 streaming을 끄고 JSON schema와 temperature/context 옵션을 전달합니다. [Embedding](../cases/local-inference-to-gemini/before/ollama/embeddings.ts#L13-L32)은 `/api/embed`를 batch로 호출하고 vector 개수·차원 일치·유한값을 검사합니다.

**전환 후:** [Gemini client](../cases/local-inference-to-gemini/after/gemini/client.ts#L11-L16)는 서버 API key를 요구하고 `GoogleGenAI`를 만듭니다. [생성](../cases/local-inference-to-gemini/after/gemini/generation.ts#L40-L68)은 `generateContent`에 JSON schema와 출력 한도를 전달하고 응답의 answer/citation 형태를 검사합니다. 실제 key 값은 발췌본에 포함하지 않습니다.

전환 당시 생성 모델은 **`gemini-3.8-flash`**, `maxOutputTokens=1200`이었고, embedding은 **`gemini-embedding-2`**,768차원이었습니다. 이 모델 설정은 전환 커밋 기준입니다. 이 구현은 로컬/provider fallback 경로를 유지하지 않았습니다.

### 구현: 제공자를 바꾸면서 grounding 유지

[Ollama의 prompt·record 구성](../cases/local-inference-to-gemini/before/ollama/generation.ts#L29-L38)과 [Gemini의 대응 코드](../cases/local-inference-to-gemini/after/gemini/generation.ts#L29-L38)는 같은 핵심 지시를 유지합니다. 제공된 record만 사용하고, record를 지시가 아닌 신뢰할 수 없는 근거로 취급하며, 사실을 만들지 않고, 확인 불가한 내용을 밝히고, 지원하는 record ID를 인용하도록 합니다.

제공자 요청 방식은 바뀌지만 이 grounding 의도는 유지됩니다. Gemini schema에는 `additionalProperties: false`도 추가됐습니다. [이전 schema](../cases/local-inference-to-gemini/before/ollama/generation.ts#L14-L21)와 [이후 schema](../cases/local-inference-to-gemini/after/gemini/generation.ts#L13-L21)를 비교할 수 있습니다. 두 구현에 응답 형태 검사와 citation 중복 제거가 있습니다. 형태 검사만으로 모든 문장이 해당 인용의 지원을 받는지 입증되지는 않습니다.

[당시 generation 테스트](../cases/local-inference-to-gemini/verification/generation.test.ts#L5-L31)는 지시처럼 보이는 문자열을 포함한 합성 record와 mock model을 사용해 전송 prompt·구조화 응답 계약을 검사합니다. 실제 모델의 prompt injection 방어 성능과 의미적 grounding 정확성은 이 mock 테스트의 검증 범위 밖입니다.

### 구현: embedding 계약 변경과 새 index

Gemini adapter는 [질문 입력](../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L32-L38)과 [문서 chunk 입력](../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L40-L50)을 구분합니다. 각 chunk를 제목·본문과 함께 독립적으로 embedding합니다. [Vector 검사](../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L8-L30)는 입력1개에 vector1개, 설정 차원, 숫자 원소와 유한값을 요구합니다.

이 버전의 문서 embedding은 순차 호출입니다. [Embedding 테스트](../cases/local-inference-to-gemini/verification/embeddings.test.ts#L10-L47)는 mock 응답으로 chunk 순서와 query prefix 계약을 기록합니다.

Index 호환성도 함께 바뀝니다.

- [Corpus fingerprint](../cases/local-inference-to-gemini/after/indexing/corpus.ts#L7-L44)는 청킹·source 식별 정보와 함께 schema version2, embedding model, 출력 차원과 embedding input version을 포함합니다.
- [Index builder](../cases/local-inference-to-gemini/after/indexing/indexer.ts#L25-L43)는 새 Gemini vector를 얻고 chunk 개수와 일치하는지 검사하며 모델·차원 metadata를 기록합니다.
- [Index reader](../cases/local-inference-to-gemini/after/indexing/store.ts#L20-L26)는 fingerprint/schema 불일치를 rebuild 오류로 거부합니다.
- [Fingerprint 테스트](../cases/local-inference-to-gemini/verification/corpus.test.ts#L5-L26)는 생성 모델 변경과 embedding 모델·차원 변경을 구분합니다. 이 fingerprint는 후자에서 바뀝니다.

전환 커밋은 원본 indexer·retrieval·answer 경로의 import도 Ollama에서 Gemini로 바꿨습니다. 공개 발췌는 관련 provider·index 메커니즘을 보여줍니다.

### 검증 결과와 한계

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

### 코드 원본성과 출처 추적

공개 코드 전체는 **Excerpt**입니다. 공개하지 않은 애플리케이션 파일을 참조하는 import도 포함해 원본 bytes를 보존합니다. 이름·제어 흐름·의존성 참조를 원래 구현대로 유지합니다. 출처표의 범위는 전체 파일 발췌의 유효 코드 행이며 파일 hash에는 원래 끝의 빈 줄도 포함합니다.

비공개 Synethos 원본은 커밋과 저장소 상대경로로 식별합니다. 비공개 저장소 URL,연구 대화 전문,원시 runtime 로그,로컬 사용자 경로와 API key 값은 공개하지 않습니다. 아래 표는 근거 식별자와 검증 한계를 기록합니다.


#### 전환 전 기준본

`cb299ce7f96888ab9ed4e49d69bfb3f6d59b30dc` — 2026-09-26 02:15:03 KST

| 공개 Excerpt | 원본 경로 | 원본 행 → 공개 행 |
|---|---|---|
| [before/ollama/client.ts](../cases/local-inference-to-gemini/before/ollama/client.ts#L1-L48) | `sveltekit/src/lib/server/ollama/client.ts` | 1–48 → 1–48 |
| [before/ollama/generation.ts](../cases/local-inference-to-gemini/before/ollama/generation.ts#L1-L67) | `sveltekit/src/lib/server/ollama/generation.ts` | 1–67 → 1–67 |
| [before/ollama/embeddings.ts](../cases/local-inference-to-gemini/before/ollama/embeddings.ts#L1-L33) | `sveltekit/src/lib/server/ollama/embeddings.ts` | 1–33 → 1–33 |

#### 전환 후 구현·테스트 기준본

`9a3df6134f3a68c012d98afa9fdc5f7f7cf5b264` — 2026-09-26 12:05:45 KST

| 공개 Excerpt | 원본 경로 | 원본 행 → 공개 행 |
|---|---|---|
| [after/gemini/client.ts](../cases/local-inference-to-gemini/after/gemini/client.ts#L1-L16) | `sveltekit/src/lib/server/gemini/client.ts` | 1–16 → 1–16 |
| [after/gemini/generation.ts](../cases/local-inference-to-gemini/after/gemini/generation.ts#L1-L69) | `sveltekit/src/lib/server/gemini/generation.ts` | 1–69 → 1–69 |
| [after/gemini/embeddings.ts](../cases/local-inference-to-gemini/after/gemini/embeddings.ts#L1-L50) | `sveltekit/src/lib/server/gemini/embeddings.ts` | 1–50 → 1–50 |
| [after/indexing/corpus.ts](../cases/local-inference-to-gemini/after/indexing/corpus.ts#L1-L45) | `sveltekit/src/lib/server/indexing/corpus.ts` | 1–45 → 1–45 |
| [after/indexing/indexer.ts](../cases/local-inference-to-gemini/after/indexing/indexer.ts#L1-L43) | `sveltekit/src/lib/server/indexing/indexer.ts` | 1–43 → 1–43 |
| [after/indexing/store.ts](../cases/local-inference-to-gemini/after/indexing/store.ts#L1-L36) | `sveltekit/src/lib/server/indexing/store.ts` | 1–36 → 1–36 |
| [verification/generation.test.ts](../cases/local-inference-to-gemini/verification/generation.test.ts#L1-L31) | `sveltekit/src/lib/server/gemini/generation.test.ts` | 1–31 → 1–31 |
| [verification/embeddings.test.ts](../cases/local-inference-to-gemini/verification/embeddings.test.ts#L1-L47) | `sveltekit/src/lib/server/gemini/embeddings.test.ts` | 1–47 → 1–47 |
| [verification/corpus.test.ts](../cases/local-inference-to-gemini/verification/corpus.test.ts#L1-L26) | `sveltekit/src/lib/server/indexing/corpus.test.ts` | 1–26 → 1–26 |

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

#### 개발 기록과 검증 근거

| 근거 | 출처 식별 | 뒷받침하는 내용·수준 |
|---|---|---|
| 기준 설정 | cb299ce의 config/mosaic.json, scripts/ollama.ps1 및 초기 runtime 기록 | 0.6B/4096context/120000ms/batch16,프로젝트 로컬 실행의 의도;코드 확인과 당시 기록 |
| 전환 구현 | 9a3df61의 위 소스와 config/mosaic.json | 로컬 호출 제거,Gemini3.8 생성·embedding2/768,새 index 계약;코드 확인 |
| 전환 검증 | 9a3df61의 docs/development-status.md, “Gemini Verification — 2026-09-26” | vector8개와한국어1질문·시간·retry/fallback없음;당시 보고 |
| 전환 결정 | 2026-09-26 03:50:47 KST의 보존된 개발자 요청 | 자원·안정성·응답시간을 이유로 로컬 중단·Gemini 전환;당시 판단의 기록 |
| 전원·저부하 기록 | 아래 식별한 보존 로그·산출물 | 환경·완료·측정값;전원 원인은 미확인 |

다음은 기존 연구에서 채록한 원본 식별용 hash입니다. 이번 공개 작업에서 다시 계산한 값은 위 코드 hash이며,아래 실험 파일을 새로 실행하거나 원본 전부를 재검증하지 않았습니다. 원시 파일과 대화 전문은 포함하지 않습니다.

| 보존 artifact 식별자 | 채록 SHA-256 |
|---|---|
| `qwen8b-ollama.err.log` | `e0136ac0b357a41caf1c7c2a35044cb36933d6ea39b20945f00ccfcc894b6032` |
| `qwen8b-ollama.out.log` | `a4c01228c7f3760075b7f0f051f9e9edd70239c2e2a293cfb77caff7ceddbcc5` |
| `low-load-validation-20260926-032121/summary.json` | `27d7170e3bfa75cb48c75ea149bfe1e53fda7b3082211b4b330cf6ebecf22668` |
| `low-load-validation-20260926-032121/response.json` | `d60f94b860af11ecdb337ab832c19111d3bcf7711c75f51aaab552f1d9f66ea3` |
| `low-load-validation-20260926-032121/ollama.err.log` | `5c26abd7230b0db96b57c3744c55727d0586b7c9e00761ba726701e9f3469321` |
| `low-load-validation-20260926-032121/memory-timeline.jsonl` | `d7689540ebbab20cbbf29af48a3232f211d29e35022627296f2ce52c98ae3bf3` |

검증 상태: Excerpt12개 원본 일치·TypeScript 구문·영문/한글 대응·파일/라인 링크를 확인했습니다. 모델 API,로컬 추론,애플리케이션 빌드와 당시 테스트 실행은 수행하지 않았습니다.

## 02 — From GitBook MCP to Local Knowledge

**개발 시기:** 2026-09-26 ~ 2026-09-28

**코드 분류:** Excerpt 14개와 Reconstructed manifest 표본 1개입니다.

**결과:** 원격 문서 candidate 경로를 철회하고 승인 Markdown을 유일한 지식 검색 source로 정리했으며, intent-coverage 평가는 유지했습니다. 문서 편입·corpus 준비와 전체 index build 완료는 별도 상태입니다.

### 문제와 초기 선택

GitBook은 Cosmic Horizon의 영문·한글 문서를 게시하고 MCP로 제공하던 플랫폼입니다. Synethos는 이 문서들을 외부 KnowledgeSource로 검토한 뒤 승인 Markdown을 Local Knowledge로 편입했습니다. 초기에는 문서 검색과 답변 생성의 책임을 분리해 GitBook MCP를 조사했습니다. 9월 26일의 보존된 요청은 Local RAG, API/UI, index와 ranking을 유지하는 되돌릴 수 있는 probe를 요구했습니다.

9월 27일 03:54:45의 foundation 커밋 f2914de는 [source 계약](../cases/gitbook-mcp-to-local-knowledge/foundation/source.ts#L1-L17)과 [Local/GitBook을 선택하는 factory](../cases/gitbook-mcp-to-local-knowledge/foundation/source-factory.ts#L11-L24)를 정의합니다. [Adapter의 허용 도구 타입](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L1-L37)은 searchDocumentation/getPage만 포함합니다. 서버가 askQuestion/sendFeedback을 노출해도 adapter에는 실행할 대응 메서드가 없었습니다. [Capability 관측](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L111-L121)은 이를 목록으로 확인하며 방문자 답변이나 feedback 전송에 사용하지 않았습니다.

근거 확보, 해석, 답변 생성은 서로 다른 책임으로 유지했습니다. 이 foundation 기준본의 probe 결과는 retrieval, generation, /api/ask, /api/search에 연결되지 않았습니다.

### Endpoint 관측에서 확인한 사실

서로 다른 세 관측 기록을 구분합니다.

| 관측 | 보존 근거와 범위 |
|---|---|
| 9월 26일 Single-Space probe | 과거 probe 보고서는 이전 단일 Space 구조의 raw 관측을 식별합니다. |
| 9월 27일 Two-Space/Site 관측 | Tracked 보고서는 Cosmic Horizon Global·Korean Space를 Site variant로 결합한 구조와 Global/Korean MCP endpoint의 독립 확인을 기록합니다. 이 확인에서 새 raw topology-probe 파일은 작성하지 않았습니다. |
| 9월 28일 09:44:31.093 Site-root probe | 별도 보존 JSON은 4검색, 각 10 text blocks·2 page results, 총 40 search blocks·8 page results를 기록합니다. Timestamp는 2026-09-28T00:44:31.093Z입니다. 27일의 두 endpoint 비교와 이 Site-root 실행은 별도 관측입니다. |

27일 보고서에 따르면 Global과 /kr/ 아래 endpoint는 같은 server identity, tool schema, capability, 검색 corpus, 결과 분포와 URL을 반환했습니다. 각 endpoint에서 반환한 page URL의 variant 분포는 다음과 같았습니다.

| 질문 | Global variant URL | Korean /kr/ URL |
|---|---:|---:|
| Why We Study | 9 | 1 |
| 왜 우리는 공부하는가? | 0 | 10 |

이 열은 반환 URL의 언어·variant를 구분합니다. 두 endpoint를 독립 지식 source로 등록하면 같은 다국어 corpus를 두 번 조회하게 됩니다.

검색 응답은 Title/Link/Content 행이 들어 있는 text block이었습니다. 보고서는 structuredContent, typed locale, Space identity, page/section ID, 번역 pair 관계, 검색 score가 없고 배열 순서만 있음을 기록합니다. Why We Study의 두 언어 문서 제목도 같을 수 있어 제목만으로 locale을 식별할 수 없었습니다. Repository 조사로 16↔16문서 pair 관계를 확인했습니다. 관측된 locale 단서는 /kr/ URL 경로였습니다.

28일 artifact에도 별도로 server version 0.27.2, 노출 도구 4개, structuredContent와 tool error 보고가 없는 검색 응답이 기록돼 있습니다. 공개 준비 중 이 저장 관측을 검토했습니다. Raw page 내용은 공개하지 않습니다.

### 구현: 방어적으로 읽는 근거 경계

[Adapter](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L67-L109)는 HTTPS endpoint를 검사하고, 비활성 source 사용과 다른 origin의 page 읽기를 거부하며 두 허용 연산을 제공합니다. [Probe 발췌](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-probe.excerpt.ts#L7-L54)는 원래 질문 목록, 결과 타입, 질문별 page 한도와 search/page orchestration을 보존합니다. 파일 저장 CLI와 raw-report 저장 코드는 제외했습니다.

이후 26a5409에 커밋된 [검색 결과 parser](../cases/gitbook-mcp-to-local-knowledge/multi-source/gitbook-search-results.ts#L15-L75)는 text field를 추출하고 부적합 URL을 거부합니다. Origin·Site 경로, credential, query/fragment, 인코딩된 경로 구분자·이탈 경로와 MCP endpoint 자체를 검사합니다. 원래 resultIndex를 보존하지만 provider score를 부여하거나 typed locale/pair identity를 추정하지 않습니다. 빈 결과와 비어 있지 않지만 사용할 수 있는 항목이 없는 결과도 구분합니다.

[당시 adapter 테스트](../cases/gitbook-mcp-to-local-knowledge/verification/gitbook-mcp-source.test.ts#L27-L104)는 합성 client로 도구 제한, 실행 없는 capability 관측, 비활성 source와 cross-origin page 거부를 검사합니다. 합성 client를 사용한 adapter 계약 테스트입니다.

### Source를 결합하자 드러난 다른 문제

9월 27일에는 Local candidate와 최종 answer evidence를 분리하고, 다중 source 수집과 ranking을 차례로 추가했습니다. 이후 다중 source 기준본의 [수집 코드](../cases/gitbook-mcp-to-local-knowledge/multi-source/source-candidates.ts#L23-L58)는 설정의 knowledgeSourceId를 보존하고 Local candidate와 파싱한 GitBook hit를 구분합니다. GitBook client는 finally에서 닫으며, 최종 citation은 evidence 선택 단계에서 부여합니다.

[Ranking](../cases/gitbook-mcp-to-local-knowledge/multi-source/relevance.ts#L23-L64)은 Local cosine score를 유지하고 GitBook query·document hit를 embedding해 cosine 기반 relevance score를 구합니다. 원래 MCP 결과 순위는 metadata로 유지합니다. Source 간 score 보정 수준은 미검증입니다.

[다중 source intent 발췌](../cases/gitbook-mcp-to-local-knowledge/multi-source/intent-orchestration.excerpt.ts#L1-L22)는 원문·derived query를 계획하고 query마다 수집·ranking한 뒤 merge에 위임하는 다음 계층을 보여줍니다. Identity에는 설정 source와 문서 ID 또는 public URL이 포함됩니다. 이 identity 규칙에서 같은 URL도 설정 source ID가 다르면 별도 candidate가 됩니다. 이 구현에는 source 간 번역 pair 중복 제거가 없습니다.

9월 28일 10:38:04의 보존된 사용자 메시지는 derived query가 Verification Philosophy를 25→2위, Human Auditor를 9→2위로 올렸다고 보고합니다. 그러나 초기 full round-robin merge가 기존 AI-role 근거를 4→9위로 밀어 mixed 질문 recall@5는 0.5에 머물렀습니다. 전체 live harness는 약 19.3→34.3초로 늘고 embedding provider 오류도 관측됐습니다. 사용자는 분해의 개선을 버리는 대신 실제 lane 순서와 candidate identity로 merge placement를 재검토하도록 했습니다.

해당 메시지의 UTC는 2026-09-28T01:38:04.008Z입니다. 공개 기준본에는 이후 수정된 orchestration이 들어 있습니다. 당시 유지한 merge 정책은 holistic seed, 의도별 상위 anchor, derived tail보다 앞선 original-query backbone을 사용했습니다.

11:45:32의 후속 요청은 2-intent 질문에서 약 6 embedding·3 GitBook search와 무료 티어 100 RPM의 429 관측을 기록합니다. 이를 바탕으로 fan-out과 중복 embedding 작업을 조사했습니다. 이 관측은 당시 보고에서 가져왔으며, MCP 철회 결정에서 차지한 상대적 비중은 미확인입니다.

[수집 테스트](../cases/gitbook-mcp-to-local-knowledge/verification/source-candidates.test.ts#L6-L85)는 합성 fixture로 provenance와 원래 ranking signal 보존 계약을 표현합니다. 다중 source·intent 작업은 평가 경로에서 다뤘고, production answer/search route는 기존 Local 단일 query 검색을 사용했습니다.

### 판단: 문서 편입을 먼저 하고 원격 source 제거

9월 28일 12:07:16.238 사용자는 제공한 EN/KR Markdown snapshot을 Local Knowledge에 편입하고 향후 Local 중심으로 검색을 단순화하기로 명시했습니다. 당장의 범위는 import, manifest 등록, index 준비였으며 MCP 코드 제거는 다음 단계로 뒀습니다.

12:45:49.898에는 42문서·475 chunks 편입 완료와 daily embedding quota로 index rebuild가 막힌 상태를 구분해 MCP 제거 범위 분석을 요청했습니다. 13:50:33 후속 요청은 편입·MCP 제거를 이미 존재하는 미커밋 변경으로 보존하면서 다음 embedding-target 작업을 시작하도록 했습니다. 결합된 구현은 14:50:04에 5f71fbe로 커밋됐습니다.

Source 단순화와 단계별 범위는 기록된 사용자 선택입니다. Metadata 한계, 중복 corpus 조회, 요청 비용, 재현성, 수동 승인 경계 중 무엇이 철회의 주된 동기였는지는 확인되지 않았습니다.

### 구현: 승인 Local 파일과 공개 인용 출처

전환은 GitBook adapter, parser, probe, source factory·계약, 원격 결과 공통 relevance 계층과 MCP dependency를 제거했습니다. Runtime의 지식 검색 source는 knowledge/sources.json에 등록한 승인 Markdown이 됐습니다. 공개 문서 URL은 실시간 검색 endpoint 대신 인용 metadata로 유지했습니다. Knowledge import는 수동이며 원격 자동 동기화는 추가하지 않았습니다.

[승인 source loader](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/manifest.ts#L16-L49)는 manifest 형태, ID·중복, file/title, 경로 경계, Markdown 확장자와 publicUrl protocol을 검사한 뒤 등록 파일을 읽습니다. 등록 여부는 manifest로 관리합니다.

[Reconstructed manifest 표본](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/approved-sources.sample.json#L1-L17)은 전환 manifest의 Why We Study 두 항목을 골라 새 2항목 문서로 구성했습니다. 제목은 같지만 ID·local file 경로·public URL은 다릅니다. 42문서 manifest에서 항목을 선택했으며 전체 manifest와 문서 본문은 비공개로 유지합니다.

[Local 검색 경로](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/search.ts#L47-L121)는 일치하고 사용 가능한 target index를 요구하고, 질문을 embedding해 Local chunk를 ranking한 뒤 evidence를 선택합니다. [Evidence 선택](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/search.ts#L99-L113)은 sourceId, title, section, content, publicUrl을 유지하고 선택한 record에 citation ID를 부여합니다. Local-only는 지식 검색 source의 범위이며 query embedding은 여전히 외부 provider를 호출할 수 있습니다.

[Local intent 발췌](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/intent-orchestration.excerpt.ts#L1-L25)는 계획·merge 위임을 유지하면서 원격 source 수집·ranking을 Local candidate 검색으로 바꿉니다. 기본 경로는 query bundle을 하나의 embedding target에서 실행하고 해당 target을 run과 함께 반환합니다. Source identity는 Local chunk identity가 됩니다. 같은 전환에서 query embedding을 위한 embedding-provider fallback도 추가했습니다. Provider adapter의 상세 구현은 이번 발췌 범위 밖입니다.

[Local query 테스트 발췌](../cases/gitbook-mcp-to-local-knowledge/verification/local-query-search.excerpt.test.ts#L13-L42)는 주입한 검색 함수로 계획 query마다 Local 검색 1회를 확인합니다. 실제 target index, provider fallback, live 답변 품질을 검증하지 않습니다.

### Corpus 준비와 index 준비는 다른 상태

전환 보고서는 다음 상태를 구분합니다.

| 9월 28일의 상태 | 기록된 결과와 한계 |
|---|---|
| 승인 문서 | 기존 10개와 Cosmic Horizon Global 16개·Korean 16개, 총 42개. |
| Corpus 준비 | 등록 Markdown에서 475 chunks 생성. |
| 앞선 Gemini build | Chunk embedding 50개 성공 뒤 HTTP 429 RESOURCE_EXHAUSTED. Partial index는 기록하지 않음. |
| 이전 singleton artifact | 기존 55 chunk index는 현재 corpus와 target별 저장 schema에 유효하지 않음. |
| 5f71fbe의 전체 target index | Document-embedding batching을 다룰 때까지 build 보류. Live relevance/API retrieval 검증도 대기. |
| 23:59:41의 이후 dadffe3 보고 | Provider 소유 batching은 구현했지만 전체 live build는 별도 승인 대기. 14:50 전환과 다른 snapshot. |
| 해당 이후 보고의 임시 provider smoke | Target마다 합성 문서 2개·질문 1개, 768/1536차원, 관련 문서 1위. 임시 mini-index 삭제, production index 미생성. |

구현과 준비된 corpus는 Local Knowledge 방향을 뒷받침하지만, 이 사례 범위의 보존 기록으로 전체 475 chunk production index 완료를 확정하지 않습니다. 설계 구현, 작은 smoke 성공, 전체 corpus build, production 검색 품질은 완료 조건이 다릅니다.

### 달라진 점·유지한 점·미확인 사항

원격 문서 source를 제거하면서 승인 문서 등록, vector retrieval, 공개 인용 출처, 규칙 기반 intent 계획과 coverage 평가는 유지하거나 조정했습니다. 전환 동기의 우선순위와 전체 index 검색 품질은 아래와 같이 미확인으로 남깁니다.

최종 철회 동기들의 상대적 비중, 앞선 raw probe 실행의 전체 대응, 전환 시점에 완성된 전체 index를 사용한 end-to-end 검색 품질은 미확인입니다. 초기 round-robin 회귀는 당시 보고된 실패로 남기며, 공개 코드는 이후 수정본을 기록합니다. 이번 공개를 위해 MCP probe, embedding, index build, 애플리케이션 테스트를 재실행하지 않았습니다.

### 출처 추적과 공개 방식

전체 파일 Excerpt는 원본 bytes를 보존합니다. 일부 Excerpt는 명시한 원본 구간의 이름·문장을 바꾸지 않고 빈 줄로 선언을 연결합니다. 선택된 원래 import와 공개하지 않은 애플리케이션 type/helper 참조도 유지합니다. 테스트 발췌는 바깥 suite를 제외하고 선택한 import·fixture helper·test 본문을 보존했습니다. 발췌에는 주변 애플리케이션 참조가 유지돼 있습니다.

Reconstructed 파일은 2항목 JSON 표본 하나입니다. Version·항목 필드는 식별한 manifest에서 가져왔지만 항목 선택과 새 envelope 구성은 편집입니다. 비공개 raw 응답, 비공개 저장소 URL, secret, 로컬 사용자 경로와 무관한 승인 source 항목은 제외했습니다.

아래 커밋은 비공개 원본의 snapshot 식별자입니다. 시각은 별도 UTC 표기 외 모두 KST(UTC+09:00)이며 커밋 시각과 개발 사건의 시각을 구분합니다.

| 기준본 | 원본 커밋 | 커밋 시각 |
|---|---|---|
| foundation | `f2914dee1d602a8ff1e3b7c7f800ed5e92f8edaf` | 2026-09-27 03:54:45 |
| parser | `26a5409614fc17af1a01e83295f6d017392c87a3` | 2026-09-27 21:30:17 |
| multi | `430c3755aabe94aa5b7c6b18798ea41af8bc11ab` | 2026-09-28 11:46:31 |
| local | `5f71fbece8a7d7caa28d01d655d8b02d614472cf` | 2026-09-28 14:50:04 |
| later | `dadffe361c617c9db9840696b615b7cc3a0e8fcd` | 2026-09-28 23:59:41 |

#### 코드 대응표

원본 경로는 비공개 저장소 기준이며 공개 링크는 Tessera 파일로 연결합니다. 구간은 양 끝을 포함하고 `원본 → 공개` 순서입니다. 전체 파일 공개도 분류는 Excerpt입니다.

| 공개 파일 | 기준본 · 원본 경로 | 분류 · 발췌 대응 |
|---|---|---|
| [foundation/source.ts](../cases/gitbook-mcp-to-local-knowledge/foundation/source.ts#L1-L17) | foundation · `sveltekit/src/lib/server/knowledge/source.ts` | Excerpt (전체) · 1–17 → 1–17 |
| [foundation/source-factory.ts](../cases/gitbook-mcp-to-local-knowledge/foundation/source-factory.ts#L1-L24) | foundation · `sveltekit/src/lib/server/knowledge/source-factory.ts` | Excerpt (전체) · 1–24 → 1–24 |
| [foundation/gitbook-mcp-source.ts](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L1-L129) | foundation · `sveltekit/src/lib/server/knowledge/gitbook-mcp-source.ts` | Excerpt (전체) · 1–129 → 1–129 |
| [foundation/gitbook-probe.excerpt.ts](../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-probe.excerpt.ts#L1-L54) | foundation · `sveltekit/src/lib/server/knowledge/gitbook-mcp-probe.ts` | Excerpt · 5–9 → 1–5; 12–17 → 7–12; 19–19 → 14–14; 21–26 → 16–21; 28–33 → 23–28; 66–90 → 30–54 |
| [multi-source/gitbook-search-results.ts](../cases/gitbook-mcp-to-local-knowledge/multi-source/gitbook-search-results.ts#L1-L75) | parser · `sveltekit/src/lib/server/knowledge/gitbook-search-results.ts` | Excerpt (전체) · 1–75 → 1–75 |
| [multi-source/source-candidates.ts](../cases/gitbook-mcp-to-local-knowledge/multi-source/source-candidates.ts#L1-L58) | multi · `sveltekit/src/lib/server/retrieval/source-candidates.ts` | Excerpt (전체) · 1–58 → 1–58 |
| [multi-source/relevance.ts](../cases/gitbook-mcp-to-local-knowledge/multi-source/relevance.ts#L1-L64) | multi · `sveltekit/src/lib/server/retrieval/relevance.ts` | Excerpt (전체) · 1–64 → 1–64 |
| [multi-source/intent-orchestration.excerpt.ts](../cases/gitbook-mcp-to-local-knowledge/multi-source/intent-orchestration.excerpt.ts#L1-L22) | multi · `sveltekit/src/lib/server/retrieval/intent-coverage.ts` | Excerpt · 51–55 → 1–5; 127–142 → 7–22 |
| [local-knowledge/manifest.ts](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/manifest.ts#L1-L49) | local · `sveltekit/src/lib/server/knowledge/manifest.ts` | Excerpt (전체) · 1–49 → 1–49 |
| [local-knowledge/search.ts](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/search.ts#L1-L121) | local · `sveltekit/src/lib/server/retrieval/search.ts` | Excerpt (전체) · 1–121 → 1–121 |
| [local-knowledge/intent-orchestration.excerpt.ts](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/intent-orchestration.excerpt.ts#L1-L25) | local · `sveltekit/src/lib/server/retrieval/intent-coverage.ts` | Excerpt · 45–47 → 1–3; 119–139 → 5–25 |
| [verification/gitbook-mcp-source.test.ts](../cases/gitbook-mcp-to-local-knowledge/verification/gitbook-mcp-source.test.ts#L1-L104) | foundation · `sveltekit/src/lib/server/knowledge/gitbook-mcp-source.test.ts` | Excerpt (전체) · 1–104 → 1–104 |
| [verification/source-candidates.test.ts](../cases/gitbook-mcp-to-local-knowledge/verification/source-candidates.test.ts#L1-L85) | multi · `sveltekit/src/lib/server/retrieval/source-candidates.test.ts` | Excerpt (전체) · 1–85 → 1–85 |
| [verification/local-query-search.excerpt.test.ts](../cases/gitbook-mcp-to-local-knowledge/verification/local-query-search.excerpt.test.ts#L1-L42) | local · `sveltekit/src/lib/server/retrieval/intent-coverage.test.ts` | Excerpt · 1–1 → 1–1; 2–2 → 3–3; 3–3 → 5–5; 4–8 → 7–11; 10–20 → 13–23; 85–102 → 25–42 |
| [local-knowledge/approved-sources.sample.json](../cases/gitbook-mcp-to-local-knowledge/local-knowledge/approved-sources.sample.json#L1-L17) | local · `knowledge/sources.json` | Reconstructed · 선택 ID는 아래에 명시; 새 JSON 구성 |

JSON 선택 항목:
- `cosmic-horizon-en-perspective-why-we-study`
- `cosmic-horizon-kr-perspective-why-we-study`

#### 코드 외 근거

| 기록 | 식별자 · 범위 |
|---|---|
| foundation · `docs/gitbook-mcp-probe.md` | `f2914dee1d602a8ff1e3b7c7f800ed5e92f8edaf`; SHA-256 `e661c51b09bc84a0b0224fd7c1063ab10b8618a4761f7fc6f1f45c451614c11f` |
| parser · `docs/development-status.md` | `26a5409614fc17af1a01e83295f6d017392c87a3`; SHA-256 `bf86fc39c7c6fd9b67605c80271bedbd969db7d5529d211b8874277aeaad5200` |
| multi · `docs/development-status.md` | `430c3755aabe94aa5b7c6b18798ea41af8bc11ab`; SHA-256 `bf86fc39c7c6fd9b67605c80271bedbd969db7d5529d211b8874277aeaad5200` |
| local · `docs/development-status.md` | `5f71fbece8a7d7caa28d01d655d8b02d614472cf`; SHA-256 `cd391e419000613362ac2c09cc48db13304dee65cfecad3cdd50b0bfc03423d5` |
| later · `docs/development-status.md` | `dadffe361c617c9db9840696b615b7cc3a0e8fcd`; SHA-256 `76bd9837403684e0d0137da558d7c438a020fab212588d046b81eb359f51a1c1` |
| 보존 Site-root probe | `gitbook-2026-09-28T00-44-31.093Z.json`; SHA-256 `8989e48c4fc7b5422290c7c3d8d87af871768bb35090679726725fdc73b24f43`. 위에서 구분한 28일 실행의 관측에만 사용. |
| 보존 사용자 요청 | 9월 26일 초기 probe 범위, 9월 28일 10:38:04.008 merge 회귀, 11:45:32 fan-out, 12:07:16.238 편입 결정, 12:45:49.898 편입·index 상태, 13:50:33 기존 변경 보존. 메시지 원본은 비공개 보존. |

10:38:04.008의 UTC 원본은 `2026-09-28T01:38:04.008Z`입니다. 통합 조사 문서의 11:38 표기는 이 원본과 대조해 공개본에서 정정했습니다. 개발 사건의 시각은 당시 원본 기록을 따릅니다.

<details>
<summary>원본·공개 코드 SHA-256</summary>

원본 hash는 선택한 커밋의 전체 파일 기준입니다. 공개 hash는 Tessera 파일 기준이므로 일부 발췌와 재구성은 hash가 다릅니다.

| 공개 파일 | 원본 전체 파일 SHA-256 | 공개 파일 SHA-256 |
|---|---|---|
| `foundation/source.ts` | `3561b60540947e349086dbfe78d904e23081867c3d4b6fc6a23aa2f41262e724` | `3561b60540947e349086dbfe78d904e23081867c3d4b6fc6a23aa2f41262e724` |
| `foundation/source-factory.ts` | `c22b6faac2aa4ae25ceabcbec13c2cc69417403ea7df38a2197ee1b7f37fc70b` | `c22b6faac2aa4ae25ceabcbec13c2cc69417403ea7df38a2197ee1b7f37fc70b` |
| `foundation/gitbook-mcp-source.ts` | `41ba8cbad6602c106649529b51ce6eb4b2fd9fc84bc7b4c041a7dbf3988e9cdc` | `41ba8cbad6602c106649529b51ce6eb4b2fd9fc84bc7b4c041a7dbf3988e9cdc` |
| `foundation/gitbook-probe.excerpt.ts` | `66957c2d9d74b2b9c75c0ccd3f112e8767f06e9cb034c5442d7311f87112f15c` | `4e38d14fe7a0e40d18a8510a9a2e029475a934c61f5fde45bbfd4b60acb746ad` |
| `multi-source/gitbook-search-results.ts` | `3c0f8d12aae578987fd4e2162cc6c28bf9ef39a8bd29d5427fca9f7a56087fe3` | `3c0f8d12aae578987fd4e2162cc6c28bf9ef39a8bd29d5427fca9f7a56087fe3` |
| `multi-source/source-candidates.ts` | `073ef8659ef58f88c498253447639fcd40d9508f027ba2cf8e75433923281282` | `073ef8659ef58f88c498253447639fcd40d9508f027ba2cf8e75433923281282` |
| `multi-source/relevance.ts` | `9af7447eac44a31f9310ce665b1420e92231ec2aeb6ed43b50c0aa434ccee0bc` | `9af7447eac44a31f9310ce665b1420e92231ec2aeb6ed43b50c0aa434ccee0bc` |
| `multi-source/intent-orchestration.excerpt.ts` | `5cc35973726a1efe5fde0054b6b5d6c1d17d9b3e9d37c376bdbc72b22d9a07b5` | `96a789a8f1a95c60a984d04bde6aabd3952275f79423b7ca281d086b08da5d42` |
| `local-knowledge/manifest.ts` | `cec89c673310a6e308cec4ab77001006641407c767ff4ad73531c99c6362f034` | `cec89c673310a6e308cec4ab77001006641407c767ff4ad73531c99c6362f034` |
| `local-knowledge/search.ts` | `e07a61b8fef8ecb3a2beed38c92a2f6c610c829a83df074875f893c16ba052f9` | `e07a61b8fef8ecb3a2beed38c92a2f6c610c829a83df074875f893c16ba052f9` |
| `local-knowledge/intent-orchestration.excerpt.ts` | `ceec91ca7af9e2229e167361d303b4f202e5721bc81c489904012541942de186` | `a7919d04f415d8da78d8e0cdb5ee737942b508b72475eff464b7a32817ae0409` |
| `verification/gitbook-mcp-source.test.ts` | `0d44e4dc6d03aafadf0258d710bfeb2ef0b1cef664c17e732e37270816898cbb` | `0d44e4dc6d03aafadf0258d710bfeb2ef0b1cef664c17e732e37270816898cbb` |
| `verification/source-candidates.test.ts` | `d712774bbd6c9e2043f195f84e5bd398c3355edaa906a8f71d34dc07bc287075` | `d712774bbd6c9e2043f195f84e5bd398c3355edaa906a8f71d34dc07bc287075` |
| `verification/local-query-search.excerpt.test.ts` | `4e3a715b5c852a03f897305c5c4d017d40d88d303f3b72b5279adec3456785d0` | `0c351e821cf2c253a49351d2747a0c6c98d1d3ce27505fb15f4ef48a6abbbabb` |
| `local-knowledge/approved-sources.sample.json` | `e350834f62a54a0578459651edf8cc05c5360aaa415975262f661991ee060e09` | `457c5e9888b4725004a0ac7ad4b5c7781e8d269a3875576a9f7749f192c7f125` |

</details>

### 공개본 검증

전체 파일 Excerpt 10개의 bytes·SHA-256과 일부 Excerpt 4개의 모든 발췌 구간을 원본 Git 객체와 대조했습니다. 재구성 JSON의 version과 두 항목은 원본 manifest와 일치합니다. TypeScript 14개는 구문 분석을 통과했습니다. 이 검사는 원본의 계약 테스트 실행이나 live 검색·embedding 검증과 구분합니다.

영문·한글의 사건, 날짜, 수치, 조건, 출처 대응표와 코드 링크를 대조했습니다. README → 사례 헤딩 → 코드 라인 링크의 파일·앵커·범위를 검사했고, 첫 사례의 코드 12개와 공통 설명 이동 외 본문을 보존했습니다. 공개 파일에서 자격 증명 값, 비공개 저장소 URL, 로컬 사용자 경로와 원본 문서 본문을 점검했습니다.

## 03 — Cohere 도입·평가·제거

**개발 시기:** 2026-09-28 ~ 2026-10-17

**코드 분류:** Excerpt 19개와 Reconstructed JSON 기록 2개입니다.

**결과:** Cohere는 embedding fallback에서 generation·classifier 평가 대상으로 확대됐습니다. 사용자는 관측된 이점과 Synethos의 규모, 대체 가능성, 운영 비용을 종합해 최종적으로 Gemini 단일 embedding과 Gemini→Groq generation을 선택했습니다.

### 개발 순서

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

### 대체 embedding space 도입

9월 28일 개발 보고서는 앞선 Gemini 문서 build에서 chunk embedding 50개 성공 뒤 daily quota에 도달했다고 기록합니다. Gemini의 `gemini-embedding-2` 768차원 뒤에 `embed-v4.0` 1536차원을 도입했습니다. 최초 도입 동기의 전체 우선순위를 확인할 대화 기록은 아직 불완전합니다.

[최초 HTTP client](../cases/cohere-lifecycle/embedding/initial/client.ts#L22-L54)는 native `fetch`로 `/v2/embed`를 호출하고 target 출력 차원의 float vector를 요청합니다. [최초 adapter](../cases/cohere-lifecycle/embedding/initial/embedding.ts#L19-L45)는 질문에 `search_query`, 제목·본문 문서에 `search_document`를 사용하고 반환 vector 개수를 검사합니다. 각 target은 자신의 embedding space에 맞는 index를 요구합니다.

[Fallback loop](../cases/cohere-lifecycle/embedding/initial/target-fallback.ts#L23-L44)는 index 도달 가능성과 credential을 확인하고 순서대로 target을 시도하며 분류된 fallbackable provider 실패에서 다음 target으로 이동합니다. Current index의 credential blocker는 작업을 중단합니다. [합성 fallback 테스트](../cases/cohere-lifecycle/embedding/initial/target-fallback.test.ts#L20-L42)가 두 경로를 표현합니다.

이후 [batching adapter](../cases/cohere-lifecycle/embedding/batched/embedding.ts#L9-L51)는 선호·최대 document batch를 96개로 선언합니다. [테스트](../cases/cohere-lifecycle/embedding/batched/embedding.test.ts#L9-L39)는 다국어 문서 순서와 97개 입력 거부를 확인합니다. 제거 직전 [HTTP 실패 테스트](../cases/cohere-lifecycle/embedding/pre-retirement/client.test.ts#L26-L53)는 부가 정보 없는 429를 neutral·fallbackable로 유지하고 Retry-After를 정규화합니다. 각 파일은 해당 원본 시점을 유지합니다.

Build 보고서에는 별도 실행들이 기록돼 있습니다. 한 과거 build는 Gemini 32문서 요청 3회 성공 뒤 네 번째 요청에서 실패했으며 진단 정보가 충분히 보존되지 않았습니다. 같은 실행의 Cohere는 6회 요청을 완료하고 당시 current cache artifact를 만들었습니다. 별도 9월 29일 525chunks 실행은 Cohere batch 5개 성공 뒤 6/6에서 HTTP 429를 받았고 미완성 target은 publish하지 않았습니다. `5615b4c` 보고의 새 bounded retry 정책 검증은 mock 기반이며 live retry 검증은 대기 상태였습니다.

[Reconstructed 설정 이력](../cases/cohere-lifecycle/configuration/target-history.json#L1-L227)은 커밋된 example 설정 5개의 generation·embedding 필드를 선택해 보존합니다. `1c0f28e`는 runtime embedding에 Cohere만 선택했고, 이후 `180cc30`은 Gemini 다음 Cohere를 선택했습니다. 최초 Cohere 단독 전환 이유는 미확인입니다.

### Generation으로 평가 확대

9월 30일 `b00bf59`에서 generation registry에 `command-a-plus-05-2026`을 추가했습니다. [Generation client](../cases/cohere-lifecycle/generation/generation-client.ts#L7-L35)는 HTTP·transport·timeout 실패를 분류합니다. [Generation adapter](../cases/cohere-lifecycle/generation/generation.ts#L6-L26)는 공통 system/user prompt와 response schema를 `/v2/chat` 요청으로 옮기고 지원 옵션을 전달하며 COMPLETE 종료를 요구하고 text block을 결합합니다. [계약 테스트](../cases/cohere-lifecycle/generation/generation.test.ts#L12-L63)는 옵션 변환, usage metadata, 미완료 출력과 정규화 오류를 다룹니다. 공개 테스트 기준본의 출력 한도는 9월 30일의 1200이며 이후 10월 2일 설정에는 32768이 기록돼 있습니다.

[Shared-evidence 비교](../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.ts#L45-L90)는 저장 retrieval snapshot을 검증하고 target별 evidence를 복제하며 snapshot·prompt·evidence·citation 순서의 identity를 기록합니다. 각 명시적 target은 retryPolicy `none`으로 별도 결과를 남기며 응답 형태·인용 검증과 claim review 대기 상태를 함께 기록합니다. [선택한 테스트](../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.test.ts#L27-L77)는 입력 동일성, snapshot 재사용, 개별 target 실패, 인용 검사와 credential 분리를 다룹니다.

### 10월 1일: 질문 대상과 record 화자

공통 prompt에는 `Describe yourself as Synethos`가 있었고 검색 record에는 류승원의 1인칭 글이 포함돼 있었습니다. 사용자는 응답자 정체성, 질문 대상과 record의 실제 화자가 만나는 문제를 조사했습니다. 보존 세션은 고정 retrieval context를 사용한 여러 prompt 수정 단계를 기록합니다.

| 보고 시각 | 조건과 당시 보고 결과 |
|---|---|
| 13:47:45.250 | 질문 5개×조합 4개×반복 3회: 계획 60회, 응답 59개와 Gemini generation 429 1회. |
| 16:43:18.624 | 고정 context 2개×generation provider 2개×질문 8개×반복 3회: 96회. 대상 유지 Cohere 48/48, Gemini 42/48. |
| 같은 보고의 후속 단계 | 표현 수정 뒤 문제 경력 질문 12회 추가 확인. 두 단계 합계 대상 유지 Cohere 54/54, Gemini 42/54. |
| 17:04:10.538 | 로컬 Cohere 단독 generation, context 2개×질문 10개×반복 3회: HTTP 200 응답 60개. 대상 변경·화자 혼동 관측 0회. 이름 표기 위반 22/60, 의미적 citation 누락·grounding 오류 잔존. 신규 embedding·Gemini generation 호출 0회. |

이 수치는 각 prompt revision에서 보고된 대상 유지·출력 품질 관측입니다. 세션은 60응답 실행의 결과 파일을 만들지 않았다고 기록하므로 응답별 독립 검토 자료는 확보되지 않았습니다. 17:13:29 routing은 미커밋 상태였고 17:32:44 Git 선언은 해당 4개 파일을 제외했습니다. `496e95e`는 17:34:31 질문 대상 규칙 단순화를 커밋했습니다. 로컬 routing 관측과 커밋된 prompt 변경은 각각의 범위로 기록합니다.

### 10월 3일: 고정 입력 generation 결과와 fallback 선택

통합 조사에는 모델마다 같은 저장 evidence·질문·prompt·schema를 사용한 fresh 3-way 비교가 기록돼 있습니다. 모델별 응답 40개, 전체 성공 요청 120회입니다.

| 모델 | Fully correct | Grounding 실패 | Contract 실패 | 평균 generation 지연 |
|---|---:|---:|---:|---:|
| Gemini 3.5 Flash Lite | 27/40 | 0 | 1 | 1.508초 |
| Cohere Command A+ | 22/40 | 3 | 4 | 3.042초 |
| Groq GPT-OSS 120B | 25/40 | 2 | 0 | 1.524초 |

현재 checkout에는 원본 full40 디렉터리가 없으며 보고서 식별자와 채록 hash를 출처표에 보존합니다. 이 표의 수준은 기존 조사에 채록된 실험 보고입니다. 커밋된 `0baebd9` 설정은 이후 runtime 상태를 확인해 줍니다. Gemini generation primary, Groq GPT-OSS fallback이며 Cohere는 명시적 평가 대상으로 등록돼 있습니다. 10월 1일 대상 유지, 이 full40 판정과 이후 검색 diagnostic은 각각의 지표·조건을 유지합니다.

### 10월 6일: classifier gate에서 후속 실험 중단

Cohere 실험은 질문만 입력으로 사용해 `command-a-plus-05-2026`에 질문 20개를 각각 1회 보냈습니다. 정답 label 고정 18개와 탐색 2개이며, 두 필드 enum/boolean schema, 출력 한도 512tokens, temperature 0, thinking 비활성화, retry·provider fallback 없는 단일 dispatch 조건이었습니다. Artifact 시각은 2026-10-06T07:05:37.753Z~07:05:47.618Z입니다.

[Classifier 계약](../cases/cohere-lifecycle/evaluation/classifier-contract.excerpt.ts#L3-L22)은 정확히 `intent`·`requiresCompleteSet`을 요구합니다. [Gate](../cases/cohere-lifecycle/evaluation/classifier-contract.excerpt.ts#L24-L43)는 intent ≥17/18, complete-set 18/18, 필수 L1/A1/A6 정답, lookup/aggregate 혼동 0, compare/synthesis ≥6/7, JSON 20/20과 API 실패 0을 요구합니다. [Reconstructed 관측 기록](../cases/cohere-lifecycle/evidence/observed-results.json#L3-L69)은 저장된 summary·호출 수를 보존합니다.

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

### 10월 15일: 검색에서 관측된 이점

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

[근거 순위 계산](../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L151-L167)은 OR 대안을 평가하고 AND 대안의 모든 항목을 요구하며 그중 가장 낮은 순위를 사용합니다. [문항 평가](../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L236-L281)는 original·merged 순위를 기록하고, [diagnostic runner](../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L302-L325)는 corpus/index identity를 확인하고 target 하나를 고정합니다. [지표 테스트](../cases/cohere-lifecycle/evaluation/retrieval-evaluate.test.ts#L107-L161)는 unsupported 문항, AND/OR 대응과 선택 evidence·diagnostic coverage 분리를 다룹니다. [Reconstructed 검색 summary](../cases/cohere-lifecycle/evidence/observed-results.json#L70-L137)는 보존 순위에서 집계값을 다시 계산하고 question-bank/profile identity를 유지합니다.

### 제거 판단: 규모·운영 비용과 성능 이점의 비교

**당시 판단, 10월 16일 21:02:47.996:** 기존 조사는 Cohere 검색 품질과 build 속도·편의성을 인정하면서 무료 production 운영을 우선한 사용자 요청을 채록했습니다. 당시 이해한 Trial key의 production 제약·Production key 과금 조건과, 사전 생성 index를 사용해도 같은 space의 Cohere query embedding 호출이 필요하다는 점을 기록했습니다. 개발/evaluation 전용 유지와 완전 제거를 비교했습니다. 등록된 보관 세션 원본은 현재 checkout의 해당 경로에서 확보되지 않아 이 내용은 기존 조사 채록 수준으로 유지합니다.

**공개 준비 중 사용자가 직접 밝힌 판단 근거, 2026년 10월 29일:** Cohere는 일부 평가에서 Gemini보다 좋은 성능을 보였지만, Synethos 규모에서는 관측된 차이가 과금을 정당화할 만큼 크지 않았습니다. 성능 차이가 훨씬 크거나 서비스가 더 크고 복잡했다면 비용을 지불하는 도입도 고려했을 것입니다. 최종 판단은 실제 성능 차이, 서비스 규모, 대체 가능성과 운영 비용을 종합한 결정이었습니다.

완전 제거는 credential·adapter·별도 index·평가 matrix·테스트 관리 범위를 줄였습니다. 동시에 실제 embedding fallback, 빠른 개발 인덱싱과 Cohere 비교 경로의 직접 재실행을 포기했습니다. 위 성능 관측은 이 tradeoff의 근거로 유지합니다. 실측 청구 총액과 수치화된 비용·편익 임계값은 기록에서 확인되지 않습니다.

### 제거 구현과 index 인계

`e700717`은 Cohere HTTP client·adapter와 테스트, factory 등록, provider 옵션, 설정·example binding과 현재 평가 선택지를 제거했습니다. Client는 native `fetch` 구현이었습니다. [제거 후 embedding factory](../cases/cohere-lifecycle/after-removal/embedding-provider-factory.ts#L12-L24)는 Gemini를, [generation factory](../cases/cohere-lifecycle/after-removal/generation-provider-factory.ts#L17-L33)는 Gemini·Groq를 지원합니다. [옵션 검사](../cases/cohere-lifecycle/after-removal/target-options.ts#L4-L25)와 [선택한 설정 테스트](../cases/cohere-lifecycle/after-removal/runtime-selection.excerpt.test.ts#L22-L67)는 유지된 provider 경계와 runtime 선택을 보여줍니다.

Provider abstraction, 과거 비교 artifact, 공통 document-build 진행 로그와 Gemini 전용 요청 시작 간격 22초 pacing을 유지했습니다. Pacing은 그날 저녁 조사하던 별도 document-build quota 문제에 대응한 변경입니다. 21:19:53.762 제거 완료 채록 보고는 테스트 939개 통과·기존 skip 4개·static check/build 통과와 knowledge 변경에 따른 Gemini index stale 상태를 함께 기록합니다. 사용자는 21:29:36.316 index를 제외하고 코드를 먼저 커밋하도록 했습니다.

10월 17일 22:19:07.357 사용자는 rebuild 성공·CURRENT 상태를 보고했습니다. 22:20:44의 `033e02f`는 새 Gemini artifact를 추가하고 이전 Gemini·retired Cohere artifact를 제거했습니다. 코드 통합, index rebuild 보고와 artifact 공개를 각각 구분합니다. 제거 후 production 동작은 이 사례에서 독립 검증한 근거 범위 밖입니다.

### 검증 범위와 남은 사항

10월 1일 품질 결과는 이번에 직접 읽은 원본 세션의 당시 보고입니다. 10월 6일 classifier·10월 15일 검색 집계는 이번 공개에서 확인한 파일로 추적할 수 있습니다. 10월 3일 generation 결과·10월 16일 제거 보고는 기존 조사의 출처 식별자·검증 한계를 유지합니다. 10월 29일 근거는 이 공개 작업에서 사용자가 직접 밝힌 설명입니다.

남은 사항은 최초 도입·Cohere 단독 전환의 전체 동기, 10월 6일 비용 발언의 적용 범위, 당시 key·약관의 독립 자료, classifier 출력·block 처리 원인, 미확보 generation raw 응답·build 시도별 ledger와 제거 후 production 검증입니다. 이번 공개에서는 모델 요청·index build·당시 애플리케이션 테스트를 실행하지 않았습니다.

### 출처 추적과 공개 방식

전체 파일 Excerpt 15개는 원본 bytes를 보존합니다. 일부 Excerpt 4개는 아래 원본 선언·테스트 문장을 빈 줄로 연결하며 이름·import·선택 문장을 유지합니다. 테스트에는 합성 credential·fixture와 생략한 애플리케이션 모듈 참조가 남아 있습니다. Classifier 발췌는 schema·parser·gate와 원래 harness 상태 참조를 보존합니다. 선택한 코드는 열람 목적으로 공개합니다. 로컬 harness 발췌의 줄바꿈은 CRLF에서 LF로 정규화했습니다.

Reconstructed JSON 2개는 새 편집 구조를 사용합니다. `target-history.json`은 식별한 example 설정의 generation·embedding 필드 전체를 복사합니다. `observed-results.json`은 저장 classifier summary·counter를 선택하고 original/final 근거 순위에서 검색 집계를 계산합니다. 비공개 원문, 실험 응답 전문, credential, index vector와 로컬 사용자 경로는 공개 파일 범위에서 제외합니다.

#### 기준 커밋

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

#### 코드 대응표

원본 경로는 비공개 저장소 기준입니다. 구간은 양 끝을 포함하며 `원본 → 공개` 순서입니다. 로컬 harness는 원본 파일 hash로 식별합니다.

| 공개 파일 | 원본 기준 · 경로 | 분류 · 구간 |
|---|---|---|
| [embedding/initial/client.ts](../cases/cohere-lifecycle/embedding/initial/client.ts#L1-L54) | `5f71fbe` · `sveltekit/src/lib/server/providers/cohere/client.ts` | Excerpt (전체) · 1–54 → 1–54 |
| [embedding/initial/embedding.ts](../cases/cohere-lifecycle/embedding/initial/embedding.ts#L1-L46) | `5f71fbe` · `sveltekit/src/lib/server/providers/cohere/embedding.ts` | Excerpt (전체) · 1–46 → 1–46 |
| [embedding/initial/target-fallback.ts](../cases/cohere-lifecycle/embedding/initial/target-fallback.ts#L1-L44) | `5f71fbe` · `sveltekit/src/lib/server/embedding/target-fallback.ts` | Excerpt (전체) · 1–44 → 1–44 |
| [embedding/initial/target-fallback.test.ts](../cases/cohere-lifecycle/embedding/initial/target-fallback.test.ts#L1-L43) | `5f71fbe` · `sveltekit/src/lib/server/embedding/target-fallback.test.ts` | Excerpt (전체) · 1–43 → 1–43 |
| [embedding/batched/embedding.ts](../cases/cohere-lifecycle/embedding/batched/embedding.ts#L1-L51) | `dadffe3` · `sveltekit/src/lib/server/providers/cohere/embedding.ts` | Excerpt (전체) · 1–51 → 1–51 |
| [embedding/batched/embedding.test.ts](../cases/cohere-lifecycle/embedding/batched/embedding.test.ts#L1-L40) | `dadffe3` · `sveltekit/src/lib/server/providers/cohere/embedding.test.ts` | Excerpt (전체) · 1–40 → 1–40 |
| [embedding/pre-retirement/client.test.ts](../cases/cohere-lifecycle/embedding/pre-retirement/client.test.ts#L1-L54) | `c2efdac` · `sveltekit/src/lib/server/providers/cohere/client.test.ts` | Excerpt (전체) · 1–54 → 1–54 |
| [generation/generation-client.ts](../cases/cohere-lifecycle/generation/generation-client.ts#L1-L35) | `b00bf59` · `sveltekit/src/lib/server/providers/cohere/generation-client.ts` | Excerpt (전체) · 1–35 → 1–35 |
| [generation/generation.ts](../cases/cohere-lifecycle/generation/generation.ts#L1-L26) | `b00bf59` · `sveltekit/src/lib/server/providers/cohere/generation.ts` | Excerpt (전체) · 1–26 → 1–26 |
| [generation/generation.test.ts](../cases/cohere-lifecycle/generation/generation.test.ts#L1-L63) | `b00bf59` · `sveltekit/src/lib/server/providers/cohere/generation.test.ts` | Excerpt (전체) · 1–63 → 1–63 |
| [evaluation/shared-evidence.excerpt.ts](../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.ts#L1-L90) | `b00bf59` · `sveltekit/src/lib/server/retrieval/evaluation/run.ts` | Excerpt · 1–13 → 1–13; 15–31 → 15–31; 44–54 → 33–43; 56–101 → 45–90 |
| [evaluation/shared-evidence.excerpt.test.ts](../cases/cohere-lifecycle/evaluation/shared-evidence.excerpt.test.ts#L1-L77) | `b00bf59` · `sveltekit/src/lib/server/retrieval/evaluation/run.test.ts` | Excerpt · 1–8 → 1–8; 10–11 → 10–11; 13–25 → 13–25; 58–69 → 27–38; 71–80 → 40–49; 82–91 → 51–60; 93–98 → 62–67; 100–108 → 69–77 |
| [evaluation/classifier-contract.excerpt.ts](../cases/cohere-lifecycle/evaluation/classifier-contract.excerpt.ts#L1-L43) | 로컬 보존본 · `tmp/cohere-retrieval-intent-experiment/run.ts` | Excerpt · 1–1 → 1–1; 40–40 → 3–3; 42–59 → 5–22; 143–162 → 24–43 |
| [evaluation/retrieval-evaluate.ts](../cases/cohere-lifecycle/evaluation/retrieval-evaluate.ts#L1-L325) | `927415e` · `sveltekit/src/lib/server/retrieval/evaluation/evaluate.ts` | Excerpt (전체) · 1–325 → 1–325 |
| [evaluation/retrieval-evaluate.test.ts](../cases/cohere-lifecycle/evaluation/retrieval-evaluate.test.ts#L1-L162) | `927415e` · `sveltekit/src/lib/server/retrieval/evaluation/evaluate.test.ts` | Excerpt (전체) · 1–162 → 1–162 |
| [after-removal/embedding-provider-factory.ts](../cases/cohere-lifecycle/after-removal/embedding-provider-factory.ts#L1-L24) | `e700717` · `sveltekit/src/lib/server/embedding/provider-factory.ts` | Excerpt (전체) · 1–24 → 1–24 |
| [after-removal/generation-provider-factory.ts](../cases/cohere-lifecycle/after-removal/generation-provider-factory.ts#L1-L33) | `e700717` · `sveltekit/src/lib/server/generation/provider-factory.ts` | Excerpt (전체) · 1–33 → 1–33 |
| [after-removal/target-options.ts](../cases/cohere-lifecycle/after-removal/target-options.ts#L1-L25) | `e700717` · `sveltekit/src/lib/server/generation/target-options.ts` | Excerpt (전체) · 1–25 → 1–25 |
| [after-removal/runtime-selection.excerpt.test.ts](../cases/cohere-lifecycle/after-removal/runtime-selection.excerpt.test.ts#L1-L67) | `e700717` · `sveltekit/src/lib/server/config.test.ts` | Excerpt · 1–12 → 1–12; 15–15 → 14–14; 17–21 → 16–20; 40–59 → 22–41; 62–65 → 43–46; 67–73 → 48–54; 76–87 → 56–67 |
| [configuration/target-history.json](../cases/cohere-lifecycle/configuration/target-history.json#L1-L227) | 입력 파일은 아래 구성 규칙에 명시 | Reconstructed · 선택·새 구조 |
| [evidence/observed-results.json](../cases/cohere-lifecycle/evidence/observed-results.json#L1-L138) | 입력 파일은 아래 구성 규칙에 명시 | Reconstructed · 선택·새 구조 |

#### 재구성 규칙

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

#### 코드 외 근거와 접근 상태

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

다음 원본은 등록된 경로에서 확보되지 않았습니다. 식별자·hash는 기존 근거 등록부의 채록값입니다.

| 기존 채록 원본 | 채록 SHA-256 · 적용 범위 |
|---|---|
| `generation-model-comparison/2026-10-03-full40-3way-1/final-report.md` | `a82073631b743462c5a31051071ba994f9339b346849e29bbe171375ace7c231` · 10월 3일 generation 표 |
| `rollout-2026-10-16T20-10-29-01a14468-00a5-7ff2-8053-0e588b0c1335.jsonl.zst` | `9a167a56794bb628bd58e92581435b4efcacab3568d01e83d9dbf36ad79f9b99` · 제거 판단·완료·index 분리 보고 |

메시지 위치: 10월 1일 원본의 UTC 04:47:45.250Z·07:43:18.624Z·08:04:10.538Z·08:13:29Z·08:32:44Z는 각각 KST 13:47:45.250·16:43:18.624·17:04:10.538·17:13:29·17:32:44입니다. 기존 채록 제거 세션은 10월 16일 UTC 12:02:47.996Z(사용자 판단), 12:19:53.762Z(완료 보고), 12:29:36.316Z(index 제외 요청), 10월 17일 13:19:07.357Z(CURRENT 보고)로 식별합니다. 10월 6일 19:17:35.774 인수인계는 UTC 10:17:35.774Z이며 기존 조사 채록을 사용했습니다.

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
| `evidence/observed-results.json` | 입력 표 참조 | `3561e1aad43a2b782760dc3adc3b993312f7b00304b76eb1c724560659c43a5d` |

</details>

### 공개본 검증

전체 파일 Excerpt 15개는 Git 객체와 bytes·SHA-256이 일치했습니다. 일부 Excerpt 4개의 모든 원본 구간도 보존 원본과 일치하며 로컬 harness에는 명시한 LF 정규화를 적용했습니다. TypeScript 19개는 구문 분석을 통과했습니다. 재구성 JSON 2개는 문법, 설정 필드 대조, classifier counter·중앙값 확인과 검색 집계 대조를 통과했습니다.

영문·한글 사실관계, 출처 대응과 코드 링크를 대조했습니다. README·상세 기록의 로컬 링크 238개는 파일·헤딩 앵커·라인 범위를 확인했습니다. 앞선 두 사례의 본문과 코드 27개를 보존했습니다. 신규 파일의 credential·비공개 문서 본문·비공개 저장소 URL·로컬 사용자 경로를 점검했습니다. 당시 애플리케이션 테스트 실행과 provider 호출은 이번 공개 검증 범위 밖입니다.

## 04 — Provider 교체 설계와 Embedding 안정화

**개발 시기:** 2026-09-26 ~ 2026-10-17

**코드 분류:** Excerpt 37개와 Reconstructed JSON 기록 2개입니다.

**결과:** 역할별 Provider 계약·Factory·target 선택 구조로 Gemini·Cohere·Groq 변경을 수용했습니다. 문서 embedding은 chunk별 요청에서 provider 소유 batching, 현재 배치의 bounded retry와 Gemini 요청 시작 pacing으로 발전했으며 검증된 index를 publish하도록 했습니다.

### 문제와 변경 순서

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

### 계약·Factory·adapter·공통 동작의 분리

9월 26일 [Embedding 계약](../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider.ts#L1-L21)은 provider/model/dimensions를 받아 vector를 반환합니다. [Generation 계약](../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider.ts#L1-L40)은 contents·system instruction·response schema·출력 한도를 받아 content 또는 분류된 실패를 반환합니다. 초기 [embedding Factory](../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider-factory.ts#L1-L14)와 [generation Factory](../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider-factory.ts#L1-L14)는 Gemini adapter를 만듭니다. 같은 커밋에서 index·검색·답변의 import를 공통 embedding·generation 모듈로 옮겼습니다.

| 책임 | 구현 경계 |
|---|---|
| Target 정의·runtime 순서 | 설정 parser와 검증된 target ID. |
| Credential 선택·adapter 생성 | Binding helper와 역할별 Factory. |
| Provider 요청·응답 변환 | Gemini·Cohere·Groq adapter. |
| 문서 분할·vector 검증·bounded retry·진행 로그 | 공통 embedding orchestration. Provider batching capability와 Gemini pacing 조건으로 개별 정책 적용. |
| Prompt·evidence 구성·답변 검증 | 공통 generation orchestration. |
| Index 호환성·publish | Embedding-space identity·candidate 검증·index 저장. |

9월 28일 [확장 embedding Factory](../cases/embedding-batching-retry-pacing/architecture/embedding-provider-factory.ts#L1-L26)는 target에 따라 Gemini/Cohere를 선택하고 해당 target에 연결된 credential을 요구하며 target ID별 adapter 인스턴스를 재사용합니다. [발전한 요청 계약](../cases/embedding-batching-retry-pacing/batching/provider-contract.excerpt.ts#L1-L33)은 질문과 제목·본문 문서 입력을 구분하고 선택적 batching capability를 제공합니다.

기존 target은 설정에서 선택합니다. 새 provider 도입은 계약 구현·Factory 등록·지원 옵션 검증·테스트 추가로 진행합니다. 아래 실제 추가·제거는 이 코드 경계를 따라 이뤄졌습니다.

### 문서별 요청에서 provider 소유 batch로

[Batching 이전 loop](../cases/embedding-batching-retry-pacing/before/embeddings.ts#L31-L49)는 `embedDocuments()` 호출마다 chunk 1개를 보내고 vector를 검사합니다. 앞선 Gemini build는 chunk embedding 50개 성공 뒤 daily-quota HTTP 429를 받았다고 보고됐습니다. 문서 편입으로 커진 corpus에 대해 다음 변경은 batch로 요청 payload와 실패 단위를 조절했습니다.

[Batching 구현](../cases/embedding-batching-retry-pacing/batching/embeddings.ts#L31-L70)은 provider의 선호 크기를 사용하고 capability가 없으면 1개로 처리하며 양의 정수 한도를 검증합니다. Gemini adapter는 프로젝트 선호 크기 32개를 선언합니다. Cohere의 [기존 공개 adapter](../cases/cohere-lifecycle/embedding/batched/embedding.ts#L9-L51)는 선호·최대 96개를 선언합니다. 공통 loop는 full/partial batch를 나누고 vector 개수·차원·유한값을 검사하며 입력 순서대로 vector를 연결합니다.

[Batching 테스트](../cases/embedding-batching-retry-pacing/batching/embeddings.test.ts#L1-L98)는 full/partial batch 순서, 빈 입력, 잘못된 vector 개수·차원, 중간 batch 실패와 query 경로를 다룹니다. 부분 vector는 모든 batch가 성공할 때까지 해당 호출 내부에 보관합니다.

### 복구 정책에 앞선 실패 진단

`19e634d` 개발 보고서는 Gemini 32문서 요청 3회 성공 뒤 네 번째가 실패했고 유용한 HTTP/provider 상세 정보가 유실됐다고 기록합니다. 해당 실패의 정확한 분류는 미확인입니다. 같은 기록의 Cohere는 요청 6회를 완료해 당시 current artifact를 만들었습니다. Target별 실패 격리로 성공 결과를 보존했습니다.

[Gemini 실패 정규화](../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.ts#L33-L133)는 typed RetryInfo·QuotaFailure를 읽고 HTTP status·허용된 provider/quota 식별자·retry delay를 보존합니다. 부가 정보 없는 HTTP 429/RESOURCE_EXHAUSTED는 neutral·fallbackable로 유지합니다. [Adapter 테스트](../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.test.ts#L1-L173)는 해당 형태·안전한 식별자·다중 입력 순서 변환을 다룹니다.

이후 [공통 실패 helper](../cases/embedding-batching-retry-pacing/diagnostics/failure.ts#L1-L133)는 검증한 Retry-After delay와 batch 번호·offset·size를 직렬화 진단 보고로 전달합니다. [테스트](../cases/embedding-batching-retry-pacing/diagnostics/failure.test.ts#L1-L79)는 실패 분류, timeout/cancellation과 안전한 지연 형태를 확인합니다. Raw cause는 오류 전달 내부에 유지합니다.

### Build target·runtime 순서·credential 분리

9월 29일 변경은 build target 등록과 `runtimeTargetIds`를 먼저 분리한 뒤 credential을 runtime 우선순위와 독립적으로 연결했습니다. [선택 함수](../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.ts#L10-L88)는 target identity를 검사하고 번호 있는 환경 target을 credential slot에 연결하며 runtime ID를 해석합니다. [Credential helper](../cases/embedding-batching-retry-pacing/architecture/credentials.ts#L1-L29)는 지정 slot을 로드·요구합니다. [선택 테스트](../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.test.ts#L32-L131)는 runtime 순서 변경, credential 연결 유지, 합성 세 번째 target과 중복·불완전 binding 거부를 확인합니다. 이 기준본은 완전한 연속 번호 binding을 요구했습니다.

9월 30일에는 공통 [numbered binding helper](../cases/embedding-batching-retry-pacing/architecture/generation/credentials.ts#L31-L65)가 embedding·generation과 비연속 번호 slot을 지원했습니다. [Generation parser](../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.ts#L36-L69)는 고유 registry ID·provider 옵션·binding slot과 알려진 target의 runtime 순서를 검사합니다. [테스트](../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.test.ts#L46-L73)는 registry·slot·runtime 독립성, 같은 모델의 복수 옵션 profile과 선택적 평가 credential을 보존합니다. 이 두 기준본은 binding 설계의 순차적 발전을 보여줍니다.

[Reconstructed 설정 이력](../cases/embedding-batching-retry-pacing/architecture/config-selection-history.json#L1-L176)은 초기 Gemini 필드부터 다중 target registry까지 커밋 4개의 generation·embedding 구간을 선택합니다. 이후 커밋의 runtime 선택은 사례 03의 [설정 이력](../cases/cohere-lifecycle/configuration/target-history.json#L1-L227)으로도 확인할 수 있습니다. Credential 값은 로컬에 유지합니다.

### 현재 실패한 document batch의 retry

별도 9월 29일 보고에는 525 chunks build에서 Cohere batch 5개 성공 뒤 6/6에 HTTP 429가 발생했고 다른 설정 target도 첫 batch에서 실패했다고 기록돼 있습니다. 미완성 target은 publish하지 않았습니다. `5615b4c`에서 공통 document orchestration에 bounded retry를 추가했습니다.

[Retry loop·지연 결정](../cases/embedding-batching-retry-pacing/retry/embeddings.ts#L69-L98)은 fallbackable인 `EmbeddingProviderError`의 HTTP 429에 최초 시도 뒤 최대 3회 retry를 허용합니다. 명시 지연은 0~60000 ms의 안전한 값이면 우선 사용합니다. 값이 없으면 15000/30000/60000 ms를 사용하고 안전 범위를 벗어난 명시 지연은 retry를 중단합니다. 다른 status와 검증 실패도 해당 작업을 종료합니다. 현재 batch를 다시 시도하는 동안 앞선 성공 batch는 메모리에 유지합니다.

[선택한 retry 테스트](../cases/embedding-batching-retry-pacing/retry/embeddings.excerpt.test.ts#L37-L150)는 현재 batch만 복구, 지연 우선순위, 최대 4회 시도, 최종 batch 진단, 비 429·안전 범위 밖 지연 거부와 query 실패 즉시 전달을 확인합니다. 당시 보고의 정책 검증은 mock timer·HTTP 응답 기반이며 그 시점의 live retry 검증은 대기 상태였습니다.

### 같은 구조를 Generation 교체에 활용

9월 30일 [Generation target·요청 계약](../cases/embedding-batching-retry-pacing/architecture/generation/provider.ts#L1-L72)은 target ID·credential slot·target별 옵션·native usage metadata·명시적 실행 진단을 추가합니다. [세 provider Factory](../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.ts#L1-L36)는 Gemini·Cohere·Groq를 등록하고 target ID별 인스턴스를 재사용합니다. [Factory 테스트](../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.test.ts#L1-L30)는 generation slot 연결과 runtime 순서 변경 후 인스턴스 유지를 확인합니다.

[공통 generation orchestrator](../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.ts#L1-L170)는 설정 runtime ID 또는 명시적 평가 target 하나를 선택하고 공통 evidence·prompt 입력을 구성하며 Factory의 adapter를 호출한 뒤 응답 형태·인용을 검사합니다. 이 9월 30일 기준본의 runtime fallback 조건은 확인된 quota exhaustion이었습니다. [선택한 테스트](../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.excerpt.test.ts#L27-L105)는 runtime·평가 선택과 grounding 검증 유지를 다룹니다. 이후 provider 실패 정책은 별도로 발전했으며 공개한 각 기준본은 원래 조건을 유지합니다.

Cohere의 [기존 공개 generation adapter](../cases/cohere-lifecycle/generation/generation.ts#L6-L26)는 공통 요청을 해당 chat API로 옮깁니다. 초기 Groq 모델 경로는 `4125443`에서 제거됐고, 이후 `0baebd9`는 GPT-OSS를 fallback으로 추가하면서 Cohere를 평가 대상으로 유지했습니다. [GPT-OSS adapter](../cases/embedding-batching-retry-pacing/architecture/groq/generation.ts#L1-L28)는 같은 계약을 strict JSON Schema·completion 한도·reasoning effort로 변환합니다. [옵션 검사](../cases/embedding-batching-retry-pacing/architecture/generation/target-options.ts#L1-L29)와 [선택한 adapter 테스트](../cases/embedding-batching-retry-pacing/architecture/groq/generation.excerpt.test.ts#L21-L51)가 요청·응답 변환을 확인합니다. 이 교체 커밋에서는 generation 설정·adapter가 바뀌고 embedding/index 구현은 유지됐습니다.

`e700717`의 Cohere 제거는 adapter·테스트·Factory 등록·옵션·설정·평가 선택지를 삭제했습니다. 유지된 [embedding Factory](../cases/cohere-lifecycle/after-removal/embedding-provider-factory.ts#L12-L24)와 [generation Factory](../cases/cohere-lifecycle/after-removal/generation-provider-factory.ts#L17-L33)에서 제거 후 Gemini embedding·Gemini/Groq generation을 확인할 수 있습니다. 공통 계약·orchestration은 남은 provider를 계속 연결했습니다.

### 10월 16일: retry에 요청 시작 pacing 추가

20:22:30.299 사용자 보고는 Gemini의 batch 9·document offset 256·size 32에서 HTTP 429/RESOURCE_EXHAUSTED와 약 59초 provider retry delay를 기록합니다. 보존 조사는 코드의 최대 4회 시도와 미확보 시도별 ledger를 구분했습니다. 20:27:38.961 사용자는 AI Studio 관측 RPM 160/100, TPM 35.21K/30K, RPD 256/1K를 추가했습니다.

| 설계 계산 | 당시 근거·범위 |
|---|---|
| Document 단위 해석 | 160=32×5, 256=32×8이 document 단위 집계 가설을 뒷받침. |
| RPM 평균 | 60×32/100=배치당 19.2초. |
| 경계 집중 | 0/20/40/60초 시작은 60초 경계에 4배치가 포함될 수 있어 20초 초과 간격 검토. |
| TPM 추정 | 35.21K peak가 같은 5배치 구간이라는 가정에서 60×(35.21K/5)/30K≈배치당 14.1초. |
| 선택 정책 | Retry를 포함한 Gemini document 요청 시작 사이 최소 22초. |

기존 조사는 이를 사용자 관측과 설계 계산으로 보존합니다. 정확한 quota 차감, RPM/TPM peak의 시간 대응, batch 9 실제 시도 수와 provider 대기 경과는 미확인입니다. 등록된 보관 세션 원본은 현재 환경의 해당 경로에서 확보되지 않았습니다.

### Build 내부 gate와 공통 retry logging

[최종 document loop](../cases/embedding-batching-retry-pacing/pacing/embeddings.ts#L37-L94)는 build 호출마다 `lastRequestStartedAt` 하나를 유지합니다. 각 Gemini document 시도 전에 `performance.now()`로 남은 간격만 기다립니다. [Retry loop](../cases/embedding-batching-retry-pacing/pacing/embeddings.ts#L96-L140)는 최초 시도·retry 전에 같은 gate를 호출합니다. 응답·backoff 시간도 간격에 포함하며 그 build 호출의 batch들이 상태를 공유합니다.

초기 제안은 진행 로그를 Gemini 전용 동작에 뒀습니다. 20:41:35.648 사용자는 build/retry logging은 provider 공통으로, pacing은 Gemini 전용으로 유지하도록 수정했습니다. 최종 코드는 `target.provider`에서 로그 prefix를 만들고 시도 시작·검증 완료·HTTP/kind 실패·pacing/retry 대기·소진을 기록합니다. Vector 검증 실패는 완료 실패로 기록합니다.

| 당시 fake-timer 계약 | 예상 provider 호출 시작 시각·결과 |
|---|---|
| 373 chunks·batch 32 | 0,22,…,242초에 12배치, 마지막 21개. |
| 응답 시간 5초 /25초 | 다음 요청 시작 22초 /25초. |
| Retry delay 없음 /2.5초 /59초 | Retry 시작 22초 /22초 /59초, 다음 batch는 그로부터 22초 뒤. |
| 429 반복·fallback 지연 | 0,22000,52000,112000 ms에 시작, 총 4회 시도. |
| Fixture-provider | Document batch 즉시 호출, 공통 로그 유지. |
| Query embedding | Query는 즉시 실행하고 document retry·pacing·logging은 해당 경로 밖에 유지. |

[Logging 테스트](../cases/embedding-batching-retry-pacing/pacing/embeddings.excerpt.test.ts#L45-L113)는 Gemini·합성 미래 provider, retry 소진, 잘못된 vector와 query 로그 경계를 다룹니다. [Pacing 테스트](../cases/embedding-batching-retry-pacing/pacing/embeddings.excerpt.test.ts#L115-L248)에 위 시작 시각 기대값이 명시돼 있습니다. 20:31:07.589 구현 checkpoint는 관련 43테스트·static check 통과와 live build 대기를 보고했습니다. 이후 완료 보고는 939테스트 통과·기존 skip 4개·check/build 통과를 기록합니다.

### Index 호환성과 실패 시 산출물 보호

[Embedding-space identity](../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.ts#L15-L44)는 provider·model·dimensions·embedding input version을 포함합니다. Target index fingerprint에는 corpus identity도 들어갑니다. [Identity 테스트](../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.test.ts#L11-L79)는 generation 변경 시 index identity 유지, runtime ID·credential·우선순위 독립성과 provider·model·dimension·input·corpus 변경의 호환성 영향을 보여줍니다. Runtime 선택과 provider 교체는 이 artifact 계약을 사용합니다.

[Index builder](../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.ts#L23-L87)는 전체 vector를 기다리고 개수를 검사한 뒤 source/vector를 결합해 artifact를 기록·다시 읽고 해당 space의 stale artifact를 정리합니다. Target별 결과를 기록해 하나가 실패해도 다음 target을 진행할 수 있습니다. [저장 발췌](../cases/embedding-batching-retry-pacing/publication/store.excerpt.ts#L16-L94)는 schema·identity·vector·source URL을 검사하고 임시 candidate를 기록·검증한 뒤 destination으로 rename하며 실패 candidate를 정리합니다.

[Builder 테스트](../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.test.ts#L44-L120)와 [저장 테스트](../cases/embedding-batching-retry-pacing/publication/store.excerpt.test.ts#L75-L116)는 candidate·write·publish 검증 실패에 따른 성공 target·기존 artifact 보존을 다룹니다. Current artifact 검증 뒤 stale 정리를 진행합니다. Batch retry는 해당 실행 중 앞선 vector를 유지하며, 당시 build에는 영속 batch checkpoint/resume이 없어 종료된 미완성 작업은 폐기했습니다.

### Rebuild 완료 산출물 확인

사용자는 10월 16일 코드와 index 커밋을 분리했습니다. 10월 17일 22:19:07.357 사용자 보고는 rebuild 성공·CURRENT 상태를 기록합니다. 22:20:44의 `033e02f`는 새 Gemini artifact를 추가하고 이전 Gemini/Cohere artifact를 제거했습니다. [Reconstructed artifact summary](../cases/embedding-batching-retry-pacing/evidence/published-index-summary.json#L1-L21)는 해당 커밋 JSON의 metadata·구조 검사 결과를 선택합니다.

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

### 검증 수준과 원본 선택

코드·커밋 차이, 공개 테스트 assertion, 과거 tracked 개발 보고서와 최종 커밋 index를 직접 확인했습니다. 10월 16~17일 사용자 관측·구현 checkpoint는 기존 조사 채록을 통해 인용하며, 등록된 보관 세션·실패/완료 build 원시 ledger는 확보되지 않았습니다. 계산은 당시 가정을 함께 제시합니다.

`e700717`의 핵심 embedding orchestration·Gemini adapter·공통 embedding 실패 구현은 해당 경로의 현재 비공개 HEAD와 일치합니다. 이번 공개는 보존 기록·원본 객체를 읽어 작성하며 모델 요청·index build·당시 애플리케이션 테스트를 실행하지 않습니다.

### 출처 추적과 공개 방식

전체 파일 Excerpt 22개는 원본 bytes를 보존합니다. 일부 Excerpt 15개는 선택한 원본 선언·테스트 문장을 빈 줄로 연결하고 suite wrapper·무관한 구간을 제외합니다. Import·이름·합성 fixture·미공개 모듈 참조는 원래대로 유지합니다. Generation orchestrator는 target dispatch부터 최종 응답 검증까지 보존하도록 전체 원본을 포함했습니다.

Reconstructed JSON 2개는 편집한 구조를 사용합니다. 하나는 과거 generation·embedding 설정 필드를 선택하고, 다른 하나는 커밋 artifact metadata를 선택한 뒤 chunk·document-hash 수와 vector 구조 boolean을 계산합니다. 비공개 원문·vector·credential 값·로컬 사용자 경로·raw runtime/세션 전문은 제외합니다.

#### 기준 커밋

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

#### 코드 대응표

원본 경로는 비공개 저장소 기준이며 구간은 양 끝을 포함한 `원본 → 공개` 순서입니다. 설정·index summary의 입력은 다음 표에 기록합니다.

| 공개 파일 | 원본 커밋 · 경로 | 분류 · 구간 |
|---|---|---|
| [before/embeddings.ts](../cases/embedding-batching-retry-pacing/before/embeddings.ts#L1-L49) | `5f71fbe` · `sveltekit/src/lib/server/embedding/embeddings.ts` | Excerpt (전체) · 1–49 → 1–49 |
| [batching/embeddings.ts](../cases/embedding-batching-retry-pacing/batching/embeddings.ts#L1-L70) | `dadffe3` · `sveltekit/src/lib/server/embedding/embeddings.ts` | Excerpt (전체) · 1–70 → 1–70 |
| [batching/embeddings.test.ts](../cases/embedding-batching-retry-pacing/batching/embeddings.test.ts#L1-L98) | `dadffe3` · `sveltekit/src/lib/server/embedding/embeddings.test.ts` | Excerpt (전체) · 1–98 → 1–98 |
| [batching/provider-contract.excerpt.ts](../cases/embedding-batching-retry-pacing/batching/provider-contract.excerpt.ts#L1-L33) | `dadffe3` · `sveltekit/src/lib/server/embedding/provider.ts` | Excerpt · 1–7 → 1–7; 9–12 → 9–12; 14–17 → 14–17; 19–22 → 19–22; 24–27 → 24–27; 29–33 → 29–33 |
| [diagnostics/gemini-embedding.ts](../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.ts#L1-L174) | `19e634d` · `sveltekit/src/lib/server/providers/gemini/embedding.ts` | Excerpt (전체) · 1–174 → 1–174 |
| [diagnostics/gemini-embedding.test.ts](../cases/embedding-batching-retry-pacing/diagnostics/gemini-embedding.test.ts#L1-L173) | `19e634d` · `sveltekit/src/lib/server/providers/gemini/embedding.test.ts` | Excerpt (전체) · 1–173 → 1–173 |
| [diagnostics/failure.ts](../cases/embedding-batching-retry-pacing/diagnostics/failure.ts#L1-L133) | `e700717` · `sveltekit/src/lib/server/embedding/failure.ts` | Excerpt (전체) · 1–133 → 1–133 |
| [diagnostics/failure.test.ts](../cases/embedding-batching-retry-pacing/diagnostics/failure.test.ts#L1-L79) | `e700717` · `sveltekit/src/lib/server/embedding/failure.test.ts` | Excerpt (전체) · 1–79 → 1–79 |
| [retry/embeddings.ts](../cases/embedding-batching-retry-pacing/retry/embeddings.ts#L1-L116) | `5615b4c` · `sveltekit/src/lib/server/embedding/embeddings.ts` | Excerpt (전체) · 1–116 → 1–116 |
| [retry/embeddings.excerpt.test.ts](../cases/embedding-batching-retry-pacing/retry/embeddings.excerpt.test.ts#L1-L150) | `5615b4c` · `sveltekit/src/lib/server/embedding/embeddings.test.ts` | Excerpt · 1–10 → 1–10; 12–14 → 12–14; 16–25 → 16–25; 27–35 → 27–35; 130–172 → 37–79; 174–194 → 81–101; 196–217 → 103–124; 219–232 → 126–139; 245–254 → 141–150 |
| [pacing/embeddings.ts](../cases/embedding-batching-retry-pacing/pacing/embeddings.ts#L1-L158) | `e700717` · `sveltekit/src/lib/server/embedding/embeddings.ts` | Excerpt (전체) · 1–158 → 1–158 |
| [pacing/embeddings.excerpt.test.ts](../cases/embedding-batching-retry-pacing/pacing/embeddings.excerpt.test.ts#L1-L248) | `e700717` · `sveltekit/src/lib/server/embedding/embeddings.test.ts` | Excerpt · 1–11 → 1–11; 13–15 → 13–15; 17–26 → 17–26; 28–36 → 28–36; 38–39 → 38–39; 41–43 → 41–43; 46–72 → 45–71; 74–95 → 73–94; 111–118 → 96–103; 120–128 → 105–113; 352–384 → 115–147; 386–409 → 149–172; 411–441 → 174–204; 443–464 → 206–227; 466–485 → 229–248 |
| [publication/indexer.excerpt.ts](../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.ts#L1-L87) | `e700717` · `sveltekit/src/lib/server/indexing/indexer.ts` | Excerpt · 1–21 → 1–21; 76–111 → 23–58; 113–118 → 60–65; 120–140 → 67–87 |
| [publication/indexer.excerpt.test.ts](../cases/embedding-batching-retry-pacing/publication/indexer.excerpt.test.ts#L1-L120) | `e700717` · `sveltekit/src/lib/server/indexing/indexer.test.ts` | Excerpt · 1–7 → 1–7; 9–23 → 9–23; 25–30 → 25–30; 32–42 → 32–42; 68–92 → 44–68; 126–134 → 70–78; 136–143 → 80–87; 145–153 → 89–97; 155–165 → 99–109; 167–176 → 111–120 |
| [publication/store.excerpt.ts](../cases/embedding-batching-retry-pacing/publication/store.excerpt.ts#L1-L94) | `e700717` · `sveltekit/src/lib/server/indexing/store.ts` | Excerpt · 1–14 → 1–14; 56–97 → 16–57; 99–101 → 59–61; 103–105 → 63–65; 107–121 → 67–81; 123–134 → 83–94 |
| [publication/store.excerpt.test.ts](../cases/embedding-batching-retry-pacing/publication/store.excerpt.test.ts#L1-L116) | `e700717` · `sveltekit/src/lib/server/indexing/store.test.ts` | Excerpt · 1–20 → 1–20; 22–28 → 22–28; 30–41 → 30–41; 43–44 → 43–44; 46–62 → 46–62; 64–69 → 64–69; 71–73 → 71–73; 99–105 → 75–81; 216–230 → 83–97; 232–249 → 99–116 |
| [architecture/initial/embedding/provider.ts](../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider.ts#L1-L21) | `fc509b0` · `sveltekit/src/lib/server/embedding/provider.ts` | Excerpt (전체) · 1–21 → 1–21 |
| [architecture/initial/embedding/provider-factory.ts](../cases/embedding-batching-retry-pacing/architecture/initial/embedding/provider-factory.ts#L1-L14) | `fc509b0` · `sveltekit/src/lib/server/embedding/provider-factory.ts` | Excerpt (전체) · 1–14 → 1–14 |
| [architecture/initial/generation/provider.ts](../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider.ts#L1-L40) | `fc509b0` · `sveltekit/src/lib/server/generation/provider.ts` | Excerpt (전체) · 1–40 → 1–40 |
| [architecture/initial/generation/provider-factory.ts](../cases/embedding-batching-retry-pacing/architecture/initial/generation/provider-factory.ts#L1-L14) | `fc509b0` · `sveltekit/src/lib/server/generation/provider-factory.ts` | Excerpt (전체) · 1–14 → 1–14 |
| [architecture/embedding-provider-factory.ts](../cases/embedding-batching-retry-pacing/architecture/embedding-provider-factory.ts#L1-L26) | `5f71fbe` · `sveltekit/src/lib/server/embedding/provider-factory.ts` | Excerpt (전체) · 1–26 → 1–26 |
| [architecture/credentials.ts](../cases/embedding-batching-retry-pacing/architecture/credentials.ts#L1-L29) | `de197a5` · `sveltekit/src/lib/server/credentials.ts` | Excerpt (전체) · 1–29 → 1–29 |
| [architecture/embedding-selection.excerpt.ts](../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.ts#L1-L106) | `de197a5` · `sveltekit/src/lib/server/config.ts` | Excerpt · 1–6 → 1–6; 8–8 → 8–8; 27–55 → 10–38; 57–89 → 40–72; 91–105 → 74–88; 119–122 → 90–93; 124–129 → 95–100; 131–135 → 102–106 |
| [architecture/embedding-selection.excerpt.test.ts](../cases/embedding-batching-retry-pacing/architecture/embedding-selection.excerpt.test.ts#L1-L131) | `de197a5` · `sveltekit/src/lib/server/config.test.ts` | Excerpt · 1–9 → 1–9; 11–14 → 11–14; 16–30 → 16–30; 47–62 → 32–47; 64–77 → 49–62; 79–99 → 64–84; 101–116 → 86–101; 118–123 → 103–108; 125–146 → 110–131 |
| [architecture/generation/provider.ts](../cases/embedding-batching-retry-pacing/architecture/generation/provider.ts#L1-L72) | `b00bf59` · `sveltekit/src/lib/server/generation/provider.ts` | Excerpt (전체) · 1–72 → 1–72 |
| [architecture/generation/provider-factory.ts](../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.ts#L1-L36) | `b00bf59` · `sveltekit/src/lib/server/generation/provider-factory.ts` | Excerpt (전체) · 1–36 → 1–36 |
| [architecture/generation/provider-factory.test.ts](../cases/embedding-batching-retry-pacing/architecture/generation/provider-factory.test.ts#L1-L30) | `b00bf59` · `sveltekit/src/lib/server/generation/provider-factory.test.ts` | Excerpt (전체) · 1–30 → 1–30 |
| [architecture/generation/credentials.ts](../cases/embedding-batching-retry-pacing/architecture/generation/credentials.ts#L1-L65) | `b00bf59` · `sveltekit/src/lib/server/credentials.ts` | Excerpt (전체) · 1–65 → 1–65 |
| [architecture/generation-selection.excerpt.ts](../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.ts#L1-L69) | `b00bf59` · `sveltekit/src/lib/server/config.ts` | Excerpt · 1–7 → 1–7; 9–16 → 9–16; 98–101 → 18–21; 103–108 → 23–28; 110–114 → 30–34; 116–149 → 36–69 |
| [architecture/generation-selection.excerpt.test.ts](../cases/embedding-batching-retry-pacing/architecture/generation-selection.excerpt.test.ts#L1-L73) | `b00bf59` · `sveltekit/src/lib/server/config.test.ts` | Excerpt · 1–10 → 1–10; 12–17 → 12–17; 19–33 → 19–33; 53–58 → 35–40; 61–63 → 42–44; 82–98 → 46–62; 112–121 → 64–73 |
| [architecture/generation/orchestrator.ts](../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.ts#L1-L170) | `b00bf59` · `sveltekit/src/lib/server/generation/orchestrator.ts` | Excerpt (전체) · 1–170 → 1–170 |
| [architecture/generation/orchestrator.excerpt.test.ts](../cases/embedding-batching-retry-pacing/architecture/generation/orchestrator.excerpt.test.ts#L1-L105) | `b00bf59` · `sveltekit/src/lib/server/generation/orchestrator.test.ts` | Excerpt · 1–7 → 1–7; 9–13 → 9–13; 15–18 → 15–18; 20–22 → 20–22; 24–25 → 24–25; 28–38 → 27–37; 40–46 → 39–45; 48–78 → 47–77; 80–97 → 79–96; 120–127 → 98–105 |
| [architecture/generation/target-options.ts](../cases/embedding-batching-retry-pacing/architecture/generation/target-options.ts#L1-L29) | `0baebd9` · `sveltekit/src/lib/server/generation/target-options.ts` | Excerpt (전체) · 1–29 → 1–29 |
| [architecture/groq/generation.ts](../cases/embedding-batching-retry-pacing/architecture/groq/generation.ts#L1-L28) | `0baebd9` · `sveltekit/src/lib/server/providers/groq/generation.ts` | Excerpt (전체) · 1–28 → 1–28 |
| [architecture/groq/generation.excerpt.test.ts](../cases/embedding-batching-retry-pacing/architecture/groq/generation.excerpt.test.ts#L1-L51) | `0baebd9` · `sveltekit/src/lib/server/providers/groq/generation.test.ts` | Excerpt · 1–9 → 1–9; 11–19 → 11–19; 22–39 → 21–38; 54–65 → 40–51 |
| [architecture/embedding-space.excerpt.ts](../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.ts#L1-L44) | `9e96d4f` · `sveltekit/src/lib/server/indexing/corpus.ts` | Excerpt · 1–6 → 1–6; 8–9 → 8–9; 11–13 → 11–13; 21–26 → 15–20; 28–38 → 22–32; 40–50 → 34–44 |
| [architecture/embedding-space.excerpt.test.ts](../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.test.ts#L1-L79) | `9e96d4f` · `sveltekit/src/lib/server/indexing/corpus.test.ts` | Excerpt · 1–9 → 1–9; 173–184 → 11–22; 186–201 → 24–39; 203–217 → 41–55; 219–225 → 57–63; 227–233 → 65–71; 235–241 → 73–79 |
| [architecture/config-selection-history.json](../cases/embedding-batching-retry-pacing/architecture/config-selection-history.json#L1-L176) | 선택·계산한 입력은 아래 표 참조 | Reconstructed · 편집 구조 |
| [evidence/published-index-summary.json](../cases/embedding-batching-retry-pacing/evidence/published-index-summary.json#L1-L21) | 선택·계산한 입력은 아래 표 참조 | Reconstructed · 편집 구조 |

#### 재구성 규칙과 입력

- `architecture/config-selection-history.json`: 커밋별 `config/mosaic.example.json`의 generation·embedding 객체 전체를 복사하고 stage·sourceCommit·classification을 추가했습니다. 순서는 initial-contracts → independent-build-and-runtime → credential-binding-separated → generation-registry입니다.
- `evidence/published-index-summary.json`: 원본의 schemaVersion·createdAt·fingerprint·corpusFingerprint·embeddingProvider·embeddingModel·embeddingInputVersion·vectorDimension을 선택했습니다. Chunk 수와 documentHashes 항목 수를 세고, 모든 vector 길이·숫자·유한값 조건을 검사한 boolean을 기록했습니다. Source commit·원본 SHA-256·classification은 추적 필드입니다.

| 공개 재구성 · 입력 | 원본 커밋 | 원본 SHA-256 |
|---|---|---|
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `fc509b07cbc33035ae12bd6b837d93b3045d216b` | `b1321cdcb932d14b391b8303f72ce1ba9046228f479cf944f887e9d59e5ea6df` |
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `c7610edd7223be7fe77cd7ae9722c58c27e81690` | `4f62fc99f58b0dcfaec117b9ca5243bba6fb22297007d065c643258d87cdb5bd` |
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `de197a5c0c245f64034c94542e96b09f3361dd63` | `dbd3763070c18ba8dded16693266660d72b6d3e59d54a5199fe7d9a3d7af83d3` |
| `architecture/config-selection-history.json` · `config/mosaic.example.json` | `b00bf595439bd71540ace4e34d6f56a803eb5719` | `19976e438024e926ccdf1453c7d4145d9bdf1f52677b0fad4a1aa798f4061488` |
| `evidence/published-index-summary.json` · `indexes/provider=gemini/model=gemini-embedding-2/dimensions=768/input=v2/30886679a306cf2ee9a3cd10532e6a7cfb5549f85baf3f595f672c9273e4b150.json` | `033e02fabe868a14cd8a4a932b50fbdba9a064fa` | `a0d705c70fbba84886ddae0a64c3811f69bdca4927290ae6282f69eb4c3640f6` |

#### 개발 보고·연구 기록

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

기존 근거 등록부의 보관 세션 식별자는 `rollout-2026-10-16T20-10-29-01a14468-00a5-7ff2-8053-0e588b0c1335.jsonl.zst`, 채록 SHA-256은 `9a167a56794bb628bd58e92581435b4efcacab3568d01e83d9dbf36ad79f9b99`입니다. 해당 원본은 등록된 경로에서 확보되지 않았으며 이 hash는 기존 채록값입니다. 다음 메시지 위치도 기존 연구의 채록을 유지합니다.

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

### 공개본 검증

전체 파일 Excerpt 22개는 Git 객체와 bytes·SHA-256이 일치했습니다. 일부 Excerpt 15개의 선택 구간은 원본 문장과 일치했고 TypeScript 37개는 구문 분석을 통과했습니다. 재구성 JSON 2개는 문법·과거 설정 필드 대조·입력 hash 확인과 커밋 index의 metadata/vector 구조 검사를 통과했습니다. 기록된 RPM/TPM 계산도 명시한 가정과 함께 확인했습니다.

영문·한글 사실관계·출처 대응·코드 대상을 대조했습니다. README·상세 기록의 로컬 링크 412개는 파일·헤딩 앵커·라인 범위를 확인했습니다. 앞선 세 사례의 본문과 공개 파일 48개를 보존했습니다. 신규 파일의 credential 값·비공개 문서 본문·비공개 저장소 URL·로컬 사용자 경로를 점검했습니다. 검증은 원본 확인과 로컬 parsing·계산으로 진행했으며 당시 애플리케이션 테스트·API 호출·index build는 이번 공개 실행 범위 밖입니다.

## 05 — Cross-PC Index Portability

**개발 기간:** 2026-09-28 ~ 2026-10-26

**코드 분류:** Excerpt — 일부 범위 발췌를 포함한 원본 소스·테스트 22개; Reconstructed — 근거 요약 3개.

**결과:** 완성된 인덱스를 corpus와 embedding space로 식별하는 Git 관리 산출물로 전환했다. Checkout 기준 경로와 source canonicalization으로 PC 사이에서 재사용하고, 이후 Windows에서 만든 인덱스를 Ubuntu 운영 릴리스에 포함했다.

### 9월 28일: 문서 Embedding 반복 대신 산출물 공유

새 사무실 checkout에는 의존성과 로컬 인덱스가 없었고, 환경 설정은 다른 드라이브의 집 checkout을 가리켰다. 09:27:40 사용자는 시스템 PowerShell 정책을 유지하면서 checkout 기준 경로와 npm.cmd 사용을 요청했다. 10:00:18의 1261bf8은 스크립트 위치에서 프로젝트 루트를 구하고 Get-Command로 npm.cmd를 찾으며 cache/temp를 checkout 아래에 두었다. [개발 실행 스크립트](../cases/cross-pc-index-portability/bootstrap/dev.ps1#L1-L14)와 [인덱스 실행 스크립트](../cases/cross-pc-index-portability/bootstrap/index.ps1#L1-L15)에서 확인된다. 이는 초기 산출물 부재·환경 설정 사건이다.

19:59:19 사용자는 한 PC에서 Gemini/Cohere 인덱스를 생성하고 Git으로 공유하여 문서 Embedding에 드는 시간과 Provider quota를 절약하기를 요청했다. 영구 identity는 runtime target 이름·우선순위·credential slot 변경에도 유지되어야 했다. 23:19:09에는 Git 공유·atomic publication·publish 성공 후 stale 산출물 정리를 요청했다. 이 요청들은 연구 전사본에 보존되어 있다.

직전 schema 3 구현은 [fingerprint](../cases/cross-pc-index-portability/before/corpus.ts#L21-L33)와 [저장 디렉터리·reader](../cases/cross-pc-index-portability/before/store.ts#L8-L40)에 target.id를 반영했다. Runtime 역할의 이름 변경이 영구 산출물 identity를 바꿀 수 있었다. 20:14:41의 9e96d4f는 schema 4를 도입했다. Provider·모델·차원·embedding input version으로 embedding space를 정의하고 corpus와 이 계약으로 fingerprint를 정했다. [사례 04의 identity 발췌](../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.ts#L1-L44)와 [테스트](../cases/embedding-batching-retry-pacing/architecture/embedding-space.excerpt.test.ts#L1-L79)가 이 경계를 보존한다.

23:46:52의 9123e12는 운영용 산출물을 ignored cache/index에서 indexes로 옮겼다. 로컬 cache/temp와 작성 중인 indexes/**/*.tmp는 계속 ignore했다. [설정·ignore 이력 요약](../cases/cross-pc-index-portability/evidence/storage-policy.sample.json#L1-L25)에 대응한다. 저장 경로는 `indexes/provider=<encoded>/model=<encoded>/dimensions=N/input=vN/<fingerprint>.json`이 되었다. [경로 구현](../cases/cross-pc-index-portability/storage/space-paths.excerpt.ts#L15-L44)은 안전하지 않은 바이트와 대문자 바이트를 일정하게 인코딩한다. [테스트](../cases/cross-pc-index-portability/storage/space-paths.excerpt.test.ts#L76-L144)는 runtime metadata 변경과 다른 checkout 루트로의 복사를 다룬다. 사례 04에는 별도 출처를 가진 후속 [검증·publication snapshot](../cases/embedding-batching-retry-pacing/publication/store.excerpt.ts#L1-L94)이 공개되어 있다.

### 9월 30일: 청크는 같지만 개행에 따라 바뀌는 해시

21:16:48 사용자는 checkout의 개행에 따라 raw source hash가 달라지지만 청크는 같아 505-vector 산출물이 false-stale이 된다고 보고했다. 21:18:24에는 사무실에서 만든 Git 산출물을 다른 PC에서 바로 재사용하기를 요청했다. 이 시각과 관측은 보존된 연구 전사본에 근거한다.

22:23:36의 de58671은 [canonical content](../cases/cross-pc-index-portability/canonicalization/content.ts#L1-L4)를 추가해 CRLF와 단독 CR을 LF로 바꿨다. [Source 로더](../cases/cross-pc-index-portability/canonicalization/manifest.ts#L1-L50)는 [corpus 준비](../cases/cross-pc-index-portability/canonicalization/corpus.ts#L54-L73)에 canonical content를 공급하고, [청크 section 파싱](../cases/cross-pc-index-portability/canonicalization/chunker.ts#L20-L74)도 같은 변환을 사용한다. Corpus identity에는 chunker version·청크 크기 제한·source ID·파일·제목·공개 URL도 들어간다.

[Content 테스트](../cases/cross-pc-index-portability/canonicalization/content.excerpt.test.ts#L14-L29)는 Unicode 조합·공백·끝의 빈 줄을 보존한다. Unicode 정규화나 의미 있는 공백 변경은 해시를 바꾼다. [청크 테스트](../cases/cross-pc-index-portability/canonicalization/chunker.excerpt.test.ts#L14-L31)는 LF·CRLF·CR·mixed 입력의 ID·순서·metadata·내용을 비교한다. 개행 표현의 동등성을 명시적인 규칙으로 정했다.

### 명시적 migration으로 벡터 보존

[Migration](../cases/cross-pc-index-portability/migration/migrate.ts#L8-L42)은 선택한 legacy 산출물의 schema·embedding 계약을 검증하고 비교용 청크에서 벡터를 제거한 뒤 현재 corpus와 청크 ID·순서·metadata·내용이 정확히 같은지 확인한다. Fingerprint·corpus fingerprint·document hashes를 바꾸고 벡터와 생성 시각을 유지한다. 목적지 충돌은 실패하며, 다시 읽은 결과가 일치해야 선택한 legacy 파일을 삭제한다. [테스트](../cases/cross-pc-index-portability/migration/migrate.test.ts#L1-L113)는 보존·충돌·쓰기/검증 실패·잘못된 fingerprint를 다룬다. 이는 검증된 schema 4 계약 안에서 수행하는 명시적 offline migration이다.

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

[재구성한 비교 자료](../cases/cross-pc-index-portability/evidence/identity-migration-summary.json#L1-L46)에 전체 경로·파일/document hash digest·계산 방법을 보존했다. Identity metadata 변경에 따라 파일 해시는 바뀌었다.

### CURRENT와 확장된 이식성 계약

[상태 평가](../cases/cross-pc-index-portability/status/indexer.excerpt.ts#L23-L74)는 corpus/target fingerprint를 계산하고 정확한 파일을 검증한다. Current는 일치하는 산출물이 검증을 통과한 상태다. 필요한 파일이 없고 같은 space에 다른 JSON 산출물이 있으면 stale이다. 다른 상태는 missing·empty·invalid·corrupt·dimension mismatch를 구분한다. [메뉴 표시](../cases/cross-pc-index-portability/status/menu.excerpt.ts#L15-L50)는 계산한 상태를 CURRENT로 출력하고 재사용을 알린다.

[9월 30일 테스트](../cases/cross-pc-index-portability/verification/portability-20260930.test.ts#L1-L114)는 동일한 505-chunk Cohere 산출물을 LF·CRLF·CR·mixed checkout의 격리된 루트로 복사한다. 해시·청크·fingerprint·CURRENT·바이트·505개 후보 검색을 assertion으로 확인한다. Query embedding은 첫 저장 벡터로 stub해 첫 score가 약 1인지 확인한다. Document embedding·index build·migration·live fetch 호출은 없어야 한다. 실제 source 내용 추가는 stale이 되어야 한다.

10월 15일 20:36:12의 572bb2c는 [계약](../cases/cross-pc-index-portability/verification/portability-20261015.test.ts#L1-L137)을 Gemini와 Cohere 양쪽으로 확장했다. 해당 revision의 corpus는 27 sources·372 chunks다. 9월의 고정 파일명 대신 corpus와 계약으로 각 Provider의 current 산출물을 구하고 checksum과 네 개행 조건을 별도로 평가한다. 이는 이번에 확인한 당시 테스트의 assertion이다.

### 10월 22~26일: Windows 인덱스의 Ubuntu 운영 적용

요구는 Windows 로컬에서 빌드한 인덱스를 릴리스에 포함해 Ubuntu로 배포하는 운영 방식으로 이어졌다. 10월 22일 배포 기록의 환경은 Ubuntu 24.04.1·Node.js 24.22.1이다. 애플리케이션 빌드 결과·승인 Knowledge·설정·인덱스는 로컬에서 패키징하고 runtime 의존성은 Linux에 맞게 설치했다.

보존된 10월 22일 [패키징 발췌](../cases/cross-pc-index-portability/production/package-index.excerpt.mjs#L1-L22)는 기존 Gemini 인덱스를 선택·복사하고 bytes/SHA-256을 기록한다. 원본은 릴리스 20261022-033e02f-01에 대응하는 로컬 산출물이며 source hash로 식별한다. 선택한 문장은 생략한 credential 로딩 코드가 제공하는 secrets 등 원래 참조를 유지한다.

[선택한 릴리스 근거](../cases/cross-pc-index-portability/evidence/production-reuse-summary.json#L1-L165)는 manifest·source commit·Git 바이트·확보된 로컬 stage·보존된 운영 보고를 연결한다.

| 릴리스/source | 산출물 | 보존된 운영 검증 |
|---|---|---|
| 10월 22일 / 033e02f | Gemini gemini-embedding-2 / 768차원; 28 sources, 373 chunks; fingerprint 30886679…; 3,993,421 bytes; SHA-256 a0d705c70fbba84886ddae0a64c3811f69bdca4927290ae6282f69eb4c3640f6 | 14:29:27 index check 통과: current·373 chunks·fingerprint 일치; final health ok=true. |
| 10월 26일 / 8fa463e | 28 sources, 382 chunks; fingerprint dfdb4bbe…; 4,097,925 bytes; SHA-256 1cb34a4f657c9dfec8b601b03eb215749f144f6e9ac209079e1e62ec0dbae5ff | Fingerprint 일치·382 chunks·111개 파일 검증·health true. |
| 10월 26일 / e4aed0f·876ea52·189cf00 | 해당 릴리스들에서 같은 382-chunk fingerprint와 파일 SHA-256 유지 | 각 보존 보고에 fingerprint 일치·382 chunks·111개 파일 검증·health true 기록. |

10월 22일과 26일 인덱스는 각 시점의 corpus revision을 반영한다. 각 릴리스의 Git 바이트는 manifest와 일치하며, 선택한 다섯 릴리스의 보존된 stage 사본도 모두 일치한다. 10월 29일 사용자는 Windows에서 만든 인덱스를 Ubuntu에 배포해 서버 재빌드 없이 사용한다고 직접 확인했다. 이 후속 설명은 운영 적용 결과를 나타낸다.

10월 26일 21:49:10의 4fddd61로 커밋한 배포 도구는 검증을 코드화했다. [Manifest 검증](../cases/cross-pc-index-portability/production/verify-manifest.excerpt.py#L23-L56)은 commit·파일 크기/해시·인덱스 identity/수량·package version을 묶는다. [Offline 테스트](../cases/cross-pc-index-portability/production/manifest-contract.excerpt.test.py#L19-L69)는 identity/수량·변조·미등록 payload·draft 거부를 다룬다. [Runtime probe](../cases/cross-pc-index-portability/production/probe.mjs#L1-L43)는 활성 릴리스의 config·Knowledge·인덱스를 구하고 읽은 CURRENT 산출물을 manifest와 비교한다. 이 후속 probe는 로컬 검증과 의존성 import를 수행한다. 10월 22일 운영 진단에는 별도의 API 연결 확인도 포함됐다.

### 근거 수준과 남은 확인 사항

**코드 확인:** 식별한 구현·assertion, 커밋된 505-vector 산출물 두 개의 보존, 릴리스별 Git/manifest/stage 대조. **당시 보고:** 공유 요청·false-stale 진단·보존된 Ubuntu runtime/health 결과. 사용자가 10월 29일 밝힌 운영 설명에는 해당 후속 날짜를 유지했다.

다른 PC의 정확한 수정 전후 실행 로그는 확보되지 않았다. 기존에 인용된 “6 batches / 10.22 MiB” 실행과 검색 시각도 대응하는 원시 run ledger가 없다. 식별된 Git object는 벡터·내용 보존을 확인하며, 추가적인 과거 실행의 대응 관계는 미확인으로 남긴다.

### 출처와 공개 방식

9월 28일 09:27:40 요청은 session 01a0e55f-fed2-7973-93fb-e80d25f296b2 원본에서 직접 확인했다. 파일명 시작 시각은 09:17:48이고 압축 파일 SHA-256은 de5561f7093616ecfe76164289354fd8a99feb5e8b0d3766e22200ff68b0ee5b다. 이후 9월 28일 요청과 30일 관측은 session 01a0e775-78b0-73b0-ad5a-902cc720edc7·01a0e862-09ff-7d42-bd7e-6195ccaaa1a7·01a0f218-3b96-73e1-a0b9-a1696608e74f의 연구 전사본에 남아 있으며 이 세 원본은 이번 환경에서 확보되지 않았다. 10월 22일 원본 session 01a1613d-e5c6-76f2-9e3d-42c9eeca696b의 SHA-256은 37823ca6529dfca51f56283ca715ad80e733df9ce371251e261692d25527baef다. 비공개 통합 개발사·근거 등록부에서 연표와 미확인 항목을 가져왔으며 공개 준비 중 대조한 결과는 위에 구분했다.

전체 파일 Excerpt는 선택한 snapshot을 완전하게 보존한다. 부분 Excerpt는 아래 원본 범위와 구간 사이 빈 줄을 사용하고 import·식별자·애플리케이션 참조를 유지한다. Storage/status/menu는 재사용 동작을, 테스트는 관련 assertion을, 운영 발췌는 패키징·검증을 선택하고 운영 접근 정보는 비공개로 유지한다. Reconstructed JSON은 기록의 필드를 선택하고 digest 계산·편집상 그룹화를 표시한다. Knowledge·벡터 전체 payload는 비공개로 유지한다. 모든 소스 코드는 Excerpt이며 Mixed 재구성은 필요하지 않았다.

<details>
<summary>원본 snapshot·발췌 범위·SHA-256</summary>

원본 경로는 비공개 Synethos 저장소 기준이다. 라인 번호는 각 원본 snapshot 기준이며 공개 링크는 발췌 파일 기준이다. SHA-256은 파일 바이트를 대상으로 한다.

| 공개 파일 | 원본 commit / 경로 / 라인 | 원본 SHA-256 → 공개 SHA-256 |
|---|---|---|
| [bootstrap/dev.ps1](../cases/cross-pc-index-portability/bootstrap/dev.ps1#L1-L14) | `1261bf8962cf01e3ee88ed6b98724b5e0c4c6be4`<br>`scripts/dev.ps1`<br>1–14 | `c06135a469980330a23071ff0155077435047bbda090acede8dba5e9d28e300b` → `c06135a469980330a23071ff0155077435047bbda090acede8dba5e9d28e300b` |
| [bootstrap/index.ps1](../cases/cross-pc-index-portability/bootstrap/index.ps1#L1-L15) | `1261bf8962cf01e3ee88ed6b98724b5e0c4c6be4`<br>`scripts/index.ps1`<br>1–15 | `0c252f74ca5ffabe6dc1a63c3a27904b6ea1fa95499d6ab4466a3c0a46c7fb43` → `0c252f74ca5ffabe6dc1a63c3a27904b6ea1fa95499d6ab4466a3c0a46c7fb43` |
| [before/corpus.ts](../cases/cross-pc-index-portability/before/corpus.ts#L1-L56) | `646d8bc5303271dbfbd98b3d64a2b62c43cc327d`<br>`sveltekit/src/lib/server/indexing/corpus.ts`<br>1–56 | `7573377d6279a2dbf220214ef69dc3fc8add162c72e2f36b1ee915b87854f190` → `7573377d6279a2dbf220214ef69dc3fc8add162c72e2f36b1ee915b87854f190` |
| [before/store.ts](../cases/cross-pc-index-portability/before/store.ts#L1-L50) | `646d8bc5303271dbfbd98b3d64a2b62c43cc327d`<br>`sveltekit/src/lib/server/indexing/store.ts`<br>1–50 | `a3884d8760564754183312e1c143b089b091b889ab231ff5f3f9cdbef85ddce8` → `a3884d8760564754183312e1c143b089b091b889ab231ff5f3f9cdbef85ddce8` |
| [storage/space-paths.excerpt.ts](../cases/cross-pc-index-portability/storage/space-paths.excerpt.ts#L1-L44) | `9123e12ec742b501d435156573d448ce77a7ef3d`<br>`sveltekit/src/lib/server/indexing/store.ts`<br>1–44 | `fa0f799e3525b7a212f2d474a2488d3cc0608db26956e3c16e1ead2d68a90425` → `2c18008677d4135b2e414515bb14728c54d428243114e40abd1d20cbdee9d338` |
| [storage/space-paths.excerpt.test.ts](../cases/cross-pc-index-portability/storage/space-paths.excerpt.test.ts#L1-L144) | `9123e12ec742b501d435156573d448ce77a7ef3d`<br>`sveltekit/src/lib/server/indexing/store.test.ts`<br>1–74, 76–144 | `f240326af3cfffc726ea809f18d3d396d6477d81e06a3029064c5a51f89db361` → `23df365cef17b9d2048a706d6d757a52f96a15e7889809e30b9266f1dfcdde07` |
| [canonicalization/content.ts](../cases/cross-pc-index-portability/canonicalization/content.ts#L1-L4) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/knowledge/content.ts`<br>1–4 | `2346f73dcad254a9cd6a3bc05e19e2c0abff7a3c21985c411890db39c2102ed7` → `2346f73dcad254a9cd6a3bc05e19e2c0abff7a3c21985c411890db39c2102ed7` |
| [canonicalization/manifest.ts](../cases/cross-pc-index-portability/canonicalization/manifest.ts#L1-L50) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/knowledge/manifest.ts`<br>1–50 | `34784adb5057779f26f2592dadacca5ae045978de3ec9948e1019c81db9f9904` → `34784adb5057779f26f2592dadacca5ae045978de3ec9948e1019c81db9f9904` |
| [canonicalization/chunker.ts](../cases/cross-pc-index-portability/canonicalization/chunker.ts#L1-L110) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/knowledge/chunker.ts`<br>1–110 | `b92e6fffa7e77e903243abc6ef559943cf9f4ab253f9db3ec35065bb7cd35da5` → `b92e6fffa7e77e903243abc6ef559943cf9f4ab253f9db3ec35065bb7cd35da5` |
| [canonicalization/corpus.ts](../cases/cross-pc-index-portability/canonicalization/corpus.ts#L1-L73) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/corpus.ts`<br>1–73 | `808b33161d3d6d254c5987d2845d81543a45be39126153a018fa257a6b8ca0f4` → `808b33161d3d6d254c5987d2845d81543a45be39126153a018fa257a6b8ca0f4` |
| [canonicalization/content.excerpt.test.ts](../cases/cross-pc-index-portability/canonicalization/content.excerpt.test.ts#L1-L29) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/corpus.test.ts`<br>1–12, 315–330 | `926537eec4977e12072750199c76c1b8b58637204708ef828a23c5a16162896f` → `0e5dbc0065f6e3ca89cc005ef3e83290f08ce330509accd6d8f00b85909c622d` |
| [canonicalization/chunker.excerpt.test.ts](../cases/cross-pc-index-portability/canonicalization/chunker.excerpt.test.ts#L1-L31) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/knowledge/chunker.test.ts`<br>1–12, 126–143 | `22effa4e723bca03a67bba435ab13eeaa31e19f7567a39bb99db587c69c0fa09` → `c60fbbfdee344dc41942a20024e905c4a19192611b5d890ba89de037761d0544` |
| [migration/migrate.ts](../cases/cross-pc-index-portability/migration/migrate.ts#L1-L42) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/migrate.ts`<br>1–42 | `0033869f198ec9fd9dc2ab94d68f32a53eb08ec6fa0fd5e4f9a47dd1b6bd9bad` → `0033869f198ec9fd9dc2ab94d68f32a53eb08ec6fa0fd5e4f9a47dd1b6bd9bad` |
| [migration/migrate.test.ts](../cases/cross-pc-index-portability/migration/migrate.test.ts#L1-L113) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/migrate.test.ts`<br>1–113 | `2522d9d44d87191cbcb0ea90332fd5981530618c74943df9f62fd56cfe94ce2d` → `2522d9d44d87191cbcb0ea90332fd5981530618c74943df9f62fd56cfe94ce2d` |
| [verification/portability-20260930.test.ts](../cases/cross-pc-index-portability/verification/portability-20260930.test.ts#L1-L114) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/portability.test.ts`<br>1–114 | `86b50daef4e362fcfcf75edbd27f9d2a77ff200ab635f8ff2ce80564bfddd62e` → `86b50daef4e362fcfcf75edbd27f9d2a77ff200ab635f8ff2ce80564bfddd62e` |
| [status/indexer.excerpt.ts](../cases/cross-pc-index-portability/status/indexer.excerpt.ts#L1-L74) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/indexer.ts`<br>1–74 | `d60c5a48c89d4e88107979dbb82bdfd79a17ff59fff48f48622ff9583cc3ebc3` → `06321da46c8faf9454070453c2b865e9efd0ba20bb5f9153a67b78d129298a12` |
| [status/menu.excerpt.ts](../cases/cross-pc-index-portability/status/menu.excerpt.ts#L1-L50) | `de586719e463e324e18658c87bfe937e9506c1c0`<br>`sveltekit/src/lib/server/indexing/menu.ts`<br>1–50 | `fe7290b9ff2367cf24bad9e823bedbfcebe30f5882238b29ed0d2f05d89634a0` → `f3aac3e567310195f9e9e33e142690c2971093e48cf4f59d734f3a9929f7a037` |
| [verification/portability-20261015.test.ts](../cases/cross-pc-index-portability/verification/portability-20261015.test.ts#L1-L137) | `572bb2c159b21c5dcb2a4c2c9332d854775b793f`<br>`sveltekit/src/lib/server/indexing/portability.test.ts`<br>1–137 | `c3b89e675accfa1a27fbc9ef28f9fa976eb6d1a1b3fb42c0b3f9e39dc586b425` → `c3b89e675accfa1a27fbc9ef28f9fa976eb6d1a1b3fb42c0b3f9e39dc586b425` |
| [production/package-index.excerpt.mjs](../cases/cross-pc-index-portability/production/package-index.excerpt.mjs#L1-L22) | `local 2026-10-22 packaging artifact`<br>`tmp/synethos-deploy/package-release.mjs`<br>1–3, 5–15, 19–24 | `e5e78784cdd9f73b6115253677f468a2747c0ce371135b080d4564e32a4381b5` → `a2352d834317b7804dec46e6c6369ac50ab43dba20ae53bf590fd7263533ca5a` |
| [production/verify-manifest.excerpt.py](../cases/cross-pc-index-portability/production/verify-manifest.excerpt.py#L1-L56) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/deploy.py`<br>4–5, 7–8, 22–24, 34–36, 39–45, 62–95 | `8ec2db16cac2a5c77b46662ade526e779eca51c9c47fee517c4e1cb595a230ad` → `afc47670267bb7df95af49a16b7d49904db7fe1802a4d1e91c43cba96f44012b` |
| [production/manifest-contract.excerpt.test.py](../cases/cross-pc-index-portability/production/manifest-contract.excerpt.test.py#L1-L69) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/test_deploy.py`<br>2–18, 21–71 | `07ceb585168a3e8a717fd6b520850a56bd7a748617323139f578481596548914` → `0bb4d5be0e2ec60db8d199c6ab399485c3edc98510c76ff86b1df49c4543fbdd` |
| [production/probe.mjs](../cases/cross-pc-index-portability/production/probe.mjs#L1-L43) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/probe.mjs`<br>1–43 | `a4a6360520aada0d0fe5e7b91d07813c0753b89a2a405b7c3c9b39510e90cde1` → `a4a6360520aada0d0fe5e7b91d07813c0753b89a2a405b7c3c9b39510e90cde1` |
| [evidence/identity-migration-summary.json](../cases/cross-pc-index-portability/evidence/identity-migration-summary.json#L1-L46) | Reconstructed; 아래 입력표 | `729e4158a5d0413ccfb199dc0334674f49e0d8b836e72465888f51a7f2f7d9ff` |
| [evidence/storage-policy.sample.json](../cases/cross-pc-index-portability/evidence/storage-policy.sample.json#L1-L25) | Reconstructed; 아래 입력표 | `ec855da82a7dfebf2e25343f6d1ab536022e68e3a50bd38d136c0327945fc21b` |
| [evidence/production-reuse-summary.json](../cases/cross-pc-index-portability/evidence/production-reuse-summary.json#L1-L165) | Reconstructed; 아래 입력표 | `d5b7554018bb99b54e9f56c46ace6e647b6067e1615861777a43914d558150dc` |

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

### 공개 준비 검증

전체 파일 Excerpt 13개는 원본 바이트와 일치하고 부분 Excerpt 9개는 선언한 원본 범위와 일치했다. TypeScript/JavaScript 18개·Python 2개·PowerShell 2개의 구문 파싱을 통과했다. JSON 요약 3개는 파싱·입력 해시 검증을 통과했고 migration digest와 릴리스별 Git/manifest/stage 대조를 확인했다.

영문·한글의 source 링크 대상과 해시가 일치한다. 로컬 링크 522개의 파일·헤딩 anchor·라인 범위 검증을 통과했다. 사례 01~04의 본문과 코드·근거 87개 파일을 보존했다. 새 자료에서 credential 값·비공개 Knowledge payload·비공개 저장소 URL·로컬 사용자 경로·운영 접근 정보를 점검했다. 검증은 로컬 열람·파싱·계산으로 수행했다. 당시 애플리케이션 테스트·모델 호출·인덱스 빌드·실시간 서버 점검은 수행하지 않았다.
