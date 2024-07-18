import { join } from 'node:path';

import { expect, test } from '../fixtures';

test.describe( 'Block Transforms', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllMedia(),
			requestUtils.resetPreferences(),
		] );
	} );

	test( 'uploads multiple audio files', async ( {
		admin,
		page,
		editor,
		browserName,
		pageUtils,
		draggingUtils,
	} ) => {
		test.skip(
			browserName !== 'chromium',
			'Drag & drop in PageUtils currently requires CDP'
		);

		await admin.createNewPost();

		await editor.insertBlock( { name: 'core/paragraph' } );

		const fileName1 = 'garden-adventures.ogg';
		const filePath1 = join( __dirname, '../assets', fileName1 );
		const fileName2 = 'japanese-rose.ogg';
		const filePath2 = join( __dirname, '../assets', fileName2 );

		const { dragOver, drop } = await pageUtils.dragFiles( [
			filePath1,
			filePath2,
		] );

		await dragOver(
			editor.canvas.locator( '[data-type="core/paragraph"]' )
		);

		await expect( draggingUtils.dropZone ).toBeVisible();
		await expect( draggingUtils.insertionIndicator ).toBeHidden();

		await drop();

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
				timeout: 40000, // Audio transcoding might take longer
			}
		);

		await expect(
			editor.canvas.locator( 'role=document[name="Block: Audio"i]' )
		).toHaveCount( 2 );

		await expect(
			page
				.getByRole( 'region', {
					name: 'Editor settings',
				} )
				.getByRole( 'tabpanel', {
					name: 'Settings',
				} )
		).toHaveText( /Mime type: audio\/mpeg/ );
	} );
} );
