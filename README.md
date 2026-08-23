# Shree Dhelana Shyam Jewellers

Premium jewellery storefront built with Node.js + Express.

Production configuration and the new business features are documented in [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md). Copy `.env.example` values into Render Environment; never commit real credentials.

## Features
- Attractive responsive UI inspired by the supplied jewellery poster
- Gold / Silver product catalogue
- Product filtering and cart
- User registration and login
- Password hashing with bcryptjs
- Order placement with delivery address
- Contact form
- Persistent JSON data storage in `data/store.json`
- Supplied poster image included as the main visual

## Run locally

1. Install Node.js 18+.
2. Open this folder in terminal.
3. Run:
   `npm install`
4. Start:
   `npm start`
5. Open:
   `http://localhost:3000`

## Important
This is a ready-to-run demo/college-project backend. For production, replace the JSON store with a real database, add session/JWT authentication, server-side authorization, payment gateway integration, validation/rate limiting, HTTPS and secure cookies.


## Separate Admin Dashboard

Open:

`http://localhost:3000/admin.html`

Admin features:
- Dashboard statistics
- Add / edit / delete products
- Update prices and discounts
- Manage product purity, category and badges
- Manage orders and change status
- View customer details
- Create / enable / disable / delete offers
- View and delete user messages
- Separate admin login and admin access key
- Storefront link from admin panel

### Production security
For a real deployment, set these environment variables:

`ADMIN_EMAIL`
`ADMIN_PASSWORD`
`ADMIN_KEY`

Do not use the demo credentials in production. For production use, also add a real database, session/JWT authentication, secure cookies, CSRF protection, rate limiting and role-based authorization.


## Admin credentials

Set `ADMIN_USER_ID`, `ADMIN_PASSWORD`, `ADMIN_RECOVERY_CODE` and `ADMIN_KEY` privately in Render Environment. Never publish credentials in GitHub or display them on the login page. Admin Settings can change the User ID, password and recovery code.
