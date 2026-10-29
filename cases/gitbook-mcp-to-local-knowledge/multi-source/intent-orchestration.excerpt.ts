export function sourceCandidateIdentity(candidate: RankedSourceCandidate): string {
	return candidate.kind === 'local'
		? `local:${candidate.knowledgeSourceId}:${candidate.candidate.id}`
		: `gitbook:${candidate.knowledgeSourceId}:${candidate.hit.publicUrl}`;
}

export async function retrieveWithIntentCoverage(
	config: MosaicConfig,
	question: string,
	dependencies: IntentCoverageDependencies = {}
): Promise<IntentCoverageResult> {
	const planQueries = dependencies.planQueries ?? planRetrievalQueries;
	const collectCandidates = dependencies.collectCandidates ?? collectSourceCandidates;
	const rankCandidates = dependencies.rankCandidates ?? rankSourceCandidates;
	const queries = planQueries(question);
	const runs: RetrievalQueryRun[] = [];
	for (const query of queries) {
		const batches = await collectCandidates(config, query.text);
		runs.push({ query, ranked: await rankCandidates(config, query.text, batches) });
	}
	return { queries, runs, candidates: mergeIntentCoverage(runs) };
}
