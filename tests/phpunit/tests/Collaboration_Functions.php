<?php

namespace MediaExperiments\Tests;

use WP_UnitTestCase;
use WP_UnitTest_Factory;

/**
 * Tests for collaboration functions.
 */
class Test_Collaboration_Functions extends WP_UnitTestCase {
	/**
	 * @var int Post ID for testing.
	 */
	protected static int $post_id;

	/**
	 * @var int Collaboration request ID.
	 */
	protected static int $collab_request_id;

	public static function wpSetUpBeforeClass( WP_UnitTest_Factory $factory ) {
		self::$post_id = $factory->post->create(
			[
				'post_status' => 'publish',
			]
		);

		self::$collab_request_id = $factory->post->create(
			[
				'post_type'   => 'mexp-collab-request',
				'post_status' => 'publish',
				'post_parent' => self::$post_id,
			]
		);
	}

	/**
	 * @covers \MediaExperiments\create_temporary_collaboration_user
	 */
	public function test_create_temporary_collaboration_user() {
		$user_id = \MediaExperiments\create_temporary_collaboration_user( self::$collab_request_id );

		$this->assertNotWPError( $user_id );
		$this->assertIsInt( $user_id );
		$this->assertGreaterThan( 0, $user_id );

		$user = get_userdata( $user_id );
		$this->assertNotFalse( $user );

		// Check username format.
		$this->assertStringStartsWith( 'mexp_guest_', $user->user_login );

		// Check display name is in format "Adjective Animal".
		$this->assertMatchesRegularExpression( '/^[A-Z][a-z]+ [A-Z][a-z]+$/', $user->display_name );

		// Check user has no role.
		$this->assertEmpty( $user->roles );

		// Check user meta.
		$this->assertTrue( (bool) get_user_meta( $user_id, 'mexp_is_temp_collab_user', true ) );
		$this->assertEquals( self::$collab_request_id, (int) get_user_meta( $user_id, 'mexp_collaboration_request_id', true ) );

		// Check persisted preferences.
		$preferences = get_user_meta( $user_id, 'persisted_preferences', true );
		$this->assertIsArray( $preferences );
		$this->assertArrayHasKey( 'media-experiments/preferences', $preferences );
		$this->assertArrayHasKey( 'collabWelcomeShown', $preferences['media-experiments/preferences'] );
		$this->assertTrue( $preferences['media-experiments/preferences']['collabWelcomeShown'] );
	}

	/**
	 * @covers \MediaExperiments\get_collaboration_request_by_slug
	 */
	public function test_get_collaboration_request_by_slug() {
		$slug = 'test-collab-slug-' . wp_generate_password( 8, false );
		$id   = $this->factory()->post->create(
			[
				'post_type'   => 'mexp-collab-request',
				'post_status' => 'publish',
				'post_name'   => $slug,
			]
		);

		$request = \MediaExperiments\get_collaboration_request_by_slug( $slug );

		$this->assertInstanceOf( \WP_Post::class, $request );
		$this->assertEquals( $id, $request->ID );
		$this->assertEquals( $slug, $request->post_name );
		$this->assertEquals( 'mexp-collab-request', $request->post_type );
	}

	/**
	 * @covers \MediaExperiments\get_collaboration_request_by_slug
	 */
	public function test_get_collaboration_request_by_slug_invalid() {
		$request = \MediaExperiments\get_collaboration_request_by_slug( 'nonexistent-slug' );

		$this->assertNull( $request );
	}

	/**
	 * @covers \MediaExperiments\filter_user_has_cap_for_collaboration
	 */
	public function test_filter_user_has_cap_for_collaboration() {
		// Create a temporary user.
		$user_id = \MediaExperiments\create_temporary_collaboration_user( self::$collab_request_id );
		$user    = get_userdata( $user_id );

		// Set the target post ID.
		update_user_meta( $user_id, 'mexp_target_post_id', self::$post_id );

		// Set allowed capabilities.
		update_post_meta( self::$collab_request_id, 'mexp_allowed_capabilities', 'edit_post,upload_files' );

		// Test capability filtering.
		$allcaps = [];
		$caps    = [ 'edit_post' ];
		$args    = [ 'edit_post', $user_id, self::$post_id ];

		$filtered_caps = \MediaExperiments\filter_user_has_cap_for_collaboration( $allcaps, $caps, $args, $user );

		$this->assertArrayHasKey( 'edit_post', $filtered_caps );
		$this->assertTrue( $filtered_caps['edit_post'] );
		$this->assertArrayHasKey( 'upload_files', $filtered_caps );
		$this->assertTrue( $filtered_caps['upload_files'] );
	}

	/**
	 * @covers \MediaExperiments\filter_user_has_cap_for_collaboration
	 */
	public function test_filter_user_has_cap_for_collaboration_wrong_post() {
		// Create a temporary user.
		$user_id = \MediaExperiments\create_temporary_collaboration_user( self::$collab_request_id );
		$user    = get_userdata( $user_id );

		// Set the target post ID.
		update_user_meta( $user_id, 'mexp_target_post_id', self::$post_id );

		// Set allowed capabilities.
		update_post_meta( self::$collab_request_id, 'mexp_allowed_capabilities', 'edit_post' );

		// Test capability filtering with different post ID.
		$wrong_post_id = $this->factory()->post->create();
		$allcaps       = [];
		$caps          = [ 'edit_post' ];
		$args          = [ 'edit_post', $user_id, $wrong_post_id ];

		$filtered_caps = \MediaExperiments\filter_user_has_cap_for_collaboration( $allcaps, $caps, $args, $user );

		// Should not have added capabilities for wrong post.
		$this->assertArrayNotHasKey( 'edit_post', $filtered_caps );
	}

	/**
	 * @covers \MediaExperiments\filter_user_has_cap_for_collaboration
	 */
	public function test_filter_user_has_cap_for_collaboration_regular_user() {
		$regular_user_id = $this->factory()->user->create( [ 'role' => 'editor' ] );
		$user            = get_userdata( $regular_user_id );

		$allcaps = [ 'edit_posts' => true ];
		$caps    = [ 'edit_post' ];
		$args    = [ 'edit_post', $regular_user_id, self::$post_id ];

		$filtered_caps = \MediaExperiments\filter_user_has_cap_for_collaboration( $allcaps, $caps, $args, $user );

		// Should return allcaps unchanged for non-temp users.
		$this->assertEquals( $allcaps, $filtered_caps );
	}

	/**
	 * @covers \MediaExperiments\delete_old_collaboration_requests
	 */
	public function test_delete_old_collaboration_requests() {
		// Create an old collaboration request with temp user.
		$old_collab_id = $this->factory()->post->create(
			[
				'post_type'   => 'mexp-collab-request',
				'post_status' => 'publish',
				'post_date'   => gmdate( 'Y-m-d H:i:s', strtotime( '-20 minutes' ) ),
			]
		);

		$temp_user_id = \MediaExperiments\create_temporary_collaboration_user( $old_collab_id );
		update_post_meta( $old_collab_id, 'mexp_temp_user_id', $temp_user_id );

		// Verify user exists.
		$this->assertNotFalse( get_userdata( $temp_user_id ) );

		// Run cleanup.
		\MediaExperiments\delete_old_collaboration_requests();

		// Verify post was deleted.
		$this->assertNull( get_post( $old_collab_id ) );

		// Verify user was deleted.
		$this->assertFalse( get_userdata( $temp_user_id ) );
	}
}
