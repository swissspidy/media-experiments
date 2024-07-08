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
use WP_REST_Request;
use WP_REST_Response;
use WP_Screen;
use function is_array;
use function register_post_meta;

/**
 * Filters the update response for this plugin.
 *
 * Allows downloading updates from GitHub.
 *
 * @param array<string,mixed>|false $update      The plugin update data with the latest details. Default false.
 * @param array<string,string>      $plugin_data Plugin headers.
 * @param string                    $plugin_file Plugin filename.
 *
 * @return array<string,mixed>|false Filtered update data.
 */
function filter_update_plugins( $update, $plugin_data, string $plugin_file ) {
	if ( MEXP_BASENAME !== $plugin_file ) {
		return $update;
	}

	require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
	$updater = new \WP_Automatic_Updater();

	if ( $updater->is_vcs_checkout( dirname( __DIR__ ) ) ) {
		return $update;
	}

	$response = wp_remote_get( $plugin_data['UpdateURI'] );
	$response = wp_remote_retrieve_body( $response );

	if ( ! $response ) {
		return $update;
	}

	return json_decode( $response, true );
}

/**
 * Sets up cross-origin isolation in the block editor.
 *
 * @codeCoverageIgnore
 *
 * @param WP_Screen $screen Current WP_Screen object.
 * @return void
 */
function set_up_cross_origin_isolation_editor( WP_Screen $screen ): void {
	if ( ! $screen->is_block_editor() && 'site-editor' !== $screen->id && ! ( 'widgets' === $screen->id && wp_use_widgets_block_editor() ) ) {
		return;
	}

	require_once plugin_dir_path( __FILE__ ) . '/class-cross-origin-isolation.php';
	$instance = new Cross_Origin_Isolation();
	$instance->register();
}

/**
 * Returns the given user's persisted media preferences.
 *
 * @param int $user_id User ID.
 * @return array<string, mixed>
 * @phpstan-return array<string, array{bigImageSizeThreshold?: int}>
 */
function get_user_media_preferences( int $user_id ) {
	/**
	 * User preferences.
	 *
	 * @var false|array<string, array<string, array{bigImageSizeThreshold?: int}>> $preferences
	 */
	$preferences = get_user_meta( $user_id, 'wp_persisted_preferences', true );
	if ( ! $preferences ) {
		return [];
	}

	return (array) ( $preferences['media-experiments/preferences'] ?? [] );
}

/**
 * Filters the big image size threshold setting based on user preferences.
 *
 * @param int $threshold The threshold value in pixels.
 * @return int The filtered threshold value.
 */
function filter_big_image_size_threshold( $threshold ) {
	$user_id = get_current_user_id();

	if ( ! $user_id ) {
		return $threshold;
	}

	$preferences = get_user_media_preferences( $user_id );

	if ( isset( $preferences['bigImageSizeThreshold'] ) ) {
		return (int) $preferences['bigImageSizeThreshold'];
	}

	return $threshold;
}

/**
 * Filters whether to output progressive images (if available).
 *
 * @param bool   $interlace Whether to use progressive images for output if available. Default false.
 * @param string $mime_type The mime type being saved.
 * @return bool Whether to use progressive images
 */
function filter_image_save_progressive( $interlace, $mime_type ) {
	$user_id = get_current_user_id();

	if ( ! $user_id ) {
		return $interlace;
	}

	$preferences = get_user_media_preferences( $user_id );

	$ext = explode( '/', $mime_type )[1];

	if ( isset( $preferences[ "${ext}_interlaced" ] ) ) {
		return (bool) $preferences[ "${ext}_interlaced" ];
	}

	return $interlace;
}

/**
 * Register assets used by editor integration and others.
 *
 * @return void
 */
function register_assets(): void {
	$asset_file = dirname( __DIR__ ) . '/build/view-upload-request.asset.php';
	$asset      = is_readable( $asset_file ) ? require $asset_file : [];

	$asset['dependencies'] = $asset['dependencies'] ?? [];
	$asset['version']      = $asset['version'] ?? '';

	wp_register_script(
		'media-experiments-view-upload-request',
		plugins_url( 'build/view-upload-request.js', __DIR__ ),
		$asset['dependencies'],
		$asset['version'],
		array(
			'strategy' => 'defer',
		)
	);

	wp_set_script_translations( 'media-experiments-view-upload-request', 'media-experiments' );

	/** This filter is documented in wp-admin/includes/images.php */
	$image_size_threshold = (int) apply_filters( 'big_image_size_threshold', 2560, array( 0, 0 ), '', 0 ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

	/**
	 * Filters the "BIG video" threshold value.
	 *
	 * If the original video width or height is above the threshold, it will be scaled down. The threshold is
	 * used as max width and max height. The scaled down image will be used as the largest available size, including
	 * the `_wp_attached_file` post meta value.
	 *
	 * Returning `false` from the filter callback will disable the scaling.
	 *
	 * Analogous to {@see 'big_image_size_threshold'} for images.
	 *
	 * @param int $threshold The threshold value in pixels. Default 1920.
	 */
	$video_size_threshold = (int) apply_filters( 'mexp_big_video_size_threshold', 1920 );

	$default_image_output_formats = get_default_image_output_formats();

	$media_source_terms = array_flip(
		get_terms(
			[
				'taxonomy'   => 'mexp_media_source',
				'hide_empty' => false,
				'orderby'    => false,
				'fields'     => 'id=>slug',
			]
		)
	);

	/** This filter is documented in wp-includes/class-wp-image-editor-imagick.php */
	$jpeg_interlaced = (bool) apply_filters( 'image_save_progressive', false, 'image/jpeg' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
	/** This filter is documented in wp-includes/class-wp-image-editor-imagick.php */
	$png_interlaced = (bool) apply_filters( 'image_save_progressive', false, 'image/png' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
	/** This filter is documented in wp-includes/class-wp-image-editor-imagick.php */
	$gif_interlaced = (bool) apply_filters( 'image_save_progressive', false, 'image/gif' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

	wp_add_inline_script(
		'media-experiments-view-upload-request',
		sprintf(
			'window.mediaExperiments = %s;',
			wp_json_encode(
				[
					'availableImageSizes'       => get_all_image_sizes(),
					'bigImageSizeThreshold'     => $image_size_threshold,
					'bigVideoSizeThreshold'     => $video_size_threshold,
					'defaultImageOutputFormats' => (object) $default_image_output_formats,
					'jpegInterlaced'            => $jpeg_interlaced,
					'pngInterlaced'             => $png_interlaced,
					'gifInterlaced'             => $gif_interlaced,
					'mediaSourceTerms'          => $media_source_terms,
				]
			)
		),
		'before'
	);

	wp_register_style(
		'media-experiments-view-upload-request',
		plugins_url( 'build/view-upload-request-view.css', __DIR__ ),
		array( 'wp-components' ),
		$asset['version']
	);

	wp_style_add_data( 'media-experiments-view-upload-request', 'rtl', 'replace' );
}

/**
 * Returns the default output format mapping for the supported image formats.
 *
 * @return array<string,string> Map of input formats to output formats.
 */
function get_default_image_output_formats() {
	$input_formats = [
		'image/jpeg',
		'image/png',
		'image/gif',
		'image/webp',
		'image/avif',
		'image/heic',
	];

	$output_formats = [];

	foreach ( $input_formats as $mime_type ) {
		$output_formats = apply_filters(
			'image_editor_output_format', // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
			$output_formats,
			'',
			$mime_type
		);
	}

	return $output_formats;
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
	$image_size_threshold = (int) apply_filters( 'big_image_size_threshold', 2560, array( 0, 0 ), '', 0 ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

	/** This filter is documented in inc/functions.php */
	$video_size_threshold = (int) apply_filters( 'mexp_big_video_size_threshold', 1920 );

	$default_image_output_formats = get_default_image_output_formats();

	$media_source_terms = array_flip(
		get_terms(
			[
				'taxonomy'   => 'mexp_media_source',
				'hide_empty' => false,
				'orderby'    => false,
				'fields'     => 'id=>slug',
			]
		)
	);

	/** This filter is documented in wp-includes/class-wp-image-editor-imagick.php */
	$jpeg_interlaced = (bool) apply_filters( 'image_save_progressive', false, 'image/jpeg' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
	/** This filter is documented in wp-includes/class-wp-image-editor-imagick.php */
	$png_interlaced = (bool) apply_filters( 'image_save_progressive', false, 'image/png' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
	/** This filter is documented in wp-includes/class-wp-image-editor-imagick.php */
	$gif_interlaced = (bool) apply_filters( 'image_save_progressive', false, 'image/gif' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

	wp_add_inline_script(
		'media-experiments',
		sprintf(
			'window.mediaExperiments = %s;',
			wp_json_encode(
				[
					'availableImageSizes'       => get_all_image_sizes(),
					'bigImageSizeThreshold'     => $image_size_threshold,
					'bigVideoSizeThreshold'     => $video_size_threshold,
					'defaultImageOutputFormats' => (object) $default_image_output_formats,
					'jpegInterlaced'            => $jpeg_interlaced,
					'pngInterlaced'             => $png_interlaced,
					'gifInterlaced'             => $gif_interlaced,
					'mediaSourceTerms'          => $media_source_terms,
				]
			)
		),
		'before'
	);

	wp_enqueue_style(
		'media-experiments-editor',
		plugins_url( 'build/media-experiments.css', __DIR__ ),
		array( 'wp-components' ),
		$asset['version']
	);

	wp_style_add_data( 'media-experiments-editor', 'rtl', 'replace' );

	wp_enqueue_style(
		'media-experiments-upload-requests',
		plugins_url( 'build/upload-requests-modal.css', __DIR__ ),
		array( 'wp-components' ),
		$asset['version']
	);

	wp_style_add_data( 'media-experiments-upload-requests', 'rtl', 'replace' );
}

/**
 * Enqueues scripts for the block editor, iframed.
 *
 * @return void
 */
function enqueue_block_assets(): void {
	if ( ! is_admin() ) {
		return;
	}

	$asset_file = dirname( __DIR__ ) . '/build/media-experiments.asset.php';
	$asset      = is_readable( $asset_file ) ? require $asset_file : [];

	$asset['dependencies'] = $asset['dependencies'] ?? [];
	$asset['version']      = $asset['version'] ?? '';

	wp_enqueue_style(
		'media-experiments-blocks',
		plugins_url( 'build/media-experiments-blocks.css', __DIR__ ),
		array(),
		$asset['version']
	);

	wp_style_add_data( 'media-experiments-blocks', 'rtl', 'replace' );
}

/**
 * Returns a list of all available image sizes.
 *
 * @return array Existing image sizes.
 * @phpstan-return array<string, array<string,string|int>>
 */
function get_all_image_sizes(): array {
	$sizes = wp_get_registered_image_subsizes();

	foreach ( $sizes as $name => &$size ) {
		$size['height'] = (int) $size['height'];
		$size['width']  = (int) $size['width'];
		$size['name']   = $name;
	}
	unset( $size );

	return $sizes;
}

/**
 * Register additional REST fields for attachments.
 *
 * @uses rest_get_attachment_filename
 * @uses rest_get_attachment_filesize
 */
function register_rest_fields(): void {
	register_rest_field(
		'attachment',
		'mexp_filename',
		[
			'schema'       => [
				'description' => __( 'Original attachment file name', 'media-experiments' ),
				'type'        => 'string',
				'context'     => [ 'view', 'edit' ],
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
				'context'     => [ 'view', 'edit' ],
			],
			'get_callback' => __NAMESPACE__ . '\rest_get_attachment_filesize',
		]
	);

	register_rest_field(
		'attachment',
		'mexp_blurhash',
		[
			'schema'       => [
				'description' => __( 'Attachment BlurHash', 'media-experiments' ),
				'type'        => 'string',
				'context'     => [ 'view', 'edit' ],
			],
			'get_callback' => __NAMESPACE__ . '\rest_get_attachment_blurhash',
		]
	);

	register_rest_field(
		'attachment',
		'mexp_dominant_color',
		[
			'schema'       => [
				'description' => __( 'Dominant color of the attachment', 'media-experiments' ),
				'type'        => 'string',
				'context'     => [ 'view', 'edit' ],
			],
			'get_callback' => __NAMESPACE__ . '\rest_get_attachment_dominant_color',
		]
	);

	register_rest_field(
		'attachment',
		'mexp_is_muted',
		[
			'schema'       => [
				'description' => __( 'Whether the video is muted', 'media-experiments' ),
				'type'        => 'boolean',
				'default'     => false,
				'context'     => [ 'view', 'edit' ],
			],
			'get_callback' => __NAMESPACE__ . '\rest_get_attachment_is_muted',
		]
	);

	register_rest_field(
		'attachment',
		'mexp_has_transparency',
		[
			'schema'       => [
				'description' => __( 'Whether the attachment has transparency', 'media-experiments' ),
				'type'        => 'boolean',
				'context'     => [ 'view', 'edit' ],
			],
			'get_callback' => __NAMESPACE__ . '\rest_get_attachment_has_transparency',
		]
	);
}

/**
 * Returns the attachment's original file name.
 *
 * @param array $post Post data.
 * @return string|null Attachment file name.
 * @phpstan-param array{id: int} $post
 */
function rest_get_attachment_filename( array $post ): ?string {
	$path = wp_get_original_image_path( $post['id'] );

	if ( $path ) {
		return basename( $path );
	}

	$path = get_attached_file( $post['id'] );

	if ( $path ) {
		return basename( $path );
	}

	return null;
}

/**
 * Returns the attachment's file size in bytes.
 *
 * @param array $post Post data.
 * @return int|null Attachment file size.
 * @phpstan-param array{id: int} $post
 */
function rest_get_attachment_filesize( array $post ): ?int {
	return get_attachment_filesize( $post['id'] );
}

/**
 * Returns the attachment's file size in bytes.
 *
 * @param int $attachment_id Attachment ID.
 * @return int|null Attachment file size.
 */
function get_attachment_filesize( int $attachment_id ): ?int {
	$meta = wp_get_attachment_metadata( $attachment_id );

	if ( isset( $meta['filesize'] ) ) {
		return $meta['filesize'];
	}

	$original_path = wp_get_original_image_path( $attachment_id );
	$attached_file = $original_path ? $original_path : get_attached_file( $attachment_id );

	if ( is_string( $attached_file ) && file_exists( $attached_file ) ) {
		return wp_filesize( $attached_file );
	}

	return null;
}

/**
 * Returns the attachment's BlurHash.
 *
 * @param array $post Post data.
 * @return string|null Attachment BlurHash.
 */
function rest_get_attachment_blurhash( array $post ): ?string {
	$meta = wp_get_attachment_metadata( $post['id'] );
	return $meta['blurhash'] ?? null;
}

/**
 * Returns the attachment's dominant color.
 *
 * @param array $post Post data.
 * @return int|null Attachment dominant color.
 */
function rest_get_attachment_dominant_color( array $post ): ?string {
	$meta = wp_get_attachment_metadata( $post['id'] );
	return $meta['dominant_color'] ?? null;
}

/**
 * Returns whether the attachment is muted.
 *
 * @param array $post Post data.
 * @return bool Whether attachment is muted.
 */
function rest_get_attachment_is_muted( array $post ): bool {
	$meta = wp_get_attachment_metadata( $post['id'] );
	return isset( $meta['is_muted'] ) && $meta['is_muted'];
}

/**
 * Returns whether the attachment has transparency (alpha channel).
 *
 * @param array $post Post data.
 * @return bool|null Whether attachment has transparency.
 */
function rest_get_attachment_has_transparency( array $post ): ?bool {
	$meta = wp_get_attachment_metadata( $post['id'] );
	return isset( $meta['has_transparency'] ) ? (bool) $meta['has_transparency'] : null;
}

/**
 * Registers additional post meta for the attachment post type.
 *
 * @return void
 */
function register_attachment_post_meta(): void {
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
		'mexp_optimized_id',
		[
			'type'              => 'integer',
			'description'       => __( 'The ID of the optimized version for the object.', 'media-experiments' ),
			'show_in_rest'      => true,
			'single'            => true,
			'default'           => 0,
			'sanitize_callback' => 'absint',
		]
	);

	register_post_meta(
		'attachment',
		'mexp_original_id',
		[
			'type'              => 'integer',
			'description'       => __( 'The ID of the original version for the object.', 'media-experiments' ),
			'show_in_rest'      => true,
			'single'            => true,
			'default'           => 0,
			'sanitize_callback' => 'absint',
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
			'public'       => false,
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
	wp_insert_term( 'subtitles-generation', 'mexp_media_source' );
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
 * Fires after a single attachment is completely created or updated via the REST API.
 *
 * Adds image sub sizes metadata for PDFs in the format WordPress core expects.
 *
 * @link https://github.com/WordPress/wordpress-develop/blob/8a5daa6b446e8c70ba22d64820f6963f18d36e92/src/wp-admin/includes/image.php#L609-L634
 *
 * @param WP_Post         $attachment Inserted or updated attachment object.
 * @param WP_REST_Request $request    Request object.
 * @phpstan-param WP_REST_Request<array{featured_media: int, meta: array{mexp_generated_poster_id: int}}> $request
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

	if ( is_array( $pdf_metadata ) && is_array( $poster_metadata ) ) {
		$pdf_metadata['sizes']         = $poster_metadata['sizes'];
		$pdf_metadata['sizes']['full'] = [
			'width'     => $poster_metadata['width'],
			'height'    => $poster_metadata['height'],
			'mime_type' => $poster->post_mime_type,
			'filesize'  => $poster_metadata['filesize'],
		];

		if ( isset( $poster_metadata['file'] ) ) {
			$pdf_metadata['sizes']['full']['file'] = basename( $poster_metadata['file'] );
		}

		wp_update_attachment_metadata( $attachment->ID, $pdf_metadata );
	}
}

/**
 * Fires after a single attachment is completely created or updated via the REST API.
 *
 * Copies metadata from the original if missing, e.g. if converting to AVIF
 * and the server does not natively support the format. In those cases,
 * {@see wp_create_image_subsizes()} will not return the required metadata.
 *
 * @link https://github.com/swissspidy/media-experiments/issues/237
 *
 * @param WP_Post         $attachment Inserted or updated attachment object.
 * @param WP_REST_Request $request    Request object.
 * @phpstan-param WP_REST_Request<array{meta: array{mexp_original_id: int}}> $request
 */
function rest_after_insert_attachment_copy_metadata( WP_Post $attachment, WP_REST_Request $request ): void {
	if ( empty( $request['meta']['mexp_original_id'] ) ) {
		return;
	}

	$original_id = $request['meta']['mexp_original_id'];

	$original_attachment = get_post( $original_id );

	if ( ! $original_attachment ) {
		return;
	}

	/**
	 * Filters the generated attachment meta data.
	 *
	 * @param array  $metadata      An array of attachment meta data.
	 * @param int    $attachment_id Current attachment ID.
	 * @return array Filtered meta data.
	 */
	$filter_attachment_metadata = static function ( array $metadata, int $attachment_id ) use ( $original_id, $attachment ) {
		// TODO: Remove filter again here?

		if ( $attachment_id !== $attachment->ID ) {
			return $metadata;
		}

		$original_metadata = wp_get_attachment_metadata( $original_id );

		$keys = [ 'width', 'height' ];
		foreach ( $keys as $key ) {
			if ( ! isset( $metadata[ $key ] ) && isset( $original_metadata[ $key ] ) ) {
				$metadata[ $key ] = $original_metadata[ $key ];
			}
		}

		if ( ! isset( $metadata['file'] ) ) {
			$attached_file = get_attached_file( $attachment_id );
			if ( $attached_file ) {
				$metadata['file'] = _wp_relative_upload_path( $attached_file );
			}
		}

		return $metadata;
	};

	add_filter( 'wp_generate_attachment_metadata', $filter_attachment_metadata, 10, 2 );
}

/**
 * Fires after a single attachment is completely created or updated via the REST API.
 *
 * Inserts additional information from provided REST fields to generated attachment metadata.
 *
 * @param WP_Post         $attachment Inserted or updated attachment object.
 * @param WP_REST_Request $request    Request object.
 * @phpstan-param WP_REST_Request<array{mexp_blurhash?: string, mexp_dominant_color?: string, mexp_is_muted?: bool, mexp_has_transparency?: bool}> $request
 */
function rest_after_insert_attachment_insert_additional_metadata( WP_Post $attachment, WP_REST_Request $request ): void {
	/**
	 * Filters the generated attachment meta data.
	 *
	 * @param array  $metadata      An array of attachment meta data.
	 * @param int    $attachment_id Current attachment ID.
	 * @return array Filtered meta data.
	 */
	$filter_attachment_metadata = static function ( array $metadata, int $attachment_id ) use ( $attachment, $request ) {
		// TODO: Remove filter again here?

		if ( $attachment_id !== $attachment->ID ) {
			return $metadata;
		}

		if ( isset( $request['mexp_blurhash'] ) ) {
			$metadata['blurhash'] = sanitize_text_field( $request['mexp_blurhash'] );
		}

		if ( isset( $request['mexp_dominant_color'] ) ) {
			$metadata['dominant_color'] = sanitize_text_field( $request['mexp_dominant_color'] );
		}

		if ( isset( $request['mexp_is_muted'] ) ) {
			$metadata['is_muted'] = rest_sanitize_boolean( $request['mexp_is_muted'] );
		}

		if ( isset( $request['mexp_has_transparency'] ) ) {
			$metadata['has_transparency'] = rest_sanitize_boolean( $request['mexp_has_transparency'] );
		}

		return $metadata;
	};

	add_filter( 'wp_generate_attachment_metadata', $filter_attachment_metadata, 10, 2 );
}

/**
 * Filters the arguments for registering a post type.
 *
 * @since 4.4.0
 *
 * @param array  $args      Array of arguments for registering a post type.
 *                          See the register_post_type() function for accepted arguments.
 * @param string $post_type Post type key.
 * @phpstan-param array<string, mixed> $args
 * @phpstan-return array<string, mixed>
 */
function filter_attachment_post_type_args( array $args, string $post_type ): array {
	if ( 'attachment' === $post_type ) {
		$args['rest_controller_class'] = REST_Attachments_Controller::class;
	}

	return $args;
}

/**
 * Filters the attachment data prepared for JavaScript.
 *
 * @param array $response Array of prepared attachment data. See {@see wp_prepare_attachment_for_js()}.
 * @return array Filtered attachment data.
 * @phpstan-param array<string, mixed> $response
 * @phpstan-return array<string, mixed>
 */
function filter_wp_prepare_attachment_for_js( array $response ): array {
	/**
	 * Post ID.
	 *
	 * @var int $id
	 */
	$id = $response['id'];

	$terms = get_the_terms( $id, 'mexp_media_source' );

	$response['mexp_media_source'] = is_array( $terms ) ? wp_list_pluck( $terms, 'term_id' ) : [];

	return $response;
}

/**
 * Filter image tags in content to add more beautiful placeholders.
 *
 * Uses BlurHash-powered CSS gradients with a fallback
 * to a solid background color.
 *
 * @param string $filtered_image The image tag.
 * @param string $context        The context of the image.
 * @param int    $attachment_id  The attachment ID.
 * @return string The filtered image tag.
 */
function filter_wp_content_img_tag_add_placeholders( string $filtered_image, string $context, int $attachment_id ): string {
	if ( ! str_contains( $filtered_image, ' src="' ) ) {
		return $filtered_image;
	}

	$class_name = 'mexp-placeholder-' . $attachment_id;

	// Ensure to not run the logic below in case relevant attributes are already present.
	if ( str_contains( $filtered_image, $class_name ) ) {
		return $filtered_image;
	}

	$meta = wp_get_attachment_metadata( $attachment_id );

	if ( ! $meta ) {
		return $filtered_image;
	}

	if ( isset( $meta['has_transparency'] ) && $meta['has_transparency'] ) {
		return $filtered_image;
	}

	$dominant_color = $meta['dominant_color'] ?? null;
	$blurhash       = $meta['blurhash'] ?? null;

	if ( ! is_string( $dominant_color ) && ! is_string( $blurhash ) ) {
		return $filtered_image;
	}

	if ( is_string( $dominant_color ) ) {
		wp_register_style( 'mexp-placeholder', false ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion
		wp_enqueue_style( 'mexp-placeholder' );
		wp_add_inline_style( 'mexp-placeholder', sprintf( '.mexp-placeholder-%1$s { background-color: %2$s; }', $attachment_id, $dominant_color ) );
	}

	// BlurHash conversion is completely untested. Probably contains faulty logic.
	if ( is_string( $blurhash ) && ! empty( $blurhash ) ) {
		try {
			$pixels = BlurHash::decode( $blurhash, 4, 3 );

			$gradients = [];

			$rows    = count( $pixels );
			$columns = count( $pixels[0] );

			foreach ( $pixels as $row => $r ) {
				foreach ( $r as $column => $pixel ) {
					$c = $column % $columns;
					$r = $row % $rows;

					$percent_x = round( ( $c / ( $columns - 1 ) ) * 100 );
					$percent_y = round( ( $r / ( $rows - 1 ) ) * 100 );

					[ $r, $g, $b ] = $pixel;
					$rgb           = sprintf( '#%02x%02x%02x', $r, $g, $b );

					$gradients[] = sprintf(
						'radial-gradient(at %1$s%% %2$s%%, %3$s, #00000000 50%%)',
						$percent_x,
						$percent_y,
						$rgb
					);
				}
			}

			wp_register_style( 'mexp-placeholder', false ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion
			wp_enqueue_style( 'mexp-placeholder' );

			wp_add_inline_style( 'mexp-placeholder', sprintf( '.mexp-placeholder-%1$s { background-image: %2$s; }', $attachment_id, join( ',', $gradients ) ) );
		} catch ( \InvalidArgumentException $exception ) {
			// TODO: Investigate error, which is likely because of a blurhash length mismatch.
		}
	}

	return str_replace( ' class="', ' class="' . $class_name . ' ', $filtered_image );
}

/**
 * Registers post type and post meta for upload requests.

 * @return void
 */
function register_upload_request_post_type(): void {
	require_once __DIR__ . '/class-rest-upload-requests-controller.php';

	register_post_type(
		'mexp-upload-request',
		[
			'labels'                => [
				'name'                     => _x( 'Upload Requests', 'post type general name', 'media-experiments' ),
				'singular_name'            => _x( 'Upload Request', 'post type singular name', 'media-experiments' ),
				'add_new'                  => __( 'Add New Upload Request', 'media-experiments' ),
				'add_new_item'             => __( 'Add New Upload Request', 'media-experiments' ),
				'edit_item'                => __( 'Edit Upload Request', 'media-experiments' ),
				'new_item'                 => __( 'New Upload Request', 'media-experiments' ),
				'view_item'                => __( 'View Upload Request', 'media-experiments' ),
				'view_items'               => __( 'View Upload Requests', 'media-experiments' ),
				'search_items'             => __( 'Search Upload Requests', 'media-experiments' ),
				'not_found'                => __( 'No upload requests found.', 'media-experiments' ),
				'not_found_in_trash'       => __( 'No upload requests found in Trash.', 'media-experiments' ),
				'all_items'                => __( 'All Upload Requests', 'media-experiments' ),
				'archives'                 => __( 'Upload Request Archives', 'media-experiments' ),
				'attributes'               => __( 'Upload Request Attributes', 'media-experiments' ),
				'insert_into_item'         => __( 'Insert into upload request', 'media-experiments' ),
				'uploaded_to_this_item'    => __( 'Uploaded to this upload request', 'media-experiments' ),
				'featured_image'           => _x( 'Featured Image', 'upload request', 'media-experiments' ),
				'set_featured_image'       => _x( 'Set featured image', 'upload request', 'media-experiments' ),
				'remove_featured_image'    => _x( 'Remove featured image', 'upload request', 'media-experiments' ),
				'use_featured_image'       => _x( 'Use as featured image', 'upload request', 'media-experiments' ),
				'filter_items_list'        => __( 'Filter upload requests list', 'media-experiments' ),
				'filter_by_date'           => __( 'Filter by date', 'media-experiments' ),
				'items_list_navigation'    => __( 'Upload Requests list navigation', 'media-experiments' ),
				'items_list'               => __( 'Upload Requests list', 'media-experiments' ),
				'item_published'           => __( 'Upload Request published.', 'media-experiments' ),
				'item_published_privately' => __( 'Upload Request published privately.', 'media-experiments' ),
				'item_reverted_to_draft'   => __( 'Upload Request reverted to draft.', 'media-experiments' ),
				'item_scheduled'           => __( 'Upload Request scheduled', 'media-experiments' ),
				'item_updated'             => __( 'Upload Request updated.', 'media-experiments' ),
				'menu_name'                => _x( 'Upload Requests', 'admin menu', 'media-experiments' ),
				'name_admin_bar'           => _x( 'Upload Request', 'add new on admin bar', 'media-experiments' ),
				'item_link'                => _x( 'Upload Request Link', 'navigation link block title', 'media-experiments' ),
				'item_link_description'    => _x( 'A link to a upload request.', 'navigation link block description', 'media-experiments' ),
				'item_trashed'             => __( 'Upload Request trashed.', 'media-experiments' ),
			],
			'supports'              => [
				'author',
				'custom-fields',
			],
			'map_meta_cap'          => true,
			'capabilities'          => [
				// You need to be able to upload media in order to create upload requests.
				'create_posts'           => 'upload_files',
				// Anyone can read an upload request to upload files.
				'read'                   => 'read',
				// You need to be able to publish posts, in order to create blocks.
				'edit_posts'             => 'edit_posts',
				'edit_published_posts'   => 'edit_published_posts',
				'delete_published_posts' => 'delete_published_posts',
				// Enables trashing draft posts as well.
				'delete_posts'           => 'delete_posts',
				'edit_others_posts'      => 'edit_others_posts',
				'delete_others_posts'    => 'delete_others_posts',
			],
			'rewrite'               => [
				'slug'       => 'upload',
				'with_front' => false,
				'feeds'      => false,
			],
			'public'                => false,
			'has_archive'           => false,
			'show_ui'               => false,
			'can_export'            => false,
			'exclude_from_search'   => true,
			'publicly_queryable'    => true,
			'show_in_rest'          => true,
			'delete_with_user'      => true,
			'rest_base'             => 'upload-requests',
			'rest_controller_class' => REST_Upload_Requests_Controller::class,
		]
	);

	register_post_meta(
		'mexp-upload-request',
		'mexp_attachment_id',
		[
			'type'         => 'number',
			'description'  => __( 'Associated attachment ID.', 'media-experiments' ),
			'show_in_rest' => [
				'schema' => [
					'type' => 'number',
				],
			],
		]
	);

	register_post_meta(
		'mexp-upload-request',
		'mexp_allowed_types',
		[
			'type'         => 'string',
			'description'  => __( 'Allowed media types.', 'media-experiments' ),
			'show_in_rest' => [
				'schema' => [
					'type'  => 'array',
					'items' => [
						'type' => 'string',
						'enum' => [ 'image', 'video', 'audio' ],
					],
				],
			],
			'single'       => true,
		]
	);

	// See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#Unique_file_type_specifiers.
	register_post_meta(
		'mexp-upload-request',
		'mexp_accept',
		[
			'type'         => 'string',
			'description'  => __( 'List of allowed file types.', 'media-experiments' ),
			'show_in_rest' => [
				'schema' => [
					'type'  => 'array',
					'items' => [
						'type' => 'string',
					],
				],
			],
			'single'       => true,
		]
	);

	register_post_meta(
		'mexp-upload-request',
		'mexp_multiple',
		[
			'type'         => 'string',
			'description'  => __( 'Whether multiple files are allowed.', 'media-experiments' ),
			'show_in_rest' => [
				'schema' => [
					'type' => 'boolean',
				],
			],
			'single'       => true,
		]
	);
}

/**
 * Filters the REST API route for a post.

 * @param string  $route The route path.
 * @param WP_Post $post  The post object.
 * @return string Filtered route path.
 */
function filter_rest_route_for_post_for_upload_requests( string $route, WP_Post $post ): string {
	if ( 'mexp-upload-request' === $post->post_type ) {
		$post_type_route = rest_get_route_for_post_type_items( $post->post_type );

		return sprintf( '%s/%s', $post_type_route, $post->post_name );
	}

	return $route;
}

/**
 * Filters the path of the queried template for single upload requests.
 *
 * @codeCoverageIgnore
 *
 * @param string $template Template path.
 * @return string Filtered template path.
 */
function load_upload_request_template( string $template ): string {
	if ( is_singular( 'mexp-upload-request' ) ) {
		require_once plugin_dir_path( __FILE__ ) . '/class-cross-origin-isolation.php';
		$instance = new Cross_Origin_Isolation();
		$instance->register();
		$instance->send_headers();

		return __DIR__ . '/templates/upload-request.php';
	}

	return $template;
}

/**
 * Adds a new cron schedule for running every 15 minutes.
 *
 * @param array $schedules Cron schedules.
 * @return array Filtered cron schedules.
 * @phpstan-param array<string, array{interval: int, display: string}> $schedules
 * @phpstan-return array<string, array{interval: int, display: string}>
 */
function add_quarter_hourly_cron_interval( array $schedules ): array {
	$schedules['quarter_hourly'] = [
		'interval' => 15 * MINUTE_IN_SECONDS,
		'display'  => __( 'Every 15 Minutes', 'media-experiments' ),
	];

	return $schedules;
}

/**
 * Delete unresolved upload requests that are older than 15 minutes.
 *
 * @return void
 */
function delete_old_upload_requests(): void {
	$args = [
		'post_type'        => 'mexp-upload-request',
		'post_status'      => 'publish',
		'numberposts'      => -1,
		'date_query'       => [
			[
				'before'    => '15 minutes ago',
				'inclusive' => true,
			],
		],
		'suppress_filters' => false,
	];

	$posts = get_posts( $args );

	foreach ( $posts as $post ) {
		wp_delete_post( $post->ID, true );
	}
}

/**
 * Plugin activation hook.
 *
 * @codeCoverageIgnore
 *
 * @return void
 */
function activate_plugin(): void {
	register_upload_request_post_type();

	flush_rewrite_rules( false );

	if ( false === wp_next_scheduled( 'mexp_upload_requests_cleanup' ) ) {
		wp_schedule_event( time(), 'quarter_hourly', 'mexp_upload_requests_cleanup' );
	}
}

/**
 * Plugin deactivation hook.
 *
 * @codeCoverageIgnore
 *
 * @return void
 */
function deactivate_plugin(): void {
	unregister_post_type( 'mexp-upload-request' );

	flush_rewrite_rules( false );

	$timestamp = wp_next_scheduled( 'mexp_upload_requests_cleanup' );
	if ( false !== $timestamp ) {
		wp_unschedule_event( $timestamp, 'mexp_upload_requests_cleanup' );
	}
}

/**
 * Filters REST API responses to add Server-Timing header.
 *
 * @codeCoverageIgnore
 *
 * @param WP_REST_Response|WP_Error $response Result to send to the client. Usually a `WP_REST_Response`.
 * @return WP_REST_Response|WP_Error Filtered response.
 */
function rest_post_dispatch_add_server_timing( $response ) {
	if ( ! defined( 'REST_REQUEST' ) || ! REST_REQUEST ) {
		return $response;
	}

	if ( ! function_exists( 'perflab_server_timing' ) || ! $response instanceof WP_REST_Response ) {
		return $response;
	}

	$server_timing = perflab_server_timing();

	do_action( 'perflab_server_timing_send_header' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

	$response->header( 'Server-Timing', $server_timing->get_header() );

	return $response;
}
