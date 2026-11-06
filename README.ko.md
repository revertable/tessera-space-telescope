# Tessera

[English](README.md)

Tessera는 비공개 프로젝트 **Synethos**의 실제 구현 코드와 엔지니어링적 판단 중 일부를 공개하는 저장소입니다. 코드와 함께 그 구현에 영향을 준 문제, 제약, 선택과 검증 결과를 보여줍니다.

Synethos 전체 소스는 비공개로 유지하며, Tessera에는 선택한 코드와 그 엔지니어링적 판단을 이해하는 데 필요한 맥락만 공개합니다.

이 저장소는 구현 발췌를 열람하기 위한 자료이며, 실행·빌드·테스트 환경은 제공하지 않습니다. 공개하는 코드는 원래 언어의 파일 확장자와 문법을 유지합니다.

코드는 비공개 원본과의 관계에 따라 구분합니다.

| 분류 | 의미 |
|---|---|
| **Excerpt** | Synethos 원본 구현에서 선택하여 발췌한 코드입니다. |
| **Reconstructed** | Synethos의 엔지니어링적 선택을 설명하기 위해 공개용으로 다시 구성한 코드입니다. |
| **Mixed** | 원본 발췌와 재구성한 코드를 함께 포함합니다. 재구성한 부분은 소스 코드 주석으로 식별합니다. |

## Engineering Decisions

각 사례에서 문제·판단·구현·검증과 코드 출처를 읽을 수 있습니다.

| 번호 | 사례 | 개발 날짜 |
|---|---|---|
| 01 | [로컬 Qwen/Ollama 추론에서 Gemini API로 전환](docs/decisions/01-local-inference-to-gemini.ko.md) | 2026-09-26 |
| 02 | [GitBook MCP에서 로컬 지식베이스로 전환](docs/decisions/02-gitbook-to-local-knowledge.ko.md) | 2026-09-26 ~ 2026-09-28 |
| 03 | [Cohere 도입·평가·제거](docs/decisions/03-cohere-evaluation-and-retirement.ko.md) | 2026-09-28 ~ 2026-10-17 |
| 04 | [모델 제공자 교체 설계와 임베딩 안정화](docs/decisions/04-provider-architecture-and-embedding-reliability.ko.md) | 2026-09-26 ~ 2026-10-17 |
| 05 | [PC 간 인덱스 이식성](docs/decisions/05-cross-pc-index-portability.ko.md) | 2026-09-28 ~ 2026-10-26 |
| 06 | [품질과 가용성을 고려한 모델 선택](docs/decisions/06-model-selection-quality-and-availability.ko.md) | 2026-09-26 ~ 2026-10-16 |
| 07 | [지식·인덱스 일관성과 복구 가능한 배포](docs/decisions/07-knowledge-index-consistency-and-recoverable-deployment.ko.md) | 2026-10-22 ~ 2026-10-26 |
| 08 | [원본 문서를 보존하는 청커 개선](docs/decisions/08-fix-the-chunker-not-the-documents.ko.md) | 2026-09-29 ~ 2026-10-02 |
| 09 | [답변 언어 준수만으로는 부족했던 이유](docs/decisions/09-when-language-compliance-wasnt-enough.ko.md) | 2026-11-02 |

## Copyright

Copyright © 2026 Riu Salze. All rights reserved.

코드는 열람할 수 있습니다. 별도의 코드 사용 라이선스를 부여하지 않으며, 공개된 코드를 열람할 수 있다는 사실이 복제·수정·재배포 등의 허가를 의미하지 않습니다.
