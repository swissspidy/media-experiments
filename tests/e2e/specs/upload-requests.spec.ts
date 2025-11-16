/**
 * Internal dependencies
 */
import { expect, test } from '../fixtures';

const scenarios = [
	{
		blockType: 'image',
		fileNames: [ 'github-mark.png' ],
	},
	{
		blockType: 'video',
		fileNames: [ 'car-desert-600x338.webm' ],
	},
	{
		blockType: 'audio',
		fileNames: [ 'garden-adventures.oga' ],
	},
	{
		blockType: 'gallery',
		fileNames: [ 'github-mark.png', 'wordpress-logo-512x512.png' ],
	},
	{
		blockType: 'cover',
		fileNames: [ 'github-mark.png' ],
	},
];

test.describe( 'Upload Requests', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllMedia(),
			requestUtils.resetPreferences(),
		] );
	} );

	for ( const { blockType, fileNames } of scenarios ) {
		test( `allows uploading media to the ${ blockType } block from other device`, async ( {
			admin,
			page,
			secondPage,
			editor,
			mediaUtils,
			browserName,
			request,
		} ) => {
			// TODO: Grab URL from input field instead of clipboard.
			test.skip(
				browserName === 'webkit',
				'Safari only allows reading from clipboard upon user interaction'
			);

			// TODO: Investigate.
			test.skip(
				browserName === 'firefox',
				'For some reason the modal is closed when the new page is opened, cancelling the upload request'
			);

			await admin.createNewPost();

			await editor.insertBlock( { name: `core/${ blockType }` } );

			const imageBlock = editor.canvas.locator(
				`role=document[name="Block: ${ blockType }"i]`
			);
			await expect( imageBlock ).toBeVisible();

			await page
				.getByRole( 'region', {
					name: 'Editor settings',
				} )
				.getByRole( 'tabpanel', {
					name: 'Settings',
				} )
				.getByRole( 'button', { name: 'Upload' } )
				.click();

			const dialog = page.getByRole( 'dialog', {
				name: 'Upload from device',
			} );
			await expect( dialog ).toBeVisible();

			await dialog
				.getByRole( 'button', { name: 'Copy to clipboard' } )
				.click();

			const copiedURL = await page.evaluate( () =>
				navigator.clipboard.readText()
			);

			await secondPage.goto( copiedURL );

			await secondPage.evaluate( () => {
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

			await mediaUtils.upload(
				secondPage.locator( 'data-testid=form-file-upload-input' ),
				...fileNames
			);

			await secondPage.waitForFunction(
				() =>
					window.wp.data
						.select( 'media-experiments/upload' )
						.getItems().length === 0,
				undefined,
				{
					timeout: 30_000,
				}
			);

			await expect(
				secondPage
					.getByRole( 'button', { name: 'Dismiss this notice' } )
					.filter( {
						hasText: 'Media successfully uploaded',
					} )
			).toBeVisible();

			// Simple verification that the upload request was successful.

			/* eslint-disable playwright/no-conditional-in-test */
			if ( 'gallery' === blockType ) {
				await page.waitForFunction(
					() =>
						window.wp.data
							.select( 'core/block-editor' )
							.getSelectedBlock()?.innerBlocks.length >= 1
				);
			} else if ( 'cover' === blockType ) {
				await page.waitForFunction(
					() =>
						window.wp.data
							.select( 'core/block-editor' )
							.getBlocks()?.[ 0 ].attributes?.id
				);
			} else {
				await page.waitForFunction(
					() =>
						window.wp.data
							.select( 'core/block-editor' )
							.getSelectedBlock()?.attributes?.id
				);
			}
			/* eslint-enable playwright/no-conditional-in-test */

			// Verifies that the upload request was properly deleted.
			const response = await request.head( secondPage.url() );
			expect( response.status() ).toBe( 404 );
		} );
	}
} );
