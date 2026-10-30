# 07 — Knowledge·Index 일관성과 복원 가능한 배포

[전체 사례](../../README.ko.md) · [English](07-knowledge-index-consistency-and-recoverable-deployment.md) · [이전: 06](06-model-selection-quality-and-availability.ko.md) · [다음: 08](08-fix-the-chunker-not-the-documents.ko.md)

**근거 수준:** 코드 확인은 식별한 과거 소스, 당시 보고는 기록된 조건의 관측, 미확인은 해결되지 않은 사실·인과관계를 뜻합니다. 테스트는 당시 소스 근거로 수록합니다. 시각은 KST(UTC+09:00)이며 개발 사건과 근거 검증 날짜를 구분합니다.

**문서 편집:** 2026-10-30, 기준 `2fc5094`. 아래 과거 공개 검증 기록의 날짜와 범위를 유지합니다. 2026-10-31에는 `f7fb082` 기준으로 중복 설명과 검증 한계 표현을 정리했습니다.

**개발 기간:** 2026-10-22 ~ 2026-10-26. 운영 배경·보관 선택·설계 위임에 대한 개발자 설명은 2026-10-29에 직접 보충했다.

**코드 분류:** Excerpt — 전체 원본 1개·부분 발췌 3개; Reconstructed — 근거 기록 3개.

**결과:** 제한된 서버 공간에서 총 3개 릴리스를 유지하고, 실행 코드·Knowledge·Index를 함께 전환·복원하는 구조로 운영했다. 사용자는 환경·재료·제약과 보관 정책을 제공하고 세부 배포 설계·구현을 AI에 위임했다. 10월 26일의 승인된 배포는 새 릴리스를 활성화하고 이전 버전의 복원 준비 상태를 확인했다.

## 운영 환경과 실제 사용할 수 있었던 공간

Synethos는 네이버클라우드 무료 티어 Ubuntu 서버에서 운영됐고 Cloudflare Tunnel을 이미 사용하고 있었다. 10월 22일 Git 문서는 systemd 운영, Linux production 의존성의 별도 준비, 기존 Tunnel의 Ubuntu connector와 공개 서비스 검증을 기록한다. 26일 실제 환경은 Ubuntu 24.04.1·Node v24.22.1이었다.

**개발자가 10월 29일 직접 설명한 당시 경험:** 처음에는 서버의 명목상 10GB를 모두 사용할 수 있다고 생각했다. 운영체제와 누적 보안 패치 등을 처리한 뒤 실제 가용 공간은 약 3~4GB였다. 제공받은 환경의 보안 패치 상태도 최신이 아니었다.

10월 22일 원본 요청에는 10GB 제약이 명시돼 있다. 당시 도구 출력과 보고를 통해 가용 공간이 변한 단계를 연결했다. 시각은 KST이며 G 값은 원래 df 표시를 유지한다.

| 시각·출처 | 당시 관측 |
|---|---|
| 10월 22일 10:34:22.014 · 도구 출력 | 해당 업데이트 전 파일시스템 9.8G, 사용 5.3G, 가용 4.0G |
| 11:12:20.521 · 사용자 보고; 11:12~11:15 도구 조사·AI 진단 | dry-run 뒤 가용 공간 감소. 내려받은 패키지 224개가 806,196,658bytes, 약 769MiB를 차지했고 설치된 버전은 그대로였다. |
| 13:11:30.055 승인 → 13:35:30.875 완료 보고 | 보안 패키지 246개 설치·검증. 보고된 가용 공간 2.90GiB, 관측 최소 2.44GiB, 커널 hold 3개 유지 |
| 14:01:14.138 · 도구 출력 | 가용 3,148,894,208bytes, 약 2.93GiB |
| 14:27:56.360 · 도구 출력 | 캐시 정리와 runtime·앱 구성 후 가용 3,740,782,592bytes, 약 3.48GiB |
| 10월 26일 21:04:59.201 · 원본 도구 출력 | 파일시스템 9.8G, 사용 6.0G, 가용 3.3G, 사용률 65% |
| 같은 날 배포 전 점검 보고 | 가용 3,516,506,112bytes, 약 3.28GiB; 기존 릴리스별 약 38MiB |

초기 일반 업데이트 후보 338개와 실제 승인·설치한 보안 업데이트 246개는 범위를 구분한다. AI는 기존 APT·캐시·설치 버전 기록으로 dry-run의 공간 감소를 조사하고 설치 예산을 계산했다. 사용자가 선언된 보안 업데이트 설치를 승인했으며, 완료 보고에는 설치 건수·관측 최소 공간·유지한 커널 hold가 남아 있다. 후속 runtime·앱 구성에서는 다운로드 캐시 약 850MiB도 정리했다.

[환경·판단 근거](../../cases/knowledge-index-release-consistency/evidence/decisions-and-constraints.json#L1-L289)에 도구 측정·당시 보고·10월 29일 설명을 구분했다. 이 순서는 설치뿐 아니라 일시적인 다운로드와 이후 정리를 함께 보여준다. 보관 정책의 공간 조건은 위의 배포 당시 가용 공간과 릴리스 크기를 기준으로 설명한다.

## 총 3개 보관: 사용자 선택과 AI 설계의 경계

10월 26일 원본 대화에서 보관 정책의 변경 순서를 확인했다.

| 시각 KST | 주체·결정 |
|---|---|
| 14:50:51.474 | 사용자: 디스크 사용량과 보관 방식 비교 요청. |
| 14:51:56.708 | AI: 전체 유지·최신+직전·최신만 비교 후 2개 보관 권고. |
| 14:52:21.066 | 사용자: 최신+직전 채택, 해당 정책을 문서에 반영하도록 요청. |
| 14:53:15.017 | AI: 서버 파일 변경 없이 2개 보관 정책 문서화 보고. |
| 15:11:50.447 | 사용자: “하나 더 여유있게” 최신·직전·직전의 직전, 총 3개 요청. |
| 15:12:43.106 | AI: 당시 서버 파일을 바꾸지 않고 이후 배포에 적용할 3개 정책 문서화 보고. |

AI 비교에는 새 릴리스 약 37.20MiB, 현재 두 릴리스 74.29MiB, 직전 제거 시 회수 가능한 37.09MiB가 기록됐다. 즉시 복구할 수 있는 직전을 유지하도록 권고했다. 이 수치는 사용자가 검토한 비교의 조건이다. 사용자는 이후 한 버전을 더 보관하도록 선택했으며, 총 3개는 운영상 여유를 둔 선택으로 기록한다.

같은 날 저녁 읽은 기존 서버 스크립트에는 이미 3개 정책이 들어 있었다. 21:22:05.529 사용자 요청은 이 정책을 재사용 절차의 유지 조건으로 채택했다.

| 주체·기록 | 확인한 역할 |
|---|---|
| 사용자 결정·직접 설명 | 운영 환경·재료·제약 제공, 2개 채택 후 총 3개 선택, 세부 설계·구현을 AI에 위임 |
| 26일 저녁 사용자 요청 | 기존 릴리스 구조 계승, Knowledge·Index 동시 전환·복원, Linux 의존성 검증, 기존 환경·Tunnel 유지 요구 |
| AI 비교·설계·구현 | 측정한 공간·복구 조건으로 2개 권고; manifest/hash·candidate·서비스 계정 검사, 원자적 전환·실패 복원, 보관 순서·삭제 안전 검사 구체화 |

10월 29일 설명으로만 기록했던 2→3 전환을 당시 메시지로 연결했다. 이후 요청에서 기존 구조를 유지 조건으로 채택한 사실과 보관 개수 선택은 각각의 출처·역할로 기록한다.

## 이전 배포에서 해결한 문제와 새 후보의 요구

**10월 22일 플랫폼 선택:** 14:06:56.302 AI는 Windows node_modules 복사를 제외하고 로컬 빌드·Linux production 의존성 별도 준비를 제안했다. Prepare 스크립트의 svelte-kit sync를 확인하고 production 설치의 ignore-scripts 사용을 설명했다. 14:14:09.781 사용자는 Windows node_modules를 복사하지 않고 Linux 의존성을 별도로 구성하도록 명시했다. 구체화한 서버 구성·loopback 배포 범위는 14:15:58.713 승인됐다. 14:30:30.300 AI는 Linux 의존성 별도 설치·서비스 검증·current인 373-chunk 인덱스 재사용을 보고했다. 보존된 구성 스크립트·manifest·검증 자료는 릴리스 20261022-033e02f-01을 식별한다.

**10월 26일 root 진단:** 사용자는 14:42:49.628 수정된 8fa463e 배포 범위를 승인했다. 활성화 전에 AI는 MOSAIC_PROJECT_ROOT가 10월 22일 릴리스에 고정된 것을 발견했다. 상대 인덱스 디렉터리는 유지하고 project root를 current로 바꾸며, 실패하면 이전 링크와 환경 파일을 복원하도록 준비했다. 이 근거는 설정 진단이며 실제 공개 응답이 옛 Knowledge를 사용했는지는 미확인이다.

**10월 26일 실제 활성화 실패:** 14:47:50.309 도구 출력은 새 릴리스의 loopback health 실패 뒤 rollback=true·이전 릴리스 복원·health 정상 회복을 기록했다. 14:48:18.359 journal에는 dotenv의 ERR_MODULE_NOT_FOUND가 남았다. 14:49:08.659 확인한 node_modules와 dotenv 디렉터리는 root 소유 0700, dotenv/package.json은 root 소유 0600이었다.

AI는 소유권 변경 후 읽기·탐색 권한 정리가 빠진 것으로 진단하고 14:49:16.271 수정을 보고했다. 보존된 수정 스크립트는 실행 비트를 보존하며 디렉터리·읽기 권한을 보정하고 활성화 전에 서비스 계정으로 dotenv/@google/genai를 import한다.

수정 후 재배포는 통과했다. 14:50:27.509 후속 출력은 파일 111개와 서비스 health 정상을 확인했다. 검증 보고·스크립트는 process cwd·current·변경한 환경 root를 검사하며, 패키징한 인덱스는 28 sources·382 chunks다. 보고서의 rollback=false는 이 성공한 시도를 가리킨다.

앞선 실패 시도의 실제 복구는 [배포 관측 근거](../../cases/knowledge-index-release-consistency/evidence/deployment-observed-results.json#L1-L138)에서 별도 사건으로 보존한다.

기존 스크립트는 특정 릴리스·커밋·인덱스·382 chunks에 고정돼 있었다. 이후 후보는 승인 문서와 인덱스가 바뀌어 28 sources·381 chunks였다. 사용자는 root·Linux 권한/import 수정은 계승하면서 특정 후보에 고정되지 않는 재사용 절차를 요청했다.

## 코드·Knowledge·Index를 하나의 릴리스로 묶기

[Bundle 구성 코드](../../cases/knowledge-index-release-consistency/release/bundle.py#L1-L82)는 승인 manifest의 Knowledge, Index, config, 실행 build, package와 lockfile을 같은 후보에 넣고 sourceCommit·릴리스·파일 크기·SHA-256·index identity를 manifest로 연결한다. 자격증명과 Windows node_modules는 묶지 않는다. 후보 검증과 활성화는 이 단위를 기준으로 한다.

| 단계 | AI가 구현한 동작 |
|---|---|
| 준비 | 예상한 기존 릴리스, archive·manifest·payload·source commit·Node 호환성·가용 공간·보호 설정 확인 |
| Linux 사전 검증 | Production 의존성 설치 후 권한 보정; 서비스 계정·실제 환경으로 import와 compiled index loader 검사 |
| 활성화 | current 링크 원자적 교체, 서비스 재시작, 실제 root·cwd·로드 인덱스·내부/외부 health·홈페이지 검증 |
| 활성화·검증 실패 | 이전 링크로 복원하고 재시작한 뒤 이전 릴리스와 그 Knowledge·Index 재검증 |
| 성공 후 보관 | 활성·직전·나머지 중 최신 하나 유지; 삭제 경로와 프로세스 사용 여부 확인 후 나머지 정리 |

[권한·전환·복원 발췌](../../cases/knowledge-index-release-consistency/release/activation.excerpt.py#L1-L40)의 normalize_permissions는 설치 중 restrictive umask를 고려해 접근 권한을 보정한다. switch는 임시 링크와 os.replace로 current를 바꾼다. activate는 전환 후 restart·verify가 실패하면 이전 링크로 돌아가 restart·rollback_verify를 수행한다. 준비 단계가 실패하면 활성 릴리스는 유지한다.

[보관·삭제 안전 발췌](../../cases/knowledge-index-release-consistency/release/retention.excerpt.py#L1-L30)는 총 3개 선택을 active·previous·newest other로 구현한다. 성공 검증 뒤에만 삭제하며 릴리스 root 밖의 경로·symlink·사용 중인 process cwd/executable을 검사한다. 정리 실패는 검증된 활성 릴리스를 유지하면서 후속 처리가 필요한 상태로 다룬다.

인덱스 identity와 loader 계약은 사례 05의 [manifest 검증](../../cases/cross-pc-index-portability/production/verify-manifest.excerpt.py#L23-L56)·[runtime probe](../../cases/cross-pc-index-portability/production/probe.mjs#L1-L43)와 연결된다. 이 사례의 중심은 그 자료를 같은 운영 릴리스에 묶고 선택한 공간·보관 조건 안에서 전환·복원한 과정이다.

## 원본 요구·선언·승인과 실행 순서

| 시각 KST | 사건·주체 |
|---|---|
| 10월 22일 13:11:30.055 → 13:35:30.875 | 사용자 보안 업데이트 승인 → AI 설치·검증 보고 |
| 14:06:56.302 → 14:14:09.781 → 14:15:58.713 | AI Linux 별도 준비 제안 → 사용자 플랫폼 요구 → 서버 구성·배포 승인 |
| 14:30:30.300 | AI loopback 배포 완료 보고, 373-chunk 인덱스 재사용 |
| 10월 26일 14:42:49.628 → 14:44:51.004 | 사용자 배포 승인 → AI 이전 root 고정 진단 |
| 14:47:50.309 | 도구 출력: 활성화 실패 후 이전 릴리스·환경 복구와 health 정상 |
| 14:48:18.359 → 14:49:08.659 → 14:49:16.271 | journal 오류 → 접근 권한 검사 → AI 권한/import 수정 보고. 별도 승인 메시지는 없으며 앞선 배포 범위 승인이 기록돼 있다. |
| 14:50:27.509 | 도구 출력: 수정한 배포와 payload 111개 검증 |
| 14:51:56.708 → 14:52:21.066 → 15:11:50.447 | AI 2개 권고 → 사용자 2개 채택 → 사용자 3개 선택 |
| 21:10경 | 도구 출력: 기존 서버 스크립트의 권한·root·3개 정책 읽기 |
| 21:22:05.529 | 사용자: 재사용 배포·기존 수정 계승·Knowledge/Index 일관성·Linux 사전 검증·3개 요구 |
| 21:28:01.646 → 21:28:25.746 | AI 구현·검증·후보 준비 선언 → 사용자 승인 |
| 21:39:59.309 / 21:42:03.125 | Linux 배포 안전 테스트 각각 8개 통과 원본 출력 |
| 21:44:39.175 → 21:48:38.896 | AI 후보 결과·Git 범위 선언 → 사용자 커밋·푸시 승인 |
| 21:49:10 | 4fddd61: 재사용 배포 구현·운영 기록 커밋 |
| 21:51:33~21:51:48 → 21:52:55.532 | AI 정확한 전환·검증·복원·보관 범위 선언 → 사용자 운영 배포 승인 |
| 21:59:22.934 | AI 완료 보고: 새 릴리스·실제 index·health·3개 보관·복원 준비 상태 |

[출처 등록부](../../cases/knowledge-index-release-consistency/evidence/source-register.json#L1-L838)는 저녁 배포의 원본 session 01a177b0-1d84-7cc0-aedb-4a06f6d9c661을 유지한다. 10월 30일 보강에서는 원본 session 01a1613d-e5c6-76f2-9e3d-42c9eeca696b·01a176a3-862a-7e82-adc0-b4aeda57dd12와 선택한 메시지/도구 출력 해시 34개를 추가했다.

JSONL 해시는 기존 비공개 연구 등록값과 같으며 이번 근거는 그 원본의 앞선 사건 구간을 선택한다. 압축된 22일 파일과 압축 해제 JSONL에는 각각의 해시를 기록한다. 4fddd61의 다른 테스트 변경은 별도 작업 범위로 유지한다.

## 실제 운영 결과와 테스트에서 확인한 복원

[관측 결과](../../cases/knowledge-index-release-consistency/evidence/deployment-observed-results.json#L1-L138)는 기존 4fddd61 JSON·로그·보고·번들 대조를 유지하고 앞선 배포를 별도 실행으로 추가한다. 최초 공개 검증에서 승인된 배포 스크립트 사본과 Git 원본의 bytes·SHA-256이 일치했다.

| 실제 26일 4fddd61 배포 관측 | 결과 |
|---|---|
| 활성 릴리스 / source commit | 20261026-4fddd61-01 / 4fddd619640fbbf77fbc58f2a80e8aaa2065f231 |
| 실제 로드 자료 | 28 sources / 381 chunks; candidate index·corpus identity 일치 |
| Linux 의존성 import·활성 root·process cwd | 검증 통과 |
| 내부·외부 health / 홈페이지 | HTTP 200 / 200 / 200; 앱·기존 Tunnel 정상 보고 |
| 실제 보관 | 신규·189cf00·876ea52의 총 3개; 성공 검증 뒤 8fa463e 제거 |
| 복원 준비 | 직전 189cf00의 loader·import 검사, rollbackReady 확인 |
| 이번 운영 rollback / provider 호출 | rollback 불필요 / 0회 |

최초 10월 29일 공개 준비에서는 보관 번들을 메모리에서 읽어 archive·manifest hash와 payload 112개 전체의 크기·SHA-256을 대조했다. 모두 일치했고 node_modules·평가 fixture 항목은 0개였다. 일반 테스트 1033 pass·4 skip, static check와 build 통과는 당시 후보 코드 검증으로 기록한다.

[복원·보관 테스트 발췌](../../cases/knowledge-index-release-consistency/verification/rollback-retention.excerpt.test.py#L1-L65)는 합성 Knowledge·Index 파일을 가진 실제 POSIX 심볼릭 링크에서 실패를 주입하고 이전 내용이 함께 복원되는지 검사한다. 보관 순서도 별도 assertion으로 확인한다.

Linux 안전 테스트 8개 통과에는 이 검사가 포함돼 있다. 4fddd61 운영 실행은 성공해 해당 실행에서 자동 rollback이 필요하지 않았다. 이 운영 근거는 새 릴리스의 일관성과 이전 릴리스의 복원 준비 상태다. 앞선 8fa463e 활성화 실패·실제 복구는 위의 별도 기록으로 보존한다.

26일 배포에서는 Cloudflare가 Python urllib 기본 User-Agent 요청을 HTTP 403으로 거부했다. 실행용 client identity를 명시한 같은 health 검사는 200을 반환했다. 기존 보안 설정·health 검사와 승인한 archive·manifest·배포 스크립트 hash는 유지됐다.

## 출처 범위와 남은 확인 사항

10월 29일 사용자 직접 설명은 당시 운영 경험과 설계 위임을 제공한다. 10월 22일 원본 메시지로 AI의 플랫폼 제안·사용자 요구·범위 승인을 연결했다. 10월 26일 원본 메시지는 AI의 2개 권고·사용자의 채택·3개 변경과 이후 재사용 배포 승인을 확인한다. 최초 module/root 진단·활성화 실패의 실제 복구·수정 실행은 당시 도구 출력·AI 보고·보존 스크립트·검증 JSON으로 식별한다.

근거는 도구 측정·journal/접근 권한 출력, 사용자 지시·승인, AI 제안·진단·완료 보고, 보존된 운영 보고, 후속 사용자 설명으로 나눈다. 4fddd61 번들·세션의 10월 29일 검증은 등록부에 유지한다. 해당 비공개 산출물 8개 경로는 현재 checkout에서 확보되지 않았으며 10월 30일 보강은 앞선 세션과 산출물 6개를 대조한다.

Root 수정 전 공개 답변이 실제 옛 Knowledge를 사용했는지는 미확인이다. 보관 정책 선택 대화·초기 Windows 복사 제외 요구·최초 Linux 실패와 복구 순서는 원본으로 연결했다.

코드 발췌는 제약과 결과를 설명하는 메커니즘을 선택한다. 부분 발췌는 선언한 범위 사이 한 빈 줄을 두고 원래 문장·식별자·참조를 보존한다. retention의 ROOT와 테스트의 deploy.py import 등 원래 애플리케이션 참조가 남는다. 비공개 Knowledge·QB 원문·자격증명·접속 정보·보호 설정 내용·전체 운영 명령·대화 전문은 비공개로 유지한다. 새 요약에는 건수·mode·결과와 원본 식별자·해시를 공개하고 실제 운영 경로와 접근 자료는 생략한다.

<details>
<summary>발췌 원본·범위·SHA-256</summary>

| 공개 Excerpt | 원본 commit / 경로 / 원본 행 → 공개 행 | 원본 SHA-256 → 공개 SHA-256 |
|---|---|---|
| [release/bundle.py](../../cases/knowledge-index-release-consistency/release/bundle.py#L1-L82) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/bundle.py`<br>1–82 → 1–82 | `d0e38d5162f8309eecd6f44673aed6f0d8e9425e0292d342f42f62f1c37af33e` → `d0e38d5162f8309eecd6f44673aed6f0d8e9425e0292d342f42f62f1c37af33e` |
| [release/activation.excerpt.py](../../cases/knowledge-index-release-consistency/release/activation.excerpt.py#L1-L40) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/deploy.py`<br>6–6 → 1–1; 22–24 → 3–5; 98–131 → 7–40 | `8ec2db16cac2a5c77b46662ade526e779eca51c9c47fee517c4e1cb595a230ad` → `11fdfdc060ffe222fbbf2e821d7a6d1e308471840805f9129bbd22ef445aea8e` |
| [release/retention.excerpt.py](../../cases/knowledge-index-release-consistency/release/retention.excerpt.py#L1-L30) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/deploy.py`<br>7–7 → 1–1; 22–24 → 3–5; 173–196 → 7–30 | `8ec2db16cac2a5c77b46662ade526e779eca51c9c47fee517c4e1cb595a230ad` → `77723432da30fa2382dae6a97ce48d972e388c6f2078683e66041db613138f82` |
| [verification/rollback-retention.excerpt.test.py](../../cases/knowledge-index-release-consistency/verification/rollback-retention.excerpt.test.py#L1-L65) | `4fddd619640fbbf77fbc58f2a80e8aaa2065f231`<br>`scripts/deployment/test_deploy.py`<br>1–28 → 1–28; 122–157 → 30–65 | `07ceb585168a3e8a717fd6b520850a56bd7a748617323139f578481596548914` → `525e2fe3a8d94b32c1fabe0f65032427f4268a3df17c76194984572c6a6c96a1` |

| 공개 근거 | 분류 | SHA-256 |
|---|---|---|
| [evidence/decisions-and-constraints.json](../../cases/knowledge-index-release-consistency/evidence/decisions-and-constraints.json#L1-L289) | Reconstructed | `17573b0648b9ce9bb2b076a805da15a3b25d10d745ee3d646911511ffbf6d1f6` |
| [evidence/deployment-observed-results.json](../../cases/knowledge-index-release-consistency/evidence/deployment-observed-results.json#L1-L138) | Reconstructed | `3a3daee81835efacc6b600c4c79218289fe8dfb59ad2f7ecb6a25b976a11ddc6` |
| [evidence/source-register.json](../../cases/knowledge-index-release-consistency/evidence/source-register.json#L1-L838) | Reconstructed | `bc72617c6de1369c0d9e99e15f62ac324fda3abd81e4d9c5170e5c12593317a3` |

원본 경로는 비공개 Synethos 저장소 상대경로다. 출처 등록부는 4fddd61의 문서·배포 코드와 보존된 배포 전 점검·승인·실행·완료 파일의 hash, 전체 세션 원본 식별과 선택한 메시지 hash를 연결한다. 서버 접속·운영 민감정보를 포함한 원본 자료는 비공개로 보존한다.

</details>

## 공개 준비 검증

**10월 29일 최초 공개 검증:**

원본 전체·선택 범위 코드 4개와 공개 발췌를 대조했고 Python 구문 파싱 4개·공개 JSON 파싱 3개를 통과했다. Git 문서·코드·연구 기록 hash 7개, 보관 원본 hash 8개, 전체 세션 hash와 선택 메시지 text hash 10개를 확인했다. 보관 번들의 payload 112개는 크기·SHA-256이 모두 일치했고 실제 index와 manifest의 identity·건수도 일치했다.

README 2개·개발 기록 2개의 로컬 링크 692개는 파일·헤딩·행 범위 검증을 통과했다. 영문·한글의 파일/외부 링크 대상과 SHA-256 집합이 일치한다. 사례 01~06 본문과 공개 파일 132개는 기준 커밋의 내용을 보존했다. 파일 비교는 Windows 체크아웃 개행을 정규화했다.

공개 대상 코드·근거 projection·사례 07 본문에서 credential 값·비공개 Knowledge/QB payload·비공개 저장소 URL·로컬 사용자 경로·서버 접근 정보를 점검했다. 검증은 원본 열람과 로컬 파싱·hash 계산으로 수행했다. 새 애플리케이션 테스트·모델 호출·index build·서버 접근·배포는 수행하지 않았다. Synethos working tree는 clean이며 원본을 보존했다.

**10월 30일 근거 보강 검증:** 원본 세션 파일 2개, 선택한 메시지/도구 출력 해시 34개, 보존된 배포 산출물 6개의 등록 해시가 일치했다. 근거 JSON 3개가 파싱됐고 README 2개·개발 기록 2개의 로컬 링크 694개가 파일·헤딩·행 범위 검증을 통과했다. 영문·한글의 파일/외부 링크와 SHA-256 집합이 일치했다. 코드·테스트·변경 대상 밖 근거·README·로컬 AGENTS.md를 포함한 파일 139개와 사례 01~06 본문은 byte hash로 보존을 확인했다. 기존 10월 29일 공개 검증 결과는 별도 기록으로 유지한다. 새 projection과 사례 07 본문에서 비공개 payload·자격증명·운영 접근 정보를 점검했다. 검증은 로컬 열람·파싱·해시 계산으로 수행했으며 Synethos 원본을 보존했다.

[전체 사례로 돌아가기](../../README.ko.md)
