/**
 * External dependencies
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Internal dependencies
 */
import { expect, test } from '../../fixtures';

/*
 Not using simple strings because the browser might not recognize the mime type
 in the <input> causing file.type to be empty and thus failing the upload.
 See https://github.com/swissspidy/media-experiments/pull/657.
*/
const scenarios = [
	{
		name: 'HEIC',
		file: {
			name: 'hill-800x600.heic',
			mimeType: 'image/heic',
			buffer: readFileSync(
				join( __dirname, '..', '..', 'assets', 'hill-800x600.heic' )
			),
		},
	},
	{
		name: 'JPEG XL',
		file: {
			name: 'hill-800x600.jxl',
			mimeType: 'image/jxl',
			buffer: readFileSync(
				join( __dirname, '..', '..', 'assets', 'hill-800x600.jxl' )
			),
		},
	},
	{
		name: 'TIFF',
		file: {
			name: 'hill-800x600.tiff',
			mimeType: 'image/tiff',
			buffer: readFileSync(
				join( __dirname, '..', '..', 'assets', 'hill-800x600.tiff' )
			),
		},
	},
];

test.describe( 'Images', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllMedia(),
			requestUtils.resetPreferences(),
		] );
	} );

	for ( const { name, file } of scenarios ) {
		test( `uploads and converts a ${ name } image`, async ( {
			admin,
			page,
			editor,
			mediaUtils,
		} ) => {
			await admin.createNewPost();

			await page.evaluate( () => {
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
						'vips'
					);
				window.wp.data
					.dispatch( 'core/preferences' )
					.set(
						'media-experiments/preferences',
						'convertUnsafe',
						true
					);
			} );

			await editor.insertBlock( { name: 'core/image' } );

			const imageBlock = editor.canvas.locator(
				'role=document[name="Block: Image"i]'
			);
			await expect( imageBlock ).toBeVisible();

			await mediaUtils.upload(
				imageBlock.locator( 'data-testid=form-file-upload-input' ),
				file
			);

			await expect(
				page
					.getByRole( 'button', { name: 'Dismiss this notice' } )
					.filter( {
						hasText:
							/Sorry, you are not allowed to upload this file type/,
					} )
			).toBeHidden();

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
			await expect(
				settingsPanel.getByLabel( /#8[23456]7[678]7[567]/ )
			).toBeVisible();

			await expect( page.locator( 'css=[data-blurhash]' ) ).toBeVisible();
		} );
	}
} );
