<?php
/**
 * Class REST_Upload_Requests_Controller.
 *
 * @package MediaExperiments
 */

declare(strict_types = 1);

namespace MediaExperiments;

use WP_Error;
use WP_Post;
use WP_Post_Type;
use WP_REST_Posts_Controller;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Class REST_Upload_Requests_Controller
 */
class REST_Upload_Requests_Controller extends WP_REST_Posts_Controller {
	/**
	 * Registers the routes for upload requests.
	 *
	 * @see register_rest_route()
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				[
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'create_item' ],
					'permission_callback' => [ $this, 'create_item_permissions_check' ],
					'args'                => $this->get_endpoint_args_for_item_schema( WP_REST_Server::CREATABLE ),
				],
				'allow_batch' => $this->allow_batch,
				'schema'      => [ $this, 'get_public_item_schema' ],
			]
		);

		$get_item_args = [
			'context' => $this->get_context_param( [ 'default' => 'view' ] ),
		];

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<slug>[\w]+)',
			[
				'args'        => [
					'slug' => [
						'description' => __( 'Unique alphanumeric identifier for the upload request.' ),
						'type'        => 'string',
					],
				],
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_item' ],
					'permission_callback' => [ $this, 'get_item_permissions_check' ],
					'args'                => $get_item_args,
				],
				[
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'delete_item' ],
					'permission_callback' => [ $this, 'delete_item_permissions_check' ],
				],
				'allow_batch' => $this->allow_batch,
				'schema'      => [ $this, 'get_public_item_schema' ],
			]
		);
	}

	/**
	 * Retrieves a single post.
	 *
	 * @since 4.7.0
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_REST_Response|WP_Error Response object on success, or WP_Error object on failure.
	 * @phpstan-param WP_REST_Request<array{slug: string}> $request
	 */
	public function get_item( $request ) {
		$args = [
			'name'             => $request['slug'],
			'post_type'        => 'mexp-upload-request',
			'post_status'      => 'publish',
			'numberposts'      => 1,
			'suppress_filters' => false,
		];

		$posts = get_posts( $args );

		if ( empty( $posts ) || $this->post_type !== $posts[0]->post_type ) {
			return new WP_Error(
				'rest_post_invalid_id',
				__( 'Invalid post ID.' ),
				[ 'status' => 404 ]
			);
		}

		$post = $posts[0];

		$data     = $this->prepare_item_for_response( $post, $request );
		$response = rest_ensure_response( $data );

		$post_type = get_post_type_object( $post->post_type );

		if ( ! is_wp_error( $response ) && $post_type instanceof WP_Post_Type && is_post_type_viewable( $post_type ) ) {
			$permalink = get_permalink( $post->ID );
			if ( $permalink ) {
				$response->link_header( 'alternate', $permalink, [ 'type' => 'text/html' ] );
			}
		}

		return $response;
	}

	/**
	 * Retrieves the post's schema, conforming to JSON Schema.
	 *
	 * @since 4.7.0
	 *
	 * @return array Item schema data.
	 * @phpstan-return array<string,mixed>
	 */
	public function get_item_schema(): array {
		if ( ! empty( $this->schema ) ) {
			return $this->add_additional_fields_schema( $this->schema );
		}

		$schema = [
			'$schema'    => 'http://json-schema.org/draft-04/schema#',
			'title'      => $this->post_type,
			'type'       => 'object',
			'properties' => [
				'date'     => [
					'description' => __( "The date the post was published, in the site's timezone." ),
					'type'        => [ 'string', 'null' ],
					'format'      => 'date-time',
					'context'     => [ 'view', 'edit', 'embed' ],
				],
				'date_gmt' => [
					'description' => __( 'The date the post was published, as GMT.' ),
					'type'        => [ 'string', 'null' ],
					'format'      => 'date-time',
					'context'     => [ 'view', 'edit' ],
				],
				'link'     => [
					'description' => __( 'URL to the post.' ),
					'type'        => 'string',
					'format'      => 'uri',
					'context'     => [ 'view', 'edit', 'embed' ],
					'readonly'    => true,
				],
				'slug'     => [
					'description' => __( 'Unique alphanumeric identifier for the upload request.' ),
					'type'        => 'string',
					'context'     => [ 'view', 'edit', 'embed' ],
					'arg_options' => [
						'sanitize_callback' => [ $this, 'sanitize_slug' ],
					],
				],
				'status'   => [
					'description' => __( 'A named status for the post.' ),
					'type'        => 'string',
					'enum'        => array_keys( get_post_stati( [ 'internal' => false ] ) ),
					'context'     => [ 'view', 'edit' ],
					'arg_options' => [
						'validate_callback' => [ $this, 'check_status' ],
					],
				],
				'parent'   => [
					'description' => __( 'The ID for the parent of the post.' ),
					'type'        => 'integer',
					'context'     => [ 'view', 'edit' ],
				],
				'author'   => [
					'description' => __( 'The ID for the author of the post.' ),
					'type'        => 'integer',
					'context'     => [ 'view', 'edit', 'embed' ],
				],
				'meta'     => $this->meta->get_field_schema(),
			],
		];

		// Take a snapshot of which fields are in the schema pre-filtering.
		$schema_fields = array_keys( $schema['properties'] );

		/**
		 * Filters the post's schema.
		 *
		 * The dynamic portion of the filter, `$this->post_type`, refers to the
		 * post type slug for the controller.
		 *
		 * Possible hook names include:
		 *
		 *  - `rest_post_item_schema`
		 *  - `rest_page_item_schema`
		 *  - `rest_attachment_item_schema`
		 *
		 * @since 5.4.0
		 *
		 * @param array $schema Item schema data.
		 */
		$schema = apply_filters( "rest_{$this->post_type}_item_schema", $schema ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

		// Emit a _doing_it_wrong warning if user tries to add new properties using this filter.
		$new_fields = array_diff( array_keys( $schema['properties'] ), $schema_fields );
		if ( count( $new_fields ) > 0 ) {
			_doing_it_wrong(
				__METHOD__,
				sprintf(
				/* translators: %s: register_rest_field */
					__( 'Please use %s to add new schema properties.' ),
					'register_rest_field'
				),
				'5.4.0'
			);
		}

		$this->schema = $schema;

		return $this->add_additional_fields_schema( $this->schema );
	}
}
