import { resolve } from 'node:path';

import type { CoverageReportOptions } from 'monocart-coverage-reports';

import { defineConfig, devices } from '@playwright/test';

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
				reports: [ 'lcov' ],
				logging: 'off',
				coverage: {
					entryFilter: ( entry: any ) => {
						return (
							entry.url.startsWith( 'blob:' ) ||
							entry.url.includes(
								'plugins/media-experiments/build/'
							)
						);
					},
					sourcePath: ( sourcePath: string ) => {
						// Turn localhost-8889/wp-content/plugins/media-experiments/build/media-experiments.css/ver=e48ec3e84468941e9fc8 into build/media-experiments.css/ver=e48ec3e84468941e9fc8.
						const i = sourcePath.indexOf( 'build/' );
						if ( i >= 0 ) {
							sourcePath = sourcePath.slice( i );
						}

						// Turn build/media-experiments.css/ver=e48ec3e84468941e9fc8 into build/media-experiments.css.
						const j = sourcePath.indexOf( '/ver=' );
						if ( j >= 0 ) {
							sourcePath = sourcePath.substring( 0, j );
						}

						return sourcePath;
					},
					lcov: true,
				},
			},
		],
	].filter( Boolean ),
	projects: [
		{
			name: 'chromium',
			use: {
				...devices[ 'Desktop Chrome' ],
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
