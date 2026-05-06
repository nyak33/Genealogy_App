import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMergeService = vi.hoisted(() => ({
  previewProfileMerge: vi.fn(),
  mergeProfiles: vi.fn(),
  ProfileMergeInputError: class ProfileMergeInputError extends Error {
    status = 400;
  },
  ProfileMergeNotFoundError: class ProfileMergeNotFoundError extends Error {
    status = 404;
  },
  ProfileMergeConflictError: class ProfileMergeConflictError extends Error {
    status = 409;
  }
}));

vi.mock("@/lib/services/profile-merge-service", () => mockMergeService);

const { POST: previewPost } = await import(
  "@/app/api/profiles/merge/preview/route"
);
const { POST: mergePost } = await import("@/app/api/profiles/merge/route");

const primaryId = "00000000-0000-4000-8000-000000000001";
const duplicateId = "00000000-0000-4000-8000-000000000002";

function postRequest(body: unknown) {
  return new Request("http://localhost/api/profiles/merge", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("profile merge API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("merge preview API validates UUIDs", async () => {
    const response = await previewPost(
      postRequest({
        primaryId: "not-a-uuid",
        duplicateId
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid merge preview data");
    expect(mockMergeService.previewProfileMerge).not.toHaveBeenCalled();
  });

  it("merge API validates UUIDs", async () => {
    const response = await mergePost(
      postRequest({
        primaryId,
        duplicateId: "not-a-uuid"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid merge data");
    expect(mockMergeService.mergeProfiles).not.toHaveBeenCalled();
  });

  it("merge preview API calls service correctly", async () => {
    mockMergeService.previewProfileMerge.mockResolvedValueOnce({
      primaryProfile: { id: primaryId, fullName: "Primary" },
      duplicateProfile: { id: duplicateId, fullName: "Duplicate" },
      fieldsToCopy: [],
      fieldConflicts: [],
      unchangedFields: [],
      relationshipsToMove: [],
      relationshipsToDeleteAsRedundant: [],
      relationshipsToSkip: [],
      warnings: []
    });

    const response = await previewPost(
      postRequest({
        primaryId,
        duplicateId
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockMergeService.previewProfileMerge).toHaveBeenCalledWith(
      primaryId,
      duplicateId
    );
    expect(payload.preview.primaryProfile.fullName).toBe("Primary");
  });

  it("merge API calls service correctly", async () => {
    mockMergeService.mergeProfiles.mockResolvedValueOnce({
      primaryProfile: { id: primaryId, fullName: "Primary" },
      duplicateProfile: { id: duplicateId, fullName: "Duplicate" },
      fieldsCopied: [],
      fieldConflicts: [],
      relationshipsMoved: [],
      relationshipsDeletedAsRedundant: [],
      relationshipsSkipped: [],
      warnings: []
    });

    const response = await mergePost(
      postRequest({
        primaryId,
        duplicateId
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockMergeService.mergeProfiles).toHaveBeenCalledWith(
      primaryId,
      duplicateId
    );
    expect(payload.mergeResult.duplicateProfile.fullName).toBe("Duplicate");
  });
});
