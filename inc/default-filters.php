<?php
/**
 * Adding filters and actions.
 *
 * @package MediaExperiments
 */

declare(strict_types = 1);

namespace MediaExperiments;

use function add_action;

add_action( 'init', __NAMESPACE__ . '\register_assets' );
add_action( 'current_screen', __NAMESPACE__ . '\set_up_cross_origin_isolation_editor' );
add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\enqueue_block_editor_assets' );
add_action( 'enqueue_block_assets', __NAMESPACE__ . '\enqueue_block_assets' );
add_action( 'rest_api_init', __NAMESPACE__ . '\register_rest_fields' );
add_action( 'init', __NAMESPACE__ . '\register_attachment_post_meta' );
add_action( 'init', __NAMESPACE__ . '\register_media_source_taxonomy' );

add_action( 'rest_after_insert_attachment', __NAMESPACE__ . '\rest_after_insert_attachment_handle_terms', 10, 3 );
add_action( 'rest_after_insert_attachment', __NAMESPACE__ . '\rest_after_insert_attachment_handle_pdf_poster', 10, 2 );
add_action( 'rest_after_insert_attachment', __NAMESPACE__ . '\rest_after_insert_attachment_copy_metadata', 10, 2 );
add_action( 'rest_after_insert_attachment', __NAMESPACE__ . '\rest_after_insert_attachment_insert_additional_metadata', 10, 2 );

add_filter( 'register_post_type_args', __NAMESPACE__ . '\filter_attachment_post_type_args', 10, 2 );

add_filter( 'wp_prepare_attachment_for_js', __NAMESPACE__ . '\filter_wp_prepare_attachment_for_js' );

add_filter( 'wp_content_img_tag', __NAMESPACE__ . '\filter_wp_content_img_tag_add_placeholders', 100, 3 );

// AVIF support, see https://github.com/swissspidy/media-experiments/issues/6.
add_filter( 'getimagesize_mimes_to_exts', __NAMESPACE__ . '\filter_mimes_to_exts' );
add_filter( 'mime_types', __NAMESPACE__ . '\filter_mime_types' );
add_filter( 'ext2type', __NAMESPACE__ . '\filter_ext_types' );
add_filter( 'file_is_displayable_image', __NAMESPACE__ . '\filter_file_is_displayable_image', 10, 2 );

// Upload requests, see https://github.com/swissspidy/media-experiments/issues/246.

add_action( 'init', __NAMESPACE__ . '\register_upload_request_post_type' );
add_filter( 'template_include', __NAMESPACE__ . '\load_upload_request_template' );
add_filter( 'cron_schedules', __NAMESPACE__ . '\add_quarter_hourly_cron_interval' );
add_action( 'mexp_upload_requests_cleanup', __NAMESPACE__ . '\delete_old_upload_requests' );
