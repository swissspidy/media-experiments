import {
	ImageFormat,
	ImageLibrary,
	RestAttachment,
	ThumbnailGeneration,
} from '@mexp/upload-media';

import { test, expect } from '../../fixtures';

const scenarios: {
	imageLibrary: ImageLibrary;
	thumbnailGeneration: ThumbnailGeneration;
}[] = [
	// imageLibrary doesn't matter when thumbnailGeneration === 'server'
	{
		imageLibrary: 'browser',
		thumbnailGeneration: 'server',
	},
	{
		imageLibrary: 'browser',
		thumbnailGeneration: 'client',
	},
	// Same behavior as browser & client, just added for completeness.
	{
		imageLibrary: 'browser',
		thumbnailGeneration: 'smart',
	},
	{
		imageLibrary: 'vips',
		thumbnailGeneration: 'client',
	},
	{
		imageLibrary: 'vips',
		thumbnailGeneration: 'smart',
	},
];

test.describe( 'Images', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllMedia();
	} );

	test.describe( 'Thumbnail generation', () => {
		for ( const { imageLibrary, thumbnailGeneration } of scenarios ) {
			test( `uses ${ imageLibrary } and ${ thumbnailGeneration } mode to generate thumbnails`, async ( {
				admin,
				page,
				editor,
				mediaUtils,
				requestUtils,
				browserName,
			} ) => {
				test.skip(
					browserName === 'webkit',
					'No cross-origin isolation in Playwright WebKit builds yet, see https://github.com/microsoft/playwright/issues/14043'
				);

				await admin.createNewPost();

				await page.evaluate(
					( [ lib, mode ] ) => {
						window.wp.data
							.dispatch( 'core/preferences' )
							.set(
								'media-experiments/preferences',
								'optimizeOnUpload',
								false
							);
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
								'imageLibrary',
								lib
							);
						window.wp.data
							.dispatch( 'core/preferences' )
							.set(
								'media-experiments/preferences',
								'thumbnailGeneration',
								mode
							);
					},
					[ imageLibrary, thumbnailGeneration ]
				);

				await editor.insertBlock( { name: 'core/image' } );

				const imageBlock = editor.canvas.locator(
					'role=document[name="Block: Image"i]'
				);
				await expect( imageBlock ).toBeVisible();

				await mediaUtils.upload(
					imageBlock.locator( 'data-testid=form-file-upload-input' ),
					'tree-on-water-1200x800.jpeg'
				);

				await page.waitForFunction(
					() =>
						window.wp.data
							.select( 'media-experiments/upload' )
							.getItems().length === 0,
					undefined,
					{
						timeout: 20000, // Transcoding might take longer
					}
				);

				const imageId = await page.evaluate(
					() =>
						window.wp.data
							.select( 'core/block-editor' )
							.getSelectedBlock()?.attributes?.id
				);

				const media: RestAttachment = await requestUtils.rest( {
					method: 'GET',
					path: `/wp/v2/media/${ imageId }`,
				} );

				expect( media.media_details.sizes ).toHaveProperty(
					'thumbnail'
				);
				expect( media.media_details.sizes ).toHaveProperty( 'medium' );
				expect( media.media_details.sizes ).toHaveProperty(
					'medium_large'
				);
				expect( media.media_details.sizes ).toHaveProperty( 'large' );
				expect( media.media_details.sizes ).toHaveProperty( 'full' );

				expect(
					await mediaUtils.getImageBuffer(
						// @ts-ignore
						media.media_details.sizes.thumbnail.source_url
					)
				).toMatchSnapshot(
					`thumbnail-generation-${ imageLibrary }-${ thumbnailGeneration }.jpeg`
				);
			} );
		}
	} );
} );
