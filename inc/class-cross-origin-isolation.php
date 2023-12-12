<?php
/**
 * Class Cross_Origin_Isolation.
 *
 * @package MediaExperiments
 */

declare(strict_types = 1);

namespace MediaExperiments;

/**
 * Class Cross_Origin_Isolation
 */
class Cross_Origin_Isolation {

	/**
	 * Init
	 */
	public function register(): void {
		add_action( 'load-post.php', [ $this, 'send_headers' ] );
		add_action( 'load-post-new.php', [ $this, 'send_headers' ] );
		add_filter( 'style_loader_tag', [ $this, 'filter_style_loader_tag' ], 10, 3 );
		add_filter( 'script_loader_tag', [ $this, 'filter_script_loader_tag' ], 10, 3 );
		add_filter( 'get_avatar', [ $this, 'filter_get_avatar' ], 10, 6 );
		add_action( 'wp_enqueue_media', [ $this, 'override_media_templates' ] );
	}

	/**
	 * Start output buffer to add headers and `crossorigin` attribute everywhere.
	 *
	 * @since 1.6.0
	 */
	public function send_headers(): void {
		if ( $this->needs_isolation() ) {
			header( 'Cross-Origin-Opener-Policy: same-origin' );
			header( 'Cross-Origin-Embedder-Policy: require-corp' );
		}

		ob_start( [ $this, 'replace_in_dom' ] );
	}

	/**
	 * Filters the HTML link tag of an enqueued style.
	 *
	 * @since 1.6.0
	 *
	 * @param mixed  $tag    The link tag for the enqueued style.
	 * @param string $handle The style's registered handle.
	 * @param string $href   The stylesheet's source URL.
	 * @return string|mixed
	 */
	public function filter_style_loader_tag( $tag, string $handle, string $href ) {
		return $this->add_attribute( $tag, 'href', $href );
	}

	/**
	 * Filters the HTML script tag of an enqueued script.
	 *
	 * @since 1.6.0
	 *
	 * @param mixed  $tag    The `<script>` tag for the enqueued script.
	 * @param string $handle The script's registered handle.
	 * @param string $src    The script's source URL.
	 * @return string|mixed The filtered script tag.
	 */
	public function filter_script_loader_tag( $tag, string $handle, string $src ) {
		return $this->add_attribute( $tag, 'src', $src );
	}

	/**
	 * Filter the avatar tag.
	 *
	 * @since 1.6.0
	 *
	 * @param string|mixed        $avatar         HTML for the user's avatar.
	 * @param mixed               $id_or_email    The avatar to retrieve. Accepts a user_id, Gravatar MD5 hash,
	 *                                            user email, WP_User object, WP_Post object, or WP_Comment object.
	 * @param int                 $size           Square avatar width and height in pixels to retrieve.
	 * @param string              $default_avatar URL for the default image or a default type. Accepts '404', 'retro', 'monsterid',
	 *                                            'wavatar', 'indenticon', 'mystery', 'mm', 'mysteryman', 'blank', or
	 *                                            'gravatar_default'. Default is the value of the 'avatar_default' option, with a
	 *                                            fallback of 'mystery'.
	 * @param string              $alt            Alternative text to use in the avatar image tag. Default empty.
	 * @param array<string,mixed> $args           Arguments passed to get_avatar_data(), after processing.
	 * @return string|mixed Filtered avatar tag.
	 */
	public function filter_get_avatar( $avatar, $id_or_email, int $size, string $default_avatar, string $alt, array $args ) {
		return $this->add_attribute( $avatar, 'src', $args['url'] );
	}

	/**
	 * Unhook wp_print_media_templates and replace with custom media templates.
	 *
	 * @since 1.8.0
	 */
	public function override_media_templates(): void {
		remove_action( 'admin_footer', 'wp_print_media_templates' );
		add_action( 'admin_footer', [ $this, 'custom_print_media_templates' ] );
	}

	/**
	 * Add crossorigin attribute to all tags that could have assets loaded from a different domain.
	 *
	 * @since 1.8.0
	 */
	public function custom_print_media_templates(): void {
		ob_start();
		wp_print_media_templates();
		$html = (string) ob_get_clean();

		$tags = [
			'audio',
			'img',
			'video',
		];
		foreach ( $tags as $tag ) {
			$html = (string) str_replace( '<' . $tag, '<' . $tag . ' crossorigin="anonymous"', $html );
		}

		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Determines whether "full" cross-origin isolation is needed.
	 *
	 * By default, `crossorigin="anonymous"` attributes are added to all external
	 * resources to make sure they can be accessed programmatically (e.g. by html-to-image).
	 *
	 * However, actual cross-origin isolation by sending COOP and COEP headers is only
	 * needed when video optimization is enabled
	 *
	 * @link https://web.dev/coop-coep/
	 *
	 * @return bool Whether the conditional object is needed.
	 */
	private function needs_isolation(): bool {
		if ( is_singular( 'mexp-upload-request' ) ) {
			return true;
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return false;
		}

		// Cross-origin isolation is not needed if users can't upload files anyway.
		if ( ! user_can( $user_id, 'upload_files' ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Process a html string and add attribute attributes to required tags.
	 *
	 * @since 1.6.0
	 *
	 * @param string $html HTML document as string.
	 * @return string Processed HTML document.
	 */
	protected function replace_in_dom( string $html ): string { // phpcs:ignore SlevomatCodingStandard.Complexity.Cognitive.ComplexityTooHigh
		$site_url = site_url();

		// See https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin.
		$tags = [
			'audio',
			'img',
			'link',
			'script',
			'video',
		];

		$tags      = implode( '|', $tags );
		$matches   = [];
		$processed = [];

		if ( preg_match_all( '#<(?P<tag>' . $tags . ')[^<]*?(?:>[\s\S]*?</(?P=tag)>|\s*/>)#', $html, $matches ) ) {

			/**
			 * Single match.
			 *
			 * @var string $match
			 */
			foreach ( $matches[0] as $index => $match ) {
				$tag = $matches['tag'][ $index ];

				if ( str_contains( $match, ' crossorigin=' ) ) {
					continue;
				}

				$match_value = [];
				if ( ! preg_match( '/(src|href)=("([^"]+)"|\'([^\']+)\')/', $match, $match_value ) ) {
					continue;
				}

				$attribute = $match_value[1];
				$value     = $match_value[4] ?? $match_value[3];
				$cache_key = 'video' === $tag || 'audio' === $tag ? $tag : $attribute;

				// If already processed tag/attribute and value before, skip.
				if ( isset( $processed[ $cache_key ] ) && \in_array( $value, $processed[ $cache_key ], true ) ) {
					continue;
				}

				$processed[ $cache_key ][] = $value;

				// The only tags that can have <source> children.
				if ( 'video' === $tag || 'audio' === $tag ) {
					if ( ! str_starts_with( $value, $site_url ) && ! str_starts_with( $value, '/' ) ) {
						$html = str_replace( $match, str_replace( '<' . $tag, '<' . $tag . ' crossorigin="anonymous"', $match ), $html );
					}
				} else {
					/**
					 * Modified HTML.
					 *
					 * @var string $html
					 */
					$html = $this->add_attribute( $html, $attribute, $value );
				}
			}
		}

		return $html;
	}

	/**
	 * Do replacement to add crossorigin attribute.
	 *
	 * @since 1.6.0
	 *
	 * @param string|mixed      $html HTML string.
	 * @param string            $attribute Attribute to check for.
	 * @param string|null|mixed $url URL.
	 * @return string|mixed Filtered HTML string.
	 */
	protected function add_attribute( mixed $html, string $attribute, $url ): mixed {
		/**
		 * URL.
		 *
		 * @var string $url
		 */
		if ( ! $url || ! \is_string( $html ) ) {
			return $html;
		}

		$site_url = site_url();
		$url      = esc_url( $url );

		if ( str_starts_with( $url, $site_url ) ) {
			return $html;
		}

		if ( str_starts_with( $url, '/' ) ) {
			return $html;
		}

		return str_replace(
			[
				$attribute . '="' . $url . '"',
				"{$attribute}='{$url}'",
			],
			[
				'crossorigin="anonymous" ' . $attribute . '="' . $url . '"',
				"crossorigin='anonymous' {$attribute}='{$url}'",
			],
			$html
		);
	}
}
