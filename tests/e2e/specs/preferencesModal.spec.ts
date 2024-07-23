import { expect, test } from '../fixtures';

test.describe( 'Preferences Modal', () => {
	test.beforeEach( async ( { admin } ) => {
		await admin.createNewPost();
	} );

	test( 'opens from the options menu, closes with its close button and returns focus', async ( {
		page,
	} ) => {
		await page
			.getByRole( 'region', { name: 'Editor top bar' } )
			.getByRole( 'button', { name: 'Options' } )
			.click();
		await page
			.getByRole( 'menuitem', {
				name: 'Media Preferences',
			} )
			.click();

		const dialog = page.getByRole( 'dialog', {
			name: 'Preferences',
		} );
		await expect( dialog ).toBeVisible();

		await dialog.getByRole( 'button', { name: 'Close' } ).click();
		await expect( dialog ).toBeHidden();
	} );

	test( 'toggles features', async ( { page } ) => {
		// Reset.
		await page.evaluate( () => {
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'requireApproval',
					true
				);
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'default_outputFormat',
					'jpeg'
				);
			window.wp.data
				.dispatch( 'core/preferences' )
				.set( 'media-experiments/preferences', 'default_quality', 82 );
		} );

		await page
			.getByRole( 'region', { name: 'Editor top bar' } )
			.getByRole( 'button', { name: 'Options' } )
			.click();
		await page
			.getByRole( 'menuitem', {
				name: 'Media Preferences',
			} )
			.click();

		const dialog = page.getByRole( 'dialog', {
			name: 'Preferences',
		} );
		await expect( dialog ).toBeVisible();

		// Test all the different inputs once.

		await page.getByRole( 'tab', { name: 'General' } ).click();

		await page.getByLabel( 'Approval step' ).click();

		expect(
			await page.evaluate( () =>
				window.wp.data
					.select( 'core/preferences' )
					.get( 'media-experiments/preferences', 'requireApproval' )
			)
		).toBe( false );

		await page.getByRole( 'tab', { name: 'Images' } ).click();

		await page.getByLabel( 'Default image format' ).selectOption( 'WebP' );

		expect(
			await page.evaluate( () =>
				window.wp.data
					.select( 'core/preferences' )
					.get(
						'media-experiments/preferences',
						'default_outputFormat'
					)
			)
		).toBe( 'webp' );

		await page.getByLabel( 'Default image quality' ).clear();
		await page.getByLabel( 'Default image quality' ).fill( '99' );

		expect(
			await page.evaluate( () =>
				window.wp.data
					.select( 'core/preferences' )
					.get( 'media-experiments/preferences', 'default_quality' )
			)
		).toBe( 99 );

		await dialog.getByRole( 'button', { name: 'Close' } ).click();
		await expect( dialog ).toBeHidden();

		// Reset.
		await page.evaluate( () => {
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'requireApproval',
					true
				);
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'default_outputFormat',
					'jpeg'
				);
			window.wp.data
				.dispatch( 'core/preferences' )
				.set( 'media-experiments/preferences', 'default_quality', 82 );
		} );
	} );
} );
