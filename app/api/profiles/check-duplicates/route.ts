import { NextResponse } from "next/server";
import { findPossibleDuplicateProfiles } from "@/lib/services/profile-service";
import { duplicateCheckSchema } from "@/lib/validators/profile";

export async function POST(request: Request) {
  const body = await request.json();
  const result = duplicateCheckSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Invalid duplicate check data",
        issues: result.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  try {
    const possibleDuplicates = await findPossibleDuplicateProfiles(result.data);

    return NextResponse.json({ possibleDuplicates });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to check possible duplicates";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
