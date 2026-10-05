-- MY GYM London - migration: balance lunch and dinner recipes
-- 64 of the 77 starter recipes were marked dinner and only 13 lunch. This moves 25 lighter, quicker or
-- portable ones (wraps, salads, soups, bowls, tacos, burritos, sandwiches, burgers) to lunch, so the
-- Recipes tab shows about 38 lunch and 39 dinner. Paste into Supabase SQL Editor -> Run (safe to re-run).
-- Meal plans are not affected: each plan slot keeps its own meal type.

update public.recipes set meal_type = 'lunch' where meal_type = 'dinner' and name in (
  'Southwest tortellini pasta salad',
  'Hummus and edamame veggie wrap',
  'Chicken, bacon and avocado wrap',
  'Chicken caesar wrap',
  'Loaded taco salad',
  'Creamy tomato tortellini soup',
  'Chicken dumpling soup',
  'Chicken and matzo ball soup',
  'Beef and cabbage roll soup',
  'Quinoa nourish bowl',
  'Salmon rice bowl',
  'Street corn chicken rice bowl',
  'Walking taco bowl',
  'Mediterranean turkey meatball bowl',
  'Black bean and beef tostadas',
  'Lean carne asada tacos',
  'Mushroom and black bean tacos',
  'Salmon tacos with crunchy slaw',
  'Lean ground beef tacos',
  'Green chile chicken burritos',
  'BBQ pulled pork sandwich with pineapple slaw',
  'Turkey sloppy joes',
  'Beef gyros with tzatziki',
  'Smash burger with tomato and lettuce',
  'Ham and egg fried rice'
);
