<?php
/**
 * Plugin Name: Additional image sizes
 * Plugin URI:  https://github.com/swissspidy/media-experiments
 */

add_action(
	'init',
	static function () {
		add_image_size( 'bottom-right', 220, 220, array( 'right', 'bottom' ) );
		add_image_size( 'custom-size', 100, 100, array( 'left', 'top' ) );
		add_image_size( 'ninek-height', 400, 9999 );
		add_image_size( 'ninek-width', 9999, 600 );
	}
);
