import { test, expect } from '../fixtures';

test.describe( 'Media Recording', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllMedia();
	} );

	test( 'Video', async ( { admin, page, editor, browserName } ) => {
		// See https://github.com/microsoft/playwright/issues/2973
		test.skip(
			browserName !== 'chromium',
			'Currently fake streams are not supported in other browsers.'
		);

		await admin.createNewPost();

		await page.evaluate( () => {
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'jpeg_outputFormat',
					'jpeg'
				);
		} );

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
		).toBeHidden();

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

	test( 'Image', async ( { admin, page, editor, browserName } ) => {
		// See https://github.com/microsoft/playwright/issues/2973
		test.skip(
			browserName !== 'chromium',
			'Currently fake streams are not supported in other browsers.'
		);

		await admin.createNewPost();

		await page.evaluate( () => {
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'jpeg_outputFormat',
					'jpeg'
				);
		} );

		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator(
			'role=document[name="Block: Image"i]'
		);
		await expect( imageBlock ).toBeVisible();

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
		).toBeHidden();
		await expect(
			toolbar.getByRole( 'button', { name: 'Enable Background Blur' } )
		).toBeVisible();

		await toolbar.getByRole( 'button', { name: 'Capture Photo' } ).click();

		await expect(
			toolbar.getByRole( 'button', { name: 'Insert' } )
		).toBeVisible( {
			timeout: 10000, // Recording might take longer
		} );
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
		).toBeHidden();

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0
		);

		await expect( settingsPanel ).toHaveText( /Mime type: image\/jpeg/ );

		const blockAttributes = await page.evaluate(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.attributes ?? {}
		);
		await expect( blockAttributes.url ).toMatch( /\.jpeg$/ );
	} );

	test( 'Audio', async ( { admin, page, editor, browserName } ) => {
		// See https://github.com/microsoft/playwright/issues/2973
		test.skip(
			browserName !== 'chromium',
			'Currently fake streams are not supported in other browsers.'
		);

		await admin.createNewPost();

		await editor.insertBlock( { name: 'core/audio' } );

		const audioBlock = editor.canvas.locator(
			'role=document[name="Block: Audio"i]'
		);
		await expect( audioBlock ).toBeVisible();

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
		).toBeHidden();
		await expect(
			toolbar.getByRole( 'button', { name: 'Enable Background Blur' } )
		).toBeHidden();
		await expect(
			toolbar.getByRole( 'button', { name: 'Select Microphone' } )
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
		).toBeHidden();

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0
		);

		await expect( settingsPanel ).toHaveText( /Mime type: audio\/mpeg/ );

		const blockAttributes = await page.evaluate(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.attributes ?? {}
		);
		await expect( blockAttributes.src ).toMatch( /\.mp3$/ );
	} );
} );
