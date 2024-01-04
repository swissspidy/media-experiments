import { test, expect } from '../../fixtures';

test.describe( 'Videos', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllMedia();
	} );

	// Skipped because external video is served with incorrect audio/webm Content-Type.
	test.skip( 'should upload external video', async ( {
		admin,
		editor,
		page,
		browserName,
	} ) => {
		test.skip(
			browserName === 'webkit',
			'No cross-origin isolation in Playwright WebKit builds yet, see https://github.com/microsoft/playwright/issues/14043'
		);

		await admin.createNewPost();

		await editor.insertBlock( {
			name: 'core/video',
			attributes: {
				src: 'https://raw.githubusercontent.com/swissspidy/media-experiments/main/tests/e2e/assets/car-desert-600x338.webm',
			},
		} );

		const settingsPanel = page
			.getByRole( 'region', {
				name: 'Editor settings',
			} )
			.getByRole( 'tabpanel', {
				name: 'Settings',
			} );

		await settingsPanel.getByRole( 'button', { name: 'Import' } ).click();

		await expect( settingsPanel ).toHaveText( /Upload in progress/ );

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0,
			undefined,
			{
				timeout: 20000, // Transcoding might take longer
			}
		);

		const videoBlock = editor.canvas.locator(
			'role=document[name="Block: Video"i]'
		);
		const video = videoBlock.locator( 'video[src^="http"]' );
		const src = await video.getAttribute( 'src' );

		expect( src ).toMatch( /\/wp-content\/uploads\// );

		// TODO: Check why mime type is not consistent.
		await expect( settingsPanel ).toHaveText(
			/Mime type: video\/(mp4|webm)/
		);
		await expect( settingsPanel.getByLabel( '#8b837e' ) ).toBeVisible();
		// No exact comparison as there can be 1-2 char differences between browsers.
		await expect( page.locator( 'css=[data-blurhash]' ) ).toHaveAttribute(
			'data-blurhash',
			/8oLRkaz/
		);
	} );
} );
