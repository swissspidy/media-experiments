import { expect, test } from '../../fixtures';

test.describe( 'Videos', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllMedia(),
			requestUtils.resetPreferences(),
		] );
	} );

	test( 'generate poster image', async ( {
		admin,
		editor,
		page,
		mediaUtils,
	} ) => {
		await admin.createNewPost();

		await editor.insertBlock( { name: 'core/video' } );

		const videoBlock = editor.canvas.locator(
			'role=document[name="Block: Video"i]'
		);
		await expect( videoBlock ).toBeVisible();

		await editor.selectBlocks( videoBlock );

		await editor.canvas
			.getByRole( 'button', { name: 'Media Library' } )
			.click();

		await page.getByRole( 'tab', { name: 'Upload files' } ).click();

		await mediaUtils.upload(
			page.locator( '.media-modal input[type=file]' ),
			'car-desert-600x338.webm'
		);

		await page
			.getByRole( 'button', { name: 'Select', exact: true } )
			.click();

		const settingsPanel = page
			.getByRole( 'region', {
				name: 'Editor settings',
			} )
			.getByRole( 'tabpanel', {
				name: 'Settings',
			} );

		await settingsPanel
			.getByRole( 'button', { name: 'Generate poster' } )
			.click();

		await expect( settingsPanel ).toHaveText( /Upload in progress/ );

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0,
			undefined,
			{
				timeout: 20000, // Transcoding might take longer
			}
		);

		const video = videoBlock.locator( 'video[src^="http"]' );
		const src = await video.getAttribute( 'src' );

		expect( src ).toMatch( /\/wp-content\/uploads\// );

		const blockAttributes = await page.evaluate(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.attributes ?? {}
		);
		await expect( blockAttributes.poster ).toMatch( /-poster\.jpeg$/ );
	} );
} );
