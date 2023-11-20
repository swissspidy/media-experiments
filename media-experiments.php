<?php
/**
 * Plugin Name: Media Experiments
 * Plugin URI:  https://github.com/swissspidy/media-experiments/
 * Description: Media Experiments
 * Version:     0.0.1
 * Author:      Pascal Birchler
 * Author URI:  https://pascalbirchler.com
 * License:     Apache-2.0
 * License URI: https://www.apache.org/licenses/LICENSE-2.0
 * Text Domain: media-experiments
 * Requires at least: 6.1
 * Requires PHP: 5.6
 *
 * @package MediaExperiments
 */

/**
 * REST attachments controller.
 */
require_once __DIR__ . '/inc/class-rest-attachments-controller.php';

/**
 * Plugin functions.
 */
require_once __DIR__ . '/inc/functions.php';

/**
 * Adds all plugin actions and filters.
 */
require_once __DIR__ . '/inc/default-filters.php';
