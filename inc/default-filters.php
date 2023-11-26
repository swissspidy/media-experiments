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
add_action( 'current_screen', __NAMESPACE__ . '\set_up_cross_origin_isolation' );
add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\enqueue_block_editor_assets' );
add_action( 'enqueue_block_assets', __NAMESPACE__ . '\enqueue_block_assets' );
add_action( 'rest_api_init', __NAMESPACE__ . '\register_rest_fields' );
add_action( 'init', __NAMESPACE__ . '\register_attachment_post_meta' );
add_action( 'init', __NAMESPACE__ . '\register_media_source_taxonomy' );

add_filter( 'ajax_query_attachments_args', __NAMESPACE__ . '\filter_ajax_query_attachments_args' );
add_action( 'pre_get_posts', __NAMESPACE__ . '\filter_generated_media_attachments' );
add_filter( 'web_stories_rest_attachment_query', __NAMESPACE__ . 'filter_rest_generated_media_attachments' );
add_action( 'delete_attachment', __NAMESPACE__ . '\delete_generated_poster_image' );

add_action( 'rest_after_insert_attachment', __NAMESPACE__ . '\rest_after_insert_attachment_handle_terms', 10, 3 );
add_action( 'rest_after_insert_attachment', __NAMESPACE__ . '\rest_after_insert_attachment_handle_pdf_poster', 10, 2 );

add_filter( 'register_post_type_args', __NAMESPACE__ . '\filter_attachment_post_type_args', 10, 2 );

add_filter( 'wp_prepare_attachment_for_js', __NAMESPACE__ . '\filter_wp_prepare_attachment_for_js' );

add_filter( 'wp_content_img_tag', __NAMESPACE__ . '\filter_wp_content_img_tag_add_placeholders', 100, 3 );

// AVIF support, see https://github.com/swissspidy/media-experiments/issues/6.
add_filter( 'getimagesize_mimes_to_exts', __NAMESPACE__ . '\filter_mimes_to_exts' );
add_filter( 'mime_types', __NAMESPACE__ . '\filter_mime_types' );
add_filter( 'ext2type', __NAMESPACE__ . '\filter_ext_types' );
