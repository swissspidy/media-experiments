<?php
/**
 * Collection of plugin compat functions.
 *
 * @package MediaExperiments
 */

namespace MediaExperiments;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Force Yoast SEO readability worker to use a blob URL.
 *
 * Improves compatibility with cross-origin isolation.
 *
 * @link https://github.com/swissspidy/media-experiments/issues/294
 * @codeCoverageIgnore
 * @return void
 */
function fix_yoast_seo_worker(): void {
	wp_add_inline_script(
		'yoast-seo-post-edit',
		'window.wpseoAdminL10n.isWebStoriesIntegrationActive = "1"'
	);
}
