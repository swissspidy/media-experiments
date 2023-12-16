import type { ImageFormat, ImageLibrary } from '@mexp/upload-media';

import { test, expect } from '../fixtures';

const scenarios: {
	imageFormat: ImageFormat;
	imageLibrary: ImageLibrary;
	expectedMimeType: string;
}[] = [
	{
		imageFormat: 'jpeg',
		imageLibrary: 'browser',
		expectedMimeType: 'image/jpeg',
	},
	{
		imageFormat: 'webp',
		imageLibrary: 'browser',
		expectedMimeType: 'image/webp',
	},
	// TODO: skip or test behavior separately, as it's not a supported scenario.
	{
		imageFormat: 'avif',
		imageLibrary: 'browser',
		expectedMimeType: 'image/avif',
	},
	{
		imageFormat: 'none',
		imageLibrary: 'browser',
		// Default image in tests is a png, so type should be unchanged.
		expectedMimeType: 'image/png',
	},
	{
		imageFormat: 'jpeg',
		imageLibrary: 'vips',
		expectedMimeType: 'image/jpeg',
	},
	{
		imageFormat: 'webp',
		imageLibrary: 'vips',
		expectedMimeType: 'image/webp',
	},
	{
		imageFormat: 'avif',
		imageLibrary: 'vips',
		expectedMimeType: 'image/avif',
	},
	{
		imageFormat: 'none',
		imageLibrary: 'vips',
		// Default image in tests is a png, so type should be unchanged.
		expectedMimeType: 'image/png',
	},
];

test.describe( 'Image block', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllMedia();
	} );

	test.describe( 'uploads a file and allows optimizing it afterwards', () => {
		for ( const {
			imageFormat,
			imageLibrary,
			expectedMimeType,
		} of scenarios ) {
			test( `uses ${ imageFormat }@${ imageLibrary } to convert to ${ expectedMimeType }`, async ( {
				admin,
				page,
				editor,
				mediaUtils,
				browserName,
			} ) => {
				test.skip(
					browserName === 'webkit' &&
						( imageLibrary === 'vips' || imageFormat === 'avif' ),
					'No cross-origin isolation in Playwright WebKit builds yet, see https://github.com/microsoft/playwright/issues/14043'
				);

				test.skip(
					browserName === 'webkit' && imageFormat === 'webp',
					'WebKit does not currently support Canvas.toBlob with WebP'
				);

				// TODO: Investigate.
				test.skip(
					browserName === 'webkit' && imageLibrary === 'browser',
					'Works locally but is flaky on CI'
				);

				await admin.createNewPost();

				await page.evaluate( () => {
					window.wp.data
						.dispatch( 'core/preferences' )
						.set(
							'media-experiments/preferences',
							'imageFormat',
							'none'
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
					imageBlock.locator( 'data-testid=form-file-upload-input' )
				);

				await page.waitForFunction(
					() =>
						window.wp.data
							.select( 'media-experiments/upload' )
							.getItems().length === 0
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
					settingsPanel.getByLabel( '#696969' )
				).toBeVisible();
				// No exact comparison as there can be 1-2 char differences between browsers.
				await expect(
					page.locator( 'css=[data-blurhash]' )
				).toHaveAttribute( 'data-blurhash', /xuj\[M\{WB00ay~qayM\{/ );

				await page.evaluate(
					( [ fmt, lib ] ) => {
						window.wp.data
							.dispatch( 'core/preferences' )
							.set(
								'media-experiments/preferences',
								'imageFormat',
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
					[ imageFormat, imageLibrary ]
				);

				await page.getByRole( 'button', { name: 'Optimize' } ).click();

				await expect(
					page
						.getByRole( 'button', { name: 'Dismiss this notice' } )
						.filter( {
							hasText: 'There was an error optimizing the file',
						} )
				).not.toBeVisible();

				await page.waitForFunction( () =>
					window.wp.data
						.select( 'media-experiments/upload' )
						.isPendingApproval()
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
							.getItems().length === 0
				);

				await expect(
					page
						.getByRole( 'button', { name: 'Dismiss this notice' } )
						.filter( {
							hasText: 'There was an error optimizing the file',
						} )
				).not.toBeVisible();

				await expect(
					page
						.getByRole( 'button', { name: 'Dismiss this notice' } )
						.filter( {
							hasText: 'File successfully optimized',
						} )
				).toBeVisible();

				await expect( settingsPanel ).toHaveText(
					new RegExp( `Mime type: ${ expectedMimeType }` )
				);

				await expect(
					settingsPanel.getByLabel( '#696969' )
				).toBeVisible();
				// No exact comparison as there can be 1-2 char differences between browsers.
				await expect(
					page.locator( 'css=[data-blurhash]' )
				).toHaveAttribute( 'data-blurhash', /xuj\[M\{WB00ay~qayM\{/ );
			} );
		}
	} );

	test.describe( 'optimizes a file on upload', () => {
		for ( const {
			imageFormat,
			imageLibrary,
			expectedMimeType,
		} of scenarios ) {
			test( `uses ${ imageFormat }@${ imageLibrary } to convert to ${ expectedMimeType }`, async ( {
				admin,
				page,
				editor,
				mediaUtils,
				browserName,
			} ) => {
				test.skip(
					browserName === 'webkit' &&
						( imageLibrary === 'vips' || imageFormat === 'avif' ),
					'No cross-origin isolation in Playwright WebKit builds yet, see https://github.com/microsoft/playwright/issues/14043'
				);

				test.skip(
					browserName === 'webkit' && imageFormat === 'webp',
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
								'imageFormat',
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
					[ imageFormat, imageLibrary ]
				);

				await editor.insertBlock( { name: 'core/image' } );

				const imageBlock = editor.canvas.locator(
					'role=document[name="Block: Image"i]'
				);
				await expect( imageBlock ).toBeVisible();

				await mediaUtils.upload(
					imageBlock.locator( 'data-testid=form-file-upload-input' )
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
					settingsPanel.getByLabel( '#696969' )
				).toBeVisible();
				// No exact comparison as there can be 1-2 char differences between browsers.
				await expect(
					page.locator( 'css=[data-blurhash]' )
				).toHaveAttribute( 'data-blurhash', /xuj\[M\{WB00ay~qayM\{/ );
			} );
		}
	} );

	test( 'uploads and converts an HEIC image', async ( {
		browserName,
		admin,
		page,
		editor,
		mediaUtils,
	} ) => {
		test.skip(
			browserName === 'webkit',
			'Needs some investigation as to why image is uploaded as PNG instead of JPEG'
		);

		await admin.createNewPost();

		await page.evaluate( () => {
			window.wp.data
				.dispatch( 'core/preferences' )
				.set( 'media-experiments/preferences', 'imageFormat', 'jpeg' );
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
			'hill-800x600.heic'
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

		await expect( settingsPanel ).toHaveText( /Mime type: image\/jpeg/ );
		await expect( settingsPanel.getByLabel( '#837776' ) ).toBeVisible();

		// No exact comparison as there can be 1-2 char differences between browsers.
		await expect( page.locator( 'css=[data-blurhash]' ) ).toHaveAttribute(
			'data-blurhash',
			/DIpODxF02WA_2f/
		);
	} );
} );
