import type { MatchBreakdown } from "@/lib/demo/types";

/** Evidence coverage only; it is not a hiring or referral probability. */
const categoryWeights: Record<keyof MatchBreakdown, number> = {
  mandatory: 45,
  relevantWork: 30,
  preferred: 15,
  achievements: 10,
};
export function calculateEvidenceCoverage(
  criteria: { category: keyof MatchBreakdown; supported: boolean }[],
): number {
  const categories = Object.keys(categoryWeights) as (keyof MatchBreakdown)[];
  const weightedCoverage = categories.reduce((score, category) => {
    const items = criteria.filter((item) => item.category === category);
    const coverage = items.length
      ? items.filter((item) => item.supported).length / items.length
      : 0;
    return score + coverage * categoryWeights[category];
  }, 0);
  return Math.round(weightedCoverage);
}

export function averageMatchComponents(match: MatchBreakdown): number {
  return Math.round(
    (match.mandatory * 45 +
      match.relevantWork * 30 +
      match.preferred * 15 +
      match.achievements * 10) /
      100,
  );
}
