/**
 * Internal dependencies
 */
import { extractImageMetadata } from '../';

const mockGetString = jest.fn();
const mockNewFromBuffer = jest.fn( () => ( {
	getString: mockGetString,
} ) );

class MockVipsImage {
	static newFromBuffer = mockNewFromBuffer;
}

jest.mock( 'wasm-vips', () =>
	jest.fn( () => ( {
		Image: MockVipsImage,
	} ) )
);

describe( 'extractImageMetadata', () => {
	afterEach( () => {
		jest.clearAllMocks();
	} );

	it( 'extracts title from EXIF ImageDescription', async () => {
		mockGetString.mockImplementation( ( name: string ) => {
			if ( name === 'exif-ifd0-ImageDescription' ) {
				return 'Test Image Title';
			}
			throw new Error( 'Field not found' );
		} );

		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		const metadata = await extractImageMetadata( buffer );

		expect( metadata.title ).toBe( 'Test Image Title' );
		expect( mockGetString ).toHaveBeenCalledWith(
			'exif-ifd0-ImageDescription'
		);
	} );

	it( 'falls back to IPTC Headline for title', async () => {
		mockGetString.mockImplementation( ( name: string ) => {
			if ( name === 'iptc-Headline' ) {
				return 'IPTC Title';
			}
			if ( name === 'exif-ifd0-ImageDescription' ) {
				throw new Error( 'Field not found' );
			}
			throw new Error( 'Field not found' );
		} );

		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		const metadata = await extractImageMetadata( buffer );

		expect( metadata.title ).toBe( 'IPTC Title' );
		expect( mockGetString ).toHaveBeenCalledWith( 'iptc-Headline' );
	} );

	it( 'falls back to XMP dc:Title for title', async () => {
		mockGetString.mockImplementation( ( name: string ) => {
			if ( name === 'xmp-dc-Title' ) {
				return 'XMP Title';
			}
			throw new Error( 'Field not found' );
		} );

		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		const metadata = await extractImageMetadata( buffer );

		expect( metadata.title ).toBe( 'XMP Title' );
		expect( mockGetString ).toHaveBeenCalledWith( 'xmp-dc-Title' );
	} );

	it( 'extracts caption from EXIF UserComment', async () => {
		mockGetString.mockImplementation( ( name: string ) => {
			if ( name === 'exif-ifd2-UserComment' ) {
				return 'Test image caption';
			}
			throw new Error( 'Field not found' );
		} );

		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		const metadata = await extractImageMetadata( buffer );

		expect( metadata.caption ).toBe( 'Test image caption' );
		expect( mockGetString ).toHaveBeenCalledWith( 'exif-ifd2-UserComment' );
	} );

	it( 'extracts copyright information', async () => {
		mockGetString.mockImplementation( ( name: string ) => {
			if ( name === 'exif-ifd0-Copyright' ) {
				return 'Copyright 2024 Test User';
			}
			throw new Error( 'Field not found' );
		} );

		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		const metadata = await extractImageMetadata( buffer );

		expect( metadata.copyright ).toBe( 'Copyright 2024 Test User' );
		expect( mockGetString ).toHaveBeenCalledWith( 'exif-ifd0-Copyright' );
	} );

	it( 'extracts camera information', async () => {
		mockGetString.mockImplementation( ( name: string ) => {
			const fields: Record< string, string > = {
				'exif-ifd0-Model': 'Canon EOS 5D',
				'exif-ifd2-FNumber': 'f/2.8',
				'exif-ifd2-FocalLength': '50mm',
				'exif-ifd2-ISOSpeedRatings': '400',
				'exif-ifd2-ExposureTime': '1/125',
			};
			if ( name in fields ) {
				return fields[ name ];
			}
			throw new Error( 'Field not found' );
		} );

		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		const metadata = await extractImageMetadata( buffer );

		expect( metadata.camera ).toBe( 'Canon EOS 5D' );
		expect( metadata.aperture ).toBe( 'f/2.8' );
		expect( metadata.focal_length ).toBe( '50mm' );
		expect( metadata.iso ).toBe( '400' );
		expect( metadata.shutter_speed ).toBe( '1/125' );
	} );

	it( 'returns empty object when no metadata is present', async () => {
		mockGetString.mockImplementation( () => {
			throw new Error( 'Field not found' );
		} );

		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		const metadata = await extractImageMetadata( buffer );

		expect( metadata ).toEqual( {} );
	} );

	it( 'trims whitespace from field values', async () => {
		mockGetString.mockImplementation( ( name: string ) => {
			if ( name === 'exif-ifd0-ImageDescription' ) {
				return '  Title with spaces  ';
			}
			throw new Error( 'Field not found' );
		} );

		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		const metadata = await extractImageMetadata( buffer );

		expect( metadata.title ).toBe( 'Title with spaces' );
	} );

	it( 'ignores empty string values', async () => {
		mockGetString.mockImplementation( ( name: string ) => {
			if ( name === 'exif-ifd0-ImageDescription' ) {
				return '   ';
			}
			throw new Error( 'Field not found' );
		} );

		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		const metadata = await extractImageMetadata( buffer );

		expect( metadata.title ).toBeUndefined();
	} );

	it( 'extracts GPS coordinates', async () => {
		mockGetString.mockImplementation( ( name: string ) => {
			const fields: Record< string, string > = {
				'exif-ifd2-GPSLatitude': '51, 30, 0',
				'exif-ifd2-GPSLatitudeRef': 'N',
				'exif-ifd2-GPSLongitude': '0, 7, 30',
				'exif-ifd2-GPSLongitudeRef': 'W',
			};
			if ( name in fields ) {
				return fields[ name ];
			}
			throw new Error( 'Field not found' );
		} );

		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		const metadata = await extractImageMetadata( buffer );

		// 51°30'0"N = 51.5°N
		expect( metadata.latitude ).toBeCloseTo( 51.5, 4 );
		// 0°7'30"W = -0.125°
		expect( metadata.longitude ).toBeCloseTo( -0.125, 4 );
	} );

	it( 'handles GPS coordinates with fractions', async () => {
		mockGetString.mockImplementation( ( name: string ) => {
			const fields: Record< string, string > = {
				'exif-ifd2-GPSLatitude': '37/1, 46/1, 30/1',
				'exif-ifd2-GPSLatitudeRef': 'N',
				'exif-ifd2-GPSLongitude': '122/1, 25/1, 15/1',
				'exif-ifd2-GPSLongitudeRef': 'W',
			};
			if ( name in fields ) {
				return fields[ name ];
			}
			throw new Error( 'Field not found' );
		} );

		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		const metadata = await extractImageMetadata( buffer );

		// 37°46'30"N = 37.775°N
		expect( metadata.latitude ).toBeCloseTo( 37.775, 3 );
		// 122°25'15"W = -122.420833°
		expect( metadata.longitude ).toBeCloseTo( -122.420833, 4 );
	} );

	it( 'handles southern and eastern hemispheres', async () => {
		mockGetString.mockImplementation( ( name: string ) => {
			const fields: Record< string, string > = {
				'exif-ifd2-GPSLatitude': '33, 52, 0',
				'exif-ifd2-GPSLatitudeRef': 'S',
				'exif-ifd2-GPSLongitude': '151, 12, 0',
				'exif-ifd2-GPSLongitudeRef': 'E',
			};
			if ( name in fields ) {
				return fields[ name ];
			}
			throw new Error( 'Field not found' );
		} );

		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		const metadata = await extractImageMetadata( buffer );

		// 33°52'0"S = -33.866667°
		expect( metadata.latitude ).toBeCloseTo( -33.866667, 4 );
		// 151°12'0"E = 151.2°
		expect( metadata.longitude ).toBeCloseTo( 151.2, 4 );
	} );

	it( 'does not extract GPS when data is incomplete', async () => {
		mockGetString.mockImplementation( ( name: string ) => {
			const fields: Record< string, string > = {
				'exif-ifd2-GPSLatitude': '51, 30, 0',
				'exif-ifd2-GPSLatitudeRef': 'N',
				// Missing longitude data
			};
			if ( name in fields ) {
				return fields[ name ];
			}
			throw new Error( 'Field not found' );
		} );

		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		const metadata = await extractImageMetadata( buffer );

		expect( metadata.latitude ).toBeUndefined();
		expect( metadata.longitude ).toBeUndefined();
	} );
} );
