<?php
/**
 * Collection of functions.
 *
 * @copyright 2023 Google LLC
 * @license   https://www.apache.org/licenses/LICENSE-2.0 Apache License 2.0
 */

declare(strict_types = 1);

namespace MediaExperiments;

use WP_Screen;

/**
 * Sets up cross-origin isolation in the block editor.
 *
 * @since 0.0.1
 *
 * @param WP_Screen $screen Current WP_Screen object.
 * @return void
 */
function set_up_cross_origin_isolation( WP_Screen $screen ): void {
	if ( ! $screen->is_block_editor() ) {
		return;
	}

	require_once plugin_dir_path( __FILE__ ) . '/Cross_Origin_Isolation.php';
	$instance = new Cross_Origin_Isolation();
	$instance->register();
}

function register_assets(): void {
	wp_register_script(
		'media-experiments-libheif',
		'https://wp.stories.google/static/main/js/libheif-js@1.14.0/libheif.js',
		[],
		'1.14.0',
		true
	);
}

function enqueue_block_editor_assets(): void {
	$asset_file = dirname( __DIR__ ) . '/build/media-experiments.asset.php';
	$asset      = is_readable( $asset_file ) ? require $asset_file : [];

	$asset['dependencies'] = $asset['dependencies'] ?? [];
	$asset['version']      = $asset['version'] ?? '';

	$asset['dependencies'][] = 'media-experiments-libheif';

	wp_enqueue_script(
		'media-experiments',
		plugins_url( 'build/media-experiments.js', __DIR__ ),
		$asset['dependencies'],
		$asset['version'],
		true
	);

	wp_set_script_translations( 'media-experiments', 'media-experiments' );

//	wp_enqueue_style(
//		'media-experiments',
//		plugins_url( 'build/media-experiments.css', __DIR__ ),
//		array( 'wp-components' ),
//		$asset['version']
//	);
//
//	wp_style_add_data( 'media-experiments', 'rtl', 'replace' );
}

/**
 * Add post thumbnail support to attachments by default.
 *
 * Works around core limitation so that featured images for videos
 * can be set via the REST API.
 *
 * @link https://core.trac.wordpress.org/ticket/41692
 */
function register_rest_attachment_featured_media(): void {
	register_rest_field(
		'attachment',
		'featured_media',
		[
			'schema' => [
				'description' => __( 'The ID of the featured media for the object.', 'media-experiments' ),
				'type'        => 'integer',
				'context'     => [ 'view', 'edit', 'embed' ],
			],
		]
	);
}
