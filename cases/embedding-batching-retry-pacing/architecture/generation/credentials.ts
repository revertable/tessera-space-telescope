const CREDENTIAL_SLOT_PATTERN = /^[a-z][a-z0-9_]*$/;

export function validateCredentialSlot(slot: string, label = 'credential slot'): string {
	if (!CREDENTIAL_SLOT_PATTERN.test(slot)) {
		throw new Error(`${label} must use lowercase letters, numbers, and underscores and start with a letter.`);
	}
	return slot;
}

export function credentialEnvironmentName(slot: string): string {
	return `MOSAIC_${validateCredentialSlot(slot).toUpperCase()}_API_KEY`;
}

export function loadCredentials(slots: Iterable<string>, environment: NodeJS.ProcessEnv = process.env): Record<string, string> {
	return Object.fromEntries([...new Set(slots)].map((slot) => [
		slot,
		environment[credentialEnvironmentName(slot)]?.trim() ?? ''
	]));
}

export function credentialConfigured(credentials: Record<string, string>, slot: string): boolean {
	return Boolean(credentials[slot]?.trim());
}

export function requireCredential(credentials: Record<string, string>, slot: string): string {
	const value = credentials[slot]?.trim();
	if (!value) throw new Error(`${credentialEnvironmentName(slot)} is required on the server.`);
	return value;
}

/** One numbered environment pair binds one target; slot numbers do not set priority. */
export function bindNumberedTargetCredentials<T extends { id: string }>(
	kind: 'embedding' | 'generation',
	targets: T[],
	environment: NodeJS.ProcessEnv = process.env
): Array<T & { credentialSlot: string }> {
	const prefix = `MOSAIC_${kind.toUpperCase()}`;
	const label = kind === 'embedding' ? 'Embedding' : 'Generation';
	const targetBindingPattern = new RegExp(`^${prefix}_(\\d+)_TARGET$`);
	const bindingIndexes = new Set<number>();
	for (const name of Object.keys(environment)) {
		const match = targetBindingPattern.exec(name);
		if (!match) continue;
		const index = Number(match[1]);
		if (name !== `${prefix}_${index}_TARGET` || !Number.isSafeInteger(index) || index < 1) {
			throw new Error(`${label} target bindings must use canonical positive integer indexes.`);
		}
		bindingIndexes.add(index);
	}
	const slotsByTargetId = new Map<string, string>();
	for (const index of [...bindingIndexes].sort((left, right) => left - right)) {
		const variableName = `${prefix}_${index}_TARGET`;
		const targetId = environment[variableName]?.trim();
		if (!targetId) throw new Error(`${variableName} must be a non-empty string.`);
		if (slotsByTargetId.has(targetId)) {
			throw new Error(`${label} target bindings must not contain duplicate target ids: ${targetId}.`);
		}
		slotsByTargetId.set(targetId, `${kind}_${index}`);
	}
	return targets.map((target) => {
		const slot = slotsByTargetId.get(target.id);
		if (!slot) throw new Error(`Active ${kind} target must have a numbered credential binding: ${target.id}.`);
		return { ...target, credentialSlot: slot };
	});
}
