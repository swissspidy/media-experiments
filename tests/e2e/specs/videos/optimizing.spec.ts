import { test, expect } from '../../fixtures';

test.describe( 'Videos', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllMedia();
	} );

	test( 'uploads a file and allows optimizing it afterwards', async ( {
		admin,
		page,
		editor,
		mediaUtils,
		browserName,
	} ) => {
		test.skip(
			browserName === 'webkit',
			'Needs some investigation as to why dominant color / blurhash is not working on CI'
		);

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
			undefined,
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
			/8oLRkaz/
		);

		const blockAttributes = await page.evaluate(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.attributes ?? {}
		);
		await expect( blockAttributes.src ).toMatch( /\.mp4$/ );
		await expect( blockAttributes.poster ).toMatch( /-poster\.jpeg$/ );

		await expect(
			page.getByRole( 'button', { name: 'Remove audio channel' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'button', { name: 'Generate subtitles' } )
		).toBeVisible();
	} );
} );
