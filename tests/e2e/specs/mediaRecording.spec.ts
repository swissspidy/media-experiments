import { test, expect } from '../fixtures';

test.describe( 'Media Recording', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllMedia();
	} );

	test( 'allows recording a video using the webcam', async ( {
		admin,
		page,
		editor,
		mediaUtils,
		browserName,
	} ) => {
		// See https://github.com/microsoft/playwright/issues/2973
		test.skip(
			browserName !== 'chromium',
			'Currently fake streams are not supported in other browsers.'
		);

		await admin.createNewPost();

		await editor.insertBlock( { name: 'core/video' } );

		const videoBlock = editor.canvas.locator(
			'role=document[name="Block: Video"i]'
		);
		await expect( videoBlock ).toBeVisible();

		const settingsPanel = page
			.getByRole( 'region', {
				name: 'Editor settings',
			} )
			.getByRole( 'tabpanel', {
				name: 'Settings',
			} );

		await settingsPanel.getByRole( 'button', { name: 'Start' } ).click();

		const toolbar = page.getByRole( 'toolbar', { name: 'Block tools' } );
		await expect(
			toolbar.getByRole( 'button', { name: 'Select Camera' } )
		).toBeVisible();
		await expect(
			toolbar.getByRole( 'button', { name: 'Select Microphone' } )
		).toBeVisible();
		await expect(
			toolbar.getByRole( 'button', { name: 'Enable Background Blur' } )
		).toBeVisible();

		await toolbar.getByRole( 'button', { name: 'Start' } ).click();

		await expect(
			toolbar.getByRole( 'button', { name: 'Stop' } )
		).toBeVisible();
		await expect(
			toolbar.getByRole( 'button', { name: 'Pause' } )
		).toBeVisible();

		await toolbar.getByRole( 'button', { name: 'Pause' } ).click();

		await expect(
			toolbar.getByRole( 'button', { name: 'Start' } )
		).toBeDisabled();
		await expect(
			toolbar.getByRole( 'button', { name: 'Resume' } )
		).toBeVisible();

		await toolbar.getByRole( 'button', { name: 'Resume' } ).click();

		await toolbar.getByRole( 'button', { name: 'Stop' } ).click();

		await expect(
			toolbar.getByRole( 'button', { name: 'Insert' } )
		).toBeVisible();
		await expect(
			toolbar.getByRole( 'button', { name: 'Retry' } )
		).toBeVisible();

		await toolbar.getByRole( 'button', { name: 'Insert' } ).click();

		await expect(
			page
				.getByRole( 'button', { name: 'Dismiss this notice' } )
				.filter( {
					hasText: 'Sorry, this file type is not supported here',
				} )
		).not.toBeVisible();

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0,
			undefined,
			{
				timeout: 40000, // Video transcoding might take longer
			}
		);

		await expect(
			settingsPanel.getByRole( 'button', {
				name: 'Remove audio channel',
			} )
		).toBeVisible();
		await expect(
			settingsPanel.getByRole( 'button', { name: 'Generate subtitles' } )
		).toBeVisible();

		await expect( settingsPanel ).toHaveText(
			/Mime type: video\/(mp4|webm)/
		);

		const blockAttributes = await page.evaluate(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.attributes ?? {}
		);
		await expect( blockAttributes.src ).toMatch( /\.mp4$/ );
		await expect( blockAttributes.poster ).toMatch( /-poster\.jpeg$/ );
	} );
} );
