# 새 플랫폼 추가 가이드

## 1. 플랫폼 파일 생성

`src/platforms/{platform-name}.ts` 파일을 만들고 `JobPlatform` 인터페이스를 구현합니다:

```ts
import { JobPosting, SearchParams, JobPlatform, JobSearchError } from "../types.js";

async function search(params: SearchParams): Promise<JobPosting[]> {
    // 1. 검색 URL 구성
    // 2. fetch 요청
    // 3. 응답 파싱 (JSON API / HTML cheerio / 기타)
    // 4. JobPosting[] 형태로 변환하여 반환
}

export const myPlatform: JobPlatform = { name: "플랫폼명", search };
```

## 2. 타입 등록

`src/types.ts`의 `PlatformName`에 추가:

```ts
export type PlatformName = "jobkorea" | "saramin" | "myplatform" | "all";
```

## 3. 서버에 등록

`src/index.ts`에서:

```ts
import { myPlatform } from "./platforms/myplatform.js";

const PLATFORMS: Record<string, JobPlatform> = {
    jobkorea,
    saramin,
    myplatform: myPlatform,
};
```

그리고 도구 스키마의 `enum`, `description`, 에러 메시지, `platformLabel` 등에 새 플랫폼을 반영합니다.

## 4. 체크리스트

- [ ] `JobPosting`의 `platform` 필드에 한글 플랫폼명을 설정했는가
- [ ] fetch에 `signal: AbortSignal.timeout(15000)` 타임아웃을 적용했는가
- [ ] fetch 실패 시 `JobSearchError`를 throw하는가
- [ ] 파싱 실패 시 빈 배열을 반환하는가 (다른 플랫폼에 영향 없도록)
- [ ] `pnpm build` 통과하는가
- [ ] 실제 검색어로 테스트하여 결과가 정상 반환되는가

## 5. 파싱 방식 참고

| 방식 | 사용 경우 | 예시 |
|------|-----------|------|
| JSON API | 플랫폼이 공개 API를 제공하는 경우 | `response.json()` |
| cheerio (HTML) | SSR 페이지에서 DOM에 데이터가 있는 경우 | 사람인 |
| RSC JSON 추출 | Next.js RSC 스트리밍 페이지인 경우 | 잡코리아 |

플랫폼을 추가하기 전에 반드시 해당 사이트의 `robots.txt`를 확인하고,
자동화 접근이 차단되어 있는지 검토하세요.
