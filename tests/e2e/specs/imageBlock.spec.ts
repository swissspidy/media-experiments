import type { ImageFormat } from '@mexp/upload-media';

import { test, expect } from '../fixtures';

const scenarios: Record< ImageFormat, string > = {
	'jpeg-browser': 'image/jpeg',
	'webp-browser': 'image/webp',
	'webp-ffmpeg': 'image/webp',
	'jpeg-vips': 'image/jpeg',
	'jpeg-mozjpeg': 'image/jpeg',
	avif: 'image/avif',
};

test.describe( 'Image block', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllMedia();
	} );

	test.describe( 'uploads a file and allows optimizing it afterwards', () => {
		for ( const [ preference, expectedMimeType ] of Object.entries(
			scenarios
		) ) {
			test( `uses ${ preference } to convert to ${ expectedMimeType }`, async ( {
				admin,
				page,
				editor,
				mediaUtils,
				browserName,
			} ) => {
				test.skip(
					preference === 'avif',
					'Needs fixing on CI, conversion is failing'
				);

				test.skip(
					browserName === 'webkit' && preference === 'webp-browser',
					'WebKit does not currently support Canvas.toBlob with WebP'
				);

				test.skip(
					browserName === 'webkit' && preference === 'jpeg-browser',
					'Works locally but is flaky on CI'
				);

				test.skip(
					browserName === 'webkit' &&
						[ 'webp-ffmpeg', 'jpeg-vips', 'jpeg-mozjpeg' ].includes(
							preference
						),
					'No cross-origin isolation in Playwright WebKit builds yet, see https://github.com/microsoft/playwright/issues/28513'
				);

				await admin.createNewPost();

				await page.evaluate( ( pref ) => {
					window.wp.data
						.dispatch( 'core/preferences' )
						.set(
							'media-experiments/preferences',
							'imageFormat',
							pref
						);
				}, preference );

				await editor.insertBlock( { name: 'core/image' } );

				const imageBlock = editor.canvas.locator(
					'role=document[name="Block: Image"i]'
				);
				await expect( imageBlock ).toBeVisible();

				await mediaUtils.upload(
					imageBlock.locator( 'data-testid=form-file-upload-input' )
				);

				await page.waitForFunction(
					() =>
						window.wp.data
							.select( 'media-experiments/upload' )
							.getItems().length === 0
				);

				const settingsPanel = page
					.getByRole( 'region', {
						name: 'Editor settings',
					} )
					.getByRole( 'tabpanel', {
						name: 'Settings',
					} );

				await expect( settingsPanel ).toHaveText(
					/Mime type: image\/png/
				);
				await expect(
					settingsPanel.getByLabel( '#696969' )
				).toBeVisible();

				await page.getByRole( 'button', { name: 'Optimize' } ).click();

				const dialog = page.getByRole( 'dialog', {
					name: 'Compare media quality',
				} );

				await expect( dialog ).toBeVisible();

				await dialog
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
				).not.toBeVisible();

				await expect(
					page
						.getByRole( 'button', { name: 'Dismiss this notice' } )
						.filter( {
							hasText: 'File successfully optimized',
						} )
				).toBeVisible();

				await expect( settingsPanel ).toHaveText(
					new RegExp( `Mime type: ${ expectedMimeType }` )
				);
				await expect(
					settingsPanel.getByLabel( '#696969' )
				).toBeVisible();
			} );
		}
	} );
} );
