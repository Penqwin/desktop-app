### Public API Endpoints

The billing service exposes the following endpoints for invoice management:

#### `POST /v1/invoices`
Generates a new invoice for the specified customer.
- **Payload:** `customer_id` (string), `items` (array of objects), `auto_charge` (boolean, optional).
- **Behavior:** If `auto_charge` is true, the system will immediately attempt to charge the customer's default payment method.

#### `GET /v1/invoices/{id}`
Retrieves details of a specific invoice. Includes the new `tax_breakdown` field in the response which details federal and regional tax amounts.

#### `PUT /v1/invoices/{id}/void`
Voids an unpaid invoice.
- **Warning:** This action is irreversible. A voided invoice cannot be paid or modified.
