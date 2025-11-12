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

	test( 'Convert PDF to blocks', async ( {
		admin,
		page,
		editor,
		mediaUtils,
	} ) => {
		await admin.createNewPost();

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

		// Open the document settings sidebar
		await editor.openDocumentSettingsSidebar();

		// Switch to Block tab if not already there
		const blockTab = page.getByRole( 'tab', { name: 'Block' } );
		if ( await blockTab.isVisible() ) {
			await blockTab.click();
		}

		// Find and open the Media Experiments panel if it's closed
		const mediaExperimentsPanel = page
			.getByRole( 'region', { name: 'Editor settings' } )
			.getByRole( 'button', {
				name: 'Media Experiments',
			} );

		await expect( mediaExperimentsPanel ).toBeVisible();

		const isClosed =
			( await mediaExperimentsPanel.getAttribute( 'aria-expanded' ) ) ===
			'false';

		if ( isClosed ) {
			await mediaExperimentsPanel.click();
		}

		// Click the "Convert to blocks" button
		const convertButton = page.getByRole( 'button', {
			name: 'Convert to blocks',
		} );
		await expect( convertButton ).toBeVisible();
		await convertButton.click();

		// Wait for the conversion to complete and blocks to appear
		await expect(
			page
				.getByRole( 'button', { name: 'Dismiss this notice' } )
				.filter( {
					hasText: 'PDF converted to blocks',
				} )
		).toBeVisible();

		// Verify that paragraph blocks were created
		const paragraphBlocks = editor.canvas.locator(
			'role=document[name="Block: Paragraph"i]'
		);
		await expect( paragraphBlocks ).toHaveCount( 1 ); // The test PDF has 1 page with content

		// Verify the file block is gone
		await expect( fileBlock ).toBeHidden();

		// Verify the paragraph has text content
		const firstParagraph = paragraphBlocks.first();
		const paragraphContent = await firstParagraph.textContent();
		expect( paragraphContent ).toBeTruthy();
		expect( paragraphContent.length ).toBeGreaterThan( 10 );
	} );
} );
