import { resizeImage } from '../';
import type { ImageSizeCrop } from '../types';

const mockImage: any = {
	writeToBuffer: jest.fn( () => ( {
		buffer: '',
	} ) ),
};
const mockThumbnailBuffer = jest.fn( () => mockImage );
const mockCrop = jest.fn( () => mockImage );

jest.mock( 'wasm-vips', () =>
	jest.fn( () => ( {
		Image: {
			newFromBuffer: jest.fn( () => ( {
				crop: mockCrop,
				writeToBuffer: jest.fn( () => ( {
					buffer: '',
				} ) ),
				width: 100,
				height: 100,
			} ) ),
			thumbnailBuffer: mockThumbnailBuffer,
		},
	} ) )
);

describe( 'resizeImage', () => {
	afterEach( () => {
		jest.clearAllMocks();
	} );

	it( 'resizes without crop', async () => {
		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			lastModified: 1234567891,
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		await resizeImage( buffer, 'image/jpeg', {
			width: 100,
			height: 100,
		} );

		expect( mockThumbnailBuffer ).toHaveBeenCalledWith( buffer, 100, {
			height: 100,
			size: 'down',
		} );
		expect( mockCrop ).not.toHaveBeenCalled();
	} );

	it( 'resizes without crop and zero height', async () => {
		const jpegFile = new File( [], 'example.jpg', {
			lastModified: 1234567891,
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		await resizeImage( buffer, 'image/jpeg', {
			width: 100,
			height: 0,
		} );

		expect( mockThumbnailBuffer ).toHaveBeenCalledWith( buffer, 100, {
			size: 'down',
		} );
		expect( mockCrop ).not.toHaveBeenCalled();
	} );

	it( 'resizes with center crop', async () => {
		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			lastModified: 1234567891,
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		await resizeImage( buffer, 'image/jpeg', {
			width: 100,
			height: 100,
			crop: true,
		} );

		expect( mockThumbnailBuffer ).toHaveBeenCalledWith( buffer, 100, {
			height: 100,
			crop: 'centre',
			size: 'down',
		} );
		expect( mockCrop ).not.toHaveBeenCalled();
	} );

	it( 'resizes with center crop and zero height', async () => {
		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			lastModified: 1234567891,
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		await resizeImage( buffer, 'image/jpeg', {
			width: 100,
			height: 0,
			crop: true,
		} );

		expect( mockThumbnailBuffer ).toHaveBeenCalledWith( buffer, 100, {
			crop: 'centre',
			size: 'down',
		} );
		expect( mockCrop ).not.toHaveBeenCalled();
	} );

	it( 'resizes without crop and attention strategy', async () => {
		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			lastModified: 1234567891,
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		await resizeImage(
			buffer,
			'image/jpeg',
			{
				width: 100,
				height: 100,
			},
			true
		);

		expect( mockThumbnailBuffer ).toHaveBeenCalledWith( buffer, 100, {
			height: 100,
			size: 'down',
		} );
		expect( mockCrop ).not.toHaveBeenCalled();
	} );

	it( 'resizes with center crop and attention strategy', async () => {
		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			lastModified: 1234567891,
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		await resizeImage(
			buffer,
			'image/jpeg',
			{
				width: 100,
				height: 100,
				crop: true,
			},
			true
		);

		expect( mockThumbnailBuffer ).toHaveBeenCalledWith( buffer, 100, {
			height: 100,
			crop: 'attention',
			size: 'down',
		} );
		expect( mockCrop ).not.toHaveBeenCalled();
	} );

	it.each< [ ImageSizeCrop[ 'crop' ], [ number, number, number, number ] ] >(
		[
			[
				[ 'left', 'top' ],
				[ 0, 0, 25, 25 ],
			],
			[
				[ 'center', 'top' ],
				[ 50, 0, 25, 25 ],
			],
			[
				[ 'right', 'top' ],
				[ 75, 0, 25, 25 ],
			],
			[
				[ 'left', 'center' ],
				[ 0, 50, 25, 25 ],
			],
			[
				[ 'center', 'center' ],
				[ 50, 50, 25, 25 ],
			],
			[
				[ 'right', 'center' ],
				[ 75, 50, 25, 25 ],
			],
			[
				[ 'left', 'bottom' ],
				[ 0, 75, 25, 25 ],
			],
			[
				[ 'center', 'bottom' ],
				[ 50, 75, 25, 25 ],
			],
			[
				[ 'right', 'bottom' ],
				[ 75, 75, 25, 25 ],
			],
		]
	)( 'resizes with %s param and crops %s', async ( crop, expected ) => {
		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			lastModified: 1234567891,
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		await resizeImage( buffer, 'image/jpeg', {
			width: 25,
			height: 25,
			crop,
		} );

		expect( mockCrop ).toHaveBeenCalledWith( ...expected );
	} );
} );
