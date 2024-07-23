import type { ImageFormat, ImageLibrary } from '@mexp/upload-media';

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

test.describe( 'Post Featured Image', () => {
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
					browserName === 'webkit' &&
						( imageLibrary === 'vips' || outputFormat === 'avif' ),
					'No cross-origin isolation in Playwright WebKit builds yet, see https://github.com/microsoft/playwright/issues/14043'
				);

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

				await editor.insertBlock( {
					name: 'core/post-featured-image',
				} );

				const siteLogoBlock = editor.canvas.locator(
					'role=document[name="Block: Featured Image"i]'
				);
				await expect( siteLogoBlock ).toBeVisible();

				await editor.selectBlocks( siteLogoBlock );

				await editor.canvas.getByLabel( 'Add a featured image' ).click();

				await page.getByRole( 'tab', { name: 'Upload files' } ).click();

				await mediaUtils.upload(
					page.locator( '.media-modal input[type=file]' ),
					'wordpress-logo-512x512.png'
				);

				await page
					.getByRole( 'button', { name: 'Select', exact: true } )
					.click();

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

				await page.evaluate(
					( [ fmt, lib ] ) => {
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
						timeout: 30000, // Transcoding might take longer
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
						timeout: 30000, // Transcoding might take longer
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
					settingsPanel.getByLabel( '#696969' )
				).toBeVisible();
				await expect(
					page.locator( 'css=[data-blurhash]' )
				).toBeVisible();
			} );
		}
	} );
} );
