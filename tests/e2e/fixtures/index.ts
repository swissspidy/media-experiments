/**
 * External dependencies
 */
import { readFileSync, existsSync } from 'node:fs';

import { addCoverageReport } from 'monocart-reporter';
import type { V8CoverageEntry } from 'monocart-coverage-reports';
import type { Page } from '@playwright/test';

/**
 * WordPress dependencies
 */
import { test as base } from '@wordpress/e2e-test-utils-playwright';

/**
 * Internal dependencies
 */
import { MediaUtils } from './mediaUtils';

type E2EFixture = {
	mediaUtils: MediaUtils;
	secondPage: Page;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getSourceMapForEntry( entry: V8CoverageEntry, index?: number ) {
	if ( entry.sourceMap ) {
		return entry;
	}
	// read sourcemap for the my-dist.js manually
	if ( entry.url.includes( 'plugins/media-experiments/build/' ) ) {
		let filePath = entry.url;
		// Turn localhost-8889/wp-content/plugins/media-experiments/build/media-experiments.css?ver=e48ec3e84468941e9fc8 into build/media-experiments.css?ver=e48ec3e84468941e9fc8.
		const i = filePath.indexOf( 'build/' );
		if ( i >= 0 ) {
			filePath = filePath.slice( i );
		}

		// Turn build/media-experiments.css?ver=e48ec3e84468941e9fc8 into build/media-experiments.css.
		const j = filePath.indexOf( '?ver=' );
		if ( j >= 0 ) {
			filePath = filePath.substring( 0, j );
		}

		if ( ! existsSync( `${ filePath }.map` ) ) {
			return entry;
		}

		entry.sourceMap = JSON.parse(
			readFileSync( `${ filePath }.map` ).toString( 'utf-8' )
		);
	}

	return entry;
}

export const test = base.extend< E2EFixture, {} >( {
	page: async ( { page, browserName }, use ) => {
		if ( browserName !== 'chromium' || ! process.env.COLLECT_COVERAGE ) {
			return use( page );
		}

		await Promise.all( [
			page.coverage.startJSCoverage( {
				resetOnNavigation: false,
			} ),
			page.coverage.startCSSCoverage( {
				resetOnNavigation: false,
			} ),
		] );

		await use( page );

		const [ jsCoverage, cssCoverage ]: [
			V8CoverageEntry[],
			V8CoverageEntry[],
		] = await Promise.all( [
			page.coverage.stopJSCoverage(),
			page.coverage.stopCSSCoverage(),
		] );

		// Manually resolve the source map if it's missing.
		// See https://github.com/cenfun/monocart-coverage-reports#manually-resolve-the-sourcemap.
		jsCoverage.forEach( ( entry: V8CoverageEntry, index: number ) => {
			jsCoverage[ index ] = getSourceMapForEntry( entry );
		} );
		cssCoverage.forEach( ( entry: V8CoverageEntry, index: number ) => {
			cssCoverage[ index ] = getSourceMapForEntry( entry );
		} );

		const coverageList = [ ...jsCoverage, ...cssCoverage ];
		await addCoverageReport( coverageList, test.info() );
	},
	secondPage: async ( { browserName, browser }, use ) => {
		const context = await browser.newContext();
		const secondPage = await context.newPage();

		if ( browserName !== 'chromium' || ! process.env.COLLECT_COVERAGE ) {
			await use( secondPage );

			await context.close();

			return;
		}

		await Promise.all( [
			secondPage.coverage.startJSCoverage( {
				resetOnNavigation: false,
			} ),
			secondPage.coverage.startCSSCoverage( {
				resetOnNavigation: false,
			} ),
		] );

		await use( secondPage );

		const [ jsCoverage, cssCoverage ]: [
			V8CoverageEntry[],
			V8CoverageEntry[],
		] = await Promise.all( [
			secondPage.coverage.stopJSCoverage(),
			secondPage.coverage.stopCSSCoverage(),
		] );

		// Manually resolve the source map if it's missing.
		// See https://github.com/cenfun/monocart-coverage-reports#manually-resolve-the-sourcemap.
		jsCoverage.forEach( ( entry: V8CoverageEntry, index: number ) => {
			jsCoverage[ index ] = getSourceMapForEntry( entry );
		} );
		cssCoverage.forEach( ( entry: V8CoverageEntry, index: number ) => {
			cssCoverage[ index ] = getSourceMapForEntry( entry );
		} );

		const coverageList = [ ...jsCoverage, ...cssCoverage ];
		await addCoverageReport( coverageList, test.info() );

		await context.close();
	},
	mediaUtils: async ( { page }, use ) => {
		await use( new MediaUtils( { page } ) );
	},
} );

export { expect } from '@wordpress/e2e-test-utils-playwright';
