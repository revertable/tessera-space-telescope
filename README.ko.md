# Tessera

[English](README.md)

Tessera는 비공개 프로젝트 **Synethos**의 실제 구현 코드와 엔지니어링적 판단 중 일부를 공개하는 저장소입니다. 코드와 함께 그 구현에 영향을 준 문제, 제약, 선택과 검증 결과를 보여줍니다.

Synethos 전체 소스는 비공개로 유지하며, Tessera에는 선택한 코드와 그 엔지니어링적 판단을 이해하는 데 필요한 맥락만 공개합니다.

이 저장소는 코드 열람용입니다. 실행 가능한 애플리케이션이나 독립 모듈이 아니며, 별도 실행 환경, 패키지, 의존성 설정, 빌드·테스트 절차를 제공하지 않습니다. 공개하는 코드는 원래 언어의 파일 확장자와 문법을 유지합니다.

코드는 비공개 원본과의 관계에 따라 구분합니다.

| 분류 | 의미 |
|---|---|
| **Excerpt** | Synethos 원본 구현에서 선택하여 발췌한 코드입니다. |
| **Reconstructed** | Synethos의 엔지니어링적 선택을 설명하기 위해 공개용으로 다시 구성한 코드입니다. |
| **Mixed** | 원본 발췌와 재구성한 코드를 함께 포함합니다. 재구성한 부분은 소스 코드 주석으로 식별합니다. |

## Engineering Decisions

[엔지니어링 개발 기록](docs/engineering-decisions.ko.md)에서 각 선택의 문제·판단·구현·검증과 코드 출처를 읽을 수 있습니다.

| 번호 | 사례 | 개발 날짜 |
|---|---|---|
| 01 | [From Local Qwen/Ollama Inference to the Gemini API](docs/engineering-decisions.ko.md#01--from-local-qwenollama-inference-to-the-gemini-api) | 2026-09-26 |
| 02 | [From GitBook MCP to Local Knowledge](docs/engineering-decisions.ko.md#02--from-gitbook-mcp-to-local-knowledge) | 2026-09-26 ~ 2026-09-28 |
| 03 | [Cohere 도입·평가·제거](docs/engineering-decisions.ko.md#03--cohere-도입평가제거) | 2026-09-28 ~ 2026-10-17 |

## Copyright

Copyright © 2026 Riu Salze. All rights reserved.

코드는 열람할 수 있습니다. 별도의 코드 사용 라이선스를 부여하지 않으며, 공개된 코드를 열람할 수 있다는 사실이 복제·수정·재배포 등의 허가를 의미하지 않습니다.
