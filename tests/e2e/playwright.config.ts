/**
 * External dependencies
 */
import { resolve } from 'node:path';

import type {
	CoverageReportOptions,
	V8CoverageEntry,
} from 'monocart-coverage-reports';
import { defineConfig, devices } from '@playwright/test';

/**
 * WordPress dependencies
 */
import baseConfig from '@wordpress/scripts/config/playwright.config';

const config = defineConfig( {
	...baseConfig,
	reporter: [
		...baseConfig.reporter,
		// In CI, @wordpress/scripts' base config uses only the `github`
		// reporter, which deliberately does not print worker stdout/stderr
		// to the job log (its `printsToStdio()` returns false) — so
		// `console.log`/page console/pageerror diagnostics never show up
		// there, they're silently captured for the (unreachable) HTML
		// report only. Add `list` alongside it so that output is actually
		// visible in the CI log.
		process.env.CI && [ 'list' ],
		process.env.COLLECT_COVERAGE === 'true' && [
			'monocart-reporter',
			{
				outputFile: './artifacts/e2e-coverage/report.html',
				coverage: {
					logging: 'debug',
					reports: [ [ 'codecov' ], [ 'v8' ], [ 'console-summary' ] ],
					entryFilter: ( entry: V8CoverageEntry ) => {
						return (
							entry.url.startsWith( 'blob:' ) ||
							entry.url.includes(
								'plugins/media-experiments/build/'
							)
						);
					},
					sourceFilter: ( sourcePath: string ) => {
						return (
							sourcePath.startsWith( 'packages/' ) &&
							! sourcePath.includes( 'node_modules/' ) && // dependencies.
							! sourcePath.includes( 'build/esm/' ) && // @shopify/web-worker.
							! sourcePath.includes( 'external-window' ) && // webpack externals.
							! sourcePath.includes( 'webpack/' ) && // webpack runtime.
							! sourcePath.includes( '.css/' ) && // css js chunks.
							! sourcePath.includes( 'test/' )
						);
					},
					sourcePath: ( filePath: string ) => {
						// Remove project folder.
						return filePath.replace( 'media-experiments/', '' );
					},
				},
			} as CoverageReportOptions,
		],
	].filter( Boolean ),
	projects: [
		{
			name: 'chromium',
			use: {
				...devices[ 'Desktop Chrome' ],
				channel: 'chromium',
				permissions: [ 'clipboard-read', 'camera', 'microphone' ],
				launchOptions: {
					args: [
						'--use-fake-ui-for-media-stream',
						'--use-fake-device-for-media-stream',
						'--use-file-for-fake-video-capture=' +
							resolve( __dirname, './assets/reindeer.mjpeg' ),
						'--use-file-for-fake-audio-capture=' +
							resolve(
								__dirname,
								'./assets/garden-adventures.wav'
							),
						'--enable-unsafe-webgpu',
					],
				},
			},
		},
		{
			name: 'webkit',
			// WebKit consistently takes longer than Chromium/Firefox to get
			// the block editor's canvas iframe interactive with this
			// plugin's bundle size, causing spurious timeouts on the
			// default 5s expect() / 10s actionTimeout in CI.
			expect: {
				timeout: 20_000,
			},
			use: {
				...devices[ 'Desktop Safari' ],
				actionTimeout: 20_000,
				navigationTimeout: 30_000,
			},
		},
		{
			name: 'firefox',
			use: {
				...devices[ 'Desktop Firefox' ],
				launchOptions: {
					firefoxUserPrefs: {
						'dom.events.asyncClipboard.readText': true,
						'dom.events.testing.asyncClipboard': true,
					},
				},
			},
		},
	],
} );

export default config;
