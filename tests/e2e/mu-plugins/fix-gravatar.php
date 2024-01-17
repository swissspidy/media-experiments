<?php
/**
 * Plugin Name: Fix Gravatar URLs
 * Plugin URI:  https://github.com/swissspidy/media-experiments
 */

add_filter(
	'get_avatar_url',
	static function ( $url ) {
		return set_url_scheme( $url, 'https' );
	},
	1
);
