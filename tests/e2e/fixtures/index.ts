import { addCoverageReport } from 'monocart-reporter';

import { test as base } from '@wordpress/e2e-test-utils-playwright';

import { MediaUtils } from './mediaUtils';

type E2EFixture = {
	mediaUtils: MediaUtils;
};

export const test = base.extend< E2EFixture, {} >( {
	page: async ( { page, browserName }, use, testInfo ) => {
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
		await addCoverageReport( coverageList, test.info(), {
			lcov: true,
			toIstanbul: true,
		} );
	},
	mediaUtils: async ( { page }, use ) => {
		await use( new MediaUtils( { page } ) );
	},
} );

export { expect } from '@wordpress/e2e-test-utils-playwright';
