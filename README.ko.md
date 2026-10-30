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
| 01 | [From Local Qwen/Ollama Inference to the Gemini API](docs/decisions/01-local-inference-to-gemini.ko.md) | 2026-09-26 |
| 02 | [From GitBook MCP to Local Knowledge](docs/decisions/02-gitbook-to-local-knowledge.ko.md) | 2026-09-26 ~ 2026-09-28 |
| 03 | [Cohere 도입·평가·제거](docs/decisions/03-cohere-evaluation-and-retirement.ko.md) | 2026-09-28 ~ 2026-10-17 |
| 04 | [Provider 교체 설계와 Embedding 안정화](docs/decisions/04-provider-architecture-and-embedding-reliability.ko.md) | 2026-09-26 ~ 2026-10-17 |
| 05 | [Cross-PC Index Portability](docs/decisions/05-cross-pc-index-portability.ko.md) | 2026-09-28 ~ 2026-10-26 |
| 06 | [Model Selection: Quality and Availability](docs/decisions/06-model-selection-quality-and-availability.ko.md) | 2026-09-26 ~ 2026-10-16 |
| 07 | [Knowledge·Index 일관성과 복원 가능한 배포](docs/decisions/07-knowledge-index-consistency-and-recoverable-deployment.ko.md) | 2026-10-22 ~ 2026-10-26 |
| 08 | [Fix the Chunker, Not the Documents](docs/decisions/08-fix-the-chunker-not-the-documents.ko.md) | 2026-09-29 ~ 2026-10-02 |

## Copyright

Copyright © 2026 Riu Salze. All rights reserved.

코드는 열람할 수 있습니다. 별도의 코드 사용 라이선스를 부여하지 않으며, 공개된 코드를 열람할 수 있다는 사실이 복제·수정·재배포 등의 허가를 의미하지 않습니다.
