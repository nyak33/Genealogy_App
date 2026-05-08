import { NextResponse } from "next/server";
import {
  ProfileInputError,
  ProfileNotFoundError
} from "@/lib/services/profile-service";
import {
  quickAddRelative,
  QuickAddDuplicateWarningError
} from "@/lib/services/quick-add-relative-service";
import {
  RelationshipConflictError,
  RelationshipInputError,
  RelationshipParentAgeWarningError
} from "@/lib/services/relationship-service";
import {
  quickAddRelativeParamsSchema,
  quickAddRelativeSchema
} from "@/lib/validators/quick-add-relative";

type QuickAddRelativeRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: QuickAddRelativeRouteProps
) {
  const resolvedParams = await params;
  const paramsResult = quickAddRelativeParamsSchema.safeParse(resolvedParams);

  if (!paramsResult.success) {
    return NextResponse.json(
      {
        error: "Invalid profile ID",
        issues: paramsResult.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  const body = await request.json();
  const bodyResult = quickAddRelativeSchema.safeParse(body);

  if (!bodyResult.success) {
    return NextResponse.json(
      {
        error: "Invalid quick-add relative data",
        issues: bodyResult.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  try {
    const result = await quickAddRelative(paramsResult.data.id, bodyResult.data);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof QuickAddDuplicateWarningError) {
      return NextResponse.json(
        {
          error: error.message,
          possibleDuplicates: error.possibleDuplicates
        },
        { status: error.status }
      );
    }

    if (error instanceof RelationshipParentAgeWarningError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          requiresConfirmation: error.requiresConfirmation
        },
        { status: error.status }
      );
    }

    if (
      error instanceof ProfileInputError ||
      error instanceof ProfileNotFoundError ||
      error instanceof RelationshipInputError ||
      error instanceof RelationshipConflictError
    ) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Unable to quick-add relative" },
      { status: 500 }
    );
  }
}
