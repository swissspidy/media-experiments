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
		browserName,
	} ) => {
		test.skip(
			browserName === 'webkit',
			'Needs some investigation as to why conversion is not working on CI'
		);

		await admin.createNewPost();

		await page.evaluate( () => {
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'default_outputFormat',
					'jpeg'
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
		await expect( blockAttributes.src ).toMatch( /\.mp4$/ );
		// TODO: Fix poster addition for converted block.
		// TODO: File extension should be based on preference.
		// await expect( blockAttributes.poster ).toMatch(
		// 	/-poster\.jpeg$/
		// );

		// TODO: Ensure dominant color and blurhash are properly extracted.

		await expect( settingsPanel.getByLabel( '#7a6e96' ) ).toBeVisible();
		await expect( page.locator( 'css=[data-blurhash]' ) ).toBeVisible();
	} );
} );
