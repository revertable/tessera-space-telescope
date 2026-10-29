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
