<?php
/**
 * Class BlurHash.
 *
 * @package MediaExperiments
 * @license MIT
 * @source https://github.com/kornrunner/php-blurhash
 */

declare(strict_types = 1);

namespace MediaExperiments;

use InvalidArgumentException;

/**
 * Class BlurHash.
 *
 * Decodes a BlurHash into pixel arrays for turning into CSS gradients.
 *
 * Originally adapted from {@link https://github.com/kornrunner/php-blurhash}.
 */
class BlurHash {
	private const ALPHABET = [
		'0',
		'1',
		'2',
		'3',
		'4',
		'5',
		'6',
		'7',
		'8',
		'9',
		'A',
		'B',
		'C',
		'D',
		'E',
		'F',
		'G',
		'H',
		'I',
		'J',
		'K',
		'L',
		'M',
		'N',
		'O',
		'P',
		'Q',
		'R',
		'S',
		'T',
		'U',
		'V',
		'W',
		'X',
		'Y',
		'Z',
		'a',
		'b',
		'c',
		'd',
		'e',
		'f',
		'g',
		'h',
		'i',
		'j',
		'k',
		'l',
		'm',
		'n',
		'o',
		'p',
		'q',
		'r',
		's',
		't',
		'u',
		'v',
		'w',
		'x',
		'y',
		'z',
		'#',
		'$',
		'%',
		'*',
		'+',
		',',
		'-',
		'.',
		':',
		';',
		'=',
		'?',
		'@',
		'[',
		']',
		'^',
		'_',
		'{',
		'|',
		'}',
		'~',
	];

	private const BASE = 83;

	protected static function decode_base83( string $hash ): int {
		$result = 0;
		foreach ( str_split( $hash ) as $char ) {
			$result = $result * self::BASE + (int) array_search( $char, self::ALPHABET, true );
		}
		return $result;
	}

	protected static function to_linear_color( int $value ): float {
		$value = $value / 255;
		return ( $value <= 0.04045 )
			? $value / 12.92
			: pow( ( $value + 0.055 ) / 1.055, 2.4 );
	}

	protected static function to_srgb_color( float $value ): int {
		$normalized = max( 0, min( 1, $value ) );
		$result     = ( $normalized <= 0.0031308 )
			? (int) round( $normalized * 12.92 * 255 + 0.5 )
			: (int) round( ( 1.055 * pow( $normalized, 1 / 2.4 ) - 0.055 ) * 255 + 0.5 );
		return max( 0, min( $result, 255 ) );
	}

	/**
	 * @param int $value
	 * @return float[]
	 */
	protected static function decode_dc( int $value ): array {
		$r = $value >> 16;
		$g = ( $value >> 8 ) & 255;
		$b = $value & 255;
		return [
			static::to_linear_color( $r ),
			static::to_linear_color( $g ),
			static::to_linear_color( $b ),
		];
	}

	/**
	 * @param int $value
	 * @param float $max_value
	 * @return float[]
	 */
	protected static function decode_ac( int $value, float $max_value ): array {
		$quant_r = intdiv( $value, 19 * 19 );
		$quant_g = intdiv( $value, 19 ) % 19;
		$quant_b = $value % 19;

		return [
			self::sign_pow( ( $quant_r - 9 ) / 9, 2 ) * $max_value,
			self::sign_pow( ( $quant_g - 9 ) / 9, 2 ) * $max_value,
			self::sign_pow( ( $quant_b - 9 ) / 9, 2 ) * $max_value,
		];
	}

	private static function sign_pow( float $base, float $exp ): float {
		$sign = $base <=> 0;
		return $sign * pow( abs( $base ), $exp );
	}

	/**
	 * @param string $blurhash BlurHash.
	 * @param int $width Width.
	 * @param int $height Height.
	 * @param float $punch Punch.
	 * @param bool $linear Linear.
	 * @return array
	 * @phpstan-return array<int, array<int, array<int, float>>>
	 */
	public static function decode( string $blurhash, int $width, int $height, float $punch = 1.0, bool $linear = false ): array {
		if ( empty( $blurhash ) || strlen( $blurhash ) < 6 ) {
			throw new InvalidArgumentException( 'Blurhash string must be at least 6 characters' );
		}

		$size_info = static::decode_base83( $blurhash[0] );
		$size_y    = intdiv( $size_info, 9 ) + 1;
		$size_x    = ( $size_info % 9 ) + 1;

		$length          = strlen( $blurhash );
		$expected_length = (int) ( 4 + ( 2 * $size_y * $size_x ) );
		if ( $length !== $expected_length ) {
			throw new InvalidArgumentException( "Blurhash length mismatch: length is {$length} but it should be {$expected_length}" );
		}

		$colors = [ static::decode_dc( static::decode_base83( substr( $blurhash, 2, 4 ) ) ) ];

		$quant_max_ac_component = static::decode_base83( $blurhash[1] );
		$max_value              = ( $quant_max_ac_component + 1 ) / 166;
		for ( $i = 1; $i < $size_x * $size_y; $i++ ) {
			$value        = static::decode_base83( substr( $blurhash, 4 + $i * 2, 2 ) );
			$colors[ $i ] = static::decode_ac( $value, $max_value * $punch );
		}

		$pixels = [];
		for ( $y = 0; $y < $height; $y++ ) {
			$row = [];
			for ( $x = 0; $x < $width; $x++ ) {
				$r = 0;
				$g = 0;
				$b = 0;
				for ( $j = 0; $j < $size_y; $j++ ) {
					for ( $i = 0; $i < $size_x; $i++ ) {
						$color = $colors[ $i + $j * $size_x ];
						$basis =
							cos( ( M_PI * $x * $i ) / $width ) *
							cos( ( M_PI * $y * $j ) / $height );

						$r += $color[0] * $basis;
						$g += $color[1] * $basis;
						$b += $color[2] * $basis;
					}
				}

				$row[] = $linear ? [ $r, $g, $b ] : [
					static::to_srgb_color( $r ),
					static::to_srgb_color( $g ),
					static::to_srgb_color( $b ),
				];
			}
			$pixels[] = $row;
		}

		return $pixels;
	}
}
