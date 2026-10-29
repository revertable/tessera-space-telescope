import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASK_BODY_BYTES, createAskProtection, readAskBody } from './ask-protection.js';

afterEach(() => vi.useRealTimers());

describe('ask admission and streaming body boundary', () => {
	it('uses a rolling window rather than allowing bursts across minute boundaries', () => {
		let now = 59_999;
		const protection = createAskProtection(() => now);
		for (let i = 0; i < 10; i++) {
			const lease = protection.acquire('same');
			expect('release' in lease).toBe(true);
			if ('release' in lease) lease.release();
		}
		now = 60_000;
		expect(protection.acquire('same')).toEqual({ code: 'ASK_RATE_LIMITED', retryAfter: 60 });
		now = 119_999;
		expect(protection.acquire('same')).toHaveProperty('release');
	});

	it('releases idempotently without opening extra concurrent slots', () => {
		const protection = createAskProtection();
		const lease = protection.acquire('first');
		if (!('release' in lease)) throw new Error('Expected admission');
		lease.release(); lease.release();
		expect(protection.acquire('second')).toHaveProperty('release');
		expect(protection.acquire('third')).toHaveProperty('release');
		expect(protection.acquire('fourth')).toHaveProperty('code', 'ASK_BUSY');
	});

	it('accepts exactly 8 KiB and rejects one additional byte in a chunked stream', async () => {
		const json = JSON.stringify({ question: 'valid' });
		const exact = json.padEnd(ASK_BODY_BYTES, ' ');
		expect(await readAskBody(new Request('http://localhost', { method: 'POST', body: exact }))).toEqual({ question: 'valid' });
		const cancel = vi.fn();
		const body = new ReadableStream<Uint8Array>({
			start(controller) { controller.enqueue(new TextEncoder().encode(exact)); controller.enqueue(new Uint8Array([32])); }, cancel
		});
		await expect(readAskBody(new Request('http://localhost', { method: 'POST', body, duplex: 'half' } as RequestInit))).rejects.toMatchObject({ status: 413 });
		expect(cancel).not.toHaveBeenCalled();
		expect(body.locked).toBe(false);
	});

	it('decodes multibyte questions split between stream chunks', async () => {
		const bytes = new TextEncoder().encode(JSON.stringify({ question: '질문' }));
		const body = new ReadableStream<Uint8Array>({ start(controller) {
			for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
			controller.close();
		} });
		expect(await readAskBody(new Request('http://localhost', { method: 'POST', body, duplex: 'half' } as RequestInit))).toEqual({ question: '질문' });
	});
});
