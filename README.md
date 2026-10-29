# Tessera

[한국어](README.ko.md)

Tessera presents selected implementation code and engineering decisions from **Synethos**, a private project. It pairs code with the problems, constraints, choices, and verification results that shaped it.

The full Synethos source remains private, while Tessera publishes only selected code and the context needed to understand its engineering decisions.

This repository is intended for reading code. It is not a runnable application or a standalone module, and it provides no execution environment, package, dependency setup, or build and test workflow. Published code retains its original language's file extensions and syntax.

Code is classified by its relationship to the private implementation:

| Classification | Meaning |
|---|---|
| **Excerpt** | Selected code from the original Synethos implementation. |
| **Reconstructed** | Code rewritten for public presentation to explain an engineering choice in Synethos. |
| **Mixed** | Original excerpts combined with reconstructed code. Reconstructed sections are identified in source-code comments. |

## Engineering Decisions

Read the [engineering development records](docs/engineering-decisions.md) for each decision's problem, judgment, implementation, verification, and code provenance.

| No. | Case | Development date |
|---|---|---|
| 01 | [From Local Qwen/Ollama Inference to the Gemini API](docs/engineering-decisions.md#01--from-local-qwenollama-inference-to-the-gemini-api) | 2026-09-26 |
| 02 | [From GitBook MCP to Local Knowledge](docs/engineering-decisions.md#02--from-gitbook-mcp-to-local-knowledge) | 2026-09-26 ~ 2026-09-28 |
| 03 | [Introducing, Evaluating, and Retiring Cohere](docs/engineering-decisions.md#03--introducing-evaluating-and-retiring-cohere) | 2026-09-28 ~ 2026-10-17 |
| 04 | [Provider Architecture and Embedding Reliability](docs/engineering-decisions.md#04--provider-architecture-and-embedding-reliability) | 2026-09-26 ~ 2026-10-17 |
| 05 | [Cross-PC Index Portability](docs/engineering-decisions.md#05--cross-pc-index-portability) | 2026-09-28 ~ 2026-10-26 |
| 06 | [Model Selection: Quality and Availability](docs/engineering-decisions.md#06--model-selection-quality-and-availability) | 2026-09-26 ~ 2026-10-16 |

## Copyright

Copyright © 2026 Riu Salze. All rights reserved.

The code is available for viewing. No separate code-use license is granted; public access does not grant permission to copy, modify, or redistribute it.
