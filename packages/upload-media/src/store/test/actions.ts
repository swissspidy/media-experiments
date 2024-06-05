/**
 * WordPress dependencies
 */
import { createRegistry } from '@wordpress/data';
import type { WPDataRegistry } from '@wordpress/data/build-types/registry';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { store as uploadStore } from '..';
import { ItemStatus, OperationType, type QueueItem } from '../types';

const mockImageFromPdf = new File( [], 'example.jpg', {
	lastModified: 1234567891,
	type: 'image/jpeg',
} );

jest.mock( '@mexp/pdf', () => ( {
	getImageFromPdf: jest.fn( () => mockImageFromPdf ),
} ) );

jest.mock( '../utils/vips', () => ( {
	vipsCancelOperations: jest.fn( () => true ),
} ) );

function createRegistryWithStores() {
	// Create a registry and register used stores.
	const registry = createRegistry();
	// @ts-ignore
	[ uploadStore, preferencesStore ].forEach( registry.register );
	return registry;
}

const jpegFile = new File( [], 'example.jpg', {
	lastModified: 1234567891,
	type: 'image/jpeg',
} );

const mp4File = new File( [], 'amazing-video.mp4', {
	lastModified: 1234567891,
	type: 'video/mp4',
} );

describe( 'actions', () => {
	let registry: WPDataRegistry;
	beforeEach( () => {
		registry = createRegistryWithStores();
		registry.dispatch( uploadStore ).pauseQueue();
	} );

	describe( 'addItem', () => {
		it( 'adds an item to the queue', () => {
			registry.dispatch( uploadStore ).addItem( {
				file: jpegFile,
			} );

			expect( registry.select( uploadStore ).getItems() ).toHaveLength(
				1
			);
			expect(
				registry.select( uploadStore ).getItems()[ 0 ]
			).toStrictEqual(
				expect.objectContaining( {
					id: expect.any( String ),
					file: jpegFile,
					sourceFile: jpegFile,
					status: ItemStatus.Processing,
					attachment: {
						url: expect.stringMatching( /^blob:/ ),
					},
				} )
			);
		} );
	} );

	describe( 'addItems', () => {
		it( 'adds multiple items to the queue', () => {
			registry.dispatch( uploadStore ).addItems( {
				files: [ jpegFile, mp4File ],
			} );

			expect( registry.select( uploadStore ).getItems() ).toHaveLength(
				2
			);
			expect(
				registry.select( uploadStore ).getItems()[ 0 ]
			).toStrictEqual(
				expect.objectContaining( {
					id: expect.any( String ),
					file: jpegFile,
					sourceFile: jpegFile,
					status: ItemStatus.Processing,
					attachment: {
						url: expect.stringMatching( /^blob:/ ),
					},
				} )
			);
			expect(
				registry.select( uploadStore ).getItems()[ 1 ]
			).toStrictEqual(
				expect.objectContaining( {
					id: expect.any( String ),
					file: mp4File,
					sourceFile: mp4File,
					status: ItemStatus.Processing,
					attachment: {
						url: expect.stringMatching( /^blob:/ ),
					},
				} )
			);
		} );
	} );

	describe( 'addItemFromUrl', () => {
		it( 'downloads file and adds it to the queue', async () => {
			window.fetch = jest.fn( () =>
				Promise.resolve( {
					ok: true,
					blob: jest.fn( () => Promise.resolve( jpegFile ) ),
				} )
			) as jest.Mock;

			await registry.dispatch( uploadStore ).addItemFromUrl( {
				url: 'https://example.com/example.jpg',
			} );

			expect( registry.select( uploadStore ).getItems() ).toHaveLength(
				1
			);
			expect(
				registry.select( uploadStore ).getItems()[ 0 ]
			).toStrictEqual(
				expect.objectContaining( {
					id: expect.any( String ),
					sourceUrl: 'https://example.com/example.jpg',
					file: jpegFile,
					sourceFile: jpegFile,
					status: ItemStatus.Processing,
					attachment: {
						url: expect.stringMatching( /^blob:/ ),
					},
					mediaSourceTerms: [ 'media-import' ],
				} )
			);
		} );
	} );

	describe( 'muteExistingVideo', () => {
		it( 'downloads file and adds it to the queue for transcoding', async () => {
			window.fetch = jest.fn( () =>
				Promise.resolve( {
					ok: true,
					blob: jest.fn( () => Promise.resolve( mp4File ) ),
				} )
			) as jest.Mock;

			await registry.dispatch( uploadStore ).muteExistingVideo( {
				id: 1234,
				url: 'https://example.com/awesome-video.mp4',
			} );

			expect( registry.select( uploadStore ).getItems() ).toHaveLength(
				1
			);

			const item: QueueItem = registry
				.select( uploadStore )
				.getItems()[ 0 ];

			expect( item ).toStrictEqual(
				expect.objectContaining( {
					id: expect.any( String ),
					sourceUrl: 'https://example.com/awesome-video.mp4',
					file: expect.any( File ),
					sourceFile: expect.any( File ),
					sourceAttachmentId: 1234,
					status: ItemStatus.Processing,
					attachment: {
						url: 'https://example.com/awesome-video.mp4',
					},
					operations: [
						OperationType.TranscodeMuteVideo,
						OperationType.Upload,
					],
				} )
			);
			expect( item.file.name ).toBe( 'awesome-video-muted.mp4' );
		} );
	} );

	describe( 'optimizeExistingItem', () => {
		it( 'downloads video file and adds it to the queue for transcoding', async () => {
			window.fetch = jest.fn( () =>
				Promise.resolve( {
					ok: true,
					blob: jest.fn( () => Promise.resolve( mp4File ) ),
				} )
			) as jest.Mock;

			await registry.dispatch( uploadStore ).optimizeExistingItem( {
				id: 1234,
				url: 'https://example.com/awesome-video.mp4',
			} );

			expect( registry.select( uploadStore ).getItems() ).toHaveLength(
				1
			);

			const item: QueueItem = registry
				.select( uploadStore )
				.getItems()[ 0 ];

			expect( item ).toEqual(
				expect.objectContaining( {
					abortController: expect.any( AbortController ),
					id: expect.any( String ),
					sourceUrl: 'https://example.com/awesome-video.mp4',
					file: expect.any( File ),
					sourceFile: expect.any( File ),
					sourceAttachmentId: 1234,
					status: ItemStatus.Processing,
					additionalData: {
						generate_sub_sizes: false,
					},
					attachment: {
						url: 'https://example.com/awesome-video.mp4',
						poster: undefined,
					},
					mediaSourceTerms: [ 'media-optimization' ],
					operations: [
						[
							OperationType.TranscodeCompress,
							{ requireApproval: undefined },
						],
						OperationType.Upload,
					],
				} )
			);
			expect( item.file.name ).toBe( 'awesome-video-optimized.mp4' );
		} );
	} );

	describe( 'grantApproval', () => {
		it( 'should approve upload by attachment ID', async () => {
			registry.dispatch( uploadStore ).addItem( {
				file: jpegFile,
				sourceAttachmentId: 1234,
			} );

			registry.dispatch( uploadStore ).grantApproval( 1234 );

			expect( registry.select( uploadStore ).getItems() ).toHaveLength(
				1
			);
			expect(
				registry.select( uploadStore ).getItems()[ 0 ]
			).toStrictEqual(
				expect.objectContaining( {
					status: ItemStatus.Processing,
				} )
			);
		} );

		it( 'should do nothing for an invalid attachment ID', async () => {
			registry.dispatch( uploadStore ).addItem( {
				file: jpegFile,
				sourceAttachmentId: 1234,
			} );

			expect( registry.select( uploadStore ).getItems() ).toHaveLength(
				1
			);

			const item = registry.select( uploadStore ).getItems()[ 0 ];

			await registry.dispatch( uploadStore ).grantApproval( 5678 );

			expect( registry.select( uploadStore ).getItems()[ 0 ] ).toBe(
				item
			);
		} );
	} );

	describe( 'rejectApproval', () => {
		it( 'should cancel upload by attachment ID', async () => {
			const onError = jest.fn();
			registry.dispatch( uploadStore ).addItem( {
				file: jpegFile,
				sourceAttachmentId: 1234,
				onError,
			} );

			await registry.dispatch( uploadStore ).rejectApproval( 1234 );

			expect( registry.select( uploadStore ).getItems() ).toHaveLength(
				0
			);
			expect( onError ).toHaveBeenCalled();
		} );

		it( 'should do nothing for an invalid attachment ID', async () => {
			registry.dispatch( uploadStore ).addItem( {
				file: jpegFile,
				sourceAttachmentId: 1234,
			} );

			expect( registry.select( uploadStore ).getItems() ).toHaveLength(
				1
			);

			const item = registry.select( uploadStore ).getItems()[ 0 ];

			await registry.dispatch( uploadStore ).rejectApproval( 5678 );

			expect( registry.select( uploadStore ).getItems()[ 0 ] ).toBe(
				item
			);
		} );
	} );

	describe( 'setMediaSourceTerms', () => {
		it( 'adds media source terms to state', () => {
			registry.dispatch( uploadStore ).setMediaSourceTerms( {
				foo: 1,
				bar: 2,
				baz: 3,
			} );

			expect(
				registry.select( uploadStore ).getMediaSourceTermId( 'foo' )
			).toBe( 1 );
			expect(
				registry.select( uploadStore ).getMediaSourceTermId( 'bar' )
			).toBe( 2 );
			expect(
				registry.select( uploadStore ).getMediaSourceTermId( 'baz' )
			).toBe( 3 );
			expect(
				registry.select( uploadStore ).getMediaSourceTermId( 'unknown' )
			).toBe( undefined );
		} );
	} );

	describe( 'setImageSizes', () => {
		it( 'adds image sizes to state', () => {
			registry.dispatch( uploadStore ).setImageSizes( {
				thumbnail: { width: 150, height: 150, crop: true },
				large: { width: 1000, height: 0, crop: false },
			} );

			expect(
				registry.select( uploadStore ).getImageSize( 'thumbnail' )
			).toStrictEqual( { width: 150, height: 150, crop: true } );
			expect(
				registry.select( uploadStore ).getImageSize( 'large' )
			).toStrictEqual( { width: 1000, height: 0, crop: false } );
			expect(
				registry.select( uploadStore ).getImageSize( 'unknown' )
			).toBe( undefined );
		} );
	} );
} );
