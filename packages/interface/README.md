# `@mexp/interface`

Contains a data store à la `@wordpress/interface`.

## API Reference

### Actions

The following set of dispatching action creators are available on the object returned by `wp.data.dispatch( 'media-experiments/interface' )`:

<!-- START TOKEN(Autogenerated actions|src/store/actions.ts) -->

#### closeModal

Returns an action object signalling that the user closed a modal.

_Returns_

-   `CloseModalAction`: Action object.

#### openModal

Returns an action object used in signalling that the user opened a modal.

_Parameters_

-   _name_ `string`: A string that uniquely identifies the modal.

_Returns_

-   `OpenModalAction`: Action object.


<!-- END TOKEN(Autogenerated actions|src/store/actions.ts) -->

### Selectors

The following selectors are available on the object returned by `wp.data.select( 'media-experiments/interface' )`:

<!-- START TOKEN(Autogenerated selectors|src/store/selectors.ts) -->

#### isModalActive

Returns true if a modal is active, or false otherwise.

_Parameters_

-   _state_ `Object`: Global application state.
-   _modalName_ `string`: A string that uniquely identifies the modal.

_Returns_

-   `boolean`: Whether the modal is active.

<!-- END TOKEN(Autogenerated selectors|src/store/selectors.ts) -->