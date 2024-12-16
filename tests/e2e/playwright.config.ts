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
		process.env.COLLECT_COVERAGE === 'true' && [
			'monocart-reporter',
			/** @type {CoverageReportOptions} **/
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
			},
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
			use: { ...devices[ 'Desktop Safari' ] },
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
