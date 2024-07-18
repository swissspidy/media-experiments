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

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<slug>[\w]+)',
			[
				[
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'delete_item' ],
					'permission_callback' => [ $this, 'delete_item_permissions_check' ],
				],
				'args'        => [
					'slug' => [
						'description' => __( 'Unique alphanumeric identifier for the upload request.' ),
						'type'        => 'string',
					],
				],
				'allow_batch' => $this->allow_batch,
				'schema'      => [ $this, 'get_public_item_schema' ],
			]
		);
	}

	/**
	 * Creates a single post.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_REST_Response|WP_Error Response object on success, or WP_Error object on failure.
	 */
	public function create_item( $request ) {
		$request['slug'] = uniqid();

		return parent::create_item( $request );
	}

	/**
	 * Gets an upload request by its slug.
	 *
	 * @param string $slug Supplied slug.
	 * @return WP_Post|WP_Error Post object if slug is valid, WP_Error otherwise.
	 */
	protected function get_post( $slug ) {
		$args = [
			'name'             => $slug,
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

		return $posts[0];
	}

	/**
	 * Retrieves the post's schema, conforming to JSON Schema.
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

		$this->schema = $schema;

		return $this->add_additional_fields_schema( $this->schema );
	}
}
