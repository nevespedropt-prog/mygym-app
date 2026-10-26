// MY GYM London: the owner's decisions for how the emails behave. One place, so changing a rule never means editing wording.
// Decided with the owner on 2026-10-26. Anything marked TODO is still open (see README "To confirm").

export const SETTINGS = {
  // Failed payment: first notice on the day, two reminders, then pause. Days count from the failed payment.
  failedPayment: {
    steps: [
      { day: 0, email: "payment-failed-1", note: "First notice. We retry the card on day 5." },
      { day: 5, email: "payment-failed-2", note: "Second reminder, after the retry also failed." },
      { day: 14, email: "payment-failed-final", note: "Final notice with the pause date." },
    ],
    retryOnDay: 5,
    pauseOnDay: 21,
    gymAlertEmail: "admin-payment-failed",
  },
  // Class reminders: an email AND the phone alert (members who switched app alerts on keep getting those).
  classReminder: { email: true, push: true, hoursBefore: 2 },
  // How soon we promise to reply to people who write to us.
  replyPromise: "within one working day",
  // Which emails are switched on at launch. Everything not listed as false is on.
  optional: { "we-miss-you": true, "review-request": true, milestone: true, "missed-class": false },
  // When the optional emails fire.
  triggers: { "we-miss-you": { afterDaysWithoutVisit: 30 }, "review-request": { afterClasses: 5, once: true }, milestone: { atClasses: [10, 50, 100] }, "lead-followup-1": { afterDays: 2 }, "lead-followup-2": { afterDays: 7 } },
  // Wording copied from the live Terms (terms.html): cancel with 1 week's notice before the next billing date; refund within 1 month of paying;
  // no refunds for classes or gym sessions; a cancelled pay-as-you-go class becomes a credit.
  terms: { cancelNoticeDays: 7, refundWindowMonths: 1, classCancelMinutes: 10 },
  // Decided 2026-10-26: sole trader, shown on receipts as plain "MyGym London" (owner asked to drop the trading-name wording), not VAT registered (no VAT line on receipts),
  // form data kept 2 years, Kids Gym 1 year (see ../forms/forms.mjs).
  business: { legalType: "sole trader", tradingName: "MyGym London", owner: "Pedro Neves", vatRegistered: false },
  // Google review link set 2026-10-26 (place number checked against the Maps link; the page opens "MyGym London, Main Ave, Enfield EN1 1DS").
  todo: [],
};
export default SETTINGS;
