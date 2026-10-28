// MY GYM London: every email the back end sends, as data. One definition per email.
// Blocks: { p } paragraph, { h } small heading, { kv: [[label, value, optionalVariable]] } details table,
//         { note } highlighted box, { list } bullets, { muted } small grey text. Add `if: "variable"` to show a block only when that variable has a value.
// Variables look like {{first_name}}. Global ones (address, links) are in render.mjs. Nothing here is a secret.
// Wording that depends on a business decision uses a variable, so it is never hard-coded wrongly (see README "To confirm").
// to: member | lead | admin | auth.   marketing: true means it needs the person's marketing consent and carries an unsubscribe link.

const T = [];
const t = (id, o) => T.push({ id, marketing: false, to: "member", ...o });

/* ================= ACCOUNT ================= */
t("welcome", { group: "Account", when: "Right after a member creates their account", subject: "Welcome to MY GYM London, {{first_name}}", pre: "Here is how to book your first class.",
  title: "Welcome to MY GYM London", cta: { label: "Open the app", url: "{{app_url}}" },
  body: [{ p: "Hi {{first_name}}," }, { p: "Your account is ready. Here is how to get started:" }, { list: ["Open the app and tap Timetable to see this week's classes.", "Pick a class or gym hour and tap Book. You get a confirmation straight away.", "Complete your short health form once, so you are ready for your first session."] }, { muted: "Add the app to your phone's home screen for one-tap access: open it in your browser and choose Add to Home Screen." }] });

t("health-form-due", { group: "Account", when: "When a member has not completed or renewed their health form", subject: "Please complete your health form", pre: "It takes about two minutes.",
  title: "A quick health form before you train", cta: { label: "Complete the form", url: "{{app_url}}#profile" },
  body: [{ p: "Hi {{first_name}}," }, { p: "We need an up-to-date health form on file before you can book. It takes about two minutes and helps our coaches keep you safe." }, { note: "Your answers are kept private and only used by the MY GYM London team." }] });

/* ================= BOOKINGS ================= */
t("booking-confirmation", { group: "Bookings", when: "Right after a booking is made", subject: "You're booked: {{class_name}}, {{when}}", pre: "See you there. You can cancel up to {{cancel_minutes}} minutes before.",
  title: "Your booking is confirmed", cta: { label: "View my bookings", url: "{{app_url}}#bookings" },
  body: [{ p: "Hi {{first_name}}," }, { kv: [["Class", "{{class_name}}"], ["When", "{{when}} (UK time)"], ["Coach", "{{coach}}", "coach"], ["Where", "{{gym_address}}"]] }, { muted: "Need to cancel? You can cancel up to {{cancel_minutes}} minutes before it starts. Open the app, go to Bookings and tap Cancel." }] });

t("booking-cancelled", { group: "Bookings", when: "When a member cancels their own booking", subject: "Booking cancelled: {{class_name}}, {{when}}", pre: "Your space has been released.",
  title: "Your booking is cancelled", cta: { label: "Book another class", url: "{{app_url}}#timetable" },
  body: [{ p: "Hi {{first_name}}," }, { p: "We have cancelled your booking and released your space for someone else." }, { kv: [["Class", "{{class_name}}"], ["Was on", "{{when}}"]] }, { muted: "Changed your mind? You can book again any time while spaces are left." }] });

t("class-cancelled-by-gym", { group: "Bookings", when: "When the gym cancels a class that members have booked", subject: "Class cancelled: {{class_name}}, {{when}}", pre: "Sorry about this. Here are your options.",
  title: "We have had to cancel your class", cta: { label: "See other classes", url: "{{app_url}}#timetable" },
  body: [{ p: "Hi {{first_name}}," }, { p: "We are sorry, but we have had to cancel this class:" }, { kv: [["Class", "{{class_name}}"], ["When", "{{when}}"], ["Reason", "{{reason}}", "reason"]] }, { p: "Your booking has been removed and nothing is owed on your side. You can pick another class in the app." }, { muted: "Sorry again for the change. If you have questions, just reply to this email." }] });

t("class-reminder", { group: "Bookings", when: "2 hours before a booked class (sent as an email and as a phone alert)", subject: "Reminder: {{class_name}} at {{time}} today", pre: "Starts at {{time}}. Cancel up to {{cancel_minutes}} minutes before if you cannot make it.",
  title: "Your class is coming up", cta: { label: "View my bookings", url: "{{app_url}}#bookings" },
  body: [{ p: "Hi {{first_name}}," }, { kv: [["Class", "{{class_name}}"], ["Starts", "{{when}}"], ["Coach", "{{coach}}", "coach"], ["Where", "{{gym_address}}"]] }, { muted: "Cannot make it? Please cancel up to {{cancel_minutes}} minutes before, so someone else can take your space." }] });

t("waitlist-joined", { group: "Bookings", when: "When a member joins the waitlist for a full class", subject: "You're on the waitlist: {{class_name}}, {{when}}", pre: "We will book you in automatically if a space opens.",
  title: "You are on the waitlist", cta: { label: "View my waitlist", url: "{{app_url}}#bookings" },
  body: [{ p: "Hi {{first_name}}," }, { p: "{{class_name}} on {{when}} is full right now. You are number {{position}} in line." }, { note: "If someone cancels, we book you in automatically and email you straight away. You do not need to do anything." }] });

t("waitlist-booked", { group: "Bookings", when: "When a waitlisted member is booked in because a space opened", subject: "A space opened: you're booked into {{class_name}}", pre: "You're in. {{when}}.",
  title: "Good news, you are in", cta: { label: "View my bookings", url: "{{app_url}}#bookings" },
  body: [{ p: "Hi {{first_name}}," }, { p: "Someone cancelled, so we have booked you in:" }, { kv: [["Class", "{{class_name}}"], ["When", "{{when}} (UK time)"], ["Where", "{{gym_address}}"]] }, { muted: "Cannot make it any more? Cancel up to {{cancel_minutes}} minutes before, so the next person can have the space." }] });

t("missed-class", { group: "Bookings", when: "The morning after a member booked but did not attend (optional, can be switched off)", subject: "We missed you at {{class_name}}", pre: "No problem, here is how to rebook.",
  title: "We missed you", cta: { label: "Rebook a class", url: "{{app_url}}#timetable" },
  body: [{ p: "Hi {{first_name}}," }, { p: "You were booked into {{class_name}} on {{when}}, but we did not see you. No problem at all, life happens." }, { muted: "If you cannot make a class, cancelling up to {{cancel_minutes}} minutes before helps others get a space." }] });

/* ================= MEMBERSHIP & PAYMENTS ================= */
t("subscription-started", { group: "Membership & payments", when: "When a new membership starts", subject: "Your {{plan_name}} membership has started", pre: "Everything you need to know in one place.",
  title: "Your membership has started", cta: { label: "Book your first class", url: "{{app_url}}#timetable" },
  body: [{ p: "Hi {{first_name}}," }, { p: "Welcome aboard. Your membership is active." }, { kv: [["Plan", "{{plan_name}}"], ["Price", "{{amount}} {{billing_period}}"], ["Started", "{{start_date}}"], ["Next payment", "{{next_payment_date}}"], ["Includes", "{{plan_includes}}", "plan_includes"]] }, { muted: "You can pause or cancel any time from the app, under Profile. {{cancellation_terms}}" }] });

t("payment-receipt", { group: "Membership & payments", when: "After every successful payment", subject: "Your receipt from MY GYM London, {{amount}}", pre: "Payment received, thank you.",
  title: "Payment received", cta: { label: "View my membership", url: "{{app_url}}#profile" },
  body: [{ p: "Hi {{first_name}}," }, { p: "Thank you, we have received your payment." }, { kv: [["Receipt number", "{{receipt_number}}"], ["Date", "{{payment_date}}"], ["Description", "{{plan_name}}, {{billing_period}}"], ["Amount", "{{amount}}"], ["Paid with", "{{payment_method}}"], ["Next payment", "{{next_payment_date}}", "next_payment_date"]] }, { muted: "{{business_legal_name}}. {{vat_line}}" }] });

t("payment-failed-1", { group: "Membership & payments", when: "The day a payment fails (first notice)", subject: "We could not take your payment", pre: "Please update your card so your membership carries on.",
  title: "Your payment did not go through", cta: { label: "Update my card", url: "{{update_payment_url}}" },
  body: [{ p: "Hi {{first_name}}," }, { p: "We tried to take {{amount}} for your {{plan_name}} membership, but the payment was declined." }, { note: "No action is needed if you have already sorted it. Otherwise, please update your card. We will try again on {{retry_date}}." }, { muted: "Common reasons: an expired card, not enough funds, or your bank asking for extra confirmation." }] });

t("payment-failed-2", { group: "Membership & payments", when: "Day 5 after the first failed payment, once the retry has also failed (second reminder)", subject: "Reminder: your payment is still outstanding", pre: "Update your card to keep your membership active.",
  title: "Your payment is still outstanding", cta: { label: "Update my card", url: "{{update_payment_url}}" },
  body: [{ p: "Hi {{first_name}}," }, { p: "We tried again, but we still have not been able to take {{amount}} for your {{plan_name}} membership." }, { p: "Please update your card by {{final_date}} to keep your membership active." }, { muted: "Having a difficult month? Reply to this email and we will help." }] });

t("payment-failed-final", { group: "Membership & payments", when: "Day 14 after the first failed payment (last notice; the membership is paused on day 21)", subject: "Final notice: your membership will be paused on {{final_date}}", pre: "Please update your card today.",
  title: "Final notice before we pause your membership", cta: { label: "Update my card now", url: "{{update_payment_url}}" },
  body: [{ p: "Hi {{first_name}}," }, { p: "We have not been able to take {{amount}} for your {{plan_name}} membership. If it is not resolved by {{final_date}}, your membership will be paused and you will not be able to book." }, { muted: "Once your payment is updated, your membership starts again straight away." }] });

t("card-expiring", { group: "Membership & payments", when: "About 3 weeks before a saved card expires", subject: "Your card is about to expire", pre: "Update it now so your next payment goes through.",
  title: "Your card expires soon", cta: { label: "Update my card", url: "{{update_payment_url}}" },
  body: [{ p: "Hi {{first_name}}," }, { p: "The card we use for your membership ({{card_brand}} ending {{card_last4}}) expires on {{card_expiry}}. Please add a new card so your next payment goes through without a hitch." }] });

t("plan-changed", { group: "Membership & payments", when: "When a member changes plan", subject: "Your membership has changed to {{plan_name}}", pre: "Here is what changes and when.",
  title: "Your plan has been updated", cta: { label: "View my membership", url: "{{app_url}}#profile" },
  body: [{ p: "Hi {{first_name}}," }, { kv: [["New plan", "{{plan_name}}"], ["Price", "{{amount}} {{billing_period}}"], ["Starts", "{{start_date}}"], ["Next payment", "{{next_payment_date}}"]] }] });

t("membership-paused", { group: "Membership & payments", when: "When a membership is paused", subject: "Your membership is paused", pre: "It restarts on {{resume_date}}.",
  title: "Your membership is paused", cta: { label: "Restart early", url: "{{app_url}}#profile" },
  body: [{ p: "Hi {{first_name}}," }, { p: "Your {{plan_name}} membership is paused. You will not be charged while it is paused, and you will not be able to book." }, { kv: [["Paused from", "{{pause_date}}"], ["Restarts", "{{resume_date}}"]] }] });

t("membership-resumed", { group: "Membership & payments", when: "When a paused membership restarts", subject: "Welcome back, {{first_name}}", pre: "Your membership is active again.",
  title: "Your membership is active again", cta: { label: "Book a class", url: "{{app_url}}#timetable" },
  body: [{ p: "Hi {{first_name}}," }, { p: "Great to have you back. Your {{plan_name}} membership is active again. Your next payment is on {{next_payment_date}}." }] });

t("membership-cancelled", { group: "Membership & payments", when: "When a membership is cancelled", subject: "Your membership has been cancelled", pre: "You can keep booking until {{end_date}}.",
  title: "Your membership is cancelled", cta: { label: "Rejoin any time", url: "{{site_url}}memberships" },
  body: [{ p: "Hi {{first_name}}," }, { p: "We are sorry to see you go. Your {{plan_name}} membership has been cancelled." }, { kv: [["Last day of access", "{{end_date}}"], ["Final payment", "{{final_payment}}", "final_payment"]] }, { muted: "{{refund_policy}}" }, { muted: "Anything we could have done better? Reply to this email, we read every message. You are always welcome back." }] });

t("refund-issued", { group: "Membership & payments", when: "When a refund is issued", subject: "Your refund of {{amount}}", pre: "It is on its way to your card.",
  title: "Your refund is on its way", to: "member",
  body: [{ p: "Hi {{first_name}}," }, { p: "We have refunded {{amount}} to your original payment method. {{refund_timing}}" }, { kv: [["Refund for", "{{refund_reason}}", "refund_reason"], ["Date", "{{payment_date}}"]] }] });

t("renewal-reminder", { group: "Membership & payments", when: "7 days before an annual membership renews", subject: "Your annual membership renews on {{renewal_date}}", pre: "No action needed unless you want to change something.",
  title: "Your membership renews soon", cta: { label: "Manage my membership", url: "{{app_url}}#profile" },
  body: [{ p: "Hi {{first_name}}," }, { p: "Your {{plan_name}} membership renews on {{renewal_date}} for {{amount}}. You do not need to do anything." }, { muted: "Want to change plan or cancel before then? You can do it from the app, under Profile." }] });

/* ================= RELATIONSHIP & MARKETING (needs marketing consent) ================= */
t("we-miss-you", { group: "Keep members engaged", marketing: true, when: "30 days after a member's last visit", subject: "We miss you, {{first_name}}", pre: "Your next class is one tap away.",
  title: "We have not seen you for a while", cta: { label: "Book a class", url: "{{app_url}}#timetable" },
  body: [{ p: "Hi {{first_name}}," }, { p: "It has been a few weeks since your last session. Whatever got in the way, we would love to see you back. Even one class this week gets you moving again." }, { muted: "Is something putting you off? Just reply and tell us. We are happy to help." }] });

t("review-request", { group: "Keep members engaged", marketing: true, when: "After a member's 5th class (once)", subject: "Would you rate us, {{first_name}}?", pre: "It takes 30 seconds and helps a small gym a lot.",
  title: "How are we doing?", cta: { label: "Leave a Google review", url: "{{review_url}}" },
  body: [{ p: "Hi {{first_name}}," }, { p: "You have been training with us for a little while now. If you are enjoying it, a short Google review would mean a lot. It helps other people in Enfield find us." }, { muted: "Not happy about something? Reply to this email instead and we will put it right." }] });

t("referral-invite", { group: "Keep members engaged", to: "lead", when: "When a member sends a bring-a-friend invite", subject: "{{referrer_name}} invited you to MY GYM London", pre: "Come and see what we do.",
  title: "{{referrer_name}} thinks you would love it here", cta: { label: "See MY GYM London", url: "{{referral_url}}" },
  body: [{ p: "Hi {{friend_name}}," }, { p: "{{referrer_name}} is a member at MY GYM London and thought of you. Come and see what we do, and try a class with them." }, { muted: "{{referrer_name}} entered your email only to send this invite. We will not email you again unless you join or ask us to." }] });

t("referral-reward", { group: "Keep members engaged", when: "When a referred friend joins", subject: "Thank you: {{friend_name}} joined MY GYM London", pre: "Thank you for spreading the word.",
  title: "Thank you for the referral", cta: { label: "Open the app", url: "{{app_url}}" },
  body: [{ p: "Hi {{first_name}}," }, { p: "{{friend_name}} has joined MY GYM London with your invite. Thank you for spreading the word." }] });

t("milestone", { group: "Keep members engaged", marketing: true, when: "On a member's 10th, 50th and 100th class", subject: "{{count}} classes, {{first_name}}!", pre: "That is worth celebrating.",
  title: "{{count}} classes and counting", cta: { label: "Book your next one", url: "{{app_url}}#timetable" },
  body: [{ p: "Hi {{first_name}}," }, { p: "You have just done your {{count}}th session at MY GYM London. Brilliant consistency. The whole team is proud of you." }] });

t("newsletter", { group: "Campaigns", marketing: true, when: "Base layout for news and offers you send from the Marketing page", subject: "{{campaign_subject}}", pre: "{{campaign_preheader}}",
  title: "{{campaign_title}}", cta: { label: "{{campaign_button}}", url: "{{campaign_url}}" },
  body: [{ p: "Hi {{first_name}}," }, { p: "{{campaign_body}}" }] });

/* ================= PEOPLE WHO USE A WEBSITE FORM (not members yet) ================= */
t("enquiry-autoreply", { group: "Website forms", to: "lead", when: "Right after the contact form is sent", subject: "Thanks for getting in touch", pre: "We will reply within one working day.",
  title: "We have got your message", cta: { label: "See the timetable", url: "{{site_url}}our-classes" },
  body: [{ p: "Hi {{first_name}}," }, { p: "Thanks for contacting MY GYM London. We have your message and will reply within one working day." }, { kv: [["You wrote", "{{message_preview}}", "message_preview"]] }] });

t("pt-enquiry-autoreply", { group: "Website forms", to: "lead", when: "Right after the personal training form is sent", subject: "Thanks for your personal training enquiry", pre: "A coach will be in touch shortly.",
  title: "We have got your enquiry", body: [{ p: "Hi {{first_name}}," }, { p: "Thanks for asking about personal training. One of our coaches will contact you within one working day to talk through your goals and find a time that suits you." }, { muted: "Please do not include anything very private in your reply. We will ask about health details in person." }] });

t("trial-confirmation", { group: "Website forms", to: "lead", when: "When someone books a free trial class", subject: "Your free trial: {{class_name}}, {{when}}", pre: "What to bring and where to go.",
  title: "Your free trial is booked", cta: { label: "Get directions", url: "{{directions_url}}" },
  body: [{ p: "Hi {{first_name}}," }, { kv: [["Class", "{{class_name}}"], ["When", "{{when}} (UK time)"], ["Where", "{{gym_address}}"]] }, { list: ["Arrive about 10 minutes early so we can say hello.", "Wear comfortable clothes and trainers.", "Bring a water bottle."] }, { muted: "Cannot make it? Reply to this email and we will move you." }] });

t("offer-autoreply", { group: "Website forms", to: "lead", when: "Right after a landing-page offer form is sent", subject: "Your enquiry about {{offer_name}}", pre: "Here is what happens next.",
  title: "Thanks, we have got your details", body: [{ p: "Hi {{first_name}}," }, { p: "Thanks for your interest in {{offer_name}}. A member of the team will contact you within one working day to get you started." }, { muted: "{{offer_terms}}", if: "offer_terms" }] });

t("corporate-autoreply", { group: "Website forms", to: "lead", when: "Right after the corporate wellness form is sent", subject: "Thanks for your enquiry about group sessions", pre: "We will come back with a quote.",
  title: "We have got your enquiry", body: [{ p: "Hi {{first_name}}," }, { p: "Thanks for asking about group sessions for {{company}}. We will come back to you within two working days with options and a quote." }] });

t("kids-registration-received", { group: "Website forms", to: "lead", when: "When a parent submits the Kids Gym registration", subject: "We have got {{child_first_name}}'s registration", pre: "What happens next.",
  title: "Kids Gym registration received", body: [{ p: "Hi {{first_name}}," }, { p: "Thanks for registering {{child_first_name}} for Kids Gym. We will check the details and confirm {{child_first_name}}'s place within two working days." }, { note: "Kids can only train with a parent or guardian's consent on file. We keep the details you gave us private and only use them for {{child_first_name}}'s sessions." }] });

t("lead-followup-1", { group: "Website forms", marketing: true, to: "lead", when: "2 days after an enquiry, if they have not booked yet (stops when they join)", subject: "Ready to try a class, {{first_name}}?", pre: "Your first class is on us.",
  title: "Ready when you are", cta: { label: "Book a free trial", url: "{{site_url}}book-a-free-class" },
  body: [{ p: "Hi {{first_name}}," }, { p: "You got in touch with us recently. If you would still like to try MY GYM London, your first class is free. Pick a time that suits you and we will do the rest." }] });

t("lead-followup-2", { group: "Website forms", marketing: true, to: "lead", when: "7 days after an enquiry, if still no booking (last one)", subject: "Last note from us, {{first_name}}", pre: "No pressure, the offer stays open.",
  title: "Still thinking about it?", cta: { label: "Book a free trial", url: "{{site_url}}book-a-free-class" },
  body: [{ p: "Hi {{first_name}}," }, { p: "Just one last note. If now is not the right time, that is fine. Your free trial offer stays open whenever you are ready." }] });

t("newsletter-welcome", { group: "Website forms", marketing: true, to: "lead", when: "When someone joins the email list from the website footer (double opt-in)", subject: "Please confirm your email", pre: "One click to finish signing up.",
  title: "Confirm your email", cta: { label: "Yes, sign me up", url: "{{confirm_url}}" },
  body: [{ p: "Hi {{first_name}}," }, { p: "Please confirm you would like news and offers from MY GYM London. If this was not you, just ignore this email and nothing will happen." }] });

/* ================= SENT TO THE GYM (info@) ================= */
t("admin-new-enquiry", { group: "To the gym", to: "admin", when: "Every time a website form is sent", subject: "New {{form_name}}: {{person_name}}", pre: "{{person_name}} got in touch.",
  title: "New {{form_name}}", cta: { label: "Open in the back end", url: "{{admin_url}}" },
  body: [{ kv: [["From", "{{person_name}}"], ["Email", "{{person_email}}"], ["Phone", "{{person_phone}}", "person_phone"], ["Page", "{{source_page}}", "source_page"]] }, { h: "Message" }, { p: "{{message}}" }, { muted: "Reply to this email to answer them directly." }] });

t("admin-new-member", { group: "To the gym", to: "admin", when: "When a new member joins", subject: "New member: {{person_name}}", pre: "{{plan_name}}",
  title: "A new member has joined", cta: { label: "Open member", url: "{{admin_url}}" },
  body: [{ kv: [["Name", "{{person_name}}"], ["Plan", "{{plan_name}}"], ["Joined from", "{{source_page}}", "source_page"]] }] });

t("admin-payment-failed", { group: "To the gym", to: "admin", when: "When a member's payment fails", subject: "Payment failed: {{person_name}}, {{amount}}", pre: "Retry on {{retry_date}}.",
  title: "A payment failed", cta: { label: "Open payments", url: "{{admin_url}}" },
  body: [{ kv: [["Member", "{{person_name}}"], ["Plan", "{{plan_name}}"], ["Amount", "{{amount}}"], ["Next retry", "{{retry_date}}"]] }, { muted: "The member has already been emailed. Nothing to do unless you want to follow up personally." }] });

t("admin-change-request", { group: "To the gym", to: "admin", when: "When a member asks to pause or cancel through the form", subject: "{{request_type}} request: {{person_name}}", pre: "Please action this within {{sla}}.",
  title: "{{request_type}} request", cta: { label: "Open member", url: "{{admin_url}}" },
  body: [{ kv: [["Member", "{{person_name}}"], ["Request", "{{request_type}}"], ["From", "{{from_date}}", "from_date"], ["Reason", "{{reason}}", "reason"]] }] });

t("admin-new-review", { group: "To the gym", to: "admin", when: "When a member leaves a rating below 4 stars in the feedback form", subject: "Low rating from {{person_name}}: {{rating}} stars", pre: "Worth a personal reply.",
  title: "Feedback worth a look", cta: { label: "Open feedback", url: "{{admin_url}}" },
  body: [{ kv: [["Member", "{{person_name}}"], ["Rating", "{{rating}} out of 5"], ["Class", "{{class_name}}", "class_name"]] }, { h: "They wrote" }, { p: "{{message}}" }] });

/* ================= SIGN-IN EMAILS (sent by Supabase Auth; paste these into Supabase, see README) ================= */
t("auth-reset-password", { group: "Sign-in (Supabase Auth)", to: "auth", auth: true, when: "When a member asks to reset their password", subject: "Reset your MY GYM London password", pre: "This link works for one hour.",
  title: "Reset your password", cta: { label: "Choose a new password", url: "{{ .ConfirmationURL }}" },
  body: [{ p: "Hi," }, { p: "We got a request to reset the password for your MY GYM London account. Tap the button to choose a new one. The link works for one hour." }, { muted: "Did not ask for this? You can safely ignore this email. Your password has not changed." }] });

t("auth-confirm-email-change", { group: "Sign-in (Supabase Auth)", to: "auth", auth: true, when: "When a member changes their email address", subject: "Confirm your new email address", pre: "One tap to confirm.",
  title: "Confirm your new email", cta: { label: "Confirm email", url: "{{ .ConfirmationURL }}" },
  body: [{ p: "Hi," }, { p: "Please confirm this is your new email address for your MY GYM London account." }, { muted: "Did not ask for this? Ignore this email and nothing will change." }] });

t("auth-invite", { group: "Sign-in (Supabase Auth)", to: "auth", auth: true, when: "When you invite a member of staff to the back end", subject: "You have been invited to MY GYM London", pre: "Set up your account.",
  title: "You are invited", cta: { label: "Accept the invitation", url: "{{ .ConfirmationURL }}" },
  body: [{ p: "Hi," }, { p: "You have been invited to the MY GYM London back office. Tap the button to set your password and sign in." }] });

t("auth-magic-link", { group: "Sign-in (Supabase Auth)", to: "auth", auth: true, when: "If you switch on sign-in by email link", subject: "Your MY GYM London sign-in link", pre: "Tap to sign in. It works once.",
  title: "Sign in to MY GYM London", cta: { label: "Sign in", url: "{{ .ConfirmationURL }}" },
  body: [{ p: "Hi," }, { p: "Tap the button to sign in. The link works once and expires soon." }, { muted: "Did not ask for this? Ignore this email." }] });

/* ================= ADDED AFTER THE WIX EMAIL AUDIT (things Wix sends today that we did not have yet) ================= */
t("booking-rescheduled", { group: "Bookings", when: "When a member moves a booking to another session", subject: "Booking moved: {{class_name}}, {{when}}", pre: "Your new time is confirmed.",
  title: "Your booking has moved", cta: { label: "View my bookings", url: "{{app_url}}#bookings" },
  body: [{ p: "Hi {{first_name}}," }, { kv: [["Class", "{{class_name}}"], ["New time", "{{when}} (UK time)"], ["Was", "{{old_when}}", "old_when"], ["Where", "{{gym_address}}"]] }, { muted: "You can still cancel up to {{cancel_minutes}} minutes before it starts." }] });

t("trial-ending", { group: "Membership & payments", when: "3 days before a free trial membership ends", subject: "Your free trial ends on {{end_date}}", pre: "Keep going with one tap.",
  title: "Your free trial ends soon", cta: { label: "Keep my membership", url: "{{app_url}}#profile" },
  body: [{ p: "Hi {{first_name}}," }, { p: "Your free trial of {{plan_name}} ends on {{end_date}}. To carry on training, choose a plan and your first payment of {{amount}} will be taken on {{next_payment_date}}." }, { muted: "Not for you? No action needed. Your trial simply ends and you will not be charged." }] });

t("membership-ended", { group: "Membership & payments", when: "When a fixed-length plan or pass runs out", subject: "Your {{plan_name}} has ended", pre: "Here is how to carry on.",
  title: "Your plan has ended", cta: { label: "See memberships", url: "{{site_url}}memberships" },
  body: [{ p: "Hi {{first_name}}," }, { p: "Your {{plan_name}} ended on {{end_date}}. You can no longer book classes until you start a new plan." }, { muted: "It takes two minutes to restart, and your account and history are exactly as you left them." }] });

t("refer-a-friend-prompt", { group: "Keep members engaged", marketing: true, when: "A few days after a member joins (once)", subject: "Train with a friend, {{first_name}}?", pre: "Bring someone along.",
  title: "Bring a friend, you both win", cta: { label: "Invite a friend", url: "{{site_url}}refer-friends" },
  body: [{ p: "Hi {{first_name}}," }, { p: "Training is easier with someone alongside you. Invite a friend and come along together." }] });

t("admin-new-booking", { group: "To the gym", to: "admin", when: "Each time a booking is made (can be switched to a daily summary)", subject: "New booking: {{person_name}}, {{class_name}} {{when}}", pre: "{{spaces_left}} spaces left.",
  title: "New booking", cta: { label: "Open bookings", url: "{{admin_url}}" },
  body: [{ kv: [["Member", "{{person_name}}"], ["Class", "{{class_name}}"], ["When", "{{when}}"], ["Spaces left", "{{spaces_left}}"], ["Booked from", "{{source_page}}", "source_page"]] }] });

t("admin-overbooked", { group: "To the gym", to: "admin", when: "If a session ever ends up with more people than spaces (for example from a sync clash)", subject: "Overbooked: {{class_name}}, {{when}}", pre: "{{booked}} booked, {{capacity}} spaces.",
  title: "A session is overbooked", cta: { label: "Fix it now", url: "{{admin_url}}" },
  body: [{ kv: [["Class", "{{class_name}}"], ["When", "{{when}}"], ["Booked", "{{booked}}"], ["Spaces", "{{capacity}}"]] }, { muted: "Move or cancel one booking, or add spaces. The people affected have not been told yet." }] });

t("admin-membership-cancelled", { group: "To the gym", to: "admin", when: "When a member cancels their membership", subject: "Membership cancelled: {{person_name}}", pre: "{{plan_name}}",
  title: "A membership was cancelled", cta: { label: "Open member", url: "{{admin_url}}" },
  body: [{ kv: [["Member", "{{person_name}}"], ["Plan", "{{plan_name}}"], ["Last day", "{{end_date}}"], ["Reason", "{{reason}}", "reason"]] }, { muted: "A personal message in the next few days often wins people back." }] });

t("auth-password-changed", { group: "Sign-in (Supabase Auth)", to: "auth", auth: true, when: "After a member changes their password (security notice)", subject: "Your MY GYM London password was changed", pre: "If this was not you, tell us straight away.",
  title: "Your password was changed", body: [{ p: "Hi," }, { p: "This is a confirmation that the password for your MY GYM London account was just changed." }, { note: "Was this not you? Reply to this email straight away and we will secure your account." }] });

export default T;
