<?php
/**
 * Collection of functions.
 *
 * @copyright 2023 Google LLC
 * @license   https://www.apache.org/licenses/LICENSE-2.0 Apache License 2.0
 */

declare(strict_types = 1);

namespace MediaExperiments;

use WP_Error;
use WP_Post;
use WP_Query;
use WP_REST_Request;
use WP_Screen;
use function register_post_meta;

/**
 * Sets up cross-origin isolation in the block editor.
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

	wp_register_script(
		'media-experiments-vips',
		'https://storage.googleapis.com/web-stories-wp-cdn-assets/19/js/wasm-vips@0.0.4/vips.js',
		[],
		'0.0.4',
		true
	);
}

function enqueue_block_editor_assets(): void {
	$asset_file = dirname( __DIR__ ) . '/build/media-experiments.asset.php';
	$asset      = is_readable( $asset_file ) ? require $asset_file : [];

	$asset['dependencies'] = $asset['dependencies'] ?? [];
	$asset['version']      = $asset['version'] ?? '';

	$asset['dependencies'][] = 'media-experiments-libheif';
	$asset['dependencies'][] = 'media-experiments-vips';

	wp_enqueue_script(
		'media-experiments',
		plugins_url( 'build/media-experiments.js', __DIR__ ),
		$asset['dependencies'],
		$asset['version'],
		true
	);

	wp_set_script_translations( 'media-experiments', 'media-experiments' );

	wp_enqueue_style(
		'media-experiments',
		plugins_url( 'build/media-experiments.css', __DIR__ ),
		array( 'wp-components' ),
		$asset['version']
	);

	wp_style_add_data( 'media-experiments', 'rtl', 'replace' );
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
			'update_callback' => __NAMESPACE__ . '\rest_create_attachment_handle_featured_media',
		]
	);
}

/**
 * Sets the featured image when uploading a new attachment via the REST API
 *
 * @see \WP_REST_Posts_Controller::handle_featured_media
 *
 * @param int $value
 * @param WP_Post $post
 * @return void|WP_Error
 */
function rest_create_attachment_handle_featured_media( int $value, WP_Post $post ) {
	if ( $value ) {
		if ( $value === get_post_thumbnail_id( $post->ID ) ) {
			return;
		}

		$result = set_post_thumbnail( $post->ID, $value );

		if ( $result ) {
			return;
		}

		return new WP_Error(
			'rest_invalid_featured_media',
			__( 'Invalid featured media ID.', 'media-experiments' ),
			array( 'status' => 400 )
		);
	}

	delete_post_thumbnail( $post->ID );
}

function register_attachment_post_meta(): void {
	register_post_meta(
		'attachment',
		'mexp_blurhash',
		[
			'type'           => 'string',
			'description'    => __( 'BlurHash of the object.', 'media-experiments' ),
			'show_in_rest'   => [
				'schema' => [
					'type' => 'string',
				],
			],
			'single'         => true,
		]
	);

	register_post_meta(
		'attachment',
		'mexp_dominant_color',
		[
			'type'           => 'string',
			'description'    => __( 'Dominant color of the object.', 'media-experiments' ),
			'show_in_rest'   => [
				'schema' => [
					'type' => 'string',
				],
			],
			'single'         => true,
		]
	);

	register_post_meta(
		'attachment',
		'mexp_generated_poster_id',
		[
			'type'               => 'integer',
			'description'        => __( 'The ID of the generated poster image for the object.', 'media-experiments' ),
			'show_in_rest'       => true,
			'single'             => true,
			'default'            => 0,
			'sanitize_callback'  => 'absint',
		]
	);

	register_post_meta(
		'attachment',
		'mexp_is_muted',
		[
			'type'               => 'boolean',
			'description'        => __( 'Whether the video is muted.', 'media-experiments' ),
			'show_in_rest'       => true,
			'single'             => true,
			'default'            => false,
			'sanitize_callback'  => 'rest_sanitize_boolean',
		]
	);
}

function register_media_source_taxonomy(): void {
	register_taxonomy(
		'mexp_media_source',
		'attachment',
		[
			'label'        => __( 'Source', 'media-experiments' ),
			'public'       => true, // Set to true for debugging.
			'rewrite'      => false,
			'hierarchical' => false,
			'show_in_rest' => true,
		]
	);

	// Add any missing terms to our pseudo enum.
	// These will fail if the terms already exist, which is fine.
	wp_insert_term( 'poster-generation', 'mexp_media_source' );
	wp_insert_term( 'gif-conversion', 'mexp_media_source' );
	wp_insert_term( 'media-import', 'mexp_media_source' );
}

/**
 * Filters the attachment query args to hide generated video poster images.
 *
 * Reduces unnecessary noise in the Media grid view.
 *
 * @param array<string, mixed>|mixed $args Query args.
 * @return array<string, mixed>|mixed Filtered query args.
 *
 * @template T
 *
 * @phpstan-return ($args is array<T> ? array<T> : mixed)
 */
function filter_ajax_query_attachments_args( mixed $args ): mixed {
	if ( ! \is_array( $args ) ) {
		return $args;
	}

	$args['tax_query'] = get_exclude_tax_query( $args ); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query

	return $args;
}

/**
 * Determines whether we're currently on the media upload screen.
 *
 * @return bool Whether we're currently on the media upload screen
 */
function is_upload_screen(): bool {
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;

	return $screen && 'upload' === $screen->id;
}

/**
 * Filters the current query to hide generated video poster images and source video.
 *
 * Reduces unnecessary noise in the Media list view.
 *
 * @param WP_Query $query WP_Query instance, passed by reference.
 */
function filter_generated_media_attachments( WP_Query $query ): void {
	if ( is_admin() && $query->is_main_query() && is_upload_screen() ) {
		$tax_query = $query->get( 'tax_query' );

		$query->set( 'tax_query', get_exclude_tax_query( [ 'tax_query' => $tax_query ] ) ); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
	}
}

/**
 * Filters the current query to hide generated video poster images.
 *
 * Reduces unnecessary noise in media REST API requests.
 *
 * @param array<string, mixed>|mixed $args Query args.
 * @return array<string, mixed>|mixed Filtered query args.
 *
 * @template T
 *
 * @phpstan-return ($args is array<T> ? array<T> : mixed)
 */
function filter_rest_generated_media_attachments( mixed $args ): mixed {
	if ( ! \is_array( $args ) ) {
		return $args;
	}

	$args['tax_query'] = get_exclude_tax_query( $args ); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query

	return $args;
}

/**
 * Returns the tax query needed to exclude generated video poster images and source videos.
 *
 * @param array<string, mixed> $args Existing WP_Query args.
 * @return array<int|string, mixed> Tax query arg.
 */
function get_exclude_tax_query( array $args ): array {
	/**
	 * Tax query.
	 *
	 * @var array<int|string, mixed> $tax_query
	 */
	$tax_query = ! empty( $args['tax_query'] ) ? $args['tax_query'] : [];

	/**
	 * Filter whether generated attachments should be hidden in the media library.
	 *
	 * @param bool  $enabled Whether the taxonomy check should be applied.
	 * @param array $args    Existing WP_Query args.
	 */
	$enabled = apply_filters( 'media_experiments_hide_generated_attachments', true, $args );
	if ( true !== $enabled ) {
		return $tax_query;
	}

	/**
	 * Merge with existing tax query if needed,
	 * in a nested way so WordPress will run them
	 * with an 'AND' relation. Example:
	 *
	 * [
	 *   'relation' => 'AND', // implicit.
	 *   [ this query ],
	 *   [ [ any ], [ existing ], [ tax queries] ]
	 * ]
	 */
	array_unshift(
		$tax_query,
		[
			[
				'taxonomy' => 'mexp_media_source',
				'field'    => 'slug',
				'terms'    => [
					'poster-generation'
				],
				'operator' => 'NOT IN',
			],
		]
	);

	return $tax_query;
}

/**
 * Deletes associated generated poster image when a video is deleted.
 *
 * This prevents the poster image from becoming an orphan because it is not
 * displayed anywhere in WordPress.
 *
 * @todo What if the poster is associated with multiple videos (e.g. when using muting)?
 *
 * @param int $attachment_id ID of the attachment to be deleted.
 */
function delete_generated_poster_image( int $attachment_id ): void {
	/**
	 * Poster ID.
	 *
	 * @var int|string $post_id
	 */
	$post_id = get_post_meta( $attachment_id, 'mexp_generated_poster_id', true );

	if ( empty( $post_id ) ) {
		return;
	}

	wp_delete_attachment( (int) $post_id, true );
}

/**
 * Fires after a single attachment is completely created or updated via the REST API.
 *
 * Works around a core limitation where the attachment controller does not handle
 * terms on upload.
 *
 * @link https://core.trac.wordpress.org/ticket/57897
 *
 * @param WP_Post         $attachment Inserted or updated attachment object.
 * @param WP_REST_Request $request    Request object.
 * @param bool            $creating   True when creating an attachment, false when updating.
 */
function rest_after_insert_attachment_handle_terms( WP_Post $attachment, WP_REST_Request $request, bool $creating ): void {
	if ( ! $creating ) {
		return;
	}

	$taxonomies = wp_list_filter( get_object_taxonomies( 'attachment', 'objects' ), [ 'show_in_rest' => true ] );

	foreach ( $taxonomies as $taxonomy ) {
		$base = ! empty( $taxonomy->rest_base ) ? $taxonomy->rest_base : $taxonomy->name;

		if ( ! isset( $request[ $base ] ) ) {
			continue;
		}

		$result = wp_set_object_terms( $attachment->ID, $request[ $base ], $taxonomy->name );

		if ( is_wp_error( $result ) ) {
			return;
		}
	}
}
