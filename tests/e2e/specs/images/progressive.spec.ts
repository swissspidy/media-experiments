import { expect, test } from '../../fixtures';

test.describe( 'Images', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllMedia(),
			requestUtils.resetPreferences(),
		] );
	} );

	test( `generates progressive (interlaced) images`, async ( {
		admin,
		page,
		editor,
		mediaUtils,
		browserName,
	} ) => {
		test.skip(
			browserName === 'webkit',
			'No cross-origin isolation in Playwright WebKit builds yet, see https://github.com/microsoft/playwright/issues/14043'
		);

		await admin.createNewPost();

		await page.evaluate( () => {
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'optimizeOnUpload',
					true
				);
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'png_outputFormat',
					'png'
				);
			window.wp.data
				.dispatch( 'core/preferences' )
				.set( 'media-experiments/preferences', 'png_interlaced', true );
			window.wp.data
				.dispatch( 'core/preferences' )
				.set( 'media-experiments/preferences', 'imageLibrary', 'vips' );
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'thumbnailGeneration',
					'client'
				);
		} );

		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator(
			'role=document[name="Block: Image"i]'
		);
		await expect( imageBlock ).toBeVisible();

		await mediaUtils.upload(
			imageBlock.locator( 'data-testid=form-file-upload-input' ),
			'github-mark.png'
		);

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0,
			undefined,
			{
				timeout: 30_000, // Transcoding might take longer
			}
		);

		const imageUrl = await page.evaluate(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.attributes?.url
		);

		const isProgressive = mediaUtils.isInterlacedPng(
			await mediaUtils.getImageBuffer( imageUrl )
		);

		expect( isProgressive ).toStrictEqual( true );
	} );
} );
