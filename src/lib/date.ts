/** 端末ローカルの今日 0:00 */
export function todayStart(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** 今日を YYYY-MM-DD で返す */
export function todayIso(): string {
  return toIso(todayStart());
}

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** YYYY-MM-DD をローカル日付として解釈 */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "8/3" 形式(ゼロ埋めなし) */
export function formatMD(iso: string): string {
  const d = isoToDate(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 期限までの残り日数(過去は負)。毎日レンダー時に再計算される */
export function daysLeft(iso: string): number {
  return Math.round((isoToDate(iso).getTime() - todayStart().getTime()) / 86400000);
}

/** ヘッダー用「8月3日（月）」 */
export function headerDateLabel(): string {
  const d = new Date();
  const w = "日月火水木金土"[d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日（${w}）`;
}

export type DueKind = "overdue" | "soon" | "far";

/** 期限バッジの文言と色区分 */
export function duePillInfo(iso: string): { text: string; kind: DueKind } {
  const dl = daysLeft(iso);
  const md = formatMD(iso);
  if (dl < 0) return { text: `${md} ・ ${-dl}日超過`, kind: "overdue" };
  if (dl === 0) return { text: `今日 ・ ${md}`, kind: "soon" };
  if (dl <= 3) return { text: `${md} ・ あと${dl}日`, kind: "soon" };
  return { text: `${md} ・ あと${dl}日`, kind: "far" };
}

/**
 * ダイアログの期限入力(M/D)をパース。
 * 空文字は「期限なし」。半年以上過去になる日付は翌年扱いにする。
 */
export function parseDueInput(
  raw: string
): { ok: true; iso: string | null } | { ok: false } {
  const t = raw.trim();
  if (!t) return { ok: true, iso: null };
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(t);
  if (!m) return { ok: false };
  const mo = +m[1];
  const day = +m[2];
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return { ok: false };
  const today = todayStart();
  let d = new Date(today.getFullYear(), mo - 1, day);
  if (d.getMonth() !== mo - 1) return { ok: false }; // 2/30 のような不正日
  if ((today.getTime() - d.getTime()) / 86400000 > 183) {
    d = new Date(today.getFullYear() + 1, mo - 1, day);
  }
  return { ok: true, iso: toIso(d) };
}
