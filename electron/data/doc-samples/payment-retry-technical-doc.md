# Payment Retry & Idempotency

## Overview

The payment retry system handles transient failures in charge processing through exponential backoff scheduling, enforces idempotency on every Stripe API request to prevent duplicate charges, and routes permanently failed charges to a dead-letter queue for durability and manual review.

This system replaces a previous fixed-interval retry mechanism that caused synchronised retry bursts across service instances during Stripe API degradation events, leading to duplicate charge incidents.

---

## Architecture

### Components

**Charge processor** (`internal/charge/processor.go`)  
The central orchestrator for charge execution. Accepts a charge request, delegates retry scheduling to the configured `Scheduler`, generates a deterministic idempotency key per attempt, and invokes the Stripe client. On exhaustion of all retry attempts, the processor publishes the failed charge to the dead-letter queue before returning an error to the caller.

**Exponential backoff scheduler** (`internal/retry/backoff.go`)  
Implements the `Scheduler` interface. Computes a per-attempt delay using the formula:

```
delay = base_delay × multiplier^attempt × (1 ± jitter)
```

Jitter is applied as a uniform random factor in the range `[1 − jitter, 1 + jitter]`. This prevents synchronised retries from multiple service instances hitting the upstream API simultaneously after a shared failure event.

**Stripe client** (`internal/stripe/client.go`)  
Wraps the Stripe HTTP API. Forwards an `Idempotency-Key` header on every charge request. The key is provided by the caller (the charge processor) and scoped to a specific charge attempt, ensuring that any network-level retry of an already-acknowledged request is safely deduplicated on Stripe's side.

**Dead-letter queue publisher** (`internal/charge/dlq.go`)  
Publishes exhausted charge records to a Kafka topic. Each record contains the original charge payload, the terminal error, total attempt count, and a nanosecond-precision timestamp. The publisher is conditionally enabled via `PAYMENT_DLQ_ENABLED` and is a no-op when disabled, allowing staged rollout without requiring the downstream consumer to be in place first.

---

### Request lifecycle

```
Caller
  └─► ChargeProcessor.Process(ctx, charge)
        ├─ Scheduler.Run(ctx, fn, dlq)
        │     ├─ attempt 1: idempotency_key = "{charge_id}-0"
        │     │     └─ stripe.Client.Charge(ctx, charge, key)
        │     ├─ [failure] wait: base × multiplier^1 × (1 ± jitter)
        │     ├─ attempt 2: idempotency_key = "{charge_id}-1"
        │     │     └─ stripe.Client.Charge(ctx, charge, key)
        │     ├─ ...
        │     └─ [max attempts exhausted]
        │           └─ DLQPublisher.Publish(ctx, exhaustedCharge)
        └─ return error
```

On success at any attempt, the scheduler returns immediately and no DLQ record is written.

---

## Public API

### ChargeProcessor

```go
func NewChargeProcessor(
    client StripeClient,
    log    *zap.Logger,
    cfg    *RetryConfig,
) *ChargeProcessor

// Convenience constructor using DefaultRetryConfig().
func NewChargeProcessorDefault(
    client StripeClient,
    log    *zap.Logger,
) *ChargeProcessor
```

`cfg` may be `nil`, in which case `DefaultRetryConfig()` is used. Prefer `NewChargeProcessorDefault` for service wiring where custom retry tuning is not required.

---

### RetryConfig

```go
type RetryConfig struct {
    BaseDelay   time.Duration
    Multiplier  float64
    Jitter      float64  // fractional — e.g. 0.3 = ±30%
    MaxAttempts int
}

func DefaultRetryConfig() *RetryConfig
```

All fields are required when constructing `RetryConfig` directly. `DefaultRetryConfig()` returns values appropriate for production use; see [Configuration](#configuration) for the exact defaults.

---

### DLQPublisher

```go
type DLQPublisher struct { /* ... */ }

func NewDLQPublisher(producer KafkaProducer, topic string) *DLQPublisher
func (d *DLQPublisher) Publish(ctx context.Context, record *ExhaustedCharge) error
```

`ExhaustedCharge` fields:

| Field         | Type        | Description                                               |
| ------------- | ----------- | --------------------------------------------------------- |
| `Charge`      | `*Charge`   | Original charge payload as submitted by the caller.       |
| `Error`       | `error`     | Terminal error from the final attempt.                    |
| `Attempts`    | `int`       | Total number of attempts made, including the initial try. |
| `ExhaustedAt` | `time.Time` | UTC timestamp at the point of exhaustion.                 |

---

### stripe.Client.Charge()

```go
func (c *Client) Charge(
    ctx            context.Context,
    charge         *Charge,
    idempotencyKey string,
) error
```

`idempotencyKey` is forwarded in the `Idempotency-Key` HTTP header. Stripe treats requests with the same key within 24 hours as identical and returns the original response without re-executing the charge. Keys are scoped per attempt by the charge processor and must not be reused across distinct charge intents.

---

## Configuration

All retry parameters are configurable per environment via environment variables. No code change or redeployment of a new binary is required to adjust tuning.

| Config key            | Environment variable       | Type      | Default               | Description                                                                      |
| --------------------- | -------------------------- | --------- | --------------------- | -------------------------------------------------------------------------------- |
| `retry.base_delay_ms` | `PAYMENT_RETRY_BASE_MS`    | `int`     | `200`                 | Initial delay before the first retry, in milliseconds.                           |
| `retry.multiplier`    | `PAYMENT_RETRY_MULTIPLIER` | `float64` | `2.0`                 | Backoff multiplier applied per attempt.                                          |
| `retry.jitter`        | `PAYMENT_RETRY_JITTER`     | `float64` | `0.3`                 | Fractional jitter applied to each computed delay.                                |
| `retry.max_attempts`  | `PAYMENT_RETRY_MAX`        | `int`     | `5`                   | Maximum total attempts including the initial try. Set to `1` to disable retries. |
| —                     | `PAYMENT_DLQ_ENABLED`      | `bool`    | `false`               | Enables the DLQ publisher. Must be `true` in production.                         |
| —                     | `PAYMENT_DLQ_TOPIC`        | `string`  | `payments.charge.dlq` | Kafka topic for dead-letter records. Override only for staging isolation.        |

### Delay schedule (production defaults)

With default configuration, a continuously failing charge follows this delay schedule before being sent to the DLQ:

| Attempt | Nominal delay         | Min (−30% jitter) | Max (+30% jitter) |
| ------- | --------------------- | ----------------- | ----------------- |
| 1       | 200 ms                | 140 ms            | 260 ms            |
| 2       | 400 ms                | 280 ms            | 520 ms            |
| 3       | 800 ms                | 560 ms            | 1,040 ms          |
| 4       | 1,600 ms              | 1,120 ms          | 2,080 ms          |
| 5       | Final — DLQ published |                   |                   |

Total maximum elapsed time before DLQ publication: approximately 6.5 seconds.

> Set `retry.max_attempts` to `1` to disable retries entirely for a given environment. The DLQ publisher still fires on a single failed attempt when enabled.

---

## Idempotency key design

Each charge attempt generates a deterministic idempotency key using the composite:

```
idempotency_key = "{charge_id}-{attempt_number}"
```

This design has the following properties:

- **Same attempt, same key.** If a network error occurs after Stripe has acknowledged the charge but before the response reaches the service, retrying with the same key returns the original response. No duplicate charge is created.
- **Different attempts, different keys.** If an attempt genuinely fails (Stripe returns a non-retriable error), the next attempt uses a distinct key and is treated as a fresh request.
- **Stripe key expiry.** Stripe retains idempotency keys for 24 hours. Charges retried after this window receive a new key and are treated as fresh requests regardless of prior outcomes.

Single-attempt callers (i.e. code that calls `stripe.Client.Charge()` directly without the retry scheduler) should pass `uuid.New().String()` as the key.

---

## Dead-letter queue

### Topic

`payments.charge.dlq`

Topic must be provisioned with a minimum replication factor of 3 in production. Verify before enabling the publisher:

```bash
kafka-topics --describe \
  --topic payments.charge.dlq \
  --bootstrap-server kafka.internal:9092
```

### Message schema

```json
{
  "charge_id": "ch_01HXK9P2R4QV7ZMJ3YBWF6DN0T",
  "tenant_id": "ten_xj4mRk8",
  "amount_cents": 4999,
  "currency": "USD",
  "error": "stripe: card declined — insufficient funds",
  "attempts": 5,
  "exhausted_at": "2026-03-17T14:22:00.000000000Z"
}
```

### Consumer responsibilities

The `billing-service` is the designated consumer of this topic and must implement a reconciliation handler that:

1. Marks the corresponding order as `payment_failed` in its own database.
2. Triggers the customer notification workflow.
3. Exposes the failed charge for manual review in the internal billing dashboard.

The `ops-alerts` consumer must include `payments.charge.dlq` in its watched topic list and alert the on-call payments engineer when the DLQ message rate exceeds zero.

Refer to `billing-service` PR #441 and `ops/runbooks/payment-dlq.md` for implementation and triage procedures.

---

## Observability

Two new Prometheus metrics are emitted by the charge processor on every retry cycle.

| Metric                          | Type      | Labels              | Description                                                      |
| ------------------------------- | --------- | ------------------- | ---------------------------------------------------------------- |
| `payment_charge_retry_total`    | Counter   | `attempt`, `result` | Incremented on each attempt. `result` is `success` or `failure`. |
| `payment_charge_retry_delay_ms` | Histogram | `attempt`           | Observed pre-attempt delay in milliseconds.                      |

Grafana dashboard panels for these metrics are available in `dashboards/payment-retries.json`. Import into the payments observability dashboard before deploying to production.

---

## Deployment

### Prerequisites

The following must be in place before enabling this feature in production:

1. The `payments.charge.dlq` Kafka topic exists with replication factor ≥ 3.
2. `billing-service` PR #441 is deployed and the DLQ consumer is confirmed healthy.
3. The Grafana dashboard has been updated and the `payment_charge_retry_total` counter is visible.

### Environment configuration

Set the following in the production environment config:

```yaml
retry:
  base_delay_ms: 200
  multiplier: 2.0
  jitter: 0.3
  max_attempts: 5

env:
  PAYMENT_DLQ_ENABLED: "true"
  PAYMENT_DLQ_TOPIC: "payments.charge.dlq"
```

### Migration for existing callers

Any service calling `stripe.Client.Charge()` directly must add the `idempotencyKey string` argument. A codemod is available:

```bash
sh scripts/migrate/add-idempotency-key.sh ./...
```

The codemod inserts `uuid.New().String()` for single-attempt callers. Review all modified call sites — callers operating within a retry loop should use `fmt.Sprintf("%s-%d", charge.ID, attempt)` instead.

Any service calling `NewChargeProcessor()` directly must update to the new constructor signature. Replace with `NewChargeProcessorDefault()` unless custom retry tuning is needed.

---

## Testing

The retry scheduler and charge processor are covered by 22 test cases in `internal/retry/backoff_test.go` and `internal/charge/processor_test.go`.

Key scenarios verified:

| Scenario                   | Description                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| Backoff timing             | Delay values at each attempt match the expected formula within jitter bounds.                      |
| Jitter distribution        | 10,000 iterations confirm all observed delays fall within the configured jitter range.             |
| Idempotency key uniqueness | Each attempt within a single charge produces a distinct, deterministic key.                        |
| DLQ on exhaustion          | A charge that fails all attempts produces exactly one DLQ message with correct metadata.           |
| DLQ disabled               | The publisher is a no-op when `PAYMENT_DLQ_ENABLED=false`; no Kafka writes occur.                  |
| Success on retry           | A charge that fails on attempts 1–3 and succeeds on attempt 4 returns nil error with no DLQ write. |
| Context cancellation       | An in-flight retry is cancelled cleanly when the parent context is cancelled.                      |
