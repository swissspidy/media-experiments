/**
 * Internal dependencies
 */
import { preloadMedia } from '../utils';

// Mock the Image constructor
const mockImageLoadTrigger = jest.fn();
const mockImageErrorTrigger = jest.fn();

global.Image = class {
	onload: ( () => void ) | null = null;
	onerror: ( () => void ) | null = null;
	src = '';

	constructor() {
		// Simulate async loading
		setTimeout( () => {
			if ( this.src ) {
				if ( mockImageLoadTrigger() ) {
					this.onload?.();
				} else {
					this.onerror?.();
				}
			}
		}, 0 );
	}
} as any;

// Mock the document.createElement for video elements
const mockVideoLoadTrigger = jest.fn();
const mockVideoErrorTrigger = jest.fn();

const originalCreateElement = document.createElement.bind( document );
document.createElement = jest.fn( ( tagName: string ) => {
	if ( tagName === 'video' ) {
		return {
			onloadeddata: null,
			onerror: null,
			src: '',
			load: jest.fn( function ( this: any ) {
				// Simulate async loading
				setTimeout( () => {
					if ( this.src ) {
						if ( mockVideoLoadTrigger() ) {
							this.onloadeddata?.();
						} else {
							this.onerror?.();
						}
					}
				}, 0 );
			} ),
		} as any;
	}
	return originalCreateElement( tagName );
} );

describe( 'preloadMedia', () => {
	beforeEach( () => {
		mockImageLoadTrigger.mockReset();
		mockImageErrorTrigger.mockReset();
		mockVideoLoadTrigger.mockReset();
		mockVideoErrorTrigger.mockReset();
	} );

	it( 'should preload an image successfully', async () => {
		mockImageLoadTrigger.mockReturnValue( true );

		await expect(
			preloadMedia( 'https://example.com/image.jpg', 'image' )
		).resolves.toBeUndefined();
	} );

	it( 'should reject when image fails to load', async () => {
		mockImageLoadTrigger.mockReturnValue( false );

		await expect(
			preloadMedia( 'https://example.com/image.jpg', 'image' )
		).rejects.toThrow( 'Failed to preload image' );
	} );

	it( 'should preload a video successfully', async () => {
		mockVideoLoadTrigger.mockReturnValue( true );

		await expect(
			preloadMedia( 'https://example.com/video.mp4', 'video' )
		).resolves.toBeUndefined();
	} );

	it( 'should reject when video fails to load', async () => {
		mockVideoLoadTrigger.mockReturnValue( false );

		await expect(
			preloadMedia( 'https://example.com/video.mp4', 'video' )
		).rejects.toThrow( 'Failed to preload video' );
	} );
} );
