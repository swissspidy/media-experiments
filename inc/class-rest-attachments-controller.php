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
 *   id: int,
 *   image_size: string,
 *   upload_request?: string,
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
			'description' => __( 'Whether to generate image sub sizes.', 'media-experiments' ),
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

		// TODO: Consider support general sideloading, not attached to any post.
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>[\d]+)/sideload',
			[
				[
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'sideload_item' ],
					'permission_callback' => [ $this, 'sideload_item_permissions_check' ],
					'args'                => [
						'id'             => array(
							'description' => __( 'Unique identifier for the attachment.', 'media-experiments' ),
							'type'        => 'integer',
						),
						'image_size'     => [
							'description' => __( 'Image size.', 'media-experiments' ),
							'type'        => 'string',
							'required'    => true,
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
			'description' => __( 'Limit result set to attachments associated with a given attachment request.', 'media-experiments' ),
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
	 * Prepares a single attachment output for response.
	 *
	 * Ensures 'missing_image_sizes' is set for PDFs and not just images.
	 *
	 * @param WP_Post         $item    Attachment object.
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response Response object.
	 */
	public function prepare_item_for_response( $item, $request ) {
		$fields   = $this->get_fields_for_response( $request );
		$response = parent::prepare_item_for_response( $item, $request );

		$data = $response->get_data();

		if ( rest_is_field_included( 'missing_image_sizes', $fields ) ) {
			$mime_type = get_post_mime_type( $item );
			if ( 'application/pdf' === $mime_type ) {
				// Try to create missing image sizes for PDFs.

				$metadata = wp_get_attachment_metadata( $item->ID, true );

				if ( ! is_array( $metadata ) ) {
					$metadata = [];
				}

				$metadata['sizes'] = $metadata['sizes'] ?? [];

				$fallback_sizes = array(
					'thumbnail',
					'medium',
					'large',
				);

				remove_filter( 'fallback_intermediate_image_sizes', '__return_empty_array', 100 );

				/** This filter is documented in wp-admin/includes/image.php */
				$fallback_sizes = apply_filters( 'fallback_intermediate_image_sizes', $fallback_sizes, $metadata ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

				$registered_sizes = wp_get_registered_image_subsizes();
				$merged_sizes     = array_keys( array_intersect_key( $registered_sizes, array_flip( $fallback_sizes ) ) );

				$missing_image_sizes         = array_diff( $merged_sizes, $metadata['sizes'] );
				$data['missing_image_sizes'] = $missing_image_sizes;
			}
		}

		$context = ! empty( $request['context'] ) ? $request['context'] : 'view';
		$data    = $this->add_additional_fields_to_object( $data, $request );
		$data    = $this->filter_response_by_context( $data, $context );

		$links = $response->get_links();

		// Wrap the data in a response object.
		$response = rest_ensure_response( $data );

		foreach ( $links as $rel => $rel_links ) {
			foreach ( $rel_links as $link ) {
				$response->add_link( $rel, $link['href'], $link['attributes'] );
			}
		}

		return $response;
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
			add_filter( 'fallback_intermediate_image_sizes', '__return_empty_array', 100 );
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

		$before_upload   = microtime( true );
		$before_metadata = 0;

		// Add Server-Timing headers if Performance Lab is active.
		// One for initial upload, and one for thumbnail generation.
		if ( function_exists( 'perflab_server_timing_register_metric' ) ) {
			perflab_server_timing_register_metric(
				'upload',
				array(
					'measure_callback' => function ( \Perflab_Server_Timing_Metric $metric ) use ( $before_upload ) {
						add_action(
							'rest_insert_attachment',
							static function () use ( $metric, $before_upload ) {
								$metric->set_value( microtime( true ) - $before_upload );
							}
						);
					},
					'access_cap'       => 'exist',
				)
			);

			add_action(
				'rest_after_insert_attachment',
				static function () use ( &$before_metadata ) {
					$before_metadata = microtime( true );
				}
			);
		}

		$response = parent::create_item( $request );

		if ( function_exists( 'perflab_server_timing_register_metric' ) && ! empty( $before_metadata ) ) {
			perflab_server_timing_register_metric(
				'generate-metadata',
				array(
					'measure_callback' => function ( \Perflab_Server_Timing_Metric $metric ) use ( $before_metadata ) {
						$metric->set_value( microtime( true ) - $before_metadata );
					},
					'access_cap'       => 'exist',
				)
			);
		}

		remove_filter( 'intermediate_image_sizes_advanced', '__return_empty_array', 100 );
		remove_filter( 'fallback_intermediate_image_sizes', '__return_empty_array', 100 );
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
				__( 'Cannot create existing post.', 'media-experiments' ),
				[ 'status' => 400 ]
			);
		}

		$post_type = get_post_type_object( $this->post_type );

		if ( ! $post_type ) {
			return new WP_Error(
				'rest_cannot_edit_others',
				__( 'Sorry, you are not allowed to create posts as this user.', 'media-experiments' ),
				[ 'status' => rest_authorization_required_code() ]
			);
		}

		if ( ! empty( $request['author'] ) && get_current_user_id() !== $request['author'] && ! current_user_can( $post_type->cap->edit_others_posts ) ) {
			return new WP_Error(
				'rest_cannot_edit_others',
				__( 'Sorry, you are not allowed to create posts as this user.', 'media-experiments' ),
				[ 'status' => rest_authorization_required_code() ]
			);
		}

		if ( ! empty( $request['sticky'] ) && ! current_user_can( $post_type->cap->edit_others_posts ) && ! current_user_can( $post_type->cap->publish_posts ) ) {
			return new WP_Error(
				'rest_cannot_assign_sticky',
				__( 'Sorry, you are not allowed to make posts sticky.', 'media-experiments' ),
				[ 'status' => rest_authorization_required_code() ]
			);
		}

		if ( ! current_user_can( $post_type->cap->create_posts ) && ! $this->is_valid_upload_request( $request ) ) {
			return new WP_Error(
				'rest_cannot_create',
				__( 'Sorry, you are not allowed to create posts as this user.', 'media-experiments' ),
				[ 'status' => rest_authorization_required_code() ]
			);
		}

		if ( ! $this->check_assign_terms_permission( $request ) ) {
			return new WP_Error(
				'rest_cannot_assign_term',
				__( 'Sorry, you are not allowed to assign the provided terms.', 'media-experiments' ),
				[ 'status' => rest_authorization_required_code() ]
			);
		}

		if ( ! current_user_can( 'upload_files' ) && ! $this->is_valid_upload_request( $request ) ) {
			return new WP_Error(
				'rest_cannot_create',
				__( 'Sorry, you are not allowed to upload media on this site.', 'media-experiments' ),
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
				__( 'Sorry, you are not allowed to upload media to this post.', 'media-experiments' ),
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
	 * Checks if a given request has access to sideload a file.
	 *
	 * Sideloading a file for an existing attachment
	 * requires both update and create permissions.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return true|WP_Error True if the request has access to update the item, WP_Error object otherwise.
	 */
	public function sideload_item_permissions_check( $request ): WP_Error|bool {
		$post = $this->get_post( $request['id'] );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		if ( ! $this->check_update_permission( $post ) && ! $this->is_valid_upload_request( $request ) ) {
			return new WP_Error(
				'rest_cannot_edit',
				__( 'Sorry, you are not allowed to edit this post.', 'media-experiments' ),
				array( 'status' => rest_authorization_required_code() )
			);
		}

		if ( ! current_user_can( 'upload_files' ) && ! $this->is_valid_upload_request( $request ) ) {
			return new WP_Error(
				'rest_cannot_create',
				__( 'Sorry, you are not allowed to upload media on this site.', 'media-experiments' ),
				[ 'status' => 400 ]
			);
		}

		return true;
	}

	/**
	 * Side-loads a media file without creating an attachment.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_REST_Response|WP_Error Response object on success, WP_Error object on failure.
	 * @phpstan-param WP_REST_Request<SideloadRequest> $request
	 */
	public function sideload_item( WP_REST_Request $request ): WP_Error|WP_REST_Response {
		$attachment_id = $request['id'];

		if ( 'attachment' !== get_post_type( $attachment_id ) ) {
			return new WP_Error(
				'rest_invalid_param',
				__( 'Invalid parent type.', 'media-experiments' ),
				[ 'status' => 400 ]
			);
		}

		$before_upload = microtime( true );

		// Get the file via $_FILES or raw data.
		$files   = $request->get_file_params();
		$headers = $request->get_headers();

		// wp_unique_filename() will always add numeric suffix if the name looks like a sub-size to avoid conflicts.
		// See https://github.com/WordPress/wordpress-develop/blob/30954f7ac0840cfdad464928021d7f380940c347/src/wp-includes/functions.php#L2576-L2582
		// With this filter we can work around this safeguard.

		$attachment_filename = get_attached_file( $attachment_id, true );
		$attachment_filename = $attachment_filename ? basename( $attachment_filename ) : null;

		/**
		 * Filters the result when generating a unique file name.
		 *
		 * @param string        $filename                 Unique file name.
		 * @param string        $ext                      File extension. Example: ".png".
		 * @param string        $dir                      Directory path.
		 * @param callable|null $unique_filename_callback Callback function that generates the unique file name.
		 * @param string[]      $alt_filenames            Array of alternate file names that were checked for collisions.
		 * @param int|string    $number                   The highest number that was used to make the file name unique
		 *                                                or an empty string if unused.
		 *
		 * @return string Filtered file name.
		 */
		$filter_filename = static function ( $filename, $ext, $dir, $unique_filename_callback, $alt_filenames, $number ) use ( $attachment_filename ) {
			$ext       = pathinfo( $filename, PATHINFO_EXTENSION );
			$name      = pathinfo( $filename, PATHINFO_FILENAME );
			$orig_name = pathinfo( $attachment_filename, PATHINFO_FILENAME );

			if ( empty( $number ) || ! $ext || ! $name ) {
				return $filename;
			}

			$matches = [];
			if ( preg_match( '/(.*)(-\d+x\d+)-' . $number . '$/', $name, $matches ) ) {
				$filename_without_suffix = $matches[1] . $matches[2] . ".$ext";
				if ( $matches[1] === $orig_name && ! file_exists( "$dir/$filename_without_suffix" ) ) {
					return $filename_without_suffix;
				}
			}

			return $filename;
		};

		add_filter( 'wp_unique_filename', $filter_filename, 10, 6 );

		if ( ! empty( $files ) ) {
			$file = $this->upload_from_file( $files, $headers );
		} else {
			$file = $this->upload_from_data( $request->get_body(), $headers );
		}

		remove_filter( 'wp_unique_filename', $filter_filename );

		if ( is_wp_error( $file ) ) {
			return $file;
		}

		$type = $file['type'];
		$path = $file['file'];

		// TODO: Better fallback if image_size is not provided.
		$image_size = $request['image_size'];

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
				'mime-type' => $type,
				'filesize'  => wp_filesize( $path ),
			];
		}

		wp_update_attachment_metadata( $attachment_id, $metadata );

		$response = $this->prepare_item_for_response(
			get_post( $attachment_id ),
			// TODO: Maybe forward context or _fields param?
			new WP_REST_Request(
				WP_REST_Server::READABLE,
				rest_url( sprintf( '%s/%s/%d', $this->namespace, $this->rest_base, $attachment_id ) )
			)
		);

		$response->set_status( 201 );
		$response->header( 'Location', rest_url( sprintf( '%s/%s/%d', $this->namespace, $this->rest_base, $attachment_id ) ) );

		if ( function_exists( 'perflab_server_timing_register_metric' ) ) {
			perflab_server_timing_register_metric(
				'upload',
				array(
					'measure_callback' => function ( \Perflab_Server_Timing_Metric $metric ) use ( $before_upload ) {
						$metric->set_value( microtime( true ) - $before_upload );
					},
					'access_cap'       => 'exist',
				)
			);
		}

		return $response;
	}
}
