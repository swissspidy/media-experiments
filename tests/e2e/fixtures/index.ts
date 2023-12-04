import { mixinFixtures as mixinCoverage } from '@bgotink/playwright-coverage';

import { test as base } from '@wordpress/e2e-test-utils-playwright';

import { MediaUtils } from './mediaUtils';

type E2EFixture = {
	mediaUtils: MediaUtils;
};

export const test = mixinCoverage(
	base.extend< E2EFixture, {} >( {
		mediaUtils: async ( { page }, use ) => {
			await use( new MediaUtils( { page } ) );
		},
	} )
);

export { expect } from '@wordpress/e2e-test-utils-playwright';
