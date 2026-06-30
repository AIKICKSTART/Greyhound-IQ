import { NextResponse } from "next/server";

export async function PUT() {
  return NextResponse.json(
    {
      error: {
        message:
          "Local media uploads are disabled. Use the Supabase Storage signed upload URL returned by /api/media/sign-upload.",
      },
    },
    { status: 410 }
  );
}
