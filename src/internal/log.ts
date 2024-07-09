import Debug from "debug";

export const log = {
	debug: Debug("git-insight:debug"),
	error: Debug("git-insight:error"),
	info: console.log,
};
