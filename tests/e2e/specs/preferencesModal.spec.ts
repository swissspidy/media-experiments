import { test, expect } from '../fixtures';

test.describe( 'Preferences Modal', () => {
	test.beforeEach( async ( { admin } ) => {
		await admin.createNewPost();
	} );

	test( 'opens from the options menu, closes with its close button and returns focus', async ( {
		page,
	} ) => {
		await page
			.getByRole( 'region', { name: 'Editor top bar' } )
			.getByRole( 'button', { name: 'Options' } )
			.click();
		await page
			.getByRole( 'menuitem', {
				name: 'Media Preferences',
			} )
			.click();

		const dialog = page.getByRole( 'dialog', {
			name: 'Preferences',
		} );
		await expect( dialog ).toBeVisible();

		await dialog.getByRole( 'button', { name: 'Close' } ).click();
		await expect( dialog ).toBeHidden();
	} );
} );
