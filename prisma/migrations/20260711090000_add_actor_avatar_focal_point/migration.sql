ALTER TABLE "SocialActor"
ADD COLUMN "avatarFocalX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN "avatarFocalY" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

ALTER TABLE "SocialActor"
ADD CONSTRAINT "SocialActor_avatar_focal_x"
CHECK ("avatarFocalX" BETWEEN 0 AND 1) NOT VALID,
ADD CONSTRAINT "SocialActor_avatar_focal_y"
CHECK ("avatarFocalY" BETWEEN 0 AND 1) NOT VALID;

ALTER TABLE "SocialActor"
VALIDATE CONSTRAINT "SocialActor_avatar_focal_x";

ALTER TABLE "SocialActor"
VALIDATE CONSTRAINT "SocialActor_avatar_focal_y";
