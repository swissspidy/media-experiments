/**
 * External dependencies
 */
import { ImageFormat, ImageLibrary } from '@mexp/upload-media';
import { RestAttachment } from '@mexp/media-utils';

/**
 * Internal dependencies
 */
import { expect, test } from '../../fixtures';

const scenarios: {
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

test.describe( 'Images', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllMedia(),
			requestUtils.resetPreferences(),
		] );
	} );

	test.describe( 'Upload', () => {
		for ( const {
			imageLibrary,
			outputFormat,
			expectedMimeType,
		} of scenarios ) {
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

				test.skip(
					browserName === 'firefox' && outputFormat === 'avif',
					'AVIF encoding on Firefox is very slow'
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
								'thumbnailGeneration',
								'client'
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
						timeout: 100_000, // Transcoding might take longer, especially AVIF
					}
				);

				// See https://github.com/swissspidy/media-experiments/issues/321.
				await page.waitForFunction(
					() =>
						window.wp.data
							.select( 'core/block-editor' )
							.getSelectedBlock()
							?.attributes?.url.includes( '-1024x683' )
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
	} );
} );
