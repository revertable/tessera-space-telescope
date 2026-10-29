import { createInterface } from 'node:readline';
import type { MosaicConfig } from '../config.js';
import { buildIndex, getIndexStatus, type IndexBuildResult, type IndexStatus } from './indexer.js';

export type MenuSelection = { kind: 'target'; index: number } | { kind: 'cancel' } | { kind: 'invalid' };

export function parseMenuSelection(input: string, targetCount: number): MenuSelection {
	const value = input.trim();
	if (value.toLowerCase() === 'q') return { kind: 'cancel' };
	if (!/^[1-9]\d*$/.test(value)) return { kind: 'invalid' };
	const number = Number(value);
	if (!Number.isSafeInteger(number) || number > targetCount) return { kind: 'invalid' };
	return { kind: 'target', index: number - 1 };
}

export function formatIndexMenu(statuses: IndexStatus[], runtimeTargetIds: readonly string[]): string {
	const lines = ['[Mosaic Index Builder]', '', '현재 등록된 embedding target:', ''];
	for (const [index, { target, state }] of statuses.entries()) {
		const runtimeIndex = runtimeTargetIds.indexOf(target.id);
		const role = runtimeIndex === 0 ? 'PRIMARY' : runtimeIndex > 0 ? `FALLBACK ${runtimeIndex}` : 'STANDBY';
		const provider = target.provider.replace(/^./, (first) => first.toUpperCase());
		lines.push(`  ${index + 1}. ${provider} / ${target.model} / ${target.dimensions}d`);
		lines.push(`     Runtime: ${role}  |  Index: ${state.toUpperCase()}`);
		lines.push('');
	}
	lines.push(`빌드할 모델을 선택하세요 [1-${statuses.length}] (취소: q):`);
	return lines.join('\n');
}

export function formatBuildOutcome(previous: IndexStatus, result?: IndexBuildResult): { exitCode: number; message: string } {
	if (!result) return { exitCode: 1, message: '빌드 실패: index builder가 결과를 반환하지 않았습니다.' };
	if (result.error || result.failure) {
		if (result.failure) {
			return {
				exitCode: 1,
				message: `빌드 실패: provider ${result.failure.kind}.\n정규화된 provider 진단: ${JSON.stringify(result.failure)}`
			};
		}
		return { exitCode: 1, message: `빌드 실패: ${result.error}` };
	}
	if (result.status?.state !== 'current') {
		return { exitCode: 1, message: `빌드 실패: 최종 index 상태가 ${result.status?.state.toUpperCase() ?? 'UNKNOWN'}입니다.` };
	}
	return {
		exitCode: 0,
		message: previous.state === 'current'
			? '이미 CURRENT인 index artifact를 재사용했습니다.'
			: '빌드 완료: index 상태가 CURRENT입니다.'
	};
}
