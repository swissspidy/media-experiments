/**
 * Returns an action object used in signalling that the user opened the
 * publish sidebar.
 */
export function openPublishSidebar(): void;

/**
 * Returns an action object used in signalling that the user closed the
 * publish sidebar.
 */
export function closePublishSidebar(): void;

/**
 * Patched Gutenberg action to signal whether any upload is in progress.
 * @param status
 */
export function setIsUploading( status: boolean ): void;
