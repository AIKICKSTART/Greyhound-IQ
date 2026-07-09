-- Seed marketplace categories for general goods + supplier types. Idempotent.
INSERT INTO "MarketplaceCategory" ("id","slug","name","sortOrder","active","createdAt","updatedAt")
VALUES
  (gen_random_uuid()::text,'equipment','Equipment',50,true,now(),now()),
  (gen_random_uuid()::text,'floats-trailers','Floats & Trailers',51,true,now(),now()),
  (gen_random_uuid()::text,'caravans','Caravans',52,true,now(),now()),
  (gen_random_uuid()::text,'supplies','Supplies & Pet Food',53,true,now(),now()),
  (gen_random_uuid()::text,'other','Other',99,true,now(),now())
ON CONFLICT ("slug") DO NOTHING;
