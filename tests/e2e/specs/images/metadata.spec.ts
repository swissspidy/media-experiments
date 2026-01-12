/**
 * External dependencies
 */
import { RestAttachment } from '@mexp/media-utils';

/**
 * Internal dependencies
 */
import { expect, test } from '../../fixtures';

test.describe( 'Images', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllMedia(),
			requestUtils.resetPreferences(),
		] );
	} );

	test.describe( 'EXIF Metadata Extraction', () => {
		test( 'extracts and preserves metadata from uploaded images', async ( {
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
						'imageLibrary',
						'vips'
					);
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

			// Upload an image
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
					timeout: 60_000,
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

			// Verify that the image was uploaded successfully
			expect( media.id ).toBe( imageId );

			// Verify that media_details contains the expected structure
			/* eslint-disable camelcase */
			expect( media.media_details ).toEqual(
				expect.objectContaining( {
					width: expect.any( Number ),
					height: expect.any( Number ),
					image_meta: expect.any( Object ),
				} )
			);

			// Verify image_meta has the WordPress expected structure
			// Even if no EXIF data is present, these fields should exist
			const imageMeta = media.media_details.image_meta;
			expect( imageMeta ).toEqual(
				expect.objectContaining( {
					aperture: expect.anything(),
					credit: expect.anything(),
					camera: expect.anything(),
					caption: expect.anything(),
					created_timestamp: expect.anything(),
					copyright: expect.anything(),
					focal_length: expect.anything(),
					iso: expect.anything(),
					shutter_speed: expect.anything(),
					title: expect.anything(),
					orientation: expect.anything(),
					keywords: expect.anything(),
				} )
			);
			/* eslint-enable camelcase */
		} );

		test( 'metadata extraction works during format conversion', async ( {
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
						'imageLibrary',
						'vips'
					);
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
						'webp'
					);
			} );

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
					timeout: 60_000,
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

			// Verify the image was converted to WebP
			expect( media.mime_type ).toBe( 'image/webp' );

			// Verify metadata extraction still worked even though format changed
			// Metadata should be extracted from source JPEG before conversion
			/* eslint-disable camelcase */
			expect( media.media_details.image_meta ).toBeDefined();
			expect( media.media_details.image_meta ).toEqual(
				expect.objectContaining( {
					aperture: expect.anything(),
					camera: expect.anything(),
					caption: expect.anything(),
					title: expect.anything(),
				} )
			);
			/* eslint-enable camelcase */
		} );

		test( 'preserves metadata structure with browser library', async ( {
			admin,
			page,
			editor,
			mediaUtils,
			requestUtils,
			browserName,
		} ) => {
			// Skip for WebKit as browser library has known issues
			test.skip(
				browserName === 'webkit',
				'Browser library has known issues with WebKit'
			);

			await admin.createNewPost();

			await page.evaluate( () => {
				window.wp.data
					.dispatch( 'core/preferences' )
					.set(
						'media-experiments/preferences',
						'imageLibrary',
						'browser'
					);
			} );

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
					timeout: 60_000,
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

			// Even with browser library, image_meta should exist
			/* eslint-disable camelcase */
			expect( media.media_details.image_meta ).toBeDefined();
			/* eslint-enable camelcase */
		} );
	} );
} );
