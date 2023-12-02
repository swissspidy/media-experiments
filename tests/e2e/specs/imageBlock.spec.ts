import { test, expect } from '../fixtures';

test.describe( 'Image block', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllMedia();
	} );

	test.beforeEach( async ( { admin } ) => {
		await admin.createNewPost();
	} );

	test( 'uploads a file and allows optimizing it afterwards', async ( {
		page,
		editor,
		mediaUtils,
	} ) => {
		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator(
			'role=document[name="Block: Image"i]'
		);
		await expect( imageBlock ).toBeVisible();

		await mediaUtils.upload(
			imageBlock.locator( 'data-testid=form-file-upload-input' )
		);

		const settingsPanel = page
			.getByRole( 'region', {
				name: 'Editor settings',
			} )
			.getByRole( 'tabpanel', {
				name: 'Settings',
			} );

		await expect( settingsPanel ).toHaveText( /Mime type: image\/png/ );
		await expect( settingsPanel.getByLabel( '#696969' ) ).toBeVisible();

		await page.getByRole( 'button', { name: 'Optimize' } ).click();

		const dialog = page.getByRole( 'dialog', {
			name: 'Compare media quality',
		} );

		await expect( dialog ).toBeVisible();

		await dialog
			.getByRole( 'button', { name: 'Use optimized version' } )
			.click();

		await expect( settingsPanel ).toHaveText( /Mime type: image\/webp/ );
		await expect( settingsPanel.getByLabel( '#696969' ) ).toBeVisible();
	} );
} );
