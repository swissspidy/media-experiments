/**
 * External dependencies
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * WordPress dependencies
 */
import type { RestAttachment } from '@mexp/media-utils';

/**
 * Internal dependencies
 */
import { expect, test } from '../../fixtures';

const heicFile = {
	name: 'hill-800x600.heic',
	mimeType: 'image/heic',
	buffer: readFileSync(
		join( __dirname, '..', '..', 'assets', 'hill-800x600.heic' )
	),
};

test.describe( 'Images', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllMedia(),
			requestUtils.resetPreferences(),
		] );
	} );

	test.describe( 'Server-side HEIC conversion', () => {
		test( 'uploads HEIC and lets server convert when supported', async ( {
			admin,
			page,
			editor,
			mediaUtils,
			requestUtils,
		} ) => {
			// Check if server supports HEIC
			const siteData = await requestUtils.rest( {
				method: 'GET',
				path: '/',
			} );

			// Skip test if server doesn't support HEIC
			test.skip(
				! siteData.supports_heic,
				'Server does not support HEIC conversion'
			);

			await admin.createNewPost();

			// Enable convertUnsafe to trigger HEIC conversion flow
			await page.evaluate( () => {
				window.wp.data
					.dispatch( 'core/preferences' )
					.set(
						'media-experiments/preferences',
						'convertUnsafe',
						true
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
						'imageLibrary',
						'vips'
					);
			} );

			await editor.insertBlock( { name: 'core/image' } );

			const imageBlock = editor.canvas.locator(
				'role=document[name="Block: Image"i]'
			);
			await expect( imageBlock ).toBeVisible();

			await mediaUtils.upload(
				imageBlock.locator( 'data-testid=form-file-upload-input' ),
				heicFile
			);

			// Wait for upload queue to be empty
			await page.waitForFunction(
				() =>
					window.wp.data
						.select( 'media-experiments/upload' )
						.getItems().length === 0,
				undefined,
				{
					timeout: 100_000,
				}
			);

			// Verify no upload errors
			await expect(
				page
					.getByRole( 'button', { name: 'Dismiss this notice' } )
					.filter( {
						hasText: 'File could not be uploaded',
					} )
			).toBeHidden();

			await expect(
				page
					.getByRole( 'button', { name: 'Dismiss this notice' } )
					.filter( {
						hasText:
							/Error while uploading file .* to the media library/,
					} )
			).toBeHidden();

			// Get the uploaded image ID
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

			// Verify the server converted HEIC to JPEG
			expect( media.mime_type ).toBe( 'image/jpeg' );

			// Verify metadata is present
			/* eslint-disable camelcase */
			expect( media.media_details ).toEqual(
				expect.objectContaining( {
					width: 800,
					height: 600,
					filesize: expect.any( Number ),
					blurhash: expect.any( String ),
					dominant_color: expect.any( String ),
				} )
			);

			// Verify client-side thumbnails were generated
			expect( media.media_details.sizes ).toEqual(
				expect.objectContaining( {
					thumbnail: expect.objectContaining( {
						width: 150,
						height: 150,
						filesize: expect.any( Number ),
						mime_type: 'image/jpeg',
					} ),
					medium: expect.objectContaining( {
						width: 300,
						height: 225,
						filesize: expect.any( Number ),
						mime_type: 'image/jpeg',
					} ),
				} )
			);
			/* eslint-enable camelcase */

			// Verify image is displayed in the editor
			const settingsPanel = page
				.getByRole( 'region', {
					name: 'Editor settings',
				} )
				.getByRole( 'tabpanel', {
					name: 'Settings',
				} );

			await expect( settingsPanel ).toHaveText(
				/Mime type: image\/jpeg/
			);

			// Verify blurhash is visible
			await expect( page.locator( 'css=[data-blurhash]' ) ).toBeVisible();
		} );

		test( 'falls back to client-side conversion when server does not support HEIC', async ( {
			admin,
			page,
			editor,
			mediaUtils,
			requestUtils,
		} ) => {
			// Check if server supports HEIC
			const siteData = await requestUtils.rest( {
				method: 'GET',
				path: '/',
			} );

			// Skip test if server DOES support HEIC (we want to test the fallback)
			test.skip(
				siteData.supports_heic,
				'Server supports HEIC - testing fallback scenario'
			);

			await admin.createNewPost();

			// Enable convertUnsafe to trigger HEIC conversion flow
			await page.evaluate( () => {
				window.wp.data
					.dispatch( 'core/preferences' )
					.set(
						'media-experiments/preferences',
						'convertUnsafe',
						true
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
						'imageLibrary',
						'vips'
					);
			} );

			await editor.insertBlock( { name: 'core/image' } );

			const imageBlock = editor.canvas.locator(
				'role=document[name="Block: Image"i]'
			);
			await expect( imageBlock ).toBeVisible();

			await mediaUtils.upload(
				imageBlock.locator( 'data-testid=form-file-upload-input' ),
				heicFile
			);

			// Wait for upload queue to be empty
			await page.waitForFunction(
				() =>
					window.wp.data
						.select( 'media-experiments/upload' )
						.getItems().length === 0,
				undefined,
				{
					timeout: 100_000,
				}
			);

			// Verify no upload errors
			await expect(
				page
					.getByRole( 'button', { name: 'Dismiss this notice' } )
					.filter( {
						hasText: 'File could not be uploaded',
					} )
			).toBeHidden();

			// Get the uploaded image ID
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

			// Verify the client converted HEIC to JPEG
			expect( media.mime_type ).toBe( 'image/jpeg' );

			// Verify metadata is present
			/* eslint-disable camelcase */
			expect( media.media_details ).toEqual(
				expect.objectContaining( {
					filesize: expect.any( Number ),
					blurhash: expect.any( String ),
					dominant_color: expect.any( String ),
				} )
			);
			/* eslint-enable camelcase */

			// Verify image is displayed in the editor
			const settingsPanel = page
				.getByRole( 'region', {
					name: 'Editor settings',
				} )
				.getByRole( 'tabpanel', {
					name: 'Settings',
				} );

			await expect( settingsPanel ).toHaveText(
				/Mime type: image\/jpeg/
			);
		} );
	} );
} );
