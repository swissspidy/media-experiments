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
add_filter( 'rest_api_init', __NAMESPACE__ . '\register_rest_attachment_featured_media' );
