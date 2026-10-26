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

## Putting the forms on the website (built 2026-10-26)
`node supabase/forms/build-pages.mjs` writes one standalone page per public form into `app/f/` (contact, pt-enquiry, trial-class, landing-offer, corporate-enquiry, kids-registration, newsletter-signup). Netlify serves them at `https://app.mygymlondon.co.uk/f/<form>.html` and allows only our own website (and the Wix editor) to show them inside a frame.

On Wix today: Add, Embed Code, Embed a Site, paste the page address, set the height below. After the move to Hostinger: paste the form HTML from `html/` straight into the page, or keep the same iframe.

| Form | Address | Height to set |
|---|---|---|
| Contact | /f/contact.html | 900 px |
| Personal training | /f/pt-enquiry.html | 1150 px |
| Free trial | /f/trial-class.html | 1250 px |
| Landing offer | /f/landing-offer.html?offer=January%20offer | 800 px |
| Corporate | /f/corporate-enquiry.html | 1150 px |
| Kids Gym | /f/kids-registration.html | 1700 px |
| Newsletter (footer) | /f/newsletter-signup.html | 600 px |

Also usable as plain links (Instagram bio, ads, QR codes): open the address in a browser. `?utm_source=instagram` style tags are saved with each enquiry. The heights are measured on a desktop; on phones the form is taller, so leave a little spare or use the page's own scroll.

## Server side: done
`submit-form`, `marketing-consent` and `send-email` are live (see `../email-templates/WIRING.md`).

## To confirm
Retention periods, the exact consent wording (a solicitor should read the Kids form and the marketing wording), and who replies to enquiries and within what time (the emails promise one working day).
