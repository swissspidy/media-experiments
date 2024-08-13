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
		outputFormat: 'jpeg',
		imageLibrary: 'vips',
		expectedMimeType: 'image/jpeg',
	},
];

test.describe( 'Post Featured Image', () => {
	test.describe( 'Block', () => {
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
					// TODO: Investigate.
					test.skip(
						browserName === 'webkit' && imageLibrary === 'browser',
						'Works locally but is flaky on CI'
					);

					await admin.createNewPost();

					await editor.insertBlock( {
						name: 'core/post-featured-image',
					} );

					const featuredImageBlock = editor.canvas.locator(
						'role=document[name="Block: Featured Image"i]'
					);
					await expect( featuredImageBlock ).toBeVisible();

					await editor.selectBlocks( featuredImageBlock );

					await editor.canvas
						.getByLabel( 'Add a featured image' )
						.click();

					await page
						.getByRole( 'tab', { name: 'Upload files' } )
						.click();

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
							.getByRole( 'button', {
								name: 'Dismiss this notice',
							} )
							.filter( {
								hasText:
									'There was an error optimizing the file',
							} )
					).toBeHidden();

					await page.waitForFunction(
						() =>
							window.wp.data
								.select( 'media-experiments/upload' )
								.isPendingApproval(),
						undefined,
						{
							timeout: 100_000, // Transcoding might take longer
						}
					);

					const dialog = page.getByRole( 'dialog', {
						name: 'Compare media quality',
					} );

					await expect( dialog ).toBeVisible();

					await dialog
						.getByRole( 'button', {
							name: 'Use optimized version',
						} )
						.click();

					await page.waitForFunction(
						() =>
							window.wp.data
								.select( 'media-experiments/upload' )
								.getItems().length === 0,
						undefined,
						{
							timeout: 60_000, // Transcoding might take longer
						}
					);

					await expect(
						page
							.getByRole( 'button', {
								name: 'Dismiss this notice',
							} )
							.filter( {
								hasText:
									'There was an error optimizing the file',
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
	} );

	test.describe( 'Document panel', () => {
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
					// TODO: Investigate.
					test.skip(
						browserName === 'webkit' && imageLibrary === 'browser',
						'Works locally but is flaky on CI'
					);

					await admin.createNewPost();

					await editor.openDocumentSettingsSidebar();

					await page
						.getByRole( 'button', { name: 'Set featured image' } )
						.click();

					await page
						.getByRole( 'tab', { name: 'Upload files' } )
						.click();

					await mediaUtils.upload(
						page.locator( '.media-modal input[type=file]' ),
						'wordpress-logo-512x512.png'
					);

					await page
						.getByRole( 'button', {
							name: 'Set featured image',
							exact: true,
						} )
						.click();

					await page.getByRole( 'tab', { name: 'Post' } ).click();

					const mediaExperimentsPanel = page
						.getByRole( 'region', { name: 'Editor settings' } )
						.getByRole( 'button', {
							name: 'Media Experiments',
						} );

					const isClosed =
						( await mediaExperimentsPanel.getAttribute(
							'aria-expanded'
						) ) === 'false';

					// eslint-disable-next-line playwright/no-conditional-in-test
					if ( isClosed ) {
						await mediaExperimentsPanel.click();
					}

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
							.getByRole( 'button', {
								name: 'Dismiss this notice',
							} )
							.filter( {
								hasText:
									'There was an error optimizing the file',
							} )
					).toBeHidden();

					await page.waitForFunction(
						() =>
							window.wp.data
								.select( 'media-experiments/upload' )
								.isPendingApproval(),
						undefined,
						{
							timeout: 100_000, // Transcoding might take longer
						}
					);

					const dialog = page.getByRole( 'dialog', {
						name: 'Compare media quality',
					} );

					await expect( dialog ).toBeVisible();

					await dialog
						.getByRole( 'button', {
							name: 'Use optimized version',
						} )
						.click();

					await page.waitForFunction(
						() =>
							window.wp.data
								.select( 'media-experiments/upload' )
								.getItems().length === 0,
						undefined,
						{
							timeout: 60_000, // Transcoding might take longer
						}
					);

					await expect(
						page
							.getByRole( 'button', {
								name: 'Dismiss this notice',
							} )
							.filter( {
								hasText:
									'There was an error optimizing the file',
							} )
					).toBeHidden();
				} );
			}
		} );
	} );
} );
