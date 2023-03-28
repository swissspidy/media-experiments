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
 */

/**
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Plugin functions.
 */
require_once __DIR__ . '/inc/functions.php';

/**
 * Adds all plugin actions and filters.
 */
require_once __DIR__ . '/inc/default-filters.php';
