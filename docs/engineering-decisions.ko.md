# Engineering Decisions

[Tessera 사례 목록](../README.ko.md) · [English](engineering-decisions.md)

상세 개발 기록을 사례별 문서로 나누었습니다. 아래 요약에서 각 사례로 이동할 수 있으며, 기존 URL과 세부 앵커는 해당 사례 요약으로 연결됩니다.

<a id="목차"></a>

## 근거를 읽는 방법

- **코드로 확인:** 식별된 당시 코드에서 확인되는 동작 또는 공개 발췌본과 원본 bytes의 일치 확인입니다.
- **당시 보고:** 보존된 개발 요청·실험 산출물·검증 보고서에 적힌 관찰입니다. 각 관찰의 실행 조건과 검증 범위를 함께 기록합니다.
- **미확인:** 확보된 기록으로 원인·실행 대응·일반적인 효과가 입증되지 않은 내용입니다.

각 사례의 출처표에 코드 기준본과 보존 근거를 식별합니다. 당시 테스트도 구현 근거로 공개하며, 이 저장소에는 해당 의존성이나 테스트 실행기를 제공하지 않습니다.

2026년 10월 29일 집 PC의 보존 원본을 추가 대조했습니다. [복구 근거 등록부](evidence/recovered-source-register.json)는 사례 01~06의 원본 파일 해시, 세션·메시지 시각, 관측 조건과 남은 확인 사항을 보존합니다. 사용자 입력 이력은 요청·판단의 원문으로, 실험 결과와 완료 보고는 당시 실행 조건의 기록으로 구분합니다.

## 01 — From Local Qwen/Ollama Inference to the Gemini API

<a id="문제와-제약"></a>
<a id="실험과-철회한-선택"></a>
<a id="판단"></a>
<a id="구현-로컬-http-호출에서-서버-api-client로"></a>
<a id="구현-제공자를-바꾸면서-grounding-유지"></a>
<a id="구현-embedding-계약-변경과-새-index"></a>
<a id="검증-결과와-한계"></a>
<a id="코드-원본성과-출처-추적"></a>
<a id="전환-전-기준본"></a>
<a id="전환-후-구현테스트-기준본"></a>
<a id="개발-기록과-검증-근거"></a>

**개발 날짜:** 2026-09-26

로컬 Qwen 추론에서 하드웨어·응답 시간 제약을 확인했다. 사용자는 로컬 추론 운영을 중단하고 Gemini API를 선택했으며, grounding을 유지하면서 모델·embedding 연결을 교체했다.

[전체 개발 기록 읽기](decisions/01-local-inference-to-gemini.ko.md)

## 02 — From GitBook MCP to Local Knowledge

<a id="문제와-초기-선택"></a>
<a id="endpoint-관측에서-확인한-사실"></a>
<a id="구현-방어적으로-읽는-근거-경계"></a>
<a id="source를-결합하자-드러난-다른-문제"></a>
<a id="판단-문서-편입을-먼저-하고-원격-source-제거"></a>
<a id="구현-승인-local-파일과-공개-인용-출처"></a>
<a id="corpus-준비와-index-준비는-다른-상태"></a>
<a id="달라진-점유지한-점미확인-사항"></a>
<a id="출처-추적과-공개-방식"></a>
<a id="코드-대응표"></a>
<a id="코드-외-근거"></a>
<a id="공개본-검증"></a>

**개발 시기:** 2026-09-26 ~ 2026-09-28

GitBook MCP를 Cosmic Horizon의 외부 KnowledgeSource로 검토했다. Endpoint·다중 source 관측 뒤 승인 문서를 Local Knowledge로 편입하고, 문서 import·index 준비·MCP 제거를 나누어 진행했다.

[전체 개발 기록 읽기](decisions/02-gitbook-to-local-knowledge.ko.md)

## 03 — Cohere 도입·평가·제거

<a id="개발-순서"></a>
<a id="대체-embedding-space-도입"></a>
<a id="generation으로-평가-확대"></a>
<a id="10월-1일-질문-대상과-record-화자"></a>
<a id="10월-3일-고정-입력-generation-결과와-fallback-선택"></a>
<a id="10월-6일-classifier-gate에서-후속-실험-중단"></a>
<a id="10월-15일-검색에서-관측된-이점"></a>
<a id="제거-판단-규모운영-비용과-성능-이점의-비교"></a>
<a id="제거-구현과-index-인계"></a>
<a id="검증-범위와-남은-사항"></a>
<a id="출처-추적과-공개-방식-1"></a>
<a id="기준-커밋"></a>
<a id="코드-대응표-1"></a>
<a id="재구성-규칙"></a>
<a id="코드-외-근거와-접근-상태"></a>
<a id="공개본-검증-1"></a>

**개발 시기:** 2026-09-28 ~ 2026-10-17

Cohere를 embedding·generation 대안으로 도입하고 역할별 장점과 실패를 평가했다. 사용자는 관측된 차이와 Synethos 규모·대체 가능성·운영 비용을 종합해 최종 제거를 선택했다.

[전체 개발 기록 읽기](decisions/03-cohere-evaluation-and-retirement.ko.md)

## 04 — Provider 교체 설계와 Embedding 안정화

<a id="문제와-변경-순서"></a>
<a id="계약factoryadapter공통-동작의-분리"></a>
<a id="문서별-요청에서-provider-소유-batch로"></a>
<a id="복구-정책에-앞선-실패-진단"></a>
<a id="build-targetruntime-순서credential-분리"></a>
<a id="현재-실패한-document-batch의-retry"></a>
<a id="같은-구조를-generation-교체에-활용"></a>
<a id="10월-16일-retry에-요청-시작-pacing-추가"></a>
<a id="build-내부-gate와-공통-retry-logging"></a>
<a id="index-호환성과-실패-시-산출물-보호"></a>
<a id="rebuild-완료-산출물-확인"></a>
<a id="검증-수준과-원본-선택"></a>
<a id="출처-추적과-공개-방식-2"></a>
<a id="기준-커밋-1"></a>
<a id="코드-대응표-2"></a>
<a id="재구성-규칙과-입력"></a>
<a id="개발-보고연구-기록"></a>
<a id="공개본-검증-2"></a>

**개발 시기:** 2026-09-26 ~ 2026-10-17

Provider 계약·Factory·설정 선택을 분리해 Gemini·Cohere·Groq 변경을 수용했다. 문서 embedding은 provider 소유 batching·bounded retry·요청 시작 pacing과 검증된 index publish로 발전했다.

[전체 개발 기록 읽기](decisions/04-provider-architecture-and-embedding-reliability.ko.md)

## 05 — Cross-PC Index Portability

<a id="9월-28일-문서-embedding-반복-대신-산출물-공유"></a>
<a id="9월-30일-청크는-같지만-개행에-따라-바뀌는-해시"></a>
<a id="명시적-migration으로-벡터-보존"></a>
<a id="current와-확장된-이식성-계약"></a>
<a id="10월-2226일-windows-인덱스의-ubuntu-운영-적용"></a>
<a id="근거-수준과-남은-확인-사항"></a>
<a id="출처와-공개-방식"></a>
<a id="공개-준비-검증"></a>

**개발 기간:** 2026-09-28 ~ 2026-10-26

사용자는 PC와 checkout이 달라도 빌드한 index를 재사용하려 했다. Identity·개행 canonicalization·호환성 검증을 정비했고, Windows 빌드 인덱스의 Ubuntu 운영 적용으로 이어졌다.

[전체 개발 기록 읽기](decisions/05-cross-pc-index-portability.ko.md)

## 06 — Model Selection: Quality and Availability

<a id="9월-26일-모델-선택을-가용성-정책으로-구현"></a>
<a id="9월-30일10월-2일-명시적-후보-비교와-runtime-역할-선택"></a>
<a id="10월-3일-품질-이점이-있어도-운영하기-어려웠던-gemini-38"></a>
<a id="10월-3일-다른-groq-모델을-fallback으로-채택"></a>
<a id="10월-3일-reasoning-설정을-비교한-뒤-기존-설정-유지"></a>
<a id="10월-6일-운영-fallback과-명시적-평가의-실행-계약-분리"></a>
<a id="10월-15일-canonical-evidence를-고정한-generation-비교"></a>
<a id="제품-운영-범위에서-primary-수용"></a>
<a id="근거-수준공개-방식남은-확인-사항"></a>
<a id="공개-준비-검증-1"></a>
<a id="10월-29일-원본-복구추가-검증"></a>

**개발 기간:** 2026-09-26 ~ 2026-10-16

고정 입력 평가에서 응답 품질·grounding·citation·schema·지연·가용성을 실제 모델 선택에 연결했다. 무료 티어 한도와 반복 실패를 고려해 Gemini primary·Groq fallback 구성을 결정했다.

[전체 개발 기록 읽기](decisions/06-model-selection-quality-and-availability.ko.md)

## 07 — Knowledge·Index 일관성과 복원 가능한 배포

<a id="운영-환경과-실제-사용할-수-있었던-공간"></a>
<a id="총-3개-보관-사용자-선택과-ai-설계의-경계"></a>
<a id="이전-배포에서-해결한-문제와-새-후보의-요구"></a>
<a id="코드knowledgeindex를-하나의-릴리스로-묶기"></a>
<a id="원본-요구선언승인과-실행-순서"></a>
<a id="실제-운영-결과와-테스트에서-확인한-복원"></a>
<a id="출처-범위와-남은-확인-사항"></a>
<a id="공개-준비-검증-2"></a>

**개발 기간:** 2026-10-22 ~ 2026-10-26. 운영 배경·보관 선택·설계 위임에 대한 개발자 설명은 2026-10-29에 직접 보충했다.

제한된 Ubuntu 디스크 공간에서 총 3개 릴리스 보관을 선택했다. 코드·Knowledge·Index를 함께 배포하고 Linux 의존성·활성 root·전환·복구를 각 실행의 근거로 검증했다.

[전체 개발 기록 읽기](decisions/07-knowledge-index-consistency-and-recoverable-deployment.ko.md)

## 08 — Fix the Chunker, Not the Documents

<a id="순위-조정-기법을-선택하기-전에-실패-위치-구분"></a>
<a id="corpus-점검에서-드러난-계층-문제"></a>
<a id="문서는-유지하고-처리-계층을-수정한-사용자-판단"></a>
<a id="일관된-영향-분석을-확인한-뒤-승인"></a>
<a id="후속-lexicalhybrid-보정의-coverage-증가와-근거-손실"></a>
<a id="근거-범위와-후속-확인"></a>
<a id="공개-준비-검증-3"></a>

**개발 기간:** 2026-09-29 ~ 2026-10-02.

검색 근거 누락과 생성 실패를 구분하고, 정상 Markdown을 parser에 맞춰 바꾸는 안을 거부했다. 청커를 일반적으로 수정했으며, 이후 lexical/hybrid 후보는 유효한 근거 손실로 미채택됐다.

[전체 개발 기록 읽기](decisions/08-fix-the-chunker-not-the-documents.ko.md)
