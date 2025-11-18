<?php

namespace MediaExperiments\Tests;

use MediaExperiments\REST_Collaboration_Requests_Controller;
use WP_REST_Request;
use WP_Test_REST_Post_Type_Controller_Testcase;
use WP_UnitTest_Factory;

/**
 * @coversDefaultClass \MediaExperiments\REST_Collaboration_Requests_Controller
 */
class Test_REST_Collaboration_Requests_Controller extends WP_Test_REST_Post_Type_Controller_Testcase {
	/**
	 * @var int Administrator ID.
	 */
	protected static int $admin_id;

	/**
	 * @var int Post ID for testing.
	 */
	protected static int $post_id;

	public static function wpSetUpBeforeClass( WP_UnitTest_Factory $factory ) {
		self::$admin_id = $factory->user->create(
			[
				'role' => 'administrator',
			]
		);

		self::$post_id = $factory->post->create(
			[
				'post_status' => 'publish',
				'post_author' => self::$admin_id,
			]
		);
	}

	public function test_get_items() {
		$this->markTestSkipped( 'No need to implement' );
	}

	public function test_prepare_item() {
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
		$this->assertArrayHasKey( '/wp/v2/collaboration-requests', $routes );
		$this->assertCount( 2, $routes['/wp/v2/collaboration-requests'] );
		$this->assertArrayHasKey( '/wp/v2/collaboration-requests/(?P<slug>[\w]+)', $routes );
		$this->assertCount( 1, $routes['/wp/v2/collaboration-requests/(?P<slug>[\w]+)'] );
	}

	/**
	 * @covers ::create_item
	 */
	public function test_create_item() {
		wp_set_current_user( self::$admin_id );

		$request = new WP_REST_Request( 'POST', '/wp/v2/collaboration-requests' );
		$request->set_param( 'status', 'publish' );
		$request->set_param( 'parent', self::$post_id );
		$request->set_param(
			'meta',
			[
				'mexp_allowed_capabilities' => 'edit_post,upload_files',
			]
		);

		$response = rest_get_server()->dispatch( $request );
		$data     = $response->get_data();

		$this->assertSame( 201, $response->get_status() );
		$this->assertArrayHasKey( 'id', $data );
		$this->assertArrayHasKey( 'slug', $data );
		$this->assertNotEmpty( $data['slug'] );

		// Verify temporary user was created.
		$temp_user_id = get_post_meta( $data['id'], 'mexp_temp_user_id', true );
		$this->assertNotEmpty( $temp_user_id );
		$this->assertIsNumeric( $temp_user_id );

		$user = get_userdata( (int) $temp_user_id );
		$this->assertNotFalse( $user );
		$this->assertStringStartsWith( 'mexp_guest_', $user->user_login );

		// Verify user meta.
		$this->assertTrue( (bool) get_user_meta( $user->ID, 'mexp_is_temp_collab_user', true ) );
		$this->assertEquals( $data['id'], get_user_meta( $user->ID, 'mexp_collaboration_request_id', true ) );

		// Verify persisted preferences were set.
		$preferences = get_user_meta( $user->ID, 'persisted_preferences', true );
		$this->assertIsArray( $preferences );
		$this->assertArrayHasKey( 'media-experiments/preferences', $preferences );
		$this->assertArrayHasKey( 'collabWelcomeShown', $preferences['media-experiments/preferences'] );
		$this->assertTrue( $preferences['media-experiments/preferences']['collabWelcomeShown'] );
	}

	/**
	 * @covers ::get_post
	 * @covers ::delete_item
	 */
	public function test_delete_item() {
		wp_set_current_user( self::$admin_id );

		$collab_request = $this->factory()->post->create(
			[
				'post_type'   => 'mexp-collab-request',
				'post_status' => 'publish',
				'post_name'   => 'testslug123',
			]
		);

		$request  = new WP_REST_Request( 'DELETE', '/wp/v2/collaboration-requests/testslug123' );
		$response = rest_get_server()->dispatch( $request );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'trash', get_post_status( $collab_request ) );
	}
}
