-- MY GYM London - optional tidy-up: stop logged-out and signed-in visitors being able to call the two
-- trigger functions directly. They only ever run as triggers (bookings, new accounts), so nothing in the
-- app depends on that permission. NOT RUN YET: the owner runs this one in Supabase -> SQL Editor.
--
-- After running it, book and cancel one class in the app (as a member) and create-account is unaffected
-- because accounts are only made by the member-signup function. Undo if anything misbehaves:
--   grant execute on function public.enforce_booking_rules(), public.handle_new_user() to anon, authenticated;

revoke execute on function public.enforce_booking_rules(), public.handle_new_user() from public, anon, authenticated;
