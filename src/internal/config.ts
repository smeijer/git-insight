import envPaths from "env-paths";

function getEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.log(`Environment variable ${name} is not set.`);
		process.exit(1);
	}

	return value;
}

export const githubToken = getEnv("GITHUB_TOKEN");
export const paths = envPaths("git-insight", { suffix: "" });
