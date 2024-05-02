<?php

use MediaExperiments\REST_Attachments_Controller;
use function MediaExperiments\delete_old_upload_requests;
use function MediaExperiments\register_attachment_post_meta;
use function MediaExperiments\register_media_source_taxonomy;
use function MediaExperiments\register_upload_request_post_type;

class Plugin_Test extends WP_UnitTestCase {
	/**
	 * @covers \MediaExperiments\get_all_image_sizes
	 */
	public function test_get_all_image_sizes() {
		$sizes = MediaExperiments\get_all_image_sizes();
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
		$input_output_formats = MediaExperiments\get_default_image_output_formats();
		$this->assertEmpty( $input_output_formats );
	}
}
