import { join, resolve } from 'node:path';

import type { CoverageReportOptions } from 'monocart-reporter';

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
				logging: 'off',
				foo: 'bar',
				coverage: {
					entryFilter: ( entry: any ) => {
						return (
							entry.url.startsWith( 'blob:' ) ||
							entry.url.includes(
								'media-experiments/build/media-experiments.js'
							)
						);
					},
					sourcePath: ( sourcePath: string ) => {
						return sourcePath.replace( 'media-experiments/', '' );
					},
					toIstanbul: true,
					lcov: true,
				},
			},
		],
	].filter( Boolean ),
	projects: [
		{
			name: 'chromium',
			use: { ...devices[ 'Desktop Chrome' ] },
			grepInvert: /-chromium/,
		},
		{
			name: 'webkit',
			use: { ...devices[ 'Desktop Safari' ] },
			grep: /@webkit/,
			grepInvert: /-webkit/,
		},
		{
			name: 'firefox',
			use: { ...devices[ 'Desktop Firefox' ] },
			grep: /@firefox/,
			grepInvert: /-firefox/,
		},
	],
} );

export default config;
