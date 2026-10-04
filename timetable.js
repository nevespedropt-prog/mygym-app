/* ============================================================
   MY GYM London: class timetable (same as www.mygymlondon.co.uk/our-classes).
   NOTE: the live app reads classes from the Supabase `classes` table, not from this file.
   See supabase/migration-real-timetable.sql.
   ============================================================ */
const TIMETABLE = {
  "Monday": [
    { time: "07:00", name: "Cardio n Abs", coach: "", info: "30 min" },
    { time: "07:30", name: "HIIT", coach: "", info: "30 min" },
    { time: "09:00", name: "BoxFit", coach: "", info: "30 min" },
    { time: "09:30", name: "Strength", coach: "", info: "30 min" },
    { time: "10:00", name: "Vitality 50+ Circuit", coach: "", info: "1 hr" },
    { time: "18:00", name: "Cardio n Abs", coach: "", info: "1 hr" },
    { time: "18:30", name: "Pilates", coach: "", info: "1 hr" },
    { time: "19:00", name: "Strength", coach: "", info: "1 hr" }
  ],
  "Tuesday": [
    { time: "09:00", name: "HIIT", coach: "", info: "30 min" },
    { time: "09:30", name: "Cardio n Abs", coach: "", info: "30 min" },
    { time: "18:00", name: "Abs Attack", coach: "", info: "1 hr" }
  ],
  "Wednesday": [
    { time: "07:00", name: "HIIT Glow", coach: "", info: "30 min" },
    { time: "07:30", name: "Cardio n Abs", coach: "", info: "30 min" },
    { time: "09:00", name: "BoxFit", coach: "", info: "30 min" },
    { time: "09:30", name: "Strength", coach: "", info: "30 min" },
    { time: "18:00", name: "Strength", coach: "", info: "1 hr" },
    { time: "19:00", name: "BoxFit", coach: "", info: "30 min" }
  ],
  "Thursday": [
    { time: "09:00", name: "HIIT", coach: "", info: "30 min" },
    { time: "09:30", name: "Cardio n Abs", coach: "", info: "30 min" },
    { time: "18:00", name: "HIIT", coach: "", info: "1 hr" }
  ],
  "Friday": [
    { time: "07:00", name: "Strength", coach: "", info: "30 min" },
    { time: "07:30", name: "Abs Attack", coach: "", info: "30 min" },
    { time: "09:00", name: "Cardio n Abs", coach: "", info: "30 min" },
    { time: "09:30", name: "Strength", coach: "", info: "30 min" },
    { time: "10:00", name: "Vitality 50+ Circuit", coach: "", info: "1 hr" },
    { time: "18:30", name: "Body Conditioning", coach: "", info: "1 hr" },
    { time: "19:00", name: "Body Conditioning", coach: "", info: "1 hr" }
  ],
  "Saturday": [
    { time: "10:00", name: "Strength", coach: "", info: "1 hr" }
  ],
  "Sunday": [
    { time: "09:00", name: "Strength", coach: "", info: "1 hr" }
  ]
};
