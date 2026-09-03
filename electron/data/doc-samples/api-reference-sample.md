# User Management API

## Overview
The User Management API provides endpoints for managing user profiles, roles, and permissions within an organization. It handles user lifecycle events and integrates with the Auth service to ensure secure access control.

---

## API Reference

The following endpoints are available for user and role management. All requests require a valid JWT bearer token.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/users` | List all users in the organization with optional filtering. | Yes (Admin) |
| `POST` | `/v1/users` | Invite a new user to the organization via email. | Yes (Admin) |
| `GET` | `/v1/users/{id}` | Retrieve detailed profile information for a specific user. | Yes |
| `PATCH` | `/v1/users/{id}` | Update user profile fields (name, avatar, preferences). | Yes (Self/Admin) |
| `DELETE` | `/v1/users/{id}` | Remove a user from the organization (soft-delete). | Yes (Admin) |
| `GET` | `/v1/roles` | List available roles and their associated permissions. | Yes |

---

## Data Models

### User Profile
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Unique identifier for the user. |
| `email` | String | Primary email address used for login and notifications. |
| `full_name` | String | Display name shown in the UI and documentation. |
| `role` | Enum | One of \`ADMIN\`, \`EDITOR\`, or \`VIEWER\`. |
| `status` | Enum | Current account state: \`PENDING\`, \`ACTIVE\`, or \`SUSPENDED\`. |

---

## Implementation Details
The API is built using Next.js Route Handlers. Authorization is enforced at the middleware layer by verifying the JWT and checking the user's role against the required permissions for each route.
