export const ASK_BODY_BYTES = 8 * 1024;
export const ASK_BODY_TIMEOUT_MS = 5_000;
const WINDOW_MS = 60_000;
const MAX_CLIENTS = 1024;

export class AskInputError extends Error {
	constructor(public readonly status: number, public readonly code: string) { super(code); }
}

/** Rolling windows and leases are local to one server process; no queued work. */
export function createAskProtection(now: () => number = Date.now) {
	const clients = new Map<string, { requests: number[]; active: number }>();
	let requests: number[] = [];
	let active = 0;
	return {
		acquire(address: string): { release: () => void } | { code: string; retryAfter: number } {
			const time = now();
			requests = requests.filter((timestamp) => timestamp > time - WINDOW_MS);
			for (const [key, client] of clients) {
				client.requests = client.requests.filter((timestamp) => timestamp > time - WINDOW_MS);
				if (!client.requests.length && !client.active) clients.delete(key);
			}
			const client = clients.get(address) ?? { requests: [], active: 0 };
			if (requests.length >= 30 || client.requests.length >= 10) {
				const oldest = requests.length >= 30 ? requests[0] : client.requests[0];
				return { code: 'ASK_RATE_LIMITED', retryAfter: Math.max(1, Math.ceil((oldest + WINDOW_MS - time) / 1000)) };
			}
			if (!clients.has(address) && clients.size >= MAX_CLIENTS) return { code: 'ASK_BUSY', retryAfter: 60 };
			clients.set(address, client);
			requests.push(time);
			client.requests.push(time);
			if (active >= 2 || client.active >= 1) return { code: 'ASK_BUSY', retryAfter: 5 };
			active++;
			client.active++;
			let released = false;
			return { release() {
				if (released) return;
				released = true;
				active--;
				client.active--;
			} };
		}
	};
}

export async function readAskBody(request: Request): Promise<unknown> {
	const length = request.headers.get('content-length');
	if (length && /^\d+$/.test(length) && Number(length) > ASK_BODY_BYTES) throw new AskInputError(413, 'REQUEST_TOO_LARGE');
	if (!request.body) throw new AskInputError(400, 'INVALID_QUESTION');
	const reader = request.body.getReader();
	let timer: ReturnType<typeof setTimeout>;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new AskInputError(408, 'REQUEST_TIMEOUT')), ASK_BODY_TIMEOUT_MS);
	});
	try {
		const chunks: Uint8Array[] = [];
		let size = 0;
		while (true) {
			const { done, value } = await Promise.race([reader.read(), timeout]);
			if (done) break;
			size += value.byteLength;
			if (size > ASK_BODY_BYTES) throw new AskInputError(413, 'REQUEST_TOO_LARGE');
			chunks.push(value);
		}
		const bytes = new Uint8Array(size);
		let offset = 0;
		for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
		return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
	} finally {
		clearTimeout(timer!);
		// adapter-node cancels raw bodies by destroying the request socket. Leave
		// rejected input unread; the route closes it after delivering its JSON error.
		reader.releaseLock();
	}
}
