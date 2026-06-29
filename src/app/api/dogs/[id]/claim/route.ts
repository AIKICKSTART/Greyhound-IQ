import { NextResponse } from "next/server";
import { dogOwnershipClaimSchema } from "@/lib/account-validation";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const parsed = dogOwnershipClaimSchema.parse(await request.json());

    const dog = await prisma.dog.findUnique({ where: { id } });
    if (!dog) throw new Error("dog.not_found");

    const ownership = await prisma.dogOwnership.upsert({
      where: {
        dogId_profileId: {
          dogId: dog.id,
          profileId: current.profileId,
        },
      },
      update: {
        role: parsed.role,
      },
      create: {
        dogId: dog.id,
        profileId: current.profileId,
        role: parsed.role,
        verified: false,
      },
      include: {
        dog: {
          select: {
            id: true,
            name: true,
          },
        },
        profile: true,
      },
    });

    return NextResponse.json({ item: ownership }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not claim dog");
  }
}
