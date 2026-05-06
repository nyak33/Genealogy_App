import { NextResponse } from "next/server";
import {
  mergeProfiles,
  ProfileMergeConflictError,
  ProfileMergeInputError,
  ProfileMergeNotFoundError
} from "@/lib/services/profile-merge-service";
import { profileMergeSchema } from "@/lib/validators/profile-merge";

export async function POST(request: Request) {
  const body = await request.json();
  const result = profileMergeSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Invalid merge data",
        issues: result.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  try {
    const mergeResult = await mergeProfiles(
      result.data.primaryId,
      result.data.duplicateId
    );

    return NextResponse.json({ mergeResult });
  } catch (error) {
    if (
      error instanceof ProfileMergeInputError ||
      error instanceof ProfileMergeNotFoundError ||
      error instanceof ProfileMergeConflictError
    ) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Unable to merge profiles" },
      { status: 500 }
    );
  }
}
