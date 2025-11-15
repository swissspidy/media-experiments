/**
 * Internal dependencies
 */
import { expect, test } from '../fixtures';

test.describe( 'Collaboration Requests', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllPosts(),
			requestUtils.resetPreferences(),
		] );
	} );

	test( 'allows creating and sharing a collaboration link', async ( {
		admin,
		page,
		browserName,
	} ) => {
		// TODO: Grab URL from input field instead of clipboard.
		test.skip(
			browserName === 'webkit',
			'Safari only allows reading from clipboard upon user interaction'
		);

		await admin.createNewPost( { title: 'Test Collaboration Post' } );

		// Save the post first
		await page
			.getByRole( 'region', { name: 'Editor top bar' } )
			.getByRole( 'button', { name: 'Save draft' } )
			.click();

		await expect(
			page.getByRole( 'button', { name: 'Saved' } )
		).toBeVisible( { timeout: 10000 } );

		// Open the document settings panel
		await page
			.getByRole( 'region', {
				name: 'Editor settings',
			} )
			.getByRole( 'tab', {
				name: 'Settings',
			} )
			.click();

		// Look for the Media Experiments panel and expand it if needed
		const mediaExperimentsPanel = page.getByRole( 'button', {
			name: 'Media Experiments',
		} );

		if ( await mediaExperimentsPanel.isVisible() ) {
			const isExpanded =
				await mediaExperimentsPanel.getAttribute( 'aria-expanded' );
			if ( isExpanded === 'false' ) {
				await mediaExperimentsPanel.click();
			}
		}

		// Click the share link button
		await page
			.getByRole( 'button', { name: 'Share link', exact: true } )
			.click();

		// Verify modal appears
		const dialog = page.getByRole( 'dialog', {
			name: 'Share for collaboration',
		} );
		await expect( dialog ).toBeVisible();

		// Verify QR code is displayed
		await expect(
			dialog.locator( '.mexp-collaboration-requests-modal__qrcode svg' )
		).toBeVisible();

		// Copy the collaboration URL
		await dialog
			.getByRole( 'button', { name: 'Copy to clipboard' } )
			.click();

		const copiedURL = await page.evaluate( () =>
			navigator.clipboard.readText()
		);

		// Verify the URL contains the collaborate path
		expect( copiedURL ).toContain( '/collaborate/' );

		// Verify capability checkboxes are present
		await expect( dialog.getByLabel( 'Edit post content' ) ).toBeVisible();
		await expect( dialog.getByLabel( 'Upload media files' ) ).toBeVisible();

		// Close the modal
		await dialog.getByRole( 'button', { name: 'Close' } ).click();

		await expect( dialog ).toBeHidden();

		// Verify success notice
		await expect(
			page
				.getByRole( 'button', { name: 'Dismiss this notice' } )
				.filter( {
					hasText: 'Collaboration link revoked',
				} )
		).toBeVisible();
	} );

	test( 'allows selecting collaboration capabilities', async ( {
		admin,
		page,
	} ) => {
		await admin.createNewPost( {
			title: 'Test Collaboration Capabilities',
		} );

		// Save the post first
		await page
			.getByRole( 'region', { name: 'Editor top bar' } )
			.getByRole( 'button', { name: 'Save draft' } )
			.click();

		await expect(
			page.getByRole( 'button', { name: 'Saved' } )
		).toBeVisible( { timeout: 10000 } );

		// Open the document settings panel
		await page
			.getByRole( 'region', {
				name: 'Editor settings',
			} )
			.getByRole( 'tab', {
				name: 'Settings',
			} )
			.click();

		// Look for the Media Experiments panel and expand it if needed
		const mediaExperimentsPanel = page.getByRole( 'button', {
			name: 'Media Experiments',
		} );

		if ( await mediaExperimentsPanel.isVisible() ) {
			const isExpanded =
				await mediaExperimentsPanel.getAttribute( 'aria-expanded' );
			if ( isExpanded === 'false' ) {
				await mediaExperimentsPanel.click();
			}
		}

		// Click the share link button
		await page
			.getByRole( 'button', { name: 'Share link', exact: true } )
			.click();

		const dialog = page.getByRole( 'dialog', {
			name: 'Share for collaboration',
		} );

		// By default, both capabilities should be checked
		const editCheckbox = dialog.getByLabel( 'Edit post content' );
		const uploadCheckbox = dialog.getByLabel( 'Upload media files' );

		await expect( editCheckbox ).toBeChecked();
		await expect( uploadCheckbox ).toBeChecked();

		// Uncheck edit capability
		await editCheckbox.click();
		await expect( editCheckbox ).not.toBeChecked();
		await expect( uploadCheckbox ).toBeChecked();

		// Re-check edit capability
		await editCheckbox.click();
		await expect( editCheckbox ).toBeChecked();

		// Close the modal
		await dialog.getByRole( 'button', { name: 'Close' } ).click();
	} );
} );
