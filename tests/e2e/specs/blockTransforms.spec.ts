/**
 * Internal dependencies
 */
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
		mediaUtils,
	} ) => {
		await admin.createNewPost();

		const tmpInput = await page.evaluateHandle( () => {
			const input = document.createElement( 'input' );
			input.type = 'file';
			input.multiple = true;
			return input;
		} );

		await mediaUtils.upload(
			tmpInput,
			'garden-adventures.oga',
			'japanese-rose.oga'
		);

		const paragraphBlock = editor.canvas.getByLabel( 'Add default block' );

		const paragraphRect = await paragraphBlock.boundingBox();
		const pX = paragraphRect.x + paragraphRect.width / 2;
		const pY = paragraphRect.y + paragraphRect.height / 3;

		await paragraphBlock.evaluate(
			( element, [ input, clientX, clientY ] ) => {
				const dataTransfer = new window.DataTransfer();
				// @ts-ignore
				for ( const file of input.files ) {
					dataTransfer.items.add( file );
				}
				const event = new window.DragEvent( 'drop', {
					bubbles: true,
					clientX,
					clientY,
					dataTransfer,
				} );
				element.dispatchEvent( event );
			},
			[ tmpInput, pX, pY ] as const
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
				timeout: 40000, // Audio transcoding might take longer
			}
		);

		await expect(
			editor.canvas.locator( 'role=document[name="Block: Audio"i]' )
		).toHaveCount( 2 );
	} );

	test( 'uploads mixed files', async ( {
		admin,
		page,
		editor,
		mediaUtils,
	} ) => {
		await admin.createNewPost();

		const tmpInput = await page.evaluateHandle( () => {
			const input = document.createElement( 'input' );
			input.type = 'file';
			input.multiple = true;
			return input;
		} );

		await mediaUtils.upload(
			tmpInput,
			'garden-adventures.oga',
			'car-desert-600x338.webm',
			'wordpress-logo-512x512.png'
		);

		const paragraphBlock = editor.canvas.getByLabel( 'Add default block' );

		const paragraphRect = await paragraphBlock.boundingBox();
		const pX = paragraphRect.x + paragraphRect.width / 2;
		const pY = paragraphRect.y + paragraphRect.height / 3;

		await paragraphBlock.evaluate(
			( element, [ input, clientX, clientY ] ) => {
				const dataTransfer = new window.DataTransfer();
				// @ts-ignore
				for ( const file of input.files ) {
					dataTransfer.items.add( file );
				}
				const event = new window.DragEvent( 'drop', {
					bubbles: true,
					clientX,
					clientY,
					dataTransfer,
				} );
				element.dispatchEvent( event );
			},
			[ tmpInput, pX, pY ] as const
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
				timeout: 120_000,
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
