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
	protected static $admin_id;

	/**
	 * @var string Image file path.
	 */
	private static string $image_file;

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

		self::$pdf_file = get_temp_dir() . 'test-alpha.pdf';
		if ( ! file_exists( self::$image_file ) ) {
			copy( DIR_TESTDATA . '/images/test-alpha.pdf', self::$image_file );
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
	 */
	public function test_create_item_for_upload_request() {
		$this->markTestIncomplete( 'TODO: Implement' );
	}

	/**
	 * Verifies that the controller adds missing_image_sizes to the response for PDFs.
	 *
	 * @covers ::prepare_item_for_response
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

		$attachment = get_post( $attachment_id );
		$request    = new WP_REST_Request( 'GET', sprintf( '/wp/v2/media/%d', $attachment_id ) );
		$request->set_param( 'context', 'edit' );

		$response = rest_get_server()->dispatch( $request );
		$data     = $response->get_data();

		$this->assertArrayHasKey( 'missing_image_sizes', $data );
		$this->assertNotEmpty( $data['missing_image_sizes'] );
	}
}
