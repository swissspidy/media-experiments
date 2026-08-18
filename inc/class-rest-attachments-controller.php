<?php
/**
 * Class REST_Attachments_Controller.
 *
 * @package MediaExperiments
 */

declare(strict_types = 1);

namespace MediaExperiments;

use Perflab_Server_Timing_Metric;
use WP_Error;
use WP_Post;
use WP_Post_Type;
use WP_REST_Attachments_Controller;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class REST_Attachments_Controller.
 *
 * @phpstan-type AttachmentMeta array{
 *   mexp_original_id: int,
 * }
 *
 * @phpstan-type Upload array{
 *   context: string,
 *   id?: int,
 *   post: int,
 *   author?: int,
 *   sticky?: bool,
 *   caption?: string,
 *   alt_text?: string,
 *   generate_sub_sizes: bool,
 *   convert_format: bool,
 *   meta: AttachmentMeta,
 *   _fields?: string|string[],
 * }
 * @phpstan-type Sideload array{
 *   context: string,
 *   id: int,
 *   image_size: string,
 *   convert_format: bool,
 *   _fields?: string|string[],
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

		$valid_image_sizes = array_keys( wp_get_registered_image_subsizes() );

		// Special case to set 'original_image' in attachment metadata.
		$valid_image_sizes[] = 'original';
		// Used for PDF thumbnails.
		$valid_image_sizes[] = 'full';

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>[\d]+)/sideload',
			[
				[
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'sideload_item' ],
					'permission_callback' => [ $this, 'sideload_item_permissions_check' ],
					'args'                => [
						'id'         => array(
							'description' => __( 'Unique identifier for the attachment.', 'media-experiments' ),
							'type'        => 'integer',
						),
						'image_size' => [
							'description' => __( 'Image size.', 'media-experiments' ),
							'type'        => 'string',
							'enum'        => $valid_image_sizes,
							'required'    => true,
						],
					],
				],
				'allow_batch' => $this->allow_batch,
				'schema'      => [ $this, 'get_public_item_schema' ],
			]
		);
	}


	/**
	 * Retrieves an array of endpoint arguments from the item schema for the controller.
	 *
	 * @param string $method Optional. HTTP method of the request. The arguments for `CREATABLE` requests are
	 *                       checked for required values and may fall-back to a given default, this is not done
	 *                       on `EDITABLE` requests. Default WP_REST_Server::CREATABLE.
	 * @return array Endpoint arguments.
	 *
	 * @phpstan-return array{string: array<string,mixed>}
	 */
	public function get_endpoint_args_for_item_schema( $method = WP_REST_Server::CREATABLE ) {
		/**
		 * Endpoint arguments.
		 *
		 * @phpstan-var array{string: array<string,mixed>} $args
		 */
		$args = rest_get_endpoint_args_for_schema( $this->get_item_schema(), $method );

		if ( WP_REST_Server::CREATABLE === $method ) {
			$args['generate_sub_sizes'] = array(
				'type'        => 'boolean',
				'default'     => true,
				'description' => __( 'Whether to generate image sub sizes.', 'media-experiments' ),
			);
			$args['convert_format']     = array(
				'type'        => 'boolean',
				'default'     => true,
				'description' => __( 'Whether to convert image formats.', 'media-experiments' ),
			);
		}

		return $args;
	}

	/**
	 * Retrieves the query params for collections of attachments.
	 *
	 * @return array Query parameters for the attachment collection as an array.
	 * @phpstan-return array<string, mixed>
	 */
	public function get_collection_params(): array {
		return parent::get_collection_params();
	}

	/**
	 * Prepares a single attachment output for response.
	 *
	 * Ensures 'missing_image_sizes' is set for PDFs and not just images.
	 *
	 * @param WP_Post         $item    Attachment object.
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response Response object.
	 * @phpstan-param WP_REST_Request<Upload> $request
	 */
	public function prepare_item_for_response( $item, $request ) {
		$fields   = $this->get_fields_for_response( $request );
		$response = parent::prepare_item_for_response( $item, $request );

		/**
		 * Response data.
		 *
		 * @phpstan-var array{
		 *     missing_image_sizes?: string[],
		 * }
		 */
		$data = $response->get_data();

		if (
			rest_is_field_included( 'missing_image_sizes', $fields ) &&
			empty( $data['missing_image_sizes'] )
		) {
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

				$missing_image_sizes         = array_diff( $merged_sizes, array_keys( $metadata['sizes'] ) );
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
				// @phpstan-ignore method.internal (false positive)
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
	 * @phpstan-param WP_REST_Request<Upload> $request
	 */
	public function create_item( $request ) {
		if ( false === $request['generate_sub_sizes'] ) {
			add_filter( 'intermediate_image_sizes_advanced', '__return_empty_array', 100 );
			add_filter( 'fallback_intermediate_image_sizes', '__return_empty_array', 100 );
		}

		if ( false === $request['convert_format'] ) {
			// Prevent image conversion as that is done client-side.
			add_filter( 'image_editor_output_format', '__return_empty_array', 100 );
		}

		// Copy over main fields from original. Metadata is handled in rest_after_insert_attachment_copy_metadata().
		if ( isset( $request['meta']['mexp_original_id'] ) && ! empty( $request['meta']['mexp_original_id'] ) ) {
			$original_id = $request['meta']['mexp_original_id'];

			$original_attachment = get_post( $original_id );
			if ( $original_attachment instanceof WP_Post ) {
				if ( ! isset( $request['caption'] ) ) {
					$request['caption'] = $original_attachment->post_excerpt;
				}

				if ( ! isset( $request['alt_text'] ) ) {
					$request['alt_text'] = get_post_meta( $original_id, '_wp_attachment_image_alt', true );
				}
			}
		}

		$before_upload   = microtime( true );
		$before_metadata = 0;

		/*
		 * Add Server-Timing headers if Performance Lab is active.
		 * One for initial upload, and one for thumbnail generation.
		 */

		// @codeCoverageIgnoreStart
		if ( function_exists( 'perflab_server_timing_register_metric' ) ) {
			perflab_server_timing_register_metric(
				'upload',
				array(
					'measure_callback' => function ( Perflab_Server_Timing_Metric $metric ) use ( $before_upload ) {
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
		// @codeCoverageIgnoreEnd

		$response = parent::create_item( $request );

		// @codeCoverageIgnoreStart
		if ( function_exists( 'perflab_server_timing_register_metric' ) && ! empty( $before_metadata ) ) {
			perflab_server_timing_register_metric(
				'generate-metadata',
				array(
					'measure_callback' => function ( Perflab_Server_Timing_Metric $metric ) use ( $before_metadata ) {
						$metric->set_value( microtime( true ) - $before_metadata );
					},
					'access_cap'       => 'exist',
				)
			);
		}
		// @codeCoverageIgnoreEnd

		remove_filter( 'intermediate_image_sizes_advanced', '__return_empty_array', 100 );
		remove_filter( 'fallback_intermediate_image_sizes', '__return_empty_array', 100 );
		remove_filter( 'image_editor_output_format', '__return_empty_array', 100 );

		return $response;
	}

	/**
	 * Checks if a given request has access to create an attachment.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return true|WP_Error Boolean true if the attachment may be created, or a WP_Error if not.
	 * @phpstan-param WP_REST_Request<Upload> $request
	 */
	public function create_item_permissions_check( $request ) {
		if ( ! empty( $request['id'] ) ) {
			return new WP_Error(
				'rest_post_exists',
				__( 'Cannot create existing post.', 'media-experiments' ),
				[ 'status' => 400 ]
			);
		}

		$post_type = get_post_type_object( $this->post_type );

		if ( ! $post_type instanceof WP_Post_Type ) {
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

		if ( ! current_user_can( $post_type->cap->create_posts ) ) {
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

		if ( ! current_user_can( 'upload_files' ) ) {
			return new WP_Error(
				'rest_cannot_create',
				__( 'Sorry, you are not allowed to upload media on this site.', 'media-experiments' ),
				[ 'status' => 400 ]
			);
		}

		// Attaching media to a post requires ability to edit said post.
		if (
			! empty( $request['post'] ) &&
			! current_user_can( 'edit_post', $request['post'] )
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
	 * Checks if a given request has access to sideload a file.
	 *
	 * Sideloading a file for an existing attachment
	 * requires both update and create permissions.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return true|WP_Error True if the request has access to update the item, WP_Error object otherwise.
	 * @phpstan-param WP_REST_Request<Sideload> $request
	 */
	public function sideload_item_permissions_check( $request ) {
		$post = $this->get_post( (int) $request['id'] );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		if ( ! $this->check_update_permission( $post ) ) {
			return new WP_Error(
				'rest_cannot_edit',
				__( 'Sorry, you are not allowed to edit this post.', 'media-experiments' ),
				array( 'status' => rest_authorization_required_code() )
			);
		}

		if ( ! current_user_can( 'upload_files' ) ) {
			return new WP_Error(
				'rest_cannot_create',
				__( 'Sorry, you are not allowed to upload media on this site.', 'media-experiments' ),
				[ 'status' => 400 ]
			);
		}

		return true;
	}

	/**
	 * Returns a closure for filtering {@see 'wp_unique_filename'} during sideloads.
	 *
	 * {@see wp_unique_filename()} will always add numeric suffix if the name looks like a sub-size to avoid conflicts.
	 *
	 * Adding this closure to the filter helps work around this safeguard.
	 *
	 * Example: when uploading myphoto.jpeg, WordPress normally creates myphoto-150x150.jpeg,
	 * and when uploading myphoto-150x150.jpeg, it will be renamed to myphoto-150x150-1.jpeg
	 * However, here it is desired not to add the suffix in order to maintain the same
	 * naming convention as if the file was uploaded regularly.
	 *
	 * @link https://github.com/WordPress/wordpress-develop/blob/30954f7ac0840cfdad464928021d7f380940c347/src/wp-includes/functions.php#L2576-L2582
	 *
	 * @param string $attachment_filename Attachment file name.
	 * @return callable Function to add to the filter.
	 */
	private function get_wp_unique_filename_filter( $attachment_filename ) {
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
		return static function ( string $filename, string $ext, string $dir, ?callable $unique_filename_callback, array $alt_filenames, $number ) use ( $attachment_filename ) {
			if ( empty( $number ) || empty( $attachment_filename ) ) {
				return $filename;
			}

			$ext       = pathinfo( $filename, PATHINFO_EXTENSION );
			$name      = pathinfo( $filename, PATHINFO_FILENAME );
			$orig_name = pathinfo( $attachment_filename, PATHINFO_FILENAME );

			if ( empty( $ext ) || empty( $name ) ) {
				return $filename;
			}

			$matches = array();
			if ( 1 === preg_match( '/(.*)(-\d+x\d+)-' . $number . '$/', $name, $matches ) ) {
				$filename_without_suffix = $matches[1] . $matches[2] . ".$ext";
				if ( $matches[1] === $orig_name && ! file_exists( "$dir/$filename_without_suffix" ) ) {
					return $filename_without_suffix;
				}
			}

			return $filename;
		};
	}

	/**
	 * Side-loads a media file without creating an attachment.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_REST_Response|WP_Error Response object on success, WP_Error object on failure.
	 * @phpstan-param WP_REST_Request<Sideload> $request
	 */
	public function sideload_item( WP_REST_Request $request ) {
		$attachment_id = $request['id'];

		if ( ! is_int( $attachment_id ) ) {
			return new WP_Error(
				'rest_post_invalid_id',
				__( 'Invalid post ID.', 'media-experiments' ),
				array( 'status' => 404 )
			);
		}

		$attachment = get_post( $attachment_id );

		if ( ! $attachment instanceof WP_Post ) {
			return new WP_Error(
				'rest_post_invalid_id',
				__( 'Invalid post ID.', 'media-experiments' ),
				array( 'status' => 404 )
			);
		}

		if ( 'attachment' !== $attachment->post_type ) {
			return new WP_Error(
				'rest_invalid_param',
				__( 'Invalid parent type.', 'media-experiments' ),
				[ 'status' => 400 ]
			);
		}

		if ( true !== $request['convert_format'] ) {
			// Prevent image conversion as that is done client-side.
			add_filter( 'image_editor_output_format', '__return_empty_array', 100 );
		}

		$before_upload = microtime( true );

		// Get the file via $_FILES or raw data.
		$files   = $request->get_file_params();
		$headers = $request->get_headers();

		// wp_unique_filename() will always add numeric suffix if the name looks like a sub-size to avoid conflicts.
		// See https://github.com/WordPress/wordpress-develop/blob/30954f7ac0840cfdad464928021d7f380940c347/src/wp-includes/functions.php#L2576-L2582
		// With this filter we can work around this safeguard.

		$attachment_filename = get_attached_file( $attachment_id, true );
		$attachment_filename = is_string( $attachment_filename ) ? wp_basename( $attachment_filename ) : '';

		$filter_filename = $this->get_wp_unique_filename_filter( $attachment_filename );

		add_filter( 'wp_unique_filename', $filter_filename, 10, 6 );

		$parent_post = get_post_parent( $attachment_id );

		$time = null;

		// Matches logic in media_handle_upload().
		// The post date doesn't usually matter for pages, so don't backdate this upload.
		if ( $parent_post instanceof WP_Post && 'page' !== $parent_post->post_type && substr( $parent_post->post_date, 0, 4 ) > 0 ) {
			$time = $parent_post->post_date;
		}

		if ( ! empty( $files ) ) {
			$file = $this->upload_from_file( $files, $headers, $time );
		} else {
			$file = $this->upload_from_data( $request->get_body(), $headers, $time );
		}

		remove_filter( 'wp_unique_filename', $filter_filename );
		remove_filter( 'image_editor_output_format', '__return_empty_array', 100 );

		if ( is_wp_error( $file ) ) {
			return $file;
		}

		$type = $file['type'];
		$path = $file['file'];

		$image_size = $request['image_size'];

		$metadata = wp_get_attachment_metadata( $attachment_id, true );

		if ( ! is_array( $metadata ) ) {
			$metadata = [];
		}

		if ( 'original' === $image_size ) {
			$metadata['original_image'] = wp_basename( $path );
		} else {
			$metadata['sizes'] = $metadata['sizes'] ?? [];

			$size = wp_getimagesize( $path );

			$metadata['sizes'][ $image_size ] = [
				'width'     => is_array( $size ) ? $size[0] : 0,
				'height'    => is_array( $size ) ? $size[1] : 0,
				'file'      => wp_basename( $path ),
				'mime-type' => $type,
				'filesize'  => wp_filesize( $path ),
			];
		}

		wp_update_attachment_metadata( $attachment_id, $metadata );

		/**
		 * Response request.
		 *
		 * @phpstan-var WP_REST_Request<Upload> $response_request
		 */
		$response_request = new WP_REST_Request(
			WP_REST_Server::READABLE,
			rest_get_route_for_post( $attachment_id )
		);

		$response_request['context'] = 'edit';

		if ( isset( $request['_fields'] ) ) {
			$response_request['_fields'] = $request['_fields'];
		}

		$response = $this->prepare_item_for_response( $attachment, $response_request );

		$response->header( 'Location', rest_url( rest_get_route_for_post( $attachment_id ) ) );

		// @codeCoverageIgnoreStart
		if ( function_exists( 'perflab_server_timing_register_metric' ) ) {
			perflab_server_timing_register_metric(
				'upload',
				array(
					'measure_callback' => function ( Perflab_Server_Timing_Metric $metric ) use ( $before_upload ) {
						$metric->set_value( microtime( true ) - $before_upload );
					},
					'access_cap'       => 'exist',
				)
			);
		}
		// @codeCoverageIgnoreEnd

		return $response;
	}
}
