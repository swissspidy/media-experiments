<?php

namespace MediaExperiments\Tests;

use MediaExperiments\REST_Attachments_Controller;
use WP_UnitTestCase;
use function MediaExperiments\delete_old_upload_requests;
use function MediaExperiments\filter_attachment_post_type_args;
use function MediaExperiments\get_all_image_sizes;
use function MediaExperiments\get_attachment_filesize;
use function MediaExperiments\get_default_image_output_formats;
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
	 * @var string Image file path.
	 */
	private static string $image_file;

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
		$this->assertArrayHasKey( 'mexp_optimized_id', $registered );
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
