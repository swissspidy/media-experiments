/**
 * Internal dependencies
 */
import { expect, test } from '../fixtures';

// TODO: Add test for embed previews.
test.describe( 'Cross-Origin Isolation', () => {
	test( 'should be enabled by default', async ( { admin, page } ) => {
		await admin.createNewPost();

		const crossOriginIsolated = await page.evaluate( () => {
			return Boolean( window.crossOriginIsolated );
		} );
		expect( crossOriginIsolated ).toBe( true );
	} );
} );
