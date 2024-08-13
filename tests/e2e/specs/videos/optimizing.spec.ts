/**
 * Internal dependencies
 */
import { expect, test } from '../../fixtures';

test.describe( 'Videos', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllMedia(),
			requestUtils.resetPreferences(),
		] );
	} );

	// TODO: Implement.
	test.skip( 'uploads a file and allows optimizing it afterwards', async ( {
		admin,
		page,
		editor,
		mediaUtils,
		browserName,
	} ) => {
		test.skip(
			browserName === 'webkit',
			'Needs some investigation as to why dominant color / blurhash is not working on CI'
		);

		await admin.createNewPost();

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
					'jpeg_outputFormat',
					'jpeg'
				);
		} );

		await editor.insertBlock( { name: 'core/video' } );

		const videoBlock = editor.canvas.locator(
			'role=document[name="Block: Video"i]'
		);
		await expect( videoBlock ).toBeVisible();

		await mediaUtils.upload(
			videoBlock.locator( 'data-testid=form-file-upload-input' ),
			'car-desert-600x338.webm'
		);

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

		const settingsPanel = page
			.getByRole( 'region', {
				name: 'Editor settings',
			} )
			.getByRole( 'tabpanel', {
				name: 'Settings',
			} );

		// TODO: Check why mime type is not consistent.
		await expect( settingsPanel ).toHaveText(
			/Mime type: video\/(mp4|webm)/
		);
		await expect( settingsPanel.getByLabel( '#8b837e' ) ).toBeVisible();
		await expect( page.locator( 'css=[data-blurhash]' ) ).toBeVisible();

		await page.evaluate( () => {
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'optimizeOnUpload',
					true
				);
		} );

		await expect(
			page.getByRole( 'button', { name: 'Remove audio channel' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'button', { name: 'Generate subtitles' } )
		).toBeVisible();

		await page
			.getByRole( 'region', { name: 'Editor settings' } )
			.getByRole( 'button', { name: 'Optimize' } )
			.click();

		await expect(
			page
				.getByRole( 'button', { name: 'Dismiss this notice' } )
				.filter( {
					hasText: 'There was an error optimizing the file',
				} )
		).toBeHidden();

		await page.waitForFunction(
			() =>
				window.wp.data
					.select( 'media-experiments/upload' )
					.isPendingApproval(),
			undefined,
			{
				timeout: 40000,
			}
		);

		const blockAttributes = await page.evaluate(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.attributes ?? {}
		);
		await expect( blockAttributes.src ).toMatch( /\.mp4$/ );
		await expect( blockAttributes.poster ).toMatch( /-poster\.jpeg$/ );
	} );

	test( 'optimizes a file on upload', async ( {
		admin,
		page,
		editor,
		mediaUtils,
		browserName,
	} ) => {
		test.skip(
			browserName === 'webkit',
			'Needs some investigation as to why dominant color / blurhash is not working on CI'
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

		await mediaUtils.upload(
			videoBlock.locator( 'data-testid=form-file-upload-input' ),
			'car-desert-600x338.webm'
		);

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

		const settingsPanel = page
			.getByRole( 'region', {
				name: 'Editor settings',
			} )
			.getByRole( 'tabpanel', {
				name: 'Settings',
			} );

		// TODO: Check why mime type is not consistent.
		await expect( settingsPanel ).toHaveText(
			/Mime type: video\/(mp4|webm)/
		);
		await expect( settingsPanel.getByLabel( '#8b837e' ) ).toBeVisible();
		await expect( page.locator( 'css=[data-blurhash]' ) ).toBeVisible();

		const blockAttributes = await page.evaluate(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.attributes ?? {}
		);
		await expect( blockAttributes.src ).toMatch( /\.mp4$/ );
		await expect( blockAttributes.poster ).toMatch( /-poster\.jpeg$/ );

		await expect(
			page.getByRole( 'button', { name: 'Remove audio channel' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'button', { name: 'Generate subtitles' } )
		).toBeVisible();
	} );
} );
