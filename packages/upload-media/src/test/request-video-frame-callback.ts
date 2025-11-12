/**
 * Internal dependencies
 */
import {
	supportsRequestVideoFrameCallback,
	requestVideoFrame,
	requestVideoFrameLoop,
} from '../request-video-frame-callback';

describe( 'request-video-frame-callback', () => {
	describe( 'supportsRequestVideoFrameCallback', () => {
		it( 'should return a boolean', () => {
			const result = supportsRequestVideoFrameCallback();
			expect( typeof result ).toBe( 'boolean' );
		} );

		it( 'should return false if HTMLVideoElement is not available', () => {
			const originalHTMLVideoElement =
				globalThis.HTMLVideoElement;
			// @ts-ignore
			delete globalThis.HTMLVideoElement;

			const result = supportsRequestVideoFrameCallback();
			expect( result ).toBe( false );

			globalThis.HTMLVideoElement = originalHTMLVideoElement;
		} );
	} );

	describe( 'requestVideoFrame', () => {
		let video: HTMLVideoElement;
		let mockCallback: jest.Mock;

		beforeEach( () => {
			video = document.createElement( 'video' );
			mockCallback = jest.fn();
		} );

		it( 'should call the callback', ( done ) => {
			requestVideoFrame( video, ( now, metadata ) => {
				expect( typeof now ).toBe( 'number' );
				expect( metadata ).toBeDefined();
				done();
			} );
		} );

		it( 'should return a cancel function', () => {
			const cancel = requestVideoFrame( video, mockCallback );
			expect( typeof cancel ).toBe( 'function' );
			cancel();
		} );

		it( 'should stop calling the callback after cancel', ( done ) => {
			const cancel = requestVideoFrame( video, mockCallback );
			cancel();

			// Wait a bit to ensure callback is not called
			setTimeout( () => {
				expect( mockCallback ).not.toHaveBeenCalled();
				done();
			}, 100 );
		} );

		it( 'should provide metadata with required fields', ( done ) => {
			requestVideoFrame( video, ( now, metadata ) => {
				expect( metadata ).toBeDefined();
				if ( metadata ) {
					expect( metadata.width ).toBeDefined();
					expect( metadata.height ).toBeDefined();
					expect( metadata.mediaTime ).toBeDefined();
					expect( metadata.presentationTime ).toBeDefined();
					expect( metadata.expectedDisplayTime ).toBeDefined();
					expect( metadata.presentedFrames ).toBeDefined();
				}
				done();
			} );
		} );
	} );

	describe( 'requestVideoFrameLoop', () => {
		let video: HTMLVideoElement;
		let mockCallback: jest.Mock;

		beforeEach( () => {
			video = document.createElement( 'video' );
			mockCallback = jest.fn();
		} );

		it( 'should call the callback multiple times', ( done ) => {
			let callCount = 0;
			const maxCalls = 3;

			const cancel = requestVideoFrameLoop(
				video,
				() => {
					callCount++;
					if ( callCount >= maxCalls ) {
						cancel();
						expect( callCount ).toBe( maxCalls );
						done();
					}
				}
			);
		} );

		it( 'should respect shouldContinue condition', ( done ) => {
			let callCount = 0;
			const maxCalls = 3;

			requestVideoFrameLoop(
				video,
				() => {
					callCount++;
				},
				() => {
					if ( callCount >= maxCalls ) {
						expect( callCount ).toBe( maxCalls );
						done();
						return false;
					}
					return true;
				}
			);
		} );

		it( 'should stop when cancel is called', ( done ) => {
			let callCount = 0;

			const cancel = requestVideoFrameLoop( video, () => {
				callCount++;
				if ( callCount === 2 ) {
					cancel();
					const countAtCancel = callCount;

					// Wait a bit and verify no more calls
					setTimeout( () => {
						expect( callCount ).toBe( countAtCancel );
						done();
					}, 100 );
				}
			} );
		} );

		it( 'should provide metadata to the callback', ( done ) => {
			let callCount = 0;

			const cancel = requestVideoFrameLoop(
				video,
				( now, metadata ) => {
					callCount++;
					expect( typeof now ).toBe( 'number' );
					expect( metadata ).toBeDefined();

					if ( callCount >= 2 ) {
						cancel();
						done();
					}
				}
			);
		} );

		it( 'should handle immediate cancel gracefully', () => {
			const cancel = requestVideoFrameLoop( video, mockCallback );
			cancel();

			// Should not throw
			expect( () => cancel() ).not.toThrow();
		} );
	} );
} );
