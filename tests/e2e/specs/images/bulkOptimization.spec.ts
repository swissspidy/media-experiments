import { test, expect } from '../../fixtures';

test.describe( 'Images', () => {
	test( 'Bulk Optimization', async ( {
		admin,
		page,
		editor,
		mediaUtils,
		browserName,
	} ) => {
		test.skip(
			browserName === 'webkit',
			'No cross-origin isolation in Playwright WebKit builds yet, see https://github.com/microsoft/playwright/issues/14043'
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
		const firstBlock = editor.canvas
			.locator( 'role=document[name="Block: Image"i]' )
			.nth( 0 );
		await expect( firstBlock ).toBeVisible();
		await mediaUtils.upload(
			firstBlock.locator( 'data-testid=form-file-upload-input' ),
			'wordpress-logo-512x512.png'
		);

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0
		);

		await editor.insertBlock( { name: 'core/image' } );
		const secondBlock = editor.canvas
			.locator( 'role=document[name="Block: Image"i]' )
			.nth( 1 );
		await expect( secondBlock ).toBeVisible();
		await mediaUtils.upload(
			secondBlock.locator( 'data-testid=form-file-upload-input' ),
			'github-mark.png'
		);

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0
		);

		await editor.openDocumentSettingsSidebar();

		await page
			.getByRole( 'region', { name: 'Editor settings' } )
			.getByLabel( 'Post' )
			.click();

		const mediaExperimentsPanel = page
			.getByRole( 'region', { name: 'Editor settings' } )
			.getByRole( 'button', {
				name: 'Media Experiments',
			} );
		const isClosed =
			( await mediaExperimentsPanel.getAttribute( 'aria-expanded' ) ) ===
			'false';
		if ( isClosed ) {
			await mediaExperimentsPanel.click();
		}

		await expect(
			page
				.getByRole( 'region', { name: 'Editor settings' } )
				.getByRole( 'listitem' )
		).toHaveCount( 4 ); // Sidebar tabs plus the 2 images.

		await page
			.getByRole( 'region', { name: 'Editor settings' } )
			.getByRole( 'button', { name: 'Optimize all' } )
			.click();

		await expect(
			page
				.getByRole( 'button', { name: 'Dismiss this notice' } )
				.filter( {
					hasText: 'There was an error optimizing the file',
				} )
		).not.toBeVisible();

		await page.waitForFunction(
			() =>
				window.wp.data
					.select( 'media-experiments/upload' )
					.isPendingApproval(),
			undefined,
			{
				timeout: 20000, // Transcoding might take longer
			}
		);

		await expect(
			page.getByRole( 'dialog', {
				name: 'Compare media quality',
			} )
		).toBeVisible();
		await page
			.getByRole( 'dialog', {
				name: 'Compare media quality',
			} )
			.getByRole( 'button', { name: 'Use optimized version' } )
			.click();

		await expect(
			page.getByRole( 'dialog', {
				name: 'Compare media quality',
			} )
		).toBeVisible();
		await page
			.getByRole( 'dialog', {
				name: 'Compare media quality',
			} )
			.getByRole( 'button', { name: 'Use optimized version' } )
			.click();

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0
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
					hasText: 'All files successfully optimized',
				} )
		).toBeVisible();
	} );
} );