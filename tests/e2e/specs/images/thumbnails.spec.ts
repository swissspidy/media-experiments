import {
	ImageFormat,
	ImageLibrary,
	RestAttachment,
	ThumbnailGeneration,
} from '@mexp/upload-media';

import { test, expect } from '../../fixtures';

const croppingScenarios: {
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
	{
		imageLibrary: 'vips',
		thumbnailGeneration: 'client',
	},
	{
		imageLibrary: 'vips',
		thumbnailGeneration: 'smart',
	},
];

const formatScenarios: {
	imageLibrary: ImageLibrary;
	outputFormat: ImageFormat;
	expectedMimeType: string;
}[] = [
	{
		imageLibrary: 'browser',
		outputFormat: 'jpeg',
		expectedMimeType: 'image/jpeg',
	},
	{
		imageLibrary: 'browser',
		outputFormat: 'webp',
		expectedMimeType: 'image/webp',
	},
	{
		imageLibrary: 'browser',
		outputFormat: 'png',
		expectedMimeType: 'image/png',
	},
	{
		imageLibrary: 'browser',
		outputFormat: 'avif',
		expectedMimeType: 'image/avif',
	},
	{
		imageLibrary: 'vips',
		outputFormat: 'jpeg',
		expectedMimeType: 'image/jpeg',
	},
	{
		imageLibrary: 'vips',
		outputFormat: 'webp',
		expectedMimeType: 'image/webp',
	},
	{
		imageLibrary: 'vips',
		outputFormat: 'png',
		expectedMimeType: 'image/png',
	},
	{
		imageLibrary: 'vips',
		outputFormat: 'avif',
		expectedMimeType: 'image/avif',
	},
];

const resizeScenarios: {
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
		await requestUtils.deleteAllMedia();
	} );

	test.describe( 'Thumbnail generation', () => {
		test.afterEach( async ( { requestUtils } ) => {
			await requestUtils.deleteAllMedia();
		} );

		for ( const {
			imageLibrary,
			thumbnailGeneration,
		} of croppingScenarios ) {
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
						window.wp.data
							.dispatch( 'core/preferences' )
							.set(
								'media-experiments/preferences',
								'bigImageSizeThreshold',
								1140
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
						timeout: 30000, // Transcoding might take longer
					}
				);

				const imageUrl = await page.evaluate(
					() =>
						window.wp.data
							.select( 'core/block-editor' )
							.getSelectedBlock()?.attributes?.url
				);

				// See https://github.com/swissspidy/media-experiments/issues/321.
				expect( imageUrl ).toMatch( /-1024x683\.jpeg$/ );

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
						width: 1140,
						height: 760,
						filesize: expect.any( Number ),
						// original_image: expect.any( String ),
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
							width: 1140,
							height: 760,
							mime_type: 'image/jpeg',
						} ),
					} )
				);
				/* eslint-enable camelcase */

				expect(
					await mediaUtils.getImageBuffer(
						// @ts-ignore
						media.media_details.sizes.thumbnail.source_url
					)
				).toMatchSnapshot(
					`thumbnail-generation-${ imageLibrary }-${ thumbnailGeneration }.jpeg`,
					{
						maxDiffPixelRatio: 0.05,
					}
				);

				expect(
					await mediaUtils.getImageBuffer(
						// @ts-ignore
						media.media_details.sizes[ 'bottom-right' ].source_url
					)
				).toMatchSnapshot(
					`thumbnail-bottom-right-${ imageLibrary }-${ thumbnailGeneration }.jpeg`,
					{
						maxDiffPixelRatio: 0.05,
					}
				);
				expect(
					await mediaUtils.getImageBuffer(
						// @ts-ignore
						media.media_details.sizes[ 'custom-size' ].source_url
					)
				).toMatchSnapshot(
					`thumbnail-custom-size-${ imageLibrary }-${ thumbnailGeneration }.jpeg`,
					{
						maxDiffPixelRatio: 0.05,
					}
				);
			} );
		}

		for ( const {
			imageLibrary,
			outputFormat,
			expectedMimeType,
		} of formatScenarios ) {
			test( `uses ${ outputFormat }@${ imageLibrary } to convert to ${ expectedMimeType }`, async ( {
				admin,
				page,
				editor,
				mediaUtils,
				browserName,
				requestUtils,
			} ) => {
				test.skip(
					browserName === 'webkit' &&
						( imageLibrary === 'vips' || outputFormat === 'avif' ),
					'No cross-origin isolation in Playwright WebKit builds yet, see https://github.com/microsoft/playwright/issues/14043'
				);

				test.skip(
					browserName === 'webkit' && outputFormat === 'webp',
					'WebKit does not currently support Canvas.toBlob with WebP'
				);

				await admin.createNewPost();

				await page.evaluate(
					( [ lib, fmt ] ) => {
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
								fmt
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
								'bigImageSizeThreshold',
								1140
							);
					},
					[ imageLibrary, outputFormat ]
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
						timeout: 30000, // Transcoding might take longer
					}
				);

				const imageUrl = await page.evaluate(
					() =>
						window.wp.data
							.select( 'core/block-editor' )
							.getSelectedBlock()?.attributes?.url
				);

				// See https://github.com/swissspidy/media-experiments/issues/321.
				expect( imageUrl ).toMatch(
					new RegExp( `-1024x683.${ outputFormat }\$` )
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

				/* eslint-disable camelcase */
				expect( media.media_details ).toEqual(
					expect.objectContaining( {
						width: 1140,
						height: 760,
						filesize: expect.any( Number ),
						blurhash: expect.any( String ),
						dominant_color: expect.any( String ),
						// TODO: Explicitly look for has_transparency: false
						// See https://github.com/swissspidy/media-experiments/issues/492
						has_transparency: expect.any( Boolean ),
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
							mime_type: expectedMimeType,
							file: expect.stringContaining(
								`-150x150.${ outputFormat }`
							),
							source_url: expect.stringContaining(
								`-150x150.${ outputFormat }`
							),
						} ),
						medium: expect.objectContaining( {
							width: 300,
							height: 200,
							filesize: expect.any( Number ),
							mime_type: expectedMimeType,
							file: expect.stringContaining(
								`-300x200.${ outputFormat }`
							),
							source_url: expect.stringContaining(
								`-300x200.${ outputFormat }`
							),
						} ),
						medium_large: expect.objectContaining( {
							width: 768,
							height: 512,
							filesize: expect.any( Number ),
							mime_type: expectedMimeType,
							file: expect.stringContaining(
								`-768x512.${ outputFormat }`
							),
							source_url: expect.stringContaining(
								`-768x512.${ outputFormat }`
							),
						} ),
						large: expect.objectContaining( {
							width: 1024,
							height: 683,
							filesize: expect.any( Number ),
							mime_type: expectedMimeType,
							file: expect.stringContaining(
								`-1024x683.${ outputFormat }`
							),
							source_url: expect.stringContaining(
								`-1024x683.${ outputFormat }`
							),
						} ),

						'bottom-right': expect.objectContaining( {
							width: 220,
							height: 220,
							filesize: expect.any( Number ),
							mime_type: expectedMimeType,
							file: expect.stringContaining(
								`-220x220.${ outputFormat }`
							),
							source_url: expect.stringContaining(
								`-220x220.${ outputFormat }`
							),
						} ),
						'custom-size': expect.objectContaining( {
							width: 100,
							height: 100,
							filesize: expect.any( Number ),
							mime_type: expectedMimeType,
							file: expect.stringContaining(
								`-100x100.${ outputFormat }`
							),
							source_url: expect.stringContaining(
								`-100x100.${ outputFormat }`
							),
						} ),
						'ninek-height': expect.objectContaining( {
							width: 400,
							height: 267,
							filesize: expect.any( Number ),
							mime_type: expectedMimeType,
							file: expect.stringContaining(
								`-400x267.${ outputFormat }`
							),
							source_url: expect.stringContaining(
								`-400x267.${ outputFormat }`
							),
						} ),

						'ninek-width': expect.objectContaining( {
							width: 900,
							height: 600,
							filesize: expect.any( Number ),
							mime_type: expectedMimeType,
							file: expect.stringContaining(
								`-900x600.${ outputFormat }`
							),
							source_url: expect.stringContaining(
								`-900x600.${ outputFormat }`
							),
						} ),
						full: expect.objectContaining( {
							width: 1140,
							height: 760,
							mime_type: expectedMimeType,
						} ),
					} )
				);
				/* eslint-enable camelcase */
			} );
		}

		for ( const { imageLibrary } of resizeScenarios ) {
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
						timeout: 20000, // Transcoding might take longer
					}
				);

				const imageUrl = await page.evaluate(
					() =>
						window.wp.data
							.select( 'core/block-editor' )
							.getSelectedBlock()?.attributes?.url
				);

				// See https://github.com/swissspidy/media-experiments/issues/321.
				expect( imageUrl ).toMatch( /-1024x683\.jpeg$/ );

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
