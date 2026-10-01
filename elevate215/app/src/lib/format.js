/**
 * Display helpers shared by the dashboard and its charts.
 * Fixed to en-US so the server and the browser print the same text.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "$1,234,567" @param {number} n */
export const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

/** "$1.23M", "$412k" or "$650" @param {number} n */
export function shortMoney(n) {
	const sign = n < 0 ? '-' : '';
	const v = Math.abs(n);
	if (v >= 1e6) return `${sign}$${(v / 1e6).toFixed(2)}M`;
	if (v >= 1e3) return `${sign}$${Math.round(v / 1e3)}k`;
	return `${sign}$${Math.round(v)}`;
}

/** "2025-07" -> "Jul 2025" @param {string} ym */
export const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

/** ISO date -> "Sep 30" @param {string} iso */
export function shortDate(iso) {
	const d = new Date(iso);
	return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/**
 * "just now", "12m ago", "3h ago", "4d ago"
 * @param {string} iso
 * @param {number} now  ms timestamp, passed in so server and browser agree
 */
export function timeAgo(iso, now) {
	const seconds = (now - new Date(iso).getTime()) / 1000;
	if (seconds < 60) return 'just now';
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	return `${Math.floor(seconds / 86400)}d ago`;
}
