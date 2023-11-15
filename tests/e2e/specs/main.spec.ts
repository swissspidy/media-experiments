/**
 * WordPress dependencies
 */
import { test } from '@wordpress/e2e-test-utils-playwright';

test.describe( 'Media Experiments', () => {
	test( 'should load post editor without issues', async ( { admin } ) => {
		await admin.visitAdminPage( 'post-new.php' );
	} );
} );
