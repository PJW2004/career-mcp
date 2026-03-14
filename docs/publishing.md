# 배포 가이드

## npm 배포

### 사전 준비

- [npm](https://www.npmjs.com) 계정 필요
- Node.js 20 이상

### 배포 절차

```bash
# 1. npm 로그인 (최초 1회)
npm login

# 2. 빌드
pnpm build

# 3. 배포
npm publish --access public
```

> `prepublishOnly` 스크립트가 설정되어 있어 `npm publish`만 실행해도 자동으로 빌드됩니다.

### 버전 업데이트 시

`package.json`과 `src/index.ts`의 버전을 동일하게 맞춘 후 배포합니다:

```jsonc
// package.json
{ "version": "0.0.6" }
```

```ts
// src/index.ts
const server = new Server(
    { name: "job-search-mcp", version: "0.0.6" },
    ...
);
```

---

## MCP Registry 배포

공식 MCP Registry에 등록하면 LobeHub 등 마켓플레이스에 자동으로 반영됩니다.

### 사전 준비

- npm 배포 완료
- [GitHub](https://github.com) 계정

### 1. `package.json`에 `mcpName` 추가

```jsonc
{
    "name": "job-search-mcp",
    "mcpName": "io.github.pjw2004/job-search",
    ...
}
```

`io.github.{GitHub 사용자명}/` 형식이어야 합니다.

### 2. `mcp-publisher` CLI 설치

```powershell
# Windows (PowerShell)
$arch = if ([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture -eq "Arm64") { "arm64" } else { "amd64" }
Invoke-WebRequest -Uri "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_windows_$arch.tar.gz" -OutFile "mcp-publisher.tar.gz"
tar xf mcp-publisher.tar.gz mcp-publisher.exe
rm mcp-publisher.tar.gz
# mcp-publisher.exe를 PATH에 포함된 디렉토리로 이동
```

```bash
# macOS/Linux
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher && sudo mv mcp-publisher /usr/local/bin/
```

```bash
# Homebrew
brew install mcp-publisher
```

### 3. `server.json` 생성

```bash
mcp-publisher init
```

생성된 `server.json`을 확인하고 수정합니다:

```json
{
    "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    "name": "io.github.pjw2004/job-search",
    "description": "Search Korean job postings from JobKorea and Saramin",
    "repository": {
        "url": "https://github.com/PJW2004/career-mcp",
        "source": "github"
    },
    "version": "0.0.6",
    "packages": [
        {
            "registryType": "npm",
            "identifier": "job-search-mcp",
            "version": "0.0.6",
            "transport": {
                "type": "stdio"
            }
        }
    ]
}
```

> `server.json`의 `name`은 `package.json`의 `mcpName`과 일치해야 합니다.

### 4. GitHub 인증

```bash
mcp-publisher login github
```

브라우저에서 GitHub 인증 후 터미널에 표시된 코드를 입력합니다.

### 5. Registry에 퍼블리시

```bash
mcp-publisher publish
```

### 6. 등록 확인

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.pjw2004/job-search"
```

---

## 버전 업데이트 체크리스트

1. `package.json`의 `version` 수정
2. `src/index.ts`의 Server 버전 수정
3. `README.md`의 MCP Registry 배지 버전 수정
4. `pnpm build` 확인
5. `npm publish --access public`
6. `server.json`의 `version`과 `packages[].version` 수정
7. `mcp-publisher publish`
