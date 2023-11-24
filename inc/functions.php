<?php
/**
 * Collection of functions.
 *
 * @package MediaExperiments
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
 * Filters the list mapping image mime types to their respective extensions.
 *
 * @see wp_check_filetype_and_ext()
 *
 * @param array $mime_to_ext Array of image mime types and their matching extensions.
 */
function filter_mimes_to_exts( array $mime_to_ext ): array {
	$mime_to_ext['image/avif'] = 'avif';
	return $mime_to_ext;
}

/**
 * Filters the list of mime types and file extensions.
 *
 * @see wp_get_mime_types()
 *
 * @param string[] $mime_types Mime types keyed by the file extension regex
 *                             corresponding to those types.
 */
function filter_mime_types( array $mime_types ): array {
	$mime_types['avif'] = 'image/avif';
	return $mime_types;
}

/**
 * Filters file type based on the extension name.
 *
 * @see wp_get_ext_types()
 *
 * @param array[] $ext2type Multi-dimensional array of file extensions types keyed by the type of file.
 */
function filter_ext_types( array $ext2type ): array {
	$ext2type['image'] = array_unique( [ ...$ext2type['image'], 'avif' ] );
	return $ext2type;
}

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

	require_once plugin_dir_path( __FILE__ ) . '/class-cross-origin-isolation.php';
	$instance = new Cross_Origin_Isolation();
	$instance->register();
}

/**
 * Register assets used by editor integration and others.
 *
 * @return void
 */
function register_assets(): void {
	wp_register_script(
		'media-experiments-libheif',
		'https://cdn.jsdelivr.net/npm/libheif-js@1.17.1/libheif/libheif.min.js',
		[],
		'1.17.1',
		true
	);

	wp_register_script(
		'media-experiments-vips',
		'https://cdn.jsdelivr.net/npm/wasm-vips@0.0.7/lib/vips.min.js',
		[],
		'0.0.7',
		true
	);
}

/**
 * Enqueues scripts for the block editor.
 *
 * @return void
 */
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
		array(
			'strategy' => 'defer',
		)
	);

	wp_set_script_translations( 'media-experiments', 'media-experiments' );

	/** This filter is documented in wp-admin/includes/images.php */
	$threshold = (int) apply_filters( 'big_image_size_threshold', 2560, array( 0, 0 ), '', 0 ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

	wp_add_inline_script(
		'media-experiments',
		sprintf(
			'window.mediaExperiments = %s;',
			wp_json_encode(
				[
					'availableImageSizes'   => get_all_image_sizes(),
					'bigImageSizeThreshold' => $threshold,
				]
			)
		),
		'before'
	);

	wp_enqueue_style(
		'media-experiments',
		plugins_url( 'build/media-experiments.css', __DIR__ ),
		array( 'wp-components' ),
		$asset['version']
	);

	wp_style_add_data( 'media-experiments', 'rtl', 'replace' );
}

/**
 * Returns a list of all available image sizes.
 *
 * @return array Existing image sizes.
 */
function get_all_image_sizes(): array {
	$sizes = wp_get_additional_image_sizes();

	$sizes['thumbnail'] = [
		'width'  => (int) get_option( 'thumbnail_size_w' ),
		'height' => (int) get_option( 'thumbnail_size_h' ),
	];

	$sizes['medium'] = [
		'width'  => (int) get_option( 'medium_size_w' ),
		'height' => (int) get_option( 'medium_size_h' ),
	];

	$sizes['medium_large'] = [
		'width'  => (int) get_option( 'medium_large_size_w' ),
		'height' => (int) get_option( 'medium_large_size_h' ),
	];

	$sizes['large'] = [
		'width'  => (int) get_option( 'large_size_w' ),
		'height' => (int) get_option( 'large_size_h' ),
	];

	foreach ( $sizes as $name => $size ) {
		$size['name']   = $name;
		$sizes[ $name ] = $size;
	}

	return $sizes;
}

/**
 * Add post thumbnail support to attachments by default.
 *
 * Works around core limitation so that featured images for videos
 * can be set via the REST API.
 *
 * @link https://core.trac.wordpress.org/ticket/41692
 *
 * @uses rest_create_attachment_handle_featured_media
 * @uses rest_get_attachment_filename
 * @uses rest_get_attachment_filesize
 */
function register_rest_fields(): void {
	register_rest_field(
		'attachment',
		'featured_media',
		[
			'schema'          => [
				'description' => __( 'The ID of the featured media for the object.', 'media-experiments' ),
				'type'        => 'integer',
				'context'     => [ 'view', 'edit', 'embed' ],
			],
			'update_callback' => __NAMESPACE__ . '\rest_create_attachment_handle_featured_media',
		]
	);

	register_rest_field(
		'attachment',
		'mexp_filename',
		[
			'schema'       => [
				'description' => __( 'Original attachment file name', 'media-experiments' ),
				'type'        => 'string',
				'context'     => [ 'edit' ],
			],
			'get_callback' => __NAMESPACE__ . '\rest_get_attachment_filename',
		]
	);

	register_rest_field(
		'attachment',
		'mexp_filesize',
		[
			'schema'       => [
				'description' => __( 'Attachment file size', 'media-experiments' ),
				'type'        => 'number',
				'context'     => [ 'edit' ],
			],
			'get_callback' => __NAMESPACE__ . '\rest_get_attachment_filesize',
		]
	);
}

/**
 * Returns the attachment's original file name.
 *
 * @param array $post Post data.
 * @return string|null Attachment file name.
 */
function rest_get_attachment_filename( array $post ): ?string {
	$path = wp_get_original_image_path( $post['id'] );

	if ( ! $path ) {
		return null;
	}

	return basename( $path );
}

/**
 * Returns the attachment's file size in bytes.
 *
 * @param array $post Post data.
 * @return int|null Attachment file size.
 */
function rest_get_attachment_filesize( array $post ): ?int {
	$original_path = wp_get_original_image_path( $post['id'] );
	$attached_file = $original_path ?: get_attached_file( $post['id'] );

	if ( isset( $meta['filesize'] ) ) {
		return $meta['filesize'];
	} elseif ( file_exists( $attached_file ) ) {
		return wp_filesize( $attached_file );
	}

	return null;
}

/**
 * Sets the featured image when uploading a new attachment via the REST API
 *
 * @see \WP_REST_Posts_Controller::handle_featured_media
 *
 * @param int     $value Value to set.
 * @param WP_Post $post  Post instance.
 * @return void|WP_Error Nothing or error instance on failure.
 */
function rest_create_attachment_handle_featured_media( int $value, WP_Post $post ) {
	if ( $value ) {
		if ( get_post_thumbnail_id( $post->ID ) === $value ) {
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

/**
 * Registers additional post meta for the attachment post type.
 *
 * @return void
 */
function register_attachment_post_meta(): void {
	register_post_meta(
		'attachment',
		'mexp_blurhash',
		[
			'type'         => 'string',
			'description'  => __( 'BlurHash of the object.', 'media-experiments' ),
			'show_in_rest' => [
				'schema' => [
					'type' => 'string',
				],
			],
			'single'       => true,
		]
	);

	register_post_meta(
		'attachment',
		'mexp_dominant_color',
		[
			'type'         => 'string',
			'description'  => __( 'Dominant color of the object.', 'media-experiments' ),
			'show_in_rest' => [
				'schema' => [
					'type' => 'string',
				],
			],
			'single'       => true,
		]
	);

	register_post_meta(
		'attachment',
		'mexp_generated_poster_id',
		[
			'type'              => 'integer',
			'description'       => __( 'The ID of the generated poster image for the object.', 'media-experiments' ),
			'show_in_rest'      => true,
			'single'            => true,
			'default'           => 0,
			'sanitize_callback' => 'absint',
		]
	);

	register_post_meta(
		'attachment',
		'mexp_is_muted',
		[
			'type'              => 'boolean',
			'description'       => __( 'Whether the video is muted.', 'media-experiments' ),
			'show_in_rest'      => true,
			'single'            => true,
			'default'           => false,
			'sanitize_callback' => 'rest_sanitize_boolean',
		]
	);
}

/**
 * Registers a new media-source taxonomy for the attachment post type.
 *
 * @return void
 */
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
	wp_insert_term( 'media-optimization', 'mexp_media_source' );
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
					'poster-generation',
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

/**
 * Fires after a single attachment is completely created or updated via the REST API.
 *
 * Adds image sub sizes for PDFs in the format WordPress core expects
 *
 * @link https://github.com/WordPress/wordpress-develop/blob/8a5daa6b446e8c70ba22d64820f6963f18d36e92/src/wp-admin/includes/image.php#L609-L634
 *
 * @param WP_Post         $attachment Inserted or updated attachment object.
 * @param WP_REST_Request $request    Request object.
 */
function rest_after_insert_attachment_handle_pdf_poster( WP_Post $attachment, WP_REST_Request $request ): void {
	if ( empty( $request['featured_media'] ) || empty( $request['meta']['mexp_generated_poster_id'] ) ) {
		return;
	}

	$poster_id = $request['meta']['mexp_generated_poster_id'];

	$poster = get_post( $poster_id );

	if ( ! $poster ) {
		return;
	}

	$poster_metadata = wp_get_attachment_metadata( $poster_id );
	$pdf_metadata    = wp_get_attachment_metadata( $attachment->ID );

	$pdf_metadata['sizes']         = $poster_metadata['sizes'];
	$pdf_metadata['sizes']['full'] = [
		'file'      => basename( $poster_metadata['file'] ),
		'width'     => $poster_metadata['width'],
		'height'    => $poster_metadata['height'],
		'mime-type' => $poster->post_mime_type,
		'filesize'  => $poster_metadata['filesize'],
	];

	wp_update_attachment_metadata( $attachment->ID, $pdf_metadata );
}

/**
 * Filters the arguments for registering a post type.
 *
 * @since 4.4.0
 *
 * @param array  $args      Array of arguments for registering a post type.
 *                          See the register_post_type() function for accepted arguments.
 * @param string $post_type Post type key.
 */
function filter_attachment_post_type_args( array $args, string $post_type ) {
	if ( 'attachment' === $post_type ) {
		$args['rest_controller_class'] = REST_Attachments_Controller::class;
	}

	return $args;
}
