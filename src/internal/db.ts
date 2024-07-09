import path from "node:path";
import Datastore from "@seald-io/nedb";
import { paths } from "./config";
import { log } from "./log";

type Repo = {
	owner: string;
	name: string;
	createdAt: Date;
	updatedAt: Date;
	defaultBranch: string;
	syncedAt: Date | null;
};

type Commit = {
	owner: string;
	repo: string;
	sha: string;
	base: string | number;
	author: string;
	committer: string;
	additions: number;
	deletions: number;
	filesChanged: number;
	message: string;
	createdAt: Date;
};

export type Issue = {
	owner: string;
	repo: string;
	number: number;
	title: string;
	state: string;
	author: string | null;
	createdAt: Date;
	updatedAt: Date;
	closedAt: Date | null;
	closedBy: string | null;
	syncedAt?: Date;
	mergedBy?: string | null;
	type: "pr" | "issue";
	comments: number;
	reactions: {
		total_count: number;
		"+1": number;
		"-1": number;
		laugh: number;
		confused: number;
		heart: number;
		hooray: number;
		eyes: number;
		rocket: number;
	};
	mergedAt?: Date;
	commits?: number;
	additions?: number;
	deletions?: number;
	changedFiles?: number;
};

type Release = {
	owner: string;
	repo: string;
	name: string;
	tag: string;
	author: string;
	createdAt: Date;
	publishedAt: Date | null;
};

type Cache = {
	url: string;
	expiresAfter: Date;
	// biome-ignore lint/suspicious/noExplicitAny:
	data: any;
};

export const repos = new Datastore<Repo>({
	filename: path.join(paths.data, "repos.db.json"),
	autoload: true,
});
export const issues = new Datastore<Issue>({
	filename: path.join(paths.data, "issues.db.json"),
	autoload: true,
});
export const commits = new Datastore<Commit>({
	filename: path.join(paths.data, "commits.db.json"),
	autoload: true,
});
export const releases = new Datastore<Release>({
	filename: path.join(paths.data, "releases.db.json"),
	autoload: true,
});
export const cache = new Datastore<Cache>({
	filename: path.join(paths.data, "cache.db.json"),
	autoload: true,
});

log.debug("storing data in", paths.data);

repos.ensureIndex({ fieldName: ["owner", "name"] });
issues.ensureIndex({ fieldName: ["owner", "repo"] });
commits.ensureIndex({ fieldName: ["owner", "repo"] });

cache.ensureIndex({
	fieldName: "expireAfter",
	expireAfterSeconds: 0,
});
