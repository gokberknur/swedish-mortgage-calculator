import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// The no-flash theme script in app.html runs inline, so the CSP allows it by hash.
// Computed from app.html, so editing the script keeps the hash in step.
const appHtml = readFileSync(new URL('./src/app.html', import.meta.url), 'utf8');
const themeScript = appHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (themeScript === undefined)
	throw new Error('svelte.config.js: no inline <script> found in src/app.html');
const themeHash = `sha256-${createHash('sha256').update(themeScript).digest('base64')}`;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ strict: true }),
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				'script-src': ['self', themeHash],
				// The design system's web components and `vite dev` set inline styles.
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:'],
				'font-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['none'],
				'form-action': ['self']
			}
		}
	}
};

export default config;
