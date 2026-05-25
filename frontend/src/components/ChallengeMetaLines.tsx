/** Условия испытания для карточки и страницы челленджа. */

export type ChallengeMetaSource = {
  required_publications: number | null;
  duration_days: number | null;
  date_start: string | null;
  date_end: string | null;
};

function fmtDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('ru-RU');
}

export default function ChallengeMetaLines({ c }: { c: ChallengeMetaSource }) {
  const lines: string[] = [];
  if (c.required_publications != null && c.required_publications >= 1) {
    lines.push(`Публикаций: ${c.required_publications}`);
  }
  if (c.duration_days != null && c.duration_days >= 1) {
    lines.push(`Дней: ${c.duration_days}`);
  }
  if (c.date_start && c.date_end) {
    lines.push(`Период: ${fmtDate(c.date_start)} — ${fmtDate(c.date_end)}`);
  }
  if (lines.length === 0) return null;
  return (
    <ul className="challenge-meta-lines">
      {lines.map((text) => (
        <li key={text}>{text}</li>
      ))}
    </ul>
  );
}
