/* ============================================================
   MY GYM London — class timetable
   EDIT THIS FILE to change what members see. Keep the format:
   Day: [ {time, name, coach, info}, ... ]
   The app picks this up automatically (online users get updates
   on their next open thanks to the service worker).
   ============================================================ */
const TIMETABLE = {
  "Monday": [
    { time: "07:00", name: "Morning Blast",   coach: "Team MY GYM", info: "45 min full-body class" },
    { time: "09:30", name: "Over 50s Strength & Mobility", coach: "", info: "gentle, friendly, effective" },
    { time: "18:00", name: "Circuit Training", coach: "", info: "all levels" },
    { time: "19:00", name: "Small Group PT",   coach: "", info: "max 4 people" }
  ],
  "Tuesday": [
    { time: "07:00", name: "Sunrise HIIT",     coach: "", info: "30 min, coffee after" },
    { time: "16:30", name: "Kids Class",       coach: "", info: "ages 6–11, fun first" },
    { time: "18:30", name: "Gym + Classes Open Session", coach: "", info: "coach on floor" }
  ],
  "Wednesday": [
    { time: "07:00", name: "Morning Blast",    coach: "", info: "45 min full-body class" },
    { time: "09:30", name: "Over 50s Circuit", coach: "", info: "strength + balance" },
    { time: "18:00", name: "Boxing Fit",       coach: "", info: "no contact, all fitness levels" },
    { time: "19:00", name: "1-2-1 PT slots",   coach: "", info: "book at reception" }
  ],
  "Thursday": [
    { time: "07:00", name: "Sunrise HIIT",     coach: "", info: "30 min" },
    { time: "16:30", name: "Kids Class",       coach: "", info: "ages 6–11" },
    { time: "18:30", name: "Strength Basics",  coach: "", info: "perfect for beginners" }
  ],
  "Friday": [
    { time: "07:00", name: "Morning Blast",    coach: "", info: "45 min" },
    { time: "09:30", name: "Over 50s Class",   coach: "", info: "finish the week strong" },
    { time: "17:30", name: "Friday Finisher",  coach: "", info: "team workout, great vibes" }
  ],
  "Saturday": [
    { time: "09:00", name: "Weekend Warrior",  coach: "", info: "60 min mixed class" },
    { time: "10:30", name: "Family Session",   coach: "", info: "bring the kids" }
  ],
  "Sunday": []
};
