# 아키텍처

## 프로젝트 구조

```
job-search-mcp/
├── src/
│   ├── index.ts              # MCP 서버 진입점 + 도구 핸들러
│   ├── types.ts              # 공통 타입 정의
│   └── platforms/
│       ├── jobkorea.ts       # 잡코리아 (Next.js RSC JSON 파싱)
│       └── saramin.ts        # 사람인 (SSR HTML + cheerio 파싱)
├── docs/                     # 개발자 문서
├── package.json
└── tsconfig.json
```

## 플랫폼 추상화

모든 플랫폼은 `JobPlatform` 인터페이스를 구현합니다:

```ts
interface JobPlatform {
    name: string;
    search(params: SearchParams): Promise<JobPosting[]>;
}
```

새 플랫폼을 추가하려면:

1. `src/platforms/{name}.ts` 파일 생성
2. `JobPlatform` 인터페이스를 구현하여 export
3. `src/index.ts`의 `PLATFORMS` 객체에 등록
4. `src/types.ts`의 `PlatformName` 유니온 타입에 추가
5. `src/index.ts`의 도구 설명, enum, 라벨 업데이트

## 플랫폼별 파싱 방식

### 잡코리아

잡코리아는 Next.js RSC(React Server Components) 스트리밍 방식으로 렌더링됩니다.
HTML 내부의 `self.__next_f.push()` 스크립트 태그에 JSON 데이터가 포함되어 있어,
정규식으로 해당 블록을 찾고 JSON을 파싱합니다.

```
GET https://www.jobkorea.co.kr/Search/?stext={검색어}&tabType=recruit&Page_No={페이지}
```

- HTML 응답에서 `totalElements`와 `postingCompanyName`을 포함하는 `__next_f.push` 블록을 탐색
- JS 문자열 이스케이프 해제 후 `"content":[...]` 배열을 balanced bracket 매칭으로 추출
- `careerType`, `educationCode` 등 코드 값을 한글 레이블로 매핑

### 사람인

사람인은 전통적인 SSR(Server-Side Rendering) 방식으로, HTML DOM에 채용공고 데이터가 직접 포함되어 있습니다.
cheerio로 CSS 셀렉터 기반 파싱을 합니다.

```
GET https://www.saramin.co.kr/zf_user/search?searchType=search&searchword={검색어}&recruitPage={페이지}&recruitPageCount=40
```

주요 셀렉터:

| 데이터 | 셀렉터 |
|--------|--------|
| 채용공고 컨테이너 | `div.item_recruit` |
| 공고 ID | `div.item_recruit[value]` |
| 공고 제목 | `.job_tit a[title]` |
| 회사명 | `.corp_name a` |
| 지역 | `.job_condition span:nth-child(1)` |
| 경력 | `.job_condition span:nth-child(2)` |
| 학력 | `.job_condition span:nth-child(3)` |
| 마감일 | `.job_date .date` |

## 동시성 제어 및 결과 저장

### `search_jobs_bulk`

- 10개 회사씩 배치로 나누어 `Promise.all`로 병렬 요청 (`CONCURRENCY = 10`)
- 결과는 임시 디렉토리(`{os.tmpdir()}/job-search-mcp/`)에 텍스트 파일로 저장
- LLM에게는 요약(총 건수, 파일 경로)만 반환하여 컨텍스트 윈도우 절약

### 타임아웃

각 플랫폼의 HTTP 요청에 `AbortSignal.timeout(15000)` (15초)이 적용됩니다.
시간 초과 시 해당 요청만 실패 처리되고, 나머지 결과는 정상 반환됩니다.

### 응답 로깅

모든 도구 응답에 `logResult()`가 적용되어, 응답 끝에 글자 수와 소요 시간이 추가됩니다:
```
--- search_jobs | 1,234자 | 2.3s ---
```

## 에러 처리

각 플랫폼은 독립적으로 에러를 처리합니다. `platform=all`로 검색 시 한 플랫폼이 실패해도
나머지 플랫폼 결과는 정상 반환되며, 에러 메시지가 응답 하단에 표시됩니다.

## 알려진 제한사항

- **잡코리아 지역 코드**: 지역이 `I080`, `B030` 같은 내부 코드로 반환됩니다. 코드-지역명 매핑 테이블이 없어 원본 코드를 그대로 출력합니다.
- **잡코리아 파싱 안정성**: Next.js RSC 포맷은 프레임워크 업데이트에 따라 변경될 수 있습니다. 파싱이 실패하면 빈 배열을 반환합니다.
- **사람인 `job_condition` 순서 의존**: 조건 span이 항상 지역 > 경력 > 학력 > 고용형태 순서라고 가정합니다.
