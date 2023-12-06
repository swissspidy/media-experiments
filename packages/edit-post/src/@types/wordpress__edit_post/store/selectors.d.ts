/**
 * Returns true if the publish sidebar is opened.
 */
export function isPublishSidebarOpened(): boolean;

/**
 * Returns true if meta boxes are initialized.
 */
export function areMetaBoxesInitialized(): boolean;

/**
 * Returns true if the post is using meta boxes.
 */
export function hasMetaBoxes(): boolean;

/**
 * Returns true if a meta box location is active and visible.
 */
export function isMetaBoxLocationVisible(
	state: Record< string, unknown >,
	location: string
): boolean;

/**
 * Returns an array of active meta box locations.
 */
export function getActiveMetaBoxLocations(): string[];
