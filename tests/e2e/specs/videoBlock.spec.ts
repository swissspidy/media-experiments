import { test, expect } from '../fixtures';

test.describe( 'Video block', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllMedia();
	} );

	test( 'uploads a file and allows optimizing it afterwards', async ( {
		admin,
		page,
		editor,
		mediaUtils,
	} ) => {
		await admin.createNewPost();

		await editor.insertBlock( { name: 'core/video' } );

		const videoBlock = editor.canvas.locator(
			'role=document[name="Block: Video"i]'
		);
		await expect( videoBlock ).toBeVisible();

		await mediaUtils.upload(
			videoBlock.locator( 'data-testid=form-file-upload-input' ),
			'car-desert-600x338.webm'
		);

		await expect(
			page
				.getByRole( 'button', { name: 'Dismiss this notice' } )
				.filter( {
					hasText: 'Sorry, this file type is not supported here',
				} )
		).not.toBeVisible();

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0,
			{
				timeout: 40000, // Video transcoding might take longer
			}
		);

		const settingsPanel = page
			.getByRole( 'region', {
				name: 'Editor settings',
			} )
			.getByRole( 'tabpanel', {
				name: 'Settings',
			} );

		// TODO: Check why mime type is not consistent.
		await expect( settingsPanel ).toHaveText(
			/Mime type: video\/(mp4|webm)/
		);
		await expect( settingsPanel.getByLabel( '#8b837e' ) ).toBeVisible();
		// No exact comparison as there can be 1-2 char differences between browsers.
		await expect( page.locator( 'css=[data-blurhash]' ) ).toHaveAttribute(
			'data-blurhash',
			/pbIRjj]\.8oLRkaz/
		);

		await expect(
			page.getByRole( 'button', { name: 'Remove audio channel' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'button', { name: 'Generate subtitles' } )
		).toBeVisible();
	} );
} );
