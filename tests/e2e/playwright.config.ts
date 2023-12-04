import { join, resolve } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import baseConfig from '@wordpress/scripts/config/playwright.config';

const config = defineConfig( {
	...baseConfig,
	reporter: [
		...baseConfig.reporter,
		process.env.COLLECT_COVERAGE === 'true' && [
			'@bgotink/playwright-coverage',
			/** @type {import('@bgotink/playwright-coverage').CoverageReporterOptions} */ {
				sourceRoot: process.cwd(),
				exclude: [
					'**/**.svg',
					'**/webpack/**',
					'**/external window**',
				],
				resultDir: join( process.cwd(), 'artifacts/e2e-coverage' ),
				rewritePath: ( { relativePath }: { relativePath: string } ) => {
					return resolve(
						process.cwd(),
						relativePath.replace( 'media-experiments/', './' )
					);
				},
				reports: [
					[ 'html' ],
					[
						'lcovonly',
						{
							file: 'coverage.lcov',
						},
					],
					[
						'text-summary',
						{
							file: null,
						},
					],
				],
				// See https://github.com/istanbuljs/nyc#high-and-low-watermarks
				// watermarks: {},
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
