import { expect, test } from '../fixtures';

test.describe( 'Cross-Origin Isolation', () => {
	test( 'should be enabled by default', async ( {
		admin,
		page,
		browserName,
	} ) => {
		test.skip(
			browserName === 'webkit',
			'No cross-origin isolation in Playwright WebKit builds yet, see https://github.com/microsoft/playwright/issues/14043'
		);

		await admin.createNewPost();

		const crossOriginIsolated = await page.evaluate( () => {
			return Boolean( window.crossOriginIsolated );
		} );
		expect( crossOriginIsolated ).toBe( true );
	} );
} );
