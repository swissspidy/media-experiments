import { visitAdminPage } from '@wordpress/e2e-test-utils';

describe('Media Experiments', () => {
	it('should load post editor without issues', async () => {
		await visitAdminPage('post-new.php');
	});
});
