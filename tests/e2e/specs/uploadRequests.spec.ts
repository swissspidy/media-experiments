import { test, expect } from '../fixtures';

test.describe( 'Upload Requests', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllMedia(),
			requestUtils.resetPreferences(),
		] );
	} );

	test( 'allows uploading media from other device', async ( {
		admin,
		page,
		secondPage,
		editor,
		mediaUtils,
		browserName,
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

		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator(
			'role=document[name="Block: Image"i]'
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
			'github-mark.png'
		);

		await secondPage.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0,
			undefined,
			{
				timeout: 20000, // Transcoding might take longer
			}
		);

		await expect(
			secondPage
				.getByRole( 'button', { name: 'Dismiss this notice' } )
				.filter( {
					hasText: 'File successfully uploaded',
				} )
		).toBeVisible();

		// Simple verification that the upload request was successful.

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.attributes?.id
		);

		// Verifies that the upload request was properly deleted.
		const response = await secondPage.reload();
		expect( response.status() ).toBe( 404 );
	} );
} );
