import type { z } from "zod";
import { createAuditLog } from "@/lib/account-service";
import type { CurrentUserProfile } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { reportCreateSchema } from "@/lib/report-validation";

type ReportCreateInput = z.infer<typeof reportCreateSchema>;

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function createReportForUser(
  current: CurrentUserProfile,
  input: ReportCreateInput
) {
  const reportedId = await getReportedUserId(current, input.targetType, input.targetId);
  if (reportedId === current.dbUserId) {
    throw new Error("report.cannot_report_self");
  }

  const duplicateSince = new Date(Date.now() - DUPLICATE_WINDOW_MS);
  const duplicate = await prisma.report.findFirst({
    where: {
      reporterId: current.dbUserId,
      targetType: input.targetType,
      targetId: input.targetId,
      createdAt: { gte: duplicateSince },
    },
  });
  if (duplicate) throw new Error("report.duplicate");

  const report = await prisma.report.create({
    data: {
      reporterId: current.dbUserId,
      reportedId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      description: input.description,
      status: "open",
    },
    include: {
      reporter: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      reported: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "report.create",
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: {
      reportId: report.id,
      reason: input.reason,
      reportedId,
    },
  });

  return report;
}

async function getReportedUserId(
  current: CurrentUserProfile,
  targetType: ReportCreateInput["targetType"],
  targetId: string
) {
  if (targetType === "user") {
    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new Error("report.target_not_found");
    return user.id;
  }

  if (targetType === "profile") {
    const profile = await prisma.profile.findUnique({ where: { id: targetId } });
    if (!profile) throw new Error("report.target_not_found");
    return profile.userId;
  }

  if (targetType === "thread") {
    const thread = await prisma.thread.findUnique({
      where: { id: targetId },
      include: { author: true },
    });
    if (!thread) throw new Error("report.target_not_found");
    return thread.author.userId;
  }

  if (targetType === "post") {
    const post = await prisma.post.findUnique({
      where: { id: targetId },
      include: { author: true },
    });
    if (!post) throw new Error("report.target_not_found");
    return post.author.userId;
  }

  if (targetType === "listing") {
    const listing = await prisma.listing.findUnique({
      where: { id: targetId },
      include: { profile: true },
    });
    if (!listing) throw new Error("report.target_not_found");
    return listing.profile.userId;
  }

  const message = await prisma.message.findFirst({
    where: {
      id: targetId,
      OR: [
        { senderId: current.profileId },
        { recipientId: current.profileId },
      ],
    },
    include: {
      sender: true,
      recipient: true,
    },
  });
  if (!message) throw new Error("report.target_not_found");
  return message.senderId === current.profileId
    ? message.recipient.userId
    : message.sender.userId;
}
