import { test, expect } from '../fixtures';

test.describe( 'Animated GIFs', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllMedia();
	} );

	test( 'converts GIFs to looping videos', async ( {
		admin,
		page,
		editor,
		mediaUtils,
	} ) => {
		await admin.createNewPost();

		await page.evaluate( () => {
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'imageFormat',
					'jpeg-browser'
				);
		} );

		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator(
			'role=document[name="Block: Image"i]'
		);
		await expect( imageBlock ).toBeVisible();

		await mediaUtils.upload(
			imageBlock.locator( 'data-testid=form-file-upload-input' ),
			'nyancat-256x256.gif'
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

		// Wait for AnimatedGifConverter switching the block type.
		await page.waitForFunction(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.name === 'core/video'
		);

		await expect( settingsPanel ).toHaveText( /Mime type: video\/mp4/ );

		await expect(
			page.getByRole( 'region', {
				name: 'Editor settings',
			} )
		).toHaveText(
			/Embed a GIF from your media library or upload a new one/
		);

		await expect(
			page.getByRole( 'checkbox', { name: 'Autoplay' } )
		).toBeChecked();
		await expect(
			page.getByRole( 'checkbox', { name: 'Loop' } )
		).toBeChecked();
		await expect(
			page.getByRole( 'checkbox', { name: 'Muted' } )
		).toBeChecked();
		await expect(
			page.getByRole( 'checkbox', { name: 'Play inline' } )
		).toBeChecked();

		const blockAttributes = await page.evaluate(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.attributes ?? {}
		);
		await expect( blockAttributes.src ).toHaveText( /\.mp4$/ );
		await expect( blockAttributes.poster ).toHaveText(
			/-poster\.webp$/ // TODO: Format should be based on preference.
		);

		await expect( settingsPanel.getByLabel( '#796e94' ) ).toBeVisible();

		// No exact comparison as there can be 1-2 char differences between browsers.
		await expect( page.locator( 'css=[data-blurhash]' ) ).toHaveAttribute(
			'data-blurhash',
			/CV=RPs;00Rp\^URj5/
		);
	} );
} );