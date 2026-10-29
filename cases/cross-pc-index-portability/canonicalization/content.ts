/** Canonical Markdown content: normalize line endings only. */
export function canonicalSourceContent(content: string): string {
	return content.replace(/\r\n?/g, '\n');
}
