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
		pageUtils,
		draggingUtils,
	} ) => {
		await admin.createNewPost();

		await editor.insertBlock( { name: 'core/paragraph' } );

		const filePath1 = join(
			__dirname,
			'../assets',
			'garden-adventures.ogg'
		);
		const filePath2 = join( __dirname, '../assets', 'japanese-rose.ogg' );

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
	} );

	test.only( 'uploads mixed files', async ( {
		admin,
		page,
		editor,
		pageUtils,
		draggingUtils,
	} ) => {
		await admin.createNewPost();

		await editor.insertBlock( { name: 'core/paragraph' } );

		const filePath1 = join(
			__dirname,
			'../assets',
			'garden-adventures.ogg'
		);
		const filePath2 = join(
			__dirname,
			'../assets',
			'car-desert-600x338.webm'
		);
		const filePath3 = join(
			__dirname,
			'../assets',
			'wordpress-logo-512x512.png'
		);

		const { dragOver, drop } = await pageUtils.dragFiles( [
			filePath1,
			filePath2,
			filePath3,
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
		).toHaveCount( 1 );
		await expect(
			editor.canvas.locator( 'role=document[name="Block: Video"i]' )
		).toHaveCount( 1 );
		await expect(
			editor.canvas.locator( 'role=document[name="Block: Image"i]' )
		).toHaveCount( 1 );
	} );
} );
