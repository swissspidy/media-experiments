import { test, expect } from '../fixtures';

test.describe( 'Upload Requests', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllMedia();
	} );

	test( 'allows uploading media from other device', async ( {
		admin,
		page,
		editor,
		mediaUtils,
		browserName,
		browser,
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

		const context = await browser.newContext();
		const newPage = await context.newPage();
		await newPage.goto( copiedURL );

		await newPage.evaluate( () => {
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
			newPage.locator( 'data-testid=form-file-upload-input' ),
			'github-mark.png'
		);

		await newPage.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0,
			undefined,
			{
				timeout: 20000, // Transcoding might take longer
			}
		);

		await expect(
			newPage
				.getByRole( 'button', { name: 'Dismiss this notice' } )
				.filter( {
					hasText: 'File successfully uploaded',
				} )
		).toBeVisible();

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.attributes?.id
		);

		await context.close();
	} );
} );
