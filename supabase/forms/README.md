# MY GYM London: forms (10 forms)

| Form | Where it lives | Goes to the gym as | Person gets |
|---|---|---|---|
| Contact | Website contact page and footer | `admin-new-enquiry` | `enquiry-autoreply` |
| Personal training enquiry | Website PT page | `admin-new-enquiry` | `pt-enquiry-autoreply` |
| Free trial class | Website join page, Instagram, landing pages | `admin-new-enquiry` | `enquiry-autoreply`, then `trial-confirmation` when you confirm |
| Landing-page offer | Any landing page (offer name is a hidden field) | `admin-new-enquiry` | `offer-autoreply` |
| Corporate wellness | Website corporate page | `admin-new-enquiry` | `corporate-autoreply` |
| Kids Gym registration | Website Kids page; app before a first Kids booking | `admin-new-enquiry` | `kids-registration-received` |
| Pause or cancel my membership | App, Profile (members only) | `admin-change-request` | none (membership emails follow) |
| Feedback after a class | App; link in the review email (members only) | `admin-new-review` when 3 stars or fewer | none (high ratings are pointed to a Google review) |
| Bring a friend | App, Profile (members only) | none | friend gets `referral-invite` |
| Newsletter sign-up | Website footer | none | `newsletter-welcome` (confirm link, double opt-in) |

Already in the app and not repeated here: the health questionnaire and the member sign-up.

## Files
`forms.mjs` (the definitions), `render.mjs` (builds the HTML), `html/*.html` (paste-ready), `forms.css` (the website's look), `forms.js` (small script, no libraries), `test.mjs` (154 checks), `catalog.json`.
Look at every form: open `website-redesign/form-previews/index.html`.

## Built in
Visible labels and screen-reader messages; tick boxes never pre-ticked; marketing is always optional and worded plainly; privacy line with a link on every form; hidden bot trap, minimum time on page, and a limit of 5 submissions per hour per person; dates are limited sensibly (Kids Gym ages 6 to 11); sensitive forms (PT, Kids) keep data no longer than 2 years and ask only for what is needed.

## Still to build (the server side)
1. The `submit-form` function: checks everything again on the server, stores the row in `form_submissions`, sends the two emails, and records marketing consent. Needs your go-ahead to deploy.
2. Apply `../migration-forms-and-consent.sql` (tested in a rolled-back transaction, not applied).
3. Put the form HTML on the new website, and the member forms in the app.

## To confirm
Retention periods, the exact consent wording (a solicitor should read the Kids form and the marketing wording), and who replies to enquiries and within what time (the emails promise one working day).
