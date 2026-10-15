# Booking emails: set up Resend (sender: info@mygymlondon.co.uk)

Nothing sends until every step below is done. Steps 1 to 5 and 7 are yours. Never paste the API key into a chat, a file or the app. It only goes into Supabase Secrets.

What you get: when a member books in the app, they receive a confirmation from `MY GYM London <info@mygymlondon.co.uk>`. Replies go to info@mygymlondon.co.uk. Bookings made on the website get Wix's own email instead, so nobody gets two.

## 1. Create the Resend account
1. Go to resend.com and sign up (use your own email).
2. Check Resend's current free limits on their pricing page. At your size the free plan should be enough, but confirm before relying on it.

## 2. Add your domain
1. In Resend: Domains, then Add Domain.
2. Domain: `mygymlondon.co.uk`.
3. Region: choose Europe (Ireland) if it is offered, to keep data in Europe.
4. Resend now shows a few DNS records to add (usually a DKIM record, plus a mail record and an SPF record on a "send" subdomain). Leave this page open. Copy the values exactly as shown. Do not use any values from this file, because they are different for every account.

## 3. Add the records in Wix
1. Wix dashboard, Domains, find mygymlondon.co.uk, open Manage DNS Records.
2. Add each record Resend shows: the type (TXT, MX or CNAME), the Host/Name, and the Value. In Wix's Host field, enter only the part before `.mygymlondon.co.uk` unless the form says otherwise.
3. Do NOT edit or delete any record that is already there. Those keep the website and your info@ mailbox working.
4. Save.

## 4. Verify
1. Back in Resend, press Verify on the domain.
2. It can take a few minutes, sometimes longer. When it says Verified, go on.
3. If it stays pending after a few hours, send me a screenshot of the records in Wix and the ones in Resend (no keys in it).

## 5. Create the API key
1. Resend: API Keys, Create API Key.
2. Name: `mygym-app`. Permission: Sending access. Domain: mygymlondon.co.uk.
3. Copy the key once. You cannot see it again.

## 6. Put the key in Supabase (you do this, I never see it)
1. Supabase, your project, Edge Functions, Secrets (Manage secrets).
2. Add a secret named `RESEND_API_KEY` with the key as the value. Save.

## 7. Deploy the function
Do it the same way you deployed `sync-timetable`:
1. Create an Edge Function named `send-booking-email`.
2. Files: `supabase/functions/send-booking-email/index.ts` and `email.ts` from the app folder.
3. Verify JWT: OFF (the database calls it with no login, the same as the timetable sync).

## 8. Run the database file
1. Supabase, SQL editor, open `supabase/migration-booking-emails.sql`, run it.
2. It adds a source column to bookings, a log table, and a trigger that asks the function to send the email.
3. A problem with email can never stop a booking: the trigger swallows any error.
4. To switch emails off at any time: `drop trigger if exists booking_email on public.class_bookings;`

## 9. Test with your own account
1. In the app, book one class with an account that has your own email.
2. The email should arrive within a minute. Check spam too.
3. In Supabase, table `email_log` should show that booking as `sent`. If it says `failed`, the `error` column says why. Send me that text.
4. Cancel the test booking in the app.

## Before this goes live for everyone
- I update the privacy page to name Resend as the service that sends booking emails.
- Check Wix's own confirmation emails work for website bookings (book once on the website with your own email).
- Decide if you want a cancellation email too. Not built.
