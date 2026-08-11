-- Switched checkout from Lemon Squeezy to direct Stripe — rename the
-- order-provider-id column to match. Run this in the Supabase SQL editor
-- after 0001_init.sql.

alter table orders rename column lemon_squeezy_order_id to stripe_session_id;
