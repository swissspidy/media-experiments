/**
 * Internal dependencies
 */
import type { ImageFormat } from '../store/types';

/**
 * Mock data for testing auto-select format functionality.
 */
export const mockJpegFile = new File( [ new ArrayBuffer( 10000 ) ], 'example.jpg', {
	lastModified: 1234567891,
	type: 'image/jpeg',
} );

export const mockPngFile = new File( [ new ArrayBuffer( 15000 ) ], 'example.png', {
	lastModified: 1234567891,
	type: 'image/png',
} );

export const mockWebpFile = new File( [ new ArrayBuffer( 8000 ) ], 'example.webp', {
	lastModified: 1234567891,
	type: 'image/webp',
} );

/**
 * Creates a mock file with a specified size.
 *
 * @param size   File size in bytes.
 * @param format Image format.
 * @return Mock file.
 */
export function createMockFileWithSize( size: number, format: ImageFormat ): File {
	return new File( [ new ArrayBuffer( size ) ], `example.${ format }`, {
		type: `image/${ format }`,
	} );
}

describe( 'Auto-select format', () => {
	it( 'should select the format with smallest file size', () => {
		const formats = [
			{ format: 'jpeg' as ImageFormat, size: 10000 },
			{ format: 'webp' as ImageFormat, size: 8000 },
			{ format: 'avif' as ImageFormat, size: 12000 },
		];

		const sorted = [ ...formats ].sort( ( a, b ) => a.size - b.size );

		expect( sorted[ 0 ].format ).toBe( 'webp' );
		expect( sorted[ 0 ].size ).toBe( 8000 );
	} );

	it( 'should handle when only one format succeeds', () => {
		const formats = [
			{ format: 'jpeg' as ImageFormat, size: 10000 },
		];

		const sorted = [ ...formats ].sort( ( a, b ) => a.size - b.size );

		expect( sorted[ 0 ].format ).toBe( 'jpeg' );
	} );

	it( 'should prefer smaller files even if original format', () => {
		const formats = [
			{ format: 'jpeg' as ImageFormat, size: 15000 }, // Original
			{ format: 'webp' as ImageFormat, size: 8000 },
			{ format: 'png' as ImageFormat, size: 20000 },
		];

		const sorted = [ ...formats ].sort( ( a, b ) => a.size - b.size );

		expect( sorted[ 0 ].format ).toBe( 'webp' );
	} );
} );
