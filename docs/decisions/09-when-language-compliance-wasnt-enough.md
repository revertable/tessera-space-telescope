# 09 — When Language Compliance Wasn't Enough

[All cases](../../README.md) · [한국어](09-when-language-compliance-wasnt-enough.ko.md) · [Previous: 08](08-fix-the-chunker-not-the-documents.md)

**Development date:** 2026-11-02.

**Record type and evidence level:** This decision record is based on developer requests, decisions and execution reports retained in the development conversation. The original experiment code, fixed-input files, response JSON and request logs were deleted at the developer's request. Counts below are contemporaneously reported observations; original artifacts were not rechecked while writing this record. No code excerpts are included.

**Outcome:** Some candidates improved the output language, but answer content, basis classification and citations did not jointly meet the adoption criteria. The developer discarded every tested change and retained the existing production generation policy.

## Exploring Korean evidence through questions in several languages

Synethos is a RAG-based interactive profile service that retrieves approved records to explain Riu Salze's career, projects and engineering decisions. Its knowledge base is primarily Korean. At the time, the generation prompt described a preference for Korean-language presentation alongside a rule to answer in the question's language by default. Explicit requests for a different language were also allowed.

The developer initially considered Korean answers for Korean questions and English for all others. After reviewing Japanese, Arabic and Tagalog examples, the experiment objective became preserving multilingual answers while making question-language compliance consistent.

The representative failing question was:

> What is Synethos, and why was it created?

The production approach answered this English question in Korean, explaining the service and its creation. An explicit request to answer in English also produced an English response. English writing capability, default language selection and explicit-request compliance were separate properties to examine.

## Holding evidence fixed while comparing generation-language controls

The experiments ran locally. Basic questions used three fixed chunks from the approved Synethos document: product identity, creation rationale and service description. The complex Tagalog question used 16 selected chunks across three approved documents about Synethos, Codex Session Observatory and engineering practices. Evidence content and order were fixed for each question; retrieval and embedding were not rerun.

The classifier was `gemini-3.1-flash-lite` and the generator was `gemini-3.5-flash-lite`. Generation experiments used the saved configuration's model options and response schema. The application required `basis` and `citations` fields in the response JSON.

| Approach | Change and comparison conditions | Contemporaneous execution report |
|---|---|---|
| Select language during classification | Added `responseLanguage` to the 3.1 result, validated its BCP 47 tag and passed it to 3.5. Replaced the generator's existing language-selection instruction and Korean-priority sentence while preserving other policy text. | Two classification/generation calls for the existing English baseline and 12 for six candidate questions: 14 completed calls. All six candidate answers used the expected language. |
| Remove only the Korean-priority sentence | Kept the question-language rule and removed only the 133-character Korean-priority sentence. Reused the saved English baseline, classification and identical evidence. | Six generations for the same English question: four English and two Korean. This execution repeated one English question and is recorded separately from the six-question multilingual comparisons. |
| Reinforce language instructions within the existing policy | Kept the Korean preference and existing language rule. Added instructions separating question language from evidence language, emphasizing English answers to English questions, and checking the language before returning. | Reused saved classifications and evidence for one generation per question across six cases. Five used the expected language; the Arabic question received English. |

The six questions were Korean, English, Korean with an explicit request for English, Japanese, Arabic and a complex Tagalog question. The Tagalog question asked for concrete design decisions, problems and tradeoffs across two projects, the balance of AI use, verification and human responsibility, and a distinction between directly recorded facts and synthesis.

The initial execution of the first experiment had seven classification dispatch failures without a provider HTTP response. The 14 completed calls above belong to a separately authorized rerun. Each completed experiment was reported to use no automatic retries, fallback or embedding calls. The baseline was not called again after the first experiment.

## Correct language did not consistently preserve content and citations

The saved English baseline answered in Korean but covered the definition, limitations of fragmented records, reasons for gathering work records, and the name's origin. It returned `basis: "records"` and `citations: ["S1", "S2", "S3"]`. The contemporaneous review reported that its main facts matched the supplied evidence.

The classification-language candidate answered in English but stopped after a one-sentence definition, omitting the creation rationale. Its English and Arabic responses returned `basis: "system"` and `citations: []`. Other basic questions retained record citations. The Tagalog response cited evidence but only partially separated facts from synthesis.

All six generations with only the Korean-priority sentence removed returned `system` and empty citations. Four omitted the creation rationale or described only a general service purpose; two included part of the background. English output itself remained inconsistent.

Reinforcing the language instructions within the existing policy produced these observations:

| Question | Answer language | Contemporaneous review of content, basis and citations |
|---|---|---|
| English | English | Included the definition, creation rationale and name origin, but returned `system` and empty citations. |
| Korean | Korean | Covered the main content and retained `records` with S1–S3. |
| Korean with an English-answer request | English | Covered the main content and retained `records` with S1–S3. |
| Japanese | Japanese | Covered the main content and retained `records` with S1–S3. |
| Arabic | English | Failed the language rule and omitted the creation rationale and citations. |
| Tagalog | Tagalog | Retained `records` and citations, but tradeoff comparison and fact/synthesis separation were partial. |

The contemporaneous offline checks reported preservation of prompt text outside the declared language edits and equality of fixed inputs. Keeping instruction text and getting the model to follow it were separate verification tasks.

## Separating citation output from actual context use

`basis: "system"` is the model's returned basis classification; `citations: []` shows that no citations were returned. These fields alone cannot establish that the model did not actually use the Korean records. Similarity between an answer and a record also does not measure internal context use.

Synethos's product contract required `records` and supporting citations when supplied records directly supported an answer. The evaluated failure was therefore noncompliance with basis/citation policy. Internal evidence use was not measured. A structural check for invalid citation IDs could not establish citation completeness or claim-level support.

## Using related research to interpret the completed experiments

After the experiments ended, the developer supplied a research-focused investigation. The following papers were checked against their original publications while preparing this interpretation. They are retrospective context, distinct from evidence used before accepting or rejecting the candidates.

| Research | Finding and role in this case |
|---|---|
| [Linguistic Nepotism](https://arxiv.org/html/2509.13930v3), ICML 2026 | Analyzed language preferences in citation selection while controlling relevance, and reported cases where language preference outweighed relevance. Choosing between document languages and omitting citations in Synethos are distinct observations. |
| [On the Consistency of Multilingual Context Utilization](https://aclanthology.org/2025.mrl-main.15/), MRL 2025 | Shows a gap between extracting information from evidence in another language and producing a complete answer in the correct language. |
| [XRAG](https://aclanthology.org/2025.findings-emnlp.849/), Findings of EMNLP 2025 | Distinguishes response-language compliance from difficulty reasoning over evidence across languages. |
| [Investigating Language Preference of Multilingual RAG Systems](https://aclanthology.org/2025.findings-acl.295/), Findings of ACL 2025 | Studies retriever and generator language preferences separately, informing the distinction between retrieved evidence and its use during generation. |
| [Model Internals-based Answer Attribution](https://aclanthology.org/2024.emnlp-main.347/), EMNLP 2024 | Examines how model self-citations can fail to faithfully reflect actual context use, supporting the distinction between returned citations and internal use. |
| [Reasoning-Language Alignment](https://aclanthology.org/2026.oracle-main.29/), ORACLE 2026 | Forced German reasoning aligned with German questions/evidence outperformed forced French reasoning but did not surpass unconstrained native English reasoning. Its reasoning-language intervention differs from this experiment's output-language instructions. |
| [Evaluating and Explaining Prompt Sensitivity](https://arxiv.org/abs/2608.18539), ICML 2026 | Analyzes variation in internal interactions after small prompt changes, providing background for checking the full output behavior after an edit. |

These studies motivate evaluating language alongside evidence selection, context use, citations and reasoning. They do not establish that the Korean-priority sentence stabilized evidence use in Synethos's particular model. Because the local experiments fixed retrieval results, the observations concern generation from the supplied evidence.

## Retaining the existing policy when candidates missed the adoption criteria

The developer required both language compliance and evidence-grounded answer quality. A candidate that produced the desired language in some executions was not accepted for production when necessary explanation, basis classification and citations were not consistently preserved.

Every experimental candidate was discarded and the existing generation policy retained. The existing English-language compliance problem remained a known limitation. The completion report recorded Synethos remaining on `main` at `7505cfc` with a clean working tree. At the developer's request, 65 local experiment files were deleted. Original experiment code and response logs were not restored for this record.

The engineering lesson is to evaluate language within the full answer-quality contract of multilingual RAG. A correct output language alone was insufficient for adoption; explanatory coverage, grounding and citations also had to pass.

## Verification scope and record limitations

The classification-language and reinforced-instruction candidates each ran once per question. Sentence removal ran six times on the same English question, while the saved baseline contained one English-question result. These different samples do not establish a general success rate or prove that language instructions caused every observed quality difference. Native-speaker fluency evaluation was not performed for Japanese, Arabic or Tagalog.

This public record is grounded in contemporaneous execution reports and selected responses retained in the development conversation, the developer's rejection decision, and the external papers above. Original inputs, responses, request ledgers and original artifact hashes are currently unavailable for revalidation. Document-link, bilingual-equivalence and edit-scope checks are distinct from reproducing the historical model experiments.

[Back to all cases](../../README.md)
