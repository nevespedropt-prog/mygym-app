# Running every automatic check (from the `app` folder)

```
node supabase/email-templates/test.mjs
node supabase/forms/test.mjs
node supabase/shared/validate.test.mjs
node --experimental-strip-types --no-warnings supabase/functions/submit-form/logic.test.mjs
node --experimental-strip-types --no-warnings supabase/functions/send-email/logic.test.mjs
```

After editing any email, form or `shared/*.mjs`, run `node supabase/shared/bundle.mjs` first so each function's `lib.js` is up to date.
