import type { BlockInstance } from '@wordpress/blocks';

/**
 * Determines if the given block type is allowed to be inserted into the block list.
 *
 * @param state
 * @param blockName - The name of the block type, e.g.' core/paragraph'.
 * @param rootClientId - Optional root client ID of block list.
 *
 * @returns Whether the given block type is allowed to be inserted.
 */
export function canInsertBlockType(
	state: Record< string, unknown >,
	blockName: string,
	rootClientId?: string
): boolean;

/**
 * Returns the client ID of the block adjacent one at the given reference `startClientId` and modifier
 * directionality. Defaults start `startClientId` to the selected block, and direction as next block.
 * Returns `null` if there is no adjacent block.
 *
 * @param state
 * @param startClientId - Optional client ID of block from which to search.
 * @param modifier - Directionality multiplier (1 next, -1 previous).
 *
 * @returns Return the client ID of the block, or null if none exists.
 */
export function getAdjacentBlockClientId(
	state: Record< string, unknown >,
	startClientId?: string,
	modifier?: 1 | -1
): string | null;

/**
 * Returns a block given its client ID. This is a parsed copy of the block, containing its
 * `blockName`, `clientId`, and current `attributes` state. This is not the block's registration
 * settings, which must be retrieved from the blocks module registration store.
 *
 * @param state
 * @param clientId - Block client ID.
 *
 * @returns Parsed block object.
 */
export function getBlock(
	state: Record< string, unknown >,
	clientId: string
): BlockInstance | null;

/**
 * Returns a block's attributes given its client ID, or null if no block exists with the client ID.
 *
 * @param state
 * @param clientId - Block client ID.
 *
 * @returns Block attributes.
 */
export function getBlockAttributes(
	state: Record< string, unknown >,
	clientId: string
): Record< string, any > | null;

/**
 * Returns the number of blocks currently present in the post.
 *
 * @param state
 * @param rootClientId - Optional root client ID of block list.
 *
 * @returns Number of blocks in the post.
 */
export function getBlockCount(
	state: Record< string, unknown >,
	rootClientId?: string
): number;

/**
 * Given a block client ID, returns the root of the hierarchy from which the block is nested, return
 * the block itself for root level blocks.
 *
 * @param state
 * @param clientId - Block from which to find root client ID.
 *
 * @returns Root client ID
 */
export function getBlockHierarchyRootClientId(
	state: Record< string, unknown >,
	clientId: string
): string;

/**
 * Returns the index at which the block corresponding to the specified client ID occurs within the
 * block order, or `-1` if the block does not exist.
 *
 * @param state
 * @param clientId - Block client ID.
 * @param rootClientId - Optional root client ID of block list.
 *
 * @returns Index at which block exists in order.
 */
export function getBlockIndex(
	state: Record< string, unknown >,
	clientId: string,
	rootClientId?: string
): number;

/**
 * Returns the insertion point, the index at which the new inserted block would
 * be placed. Defaults to the last index.
 */
export function getBlockInsertionPoint(): {
	state: Record< string, unknown >;
	index: number;
	rootClientId?: string | undefined;
};

/**
 * Returns the Block List settings of a block, if any exist.
 *
 * @param state
 * @param clientId - Block client ID.
 *
 * @returns Block settings of the block if set.
 */
export function getBlockListSettings(
	state: Record< string, unknown >,
	clientId?: string
): Record< string, unknown > | undefined;

/**
 * Returns the block's editing mode, defaulting to `"visual"` if not explicitly assigned.
 *
 * @param state
 * @param clientId - Block client ID.
 *
 * @returns Block editing mode.
 */
export function getBlockMode(
	state: Record< string, unknown >,
	clientId: string
): string;

/**
 * Returns a block's name given its client ID, or `null` if no block exists with the client ID.
 *
 * @param state
 * @param clientId - Block client ID.
 *
 * @returns Block name.
 */
export function getBlockName(
	state: Record< string, unknown >,
	clientId: string
): string | null;

/**
 * Returns an array containing all block client IDs in the editor in the order they appear.
 * Optionally accepts a root client ID of the block list for which the order should be returned,
 * defaulting to the top-level block order.
 *
 * @param state
 * @param rootClientId - Optional root client ID of block list.
 *
 * @returns Ordered client IDs of editor blocks.
 */
export function getBlockOrder(
	state: Record< string, unknown >,
	rootClientId?: string
): string[];

/**
 * Given a block client ID, returns the root block from which the block is nested, an empty string
 * for top-level blocks, or `null` if the block does not exist.
 *
 * @param state
 * @param clientId - Block from which to find root client ID.
 *
 * @returns Root client ID, if exists
 */
export function getBlockRootClientId(
	state: Record< string, unknown >,
	clientId: string
): string | null;

/**
 * Returns the current block selection end. This value may be `undefined`, and it may represent either a
 * singular block selection or multi-selection end.  A selection is singular if its start and end
 * match.
 *
 * @returns Client ID of block selection end.
 */
export function getBlockSelectionEnd(
	state: Record< string, unknown >
): string | undefined;

/**
 * Returns the current block selection start. This value may be `undefined`, and it may represent
 * either a singular block selection or multi-selection start. A selection is singular if its start
 * and end match.
 *
 * @returns Client ID of block selection start.
 */
export function getBlockSelectionStart(
	state: Record< string, unknown >
): string | undefined;

/**
 * Returns all block objects for the current post being edited as an array in the order they appear
 * in the post.
 *
 * Note: It's important to memoize this selector to avoid return a new instance
 * on each call
 *
 * @param state
 * @param rootClientId - Optional root client ID of block list.
 *
 * @returns Post blocks.
 */
export function getBlocks(
	state: Record< string, unknown >,
	rootClientId?: string
): BlockInstance[];

/**
 * Given an array of block client IDs, returns the corresponding array of block objects or `null`.
 *
 * @param clientIds - Client IDs for which blocks are to be returned.
 */
export function getBlocksByClientId(
	clientIds: string | string[]
): Array< BlockInstance | null >;

/**
 * Returns an array containing the clientIds of all descendants of the blocks given.
 *
 * @param state
 * @param clientIds - Array of block ids to inspect.
 *
 * @returns ids of descendants.
 */
export function getClientIdsOfDescendants(
	state: Record< string, unknown >,
	clientIds: string[]
): string[];

/**
 * Returns an array containing the `clientIds` of the top-level blocks and their descendants of any
 * depth (for nested blocks).
 *
 * @returns ids of top-level and descendant blocks.
 */
export function getClientIdsWithDescendants(
	state: Record< string, unknown >
): string[];

/**
 * Returns the client ID of the first block in the multi-selection set, or `null` if there is no
 * multi-selection.
 *
 * @returns First block client ID in the multi-selection set.
 */
export function getFirstMultiSelectedBlockClientId(
	state: Record< string, unknown >
): string | null;

/**
 * Returns the total number of blocks, or the total number of blocks with a specific name in a post.
 * The number returned includes nested blocks.
 *
 * @param state
 * @param blockName - Optional block name, if specified only blocks of that type will be counted.
 *
 * @returns Number of blocks in the post, or number of blocks with name equal to `blockName`.
 */
export function getGlobalBlockCount(
	state: Record< string, unknown >,
	blockName?: string
): number;

/**
 * Determines the items that appear in the inserter. Includes both static items (e.g. a regular
 * block type) and dynamic items (e.g. a reusable block).
 *
 * @remarks
 * Each item object contains what's necessary to display a button in the inserter and handle its
 * selection.
 *
 * The `utility` property indicates how useful we think an item will be to the user. There are 4
 * levels of utility:
 *
 * 1. Blocks that are contextually useful (utility = 3)
 * 2. Blocks that have been previously inserted (utility = 2)
 * 3. Blocks that are in the common category (utility = 1)
 * 4. All other blocks (utility = 0)
 *
 * The `frecency` property is a heuristic (https://en.wikipedia.org/wiki/Frecency)
 * that combines block usage frequenty and recency.
 *
 * Items are returned ordered descendingly by their `utility` and `frecency`.
 *
 * @param state
 * @param rootClientId - Optional root client ID of block list.
 *
 * @returns Items that appear in inserter.
 */
export function getInserterItems(
	state: Record< string, unknown >,
	rootClientId?: string
): Record< string, unknown >[];

/**
 * Returns the client ID of the last block in the multi-selection set, or `null` if there is no
 * multi-selection.
 *
 * @returns Last block client ID in the multi-selection set.
 */
export function getLastMultiSelectedBlockClientId(
	state: Record< string, unknown >
): string | null;

/**
 * Returns the current multi-selection set of block client IDs, or an empty array if there is no
 * multi-selection.
 *
 * @returns Multi-selected block client IDs.
 */
export function getMultiSelectedBlockClientIds(
	state: Record< string, unknown >
): string[];

/**
 * Returns the current multi-selection set of blocks, or an empty array if there is no
 * multi-selection.
 *
 * @returns Multi-selected block objects.
 */
export function getMultiSelectedBlocks(
	state: Record< string, unknown >
): BlockInstance[];

/**
 * Returns the client ID of the block which ends the multi-selection set, or `null` if there is no
 * multi-selection.
 *
 * This is not necessarily the last client ID in the selection.
 *
 * @see getLastMultiSelectedBlockClientId
 *
 * @returns Client ID of block ending multi-selection.
 */
export function getMultiSelectedBlocksEndClientId(
	state: Record< string, unknown >
): string | null;

/**
 * Returns the client ID of the block which begins the multi-selection set, or `null` if there is no
 * multi-selection.
 *
 * This is not necessarily the first client ID in the selection.
 *
 * @see getFirstMultiSelectedBlockClientId
 *
 * @returns Client ID of block beginning multi-selection.
 */
export function getMultiSelectedBlocksStartClientId(
	state: Record< string, unknown >
): string | null;

/**
 * Returns the next block's client ID from the given reference start ID. Defaults start to the
 * selected block. Returns `null` if there is no next block.
 *
 * @param state
 * @param startClientId - Optional client ID of block from which to search.
 *
 * @returns Adjacent block's client ID, or `null` if none exists.
 */
export function getNextBlockClientId(
	state: Record< string, unknown >,
	startClientId?: string
): string | null;

/**
 * Returns the previous block's client ID from the given reference start ID. Defaults start to the
 * selected block. Returns `null` if there is no previous block.
 *
 * @param state
 * @param startClientId - Optional client ID of block from which to search.
 *
 * @returns Adjacent block's client ID, or `null` if none exists.
 */
export function getPreviousBlockClientId(
	state: Record< string, unknown >,
	startClientId?: string
): string | null;

/**
 * Returns the currently selected block, or `null` if there is no selected block.
 *
 * @returns Selected block.
 */
export function getSelectedBlock(
	state: Record< string, unknown >
): BlockInstance | null;

/**
 * Returns the currently selected block client ID, or `null` if there is no selected block.
 *
 * @returns Selected block client ID.
 */
export function getSelectedBlockClientId(
	state: Record< string, unknown >
): string | null;

/**
 * Returns the current selection set of block client IDs (multiselection or single selection).
 *
 * @returns Multi-selected block client IDs.
 */
export function getSelectedBlockClientIds(
	state: Record< string, unknown >
): string[];

/**
 * Returns the number of blocks currently selected in the post.
 *
 * @returns Number of blocks selected in the post.
 */
export function getSelectedBlockCount(
	state: Record< string, unknown >
): number;

/**
 * Returns the initial caret position for the selected block. This position is to used to position
 * the caret properly when the selected block changes.
 */
export function getSelectedBlocksInitialCaretPosition(
	state: Record< string, unknown >
): number | null;

/**
 * Returns the current selection end.
 *
 * @returns Selection end information.
 */
export function getSelectionEnd(
	state: Record< string, unknown >
): Record< string, unknown >;

/**
 * Returns the current selection start.
 *
 * @returns Selection start information.
 */
export function getSelectionStart(
	state: Record< string, unknown >
): Record< string, unknown >;

/**
 * Returns the editor settings.
 */
export function getSettings(
	state: Record< string, unknown >
): Record< string, unknown >;

// FIXME: This is poorly documented. It's not clear what this is.
/**
 * Returns the defined block template.
 */
export function getTemplate( state: Record< string, unknown > ): any;

/**
 * Returns the defined block template lock. Optionally accepts a root block client ID as context,
 * otherwise defaulting to the global context.
 *
 * @param state
 * @param rootClientId - Optional block root client ID.
 *
 * @returns Block Template Lock
 */
export function getTemplateLock(
	state: Record< string, unknown >,
	rootClientId?: string
): string | undefined;

/**
 * Determines whether there are items to show in the inserter.
 *
 * @param state
 * @param rootClientId - Optional root client ID of block list.
 *
 * @returns Items that appear in inserter.
 */
export function hasInserterItems(
	state: Record< string, unknown >,
	rootClientId?: string
): boolean;

/**
 * Returns `true` if a multi-selection has been made, or `false` otherwise.
 *
 * @returns Whether multi-selection has been made.
 */
export function hasMultiSelection( state: Record< string, unknown > ): boolean;

/**
 * Returns `true` if there is a single selected block, or `false` otherwise.
 *
 * @returns Whether a single block is selected.
 */
export function hasSelectedBlock( state: Record< string, unknown > ): boolean;

/**
 * Returns `true` if one of the block's inner blocks is selected.
 *
 * @param state
 * @param clientId - Block client ID.
 * @param deep - Perform a deep check. (default: `true`)
 *
 * @returns Whether the block as an inner block selected
 */
export function hasSelectedInnerBlock(
	state: Record< string, unknown >,
	clientId: string,
	deep?: boolean
): boolean;

/**
 * Returns `true` if an ancestor of the block is multi-selected, or `false` otherwise.
 *
 * @param state
 * @param clientId - Block client ID.
 *
 * @returns Whether an ancestor of the block is in multi-selection set.
 */
export function isAncestorMultiSelected(
	state: Record< string, unknown >,
	clientId: string
): boolean;

/**
 * Returns `true` if we should show the block insertion point.
 *
 * @returns Whether the insertion point is visible or not.
 */
export function isBlockInsertionPointVisible(
	state: Record< string, unknown >
): boolean;

/**
 * Returns `true` if the client ID occurs within the block multi-selection, or `false` otherwise.
 *
 * @param state
 * @param clientId - Block client ID.
 *
 * @returns Whether block is in multi-selection set.
 */
export function isBlockMultiSelected(
	state: Record< string, unknown >,
	clientId: string
): boolean;

/**
 * Returns `true` if the block corresponding to the specified client ID is currently selected and no
 * multi-selection exists, or `false` otherwise.
 *
 * @param state
 * @param clientId - Block client ID.
 *
 * @returns Whether block is selected and multi-selection exists.
 */
export function isBlockSelected(
	state: Record< string, unknown >,
	clientId: string
): boolean;

/**
 * Returns whether a block is valid or not.
 *
 * @param state
 * @param clientId - Block client ID.
 *
 * @returns Is Valid.
 */
export function isBlockValid(
	state: Record< string, unknown >,
	clientId: string
): boolean;

/**
 * Returns `true` if the block corresponding to the specified client ID is currently selected but
 * isn't the last of the selected blocks. Here "last" refers to the block sequence in the document,
 * _not_ the sequence of multi-selection, which is why `state.blockSelection.end` isn't used.
 *
 * @param state
 * @param clientId - Block client ID.
 *
 * @returns Whether block is selected and not the last in the selection.
 */
export function isBlockWithinSelection(
	state: Record< string, unknown >,
	clientId: string
): boolean;

/**
 * Returns `true` if the caret is within formatted text, or `false` otherwise.
 *
 * @returns Whether the caret is within formatted text.
 */
export function isCaretWithinFormattedText(
	state: Record< string, unknown >
): boolean;

/**
 * Returns `true` if a multi-selection exists, and the block corresponding to the specified client
 * ID is the first block of the multi-selection set, or `false` otherwise.
 *
 * @param state
 * @param clientId - Block client ID.
 *
 * @returns Whether block is first in multi-selection.
 */
export function isFirstMultiSelectedBlock(
	state: Record< string, unknown >,
	clientId: string
): boolean;

/**
 * Returns `true` if the most recent block change is be considered persistent, or `false` otherwise.
 * A persistent change is one committed by BlockEditorProvider via its `onChange` callback, in
 * addition to `onInput`.
 *
 * @returns Whether the most recent block change was persistent.
 */
export function isLastBlockChangePersistent(
	state: Record< string, unknown >
): boolean;

/**
 * Whether in the process of multi-selecting or not. This flag is only `true` while the
 * multi-selection is being selected (by mouse move), and is `false` once the multi-selection has
 * been settled.
 *
 * @see hasMultiSelection
 *
 * @returns `true` if multi-selecting, `false` if not.
 */
export function isMultiSelecting( state: Record< string, unknown > ): boolean;

/**
 * Selector that returns if multi-selection is enabled or not.
 *
 * @returns `true` if it should be possible to multi-select blocks, `false` if multi-selection is
 * disabled.
 */
export function isSelectionEnabled( state: Record< string, unknown > ): boolean;

/**
 * Returns `true` if the user is typing, or `false` otherwise.
 *
 * @returns Whether user is typing.
 */
export function isTyping( state: Record< string, unknown > ): boolean;

/**
 * Returns whether the blocks matches the template or not.
 *
 * @returns Whether the template is valid or not.
 */
export function isValidTemplate( state: Record< string, unknown > ): boolean;
