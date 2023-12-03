import { resizeImage } from '../';
import type { ImageSizeCrop } from '../types';

let windowSpy: any;
const mockImage: any = {
	writeToBuffer: jest.fn(),
};
const mockThumbnailBuffer = jest.fn( () => mockImage );
const mockCrop = jest.fn( () => mockImage );

describe( 'resizeImage', () => {
	beforeEach( () => {
		windowSpy = jest.spyOn( window, 'window', 'get' );
		windowSpy.mockImplementation( () => ( {
			Vips: jest.fn( () => ( {
				Image: {
					newFromBuffer: jest.fn( () => ( {
						crop: mockCrop,
						writeToBuffer: jest.fn(),
						width: 100,
						height: 100,
					} ) ),
					thumbnailBuffer: mockThumbnailBuffer,
				},
			} ) ),
		} ) );
	} );

	afterEach( () => {
		windowSpy.mockRestore();
		jest.clearAllMocks();
	} );

	it( 'resizes without crop', async () => {
		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			lastModified: 1234567891,
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		await resizeImage( jpegFile, {
			width: 100,
			height: 100,
		} );

		expect( mockThumbnailBuffer ).toHaveBeenCalledWith( buffer, 100, {
			height: 100,
		} );
		expect( mockCrop ).not.toHaveBeenCalled();
	} );

	it( 'resizes without crop and zero height', async () => {
		const jpegFile = new File( [], 'example.jpg', {
			lastModified: 1234567891,
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		await resizeImage( jpegFile, {
			width: 100,
			height: 0,
		} );

		expect( mockThumbnailBuffer ).toHaveBeenCalledWith( buffer, 100, {} );
		expect( mockCrop ).not.toHaveBeenCalled();
	} );

	it( 'resizes with center crop', async () => {
		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			lastModified: 1234567891,
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		await resizeImage( jpegFile, {
			width: 100,
			height: 100,
			crop: true,
		} );

		expect( mockThumbnailBuffer ).toHaveBeenCalledWith( buffer, 100, {
			height: 100,
			crop: 'centre',
		} );
		expect( mockCrop ).not.toHaveBeenCalled();
	} );
	it( 'resizes with center crop and zero height', async () => {
		const jpegFile = new File( [ '<BLOB>' ], 'example.jpg', {
			lastModified: 1234567891,
			type: 'image/jpeg',
		} );
		const buffer = await jpegFile.arrayBuffer();

		await resizeImage( jpegFile, {
			width: 100,
			height: 0,
			crop: true,
		} );

		expect( mockThumbnailBuffer ).toHaveBeenCalledWith( buffer, 100, {
			crop: 'centre',
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

		await resizeImage( jpegFile, {
			width: 25,
			height: 25,
			crop,
		} );

		expect( mockCrop ).toHaveBeenCalledWith( ...expected );
	} );
} );
