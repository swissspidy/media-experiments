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

		await expect( settingsPanel ).toHaveText(
			/Embed a GIF from your media library or upload a new one/
		);

		await expect( settingsPanel ).toHaveText( /Mime type: video\/mp4/ );

		await expect(
			page.getByRole( 'checkbox', { name: 'Autoplay' } )
		).toBeChecked();
		await expect(
			page.getByRole( 'checkbox', { name: 'Loop' } )
		).toBeChecked();
		await expect(
			page.getByRole( 'checkbox', { name: 'Muted' } )
		).toBeChecked();

		const blockAttributes = await page.evaluate(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.attributes ?? {}
		);
		await expect( blockAttributes.src ).toHaveText(
			/nyancat-256x256-3\.mp4/
		);
		await expect( blockAttributes.poster ).toHaveText(
			/nyancat-256x256-3-poster\.webp/ // TODO: Format should be based on preference.
		);

		await expect( settingsPanel.getByLabel( '#796e94' ) ).toBeVisible();

		// No exact comparison as there can be 1-2 char differences between browsers.
		await expect( page.locator( 'css=[data-blurhash]' ) ).toHaveAttribute(
			'data-blurhash',
			/CV=RPs;00Rp\^URj5/
		);
	} );
} );
