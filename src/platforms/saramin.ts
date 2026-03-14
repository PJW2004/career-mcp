import * as cheerio from "cheerio";
import {
    JobPosting,
    SearchParams,
    JobPlatform,
    JobSearchError,
} from "../types.js";

const BASE_URL = "https://www.saramin.co.kr";
const SEARCH_URL = `${BASE_URL}/zf_user/search`;
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function search(params: SearchParams): Promise<JobPosting[]> {
    const url = new URL(SEARCH_URL);
    url.searchParams.set("searchType", "search");
    url.searchParams.set("searchword", params.companyName);
    url.searchParams.set("recruitPage", String(params.page));
    url.searchParams.set("recruitSort", "relation");
    url.searchParams.set("recruitPageCount", "40");
    url.searchParams.set("search_done", "y");
    url.searchParams.set("search_optional_item", "n");

    let html: string;
    try {
        const response = await fetch(url.toString(), {
            headers: {
                "User-Agent": USER_AGENT,
                Accept: "text/html,application/xhtml+xml",
                "Accept-Language": "ko-KR,ko;q=0.9",
                Referer: BASE_URL,
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            throw new JobSearchError(
                `사람인 요청 실패: HTTP ${response.status}`,
                response.status
            );
        }

        html = await response.text();
    } catch (error) {
        if (error instanceof JobSearchError) throw error;
        throw new JobSearchError(
            `사람인 연결 실패: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    return parseSearchResults(html);
}

function parseSearchResults(html: string): JobPosting[] {
    const $ = cheerio.load(html);
    const postings: JobPosting[] = [];

    $("div.item_recruit").each((_i, el) => {
        const $el = $(el);
        const recIdx = $el.attr("value") || "";

        const titleEl = $el.find(".job_tit a");
        const title = (titleEl.attr("title") || titleEl.text()).trim();
        const companyName = $el.find(".corp_name a").text().trim();

        const conditions = $el.find(".job_condition span");
        const location = $(conditions.get(0)).text().trim();
        const experience = $(conditions.get(1)).text().trim();
        const education = $(conditions.get(2)).text().trim();

        const deadline = $el.find(".job_date .date").text().trim();

        if (!title && !companyName) return;

        postings.push({
            platform: "사람인",
            companyName,
            title,
            experience: experience || "-",
            education: education || "-",
            location: location || "-",
            deadline: deadline || "-",
            url: recIdx
                ? `${BASE_URL}/zf_user/jobs/relay/view?rec_idx=${recIdx}`
                : "",
        });
    });

    return postings;
}

export const saramin: JobPlatform = { name: "사람인", search };
