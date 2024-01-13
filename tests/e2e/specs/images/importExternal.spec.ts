import { test, expect } from '../../fixtures';

test.describe( 'Images', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllMedia();
	} );

	test( 'should upload external image', async ( {
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
			name: 'core/image',
			attributes: {
				url: 'https://raw.githubusercontent.com/swissspidy/media-experiments/main/tests/e2e/assets/tree-on-water-1200x800.jpeg',
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

		const imageBlock = editor.canvas.locator(
			'role=document[name="Block: Image"i]'
		);
		const image = imageBlock.locator( 'img[src^="http"]' );
		const src = await image.getAttribute( 'src' );

		expect( src ).toMatch( /\/wp-content\/uploads\// );

		await expect( settingsPanel ).toHaveText( /Mime type: image\/jpeg/ );
		await expect( settingsPanel.getByLabel( /#8a74bc|#8974bb/ ) ).toBeVisible();
		await expect( page.locator( 'css=[data-blurhash]' ) ).toBeVisible();
	} );
} );
