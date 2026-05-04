import { NextResponse } from "next/server";
import {
  createProfile,
  findPossibleDuplicateProfiles,
  listProfiles
} from "@/lib/services/profile-service";
import { createProfileSchema } from "@/lib/validators/profile";

export async function GET() {
  const profiles = await listProfiles();

  return NextResponse.json({ profiles });
}

export async function POST(request: Request) {
  const body = await request.json();
  const result = createProfileSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Invalid profile data",
        issues: result.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  try {
    if (!result.data.confirmCreateDifferentPerson) {
      const possibleDuplicates = await findPossibleDuplicateProfiles({
        fullName: result.data.fullName,
        dateOfBirth: result.data.dateOfBirth,
        dateOfDeath: result.data.dateOfDeath
      });

      if (possibleDuplicates.length > 0) {
        return NextResponse.json(
          {
            error: "Possible duplicate profiles found",
            possibleDuplicates
          },
          { status: 409 }
        );
      }
    }

    const profile = await createProfile(result.data);

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create profile";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
