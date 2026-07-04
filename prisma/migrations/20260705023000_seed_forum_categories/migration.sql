INSERT INTO "ForumCategory" ("id", "name", "slug", "description", "sortOrder")
VALUES
  ('forum-category-general', 'General Discussion', 'general', 'Talk all things greyhound racing.', 0),
  ('forum-category-form-tips', 'Form & Tips', 'form-tips', 'Share your reads and get feedback.', 10),
  ('forum-category-breeding', 'Breeding', 'breeding', 'Bloodlines, matings, and litters.', 20),
  ('forum-category-marketplace', 'Buy, Sell & Stud', 'marketplace', 'Marketplace chatter.', 30)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "sortOrder" = EXCLUDED."sortOrder";
