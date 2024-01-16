# Warning

Utility for logging messages to the console.

## API

### warn

Shows a warning with `message` if environment is not `production`.

```js
import { warn } from '@mexp/log';

function MyComponent( props ) {
  if ( ! props.title ) {
    warn( '`props.title` was not passed' );
  }
  ...
}
```
