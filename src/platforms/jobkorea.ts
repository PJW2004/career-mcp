import {
    JobPosting,
    SearchParams,
    JobPlatform,
    JobSearchError,
} from "../types.js";

const BASE_URL = "https://www.jobkorea.co.kr";
const SEARCH_URL = `${BASE_URL}/Search/`;
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CAREER_TYPE_MAP: Record<string, string> = {
    "1": "경력",
    "2": "경력",
    "3": "신입/경력",
    "4": "신입",
};

const EDUCATION_CODE_MAP: Record<string, string> = {
    "0": "학력무관",
    "1": "중졸 이하",
    "2": "고졸",
    "3": "전문대졸",
    "4": "대졸",
    "5": "대학원(석사)",
    "6": "대학원(박사)",
};

interface RawJobItem {
    id: string;
    title: string;
    companyName: string;
    careerType: string;
    careerRange: number;
    educationCode: string;
    areaCodeList: string[];
    applicationPeriod: { start: string; end: string };
}

async function search(params: SearchParams): Promise<JobPosting[]> {
    const url = new URL(SEARCH_URL);
    url.searchParams.set("stext", params.companyName);
    url.searchParams.set("tabType", "recruit");
    url.searchParams.set("Page_No", String(params.page));

    let html: string;
    try {
        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "User-Agent": USER_AGENT,
                Accept: "text/html,application/xhtml+xml",
                "Accept-Language": "ko-KR,ko;q=0.9",
                Referer: BASE_URL,
            },
        });

        if (!response.ok) {
            throw new JobSearchError(
                `잡코리아 요청 실패: HTTP ${response.status}`,
                response.status
            );
        }

        html = await response.text();
    } catch (error) {
        if (error instanceof JobSearchError) throw error;
        throw new JobSearchError(
            `잡코리아 연결 실패: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    return parseSearchResults(html);
}

function parseSearchResults(html: string): JobPosting[] {
    const regex = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
        const raw = match[1];
        if (
            !raw.includes("totalElements") ||
            !raw.includes("postingCompanyName")
        ) {
            continue;
        }

        const unescaped = raw.replace(/\\"/g, '"').replace(/\\n/g, "\n");

        const searchStr = '"content":[';
        const idx = unescaped.indexOf(searchStr);
        if (idx === -1) continue;

        const contentStart = idx + searchStr.length - 1;
        let depth = 0;
        let end = contentStart;
        for (let i = contentStart; i < unescaped.length; i++) {
            if (unescaped[i] === "[") depth++;
            else if (unescaped[i] === "]") {
                depth--;
                if (depth === 0) {
                    end = i + 1;
                    break;
                }
            }
        }

        try {
            const items: RawJobItem[] = JSON.parse(
                unescaped.substring(contentStart, end)
            );
            return items.map(toJobPosting);
        } catch {
            continue;
        }
    }

    return [];
}

function toJobPosting(item: RawJobItem): JobPosting {
    const career = CAREER_TYPE_MAP[item.careerType] ?? "무관";
    const experience =
        item.careerType === "2" || item.careerType === "1"
            ? `${career} ${item.careerRange}년 이상`
            : career;

    const education = EDUCATION_CODE_MAP[item.educationCode] ?? "학력무관";
    const location = (item.areaCodeList ?? []).join(", ");
    const endDate = item.applicationPeriod?.end;
    const deadline = endDate
        ? new Date(endDate).toLocaleDateString("ko-KR")
        : "-";

    return {
        platform: "잡코리아",
        companyName: item.companyName,
        title: item.title,
        experience,
        education,
        location,
        deadline,
        url: `${BASE_URL}/Recruit/GI_Read/${item.id}`,
    };
}

export const jobkorea: JobPlatform = { name: "잡코리아", search };
