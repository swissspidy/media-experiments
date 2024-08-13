import { RestAttachment } from '@mexp/media-utils';

import { expect, test } from '../fixtures';

test.describe( 'PDF', () => {
	test.skip(
		( { browserName } ) => browserName === 'webkit',
		'Needs some investigation as to why the generated thumbnail is much bigger in WebKit'
	);

	test.beforeAll( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllMedia(),
			requestUtils.resetPreferences(),
		] );
	} );

	test( 'Thumbnail generation', async ( {
		admin,
		page,
		editor,
		mediaUtils,
		requestUtils,
	} ) => {
		await admin.createNewPost();

		await page.evaluate( () => {
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'jpeg_outputFormat',
					'jpeg'
				);
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'default_outputFormat',
					'jpeg'
				);
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'imageLibrary',
					'browser'
				);
		} );

		await editor.insertBlock( { name: 'core/file' } );

		const fileBlock = editor.canvas.locator(
			'role=document[name="Block: File"i]'
		);
		await expect( fileBlock ).toBeVisible();

		await mediaUtils.upload(
			fileBlock.locator( 'data-testid=form-file-upload-input' ),
			'wordpress-gsoc-flyer.pdf'
		);

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0,
			undefined,
			{
				timeout: 20000, // Transcoding might take longer
			}
		);

		const fileId = await page.evaluate(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.attributes?.id
		);

		const media: RestAttachment = await requestUtils.rest( {
			method: 'GET',
			path: `/wp/v2/media/${ fileId }`,
		} );

		// TODO: Test other sizes too.
		expect( media.media_details.sizes ).toHaveProperty( 'full' );

		// @ts-ignore
		expect( media.media_details.sizes.full.source_url ).toMatch(
			/-pdf.jpeg$/
		);

		expect(
			await mediaUtils.getImageBuffer(
				// @ts-ignore
				media.media_details.sizes.full.source_url
			)
		).toMatchSnapshot( 'pdf-thumbnail-generation.jpeg', {
			maxDiffPixelRatio: 0.05,
		} );
	} );
} );
