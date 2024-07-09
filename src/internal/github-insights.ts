import * as emoji from "node-emoji";
import pc from "picocolors";
import { getTimeAgo } from "./date";
import * as db from "./db";

function byPeople<
	T extends Record<string, unknown> = { author?: string | null },
>(arr: T[], field: keyof T = "author") {
	const count = new Set(arr.map((x) => x[field]).filter(Boolean)).size;
	return count === 1 ? "1 person" : `${count} people`;
}

const dateSorter = (field: string, dir = "desc") =>
	dir === "asc"
		? (a, b) => new Date(a[field]).getTime() - new Date(b[field]).getTime()
		: (a, b) => new Date(b[field]).getTime() - new Date(a[field]).getTime();

export type RepoInsights = Exclude<
	Awaited<ReturnType<typeof getRepoInsights>>,
	null
>;

export async function getRepoInsights(
	owner: string,
	repo: string,
	since: Date,
) {
	const repoDoc = await db.repos.findOneAsync({ owner, name: repo });
	if (!repoDoc) return null;

	const openPulls = await db.issues.findAsync({
		owner,
		repo,
		updatedAt: { $gt: since },
		type: "pr",
		state: "open",
	});

	const mergedPulls = await db.issues.findAsync({
		owner,
		repo,
		mergedAt: { $gt: since },
		type: "pr",
		state: "closed",
	});

	const closedPulls = await db.issues.findAsync({
		owner,
		repo,
		closedAt: { $gt: since },
		type: "pr",
		state: "closed",
	});

	const openIssues = await db.issues.findAsync({
		owner,
		repo,
		createdAt: { $gt: since },
		type: "issue",
		state: "open",
	});

	const closedIssues = await db.issues.findAsync({
		owner,
		repo,
		closedAt: { $gt: since },
		type: "issue",
		state: "closed",
	});

	const commits = await db.commits.findAsync({
		owner,
		repo,
		createdAt: { $gt: since },
		base: repoDoc.defaultBranch,
	});

	const releases = await db.releases.findAsync({
		owner,
		repo,
		publishedAt: { $gt: since },
	});

	const mainBranch = {
		commits: commits.length,
		additions: commits.reduce((sum, commit) => sum + commit.additions, 0),
		deletions: commits.reduce((sum, commit) => sum + commit.deletions, 0),
		filesChanged: commits.reduce((sum, commit) => sum + commit.filesChanged, 0),
		contributors: commits.reduce(
			(acc, commit) => {
				acc[commit.author] ??= 0;
				acc[commit.author] += 1;
				return acc;
			},
			{} as Record<string, number>,
		),
	};

	const allPulls = [...openPulls, ...closedPulls];

	const allBranches = {
		count: allPulls.length,
		commits: allPulls.reduce((sum, pr) => sum + (pr.commits || 0), 0),
		additions: allPulls.reduce((sum, pr) => sum + (pr.additions || 0), 0),
		deletions: allPulls.reduce((sum, pr) => sum + (pr.deletions || 0), 0),
		filesChanged: allPulls.reduce((sum, pr) => sum + (pr.changedFiles || 0), 0),
		contributors: allPulls.reduce(
			(acc, pr) => {
				acc[pr.author!] ??= 0;
				acc[pr.author!] += 1;
				return acc;
			},
			{} as Record<string, number>,
		),
	};

	const unresolvedConversations = await db.issues.findAsync({
		owner,
		repo,
		createdAt: { $lt: since },
		updatedAt: { $gt: since },
		state: "open",
	});

	return {
		owner,
		repo,
		defaultBranch: repoDoc.defaultBranch,
		openPulls,
		mergedPulls,
		openIssues,
		closedIssues,
		unresolvedConversations,
		mainBranch,
		allBranches,
		releases,
	};
}

const words = {
	person: "people",
} as const;

const plural = (
	count: number,
	word: string,
	plural?: string,
	countFormatted?: string,
) => {
	const _plural = plural || words[word] || `${word}s`;
	const _formatted = String(countFormatted ?? count);
	return count === 1 ? `${_formatted} ${word}` : `${_formatted} ${_plural}`;
};

const print = {
	header: (text) => console.log(`\n${text}\n`),
	record: (icon, title, ...fields) =>
		console.log(
			`  ${icon || pc.dim("—")} ${pc.bold(emoji.emojify(title || ""))}\n${icon ? " " : ""}    ${pc.dim(fields.filter(Boolean).join(" • "))}`,
		),
};

function mergeStats(repo1: RepoInsights, repo2: RepoInsights): RepoInsights {
	const mergeDeep = (target, source) => {
		// Check if value is an object
		const isObject = (obj) =>
			obj && typeof obj === "object" && !Array.isArray(obj);

		// Check if value is an integer
		const isInteger = (val) => Number.isInteger(val);

		// Check if value is a string
		const isString = (val) => typeof val === "string";

		// Base case: if both are arrays, concatenate them
		if (Array.isArray(target) && Array.isArray(source)) {
			return target.concat(source);
		}

		// If both values are objects, merge them recursively
		if (isObject(target) && isObject(source)) {
			const merged = { ...target };

			for (const key of Object.keys(source)) {
				if (merged[key] === undefined) {
					merged[key] = source[key];
				} else {
					merged[key] = mergeDeep(merged[key], source[key]);
				}
			}

			return merged;
		}

		// If both values are integers, sum them
		if (isInteger(target) && isInteger(source)) {
			return target + source;
		}

		// If both values are strings, convert to string array
		if (isString(target) && isString(source)) {
			return [target, source];
		}

		// If one value is a string and the other is a string array, concatenate
		if (isString(target) && Array.isArray(source) && source.every(isString)) {
			return [target].concat(source);
		}
		if (Array.isArray(target) && target.every(isString) && isString(source)) {
			return target.concat([source]);
		}

		// Fallback to source value for other types
		return source;
	};

	const merged = mergeDeep(repo1, repo2) as RepoInsights;

	// Custom merge logic for repo stats
	merged.repo = [repo1.repo, repo2.repo].filter(Boolean).join(", ");
	merged.defaultBranch = "main";

	return merged;
}

function formatNumber(number: number) {
	return new Intl.NumberFormat("en-US").format(number);
}

function printStats(stats: RepoInsights, show?: number) {
	console.log(`\n${pc.bold(stats.repo)}`);

	const activePrCount = stats.openPulls.length + stats.mergedPulls.length;
	const activeIssueCount = stats.openIssues.length + stats.closedIssues.length;
	const commitCount = stats.mainBranch.commits;

	if (!activePrCount && !activeIssueCount && !commitCount) {
		console.log(pc.dim("There hasn’t been any activity in the last month."));
		return;
	}

	console.log("");

	const repo = stats.repo.includes(",") ? (item) => item.repo : () => "";

	console.log(
		`  ${plural(activePrCount, "active pull request")} ${pc.gray(`(${stats.mergedPulls.length} closed, ${stats.openPulls.length} open)`)}`,
	);
	console.log(
		`  ${plural(activeIssueCount, "active issues")} ${pc.gray(`(${stats.closedIssues.length} closed, ${stats.openIssues.length} new)`)}`,
	);
	console.log("");

	const contributors = Object.entries(stats.mainBranch.contributors);
	if (stats.mainBranch.commits) {
		console.log(
			`Excluding merges, ${pc.bold(plural(contributors.length, "author has", "authors have"))} pushed ${pc.bold(plural(stats.mainBranch.commits, "commit"))} to ${stats.defaultBranch} and ${pc.bold(plural(stats.allBranches.commits, "commit"))} to ${plural(stats.allBranches.count, "pull-request")}. On ${stats.defaultBranch}, ${pc.bold(plural(stats.mainBranch.filesChanged, "file has", "files have"))} changed and there have been ${pc.bold(plural(stats.allBranches.additions, "addition", "", pc.green(formatNumber(stats.allBranches.additions))))} and ${pc.bold(plural(stats.allBranches.deletions, "deletion", "", pc.red(formatNumber(stats.allBranches.deletions))))}.`,
		);
	} else {
		console.log(
			pc.dim(
				"There hasn’t been any commit activity on the main branches, in the last month.",
			),
		);
	}

	if (contributors.length) {
		const commitCount = contributors.reduce((sum, next) => sum + next[1], 0);
		print.header(
			`${plural(commitCount, "commit")} on main, authored by ${plural(contributors.length, "contributor")}`,
		);
		for (const [contributor, commitCount] of contributors
			.sort((a, b) => b[1] - a[1])
			.slice(0, show)) {
			const icon = contributor.endsWith("[bot]") ? "🤖" : "🧑";
			print.record(
				icon,
				contributor,
				`pushed ${plural(Number(commitCount), "commit")}`,
			);
		}
	}

	if (stats.releases.length) {
		print.header(
			`${plural(stats.releases.length, "release")} published by ${byPeople(stats.releases)}`,
		);
		for (const item of stats.releases
			.sort(dateSorter("publishedAt"))
			.slice(0, show)) {
			print.record(
				"🏷",
				item.name || item.tag,
				`published ${getTimeAgo(item.publishedAt!)}`,
				`@${item.author}`,
				repo(item),
			);
		}
	}

	if (stats.mergedPulls.length) {
		print.header(
			`${plural(stats.mergedPulls.length, "pull request")} merged by ${byPeople(stats.mergedPulls)}`,
		);
		for (const item of stats.mergedPulls
			.sort(dateSorter("mergedAt"))
			.slice(0, show)) {
			print.record(
				"🔀",
				item.title,
				`#${item.number} merged ${getTimeAgo(item.mergedAt!)}`,
				`@${item.author}`,
				repo(item),
			);
		}
	}

	if (stats.openPulls.length) {
		print.header(
			`${plural(stats.openPulls.length, "pull request")} opened by ${byPeople(stats.openPulls)}`,
		);
		for (const item of stats.openPulls
			.sort(dateSorter("createdAt"))
			.slice(0, show)) {
			print.record(
				"📬",
				item.title,
				`#${item.number} created ${getTimeAgo(item.createdAt)}`,
				`@${item.author}`,
				repo(item),
			);
		}
	}

	if (stats.closedIssues.length) {
		print.header(
			`${plural(stats.closedIssues.length, "issue")} closed by ${byPeople(stats.closedIssues, "closedBy")}`,
		);
		for (const item of stats.closedIssues
			.sort(dateSorter("closedAt"))
			.slice(0, show)) {
			print.record(
				"🟣",
				item.title,
				`#${item.number} closed ${getTimeAgo(item.closedAt!)}`,
				`@${item.author}`,
				repo(item),
			);
		} // closed but not resolved: ⚪
	}

	if (stats.openIssues.length) {
		print.header(
			`${plural(stats.openIssues.length, "issue")} opened by ${byPeople(stats.openIssues)}`,
		);
		for (const item of stats.openIssues
			.sort(dateSorter("createdAt"))
			.slice(0, show)) {
			print.record(
				"🟢",
				item.title,
				`#${item.number} opened ${getTimeAgo(item.createdAt)}`,
				`@${item.author}`,
				repo(item),
			);
		}
	}

	if (stats.unresolvedConversations.length) {
		print.header(
			`${plural(stats.unresolvedConversations.length, "unresolved conversation")}`,
		);
		for (const item of stats.unresolvedConversations
			.sort(dateSorter("updatedAt"))
			.slice(0, show)) {
			print.record(
				"💬",
				item.title,
				`#${item.number} updated ${getTimeAgo(item.updatedAt)}`,
				plural(item.comments, "comment"),
				repo(item),
			);
		}
	}
}

export async function printInsights({
	owner,
	repos,
	show,
	since,
}: {
	owner: string;
	repos?: string[];
	show?: number;
	since: Date;
}) {
	const insights: RepoInsights[] = [];

	const repositories = repos
		? await db.repos.findAsync({ owner, name: { $in: repos } })
		: await db.repos.findAsync({ owner });

	for (const repo of repositories) {
		const data = await getRepoInsights(repo.owner, repo.name, since);
		if (!data) continue;
		insights.push(data);
	}

	const merged = insights.reduce(
		(acc, next) => mergeStats(acc, next),
		{} as RepoInsights,
	);
	printStats(merged, show);
}
