import { createServer, request as httpRequest, Agent, type Server, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { getRequest, setResponse } from '@sveltejs/kit/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as answering from '$lib/server/answering/answer';
import { loadConfig } from '$lib/server/config';
import { _createAskHandler } from './+server.js';

vi.mock('$lib/server/answering/answer', () => ({ answerQuestion: vi.fn() }));
vi.mock('$lib/server/config', () => ({ loadConfig: vi.fn(() => ({ credentials: {} })) }));

let server: Server;
let base: string;
let agent: Agent;

beforeEach(async () => {
	vi.clearAllMocks();
	vi.mocked(answering.answerQuestion).mockResolvedValue({ status: 'answered', answer: 'public answer', sources: [] });
	const handler = _createAskHandler();
	server = createServer(async (incoming, outgoing) => {
		try {
			const request = await getRequest({ request: incoming, base, bodySizeLimit: 512 * 1024 });
			await setResponse(outgoing, await handler({ request, getClientAddress: () => incoming.socket.remoteAddress! } as never));
		} catch (error) {
			outgoing.destroy(error as Error);
		}
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	agent = new Agent({ keepAlive: true, maxSockets: 1 });
});

afterEach(async () => {
	agent.destroy();
	server.closeAllConnections();
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

function post(body: string, { unfinished = false, headers = {} }: { unfinished?: boolean; headers?: IncomingHttpHeaders } = {}) {
	return new Promise<{ status: number; body: Record<string, unknown>; headers: IncomingHttpHeaders; complete: boolean; reusedSocket: boolean }>((resolve, reject) => {
		const client = httpRequest(base + '/api/ask', { method: 'POST', agent, headers: { 'Content-Type': 'application/json', ...headers } }, (response) => {
			let text = '';
			response.on('data', (chunk) => text += chunk);
			response.on('error', reject);
			response.on('end', () => {
				try {
					resolve({ status: response.statusCode!, body: JSON.parse(text), headers: response.headers, complete: response.complete, reusedSocket: client.reusedSocket });
				} catch (error) { reject(error); }
			});
		});
		client.on('error', reject);
		client.setTimeout(8_000, () => client.destroy(new Error('Socket regression request timed out.')));
		if (unfinished) client.write(body); else client.end(body);
	});
}

describe('/api/ask through actual Node sockets and adapter request/response streams', () => {
	it.each([false, true])('delivers 413 JSON for chunked excess (unfinished=%s), then releases the lease', async (unfinished) => {
		const response = await post('{"question":"xx"}'.padEnd(8193, ' '), { unfinished, headers: { 'Transfer-Encoding': 'chunked' } });
		expect(response).toMatchObject({ status: 413, complete: true, body: { code: 'REQUEST_TOO_LARGE' }, headers: { connection: 'close', 'cache-control': 'no-store' } });
		expect(answering.answerQuestion).not.toHaveBeenCalled();
		expect(loadConfig).not.toHaveBeenCalled();
		expect(await post('{"question":""}')).toMatchObject({ status: 400, body: { code: 'INVALID_QUESTION' } });
	});

	it('delivers 408 JSON at five seconds with the body still unfinished, then releases the lease', async () => {
		const started = Date.now();
		const response = await post('{"question":', { unfinished: true });
		expect(response).toMatchObject({ status: 408, complete: true, body: { code: 'REQUEST_TIMEOUT' }, headers: { connection: 'close', 'cache-control': 'no-store' } });
		expect(Date.now() - started).toBeGreaterThanOrEqual(5_000);
		expect(Date.now() - started).toBeLessThan(7_500);
		expect(answering.answerQuestion).not.toHaveBeenCalled();
		expect(loadConfig).not.toHaveBeenCalled();
		expect(await post('{"question":""}')).toMatchObject({ status: 400, body: { code: 'INVALID_QUESTION' } });
	}, 10_000);

	it('delivers 413 without waiting for a declared oversized body to finish', async () => {
		const response = await post('{', { unfinished: true, headers: { 'Content-Length': '9000' } });
		expect(response).toMatchObject({ status: 413, complete: true, body: { code: 'REQUEST_TOO_LARGE' }, headers: { connection: 'close' } });
		expect(answering.answerQuestion).not.toHaveBeenCalled();
	});

	it('accepts the exact byte boundary and preserves normal HTTP keep-alive', async () => {
		expect(await post('{"question":"xx"}'.padEnd(8192, ' '))).toMatchObject({ status: 200, complete: true, headers: { connection: 'keep-alive' } });
		expect(await post('{"question":"xx"}')).toMatchObject({ status: 200, complete: true, reusedSocket: true });
		expect(answering.answerQuestion).toHaveBeenCalledTimes(2);
	});
});
