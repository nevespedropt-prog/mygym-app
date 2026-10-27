// MY GYM London: every form the website and app need, as data. One definition per form.
// Field types: text, email, tel, textarea, select, radio, checkbox-group, date, number, rating, hidden.
// `to` names are emails from ../email-templates/templates.mjs: notify = sent to the gym, autoreply = sent to the person.
// Nothing here is a secret. Wording that needs a business or legal decision is marked in the README ("To confirm").

const PRIVACY = "https://www.mygymlondon.co.uk/privacy";

const name = (id = "full_name", label = "Your name") => ({ id, type: "text", label, required: true, autocomplete: "name", max: 80 });
const email = (label = "Email address") => ({ id: "email", type: "email", label, required: true, autocomplete: "email", max: 120 });
const phone = (required = false, label = "Phone number") => ({ id: "phone", type: "tel", label: label + (required ? "" : " (optional)"), required, autocomplete: "tel", max: 25 });
const message = (label = "How can we help?", required = true, max = 1500) => ({ id: "message", type: "textarea", label, required, max, rows: 5 });
const utm = [{ id: "utm_source", type: "hidden" }, { id: "utm_medium", type: "hidden" }, { id: "utm_campaign", type: "hidden" }, { id: "page_url", type: "hidden" }];

// consent wording: tick boxes are NEVER pre-ticked
const marketing = { id: "marketing", required: false, text: "Send me news and offers from MY GYM London by email. I can unsubscribe at any time." };
const privacyLine = `We use your details only to reply to you. See our <a href="${PRIVACY}">Privacy Notice</a>.`;

const base = { privacy: privacyLine, honeypot: "company_website", minSeconds: 3, rateLimit: { perIpPerHour: 5 }, retentionDays: 730, sensitive: false, requiresLogin: false, consents: [marketing] };
const F = [];
const f = (id, o) => F.push({ id, ...base, ...o });

f("contact", { adminLabel: "website message", title: "Get in touch", intro: "Questions about classes, memberships or anything else? Send us a message and we will reply within one working day.", where: "www: Contact page and footer",
  fields: [name(), email(), phone(), { id: "topic", type: "select", label: "What is it about?", required: true, options: ["Memberships and prices", "Classes and timetable", "Personal training", "Kids Gym", "Something else"] }, message(), ...utm],
  success: "Thanks, we have your message. We will reply within one working day.", notify: "admin-new-enquiry", autoreply: "enquiry-autoreply", pipeline: "new", source: "contact" });

f("pt-enquiry", { adminLabel: "personal training enquiry", title: "Personal training enquiry", intro: "Tell us what you want to achieve and a coach will get in touch to talk it through.", where: "www: Personal Training page",
  fields: [name(), email(), phone(true), { id: "goal", type: "select", label: "Your main goal", required: true, options: ["Lose weight", "Build strength", "Get fitter", "Recover from an injury", "Train for an event", "Something else"] },
    { id: "experience", type: "radio", label: "How would you describe your training so far?", required: true, options: ["New to it", "Some experience", "Experienced"] },
    { id: "times", type: "checkbox-group", label: "Best times for you", required: false, options: ["Mornings", "Daytime", "Evenings", "Weekends"] },
    { id: "health_note", type: "textarea", label: "Anything we should know? (optional)", help: "Only share what you are comfortable with. We will talk through health details in person.", required: false, max: 600, rows: 3 }, ...utm],
  success: "Thanks! A coach will contact you within one working day.", notify: "admin-new-enquiry", autoreply: "pt-enquiry-autoreply", pipeline: "new", source: "pt", sensitive: true,
  privacy: `We use your details only to arrange your training. If you mention health information we use it only to keep you safe in sessions. See our <a href="${PRIVACY}">Privacy Notice</a>.` });

f("trial-class", { adminLabel: "free trial booking", title: "Book a free trial class", intro: "Your first class is on us. Pick a class and we will confirm your place by email.", where: "www: Join page, Instagram link, landing pages",
  fields: [name(), email(), phone(true), { id: "class", type: "select", label: "Which class?", required: true, optionsFrom: "timetable", help: "The list comes from the live timetable." }, { id: "date", type: "date", label: "Which day?", required: true, minDays: 1, maxDays: 30 },
    { id: "experience", type: "radio", label: "Have you trained before?", required: false, options: ["Yes, regularly", "A bit", "Not for a while", "Never"] }, ...utm],
  success: "Thanks! We will confirm your free trial by email shortly.", notify: "admin-new-enquiry", autoreply: "enquiry-autoreply", afterConfirm: "trial-confirmation", pipeline: "trial", source: "trial",
  consents: [marketing, { id: "health_ready", required: true, text: "I am fit to exercise, or I will tell the coach before the class about anything that might affect me." }] });

f("landing-offer", { adminLabel: "offer sign-up", title: "Claim this offer", intro: "Leave your details and we will get you started.", where: "www: landing pages such as /january (one form, the offer name is a hidden field)",
  fields: [name(), email(), phone(true), { id: "offer_name", type: "hidden" }, ...utm],
  success: "Thanks, you are on the list. We will be in touch within one working day.", notify: "admin-new-enquiry", autoreply: "offer-autoreply", pipeline: "new", source: "offer" });

f("corporate-enquiry", { adminLabel: "corporate enquiry", title: "Group sessions for your team", intro: "Tell us about your team and we will come back with options and a quote.", where: "www: Corporate wellness page",
  fields: [name("full_name", "Your name"), { id: "company", type: "text", label: "Company", required: true, max: 100 }, email("Work email"), phone(), { id: "team_size", type: "select", label: "Roughly how many people?", required: true, options: ["Under 10", "10 to 20", "20 to 50", "More than 50"] }, { id: "days", type: "checkbox-group", label: "Preferred days", required: false, options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] }, message("Anything else we should know?", false), ...utm],
  success: "Thanks! We will come back to you within two working days.", notify: "admin-new-enquiry", autoreply: "corporate-autoreply", pipeline: "new", source: "corporate" });

f("kids-registration", { adminLabel: "Kids Gym registration", title: "Kids Gym registration", intro: "For children aged 8 and over, with a parent or guardian's consent. We confirm each place within two working days.", where: "www: Kids Gym page; app: before a first Kids Gym booking",
  fields: [{ id: "parent_name", type: "text", label: "Parent or guardian name", required: true, autocomplete: "name", max: 80 }, email("Parent or guardian email"), phone(true, "Parent or guardian phone"),
    { id: "child_first_name", type: "text", label: "Child's first name", required: true, max: 40 }, { id: "child_last_name", type: "text", label: "Child's last name", required: true, max: 40 }, { id: "child_dob", type: "date", label: "Child's date of birth", required: true, ageMin: 8, ageMax: 17, help: "Kids Gym is for children aged 8 and over." },
    { id: "emergency_name", type: "text", label: "Emergency contact name", required: true, max: 80 }, { id: "emergency_phone", type: "tel", label: "Emergency contact phone", required: true, max: 25 },
    { id: "medical", type: "textarea", label: "Medical conditions, allergies or additional needs (optional)", help: "Only what a coach needs to know to keep your child safe.", required: false, max: 600, rows: 3 }, ...utm],
  consents: [{ id: "parental_responsibility", required: true, text: "I have parental responsibility for this child and I consent to them taking part in Kids Gym sessions." }, { id: "medical_use", required: false, text: "I agree MY GYM London may use the medical information above only to keep my child safe in sessions. (Needed if you have filled in the medical box.)" }, { id: "photos", required: false, text: "I am happy for photos that include my child to be used on MY GYM London's website and social media." }, marketing],
  success: "Thanks! We will confirm your child's place within two working days.", consentIfFilled: { field: "medical", consent: "medical_use", message: "Please tick the box that lets us use the medical information you entered." }, notify: "admin-new-enquiry", autoreply: "kids-registration-received", pipeline: "new", source: "kids", sensitive: true, retentionDays: 365,
  privacy: `We keep your child's details private and use them only for their sessions and for contacting you. See our <a href="${PRIVACY}">Privacy Notice</a>.` });

f("pause-cancel-request", { title: "Pause or cancel my membership", intro: "Tell us what you need and we will sort it. We will confirm by email.", where: "app: Profile, Membership", requiresLogin: true, prefill: ["full_name", "email"],
  fields: [{ id: "request_type", type: "radio", label: "What would you like to do?", required: true, options: ["Pause my membership", "Cancel my membership", "Change my plan"] }, { id: "from_date", type: "date", label: "From which date?", required: true, minDays: 0, maxDays: 90 },
    { id: "reason", type: "select", label: "Mind telling us why? (optional)", required: false, options: ["Moving away", "Cost", "Injury or health", "Not enough time", "Not what I expected", "Other"] }, { id: "message", type: "textarea", label: "Anything else?", required: false, max: 600, rows: 3 }],
  consents: [], success: "Thanks, we have your request and will confirm by email within two working days.", notify: "admin-change-request", autoreply: null, source: "member-request", retentionDays: 1095,
  privacy: `We use this to manage your membership. See our <a href="${PRIVACY}">Privacy Notice</a>.` });

f("feedback", { title: "How was your class?", intro: "Two quick questions. It really helps us improve.", where: "app: after a class; link in the review-request email", requiresLogin: true, prefill: ["full_name", "email"],
  fields: [{ id: "rating", type: "rating", label: "Overall, how was it?", required: true, min: 1, max: 5 }, { id: "class", type: "select", label: "Which class?", required: false, optionsFrom: "recent-classes" }, { id: "message", type: "textarea", label: "Anything we could do better? (optional)", required: false, max: 800, rows: 4 },
    { id: "follow_up", type: "checkbox-group", label: "", required: false, options: ["You can contact me about this"] }],
  consents: [], success: "Thank you for the feedback.", successHigh: "Thank you! If you have a minute, a Google review helps a small gym a lot.", notify: "admin-new-review", notifyWhen: "rating <= 3", autoreply: null, source: "feedback", retentionDays: 730,
  privacy: `We use feedback to improve our classes. See our <a href="${PRIVACY}">Privacy Notice</a>.` });

f("refer-a-friend", { title: "Bring a friend", intro: "Invite a friend to come and see MY GYM London.", where: "app: Profile, Refer a friend", requiresLogin: true, prefill: ["full_name", "email"], rateLimit: { perIpPerHour: 5, perUserPerDay: 5 },
  fields: [{ id: "friend_name", type: "text", label: "Your friend's first name", required: true, max: 40 }, { id: "friend_email", type: "email", label: "Your friend's email", required: true, max: 120 }, { id: "message", type: "textarea", label: "Add a personal note (optional)", required: false, max: 300, rows: 3 }],
  consents: [{ id: "friend_ok", required: true, text: "My friend knows I am sending this invite. They will get one email from MY GYM London and no more unless they join." }], success: "Invite sent! We will let you know when your friend joins.", notify: null, autoreply: null, sendsTo: "referral-invite", source: "referral", retentionDays: 365,
  privacy: `We use your friend's email only to send this one invite. See our <a href="${PRIVACY}">Privacy Notice</a>.` });

f("newsletter-signup", { title: "Get news and offers", intro: "Occasional updates, offers and class news. No spam.", where: "www: footer on every page",
  fields: [{ id: "first_name", type: "text", label: "First name (optional)", required: false, max: 40 }, email(), { id: "page_url", type: "hidden" }],
  consents: [{ id: "marketing", required: true, text: "Yes, send me news and offers from MY GYM London by email. I can unsubscribe at any time." }], success: "Almost done! Please check your email and tap the confirm button.", notify: null, autoreply: null, sendsTo: "newsletter-welcome", doubleOptIn: true, source: "newsletter", retentionDays: 1095,
  privacy: `We will only email you if you confirm. See our <a href="${PRIVACY}">Privacy Notice</a>.` });

export default F;
