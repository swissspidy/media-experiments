import { addCoverageReport } from 'monocart-reporter';
import type { Page } from '@playwright/test';

import { test as base } from '@wordpress/e2e-test-utils-playwright';

import { MediaUtils } from './mediaUtils';

type E2EFixture = {
	mediaUtils: MediaUtils;
	secondPage: Page;
};

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

		const [ jsCoverage, cssCoverage ] = await Promise.all( [
			page.coverage.stopJSCoverage(),
			page.coverage.stopCSSCoverage(),
		] );
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

		const [ jsCoverage, cssCoverage ] = await Promise.all( [
			secondPage.coverage.stopJSCoverage(),
			secondPage.coverage.stopCSSCoverage(),
		] );
		const coverageList = [ ...jsCoverage, ...cssCoverage ];
		await addCoverageReport( coverageList, test.info() );

		await context.close();
	},
	mediaUtils: async ( { page }, use ) => {
		await use( new MediaUtils( { page } ) );
	},
} );

export { expect } from '@wordpress/e2e-test-utils-playwright';
