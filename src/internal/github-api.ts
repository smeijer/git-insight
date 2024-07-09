import { Octokit } from "@octokit/rest";
import { githubToken } from "./config";
import type { Issue } from "./db";
import * as db from "./db";
import { log } from "./log";

const OctokitWithCache = Octokit.plugin((octokit) => {
	octokit.hook.wrap("request", async (request, options) => {
		const fullUrl = octokit.request.endpoint(options).url;
		const cacheKey = { url: fullUrl, method: options.method };
		const cache = await db.cache.findOneAsync(cacheKey);

		// Check if the response is in the cache and is fresh
		if (cache) {
			return cache.data;
		}

		const data = await request(options);
		const expiresAfter = new Date(Date.now() + 60_000 * 30); // 30 minutes
		await db.cache.insertAsync({ ...cacheKey, expiresAfter, data });
		return data;
	});
});

const octokit = new OctokitWithCache({
	auth: githubToken,
});

async function getOwnerType(owner: string): Promise<"user" | "org" | null> {
	try {
		const d1 = await octokit.users.getByUsername({ username: owner });
		const type = (d1.data || d1).type.toLowerCase();
		return type === "user" ? "user" : "org";
	} catch (error) {
		return null;
	}
}

export async function syncRepos(owner: string) {
	const type = await getOwnerType(owner);

	const repos =
		type === "org"
			? await octokit.paginate(octokit.repos.listForOrg, {
					type: "public",
					org: owner,
					per_page: 100,
				})
			: await octokit.paginate(octokit.repos.listForUser, {
					type: "owner",
					username: owner,
					per_page: 100,
				});

	for (const repo of repos) {
		const query = { owner, name: repo.name };
		const result = await db.repos.updateAsync(
			query,
			{
				$set: {
					owner,
					name: repo.name,
					createdAt: new Date(repo.created_at!),
					updatedAt: new Date(repo.updated_at!),
					defaultBranch: repo.default_branch,
				},
			},
			{ upsert: true },
		);

		if (result.numAffected) {
			log.debug("fetched repo data", query);
		}
	}

	return repos;
}

export async function syncReleases(owner: string, repo: string, since: Date) {
	const releases = await octokit.paginate(octokit.repos.listReleases, {
		owner,
		repo,
		per_page: 100,
	});

	const docs = releases
		.filter((x) => !x.draft)
		.map((release) => ({
			owner,
			repo,
			name: release.name,
			tag: release.tag_name,
			author: release.author.login,
			createdAt: new Date(release.created_at),
			publishedAt: release.published_at ? new Date(release.published_at) : null,
		}));

	for (const doc of docs) {
		await db.releases.updateAsync(
			{ owner, repo, tag: doc.tag },
			{ $set: doc },
			{ upsert: true },
		);
	}

	log.debug("synced releases", { owner, repo, commits: releases.length });
}

export async function syncCommitList(owner: string, repo: string, since: Date) {
	const dbRepo = await db.repos.findOneAsync({ owner, name: repo });

	const commits = await octokit.paginate(octokit.repos.listCommits, {
		owner,
		repo,
		since: since.toISOString(),
		sha: dbRepo.defaultBranch,
		per_page: 100,
	});

	const docs = commits.map((commit) => ({
		owner,
		repo,
		sha: commit.sha,
		base: dbRepo.defaultBranch,
		author: commit.author?.login || null,
		committer: commit.committer?.login || null,
		message: commit.commit.message.split("\n")[0],
		createdAt: new Date(
			commit.commit.author?.date || commit.commit.committer?.date!,
		),
	}));

	for (const commit of docs) {
		await db.commits.updateAsync(
			{ repo, owner, sha: commit.sha },
			{ $set: commit },
			{ upsert: true },
		);
	}

	log.debug("synced commit list", { owner, repo, commits: commits.length });
}

export async function syncCommitDetails(
	owner: string,
	repo: string,
	since: Date,
) {
	const commits = await db.commits.findAsync({
		owner,
		repo,
		createdAt: { $gt: since },
		filesChanged: { $exists: false },
	});

	for (const commit of commits) {
		const { data } = await octokit.repos.getCommit({
			owner,
			repo,
			ref: commit.sha,
		});

		await db.commits.updateAsync(
			{ sha: commit.sha },
			{
				$set: {
					additions: data.stats?.additions || 0,
					deletions: data.stats?.deletions || 0,
					filesChanged: data.files?.length || 0,
				},
			},
		);

		log.debug("synced commit details", {
			owner,
			repo,
			base: commit.base,
			sha: commit.sha,
		});
	}
}

export async function syncIssueList(owner: string, repo: string, since: Date) {
	const issues = await octokit.paginate(octokit.issues.listForRepo, {
		owner,
		repo,
		state: "all",
		since: since.toISOString(),
		per_page: 100,
	});

	const docs = issues.map(({ reactions = {}, ...issue }) => ({
		owner,
		repo,
		number: issue.number,
		title: issue.title,
		state: issue.state,
		author: issue.user?.login,
		type: issue.pull_request ? "pr" : "issue",
		createdAt: new Date(issue.created_at),
		updatedAt: new Date(issue.updated_at),
		closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
		mergedAt: issue.pull_request?.merged_at
			? new Date(issue.pull_request.merged_at)
			: null,
		comments: issue.comments,
		reactions: {
			total_count: reactions.total_count || 0,
			"+1": reactions["+1"] || 0,
			"-1": reactions["-1"] || 0,
			laugh: reactions.laugh || 0,
			confused: reactions.confused || 0,
			heart: reactions.heart || 0,
			hooray: reactions.hooray || 0,
			eyes: reactions.eyes || 0,
			rocket: reactions.rocket || 0,
		},
	}));

	for (const doc of docs) {
		await db.issues.updateAsync(
			{ repo, owner, number: doc.number },
			{ $set: doc },
			{ upsert: true },
		);
	}

	log.debug("synced updated issues", { owner, repo, issues: docs.length });
}

export async function syncIssueDetails(
	owner: string,
	repo: string,
	since: Date,
) {
	const issues = await db.issues.findAsync({
		owner,
		repo,
		updatedAt: { $gt: since },
	});

	for (const issue of issues) {
		if (issue.syncedAt && issue.syncedAt >= issue.updatedAt) continue;

		if (issue.type === "pr") {
			const details = await octokit.pulls.get({
				owner,
				repo,
				pull_number: issue.number,
			});

			const patch: Partial<Issue> = {
				commits: details.data.commits,
				additions: details.data.additions,
				deletions: details.data.deletions,
				changedFiles: details.data.changed_files,
				syncedAt: new Date(),
			};

			if (details.data.merged_by) {
				patch.mergedBy = details.data.merged_by.login;
				patch.closedBy = details.data.merged_by.login;
			}

			// biome-ignore lint/complexity/useLiteralKeys:
			await db.issues.updateAsync({ _id: issue["_id"] }, { $set: patch });
			log.debug("synced pr details", { owner, repo, number: issue.number });

			// we want to fall through to the issue fetching, as issue api includes closed_by prop for closed (not merged) prs
			if (!details.data.closed_at || patch.closedBy) continue;
		}

		const details = await octokit.issues.get({
			owner,
			repo,
			issue_number: issue.number,
		});

		const patch: Partial<Issue> = {
			closedBy: details.data.closed_by?.login,
			syncedAt: new Date(),
		};

		if (!patch.closedBy) continue;

		// biome-ignore lint/complexity/useLiteralKeys:
		await db.issues.updateAsync({ _id: issue["_id"] }, { $set: patch });
		log.debug("synced issue details", {
			owner,
			repo,
			number: issue.number,
			syncedAt: issue.syncedAt,
			updatedAt: issue.updatedAt,
		});
	}
}
