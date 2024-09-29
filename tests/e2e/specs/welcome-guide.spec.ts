/**
 * Internal dependencies
 */
import { expect, test } from '../fixtures';

test.describe( 'Welcome Guide', () => {
	test( 'should show the guide to first-time users', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost( { showMediaWelcomeGuide: true } );

		const welcomeGuide = page.getByRole( 'dialog', {
			name: 'Welcome to media experiments',
		} );
		const guideHeading = welcomeGuide.getByRole( 'heading', { level: 1 } );
		const nextButton = welcomeGuide.getByRole( 'button', { name: 'Next' } );
		const prevButton = welcomeGuide.getByRole( 'button', {
			name: 'Previous',
		} );

		await expect( guideHeading ).toHaveText(
			'Welcome to media experiments'
		);

		await nextButton.click();
		await expect( guideHeading ).toHaveText( 'Bleeding edge' );

		await prevButton.click();
		// Guide should be on page 1 of 3
		await expect( guideHeading ).toHaveText(
			'Welcome to media experiments'
		);

		// Press the button for Page 2.
		await welcomeGuide
			.getByRole( 'button', { name: 'Page 2 of 3' } )
			.click();
		await expect( guideHeading ).toHaveText( 'Bleeding edge' );

		// Press the right arrow key for Page 3.
		await page.keyboard.press( 'ArrowRight' );
		await expect( guideHeading ).toHaveText( 'Got stuck?' );

		// Click on the *visible* 'Get started' button.
		await welcomeGuide
			.getByRole( 'button', { name: 'Get started' } )
			.click();

		// Guide should be closed.
		await expect( welcomeGuide ).toBeHidden();

		// Reload the editor.
		await page.reload();

		// Guide should be closed.
		await expect(
			editor.canvas.getByRole( 'textbox', { name: 'Add title' } )
		).toBeVisible();
		await expect( welcomeGuide ).toBeHidden();
	} );

	test( 'should not show the welcome guide again if it is dismissed', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost( { showMediaWelcomeGuide: true } );

		const welcomeGuide = page.getByRole( 'dialog', {
			name: 'Welcome to media experiments',
		} );

		await expect( welcomeGuide ).toBeVisible();
		await welcomeGuide.getByRole( 'button', { name: 'Close' } ).click();

		// Reload the editor.
		await page.reload();
		await expect(
			editor.canvas.getByRole( 'textbox', { name: 'Add title' } )
		).toBeFocused();

		await expect( welcomeGuide ).toBeHidden();
	} );

	test( 'should show the welcome guide if it is manually opened', async ( {
		admin,
		page,
	} ) => {
		await admin.createNewPost();
		const welcomeGuide = page.getByRole( 'dialog', {
			name: 'Welcome to media experiments',
		} );

		await expect( welcomeGuide ).toBeHidden();

		// Manually open the guide
		await page
			.getByRole( 'region', {
				name: 'Editor top bar',
			} )
			.getByRole( 'button', { name: 'Options' } )
			.click();
		await page
			.getByRole( 'menuitemcheckbox', { name: 'Media Welcome Guide' } )
			.click();

		await expect( welcomeGuide ).toBeVisible();
	} );
} );
