<?php
/**
 * Collection of functions.
 *
 * @package MediaExperiments
 */

declare(strict_types = 1);

namespace MediaExperiments;

use InvalidArgumentException;
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
 * @codeCoverageIgnore
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

	if ( '' === $response ) {
		return $update;
	}

	/**
	 * Encoded update data.
	 *
	 * @var array<string,mixed> $result
	 */
	$result = json_decode( $response, true );

	return $result;
}

/**
 * Determines whether "full" cross-origin isolation is needed.
 *
 * By default, `crossorigin="anonymous"` attributes are added to all external
 * resources to make sure they can be accessed programmatically (e.g. by html-to-image).
 *
 * However, actual cross-origin isolation by sending COOP and COEP headers is only
 * needed when video optimization is enabled
 *
 * @link https://web.dev/coop-coep/
 *
 * @return bool Whether the conditional object is needed.
 */
function needs_cross_origin_isolation(): bool {
	// See https://github.com/WordPress/wordpress-playground/issues/952.
	if ( defined( 'MEXP_IS_PLAYGROUND' ) && MEXP_IS_PLAYGROUND ) {
		return false;
	}

	if ( is_singular( 'mexp-upload-request' ) ) {
		return true;
	}

	$user_id = get_current_user_id();
	if ( 0 === $user_id ) {
		return false;
	}

	// Cross-origin isolation is not needed if users can't upload files anyway.
	if ( ! user_can( $user_id, 'upload_files' ) ) {
		return false;
	}

	return true;
}

/**
 * Enables cross-origin isolation in the block editor.
 *
 * Required for enabling SharedArrayBuffer for WebAssembly-based
 * media processing in the editor.
 *
 * @link https://web.dev/coop-coep/
 *
 * @codeCoverageIgnore
 */
function start_cross_origin_isolation_output_buffer(): void {
	global $is_safari;

	$coep = $is_safari ? 'require-corp' : 'credentialless';

	ob_start(
		function ( string $output, ?int $phase ) use ( $coep ): string {
			// Only send the header when the buffer is not being cleaned.
			if ( ( $phase & PHP_OUTPUT_HANDLER_CLEAN ) === 0 ) {
				header( 'Cross-Origin-Opener-Policy: same-origin' );
				header( "Cross-Origin-Embedder-Policy: $coep" );

				$output = add_crossorigin_attributes( $output );
			}

			return $output;
		}
	);
}

/**
 * Adds crossorigin="anonymous" to relevant tags in the given HTML string.
 *
 * @param string $html HTML input.
 *
 * @return string Modified HTML.
 */
function add_crossorigin_attributes( string $html ): string {
	$site_url = site_url();

	$processor = new \WP_HTML_Tag_Processor( $html );

	// See https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin.
	$tags = [
		'AUDIO'  => 'src',
		'IMG'    => 'src',
		'LINK'   => 'href',
		'SCRIPT' => 'src',
		'VIDEO'  => 'src',
		'SOURCE' => 'src',
	];

	$tag_names = array_keys( $tags );

	while ( $processor->next_tag() ) {
		$tag = $processor->get_tag();

		if ( ! in_array( $tag, $tag_names, true ) ) {
			continue;
		}

		if ( 'AUDIO' === $tag || 'VIDEO' === $tag ) {
			$processor->set_bookmark( 'audio-video-parent' );
		}

		$processor->set_bookmark( 'resume' );

		$seeked = false;

		$crossorigin = $processor->get_attribute( 'crossorigin' );

		$url = $processor->get_attribute( $tags[ $tag ] );

		if ( is_string( $url ) && ! str_starts_with( $url, $site_url ) && ! str_starts_with( $url, '/' ) && ! is_string( $crossorigin ) ) {
			if ( 'SOURCE' === $tag ) {
				$seeked = $processor->seek( 'audio-video-parent' );

				if ( $seeked ) {
					$processor->set_attribute( 'crossorigin', 'anonymous' );
				}
			} else {
				$processor->set_attribute( 'crossorigin', 'anonymous' );
			}

			if ( $seeked ) {
				$processor->seek( 'resume' );
				$processor->release_bookmark( 'audio-video-parent' );
			}
		}
	}

	return $processor->get_updated_html();
}

/**
 * Sets up cross-origin isolation in the block editor.
 *
 * @codeCoverageIgnore
 *
 * @return void
 */
function set_up_cross_origin_isolation_editor(): void {
	$screen = get_current_screen();

	if ( ! $screen instanceof WP_Screen ) {
		return;
	}

	if ( ! $screen->is_block_editor() && 'site-editor' !== $screen->id && ! ( 'widgets' === $screen->id && wp_use_widgets_block_editor() ) ) {
		return;
	}

	if ( ! needs_cross_origin_isolation() ) {
		return;
	}

	start_cross_origin_isolation_output_buffer();
}

/**
 * Overrides templates from wp_print_media_templates with custom ones.
 *
 * Adds `crossorigin` attribute to all tags that
 * could have assets loaded from a different domain.
 */
function override_media_templates(): void {
	remove_action( 'admin_footer', 'wp_print_media_templates' );
	add_action(
		'admin_footer',
		static function (): void {
			ob_start();
			wp_print_media_templates();
			$html = (string) ob_get_clean();

			$tags = [
				'audio',
				'img',
				'video',
			];

			foreach ( $tags as $tag ) {
				$html = str_replace( "<$tag", "<$tag crossorigin=\"anonymous\"", $html );
			}

			echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
	);
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
		start_cross_origin_isolation_output_buffer();

		return __DIR__ . '/templates/upload-request.php';
	}

	return $template;
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
	if ( empty( $preferences ) ) {
		return [];
	}

	return ( $preferences['media-experiments/preferences'] ?? [] );
}

/**
 * Filters the big image size threshold setting based on user preferences.
 *
 * @param int $threshold The threshold value in pixels.
 * @return int The filtered threshold value.
 */
function filter_big_image_size_threshold( int $threshold ): int {
	$user_id = get_current_user_id();

	if ( 0 === $user_id ) {
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
function filter_image_save_progressive( bool $interlace, string $mime_type ): bool {
	$user_id = get_current_user_id();

	if ( 0 === $user_id ) {
		return $interlace;
	}

	$preferences = get_user_media_preferences( $user_id );

	$ext = explode( '/', $mime_type )[1];

	if ( isset( $preferences[ "{$ext}_interlaced" ] ) ) {
		return (bool) $preferences[ "{$ext}_interlaced" ];
	}

	return $interlace;
}

/**
 * Filters the list of mime types and file extensions.
 *
 * Adds support for JPEG XL (JXL).
 *
 * @param array<string, string> $mime_types Mime types keyed by the file extension regex
 *                                          corresponding to those types.
 * @return array<string, string> Filtered list of mime types
 */
function filter_mime_types( array $mime_types ): array {
	$mime_types['jxl'] = 'image/jxl';
	return $mime_types;
}

/**
 * Filters file type based on the extension name.
 *
 * Adds support for JPEG XL (JXL).
 *
 * @param array<string, string[]> $ext2type Multi-dimensional array of file extensions types keyed by the type of file.
 * @return array<string, string[]> Filtered array of file extensions.
 */
function filter_ext2type( array $ext2type ): array {
	$ext2type['image'][] = 'jxl';
	return $ext2type;
}

/**
 * Filters the list mapping image mime types to their respective extensions.
 *
 * Adds support for JPEG XL (JXL).
 *
 * @param array<string, string> $mime_to_ext Array of image mime types and their matching extensions.
 * @return array<string, string> Filtered array of mime types and their extensions.
 */
function filter_getimagesize_mimes_to_exts( array $mime_to_ext ): array {
	$mime_to_ext['image/jxl'] = 'jxl';
	return $mime_to_ext;
}

/**
 * Filters the "real" file type of the given file.
 *
 * Adds support for JPEG XL (JXL).
 *
 * @param array         $wp_check_filetype_and_ext Values for the extension, mime type, and corrected filename.
 * @param string        $file Full path to the file.
 * @param string        $filename                  The name of the file (may differ from $file due to
 *                                                 $file being in a tmp directory).
 * @param string[]|null $mimes                     Array of mime types keyed by their file extension regex, or null if
 *                                                 none were provided.
 * @return array Filtered values.
 *
 * @phpstan-param array{ext: string|false, type: string|false, proper_filename: string|false} $wp_check_filetype_and_ext
 * @phpstan-return array{ext: string|false, type: string|false, proper_filename: string|false}
 */
function filter_wp_check_filetype_and_ext( array $wp_check_filetype_and_ext, string $file, string $filename, ?array $mimes ): array {
	if ( false !== $wp_check_filetype_and_ext['ext'] && false !== $wp_check_filetype_and_ext['type'] ) {
		return $wp_check_filetype_and_ext;
	}

	// Do basic extension validation and MIME mapping.
	$wp_filetype = wp_check_filetype( $filename, $mimes );
	$type        = $wp_filetype['type'];

	if ( false === $type || ! str_starts_with( $type, 'image/' ) ) {
		return $wp_check_filetype_and_ext;
	}

	$magic = file_get_contents( $file, false, null, 0, 12 );

	if ( false === $magic ) {
		return $wp_check_filetype_and_ext;
	}

	$magic = bin2hex( $magic );

	// See https://en.wikipedia.org/wiki/JPEG_XL.
	if (
		str_starts_with( $magic, 'ff0a' ) ||
		str_starts_with( $magic, '0000000c4a584c200d0a870a' )
	) {
		$wp_check_filetype_and_ext['ext']  = 'jxl';
		$wp_check_filetype_and_ext['type'] = 'image/jxl';
	}

	return $wp_check_filetype_and_ext;
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

	wp_enqueue_style(
		'media-experiments-editor',
		plugins_url( 'build/media-experiments.css', __DIR__ ),
		array( 'wp-components' ),
		$asset['version']
	);

	wp_style_add_data( 'media-experiments-editor', 'rtl', 'replace' );
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
 * Returns a list of all available video sizes.
 *
 * Similar to image sizes, but for videos to enable responsive video delivery.
 *
 * @return array Available video sizes.
 * @phpstan-return array<string, array<string,string|int>>
 */
function get_all_video_sizes(): array {
	/**
	 * Filters the list of video sizes.
	 *
	 * Allows plugins to customize the available video sizes for responsive video delivery.
	 *
	 * @param array $sizes Video sizes keyed by name.
	 * @phpstan-param array<string, array{width: int, height: int, name: string}> $sizes
	 */
	$sizes = apply_filters(
		'mexp_video_sizes',
		[
			'mexp-video-240'  => [
				'width'  => 426,
				'height' => 240,
				'name'   => 'mexp-video-240',
			],
			'mexp-video-360'  => [
				'width'  => 640,
				'height' => 360,
				'name'   => 'mexp-video-360',
			],
			'mexp-video-480'  => [
				'width'  => 854,
				'height' => 480,
				'name'   => 'mexp-video-480',
			],
			'mexp-video-720'  => [
				'width'  => 1280,
				'height' => 720,
				'name'   => 'mexp-video-720',
			],
			'mexp-video-1080' => [
				'width'  => 1920,
				'height' => 1080,
				'name'   => 'mexp-video-1080',
			],
		]
	);

	return $sizes;
}

/**
 * Register additional REST fields for attachments.
 *
 * @todo Expose these in embed context as well?
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

	register_rest_field(
		'attachment',
		'mexp_original_url',
		[
			'schema'       => [
				'description' => __( 'URL of the original file if this is an optimized one', 'media-experiments' ),
				'type'        => 'string',
				'context'     => [ 'view', 'edit' ],
			],
			'get_callback' => __NAMESPACE__ . '\rest_get_attachment_original_url',
		]
	);

	register_rest_field(
		'attachment',
		'missing_video_sizes',
		[
			'schema'       => [
				'description' => __( 'List of video sizes that are missing for the attachment', 'media-experiments' ),
				'type'        => 'array',
				'items'       => [
					'type' => 'string',
				],
				'context'     => [ 'edit' ],
			],
			'get_callback' => __NAMESPACE__ . '\rest_get_attachment_missing_video_sizes',
		]
	);
}

/**
 * Filters the REST API root index data to add custom settings.
 *
 * @param WP_REST_Response $response Response data.
 */
function filter_rest_index( WP_REST_Response $response ): WP_REST_Response {
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
	$video_size_threshold = apply_filters( 'mexp_big_video_size_threshold', 1920 );

	$default_image_output_formats = get_default_image_output_formats();

	// @phpstan-ignore function.internal (false positive)
	$media_source_terms = get_terms(
		[
			'taxonomy'   => 'mexp_media_source',
			'hide_empty' => false,
			'orderby'    => 'none',
			'fields'     => 'id=>slug',
		]
	);

	$media_source_terms = ! is_wp_error( $media_source_terms ) ? array_flip( $media_source_terms ) : [];

	/** This filter is documented in wp-includes/class-wp-image-editor-imagick.php */
	$jpeg_interlaced = apply_filters( 'image_save_progressive', false, 'image/jpeg' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
	/** This filter is documented in wp-includes/class-wp-image-editor-imagick.php */
	$png_interlaced = apply_filters( 'image_save_progressive', false, 'image/png' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
	/** This filter is documented in wp-includes/class-wp-image-editor-imagick.php */
	$gif_interlaced = apply_filters( 'image_save_progressive', false, 'image/gif' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

	$response->data['image_sizes']          = get_all_image_sizes();
	$response->data['video_sizes']          = get_all_video_sizes();
	$response->data['image_size_threshold'] = $image_size_threshold;
	$response->data['video_size_threshold'] = $video_size_threshold;
	$response->data['image_output_formats'] = (object) $default_image_output_formats;
	$response->data['jpeg_interlaced']      = $jpeg_interlaced;
	$response->data['png_interlaced']       = $png_interlaced;
	$response->data['gif_interlaced']       = $gif_interlaced;
	$response->data['media_source_terms']   = $media_source_terms;

	return $response;
}

/**
 * Returns the attachment's original file name.
 *
 * Strips any "-original" or "-scaled" suffix from the file name.
 *
 * @param array $post Post data.
 * @return string|null Attachment file name.
 * @phpstan-param array{id: int} $post
 */
function rest_get_attachment_filename( array $post ): ?string {
	$path = get_attached_file( $post['id'] );

	if ( false === $path ) {
		return null;
	}

	$basename = strtolower( pathinfo( $path, PATHINFO_FILENAME ) );
	$ext      = strtolower( pathinfo( $path, PATHINFO_EXTENSION ) );

	$suffix = '-scaled';
	if ( str_ends_with( $basename, $suffix ) ) {
		$basename = substr( $basename, 0, - strlen( $suffix ) );
	}

	return "$basename.$ext";
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
	$attached_file = is_string( $original_path ) ? $original_path : get_attached_file( $attachment_id );

	if ( is_string( $attached_file ) && file_exists( $attached_file ) ) {
		return wp_filesize( $attached_file );
	}

	return null;
}

/**
 * Returns the attachment's BlurHash.
 *
 * @param array{id: int} $post Post data.
 * @return string|null Attachment BlurHash.
 */
function rest_get_attachment_blurhash( array $post ): ?string {
	$meta = wp_get_attachment_metadata( $post['id'] );
	return $meta['blurhash'] ?? null;
}

/**
 * Returns the attachment's dominant color.
 *
 * @param array{id: int} $post Post data.
 * @return string|null Attachment dominant color.
 */
function rest_get_attachment_dominant_color( array $post ): ?string {
	$meta = wp_get_attachment_metadata( $post['id'] );
	return $meta['dominant_color'] ?? null;
}

/**
 * Returns whether the attachment is muted.
 *
 * @param array{id: int} $post Post data.
 * @return bool Whether attachment is muted.
 */
function rest_get_attachment_is_muted( array $post ): bool {
	$meta = wp_get_attachment_metadata( $post['id'] );
	return isset( $meta['is_muted'] ) && $meta['is_muted'];
}

/**
 * Returns whether the attachment has transparency (alpha channel).
 *
 * @param array{id: int} $post Post data.
 * @return bool|null Whether attachment has transparency.
 */
function rest_get_attachment_has_transparency( array $post ): ?bool {
	$meta = wp_get_attachment_metadata( $post['id'] );
	return $meta['has_transparency'] ?? null;
}

/**
 * Returns the URL of the original file if this is an optimized one
 *
 * @param array{id: int} $post Post data.
 * @return string|null Original URL if applicable.
 */
function rest_get_attachment_original_url( array $post ): ?string {
	$original_id = get_post_meta( $post['id'], 'mexp_original_id', true );

	if ( ! is_int( $original_id ) ) {
		return null;
	}

	$original_url = wp_get_attachment_url( $original_id );

	return is_string( $original_url ) ? $original_url : null;
}

/**
 * Returns the list of missing video sizes for a video attachment.
 *
 * @param array{id: int} $post Post data.
 * @return string[] List of missing video size names.
 */
function rest_get_attachment_missing_video_sizes( array $post ): array {
	$mime_type = get_post_mime_type( $post['id'] );
	
	if ( ! is_string( $mime_type ) || ! str_starts_with( $mime_type, 'video/' ) ) {
		return [];
	}

	$metadata = wp_get_attachment_metadata( $post['id'], true );

	if ( ! is_array( $metadata ) ) {
		return [];
	}

	$metadata['sizes'] = $metadata['sizes'] ?? [];

	$video_sizes = get_all_video_sizes();

	// Only generate sizes that are smaller than the original video.
	$original_width  = $metadata['width'] ?? 0;
	$original_height = $metadata['height'] ?? 0;

	if ( $original_width === 0 || $original_height === 0 ) {
		return [];
	}

	$applicable_sizes = [];
	foreach ( $video_sizes as $name => $size ) {
		if ( $size['width'] < $original_width && $size['height'] < $original_height ) {
			$applicable_sizes[] = $name;
		}
	}

	$existing_sizes  = array_keys( $metadata['sizes'] );
	$missing_sizes   = array_diff( $applicable_sizes, $existing_sizes );
	
	return array_values( $missing_sizes );
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

	return $screen instanceof WP_Screen && 'upload' === $screen->id;
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

	if ( ! $poster instanceof WP_Post ) {
		return;
	}

	$poster_metadata = wp_get_attachment_metadata( $poster_id );
	$pdf_metadata    = wp_get_attachment_metadata( $attachment->ID );

	if ( is_array( $pdf_metadata ) && is_array( $poster_metadata ) ) {
		$pdf_metadata['sizes']         = $poster_metadata['sizes'];
		$pdf_metadata['sizes']['full'] = [
			'file'      => basename( $poster_metadata['file'] ),
			'width'     => $poster_metadata['width'],
			'height'    => $poster_metadata['height'],
			'mime_type' => $poster->post_mime_type,
			'filesize'  => $poster_metadata['filesize'],
		];

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

	if ( ! $original_attachment instanceof WP_Post ) {
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

		$keys = [ 'width', 'height', 'blurhash', 'dominant_color', 'has_transparency' ];
		foreach ( $keys as $key ) {
			if ( ! isset( $metadata[ $key ] ) && isset( $original_metadata[ $key ] ) ) {
				$metadata[ $key ] = $original_metadata[ $key ];
			}
		}

		if ( ! isset( $metadata['file'] ) ) {
			$attached_file = get_attached_file( $attachment_id );
			if ( false !== $attached_file ) {
				// @phpstan-ignore no.private.function
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
 * Filter image tags in content to add more beautiful placeholders.
 *
 * Uses BlurHash-powered CSS gradients with a fallback
 * to a solid background color.
 *
 * @param string $content        The image tag markup.
 * @param string $context        The context of the image.
 * @param int    $attachment_id  The attachment ID.
 *
 * @return string The filtered image tag.
 */
function filter_wp_content_img_tag_add_placeholders( string $content, string $context, int $attachment_id ): string {
	$processor = new \WP_HTML_Tag_Processor( $content );
	if ( ! $processor->next_tag( array( 'tag_name' => 'img' ) ) ) {
		return $content;
	}

	if ( ! is_string( $processor->get_attribute( 'src' ) ) ) {
		return $content;
	}

	$class_name = 'mexp-placeholder-' . $attachment_id;

	// Ensure to not run the logic below in case relevant attributes are already present.
	if ( true === $processor->has_class( $class_name ) ) {
		return $content;
	}

	$meta = wp_get_attachment_metadata( $attachment_id );

	if ( ! is_array( $meta ) ) {
		return $content;
	}

	if ( isset( $meta['has_transparency'] ) && $meta['has_transparency'] ) {
		return $content;
	}

	$dominant_color = $meta['dominant_color'] ?? null;
	$blurhash       = $meta['blurhash'] ?? null;

	if ( ! is_string( $dominant_color ) && ! is_string( $blurhash ) ) {
		return $content;
	}

	$style = $processor->get_attribute( 'style' );

	if ( ! is_string( $style ) ) {
		$style = '';
	}

	if ( is_string( $dominant_color ) ) {
		$style = sprintf( 'background-color: %1$s; %2$s }', maybe_hash_hex_color( $dominant_color ), $style );
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
					$rgb           = sprintf( '#%02x%02x%02x', (int) $r, (int) $g, (int) $b );

					$gradients[] = sprintf(
						'radial-gradient(at %1$s%% %2$s%%, %3$s, #00000000 50%%)',
						$percent_x,
						$percent_y,
						$rgb
					);
				}
			}

			$style = sprintf( 'background-image: %1$s; %2$s }', join( ',', $gradients ), $style );
		} catch ( InvalidArgumentException $exception ) {
			// TODO: Investigate error, which is likely because of a blurhash length mismatch.
		}
	}

	$processor->set_attribute( 'style', $style );

	$processor->add_class( $class_name );

	return $processor->get_updated_html();
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

	$server_timing = \perflab_server_timing();

	do_action( 'perflab_server_timing_send_header' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

	$response->header( 'Server-Timing', $server_timing->get_header() );

	return $response;
}

/**
 * Filters the list of rewrite rules formatted for output to an .htaccess file.
 *
 * Adds support for serving wasm-vips locally.
 *
 * @param string $rules mod_rewrite Rewrite rules formatted for .htaccess.
 * @return string Filtered rewrite rules.
 */
function filter_mod_rewrite_rules( string $rules ): string {
	$rules .= "\n# BEGIN Media Experiments\n" .
				"AddType application/wasm wasm\n" .
				"# END Media Experiments\n";

	return $rules;
}
