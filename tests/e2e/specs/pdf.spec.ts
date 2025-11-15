/**
 * External dependencies
 */
import { RestAttachment } from '@mexp/media-utils';

/**
 * Internal dependencies
 */
import { expect, test } from '../fixtures';

test.describe( 'PDF', () => {
	test.skip(
		( { browserName } ) => browserName === 'webkit',
		'Needs some investigation as to why the generated thumbnail is much bigger in WebKit'
	);

	test.beforeAll( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllMedia(),
			requestUtils.resetPreferences(),
		] );
	} );

	test( 'Thumbnail generation', async ( {
		admin,
		page,
		editor,
		mediaUtils,
		requestUtils,
	} ) => {
		await admin.createNewPost();

		await page.evaluate( () => {
			window.wp.data
				.dispatch( 'core/preferences' )
				.set(
					'media-experiments/preferences',
					'jpeg_outputFormat',
					'jpeg'
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
				.set(
					'media-experiments/preferences',
					'imageLibrary',
					'browser'
				);
		} );

		await editor.insertBlock( { name: 'core/file' } );

		const fileBlock = editor.canvas.locator(
			'role=document[name="Block: File"i]'
		);
		await expect( fileBlock ).toBeVisible();

		await mediaUtils.upload(
			fileBlock.locator( 'data-testid=form-file-upload-input' ),
			'wordpress-gsoc-flyer.pdf'
		);

		await page.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0,
			undefined,
			{
				timeout: 30_000,
			}
		);

		const fileId = await page.evaluate(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.attributes?.id
		);

		const media: RestAttachment = await requestUtils.rest( {
			method: 'GET',
			path: `/wp/v2/media/${ fileId }`,
		} );

		// TODO: Test other sizes too.
		expect( media.media_details.sizes ).toHaveProperty( 'full' );

		// @ts-ignore
		expect( media.media_details.sizes.full.source_url ).toMatch(
			/-pdf.jpeg$/
		);

		expect(
			await mediaUtils.getImageBuffer(
				// @ts-ignore
				media.media_details.sizes.full.source_url
			)
		).toMatchSnapshot( 'pdf-thumbnail-generation.jpeg', {
			maxDiffPixelRatio: 0.05,
		} );
	} );

	test( 'PDF.js viewer for inline embeds', async ( {
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
					'jpeg_outputFormat',
					'jpeg'
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
				.set(
					'media-experiments/preferences',
					'imageLibrary',
					'browser'
				);
		} );

		// Verify cross-origin isolation is enabled
		const crossOriginIsolated = await page.evaluate( () => {
			return Boolean( window.crossOriginIsolated );
		} );
		expect( crossOriginIsolated ).toBe( true );

		// Insert file block
		await editor.insertBlock( { name: 'core/file' } );

		const fileBlock = editor.canvas.locator(
			'role=document[name="Block: File"i]'
		);
		await expect( fileBlock ).toBeVisible();

		// Upload PDF
		await mediaUtils.upload(
			fileBlock.locator( 'data-testid=form-file-upload-input' ),
			'wordpress-gsoc-flyer.pdf'
		);

		// Wait for upload to complete
		await page.waitForFunction(
			() =>
				window.wp.data.select( 'media-experiments/upload' ).getItems()
					.length === 0,
			undefined,
			{
				timeout: 30_000,
			}
		);

		// Enable display preview
		await editor.clickBlockToolbarButton( 'Show more options' );
		const showInlinePreviewButton = page.getByRole( 'menuitem', {
			name: /Show inline preview/i,
		} );
		await showInlinePreviewButton.click();

		// Wait for the PDF viewer to appear
		const pdfViewer = editor.canvas.locator( '.mexp-pdf-viewer' );
		await expect( pdfViewer ).toBeVisible( { timeout: 10000 } );

		// Check that the load button is visible (lazy loading)
		const loadButton = editor.canvas.locator(
			'.mexp-pdf-viewer__load-button'
		);
		await expect( loadButton ).toBeVisible();

		// Click load button
		await loadButton.click();

		// Wait for PDF to load and canvas to appear
		const canvas = editor.canvas.locator( '.mexp-pdf-viewer__canvas' );
		await expect( canvas ).toBeVisible( { timeout: 10000 } );

		// Check that navigation controls appear
		const controls = editor.canvas.locator( '.mexp-pdf-viewer__controls' );
		await expect( controls ).toBeVisible();

		// Verify the original object element is hidden
		const objectElement = editor.canvas.locator(
			'object[type="application/pdf"]'
		);
		await expect( objectElement ).toHaveCSS( 'display', 'none' );
	} );
} );
