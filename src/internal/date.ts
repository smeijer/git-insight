export const getISODate = (daysAgo: number) => {
	const date = new Date();
	date.setDate(date.getDate() - daysAgo);
	return date.toISOString().slice(0, 10);
};

export const getTimeAgo = (date: string | Date) => {
	const strDate = date instanceof Date ? date.toISOString() : String(date);
	const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
	const now = new Date().getTime();
	const then = new Date(strDate.split("T")[0]).getTime();

	const seconds = Math.floor((now - then) / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const weeks = Math.floor(days / 7);
	const months = Math.floor(days / 30); // Approximate
	const years = Math.floor(days / 365); // Approximate

	if (years > 0) {
		return rtf.format(-years, "year");
	}
	if (months > 0) {
		return rtf.format(-months, "month");
	}
	if (weeks > 0) {
		return rtf.format(-weeks, "week");
	}
	if (days > 0) {
		return rtf.format(-days, "day");
	}
	if (hours > 0) {
		return rtf.format(-hours, "hour");
	}
	if (minutes > 0) {
		return rtf.format(-minutes, "minute");
	}
	return rtf.format(-seconds, "second");
};
