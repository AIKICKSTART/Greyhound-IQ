import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const item = await prisma.memoryEntry.findFirst({
      where: { id, userId: current.dbUserId, deletedAt: null },
    });
    if (!item) throw new Error("memory.not_found");

    await prisma.memoryEntry.update({
      where: { id: item.id },
      data: { lastAccessedAt: new Date(), accessCount: { increment: 1 } },
    });

    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not load memory");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const existing = await prisma.memoryEntry.findFirst({
      where: { id, userId: current.dbUserId, deletedAt: null },
    });
    if (!existing) throw new Error("memory.not_found");

    const item = await prisma.memoryEntry.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not delete memory");
  }
}
