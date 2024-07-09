import { InvalidArgumentError, program } from "@commander-js/extra-typings";
import date from "date.js";
import { deleteAsync } from "del";
import pkg from "../package.json";
import { paths } from "./internal/config";
import * as db from "./internal/db";
import {
	syncCommitDetails,
	syncCommitList,
	syncIssueDetails,
	syncIssueList,
	syncReleases,
	syncRepos,
} from "./internal/github-api";
import { printInsights } from "./internal/github-insights";

import ora from "ora";

function intArg(value) {
	if (value == null) return;

	const parsedValue = Number.parseInt(value, 10);
	if (Number.isNaN(parsedValue)) {
		throw new InvalidArgumentError("Not a number.");
	}

	return parsedValue;
}

program
	.name(pkg.name)
	.version(pkg.version)
	.option("--purge-cache")
	.action(async (options) => {
		if (options.purgeCache) {
			await deleteAsync("*.db.json", { cwd: paths.data });
			console.log("cache files have been purged");
			process.exit(0);
		}
	});

program
	.command("org")
	.argument("<owner>", "the user or organization to analyze")
	.argument("[repo...]", "one or more repos of `owner` to include")
	.option(
		"-s, --show <number>",
		"how many items to show under each section",
		intArg,
		5,
	)
	.option(
		"-d, --days <number>",
		"how many days worth of activity to analyze",
		intArg,
		30,
	)
	.action(async (owner, repo, options) => {
		const maxAge = date(`${options.days} days ago`);

		const ownerRepos = await syncRepos(owner);
		const repos = repo.length ? repo : ownerRepos.map((x) => x.name);

		const spinner = ora().start();

		for (const name of repos) {
			const repo = await db.repos.findOneAsync({ owner, name });
			const syncedAt = repo.syncedAt || maxAge;

			spinner.text = `syncing issues for ${owner}/${name}`;
			await syncIssueList(repo.owner, repo.name, syncedAt);
			await syncIssueDetails(repo.owner, repo.name, syncedAt);
			spinner.text = `syncing commits for ${owner}/${name}`;
			await syncCommitList(repo.owner, repo.name, syncedAt);
			await syncCommitDetails(repo.owner, repo.name, syncedAt);
			spinner.text = `syncing releases for ${owner}/${name}`;
			await syncReleases(repo.owner, repo.name, syncedAt);

			await db.repos.updateAsync(
				{ owner: repo.owner, name: repo.name },
				{ $set: { syncedAt } },
			);
		}

		spinner.stop();
		await printInsights({ ...options, owner, repos, since: maxAge });
	})
	.showHelpAfterError();

program.parse(process.argv);
