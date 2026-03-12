# job-search-mcp

[![npm version](https://img.shields.io/npm/v/job-search-mcp)](https://www.npmjs.com/package/job-search-mcp)
[![MCP Badge](https://lobehub.com/badge/mcp/pjw2004-job-search-mcp)](https://lobehub.com/mcp/pjw2004-job-search-mcp)

채용 플랫폼(잡코리아, 사람인)에서 회사명으로 채용공고를 검색하는 MCP 서버입니다.

> [!NOTE] 
> 원티드(Wanted)는 왜 없나요?
> 원티드는 CDN 레벨에서 자동화 접근을 차단하고 있으며, robots.txt 자체도 403으로 응답합니다.

## 기능

회사명을 입력하면 각 플랫폼에서 채용공고를 수집하여 다음 정보를 반환합니다:

| 항목 | 잡코리아 | 사람인 |
|------|----------|--------|
| 공고 제목 | ✅ | ✅ |
| 회사명 | ✅ | ✅ |
| 경력 | ✅ | ✅ |
| 학력 | ✅ | ✅ |
| 지역 | △ (코드) | ✅ |
| 마감일 | ✅ | ✅ |
| 공고 URL | ✅ | ✅ |

## MCP 도구

### `search_jobs`

채용 플랫폼에서 회사명으로 채용공고를 검색합니다.

#### 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `company_name` | string | ✅ | - | 검색할 회사명 |
| `platform` | string | - | `"all"` | 검색할 플랫폼 (`jobkorea`, `saramin`, `all`) |
| `page` | number | - | `1` | 페이지 번호 |

## 설치

```bash
# pnpm 없는 경우 "npm install -g pnpm"
pnpm install
pnpm build
```

## 사용법

### npx로 실행 (권장)

#### Claude Code

```bash
claude mcp add job-search -- npx -y job-search-mcp
```

#### Claude Desktop

`claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "job-search": {
      "command": "npx",
      "args": ["-y", "job-search-mcp"]
    }
  }
}
```

### 로컬 빌드로 실행

#### Claude Code

```bash
claude mcp add job-search -- node /path/to/job-search-mcp/dist/index.js
```

#### Claude Desktop

```json
{
  "mcpServers": {
    "job-search": {
      "command": "node",
      "args": ["/path/to/job-search-mcp/dist/index.js"]
    }
  }
}
```

### 질문 예시

```
당근마켓 채용공고 검색해줘
사람인에서 네이버 채용공고 찾아줘
잡코리아에서 삼성SDS 채용공고 2페이지 보여줘
```

## License

MIT License. See [LICENSE](LICENSE) for details.