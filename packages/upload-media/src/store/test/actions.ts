/**
 * WordPress dependencies
 */
import { createRegistry } from '@wordpress/data';
import { type WPDataRegistry } from '@wordpress/data/build-types/registry';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { store as uploadStore } from '..';
import { ItemStatus, type QueueItem, TranscodingType, Type } from '../types';
import { UploadError } from '../../uploadError';

const mockImageFromPdf = new File( [], 'example.jpg', {
	lastModified: 1234567891,
	type: 'image/jpeg',
} );

jest.mock( '@mexp/pdf', () => ( {
	getImageFromPdf: jest.fn( () => mockImageFromPdf ),
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
					status: ItemStatus.Pending,
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
					status: ItemStatus.Pending,
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
					status: ItemStatus.Pending,
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
					status: ItemStatus.Pending,
					attachment: {
						url: expect.stringMatching( /^blob:/ ),
					},
					mediaSourceTerms: [ 'media-import' ],
				} )
			);
		} );
	} );

	describe( 'completeItem', () => {
		it( 'removes an item from the queue', () => {
			registry.dispatch( uploadStore ).addItem( {
				file: jpegFile,
			} );

			expect( registry.select( uploadStore ).getItems() ).toHaveLength(
				1
			);

			const attachment = {
				id: 123,
				url: 'https://example.com/attachment.jpg',
				alt: '',
				title: '',
				mimeType: 'image/jpeg',
			};

			const item: QueueItem = registry
				.select( uploadStore )
				.getItems()[ 0 ];

			registry
				.dispatch( uploadStore )
				.finishUploading( item.id, attachment );

			registry.dispatch( uploadStore ).completeItem( item.id );

			expect( registry.select( uploadStore ).getItems() ).toHaveLength(
				0
			);
		} );
	} );

	describe( 'removeItem', () => {
		it( 'removes an item from the queue', () => {
			registry.dispatch( uploadStore ).addItem( {
				file: jpegFile,
			} );

			expect( registry.select( uploadStore ).getItems() ).toHaveLength(
				1
			);

			const item: QueueItem = registry
				.select( uploadStore )
				.getItems()[ 0 ];

			registry.dispatch( uploadStore ).removeItem( item.id );

			expect( registry.select( uploadStore ).getItems() ).toHaveLength(
				0
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
					status: ItemStatus.Pending,
					attachment: {
						url: 'https://example.com/awesome-video.mp4',
					},
					transcode: [ TranscodingType.MuteVideo ],
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

			expect( item ).toStrictEqual(
				expect.objectContaining( {
					id: expect.any( String ),
					sourceUrl: 'https://example.com/awesome-video.mp4',
					file: expect.any( File ),
					sourceFile: expect.any( File ),
					sourceAttachmentId: 1234,
					status: ItemStatus.Pending,
					attachment: {
						url: 'https://example.com/awesome-video.mp4',
					},
					transcode: [ TranscodingType.OptimizeExisting ],
				} )
			);
			expect( item.file.name ).toBe( 'awesome-video-optimized.mp4' );
		} );
	} );

	describe( 'requestApproval', () => {
		it( `should return the ${ Type.RequestApproval } action`, async () => {
			const result = await registry
				.dispatch( uploadStore )
				.requestApproval( 'abc123', jpegFile );

			await expect( result ).toStrictEqual( {
				type: Type.RequestApproval,
				id: 'abc123',
				file: jpegFile,
				url: expect.stringMatching( /^blob:/ ),
			} );
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
					status: ItemStatus.Approved,
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
			registry.dispatch( uploadStore ).addItem( {
				file: jpegFile,
				sourceAttachmentId: 1234,
			} );

			await registry.dispatch( uploadStore ).rejectApproval( 1234 );

			expect( registry.select( uploadStore ).getItems() ).toHaveLength(
				1
			);
			expect(
				registry.select( uploadStore ).getItems()[ 0 ]
			).toStrictEqual(
				expect.objectContaining( {
					status: ItemStatus.Cancelled,
					error: expect.any( UploadError ),
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

			await registry.dispatch( uploadStore ).rejectApproval( 5678 );

			expect( registry.select( uploadStore ).getItems()[ 0 ] ).toBe(
				item
			);
		} );
	} );

	describe( 'addPoster', () => {
		it( `should return the ${ Type.AddPoster } action`, async () => {
			const result = await registry
				.dispatch( uploadStore )
				.addPoster( 'abc123', jpegFile );

			expect( result ).toStrictEqual( {
				type: Type.AddPoster,
				id: 'abc123',
				file: jpegFile,
				url: expect.stringMatching( /^blob:/ ),
			} );
		} );
	} );

	describe( 'prepareForTranscoding', () => {
		it( `should return the ${ Type.TranscodingPrepare } action`, async () => {
			const result = await registry
				.dispatch( uploadStore )
				.prepareForTranscoding( 'abc123', [ TranscodingType.Image ] );

			await expect( result ).toStrictEqual( {
				type: Type.TranscodingPrepare,
				id: 'abc123',
				transcode: [ TranscodingType.Image ],
			} );
		} );
	} );

	describe( 'startTranscoding', () => {
		it( `should return the ${ Type.TranscodingStart } action`, async () => {
			const result = await registry
				.dispatch( uploadStore )
				.startTranscoding( 'abc123' );

			expect( result ).toStrictEqual( {
				type: Type.TranscodingStart,
				id: 'abc123',
			} );
		} );
	} );

	describe( 'finishTranscoding', () => {
		it( `should return the ${ Type.TranscodingFinish } action`, async () => {
			const result = await registry
				.dispatch( uploadStore )
				.finishTranscoding( 'abc123', mp4File );

			await expect( result ).toStrictEqual( {
				type: Type.TranscodingFinish,
				id: 'abc123',
				file: mp4File,
				url: expect.stringMatching( /^blob:/ ),
			} );
		} );
	} );

	describe( 'startUploading', () => {
		it( `should return the ${ Type.UploadStart } action`, async () => {
			const result = await registry
				.dispatch( uploadStore )
				.startUploading( 'abc123' );

			expect( result ).toStrictEqual( {
				type: Type.UploadStart,
				id: 'abc123',
			} );
		} );
	} );

	describe( 'finishUploading', () => {
		it( 'should mark the item as uploaded', () => {
			const attachment = {
				id: 123,
				url: 'https://example.com/attachment.jpg',
				alt: '',
				title: '',
				mimeType: 'image/jpeg',
			};

			registry.dispatch( uploadStore ).addItem( {
				file: jpegFile,
				sourceAttachmentId: 1234,
			} );

			expect( registry.select( uploadStore ).getItems() ).toHaveLength(
				1
			);

			const item: QueueItem = registry
				.select( uploadStore )
				.getItems()[ 0 ];

			registry
				.dispatch( uploadStore )
				.finishUploading( item.id, attachment );

			expect(
				registry.select( uploadStore ).getItems()[ 0 ]
			).toStrictEqual(
				expect.objectContaining( {
					status: ItemStatus.Uploaded,
				} )
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
