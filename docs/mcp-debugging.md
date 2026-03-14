# MCP 디버깅 가이드

MCP 서버와 Claude Code 간 통신 문제를 진단하는 방법을 정리합니다.

## Claude Code verbose 모드

MCP stdio 통신 내용을 실시간으로 확인할 수 있습니다.

```bash
claude --dangerously-skip-permissions --verbose
```

> `--dangerously-skip-permissions`: 권한 확인 없이 실행 (테스트 용도)
> `--verbose`: MCP 요청/응답, stderr 로그 등 상세 출력

## 네트워크 상태 확인

MCP 서버가 실행 중일 때, 별도 터미널에서 확인합니다.

### TCP 연결 요약

```bash
ss -s
```

- `estab`: 현재 활성 연결 수
- `timewait`: 종료 대기 중인 연결 (비정상적으로 많으면 문제)

### MCP 서버 프로세스의 네트워크 연결

```bash
# MCP 서버 PID 확인
ps aux | grep "job-search"

# 해당 PID의 TCP 연결 상태
ss -tnp | grep <PID>
```

연결이 0개이면 서버가 요청을 보내지 않고 있는 상태입니다.

## 프로세스 상태 확인

### 프로세스 트리

```bash
pstree -p <PID>
```

MCP 서버의 자식 프로세스/쓰레드 구조를 확인합니다.

### 시스템 콜 추적 (strace)

```bash
# 네트워크 관련 시스템 콜만 추적
sudo strace -p <PID> -e trace=network -f -t 2>&1 | head -50

# 읽기/쓰기 시스템 콜 추적 (stdio 통신 포함)
sudo strace -p <PID> -e trace=read,write -f -t 2>&1 | head -30
```

- 이벤트가 없으면: 프로세스가 데드락 또는 대기 상태
- network 이벤트만 없으면: 네트워크 요청을 보내지 않는 상태

## CPU / 메모리 확인

```bash
top -d 1
```

- MCP 서버(node)의 CPU가 높으면: HTML 파싱 병목
- CPU가 낮고 idle이 높으면: I/O 대기 또는 데드락

## HTTP 응답 테스트

MCP 서버를 거치지 않고 직접 검색 URL을 테스트합니다.

```bash
# 잡코리아 검색 페이지
time curl -s -o /dev/null -w "HTTP %{http_code} / %{time_total}s\n" \
  -H "User-Agent: Mozilla/5.0" \
  "https://www.jobkorea.co.kr/Search/?stext=삼성전자&tabType=recruit"

# 사람인 검색 페이지
time curl -s -o /dev/null -w "HTTP %{http_code} / %{time_total}s\n" \
  -H "User-Agent: Mozilla/5.0" \
  "https://www.saramin.co.kr/zf_user/search?searchType=search&searchword=삼성전자&search_done=y"
```

- HTTP 200: 정상
- HTTP 400/403: 플랫폼에서 차단 (IP, User-Agent 등)
- HTTP 307: 리다이렉트 (사람인 기본 응답, 정상)

## Node.js fetch 동시성 테스트

```bash
# 단일 요청
time node -e "fetch('https://www.jobkorea.co.kr').then(r => console.log(r.status))"

# 동시 10개 요청
time node -e "
Promise.all(Array(10).fill().map(() =>
  fetch('https://www.jobkorea.co.kr').then(r => r.status)
)).then(r => console.log(r))
"
```

단일은 빠르지만 동시 요청이 극단적으로 느리면, 런타임 수준의 TCP 동시 연결 병목입니다.

## DNS 확인

```bash
time nslookup www.jobkorea.co.kr
time nslookup www.saramin.co.kr
```

0.5초 이상이면 DNS 병목 가능성이 있습니다.

## Claude Code 로그

```bash
# 로그 디렉토리 확인
ls -lt ~/.claude/logs/ | head -10

# MCP 관련 로그 검색
grep -r "job-search" ~/.claude/logs/ 2>/dev/null | tail -20
```

## MCP 서버 직접 테스트

Claude Code 없이 MCP 서버를 직접 호출하여 서버 자체 문제인지 확인합니다.

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx -y job-search-mcp
```

## 트러블슈팅 체크리스트

| 증상 | 확인 | 원인 |
|------|------|------|
| 요청이 무한 대기 | `ss -tnp` 연결 0개 | stdio 통신 데드락 |
| 응답이 극도로 느림 | `top` CPU 100% | HTML 파싱 병목 |
| 응답이 극도로 느림 | `top` CPU idle | 네트워크 타임아웃 |
| 에러 반환 | curl로 직접 테스트 | 플랫폼 차단 (400/403) |
| 토큰 한도 초과 | 로그에서 글자 수 확인 | 결과가 너무 큼 |
