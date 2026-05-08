import { beforeEach, describe, expect, it, vi } from "vitest";

const mockService = vi.hoisted(() => ({
  quickAddRelative: vi.fn()
}));

vi.mock("@/lib/services/quick-add-relative-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/quick-add-relative-service")
  >("@/lib/services/quick-add-relative-service");

  return {
    ...actual,
    quickAddRelative: mockService.quickAddRelative
  };
});

const { POST } = await import(
  "@/app/api/profiles/[id]/quick-add-relative/route"
);
const { QuickAddDuplicateWarningError } = await import(
  "@/lib/services/quick-add-relative-service"
);
const { RelationshipParentAgeWarningError } = await import(
  "@/lib/services/relationship-service"
);

const currentProfileId = "00000000-0000-4000-8000-000000000001";

function request(body: unknown) {
  return new Request(
    `http://localhost/api/profiles/${currentProfileId}/quick-add-relative`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}

function context(id = currentProfileId) {
  return {
    params: Promise.resolve({ id })
  };
}

describe("quick add relative API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns created profile and relationship", async () => {
    mockService.quickAddRelative.mockResolvedValueOnce({
      profile: { id: "profile-created" },
      relationship: { id: "relationship-created" }
    });

    const response = await POST(
      request({
        relationshipType: "father",
        profile: {
          fullName: "New Father"
        }
      }),
      context()
    );

    await expect(response.json()).resolves.toEqual({
      profile: { id: "profile-created" },
      relationship: { id: "relationship-created" }
    });
    expect(response.status).toBe(201);
    expect(mockService.quickAddRelative).toHaveBeenCalledWith(
      currentProfileId,
      expect.objectContaining({
        relationshipType: "father"
      })
    );
  });

  it("preserves duplicate warning response shape", async () => {
    mockService.quickAddRelative.mockRejectedValueOnce(
      new QuickAddDuplicateWarningError([
        {
          id: "duplicate-profile",
          fullName: "New Father",
          dateOfBirth: null,
          dateOfDeath: null
        }
      ])
    );

    const response = await POST(
      request({
        relationshipType: "father",
        profile: {
          fullName: "New Father"
        }
      }),
      context()
    );

    await expect(response.json()).resolves.toEqual({
      error: "Possible duplicate profiles found",
      possibleDuplicates: [
        {
          id: "duplicate-profile",
          fullName: "New Father",
          dateOfBirth: null,
          dateOfDeath: null
        }
      ]
    });
    expect(response.status).toBe(409);
  });

  it("preserves parent age warning response shape", async () => {
    mockService.quickAddRelative.mockRejectedValueOnce(
      new RelationshipParentAgeWarningError(
        "This parent appears unusually young for a biological parent. Please confirm the dates are correct."
      )
    );

    const response = await POST(
      request({
        relationshipType: "father",
        profile: {
          fullName: "Young Father"
        }
      }),
      context()
    );

    await expect(response.json()).resolves.toEqual({
      error:
        "This parent appears unusually young for a biological parent. Please confirm the dates are correct.",
      code: "PARENT_AGE_WARNING",
      requiresConfirmation: true
    });
    expect(response.status).toBe(409);
  });

  it("rejects invalid request bodies", async () => {
    const response = await POST(
      request({
        relationshipType: "father",
        profile: {
          fullName: ""
        }
      }),
      context()
    );

    expect(response.status).toBe(400);
    expect(mockService.quickAddRelative).not.toHaveBeenCalled();
  });
});
