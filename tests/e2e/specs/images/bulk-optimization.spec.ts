/**
 * Internal dependencies
 */
import { expect, test } from '../../fixtures';

test.describe( 'Images', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllMedia(),
			requestUtils.resetPreferences(),
		] );
	} );

	test.describe( 'Bulk optimization', () => {
		test( 'optimizes all images', async ( {
			admin,
			page,
			editor,
			mediaUtils,
		} ) => {
			await admin.createNewPost();

			// Ensure the initially uploaded PNG is left untouched.
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
						'png_outputFormat',
						'png'
					);
				window.wp.data
					.dispatch( 'core/preferences' )
					.set(
						'media-experiments/preferences',
						'imageLibrary',
						'browser'
					);
				window.wp.data
					.dispatch( 'core/preferences' )
					.set(
						'media-experiments/preferences',
						'requireApproval',
						true
					);
			} );

			await editor.insertBlock( { name: 'core/image' } );
			const firstBlock = editor.canvas
				.locator( 'role=document[name="Block: Image"i]' )
				.nth( 0 );
			await expect( firstBlock ).toBeVisible();
			await mediaUtils.upload(
				firstBlock.locator( 'data-testid=form-file-upload-input' ),
				'wordpress-logo-512x512.png'
			);

			await page.waitForFunction(
				() =>
					window.wp.data
						.select( 'media-experiments/upload' )
						.getItems().length === 0,
				undefined,
				{
					timeout: 30_000,
				}
			);

			await editor.insertBlock( { name: 'core/image' } );
			const secondBlock = editor.canvas
				.locator( 'role=document[name="Block: Image"i]' )
				.nth( 1 );
			await expect( secondBlock ).toBeVisible();
			await mediaUtils.upload(
				secondBlock.locator( 'data-testid=form-file-upload-input' ),
				'github-mark.png'
			);

			await page.waitForFunction(
				() =>
					window.wp.data
						.select( 'media-experiments/upload' )
						.getItems().length === 0
			);

			await editor.openDocumentSettingsSidebar();

			await page.getByRole( 'tab', { name: 'Post' } ).click();

			const mediaExperimentsPanel = page
				.getByRole( 'region', { name: 'Editor settings' } )
				.getByRole( 'button', {
					name: 'Media Experiments',
				} );
			const isClosed =
				( await mediaExperimentsPanel.getAttribute(
					'aria-expanded'
				) ) === 'false';
			// eslint-disable-next-line playwright/no-conditional-in-test
			if ( isClosed ) {
				await mediaExperimentsPanel.click();
			}

			await expect(
				page
					.getByRole( 'region', { name: 'Editor settings' } )
					.getByRole( 'listitem' )
			).toHaveCount( 2 );

			await page
				.getByRole( 'region', { name: 'Editor settings' } )
				.getByRole( 'button', { name: 'Compress all' } )
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
					timeout: 30_000,
				}
			);

			await expect(
				page.getByRole( 'dialog', {
					name: 'Compare media quality',
				} )
			).toBeVisible();
			await page
				.getByRole( 'dialog', {
					name: 'Compare media quality',
				} )
				.getByRole( 'button', { name: 'Use optimized version' } )
				.click();

			await expect(
				page.getByRole( 'dialog', {
					name: 'Compare media quality',
				} )
			).toBeVisible();
			await page
				.getByRole( 'dialog', {
					name: 'Compare media quality',
				} )
				.getByRole( 'button', { name: 'Use optimized version' } )
				.click();

			await page.waitForFunction(
				() =>
					window.wp.data
						.select( 'media-experiments/upload' )
						.getItems().length === 0
			);

			await expect(
				page
					.getByRole( 'button', { name: 'Dismiss this notice' } )
					.filter( {
						hasText: 'There was an error optimizing the file',
					} )
			).toBeHidden();

			await expect(
				page
					.getByRole( 'button', { name: 'Dismiss this notice' } )
					.filter( {
						hasText: 'All files successfully optimized',
					} )
			).toBeVisible();
		} );

		test( 'optimizes a single image from the list', async ( {
			admin,
			page,
			editor,
			mediaUtils,
		} ) => {
			await admin.createNewPost();

			// Ensure the initially uploaded PNG is left untouched.
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
						'png_outputFormat',
						'png'
					);
				window.wp.data
					.dispatch( 'core/preferences' )
					.set(
						'media-experiments/preferences',
						'imageLibrary',
						'browser'
					);
				window.wp.data
					.dispatch( 'core/preferences' )
					.set(
						'media-experiments/preferences',
						'requireApproval',
						true
					);
			} );

			await editor.insertBlock( { name: 'core/image' } );
			const firstBlock = editor.canvas
				.locator( 'role=document[name="Block: Image"i]' )
				.nth( 0 );
			await expect( firstBlock ).toBeVisible();
			await mediaUtils.upload(
				firstBlock.locator( 'data-testid=form-file-upload-input' ),
				'wordpress-logo-512x512.png'
			);

			await page.waitForFunction(
				() =>
					window.wp.data
						.select( 'media-experiments/upload' )
						.getItems().length === 0,
				undefined,
				{
					timeout: 30_000,
				}
			);

			await editor.insertBlock( { name: 'core/image' } );
			const secondBlock = editor.canvas
				.locator( 'role=document[name="Block: Image"i]' )
				.nth( 1 );
			await expect( secondBlock ).toBeVisible();
			await mediaUtils.upload(
				secondBlock.locator( 'data-testid=form-file-upload-input' ),
				'github-mark.png'
			);

			await page.waitForFunction(
				() =>
					window.wp.data
						.select( 'media-experiments/upload' )
						.getItems().length === 0,
				undefined,
				{
					timeout: 30_000,
				}
			);

			await editor.openDocumentSettingsSidebar();

			await page.getByRole( 'tab', { name: 'Post' } ).click();

			const mediaExperimentsPanel = page
				.getByRole( 'region', { name: 'Editor settings' } )
				.getByRole( 'button', {
					name: 'Media Experiments',
				} );
			const isClosed =
				( await mediaExperimentsPanel.getAttribute(
					'aria-expanded'
				) ) === 'false';
			// eslint-disable-next-line playwright/no-conditional-in-test
			if ( isClosed ) {
				await mediaExperimentsPanel.click();
			}

			await expect(
				page
					.getByRole( 'region', { name: 'Editor settings' } )
					.getByRole( 'listitem' )
			).toHaveCount( 2 );

			await page
				.getByRole( 'region', { name: 'Editor settings' } )
				.getByLabel( 'Compress' )
				.first()
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
					timeout: 30_000,
				}
			);

			await expect(
				page.getByRole( 'dialog', {
					name: 'Compare media quality',
				} )
			).toBeVisible();
			await page
				.getByRole( 'dialog', {
					name: 'Compare media quality',
				} )
				.getByRole( 'button', { name: 'Use optimized version' } )
				.click();

			await page.waitForFunction(
				() =>
					window.wp.data
						.select( 'media-experiments/upload' )
						.getItems().length === 0
			);

			await expect(
				page
					.getByRole( 'button', { name: 'Dismiss this notice' } )
					.filter( {
						hasText: 'There was an error optimizing the file',
					} )
			).toBeHidden();

			await expect(
				page
					.getByRole( 'button', { name: 'Dismiss this notice' } )
					.filter( {
						hasText: 'File successfully optimized',
					} )
			).toBeVisible();

			await expect(
				page
					.getByRole( 'region', { name: 'Editor settings' } )
					.getByRole( 'listitem' )
			).toHaveCount( 1 );
		} );
	} );
} );
