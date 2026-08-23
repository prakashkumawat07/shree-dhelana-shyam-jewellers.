# Production setup

The storefront runs without external credentials using its JSON fallback. For durable production data, configure the following in Render's **Environment** section and redeploy.

## MongoDB Atlas

Create a MongoDB Atlas database, allow the Render network connection, and set `MONGODB_URI` and `MONGODB_DB`. The current release includes the environment contract; migrate the JSON store to MongoDB before accepting real customer orders.

## Cloudinary

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Product image fields already support secure HTTPS image URLs and multiple-image metadata.

## Razorpay

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Use test keys first. A production checkout must create a Razorpay order server-side and verify the payment signature before marking an order Paid.

## Security

Set a long random `ADMIN_KEY` and `JWT_SECRET`. Replace all default admin and recovery credentials in Render. Enable HTTPS, rate limiting, CSRF protection and authenticated customer endpoints before collecting real personal or payment data.

## Features included

- Rich product details, inventory, weight, making charges, sizes, photos and availability
- Low-stock reporting and best-seller reports
- Orders with payment method, coupon, tracking history and cancellation/restocking
- Customer wishlist, profile metadata, saved-address fields and block/unblock control
- Gold/silver rate management
- Coupons, reviews, appointments and custom jewellery requests
- CSV order export
- Razorpay, Cloudinary and MongoDB environment contracts
