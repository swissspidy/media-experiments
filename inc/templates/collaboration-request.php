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

/**
 * Edit post link.
 *
 * @var string $mexp_edit_url
 */
$mexp_edit_url = get_edit_post_link( $mexp_request_parent->ID, 'raw' );

if ( current_user_can( 'edit_post', $mexp_request_parent->ID ) ) {
	wp_safe_redirect( esc_url_raw( $mexp_edit_url ) );
	exit;
}

// Check if user is already logged in as the temp user for this request.
$mexp_temp_user_id = get_post_meta( $post->ID, 'mexp_temp_user_id', true );

if ( false === $mexp_temp_user_id || ! is_numeric( $mexp_temp_user_id ) ) {
	// Create a new temporary user if none exists.
	$mexp_temp_user_id = \MediaExperiments\create_temporary_collaboration_user( $post->ID );

	if ( is_wp_error( $mexp_temp_user_id ) ) {
		wp_die( esc_html__( 'Could not create temporary user for collaboration.', 'media-experiments' ) );
	}

	update_post_meta( $post->ID, 'mexp_temp_user_id', $mexp_temp_user_id );
}

/**
 * User ID.
 *
 * @var int $mexp_temp_user_id
 */

// Store the target post ID in user meta for capability checks.
update_user_meta( $mexp_temp_user_id, 'mexp_target_post_id', $mexp_request_parent->ID );

// Log in as the temporary user.
wp_set_current_user( $mexp_temp_user_id );
wp_set_auth_cookie( $mexp_temp_user_id, true );

/**
 * User instance.
 *
 * @var \WP_User $mexp_temp_user
 */

$mexp_temp_user = get_userdata( $mexp_temp_user_id );

// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Core hook.
do_action( 'wp_login', $mexp_temp_user->user_login, $mexp_temp_user );

// Redirect to the block editor for the target post.
wp_safe_redirect( esc_url_raw( $mexp_edit_url ) );
exit;
