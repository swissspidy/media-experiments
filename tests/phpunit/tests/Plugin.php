<?php

namespace MediaExperiments\Tests;

use MediaExperiments\REST_Attachments_Controller;
use WP_REST_Request;
use WP_REST_Server;
use WP_UnitTest_Factory;
use WP_UnitTestCase;
use function MediaExperiments\add_crossorigin_attributes;
use function MediaExperiments\delete_old_upload_requests;
use function MediaExperiments\enqueue_block_assets;
use function MediaExperiments\enqueue_block_editor_assets;
use function MediaExperiments\filter_attachment_post_type_args;
use function MediaExperiments\get_all_image_sizes;
use function MediaExperiments\get_attachment_filesize;
use function MediaExperiments\get_default_image_output_formats;
use function MediaExperiments\get_user_media_preferences;
use function MediaExperiments\is_upload_screen;
use function MediaExperiments\needs_cross_origin_isolation;
use function MediaExperiments\override_media_templates;
use function MediaExperiments\register_assets;
use function MediaExperiments\register_attachment_post_meta;
use function MediaExperiments\register_media_source_taxonomy;
use function MediaExperiments\register_upload_request_post_type;
use function MediaExperiments\rest_get_attachment_blurhash;
use function MediaExperiments\rest_get_attachment_dominant_color;
use function MediaExperiments\rest_get_attachment_filename;
use function MediaExperiments\rest_get_attachment_filesize;
use function MediaExperiments\rest_get_attachment_has_transparency;
use function MediaExperiments\rest_get_attachment_is_muted;

class Test_Plugin extends WP_UnitTestCase {
	/**
	 * @var int Administrator ID.
	 */
	protected static int $admin_id;

	/**
	 * @var string Image file path.
	 */
	private static string $image_file;

	public static function wpSetUpBeforeClass( WP_UnitTest_Factory $factory ) {
		self::$admin_id = $factory->user->create(
			[
				'role' => 'administrator',
			]
		);
	}

	public function set_up() {
		parent::set_up();

		self::$image_file = get_temp_dir() . 'canola.jpg';
		if ( ! file_exists( self::$image_file ) ) {
			copy( DIR_TESTDATA . '/images/canola.jpg', self::$image_file );
		}
	}

	public function tear_down() {
		$this->remove_added_uploads();

		parent::tear_down();
	}

	/**
	 * @covers \MediaExperiments\needs_cross_origin_isolation
	 */
	public function test_needs_cross_origin_isolation_cannot_upload() {
		$this->assertFalse( needs_cross_origin_isolation() );
	}

	/**
	 * @covers \MediaExperiments\needs_cross_origin_isolation
	 */
	public function test_needs_cross_origin_isolation_admin() {
		wp_set_current_user( self::$admin_id );

		$this->assertTrue( needs_cross_origin_isolation() );
	}

	/**
	 * @covers \MediaExperiments\add_crossorigin_attributes
	 */
	public function test_add_crossorigin_attributes() {
		$html = <<<HTML
<img src="https://www.someothersite.com/test1.jpg" />
<img src="test2.jpg" />
<audio><source src="https://www.someothersite.com/test1.mp3"></audio>
<audio src="https://www.someothersite.com/test1.mp3"></audio>
<audio src="/test2.mp3"></audio>
<video><source src="https://www.someothersite.com/test1.mp4"></video>
<video src="https://www.someothersite.com/test1.mp4"></video>
<video src="/test2.mp4"></video>
<script src="https://www.someothersite.com/test1.js"></script>
<script src="/test2.js"></script>
<link href="https://www.someothersite.com/test1.css"></link>
<link href="/test2.css"></link>
HTML;

		$expected = <<<HTML
<img crossorigin="anonymous" src="https://www.someothersite.com/test1.jpg" />
<img crossorigin="anonymous" src="test2.jpg" />
<audio crossorigin="anonymous"><source src="https://www.someothersite.com/test1.mp3"></audio>
<audio crossorigin="anonymous" src="https://www.someothersite.com/test1.mp3"></audio>
<audio src="/test2.mp3"></audio>
<video crossorigin="anonymous"><source src="https://www.someothersite.com/test1.mp4"></video>
<video crossorigin="anonymous" src="https://www.someothersite.com/test1.mp4"></video>
<video src="/test2.mp4"></video>
<script crossorigin="anonymous" src="https://www.someothersite.com/test1.js"></script>
<script src="/test2.js"></script>
<link crossorigin="anonymous" href="https://www.someothersite.com/test1.css"></link>
<link href="/test2.css"></link>
HTML;

		$actual = add_crossorigin_attributes( $html );

		$this->assertSame( $expected, $actual );
	}

	/**
	 * @covers \MediaExperiments\override_media_templates
	 */
	public function test_override_media_templates(): void {
		if ( ! function_exists( '\wp_print_media_templates' ) ) {
			require_once ABSPATH . WPINC . '/media-template.php';
		}

		override_media_templates();

		ob_start();
		do_action( 'admin_footer' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
		$output = ob_get_clean();

		$this->assertStringContainsString( '<audio crossorigin="anonymous"', $output );
		$this->assertStringContainsString( '<img crossorigin="anonymous"', $output );
		$this->assertStringContainsString( '<video crossorigin="anonymous"', $output );
	}

	/**
	 * @covers \MediaExperiments\get_user_media_preferences
	 */
	public function test_get_user_media_preferences() {
		$actual_1 = get_user_media_preferences( self::$admin_id );

		add_user_meta( self::$admin_id, 'wp_persisted_preferences', [ 'media-experiments/preferences' => [ 'bigImageSizeThreshold' => 1000 ] ] );

		$actual_2 = get_user_media_preferences( self::$admin_id );

		delete_user_meta( self::$admin_id, 'wp_persisted_preferences' );

		$this->assertEmpty( $actual_1 );
		$this->assertSame( [ 'bigImageSizeThreshold' => 1000 ], $actual_2 );
	}

	/**
	 * @covers \MediaExperiments\filter_big_image_size_threshold
	 */
	public function test_filter_big_image_size_threshold() {
		wp_set_current_user( self::$admin_id );

		add_user_meta( self::$admin_id, 'wp_persisted_preferences', [ 'media-experiments/preferences' => [ 'bigImageSizeThreshold' => 1000 ] ] );

		$image_size_threshold = (int) apply_filters( 'big_image_size_threshold', 2560, array( 0, 0 ), '', 0 ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

		$this->assertSame( 1000, $image_size_threshold );
	}

	/**
	 * @covers \MediaExperiments\filter_big_image_size_threshold
	 */
	public function test_filter_big_image_size_threshold_no_user() {
		$image_size_threshold = (int) apply_filters( 'big_image_size_threshold', 2560, array( 0, 0 ), '', 0 ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

		$this->assertSame( 2560, $image_size_threshold );
	}

	/**
	 * @covers \MediaExperiments\filter_big_image_size_threshold
	 */
	public function test_filter_big_image_size_threshold_no_preference() {
		wp_set_current_user( self::$admin_id );

		add_user_meta( self::$admin_id, 'wp_persisted_preferences', [ 'media-experiments/preferences' => [] ] );

		$image_size_threshold = (int) apply_filters( 'big_image_size_threshold', 2560, array( 0, 0 ), '', 0 ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

		$this->assertSame( 2560, $image_size_threshold );
	}

	/**
	 * @covers \MediaExperiments\filter_image_save_progressive
	 */
	public function test_filter_image_save_progressive() {
		wp_set_current_user( self::$admin_id );

		add_user_meta(
			self::$admin_id,
			'wp_persisted_preferences',
			[
				'media-experiments/preferences' => [
					'png_interlaced'  => true,
					'jpeg_interlaced' => false,
				],
			]
		);

		$jpeg_interlaced = (bool) apply_filters( 'image_save_progressive', true, 'image/jpeg' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
		$png_interlaced  = (bool) apply_filters( 'image_save_progressive', false, 'image/png' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

		$this->assertFalse( $jpeg_interlaced );
		$this->assertTrue( $png_interlaced );
	}

	/**
	 * @covers \MediaExperiments\filter_image_save_progressive
	 */
	public function test_filter_image_save_progressive_no_user() {

		$jpeg_interlaced = (bool) apply_filters( 'image_save_progressive', true, 'image/jpeg' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
		$png_interlaced  = (bool) apply_filters( 'image_save_progressive', false, 'image/png' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

		$this->assertTrue( $jpeg_interlaced );
		$this->assertFalse( $png_interlaced );
	}

	/**
	 * @covers \MediaExperiments\filter_image_save_progressive
	 */
	public function test_filter_image_save_progressive_no_preference() {
		wp_set_current_user( self::$admin_id );

		add_user_meta(
			self::$admin_id,
			'wp_persisted_preferences',
			[
				'media-experiments/preferences' => [],
			]
		);

		$jpeg_interlaced = (bool) apply_filters( 'image_save_progressive', true, 'image/jpeg' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
		$png_interlaced  = (bool) apply_filters( 'image_save_progressive', false, 'image/png' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

		$this->assertTrue( $jpeg_interlaced );
		$this->assertFalse( $png_interlaced );
	}

	/**
	 * @covers \MediaExperiments\register_assets
	 */
	public function test_register_assets() {
		register_assets();

		$this->assertTrue( wp_script_is( 'media-experiments-view-upload-request', 'registered' ) );
		$this->assertTrue( wp_style_is( 'media-experiments-view-upload-request', 'registered' ) );
	}

	/**
	 * @covers \MediaExperiments\enqueue_block_editor_assets
	 */
	public function test_enqueue_block_editor_assets() {
		enqueue_block_editor_assets();

		$this->assertTrue( wp_script_is( 'media-experiments' ) );
		$this->assertTrue( wp_style_is( 'media-experiments-editor' ) );
	}

	/**
	 * @covers \MediaExperiments\enqueue_block_assets
	 */
	public function test_enqueue_block_assets_frontend() {
		enqueue_block_assets();

		$this->assertFalse( wp_style_is( 'media-experiments-blocks' ) );
	}

	/**
	 * @covers \MediaExperiments\enqueue_block_assets
	 */
	public function test_enqueue_block_assets_admin() {
		set_current_screen( 'edit.php' );

		enqueue_block_assets();

		$this->assertTrue( wp_style_is( 'media-experiments-blocks' ) );
	}

	/**
	 * @covers \MediaExperiments\is_upload_screen
	 */
	public function test_is_upload_screen() {
		$actual_1 = is_upload_screen();

		set_current_screen( 'upload.php' );
		$actual_2 = is_upload_screen();

		$this->assertFalse( $actual_1 );
		$this->assertTrue( $actual_2 );
	}

	/**
	 * @covers \MediaExperiments\get_all_image_sizes
	 */
	public function test_get_all_image_sizes() {
		$sizes = get_all_image_sizes();
		$this->assertNotEmpty( $sizes );
		foreach ( $sizes as $size ) {
			$this->assertIsInt( $size['width'] );
			$this->assertIsInt( $size['height'] );
			$this->assertIsString( $size['name'] );
		}
	}

	/**
	 * @covers \MediaExperiments\filter_rest_index
	 */
	public function test_get_rest_index_should_return_additional_settings() {
		$server = new WP_REST_Server();

		$request = new WP_REST_Request( 'GET', '/' );
		$index   = $server->dispatch( $request );
		$data    = $index->get_data();

		$this->assertArrayHasKey( 'image_size_threshold', $data );
		$this->assertArrayHasKey( 'video_size_threshold', $data );
		$this->assertArrayHasKey( 'image_output_formats', $data );
		$this->assertArrayHasKey( 'jpeg_interlaced', $data );
		$this->assertArrayHasKey( 'png_interlaced', $data );
		$this->assertArrayHasKey( 'gif_interlaced', $data );
		$this->assertArrayHasKey( 'image_sizes', $data );
	}

	/**
	 * @covers \MediaExperiments\filter_mod_rewrite_rules
	 */
	public function test_filter_mod_rewrite_rules() {
		$this->set_permalink_structure( '/%year%/%postname%/' );

		/**
		 * @var \WP_Rewrite $wp_rewrite
		 */
		global $wp_rewrite;

		$rules = $wp_rewrite->mod_rewrite_rules();

		$this->assertStringContainsString( 'AddType application/wasm wasm', $rules );
	}

	/**
	 * @covers \MediaExperiments\add_quarter_hourly_cron_interval
	 */
	public function test_add_quarter_hourly_cron_interval() {
		$schedules = wp_get_schedules();
		$this->assertArrayHasKey( 'quarter_hourly', $schedules );
	}

	/**
	 * @covers \MediaExperiments\delete_old_upload_requests
	 */
	public function test_delete_old_upload_requests() {
		$post_1 = $this->factory()->post->create(
			[
				'post_type' => 'mexp-upload-request',
			]
		);
		$post_2 = $this->factory()->post->create(
			[
				'post_type' => 'mexp-upload-request',
				'post_date' => '2020-01-01 00:00:00',
			]
		);

		delete_old_upload_requests();

		$this->assertNotNull( get_post( $post_1 ) );
		$this->assertNull( get_post( $post_2 ) );
	}

	/**
	 * @covers \MediaExperiments\register_upload_request_post_type
	 */
	public function test_register_upload_request_post_type() {
		register_upload_request_post_type();

		$this->assertTrue( post_type_exists( 'mexp-upload-request' ) );
	}

	/**
	 * @covers \MediaExperiments\filter_attachment_post_type_args
	 */
	public function test_filter_attachment_post_type_args() {
		$post_type_object = get_post_type_object( 'attachment' );
		$this->assertInstanceOf( REST_Attachments_Controller::class, $post_type_object->get_rest_controller() );

		$this->assertSame(
			[ 'rest_controller_class' => REST_Attachments_Controller::class ],
			filter_attachment_post_type_args( [], 'attachment' )
		);
		$this->assertSame(
			[],
			filter_attachment_post_type_args( [], 'post' )
		);
	}

	/**
	 * @covers \MediaExperiments\register_media_source_taxonomy
	 */
	public function test_register_media_source_taxonomy() {
		register_media_source_taxonomy();

		$this->assertTrue( taxonomy_exists( 'mexp_media_source' ) );
		$this->assertIsArray( term_exists( 'poster-generation', 'mexp_media_source' ) );
		$this->assertIsArray( term_exists( 'gif-conversion', 'mexp_media_source' ) );
		$this->assertIsArray( term_exists( 'media-import', 'mexp_media_source' ) );
		$this->assertIsArray( term_exists( 'media-optimization', 'mexp_media_source' ) );
		$this->assertIsArray( term_exists( 'subtitles-generation', 'mexp_media_source' ) );
	}

	/**
	 * @covers \MediaExperiments\register_attachment_post_meta
	 */
	public function test_register_attachment_post_meta() {
		register_attachment_post_meta();

		$registered = get_registered_meta_keys( 'post', 'attachment' );

		$this->assertArrayHasKey( 'mexp_generated_poster_id', $registered );
		$this->assertArrayHasKey( 'mexp_original_id', $registered );
	}

	/**
	 * @covers \MediaExperiments\get_default_image_output_formats
	 */
	public function test_get_default_image_output_formats() {
		$input_output_formats = get_default_image_output_formats();
		$this->assertEmpty( $input_output_formats );
	}

	/**
	 * @covers \MediaExperiments\filter_rest_route_for_post_for_upload_requests
	 */
	public function test_filter_rest_route_for_post_for_upload_requests() {
		$upload_request = $this->factory()->post->create(
			[
				'post_type'   => 'mexp-upload-request',
				'post_status' => 'publish',
				'post_name'   => 'someslug',
			]
		);

		$actual = rest_get_route_for_post( $upload_request );
		$this->assertSame( '/wp/v2/upload-requests/someslug', $actual );
	}

	/**
	 * @covers \MediaExperiments\get_attachment_filesize
	 */
	public function test_get_attachment_filesize() {
		$attachment_id = self::factory()->attachment->create_object(
			self::$image_file,
			0,
			array(
				'post_mime_type' => 'image/jpeg',
				'post_excerpt'   => 'A sample caption',
			)
		);

		$this->assertSame( wp_filesize( self::$image_file ), get_attachment_filesize( $attachment_id ) );
	}
	/**
	 * @covers \MediaExperiments\rest_get_attachment_filesize
	 */
	public function test_rest_get_attachment_filesize() {
		$attachment_id = self::factory()->attachment->create_object(
			self::$image_file,
			0,
			array(
				'post_mime_type' => 'image/jpeg',
				'post_excerpt'   => 'A sample caption',
			)
		);

		$this->assertSame( wp_filesize( self::$image_file ), rest_get_attachment_filesize( [ 'id' => $attachment_id ] ) );
	}

	/**
	 * @covers \MediaExperiments\rest_get_attachment_filename
	 */
	public function test_rest_get_attachment_filename() {
		$attachment_id = self::factory()->attachment->create_object(
			self::$image_file,
			0,
			array(
				'post_mime_type' => 'image/jpeg',
				'post_excerpt'   => 'A sample caption',
			)
		);

		$this->assertSame( 'canola.jpg', rest_get_attachment_filename( [ 'id' => $attachment_id ] ) );
	}

	/**
	 * @covers \MediaExperiments\rest_get_attachment_filename
	 */
	public function test_rest_get_attachment_filename_removes_suffix() {
		$attachment_id = self::factory()->attachment->create_object(
			self::$image_file,
			0,
			array(
				'post_mime_type' => 'image/jpeg',
				'post_excerpt'   => 'A sample caption',
			)
		);

		update_post_meta( $attachment_id, '_wp_attached_file', 'canola-scaled.jpg' );

		$this->assertSame( 'canola.jpg', rest_get_attachment_filename( [ 'id' => $attachment_id ] ) );
	}

	/**
	 * @covers \MediaExperiments\rest_get_attachment_blurhash
	 */
	public function test_rest_get_attachment_blurhash() {
		$this->assertNull( rest_get_attachment_blurhash( [ 'id' => 0 ] ) );
	}

	/**
	 * @covers \MediaExperiments\rest_get_attachment_dominant_color
	 */
	public function test_rest_get_attachment_dominant_color() {
		$this->assertNull( rest_get_attachment_dominant_color( [ 'id' => 0 ] ) );
	}

	/**
	 * @covers \MediaExperiments\rest_get_attachment_is_muted
	 */
	public function test_rest_get_attachment_is_muted() {
		$this->assertFalse( rest_get_attachment_is_muted( [ 'id' => 0 ] ) );
	}

	/**
	 * @covers \MediaExperiments\rest_get_attachment_has_transparency
	 */
	public function test_rest_get_attachment_has_transparency() {
		$this->assertNull( rest_get_attachment_has_transparency( [ 'id' => 0 ] ) );
	}
}
