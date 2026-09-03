### Configuration

The retry mechanism is highly configurable via environment variables to adapt to different network conditions.

| Variable Name | Type | Default | Description |
|---------------|------|---------|-------------|
| `RETRY_MAX_ATTEMPTS` | Integer | `3` | The maximum number of retry attempts before giving up. |
| `RETRY_BASE_DELAY_MS` | Integer | `100` | The initial delay before the first retry attempt, in milliseconds. |
| `RETRY_BACKOFF_MULTIPLIER` | Float | `1.5` | The multiplier applied to the delay after each failed attempt. |
| `ENABLE_JITTER` | Boolean | `true` | When enabled, adds a ±20% randomized jitter to the calculated delay to prevent thundering herd problems. |

*Note: Modifying these configuration values requires a service restart to take effect.*
