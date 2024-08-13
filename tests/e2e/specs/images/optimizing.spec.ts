/**
 * External dependencies
 */
import type { ImageFormat, ImageLibrary } from '@mexp/upload-media';

/**
 * Internal dependencies
 */
import { expect, test } from '../../fixtures';

const scenarios: {
	outputFormat: ImageFormat;
	imageLibrary: ImageLibrary;
	expectedMimeType: string;
}[] = [
	{
		outputFormat: 'jpeg',
		imageLibrary: 'browser',
		expectedMimeType: 'image/jpeg',
	},
	{
		outputFormat: 'webp',
		imageLibrary: 'browser',
		expectedMimeType: 'image/webp',
	},
	{
		outputFormat: 'avif',
		imageLibrary: 'browser',
		expectedMimeType: 'image/avif',
	},
	{
		outputFormat: 'png',
		imageLibrary: 'browser',
		// Default image in tests is a png, so type should be unchanged.
		expectedMimeType: 'image/png',
	},
	{
		outputFormat: 'jpeg',
		imageLibrary: 'vips',
		expectedMimeType: 'image/jpeg',
	},
	{
		outputFormat: 'webp',
		imageLibrary: 'vips',
		expectedMimeType: 'image/webp',
	},
	{
		outputFormat: 'avif',
		imageLibrary: 'vips',
		expectedMimeType: 'image/avif',
	},
	{
		outputFormat: 'png',
		imageLibrary: 'vips',
		// Default image in tests is a png, so type should be unchanged.
		expectedMimeType: 'image/png',
	},
];

test.describe( 'Images', () => {
	test.describe( 'uploads a file and allows optimizing it afterwards', () => {
		for ( const {
			outputFormat,
			imageLibrary,
			expectedMimeType,
		} of scenarios ) {
			test( `uses ${ outputFormat }@${ imageLibrary } to convert to ${ expectedMimeType }`, async ( {
				admin,
				page,
				editor,
				mediaUtils,
				browserName,
			} ) => {
				test.skip(
					browserName === 'webkit' && outputFormat === 'webp',
					'WebKit does not currently support Canvas.toBlob with WebP'
				);

				// TODO: Investigate.
				test.skip(
					browserName === 'webkit' && imageLibrary === 'browser',
					'Works locally but is flaky on CI'
				);

				await admin.createNewPost();

				// Ensure the initially uploaded PNG is left untouched.
				await page.evaluate( () => {
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
							'png_outputFormat',
							'png'
						);
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
					'wordpress-logo-512x512.png'
				);

				await page.waitForFunction(
					() =>
						window.wp.data
							.select( 'media-experiments/upload' )
							.getItems().length === 0,
					undefined,
					{
						timeout: 30_000,
					}
				);

				const settingsPanel = page
					.getByRole( 'region', {
						name: 'Editor settings',
					} )
					.getByRole( 'tabpanel', {
						name: 'Settings',
					} );

				await expect( settingsPanel ).toHaveText(
					/Mime type: image\/png/
				);
				await expect(
					settingsPanel.getByLabel( /#69696[9a]/ )
				).toBeVisible();
				await expect(
					page.locator( 'css=[data-blurhash]' )
				).toBeVisible();

				await page.evaluate(
					( [ fmt, lib ] ) => {
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
								'requireApproval',
								true
							);
					},
					[ outputFormat, imageLibrary ]
				);

				await page
					.getByRole( 'region', { name: 'Editor settings' } )
					.getByRole( 'button', { name: 'Optimize' } )
					.click();

				await expect(
					page
						.getByRole( 'button', { name: 'Dismiss this notice' } )
						.filter( {
							hasText: 'There was an error optimizing the file',
						} )
				).toBeHidden();

				await page.waitForFunction(
					() =>
						window.wp.data
							.select( 'media-experiments/upload' )
							.isPendingApproval(),
					undefined,
					{
						timeout: 120_000,
					}
				);

				const dialog = page.getByRole( 'dialog', {
					name: 'Compare media quality',
				} );

				await expect( dialog ).toBeVisible();

				await dialog
					.getByRole( 'button', { name: 'Use optimized version' } )
					.click();

				await page.waitForFunction(
					() =>
						window.wp.data
							.select( 'media-experiments/upload' )
							.getItems().length === 0,
					undefined,
					{
						timeout: 120_000,
					}
				);

				await expect(
					page
						.getByRole( 'button', { name: 'Dismiss this notice' } )
						.filter( {
							hasText: 'There was an error optimizing the file',
						} )
				).toBeHidden();

				await expect( settingsPanel ).toHaveText(
					new RegExp( `Mime type: ${ expectedMimeType }` )
				);

				await expect(
					settingsPanel.getByLabel( /#69696[9a]/ )
				).toBeVisible();
				await expect(
					page.locator( 'css=[data-blurhash]' )
				).toBeVisible();
			} );
		}
	} );

	test( 'reject an optimization', async ( {
		admin,
		page,
		editor,
		mediaUtils,
		browserName,
	} ) => {
		// TODO: Investigate.
		test.skip(
			browserName === 'webkit',
			'Works locally but is flaky on CI'
		);

		await admin.createNewPost();

		// Ensure the initially uploaded PNG is left untouched.
		await page.evaluate( () => {
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
					'png_outputFormat',
					'png'
				);
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
			'wordpress-logo-512x512.png'
		);

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0
		);

		const settingsPanel = page
			.getByRole( 'region', {
				name: 'Editor settings',
			} )
			.getByRole( 'tabpanel', {
				name: 'Settings',
			} );

		await expect( settingsPanel ).toHaveText( /Mime type: image\/png/ );
		await expect( settingsPanel.getByLabel( /#69696[9a]/ ) ).toBeVisible();
		await expect( page.locator( 'css=[data-blurhash]' ) ).toBeVisible();

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
					'jpeg'
				);
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'imageLibrary',
					'browser'
				);
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'requireApproval',
					true
				);
		} );

		await page
			.getByRole( 'region', { name: 'Editor settings' } )
			.getByRole( 'button', { name: 'Optimize' } )
			.click();

		await expect(
			page
				.getByRole( 'button', { name: 'Dismiss this notice' } )
				.filter( {
					hasText: 'There was an error optimizing the file',
				} )
		).toBeHidden();

		await page.waitForFunction(
			() =>
				window.wp.data
					.select( 'media-experiments/upload' )
					.isPendingApproval(),
			undefined,
			{
				timeout: 120_000,
			}
		);

		const dialog = page.getByRole( 'dialog', {
			name: 'Compare media quality',
		} );

		await expect( dialog ).toBeVisible();

		await dialog.getByRole( 'button', { name: 'Cancel' } ).click();

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0,
			undefined,
			{
				timeout: 120_000,
			}
		);

		await expect(
			page
				.getByRole( 'button', { name: 'Dismiss this notice' } )
				.filter( {
					hasText: 'File upload was cancelled',
				} )
		).toBeVisible();

		await expect( settingsPanel ).toHaveText( /Mime type: image\/png/ );

		await expect(
			page
				.getByRole( 'region', { name: 'Editor settings' } )
				.getByRole( 'button', { name: 'Optimize' } )
		).toBeVisible();
	} );

	test.describe( 'optimizes a file on upload', () => {
		for ( const {
			outputFormat,
			imageLibrary,
			expectedMimeType,
		} of scenarios ) {
			test( `uses ${ outputFormat }@${ imageLibrary } to convert to ${ expectedMimeType }`, async ( {
				admin,
				page,
				editor,
				mediaUtils,
				browserName,
			} ) => {
				test.skip(
					browserName === 'webkit' && outputFormat === 'webp',
					'WebKit does not currently support Canvas.toBlob with WebP'
				);

				// TODO: Investigate.
				test.skip(
					browserName === 'webkit' && imageLibrary === 'browser',
					'Works locally but is flaky on CI'
				);

				await admin.createNewPost();

				await page.evaluate(
					( [ fmt, lib ] ) => {
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
								fmt
							);
						window.wp.data
							.dispatch( 'core/preferences' )
							.set(
								'media-experiments/preferences',
								'imageLibrary',
								lib
							);
					},
					[ outputFormat, imageLibrary ]
				);

				await editor.insertBlock( { name: 'core/image' } );

				const imageBlock = editor.canvas.locator(
					'role=document[name="Block: Image"i]'
				);
				await expect( imageBlock ).toBeVisible();

				await mediaUtils.upload(
					imageBlock.locator( 'data-testid=form-file-upload-input' ),
					'wordpress-logo-512x512.png'
				);

				await page.waitForFunction(
					() =>
						window.wp.data
							.select( 'media-experiments/upload' )
							.getItems().length === 0,
					undefined,
					{
						timeout: 120_000,
					}
				);

				const settingsPanel = page
					.getByRole( 'region', {
						name: 'Editor settings',
					} )
					.getByRole( 'tabpanel', {
						name: 'Settings',
					} );

				await expect( settingsPanel ).toHaveText(
					new RegExp( `Mime type: ${ expectedMimeType }` )
				);
				await expect(
					settingsPanel.getByLabel( /#69696[9a]/ )
				).toBeVisible();
				await expect(
					page.locator( 'css=[data-blurhash]' )
				).toBeVisible();
			} );
		}
	} );
} );
