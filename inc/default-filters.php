<?php
/**
 * Adding filters and actions.
 *
 * @copyright 2023 Google LLC
 * @license   https://www.apache.org/licenses/LICENSE-2.0 Apache License 2.0
 */

declare(strict_types = 1);

namespace MediaExperiments;

use function add_action;

add_action( 'init', __NAMESPACE__ . '\register_assets' );
add_action( 'current_screen', __NAMESPACE__ . '\set_up_cross_origin_isolation' );
add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\enqueue_block_editor_assets' );
add_action( 'rest_api_init', __NAMESPACE__ . '\register_rest_attachment_featured_media' );
add_action( 'init', __NAMESPACE__ . '\register_attachment_post_meta' );
add_action( 'init', __NAMESPACE__ . '\register_media_source_taxonomy' );

add_filter( 'ajax_query_attachments_args', __NAMESPACE__ . '\filter_ajax_query_attachments_args' );
add_action( 'pre_get_posts', __NAMESPACE__ . '\filter_generated_media_attachments' );
add_filter( 'web_stories_rest_attachment_query', __NAMESPACE__ . 'filter_rest_generated_media_attachments' );
add_action( 'delete_attachment', __NAMESPACE__ . '\delete_generated_poster_image' );

add_action( 'rest_after_insert_attachment', __NAMESPACE__ . '\rest_after_insert_attachment_handle_terms', 10, 3 );
