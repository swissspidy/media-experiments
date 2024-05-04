<?php

namespace MediaExperiments\Tests;

use MediaExperiments\REST_Upload_Requests_Controller;
use WP_REST_Request;
use WP_Test_REST_Post_Type_Controller_Testcase;
use WP_UnitTest_Factory;

/**
 * @coversDefaultClass \MediaExperiments\REST_Upload_Requests_Controller
 */
class Test_REST_Upload_Requests_Controller extends WP_Test_REST_Post_Type_Controller_Testcase {
	/**
	 * @var int Administrator ID.
	 */
	protected static int $admin_id;

	public static function wpSetUpBeforeClass( WP_UnitTest_Factory $factory ) {
		self::$admin_id = $factory->user->create(
			[
				'role' => 'administrator',
			]
		);
	}

	public function test_get_items() {
		$this->markTestSkipped( 'No need to implement' );
	}

	public function test_prepare_item() {
		$this->markTestSkipped( 'No need to implement' );
	}
	public function test_create_item() {
		$this->markTestSkipped( 'No need to implement' );
	}

	public function test_update_item() {
		$this->markTestSkipped( 'No need to implement' );
	}

	public function test_get_item() {
		$this->markTestSkipped( 'No need to implement' );
	}

	public function test_context_param() {
		$this->markTestSkipped( 'No need to implement' );
	}

	/**
	 * @covers ::register_routes
	 */
	public function test_register_routes() {
		$routes = rest_get_server()->get_routes();
		$this->assertArrayHasKey( '/wp/v2/upload-requests', $routes );
		$this->assertCount( 1, $routes['/wp/v2/upload-requests'] );
		$this->assertArrayHasKey( '/wp/v2/upload-requests/(?P<slug>[\w]+)', $routes );
		$this->assertCount( 1, $routes['/wp/v2/upload-requests/(?P<slug>[\w]+)'] );
	}

	/**
	 * @covers ::get_post
	 */
	public function test_delete_item() {
		wp_set_current_user( self::$admin_id );

		$upload_request = $this->factory()->post->create(
			[
				'post_type'   => 'mexp-upload-request',
				'post_status' => 'publish',
				'post_name'   => 'someslug',
			]
		);

		$request  = new WP_REST_Request( 'DELETE', '/wp/v2/upload-requests/someslug' );
		$response = rest_get_server()->dispatch( $request );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'trash', get_post_status( $upload_request ) );
	}

	/**
	 * @covers ::get_item_schema
	 */
	public function test_get_item_schema() {
		$request    = new WP_REST_Request( 'OPTIONS', '/wp/v2/upload-requests' );
		$response   = rest_get_server()->dispatch( $request );
		$data       = $response->get_data();
		$properties = $data['schema']['properties'];
		$this->assertCount( 8, $properties );
		$this->assertArrayHasKey( 'date', $properties );
		$this->assertArrayHasKey( 'date_gmt', $properties );
		$this->assertArrayHasKey( 'link', $properties );
		$this->assertArrayHasKey( 'slug', $properties );
		$this->assertArrayHasKey( 'status', $properties );
		$this->assertArrayHasKey( 'parent', $properties );
		$this->assertArrayHasKey( 'author', $properties );
		$this->assertArrayHasKey( 'meta', $properties );

		$controller = new REST_Upload_Requests_Controller( 'mexp-upload-request' );
		$schema     = $controller->get_item_schema();
		$properties = $schema['properties'];
		$this->assertCount( 8, $properties );
		$this->assertArrayHasKey( 'date', $properties );
		$this->assertArrayHasKey( 'date_gmt', $properties );
		$this->assertArrayHasKey( 'link', $properties );
		$this->assertArrayHasKey( 'slug', $properties );
		$this->assertArrayHasKey( 'status', $properties );
		$this->assertArrayHasKey( 'parent', $properties );
		$this->assertArrayHasKey( 'author', $properties );
		$this->assertArrayHasKey( 'meta', $properties );
	}
}
