/**
 * Returns the complementary area that is active in a given scope.
 *
 * @param {Object} state The store state.
 * @param {string} scope Item scope.
 *
 * @return {string | null | undefined} The complementary area that is active in the given scope.
 */
export function getActiveComplementaryArea(
	state: Record< string, unknown >,
	scope: string
): string | null | undefined;

export function isComplementaryAreaLoading(
	state: Record< string, unknown >,
	scope: string
): boolean;

/**
 * Returns a boolean indicating if an item is pinned or not.
 *
 * @param {Object} state The store state.
 * @param {string} scope Scope.
 * @param {string} item  Item to check.
 *
 * @return {boolean} True if the item is pinned and false otherwise.
 */
export function isItemPinned(
	state: Record< string, unknown >,
	scope: string,
	item: string
): boolean;

/**
 * Returns a boolean indicating whether a feature is active for a particular
 * scope.
 *
 * @param {Object} state       The store state.
 * @param {string} scope       The scope of the feature (e.g. core/edit-post).
 * @param {string} featureName The name of the feature.
 *
 * @return {boolean} Is the feature enabled?
 */
export function isFeatureActive(
	state: Record< string, unknown >,
	scope: string,
	featureName: string
): boolean;

/**
 * Returns true if a modal is active, or false otherwise.
 *
 * @param {Object} state     The store state.
 * @param {string} modalName A string that uniquely identifies the modal.
 *
 * @return {boolean} Whether the modal is active.
 */
export function isModalActive(
	state: Record< string, unknown >,
	modalName: string
): boolean;
