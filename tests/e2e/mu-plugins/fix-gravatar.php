<?php

// Hat tip https://github.com/norcross/airplane-mode

add_filter(
	'get_avatar_url',
	static function ( $url ) {
		return set_url_scheme( $url, 'https' );
	},
	1
);
