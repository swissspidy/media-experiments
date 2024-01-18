<?php
/**
 * Plugin Name: Media Experiments
 * Plugin URI:  https://github.com/swissspidy/media-experiments
 * Description: Media Experiments
 * Version:     0.0.2
 * Author:      Pascal Birchler
 * Author URI:  https://pascalbirchler.com
 * License:     Apache-2.0
 * License URI: https://www.apache.org/licenses/LICENSE-2.0
 * Text Domain: media-experiments
 * Requires at least: 6.4
 * Requires PHP: 8.0
 * GitHub Plugin URI: https://github.com/swissspidy/media-experiments
 * Primary Branch: main
 *
 * @package MediaExperiments
 */

/**
 * REST attachments controller.
 */
require_once __DIR__ . '/inc/class-rest-attachments-controller.php';

/**
 * BlurHash decoder.
 */
require_once __DIR__ . '/inc/class-blurhash.php';

/**
 * Plugin functions.
 */
require_once __DIR__ . '/inc/functions.php';

/**
 * Compat functions.
 */
require_once __DIR__ . '/inc/compat.php';

/**
 * Adds all plugin actions and filters.
 */
require_once __DIR__ . '/inc/default-filters.php';

register_activation_hook( __FILE__, 'MediaExperiments\\activate_plugin' );
register_deactivation_hook( __FILE__, 'MediaExperiments\\deactivate_plugin' );

if ( defined( 'MEXP_IS_PLAYGROUND' ) && MEXP_IS_PLAYGROUND ) {
// Disable editor iframing, see https://make.wordpress.org/core/2023/07/18/miscellaneous-editor-changes-in-wordpress-6-3/#post-editor-iframed
// See https://github.com/WordPress/wordpress-playground/issues/952
	add_action(
		'enqueue_block_editor_assets',
		static function () {
			wp_add_inline_script(
				'wp-blocks',
				"wp.blocks.registerBlockType('mexp/noop', { title: 'Noop', version: 2 } )"
			);
		}
	);
}
