<?php
/**
 * Adding filters and actions.
 *
 * @package MediaExperiments
 */

declare(strict_types = 1);

namespace MediaExperiments;

use function add_action;

add_filter( 'update_plugins_swissspidy.github.io', __NAMESPACE__ . '\filter_update_plugins', 10, 3 );

// Cross-origin isolation.

add_action( 'load-post.php', __NAMESPACE__ . '\set_up_cross_origin_isolation_editor' );
add_action( 'load-post-new.php', __NAMESPACE__ . '\set_up_cross_origin_isolation_editor' );
add_action( 'load-site-editor.php', __NAMESPACE__ . '\set_up_cross_origin_isolation_editor' );
add_action( 'load-widgets.php', __NAMESPACE__ . '\set_up_cross_origin_isolation_editor' );
add_action( 'wp_enqueue_media', __NAMESPACE__ . '\override_media_templates' );

add_action( 'init', __NAMESPACE__ . '\register_media_source_taxonomy', 5 );
add_action( 'init', __NAMESPACE__ . '\register_assets' );
add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\enqueue_block_editor_assets' );
add_action( 'enqueue_block_assets', __NAMESPACE__ . '\enqueue_block_assets' );

add_filter( 'mod_rewrite_rules', __NAMESPACE__ . '\filter_mod_rewrite_rules' );

add_filter( 'big_image_size_threshold', __NAMESPACE__ . '\filter_big_image_size_threshold' );
add_filter( 'image_save_progressive', __NAMESPACE__ . '\filter_image_save_progressive', 10, 2 );

// Allow uploading JPEG XL originals.
add_filter( 'mime_types', __NAMESPACE__ . '\filter_mime_types' );
add_filter( 'ext2type', __NAMESPACE__ . '\filter_ext2type' );
add_filter( 'getimagesize_mimes_to_exts', __NAMESPACE__ . '\filter_getimagesize_mimes_to_exts' );
add_filter( 'wp_check_filetype_and_ext', __NAMESPACE__ . '\filter_wp_check_filetype_and_ext', 10, 4 );

// REST API.

add_filter( 'register_post_type_args', __NAMESPACE__ . '\filter_attachment_post_type_args', 10, 2 );
add_action( 'rest_api_init', __NAMESPACE__ . '\register_rest_fields' );
add_action( 'init', __NAMESPACE__ . '\register_attachment_post_meta' );
add_filter( 'rest_index', __NAMESPACE__ . '\filter_rest_index' );
add_action( 'rest_after_insert_attachment', __NAMESPACE__ . '\rest_after_insert_attachment_handle_pdf_poster', 10, 2 );
add_action( 'rest_after_insert_attachment', __NAMESPACE__ . '\rest_after_insert_attachment_copy_metadata', 10, 2 );
add_action( 'rest_after_insert_attachment', __NAMESPACE__ . '\rest_after_insert_attachment_insert_additional_metadata', 10, 2 );

// Blurred placeholders on the frontend.

add_filter( 'wp_content_img_tag', __NAMESPACE__ . '\filter_wp_content_img_tag_add_placeholders', 100, 3 );

// Upload requests, see https://github.com/swissspidy/media-experiments/issues/246.

add_action( 'init', __NAMESPACE__ . '\register_upload_request_post_type' );
add_action( 'init', __NAMESPACE__ . '\register_collaboration_request_post_type' );
add_filter( 'template_include', __NAMESPACE__ . '\load_upload_request_template' );
add_filter( 'cron_schedules', __NAMESPACE__ . '\add_quarter_hourly_cron_interval' );
add_action( 'mexp_upload_requests_cleanup', __NAMESPACE__ . '\delete_old_upload_requests' );
add_action( 'mexp_collaboration_requests_cleanup', __NAMESPACE__ . '\delete_old_collaboration_requests' );
add_filter( 'rest_route_for_post', __NAMESPACE__ . '\filter_rest_route_for_post_for_upload_requests', 10, 2 );
add_filter( 'user_has_cap', __NAMESPACE__ . '\filter_user_has_cap_for_collaboration', 10, 4 );

// Plugin compat.

add_action( 'admin_print_scripts', __NAMESPACE__ . '\fix_yoast_seo_worker' );

// Performance Lab.
add_filter( 'rest_post_dispatch', __NAMESPACE__ . '\rest_post_dispatch_add_server_timing' );
