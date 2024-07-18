import { ImageLibrary, RestAttachment } from '@mexp/upload-media';

import { expect, test } from '../../fixtures';

const scenarios: {
	imageLibrary: ImageLibrary;
}[] = [
	{
		imageLibrary: 'browser',
	},
	{
		imageLibrary: 'vips',
	},
];

test.describe( 'Images', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllMedia(),
			requestUtils.resetPreferences(),
		] );
	} );

	test.describe( 'Big image size threshold', () => {
		for ( const { imageLibrary } of scenarios ) {
			test( `does not upscale when using ${ imageLibrary } library`, async ( {
				admin,
				page,
				editor,
				mediaUtils,
				browserName,
				requestUtils,
			} ) => {
				test.skip(
					browserName === 'webkit' && imageLibrary === 'vips',
					'No cross-origin isolation in Playwright WebKit builds yet, see https://github.com/microsoft/playwright/issues/14043'
				);

				await admin.createNewPost();

				await page.evaluate(
					( [ lib ] ) => {
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
								'client'
							);
						window.wp.data
							.dispatch( 'core/preferences' )
							.set(
								'media-experiments/preferences',
								'bigImageSizeThreshold',
								3000
							);
					},
					[ imageLibrary ]
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
						timeout: 30_000, // Transcoding might take longer
					}
				);

				const imageUrl = await page.evaluate(
					() =>
						window.wp.data
							.select( 'core/block-editor' )
							.getSelectedBlock()?.attributes?.url
				);

				// See https://github.com/swissspidy/media-experiments/issues/321.
				expect( imageUrl ).toMatch( /-1024x683/ );

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

				/* eslint-disable camelcase */
				expect( media.media_details ).toEqual(
					expect.objectContaining( {
						width: 1200,
						height: 800,
						filesize: expect.any( Number ),
						blurhash: expect.any( String ),
						dominant_color: expect.any( String ),
						has_transparency: false,
						image_meta: expect.anything(),
						sizes: expect.anything(),
					} )
				);
				expect( media.media_details.sizes ).toEqual(
					expect.objectContaining( {
						thumbnail: expect.objectContaining( {
							width: 150,
							height: 150,
							filesize: expect.any( Number ),
							mime_type: 'image/jpeg',
							file: expect.stringContaining( '-150x150.jpeg' ),
							source_url:
								expect.stringContaining( '-150x150.jpeg' ),
						} ),
						medium: expect.objectContaining( {
							width: 300,
							height: 200,
							filesize: expect.any( Number ),
							mime_type: 'image/jpeg',
							file: expect.stringContaining( '-300x200.jpeg' ),
							source_url:
								expect.stringContaining( '-300x200.jpeg' ),
						} ),
						medium_large: expect.objectContaining( {
							width: 768,
							height: 512,
							filesize: expect.any( Number ),
							mime_type: 'image/jpeg',
							file: expect.stringContaining( '-768x512.jpeg' ),
							source_url:
								expect.stringContaining( '-768x512.jpeg' ),
						} ),
						large: expect.objectContaining( {
							width: 1024,
							height: 683,
							filesize: expect.any( Number ),
							mime_type: 'image/jpeg',
							file: expect.stringContaining( '-1024x683.jpeg' ),
							source_url:
								expect.stringContaining( '-1024x683.jpeg' ),
						} ),
						'bottom-right': expect.objectContaining( {
							width: 220,
							height: 220,
							filesize: expect.any( Number ),
							mime_type: 'image/jpeg',
							file: expect.stringContaining( '-220x220.jpeg' ),
							source_url:
								expect.stringContaining( '-220x220.jpeg' ),
						} ),
						'custom-size': expect.objectContaining( {
							width: 100,
							height: 100,
							filesize: expect.any( Number ),
							mime_type: 'image/jpeg',
							file: expect.stringContaining( '-100x100.jpeg' ),
							source_url:
								expect.stringContaining( '-100x100.jpeg' ),
						} ),
						'ninek-height': expect.objectContaining( {
							width: 400,
							height: 267,
							filesize: expect.any( Number ),
							mime_type: 'image/jpeg',
							file: expect.stringContaining( '-400x267.jpeg' ),
							source_url:
								expect.stringContaining( '-400x267.jpeg' ),
						} ),
						'ninek-width': expect.objectContaining( {
							width: 900,
							height: 600,
							filesize: expect.any( Number ),
							mime_type: 'image/jpeg',
							file: expect.stringContaining( '-900x600.jpeg' ),
							source_url:
								expect.stringContaining( '-900x600.jpeg' ),
						} ),
						full: expect.objectContaining( {
							width: 1200,
							height: 800,
							mime_type: 'image/jpeg',
						} ),
					} )
				);
				/* eslint-enable camelcase */
			} );
		}
	} );
} );
