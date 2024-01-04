import { test, expect } from '../../fixtures';

test.describe( 'Videos', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllMedia();
	} );

	test( 'generates subtitles', async ( { admin, page, editor } ) => {
		await admin.createNewPost();

		await editor.insertBlock( {
			name: 'core/video',
			attributes: {
				src: 'https://raw.githubusercontent.com/swissspidy/media-experiments/main/tests/e2e/assets/pepper.webm',
			},
		} );

		const settingsPanel = page
			.getByRole( 'region', {
				name: 'Editor settings',
			} )
			.getByRole( 'tabpanel', {
				name: 'Settings',
			} );

		await settingsPanel
			.getByRole( 'button', { name: 'Generate subtitles' } )
			.click();

		await expect(
			settingsPanel.getByRole( 'button', { name: 'Generate subtitles' } )
		).toHaveCount( 0, { timeout: 30000 } );

		await expect(
			page.getByRole( 'button', { name: 'Remove audio channel' } )
		).not.toBeVisible();

		const vttUrl = await page.evaluate(
			() =>
				window.wp.data.select( 'core/block-editor' ).getSelectedBlock()
					?.attributes?.tracks?.[ 0 ]?.src
		);
		await expect( vttUrl ).not.toBeNull();

		const vttContents = await ( await fetch( vttUrl ) ).text();
		expect( vttContents ).toContain( 'WEBVTT' );
		expect( vttContents ).toContain( 'Auto-generated captions' );
		expect( vttContents ).toContain( 'please' );
	} );
} );
