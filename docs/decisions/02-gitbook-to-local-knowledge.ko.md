# 02 — From GitBook MCP to Local Knowledge

[전체 사례](../../README.ko.md) · [English](02-gitbook-to-local-knowledge.md) · [이전: 01](01-local-inference-to-gemini.ko.md) · [다음: 03](03-cohere-evaluation-and-retirement.ko.md)

**근거 수준:** 코드 확인은 식별한 과거 소스, 당시 보고는 기록된 조건의 관측, 미확인은 해결되지 않은 사실·인과관계를 뜻합니다. 테스트는 당시 소스 근거로 수록합니다. 시각은 KST(UTC+09:00)이며 개발 사건과 근거 검증 날짜를 구분합니다.

**문서 편집:** 2026-10-30, 기준 `2fc5094`. 아래 과거 공개 검증 기록의 날짜와 범위를 유지합니다. 2026-10-31에는 `f7fb082` 기준으로 중복 설명과 검증 한계 표현을 정리했습니다.

**개발 시기:** 2026-09-26 ~ 2026-09-28

**코드 분류:** Excerpt 14개와 Reconstructed manifest 표본 1개입니다.

**결과:** 원격 문서 candidate 경로를 철회하고 승인 Markdown을 유일한 지식 검색 source로 정리했으며, intent-coverage 평가는 유지했습니다. 문서 편입·corpus 준비와 전체 index build 완료는 별도 상태입니다.

## 문제와 초기 선택

GitBook은 Cosmic Horizon의 영문·한글 문서를 게시하고 MCP로 제공하던 플랫폼입니다. Synethos는 이 문서들을 외부 KnowledgeSource로 검토한 뒤 승인 Markdown을 Local Knowledge로 편입했습니다. 초기에는 문서 검색과 답변 생성의 책임을 분리해 GitBook MCP를 조사했습니다. 9월 26일의 보존된 요청은 Local RAG, API/UI, index와 ranking을 유지하는 되돌릴 수 있는 probe를 요구했습니다.

9월 27일 03:54:45의 foundation 커밋 f2914de는 [source 계약](../../cases/gitbook-mcp-to-local-knowledge/foundation/source.ts#L1-L17)과 [Local/GitBook을 선택하는 factory](../../cases/gitbook-mcp-to-local-knowledge/foundation/source-factory.ts#L11-L24)를 정의합니다. [Adapter의 허용 도구 타입](../../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L1-L37)은 searchDocumentation/getPage만 포함합니다. 서버가 askQuestion/sendFeedback을 노출해도 adapter에는 실행할 대응 메서드가 없었습니다. [Capability 관측](../../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L111-L121)은 이를 목록으로 확인하며 방문자 답변이나 feedback 전송에 사용하지 않았습니다.

근거 확보, 해석, 답변 생성은 서로 다른 책임으로 유지했습니다. 이 foundation 기준본의 probe 결과는 retrieval, generation, /api/ask, /api/search에 연결되지 않았습니다.

## Endpoint 관측에서 확인한 사실

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

집 PC에서 추가 확보한 raw probe는 9월 26일 23:45:48.199와 27일 21:05:46.310의 MCP root endpoint 실행입니다. 각 파일에 검색 4건과 검색별 page 결과 2개, server version 0.27.2와 도구 4개가 보존돼 있습니다. [복구 근거 등록부](../evidence/recovered-source-register.json)에 두 파일의 원본 hash·관측 시각·검색별 반환 형태를 추가했습니다. 26일 파일은 위 Single-Space 관측의 원본이고 27일 파일은 그 시각의 root endpoint 관측을 뒷받침하며, 위 two-endpoint 비교와 28일 09:44:31.093 실행은 각각의 기록으로 유지합니다.

## 구현: 방어적으로 읽는 근거 경계

[Adapter](../../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L67-L109)는 HTTPS endpoint를 검사하고, 비활성 source 사용과 다른 origin의 page 읽기를 거부하며 두 허용 연산을 제공합니다. [Probe 발췌](../../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-probe.excerpt.ts#L7-L54)는 원래 질문 목록, 결과 타입, 질문별 page 한도와 search/page orchestration을 보존합니다. 파일 저장 CLI와 raw-report 저장 코드는 제외했습니다.

이후 26a5409에 커밋된 [검색 결과 parser](../../cases/gitbook-mcp-to-local-knowledge/multi-source/gitbook-search-results.ts#L15-L75)는 text field를 추출하고 부적합 URL을 거부합니다. Origin·Site 경로, credential, query/fragment, 인코딩된 경로 구분자·이탈 경로와 MCP endpoint 자체를 검사합니다.

원래 resultIndex를 보존하지만 provider score를 부여하거나 typed locale/pair identity를 추정하지 않습니다. 빈 결과와 비어 있지 않지만 사용할 수 있는 항목이 없는 결과도 구분합니다.

[당시 adapter 테스트](../../cases/gitbook-mcp-to-local-knowledge/verification/gitbook-mcp-source.test.ts#L27-L104)는 합성 client로 도구 제한, 실행 없는 capability 관측, 비활성 source와 cross-origin page 거부를 검사합니다. 합성 client를 사용한 adapter 계약 테스트입니다.

## Source를 결합하자 드러난 다른 문제

9월 27일에는 Local candidate와 최종 answer evidence를 분리하고, 다중 source 수집과 ranking을 차례로 추가했습니다. 이후 다중 source 기준본의 [수집 코드](../../cases/gitbook-mcp-to-local-knowledge/multi-source/source-candidates.ts#L23-L58)는 설정의 knowledgeSourceId를 보존하고 Local candidate와 파싱한 GitBook hit를 구분합니다.

GitBook client는 finally에서 닫으며, 최종 citation은 evidence 선택 단계에서 부여합니다.

[Ranking](../../cases/gitbook-mcp-to-local-knowledge/multi-source/relevance.ts#L23-L64)은 Local cosine score를 유지하고 GitBook query·document hit를 embedding해 cosine 기반 relevance score를 구합니다. 원래 MCP 결과 순위는 metadata로 유지합니다. Source 간 score 보정 수준은 미검증입니다.

[다중 source intent 발췌](../../cases/gitbook-mcp-to-local-knowledge/multi-source/intent-orchestration.excerpt.ts#L1-L22)는 원문·derived query를 계획하고 query마다 수집·ranking한 뒤 merge에 위임하는 다음 계층을 보여줍니다. Identity에는 설정 source와 문서 ID 또는 public URL이 포함됩니다.

이 identity 규칙에서 같은 URL도 설정 source ID가 다르면 별도 candidate가 됩니다. 이 구현에는 source 간 번역 pair 중복 제거가 없습니다.

9월 28일 10:38:04의 보존된 사용자 메시지는 derived query가 Verification Philosophy를 25→2위, Human Auditor를 9→2위로 올렸다고 보고합니다. 그러나 초기 full round-robin merge가 기존 AI-role 근거를 4→9위로 밀어 mixed 질문 recall@5는 0.5에 머물렀습니다. 전체 live harness는 약 19.3→34.3초로 늘고 embedding provider 오류도 관측됐습니다.

사용자는 분해의 개선을 버리는 대신 실제 lane 순서와 candidate identity로 merge placement를 재검토하도록 했습니다.

해당 메시지의 UTC는 2026-09-28T01:38:04.008Z입니다. 공개 기준본에는 이후 수정된 orchestration이 들어 있습니다. 당시 유지한 merge 정책은 holistic seed, 의도별 상위 anchor, derived tail보다 앞선 original-query backbone을 사용했습니다.

11:45:32의 후속 요청은 2-intent 질문에서 약 6 embedding·3 GitBook search와 무료 티어 100 RPM의 429 관측을 기록합니다. 이를 바탕으로 fan-out과 중복 embedding 작업을 조사했습니다. 이 관측은 당시 보고에서 가져왔습니다.

[수집 테스트](../../cases/gitbook-mcp-to-local-knowledge/verification/source-candidates.test.ts#L6-L85)는 합성 fixture로 provenance와 원래 ranking signal 보존 계약을 표현합니다. 다중 source·intent 작업은 평가 경로에서 다뤘고, production answer/search route는 기존 Local 단일 query 검색을 사용했습니다.

## 판단: 문서 편입을 먼저 하고 원격 source 제거

9월 28일 12:07:16.238 사용자는 제공한 EN/KR Markdown snapshot을 Local Knowledge에 편입하고 향후 Local 중심으로 검색을 단순화하기로 명시했습니다. 당장의 범위는 import, manifest 등록, index 준비였으며 MCP 코드 제거는 다음 단계로 뒀습니다.

12:45:49.898에는 42문서·475 chunks 편입 완료와 daily embedding quota로 index rebuild가 막힌 상태를 구분해 MCP 제거 범위 분석을 요청했습니다. 13:50:33 후속 요청은 편입·MCP 제거를 이미 존재하는 미커밋 변경으로 보존하면서 다음 embedding-target 작업을 시작하도록 했습니다. 결합된 구현은 14:50:04에 5f71fbe로 커밋됐습니다.

Source 단순화와 단계별 범위는 기록된 사용자 선택입니다.

## 구현: 승인 Local 파일과 공개 인용 출처

전환은 GitBook adapter, parser, probe, source factory·계약, 원격 결과 공통 relevance 계층과 MCP dependency를 제거했습니다. Runtime의 지식 검색 source는 knowledge/sources.json에 등록한 승인 Markdown이 됐습니다. 공개 문서 URL은 실시간 검색 endpoint 대신 인용 metadata로 유지했습니다. Knowledge import는 수동이며 원격 자동 동기화는 추가하지 않았습니다.

[승인 source loader](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/manifest.ts#L16-L49)는 manifest 형태, ID·중복, file/title, 경로 경계, Markdown 확장자와 publicUrl protocol을 검사한 뒤 등록 파일을 읽습니다. 등록 여부는 manifest로 관리합니다.

[Reconstructed manifest 표본](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/approved-sources.sample.json#L1-L17)은 전환 manifest의 Why We Study 두 항목을 골라 새 2항목 문서로 구성했습니다. 제목은 같지만 ID·local file 경로·public URL은 다릅니다. 42문서 manifest에서 항목을 선택했으며 전체 manifest와 문서 본문은 비공개로 유지합니다.

[Local 검색 경로](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/search.ts#L47-L121)는 일치하고 사용 가능한 target index를 요구하고, 질문을 embedding해 Local chunk를 ranking한 뒤 evidence를 선택합니다. [Evidence 선택](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/search.ts#L99-L113)은 sourceId, title, section, content, publicUrl을 유지하고 선택한 record에 citation ID를 부여합니다. Local-only는 지식 검색 source의 범위이며 query embedding은 여전히 외부 provider를 호출할 수 있습니다.

[Local intent 발췌](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/intent-orchestration.excerpt.ts#L1-L25)는 계획·merge 위임을 유지하면서 원격 source 수집·ranking을 Local candidate 검색으로 바꿉니다. 기본 경로는 query bundle을 하나의 embedding target에서 실행하고 해당 target을 run과 함께 반환합니다.

Source identity는 Local chunk identity가 됩니다. 같은 전환에서 query embedding을 위한 embedding-provider fallback도 추가했습니다. Provider adapter의 상세 구현은 이번 발췌 범위 밖입니다.

[Local query 테스트 발췌](../../cases/gitbook-mcp-to-local-knowledge/verification/local-query-search.excerpt.test.ts#L13-L42)는 주입한 검색 함수로 계획 query마다 Local 검색 1회를 확인합니다. 실제 target index와 provider fallback을 사용하는 통합 검증은 별도 범위입니다.

## Corpus 준비와 index 준비는 다른 상태

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

## 달라진 점·유지한 점·미확인 사항

원격 문서 source를 제거하면서 승인 문서 등록, vector retrieval, 공개 인용 출처, 규칙 기반 intent 계획과 coverage 평가는 유지하거나 조정했습니다. 전체 index 검색 품질과 probe 실행의 대응 범위는 아래에 기록합니다.

앞선 raw probe 실행의 전체 대응과 전환 시점에 완성된 전체 index를 사용한 end-to-end 검색 품질은 미확인입니다. 초기 round-robin 회귀는 당시 보고된 실패로 남기며, 공개 코드는 이후 수정본을 기록합니다. 이번 공개를 위해 MCP probe, embedding, index build, 애플리케이션 테스트를 재실행하지 않았습니다.

## 출처 추적과 공개 방식

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

### 코드 대응표

원본 경로는 비공개 저장소 기준이며 공개 링크는 Tessera 파일로 연결합니다. 구간은 양 끝을 포함하고 `원본 → 공개` 순서입니다. 전체 파일 공개도 분류는 Excerpt입니다.

| 공개 파일 | 기준본 · 원본 경로 | 분류 · 발췌 대응 |
|---|---|---|
| [foundation/source.ts](../../cases/gitbook-mcp-to-local-knowledge/foundation/source.ts#L1-L17) | foundation · `sveltekit/src/lib/server/knowledge/source.ts` | Excerpt (전체) · 1–17 → 1–17 |
| [foundation/source-factory.ts](../../cases/gitbook-mcp-to-local-knowledge/foundation/source-factory.ts#L1-L24) | foundation · `sveltekit/src/lib/server/knowledge/source-factory.ts` | Excerpt (전체) · 1–24 → 1–24 |
| [foundation/gitbook-mcp-source.ts](../../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-mcp-source.ts#L1-L129) | foundation · `sveltekit/src/lib/server/knowledge/gitbook-mcp-source.ts` | Excerpt (전체) · 1–129 → 1–129 |
| [foundation/gitbook-probe.excerpt.ts](../../cases/gitbook-mcp-to-local-knowledge/foundation/gitbook-probe.excerpt.ts#L1-L54) | foundation · `sveltekit/src/lib/server/knowledge/gitbook-mcp-probe.ts` | Excerpt · 5–9 → 1–5; 12–17 → 7–12; 19–19 → 14–14; 21–26 → 16–21; 28–33 → 23–28; 66–90 → 30–54 |
| [multi-source/gitbook-search-results.ts](../../cases/gitbook-mcp-to-local-knowledge/multi-source/gitbook-search-results.ts#L1-L75) | parser · `sveltekit/src/lib/server/knowledge/gitbook-search-results.ts` | Excerpt (전체) · 1–75 → 1–75 |
| [multi-source/source-candidates.ts](../../cases/gitbook-mcp-to-local-knowledge/multi-source/source-candidates.ts#L1-L58) | multi · `sveltekit/src/lib/server/retrieval/source-candidates.ts` | Excerpt (전체) · 1–58 → 1–58 |
| [multi-source/relevance.ts](../../cases/gitbook-mcp-to-local-knowledge/multi-source/relevance.ts#L1-L64) | multi · `sveltekit/src/lib/server/retrieval/relevance.ts` | Excerpt (전체) · 1–64 → 1–64 |
| [multi-source/intent-orchestration.excerpt.ts](../../cases/gitbook-mcp-to-local-knowledge/multi-source/intent-orchestration.excerpt.ts#L1-L22) | multi · `sveltekit/src/lib/server/retrieval/intent-coverage.ts` | Excerpt · 51–55 → 1–5; 127–142 → 7–22 |
| [local-knowledge/manifest.ts](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/manifest.ts#L1-L49) | local · `sveltekit/src/lib/server/knowledge/manifest.ts` | Excerpt (전체) · 1–49 → 1–49 |
| [local-knowledge/search.ts](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/search.ts#L1-L121) | local · `sveltekit/src/lib/server/retrieval/search.ts` | Excerpt (전체) · 1–121 → 1–121 |
| [local-knowledge/intent-orchestration.excerpt.ts](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/intent-orchestration.excerpt.ts#L1-L25) | local · `sveltekit/src/lib/server/retrieval/intent-coverage.ts` | Excerpt · 45–47 → 1–3; 119–139 → 5–25 |
| [verification/gitbook-mcp-source.test.ts](../../cases/gitbook-mcp-to-local-knowledge/verification/gitbook-mcp-source.test.ts#L1-L104) | foundation · `sveltekit/src/lib/server/knowledge/gitbook-mcp-source.test.ts` | Excerpt (전체) · 1–104 → 1–104 |
| [verification/source-candidates.test.ts](../../cases/gitbook-mcp-to-local-knowledge/verification/source-candidates.test.ts#L1-L85) | multi · `sveltekit/src/lib/server/retrieval/source-candidates.test.ts` | Excerpt (전체) · 1–85 → 1–85 |
| [verification/local-query-search.excerpt.test.ts](../../cases/gitbook-mcp-to-local-knowledge/verification/local-query-search.excerpt.test.ts#L1-L42) | local · `sveltekit/src/lib/server/retrieval/intent-coverage.test.ts` | Excerpt · 1–1 → 1–1; 2–2 → 3–3; 3–3 → 5–5; 4–8 → 7–11; 10–20 → 13–23; 85–102 → 25–42 |
| [local-knowledge/approved-sources.sample.json](../../cases/gitbook-mcp-to-local-knowledge/local-knowledge/approved-sources.sample.json#L1-L17) | local · `knowledge/sources.json` | Reconstructed · 선택 ID는 아래에 명시; 새 JSON 구성 |

JSON 선택 항목:
- `cosmic-horizon-en-perspective-why-we-study`
- `cosmic-horizon-kr-perspective-why-we-study`

### 코드 외 근거

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

## 공개본 검증

전체 파일 Excerpt 10개의 bytes·SHA-256과 일부 Excerpt 4개의 모든 발췌 구간을 원본 Git 객체와 대조했습니다. 재구성 JSON의 version과 두 항목은 원본 manifest와 일치합니다. TypeScript 14개는 구문 분석을 통과했습니다. 이 검사는 원본의 계약 테스트 실행이나 live 검색·embedding 검증과 구분합니다.

영문·한글의 사건, 날짜, 수치, 조건, 출처 대응표와 코드 링크를 대조했습니다. README → 사례 헤딩 → 코드 라인 링크의 파일·앵커·범위를 검사했고, 첫 사례의 코드 12개와 공통 설명 이동 외 본문을 보존했습니다. 공개 파일에서 자격 증명 값, 비공개 저장소 URL, 로컬 사용자 경로와 원본 문서 본문을 점검했습니다.

[전체 사례로 돌아가기](../../README.ko.md)
