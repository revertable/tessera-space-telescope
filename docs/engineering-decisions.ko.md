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
