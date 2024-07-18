<?php

namespace MediaExperiments\Tests;

use WP_REST_Request;
use WP_Test_REST_Post_Type_Controller_Testcase;
use WP_UnitTest_Factory;

/**
 * @coversDefaultClass \MediaExperiments\REST_Attachments_Controller
 */
class Test_REST_Attachments_Controller extends WP_Test_REST_Post_Type_Controller_Testcase {
	/**
	 * @var int Administrator ID.
	 */
	protected static int $admin_id;

	/**
	 * @var string Image file path.
	 */
	private static string $image_file;

	/**
	 * @var string Image file path.
	 */
	private static string $image_file_2;

	/**
	 * @var string PDF file path.
	 */
	private static string $pdf_file;

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

		self::$image_file_2 = get_temp_dir() . 'canola.jpg';
		if ( ! file_exists( self::$image_file_2 ) ) {
			copy( DIR_TESTDATA . '/images/canola.jpg', self::$image_file_2 );
		}

		self::$pdf_file = get_temp_dir() . 'test-alpha.pdf';
		if ( ! file_exists( self::$pdf_file ) ) {
			copy( DIR_TESTDATA . '/images/test-alpha.pdf', self::$pdf_file );
		}
	}

	public function tear_down() {
		$this->remove_added_uploads();

		parent::tear_down();
	}

	/**
	 * @covers ::register_routes
	 */
	public function test_register_routes() {
		$routes = rest_get_server()->get_routes();
		$this->assertArrayHasKey( '/wp/v2/media', $routes );
		$this->assertCount( 2, $routes['/wp/v2/media'] );
		$this->assertArrayHasKey( '/wp/v2/media/(?P<id>[\d]+)', $routes );
		$this->assertCount( 3, $routes['/wp/v2/media/(?P<id>[\d]+)'] );
		$this->assertArrayHasKey( '/wp/v2/media/(?P<id>[\d]+)/sideload', $routes );
		$this->assertCount( 1, $routes['/wp/v2/media/(?P<id>[\d]+)/sideload'] );
	}

	public function test_get_items() {
		$this->markTestSkipped( 'No need to implement' );
	}

	public function test_get_item() {
		$this->markTestSkipped( 'No need to implement' );
	}

	public function test_update_item() {
		$this->markTestSkipped( 'No need to implement' );
	}

	public function test_delete_item() {
		$this->markTestSkipped( 'No need to implement' );
	}

	public function test_get_item_schema() {
		$this->markTestSkipped( 'No need to implement' );
	}

	public function test_context_param() {
		$this->markTestSkipped( 'No need to implement' );
	}

	/**
	 * Verifies that skipping sub-size generation works.
	 *
	 * @covers ::create_item
	 * @covers ::create_item_permissions_check
	 * @covers ::get_upload_request_post
	 */
	public function test_create_item() {
		wp_set_current_user( self::$admin_id );

		$request = new WP_REST_Request( 'POST', '/wp/v2/media' );
		$request->set_header( 'Content-Type', 'image/jpeg' );
		$request->set_header( 'Content-Disposition', 'attachment; filename=canola.jpg' );
		$request->set_param( 'title', 'My title is very cool' );
		$request->set_param( 'caption', 'This is a better caption.' );
		$request->set_param( 'description', 'Without a description, my attachment is descriptionless.' );
		$request->set_param( 'alt_text', 'Alt text is stored outside post schema.' );
		$request->set_param( 'generate_sub_sizes', false );

		$request->set_body( file_get_contents( self::$image_file ) );
		$response = rest_get_server()->dispatch( $request );
		$data     = $response->get_data();

		$this->assertSame( 201, $response->get_status() );
		$this->assertSame( 'image', $data['media_type'] );
		$this->assertArrayHasKey( 'missing_image_sizes', $data );
		$this->assertNotEmpty( $data['missing_image_sizes'] );
	}

	/**
	 * Verifies that media can be uploaded for a given upload request.
	 *
	 * @covers ::create_item
	 * @covers ::create_item_permissions_check
	 * @covers ::is_valid_upload_request
	 * @covers ::get_upload_request_post
	 */
	public function test_create_item_for_upload_request() {
		$upload_request = $this->factory()->post->create_and_get(
			[
				'post_type'   => 'mexp-upload-request',
				'post_status' => 'publish',
				'post_name'   => 'someslug',
				'meta_input'  => [
					'mexp_allowed_types' => [ 'image' ],
					'mexp_accept'        => 'image/*',
					'mexp_multiple'      => false,
				],
			]
		);

		$request = new WP_REST_Request( 'POST', '/wp/v2/media' );
		$request->set_header( 'Content-Type', 'image/jpeg' );
		$request->set_header( 'Content-Disposition', 'attachment; filename=canola.jpg' );
		$request->set_param( 'title', 'My title is very cool' );
		$request->set_param( 'caption', 'This is a better caption.' );
		$request->set_param( 'description', 'Without a description, my attachment is descriptionless.' );
		$request->set_param( 'alt_text', 'Alt text is stored outside post schema.' );
		$request->set_param( 'generate_sub_sizes', false );
		$request->set_param( 'upload_request', $upload_request->post_name );

		$request->set_body( file_get_contents( self::$image_file ) );
		$response = rest_get_server()->dispatch( $request );
		$data     = $response->get_data();

		$this->assertSame( 201, $response->get_status() );
		$this->assertSame( 'image', $data['media_type'] );
		$this->assertArrayHasKey( 'missing_image_sizes', $data );
		$this->assertNotEmpty( $data['missing_image_sizes'] );
	}

	/**
	 * Verifies that skipping sub-size generation works.
	 *
	 * @covers ::create_item
	 * @covers ::create_item_permissions_check
	 * @covers \MediaExperiments\rest_after_insert_attachment_copy_metadata
	 */
	public function test_create_item_copy_metadata_from_original() {
		wp_set_current_user( self::$admin_id );

		$original_id = self::factory()->attachment->create_object(
			self::$image_file_2,
			0,
			array(
				'post_mime_type' => 'image/jpeg',
				'post_excerpt'   => 'A sample caption',
			)
		);

		wp_update_attachment_metadata( $original_id, wp_generate_attachment_metadata( $original_id, self::$image_file_2 ) );

		add_filter( 'wp_generate_attachment_metadata', '__return_empty_array', 1 );

		$request = new WP_REST_Request( 'POST', '/wp/v2/media' );
		$request->set_header( 'Content-Type', 'image/jpeg' );
		$request->set_header( 'Content-Disposition', 'attachment; filename=canola.jpg' );
		$request->set_param( 'title', 'My title is very cool' );
		$request->set_param( 'caption', 'This is a better caption.' );
		$request->set_param( 'description', 'Without a description, my attachment is descriptionless.' );
		$request->set_param( 'alt_text', 'Alt text is stored outside post schema.' );
		$request->set_param( 'generate_sub_sizes', false );
		$request->set_param( 'meta', [ 'mexp_original_id' => $original_id ] );

		$request->set_body( file_get_contents( self::$image_file ) );
		$response = rest_get_server()->dispatch( $request );

		remove_filter( 'wp_generate_attachment_metadata', '__return_empty_array', 1 );

		$this->assertSame( 201, $response->get_status() );

		$data = $response->get_data();

		$this->assertArrayHasKey( 'media_details', $data );
		$this->assertArrayHasKey( 'width', $data['media_details'] );
		$this->assertArrayHasKey( 'height', $data['media_details'] );
		$this->assertArrayHasKey( 'file', $data['media_details'] );
	}

	/**
	 * Verifies that skipping sub-size generation works.
	 *
	 * @covers ::create_item
	 * @covers ::create_item_permissions_check
	 * @covers \MediaExperiments\rest_after_insert_attachment_insert_additional_metadata
	 */
	public function test_create_item_insert_additional_metadata() {
		wp_set_current_user( self::$admin_id );

		$request = new WP_REST_Request( 'POST', '/wp/v2/media' );
		$request->set_header( 'Content-Type', 'image/jpeg' );
		$request->set_header( 'Content-Disposition', 'attachment; filename=canola.jpg' );
		$request->set_param( 'title', 'My title is very cool' );
		$request->set_param( 'caption', 'This is a better caption.' );
		$request->set_param( 'description', 'Without a description, my attachment is descriptionless.' );
		$request->set_param( 'alt_text', 'Alt text is stored outside post schema.' );
		$request->set_param( 'generate_sub_sizes', false );
		$request->set_param( 'mexp_blurhash', '123abcdef' );
		$request->set_param( 'mexp_dominant_color', '#fff000' );
		$request->set_param( 'mexp_is_muted', true );
		$request->set_param( 'mexp_has_transparency', true );

		$request->set_body( file_get_contents( self::$image_file ) );
		$response = rest_get_server()->dispatch( $request );

		remove_filter( 'wp_generate_attachment_metadata', '__return_empty_array', 1 );

		$this->assertSame( 201, $response->get_status() );

		$data = $response->get_data();

		$this->assertArrayHasKey( 'mexp_blurhash', $data );
		$this->assertArrayHasKey( 'mexp_dominant_color', $data );
		$this->assertArrayHasKey( 'mexp_is_muted', $data );
		$this->assertArrayHasKey( 'mexp_has_transparency', $data );

		$this->assertSame( '123abcdef', $data['mexp_blurhash'] );
		$this->assertSame( '#fff000', $data['mexp_dominant_color'] );
		$this->assertSame( true, $data['mexp_is_muted'] );
		$this->assertSame( true, $data['mexp_has_transparency'] );

		$this->assertArrayHasKey( 'media_details', $data );
		$this->assertArrayHasKey( 'image_meta', $data['media_details'] );
		$this->assertArrayHasKey( 'blurhash', $data['media_details'] );
		$this->assertArrayHasKey( 'dominant_color', $data['media_details'] );
		$this->assertArrayHasKey( 'is_muted', $data['media_details'] );
		$this->assertArrayHasKey( 'has_transparency', $data['media_details'] );
	}

	/**
	 * Verifies that PDF metadata is updated with information
	 * about the generated poster.
	 *
	 * @covers \MediaExperiments\rest_after_insert_attachment_handle_pdf_poster
	 */
	public function test_update_item_pdf_generated_poster() {
		wp_set_current_user( self::$admin_id );

		$pdf_attachment_id = self::factory()->attachment->create_object(
			self::$pdf_file,
			0,
			array(
				'post_mime_type' => 'application/pdf',
				'post_excerpt'   => 'A sample caption',
			)
		);

		wp_update_attachment_metadata( $pdf_attachment_id, wp_generate_attachment_metadata( $pdf_attachment_id, self::$pdf_file ) );

		$image_attachment_id = self::factory()->attachment->create_object(
			self::$image_file,
			0,
			array(
				'post_mime_type' => 'image/jpeg',
				'post_excerpt'   => 'A sample caption',
			)
		);

		wp_update_attachment_metadata( $image_attachment_id, wp_generate_attachment_metadata( $image_attachment_id, self::$image_file ) );

		$request = new WP_REST_Request( 'POST', sprintf( '/wp/v2/media/%d', $pdf_attachment_id ) );
		$request->set_param( 'context', 'edit' );
		$request->set_param( 'featured_media', $image_attachment_id );
		$request->set_param( 'meta', [ 'mexp_generated_poster_id' => $image_attachment_id ] );

		rest_get_server()->dispatch( $request );

		$pdf_metadata = wp_get_attachment_metadata( $pdf_attachment_id );

		$this->assertIsArray( $pdf_metadata );
		$this->assertArrayHasKey( 'sizes', $pdf_metadata );
		$this->assertArrayHasKey( 'full', $pdf_metadata['sizes'] );
		$this->assertArrayHasKey( 'file', $pdf_metadata['sizes']['full'] );
		$this->assertSame( 'canola.jpg', $pdf_metadata['sizes']['full']['file'] );
	}

	/**
	 * Verifies that the controller adds missing_image_sizes to the response for PDFs.
	 *
	 * @covers ::prepare_item_for_response
	 * @covers \MediaExperiments\register_rest_fields
	 */
	public function test_prepare_item() {
		wp_set_current_user( self::$admin_id );

		$attachment_id = self::factory()->attachment->create_object(
			self::$pdf_file,
			0,
			array(
				'post_mime_type' => 'application/pdf',
				'post_excerpt'   => 'A sample caption',
			)
		);

		$request = new WP_REST_Request( 'GET', sprintf( '/wp/v2/media/%d', $attachment_id ) );
		$request->set_param( 'context', 'edit' );

		$response = rest_get_server()->dispatch( $request );
		$data     = $response->get_data();

		$this->assertArrayHasKey( 'missing_image_sizes', $data );
		$this->assertNotEmpty( $data['missing_image_sizes'] );
		$this->assertArrayHasKey( 'mexp_filename', $data );
		$this->assertArrayHasKey( 'mexp_filesize', $data );
		$this->assertArrayHasKey( 'mexp_blurhash', $data );
		$this->assertArrayHasKey( 'mexp_dominant_color', $data );
		$this->assertArrayHasKey( 'mexp_is_muted', $data );
		$this->assertArrayHasKey( 'mexp_has_transparency', $data );
	}

	/**
	 * @covers ::prepare_items_query
	 * @covers ::get_upload_request_post
	 * @covers ::get_collection_params
	 */
	public function test_get_items_for_upload_request() {
		$attachment_id = self::factory()->attachment->create_object(
			self::$image_file,
			0,
			array(
				'post_mime_type' => 'image/jpeg',
				'post_excerpt'   => 'A sample caption',
			)
		);

		$upload_request = $this->factory()->post->create_and_get(
			[
				'post_type'   => 'mexp-upload-request',
				'post_status' => 'publish',
				'post_name'   => 'someslug',
				'meta_input'  => [
					'mexp_attachment_id' => $attachment_id,
				],
			]
		);

		wp_set_current_user( self::$admin_id );

		$request = new WP_REST_Request( 'GET', '/wp/v2/media' );
		$request->set_param( 'upload_request', $upload_request->post_name );
		$request->set_param( 'context', 'edit' );

		$response = rest_get_server()->dispatch( $request );
		$data     = $response->get_data();

		$this->assertCount( 1, $data );
		$ids = wp_list_pluck( $data, 'id' );
		$this->assertContains( $attachment_id, $ids );
	}

	/**
	 * @covers ::prepare_items_query
	 * @covers ::get_upload_request_post
	 * @covers ::get_collection_params
	 */
	public function test_get_items_for_upload_request_trashed() {
		$attachment_id = self::factory()->attachment->create_object(
			self::$image_file,
			0,
			array(
				'post_mime_type' => 'image/jpeg',
				'post_excerpt'   => 'A sample caption',
			)
		);

		$upload_request = $this->factory()->post->create_and_get(
			[
				'post_type'   => 'mexp-upload-request',
				'post_status' => 'publish',
				'post_name'   => 'someslug',
				'meta_input'  => [
					'mexp_attachment_id' => $attachment_id,
				],
			]
		);

		wp_trash_post( $upload_request->ID );

		wp_set_current_user( self::$admin_id );

		$request = new WP_REST_Request( 'GET', '/wp/v2/media' );
		$request->set_param( 'upload_request', $upload_request->post_name );
		$request->set_param( 'context', 'edit' );

		$response = rest_get_server()->dispatch( $request );
		$data     = $response->get_data();

		$this->assertCount( 0, $data );
	}

	/**
	 * @covers ::prepare_items_query
	 * @covers ::get_upload_request_post
	 * @covers ::get_collection_params
	 */
	public function test_get_items_for_upload_request_not_uploaded_yet() {
		$upload_request = $this->factory()->post->create_and_get(
			[
				'post_type'   => 'mexp-upload-request',
				'post_status' => 'publish',
				'post_name'   => 'someslug',
			]
		);

		wp_set_current_user( self::$admin_id );

		$request = new WP_REST_Request( 'GET', '/wp/v2/media' );
		$request->set_param( 'upload_request', $upload_request->post_name );
		$request->set_param( 'context', 'edit' );

		$response = rest_get_server()->dispatch( $request );
		$data     = $response->get_data();

		$this->assertCount( 0, $data );
	}

	/**
	 * @covers ::sideload_item
	 * @covers ::sideload_item_permissions_check
	 */
	public function test_sideload_item() {
		wp_set_current_user( self::$admin_id );

		$attachment_id = self::factory()->attachment->create_object(
			self::$image_file,
			0,
			array(
				'post_mime_type' => 'image/jpeg',
				'post_excerpt'   => 'A sample caption',
			)
		);

		wp_update_attachment_metadata( $attachment_id, wp_generate_attachment_metadata( $attachment_id, self::$image_file ) );

		$request = new WP_REST_Request( 'POST', "/wp/v2/media/$attachment_id/sideload" );
		$request->set_header( 'Content-Type', 'image/jpeg' );
		$request->set_header( 'Content-Disposition', 'attachment; filename=canola.jpg' );
		$request->set_param( 'image_size', 'medium' );

		$request->set_body( file_get_contents( self::$image_file_2 ) );
		$response = rest_get_server()->dispatch( $request );
		$data     = $response->get_data();

		$this->assertSame( 201, $response->get_status() );
		$this->assertSame( 'image', $data['media_type'] );
		$this->assertArrayHasKey( 'missing_image_sizes', $data );
		$this->assertEmpty( $data['missing_image_sizes'] );
		$this->assertArrayHasKey( 'media_details', $data );
		$this->assertArrayHasKey( 'sizes', $data['media_details'] );
		$this->assertArrayHasKey( 'medium', $data['media_details']['sizes'] );
		$this->assertArrayHasKey( 'file', $data['media_details']['sizes']['medium'] );
		$this->assertSame( 'canola.jpg', $data['media_details']['sizes']['medium']['file'] );
	}

	/**
	 * @covers ::sideload_item
	 * @covers ::sideload_item_permissions_check
	 */
	public function test_sideload_item_for_upload_request() {
		$this->markTestIncomplete( 'TODO: Implement' );
	}


	/**
	 * @covers ::sideload_item
	 * @covers ::sideload_item_permissions_check
	 */
	public function test_sideload_item_year_month_based_folders() {
		if ( version_compare( get_bloginfo( 'version' ), '6.6-beta1', '<' ) ) {
			$this->markTestSkipped( 'This test requires WordPress 6.6+' );
		}

		update_option( 'uploads_use_yearmonth_folders', 1 );

		wp_set_current_user( self::$admin_id );

		$published_post = self::factory()->post->create(
			array(
				'post_status'   => 'publish',
				'post_date'     => '2017-02-14 00:00:00',
				'post_date_gmt' => '2017-02-14 00:00:00',
			)
		);

		$request = new WP_REST_Request( 'POST', '/wp/v2/media' );
		$request->set_header( 'Content-Type', 'image/jpeg' );
		$request->set_header( 'Content-Disposition', 'attachment; filename=canola.jpg' );
		$request->set_param( 'post', $published_post );
		$request->set_param( 'generate_sub_sizes', false );

		$request->set_body( file_get_contents( self::$image_file ) );
		$response = rest_get_server()->dispatch( $request );
		$data     = $response->get_data();

		$attachment_id = $data['id'];

		$request = new WP_REST_Request( 'POST', "/wp/v2/media/$attachment_id/sideload" );
		$request->set_header( 'Content-Type', 'image/jpeg' );
		$request->set_header( 'Content-Disposition', 'attachment; filename=canola.jpg' );
		$request->set_param( 'image_size', 'medium' );

		$request->set_body( file_get_contents( self::$image_file_2 ) );
		$response = rest_get_server()->dispatch( $request );
		$data     = $response->get_data();

		update_option( 'uploads_use_yearmonth_folders', 0 );

		$this->assertSame( 201, $response->get_status() );

		$attachment = get_post( $data['id'] );

		$this->assertSame( $attachment->post_parent, $data['post'] );
		$this->assertSame( $attachment->post_parent, $published_post );
		$this->assertSame( wp_get_attachment_url( $attachment->ID ), $data['source_url'] );
		$this->assertStringContainsString( '2017/02', $data['source_url'] );
	}


	/**
	 * @covers ::sideload_item
	 * @covers ::sideload_item_permissions_check
	 */
	public function test_sideload_item_year_month_based_folders_page_post_type() {
		if ( version_compare( get_bloginfo( 'version' ), '6.6-beta1', '<' ) ) {
			$this->markTestSkipped( 'This test requires WordPress 6.6+' );
		}

		update_option( 'uploads_use_yearmonth_folders', 1 );

		wp_set_current_user( self::$admin_id );

		$published_post = self::factory()->post->create(
			array(
				'post_type'     => 'page',
				'post_status'   => 'publish',
				'post_date'     => '2017-02-14 00:00:00',
				'post_date_gmt' => '2017-02-14 00:00:00',
			)
		);

		$request = new WP_REST_Request( 'POST', '/wp/v2/media' );
		$request->set_header( 'Content-Type', 'image/jpeg' );
		$request->set_header( 'Content-Disposition', 'attachment; filename=canola.jpg' );
		$request->set_param( 'post', $published_post );
		$request->set_param( 'generate_sub_sizes', false );

		$request->set_body( file_get_contents( self::$image_file ) );
		$response = rest_get_server()->dispatch( $request );
		$data     = $response->get_data();

		$attachment_id = $data['id'];

		$request = new WP_REST_Request( 'POST', "/wp/v2/media/$attachment_id/sideload" );
		$request->set_header( 'Content-Type', 'image/jpeg' );
		$request->set_header( 'Content-Disposition', 'attachment; filename=canola.jpg' );
		$request->set_param( 'image_size', 'medium' );

		$request->set_body( file_get_contents( self::$image_file_2 ) );
		$response = rest_get_server()->dispatch( $request );
		$data     = $response->get_data();

		update_option( 'uploads_use_yearmonth_folders', 0 );

		$time   = current_time( 'mysql' );
		$y      = substr( $time, 0, 4 );
		$m      = substr( $time, 5, 2 );
		$subdir = "/$y/$m";

		$this->assertSame( 201, $response->get_status() );

		$attachment = get_post( $data['id'] );

		$this->assertSame( $attachment->post_parent, $data['post'] );
		$this->assertSame( $attachment->post_parent, $published_post );
		$this->assertSame( wp_get_attachment_url( $attachment->ID ), $data['source_url'] );
		$this->assertStringNotContainsString( '2017/02', $data['source_url'] );
		$this->assertStringContainsString( $subdir, $data['source_url'] );
	}
}
