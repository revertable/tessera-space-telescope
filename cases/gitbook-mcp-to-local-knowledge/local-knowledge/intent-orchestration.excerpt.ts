export function sourceCandidateIdentity(candidate: LocalCandidate): string {
	return `local:${candidate.id}`;
}

export async function retrieveWithIntentCoverage(
	config: MosaicConfig,
	question: string,
	dependencies: IntentCoverageDependencies = {}
): Promise<IntentCoverageResult> {
	const planQueries = dependencies.planQueries ?? planRetrievalQueries;
	const searchCandidates = dependencies.searchCandidates ?? searchLocalCandidates;
	const queries = planQueries(question);
	const runs: RetrievalQueryRun[] = [];
	if (!dependencies.searchCandidates) {
		const bundle = await searchLocalCandidateBundle(config, queries.map(({ text }) => text));
		for (const [index, query] of queries.entries()) {
			runs.push({ query, ranked: bundle.ranked[index] });
		}
		return { embeddingTarget: bundle.target, queries, runs, candidates: mergeIntentCoverage(runs) };
	}
	for (const query of queries) {
		runs.push({ query, ranked: await searchCandidates(config, query.text) });
	}
	return { queries, runs, candidates: mergeIntentCoverage(runs) };
}
