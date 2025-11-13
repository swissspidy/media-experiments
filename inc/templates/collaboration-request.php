<?php
/**
 * Single collaboration request template.
 *
 * @package MediaExperiments
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$post = get_post();

if ( ! $post instanceof WP_Post ) {
	exit;
}

global $authordata;
$authordata = get_userdata( (int) $post->post_author );

$mexp_request_parent = $post->post_parent > 0 ? get_post( $post->post_parent ) : null;

if ( ! $mexp_request_parent instanceof WP_Post ) {
	wp_die( esc_html__( 'Invalid collaboration request.', 'media-experiments' ) );
}

$mexp_request_parent_url = ( is_post_publicly_viewable( $mexp_request_parent ) || current_user_can( 'read', $mexp_request_parent ) ) ? get_permalink( $mexp_request_parent ) : null;

// Redirect to the block editor for the target post.
if ( is_string( $mexp_request_parent_url ) ) {
	// Add collaboration request slug as query parameter.
	$mexp_edit_url = add_query_arg(
		[
			'collaboration_request' => $post->post_name,
		],
		get_edit_post_link( $mexp_request_parent->ID, 'raw' )
	);

	wp_safe_redirect( $mexp_edit_url );
	exit;
}

wp_die( esc_html__( 'You do not have permission to collaborate on this post.', 'media-experiments' ) );
