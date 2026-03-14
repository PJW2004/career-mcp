#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import {
    JobPosting,
    SearchParams,
    PlatformName,
    JobPlatform,
    JobSearchError,
} from "./types.js";
import { jobkorea } from "./platforms/jobkorea.js";
import { saramin } from "./platforms/saramin.js";
import { writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const PLATFORMS: Record<string, JobPlatform> = {
    jobkorea,
    saramin,
};

const CONCURRENCY = 10;

async function runWithConcurrency<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += CONCURRENCY) {
        const batch = items.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);
    }
    return results;
}

const TOOLS: Tool[] = [
    {
        name: "search_jobs",
        description:
            "Search Korean job postings (채용공고 검색). " +
            "Searches JobKorea and Saramin for job listings by company name. " +
            "한국 채용공고 검색 도구입니다. 회사명을 입력하면 잡코리아와 사람인에서 해당 회사의 채용공고를 검색합니다. " +
            "어떤 회사명이든 검색 가능합니다. 채용, 구인, 구직, 취업, job search, hiring, career, recruitment 관련 질문에 이 도구를 사용하세요. " +
            "공고 제목, 경력, 학력, 지역, 마감일, URL을 반환합니다.",
        inputSchema: {
            type: "object",
            properties: {
                company_name: {
                    type: "string",
                    description:
                        "검색할 회사명. 사용자가 입력한 회사명을 그대로 전달하세요. 임의로 줄이거나 변형하지 마세요.",
                },
                platform: {
                    type: "string",
                    enum: ["jobkorea", "saramin", "all"],
                    description:
                        "검색할 플랫폼 (jobkorea, saramin, all). 기본값: all",
                    default: "all",
                },
                page: {
                    type: "number",
                    description: "페이지 번호 (기본값: 1)",
                    default: 1,
                },
            },
            required: ["company_name"],
        },
    },
    {
        name: "search_jobs_bulk",
        description:
            "Search job postings for multiple companies at once (여러 회사 채용공고 일괄 검색). " +
            "여러 회사명을 한 번에 입력하면 내부에서 병렬로 검색하여 결과를 반환합니다. " +
            "결과는 파일로 저장되며, 요약과 파일 경로를 반환합니다. 파일을 읽어서 상세 내용을 확인하세요. " +
            "병역특례 지정업체 목록 등 다수의 회사를 한 번에 조회할 때 사용하세요. " +
            "search_jobs를 여러 번 호출하는 것보다 훨씬 빠릅니다.",
        inputSchema: {
            type: "object",
            properties: {
                company_names: {
                    type: "array",
                    items: { type: "string" },
                    description:
                        "검색할 회사명 목록. 사용자가 입력한 회사명을 그대로 전달하세요. 임의로 줄이거나 변형하지 마세요.",
                },
                platform: {
                    type: "string",
                    enum: ["jobkorea", "saramin", "all"],
                    description:
                        "검색할 플랫폼 (jobkorea, saramin, all). 기본값: all",
                    default: "all",
                },
            },
            required: ["company_names"],
        },
    },
];

async function searchPlatform(
    platform: JobPlatform,
    params: SearchParams
): Promise<{ results: JobPosting[]; error?: string }> {
    try {
        const results = await platform.search(params);
        return { results };
    } catch (error) {
        const message =
            error instanceof JobSearchError
                ? error.message
                : `${platform.name} 오류: ${error instanceof Error ? error.message : String(error)}`;
        return { results: [], error: message };
    }
}

function formatJobPostings(
    postings: JobPosting[],
    companyName: string,
    platformLabel: string,
    errors: string[]
): string {
    const parts: string[] = [];

    if (postings.length === 0 && errors.length === 0) {
        return `"${companyName}" 검색 결과가 없습니다. (${platformLabel})`;
    }

    if (postings.length > 0) {
        parts.push(
            `"${companyName}" 채용공고 검색 결과 (${platformLabel}, ${postings.length}건)`,
            "=".repeat(60)
        );

        postings.forEach((job, i) => {
            parts.push(
                [
                    `[${i + 1}] ${job.title}`,
                    `    플랫폼: ${job.platform}`,
                    `    회사: ${job.companyName}`,
                    `    경력: ${job.experience || "-"}`,
                    `    학력: ${job.education || "-"}`,
                    `    지역: ${job.location || "-"}`,
                    `    마감: ${job.deadline || "-"}`,
                    `    URL: ${job.url}`,
                ].join("\n")
            );
        });
    }

    if (errors.length > 0) {
        parts.push("", "⚠ 일부 플랫폼 오류:", ...errors.map((e) => `  - ${e}`));
    }

    return parts.join("\n\n");
}

const server = new Server(
    { name: "job-search-mcp", version: "0.0.6" },
    { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
}));

async function searchCompany(
    companyName: string,
    platformName: PlatformName,
    page: number
): Promise<{ postings: JobPosting[]; errors: string[] }> {
    const params: SearchParams = { companyName, page };
    const postings: JobPosting[] = [];
    const errors: string[] = [];

    if (platformName === "all") {
        const results = await Promise.all(
            Object.values(PLATFORMS).map((p) => searchPlatform(p, params))
        );
        for (const r of results) {
            postings.push(...r.results);
            if (r.error) errors.push(r.error);
        }
    } else {
        const platform = PLATFORMS[platformName];
        if (platform) {
            const r = await searchPlatform(platform, params);
            postings.push(...r.results);
            if (r.error) errors.push(r.error);
        }
    }

    return { postings, errors };
}

function logResult(toolName: string, result: { content: { type: string; text: string }[] }, startTime: number) {
    const chars = result.content.reduce((sum, c) => sum + c.text.length, 0);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const log = `\n\n--- ${toolName} | ${chars.toLocaleString()}자 | ${elapsed}s ---`;
    result.content[result.content.length - 1].text += log;
    console.error(`[MCP] ${toolName} → ${chars.toLocaleString()}자 / ${elapsed}s`);
    return result;
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const startTime = Date.now();

    if (name === "search_jobs") {
        const companyName = args?.company_name as string;
        const platformName = ((args?.platform as string) || "all") as PlatformName;
        const page = (args?.page as number) || 1;

        if (!companyName) {
            return {
                content: [{ type: "text", text: "회사명을 입력해주세요." }],
                isError: true,
            };
        }

        if (!PLATFORMS[platformName] && platformName !== "all") {
            return {
                content: [
                    {
                        type: "text",
                        text: `알 수 없는 플랫폼: ${platformName}. 사용 가능: jobkorea, saramin, all`,
                    },
                ],
                isError: true,
            };
        }

        const { postings, errors } = await searchCompany(
            companyName,
            platformName,
            page
        );

        const platformLabel =
            platformName === "all"
                ? "잡코리아+사람인"
                : PLATFORMS[platformName].name;

        const formatted = formatJobPostings(
            postings,
            companyName,
            platformLabel,
            errors
        );

        const result = {
            content: [{ type: "text" as const, text: formatted }],
            isError: errors.length > 0 && postings.length === 0,
        };
        return logResult(name, result, startTime);
    }

    if (name === "search_jobs_bulk") {
        const companyNames = args?.company_names as string[];
        const platformName = ((args?.platform as string) || "all") as PlatformName;

        if (!companyNames || companyNames.length === 0) {
            return {
                content: [
                    { type: "text", text: "회사명 목록을 입력해주세요." },
                ],
                isError: true,
            };
        }

        const platformLabel =
            platformName === "all"
                ? "잡코리아+사람인"
                : PLATFORMS[platformName]?.name ?? platformName;

        const results = await runWithConcurrency(
            companyNames,
            async (company) => {
                const { postings, errors } = await searchCompany(
                    company,
                    platformName,
                    1
                );
                return { company, postings, errors };
            }
        );

        // 전체 결과를 파일로 저장
        const fileLines: string[] = [
            `일괄 검색 결과 (${platformLabel}, ${companyNames.length}개 회사)`,
            "=".repeat(60),
        ];

        let totalPostings = 0;
        const allErrors: string[] = [];

        for (const { company, postings, errors } of results) {
            totalPostings += postings.length;
            if (postings.length > 0) {
                fileLines.push(`\n■ ${company} (${postings.length}건)`);
                for (const job of postings) {
                    fileLines.push(`  - ${job.companyName} | ${job.title} | ${job.experience || "-"} | ${job.location || "-"} | ${job.url} | ${job.deadline}`);
                }
            } else {
                fileLines.push(`\n■ ${company} (0건)`);
            }
            allErrors.push(...errors);
        }

        const companiesWithPostings = results.filter(
            (r) => r.postings.length > 0
        ).length;

        fileLines.push(
            "",
            `총 ${companiesWithPostings}/${companyNames.length}개 회사에서 ${totalPostings}건의 공고 발견`
        );

        if (allErrors.length > 0) {
            fileLines.push(
                "",
                "⚠ 일부 오류:",
                ...allErrors.map((e) => `  - ${e}`)
            );
        }

        // 파일 저장
        const resultDir = join(tmpdir(), "job-search-mcp");
        mkdirSync(resultDir, { recursive: true });
        const filePath = join(resultDir, `bulk_${Date.now()}.txt`);
        writeFileSync(filePath, fileLines.join("\n"), "utf-8");

        // 요약만 반환
        const summary = [
            `일괄 검색 완료 (${platformLabel}, ${companyNames.length}개 회사)`,
            `총 ${companiesWithPostings}/${companyNames.length}개 회사에서 ${totalPostings}건의 공고 발견`,
            "",
            `상세 결과 파일: ${filePath}`,
            "파일을 읽어서 상세 내용을 확인하세요.",
        ];

        if (allErrors.length > 0) {
            summary.push(
                "",
                "⚠ 일부 오류:",
                ...allErrors.map((e) => `  - ${e}`)
            );
        }

        const result = {
            content: [{ type: "text" as const, text: summary.join("\n") }],
            isError: allErrors.length > 0 && totalPostings === 0,
        };
        return logResult(name, result, startTime);
    }

    return logResult(name, {
        content: [{ type: "text" as const, text: `알 수 없는 도구: ${name}` }],
    }, startTime);
});


async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((error) => {
    console.error("서버 시작 실패:", error);
    process.exit(1);
});
