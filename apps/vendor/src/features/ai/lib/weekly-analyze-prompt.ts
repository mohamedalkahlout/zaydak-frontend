/**
 * What the weekly card's "Analyze" sends to the assistant, in the vendor's
 * voice — a question, not UI copy, so it stays an EN/AR pair here rather than
 * a catalogue string.
 *
 * It names the card's own two weeks as dates. "The last 7 days" would reach
 * `get_shop_stats(weekly)`, whose window includes today, while the card shows
 * the seven complete days that end yesterday — so the answer would not match
 * the card it was asked from. Shop-local ISO dates are what
 * `get_custom_range_stats` takes, inclusive at both ends, and stay
 * unambiguous across a year end.
 */
export function weeklyAnalyzePrompt(
  daily: ReadonlyArray<{ day: string }>,
  isAr: boolean,
): string {
  if (daily.length !== 14) {
    return isAr
      ? "حلّل أداء آخر 7 أيام وقارن بالأسبوع اللي قبله"
      : "Analyze the last 7 days and compare with the prior week"
  }
  const [priorFrom, priorTo] = [daily[0].day, daily[6].day]
  const [from, to] = [daily[7].day, daily[13].day]
  return isAr
    ? `حلّل مبيعاتي من ${from} إلى ${to} وقارنها بالفترة من ${priorFrom} إلى ${priorTo}`
    : `Analyze my sales from ${from} to ${to} and compare them with ${priorFrom} to ${priorTo}`
}
