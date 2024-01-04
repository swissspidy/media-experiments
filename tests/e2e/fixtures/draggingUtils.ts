import type { Locator, Page } from '@playwright/test';

export class DraggingUtils {
	page: Page;
	dropZone: Locator;
	insertionIndicator: Locator;

	constructor( { page } ) {
		this.page = page;

		this.dropZone = page.locator( 'data-testid=block-popover-drop-zone' );
		this.insertionIndicator = page.locator(
			'data-testid=block-list-insertion-point-indicator'
		);
	}

	async dragOver( x, y ) {
		// Call the move function twice to make sure the `dragOver` event is sent.
		// @see https://github.com/microsoft/playwright/issues/17153
		for ( let i = 0; i < 2; i += 1 ) {
			await this.page.mouse.move( x, y );
		}
	}

	async simulateDraggingHTML( html ) {
		// Insert a dummy draggable element on the page to simulate dragging
		// HTML from other places. The dummy element will get removed once the drag starts.
		await this.page.evaluate( ( _html ) => {
			const draggable = document.createElement( 'div' );
			draggable.draggable = true;
			draggable.style.width = '10px';
			draggable.style.height = '10px';
			// Position it in the top left corner for convenience.
			draggable.style.position = 'fixed';
			draggable.style.top = '0';
			draggable.style.left = '0';
			draggable.style.zIndex = '999999';

			draggable.addEventListener(
				'dragstart',
				( event ) => {
					// Set the data transfer to some HTML on dragstart.
					event.dataTransfer.setData( 'text/html', _html );

					// Some browsers will cancel the drag if the source is immediately removed.
					setTimeout( () => {
						draggable.remove();
					}, 0 );
				},
				{ once: true }
			);

			document.body.appendChild( draggable );
		}, html );

		// This is where the dummy draggable element is at.
		await this.page.mouse.move( 0, 0 );
		await this.page.mouse.down();
	}

	async confirmValidDropZonePosition( element ) {
		// Check that both x and y axis of the dropzone
		// have a less than 1 difference with a given target element
		const box = await this.dropZone.boundingBox();
		if ( ! box ) {
			return false;
		}

		return (
			Math.abs( element.x - box.x ) < 1 &&
			Math.abs( element.y - box.y ) < 1
		);
	}
}
