export interface JobPosting {
    platform: string;
    companyName: string;
    title: string;
    experience: string;
    education: string;
    location: string;
    deadline: string;
    url: string;
}

export interface SearchParams {
    companyName: string;
    page: number;
}

export type PlatformName = "jobkorea" | "saramin" | "all";

export interface JobPlatform {
    name: string;
    search(params: SearchParams): Promise<JobPosting[]>;
}

export class JobSearchError extends Error {
    statusCode?: number;

    constructor(message: string, statusCode?: number) {
        super(message);
        this.name = "JobSearchError";
        this.statusCode = statusCode;
    }
}
