<?php
/**
 * Class REST_Attachments_Controller.
 *
 * @package MediaExperiments
 */

declare(strict_types = 1);

namespace MediaExperiments;

use WP_Error;
use WP_Post;
use WP_REST_Attachments_Controller;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Class REST_Attachments_Controller.
 *
 * @phpstan-type UploadRequest array{
 *   id?: int,
 *   post: int,
 *   upload_request?: string,
 *   author?: int,
 *   sticky?: bool,
 *   generate_sub_sizes?: bool,
 * }
 * @phpstan-type SideloadRequest array{
 *   post?: int,
 *   image_size?: string,
 * }
 */
class REST_Attachments_Controller extends WP_REST_Attachments_Controller {
	/**
	 * Registers the routes for attachments.
	 *
	 * @see register_rest_route()
	 */
	public function register_routes(): void {
		parent::register_routes();

		$args                       = $this->get_endpoint_args_for_item_schema();
		$args['generate_sub_sizes'] = [
			'type'        => 'boolean',
			'default'     => true,
			'description' => __( 'Whether to generate image sub sizes.' ),
		];
		$args['upload_request']     = [
			'description' => __( 'Upload request this file is for.', 'media-experiments' ),
			'type'        => 'string',
		];

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_items' ],
					'permission_callback' => [ $this, 'get_items_permissions_check' ],
					'args'                => $this->get_collection_params(),
				],
				[
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'create_item' ],
					'permission_callback' => [ $this, 'create_item_permissions_check' ],
					'args'                => $args,
				],
				'allow_batch' => $this->allow_batch,
				'schema'      => [ $this, 'get_public_item_schema' ],
			],
			true
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/sideload',
			[
				[
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'sideload_item' ],
					'permission_callback' => [ $this, 'create_item_permissions_check' ],
					'args'                => [
						'image_size'     => [
							'description' => __( 'Image size.', 'media-experiments' ),
							'type'        => 'string',
						],
						'upload_request' => [
							'description' => __( 'Upload request this file is for.', 'media-experiments' ),
							'type'        => 'string',
						],
					],
				],
				'allow_batch' => $this->allow_batch,
				'schema'      => [ $this, 'get_public_item_schema' ],
			]
		);
	}

	/**
	 * Retrieves the query params for collections of attachments.
	 *
	 * @return array Query parameters for the attachment collection as an array.
	 * @phpstan-return array<string, mixed>
	 */
	public function get_collection_params(): array {
		$params = parent::get_collection_params();

		$params['upload_request'] = [
			'default'     => null,
			'description' => __( 'Limit result set to attachments associated with a given attachment request.' ),
			'type'        => 'string',
		];

		return $params;
	}

	/**
	 * Determines the allowed query_vars for a get_items() response and
	 * prepares for WP_Query.
	 *
	 * @param array           $prepared_args Optional. Array of prepared arguments. Default empty array.
	 * @param WP_REST_Request $request       Optional. Request to prepare items for.
	 * @return array Array of query arguments.
	 * @phpstan-param array<string, mixed> $prepared_args
	 * @phpstan-param WP_REST_Request<UploadRequest> $request
	 * @phpstan-return array<string, mixed>
	 */
	protected function prepare_items_query( $prepared_args = [], $request = null ): array {
		$query_args = parent::prepare_items_query( $prepared_args, $request );

		if ( ! empty( $request['upload_request'] ) ) {
			$upload_request = $this->get_upload_request_post( $request );

			if ( $upload_request ) {
				$attachment_id = get_post_meta(
					$upload_request->ID,
					'mexp_attachment_id',
					true
				);

				if ( $attachment_id ) {
					$query_args['post__in'] = [ $attachment_id ];
				} else {
					// Upload has not been completed yet.
					// Trick into returning an empty list.
					$query_args['post__in'] = [ 0 ];
				}
			} else {
				// The upload request was probably already deleted.
				// Trick into returning an empty list.
				$query_args['post__in'] = [ 0 ];
			}
		}

		return $query_args;
	}

	/**
	 * Creates a single attachment.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_REST_Response|WP_Error Response object on success, WP_Error object on failure.
	 * @phpstan-param WP_REST_Request<UploadRequest> $request
	 */
	public function create_item( $request ): WP_Error|WP_REST_Response {
		if ( false === $request['generate_sub_sizes'] ) {
			add_filter( 'intermediate_image_sizes_advanced', '__return_empty_array', 100 );
		}

		$upload_request = $this->get_upload_request_post( $request );

		$grant_meta_update = static function ( $caps, $cap, $user_id, $args ) {
			if ( 'edit_post_meta' !== $cap ) {
				return $caps;
			}

			// $args[0] is the attachment ID, $args[1] the meta key.
			if ( str_starts_with( $args[1], 'mexp_' ) ) {
				$caps = [ 'exist' ];
			}

			return $caps;
		};

		if ( $upload_request ) {
			add_filter( 'map_meta_cap', $grant_meta_update, 10, 4 );

			// Set the attachment's parent post to the one associated with the upload request.
			if ( $upload_request->post_parent ) {
				$request['post'] = $upload_request->post_parent;
			}
		}

		$response = parent::create_item( $request );

		remove_filter( 'intermediate_image_sizes_advanced', '__return_empty_array', 100 );
		remove_filter( 'map_meta_cap', $grant_meta_update );

		if ( $upload_request && $response instanceof WP_REST_Response ) {
			/**
			 * Uploaded attachment ID.
			 *
			 * @var int $attachment_id
			 */
			$attachment_id = $response->get_data()['id']; // TODO: Improve phpstan typing.

			add_post_meta(
				$upload_request->ID,
				'mexp_attachment_id',
				$attachment_id,
				true
			);
		}

		return $response;
	}

	/**
	 * Checks if a given request has access to create an attachment.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return true|WP_Error Boolean true if the attachment may be created, or a WP_Error if not.
	 * @phpstan-param WP_REST_Request<UploadRequest> $request
	 */
	public function create_item_permissions_check( $request ): bool|WP_Error {
		if ( ! empty( $request['id'] ) ) {
			return new WP_Error(
				'rest_post_exists',
				__( 'Cannot create existing post.' ),
				[ 'status' => 400 ]
			);
		}

		$post_type = get_post_type_object( $this->post_type );

		if ( ! $post_type ) {
			return new WP_Error(
				'rest_cannot_edit_others',
				__( 'Sorry, you are not allowed to create posts as this user.' ),
				[ 'status' => rest_authorization_required_code() ]
			);
		}

		if ( ! empty( $request['author'] ) && get_current_user_id() !== $request['author'] && ! current_user_can( $post_type->cap->edit_others_posts ) ) {
			return new WP_Error(
				'rest_cannot_edit_others',
				__( 'Sorry, you are not allowed to create posts as this user.' ),
				[ 'status' => rest_authorization_required_code() ]
			);
		}

		if ( ! empty( $request['sticky'] ) && ! current_user_can( $post_type->cap->edit_others_posts ) && ! current_user_can( $post_type->cap->publish_posts ) ) {
			return new WP_Error(
				'rest_cannot_assign_sticky',
				__( 'Sorry, you are not allowed to make posts sticky.' ),
				[ 'status' => rest_authorization_required_code() ]
			);
		}

		if ( ! current_user_can( $post_type->cap->create_posts ) && ! $this->is_valid_upload_request( $request ) ) {
			return new WP_Error(
				'rest_cannot_create',
				__( 'Sorry, you are not allowed to create posts as this user.' ),
				[ 'status' => rest_authorization_required_code() ]
			);
		}

		if ( ! $this->check_assign_terms_permission( $request ) ) {
			return new WP_Error(
				'rest_cannot_assign_term',
				__( 'Sorry, you are not allowed to assign the provided terms.' ),
				[ 'status' => rest_authorization_required_code() ]
			);
		}

		if ( ! current_user_can( 'upload_files' ) && ! $this->is_valid_upload_request( $request ) ) {
			return new WP_Error(
				'rest_cannot_create',
				__( 'Sorry, you are not allowed to upload media on this site.' ),
				[ 'status' => 400 ]
			);
		}

		// Attaching media to a post requires ability to edit said post,
		// unless it's for an upload request and the post matches the request.

		$upload_request = $this->get_upload_request_post( $request );

		if (
			! empty( $request['post'] ) &&
			! current_user_can( 'edit_post', (int) $request['post'] ) &&
			( ! $upload_request || $upload_request->post_parent !== $request['post'] )
		) {
			return new WP_Error(
				'rest_cannot_edit',
				__( 'Sorry, you are not allowed to upload media to this post.' ),
				[ 'status' => rest_authorization_required_code() ]
			);
		}

		return true;
	}

	/**
	 * Determines whether this request is for a valid media upload request.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return bool Whether this request is for a valid media upload request.
	 * @phpstan-param WP_REST_Request<UploadRequest> $request
	 */
	protected function is_valid_upload_request( WP_REST_Request $request ): bool {
		$post = $this->get_upload_request_post( $request );

		// TODO: Bail if there is already an attachment for this upload request.

		return (bool) $post;
	}

	/**
	 * Returns the upload request instance associated with this request.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 *
	 * @return WP_Post|null Media upload request if valid, null otherwise.
	 * @phpstan-param WP_REST_Request<UploadRequest> $request
	 */
	protected function get_upload_request_post( WP_REST_Request $request ): ?WP_Post {
		if ( empty( $request['upload_request'] ) ) {
			return null;
		}

		$args = [
			'name'             => $request['upload_request'],
			'post_type'        => 'mexp-upload-request',
			'post_status'      => 'publish',
			'numberposts'      => 1,
			'suppress_filters' => false,
		];

		$posts = get_posts( $args );

		if ( empty( $posts ) ) {
			return null;
		}

		return $posts[0];
	}

	/**
	 * Side-loads a media file without creating an attachment.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_REST_Response|WP_Error Response object on success, WP_Error object on failure.
	 * @phpstan-param WP_REST_Request<SideloadRequest> $request
	 */
	public function sideload_item( WP_REST_Request $request ): WP_Error|WP_REST_Response {
		if ( ! empty( $request['post'] ) && 'attachment' !== get_post_type( $request['post'] ) ) {
			return new WP_Error(
				'rest_invalid_param',
				__( 'Invalid parent type.', 'media-experiments' ),
				[ 'status' => 400 ]
			);
		}

		// Get the file via $_FILES or raw data.
		$files   = $request->get_file_params();
		$headers = $request->get_headers();

		// Note: wp_unique_filename() will always add numeric suffix if the name looks like a sub-size to avoid conflicts.
		// See https://github.com/WordPress/wordpress-develop/blob/30954f7ac0840cfdad464928021d7f380940c347/src/wp-includes/functions.php#L2576-L2582
		// TODO: Document this or add workaround.

		if ( ! empty( $files ) ) {
			$file = $this->upload_from_file( $files, $headers );
		} else {
			$file = $this->upload_from_data( $request->get_body(), $headers );
		}

		if ( is_wp_error( $file ) ) {
			return $file;
		}

		$url  = $file['url'];
		$type = $file['type'];
		$path = $file['file'];

		$attachment_id = $request['post'];

		// TODO: Better fallback if image_size is not provided.
		$image_size = $request['image_size'] ?? 'thumbnail';

		// In case we're sideloading a PDF poster.
		if ( 'application/pdf' === get_post_mime_type( $attachment_id ) ) {
			$image_size = 'full';
		}

		$metadata = wp_get_attachment_metadata( $attachment_id, true );

		if ( ! $metadata ) {
			$metadata = [];
		}

		if ( 'original' === $image_size ) {
			$metadata['original_image'] = basename( $path );
		} else {
			$metadata['sizes'] = $metadata['sizes'] ?? [];

			$size = wp_getimagesize( $path );

			$metadata['sizes'][ $image_size ] = [
				'width'     => $size ? $size[0] : 0,
				'height'    => $size ? $size[1] : 0,
				'file'      => basename( $path ),
				'mime_type' => $type,
				'filesize'  => wp_filesize( $path ),
			];
		}

		wp_update_attachment_metadata( $attachment_id, $metadata );

		$data = [
			'success' => true,
			'url'     => $url,
		];

		$response = rest_ensure_response( $data );

		if ( ! is_wp_error( $response ) ) {
			$response->set_status( 201 );
			$response->header( 'Location', rest_url( sprintf( '%s/%s/%d', $this->namespace, $this->rest_base, $attachment_id ) ) );
		}

		return $response;
	}
}
