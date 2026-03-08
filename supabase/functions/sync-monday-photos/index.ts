import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MONDAY_API_URL = "https://api.monday.com/v2";

interface MondayItem {
  id: string;
  name: string;
  column_values: Array<{
    id: string;
    text: string;
    value: string | null;
  }>;
  assets: Array<{
    id: string;
    name: string;
    public_url: string;
    url: string;
  }>;
}

interface MondayFileCandidate {
  assetId?: string;
  name?: string;
  public_url?: string;
  url?: string;
}

interface ImageDimensions {
  width: number;
  height: number;
}


const DASH_REGEX = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g;

const normalizeBoardText = (value: string) =>
  value
    .toLowerCase()
    .replace(DASH_REGEX, "-")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stemToken = (token: string) => {
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
  return token;
};

const expandShortYearRange = (text: string) =>
  text
    .replace(DASH_REGEX, "-")
    .replace(/\b(20\d{2})\s*[-/]\s*(\d{2})\b/g, (_, start, end2) => {
      const endYear = `${start.slice(0, 2)}${end2}`;
      return `${start}-${end2} ${start}-${endYear} ${start} ${endYear}`;
    });

const boardMatchesSearch = (boardName: string, rawSearch: string) => {
  const search = rawSearch.trim();
  if (!search) return true;

  const normalizedBoard = normalizeBoardText(expandShortYearRange(boardName));
  const normalizedSearch = normalizeBoardText(expandShortYearRange(search));

  if (!normalizedSearch) return true;
  if (normalizedBoard.includes(normalizedSearch)) return true;

  const boardTokens = normalizedBoard.split(" ").filter(Boolean).map(stemToken);
  const searchTokens = normalizedSearch.split(" ").filter(Boolean).map(stemToken);

  if (searchTokens.length === 0) return true;

  return searchTokens.every((token) =>
    boardTokens.some(
      (boardToken) =>
        boardToken === token ||
        boardToken.includes(token) ||
        (token.length >= 4 && token.includes(boardToken))
    )
  );
};

async function mondayQuery(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
  attempt = 0
) {
  const res = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await res.json();
  if (data.errors) {
    const retryInSeconds = data.errors
      .map((error: { extensions?: { retry_in_seconds?: number } }) => error.extensions?.retry_in_seconds)
      .find((value: number | undefined) => typeof value === "number" && value > 0);

    const shouldRetry = data.errors.some(
      (error: { extensions?: { code?: string } }) =>
        error.extensions?.code === "COMPLEXITY_BUDGET_EXHAUSTED" ||
        error.extensions?.code === "RATE_LIMITED"
    );

    // Keep retries short to avoid function request timeouts
    if (shouldRetry && attempt < 3) {
      const waitSeconds = retryInSeconds
        ? Math.min(retryInSeconds, 5)
        : Math.min(2 ** (attempt + 1), 5);
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
      return mondayQuery(token, query, variables, attempt + 1);
    }

    throw new Error(`Monday API error: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

const SIGNATURE_HINTS = [
  "sign",
  "signature",
  "sig",
  "waiver",
  "consent",
  "liability",
  "transport",
  "medical",
  "media",
  "spiritual",
  "counsel",
  "initial",
];

const HEADSHOT_HINTS = ["headshot", "head shot", "photo", "picture", "pic", "profile", "portrait", "avatar"];

const normalizeHintText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const scoreCandidateByName = (candidate: MondayFileCandidate) => {
  const haystack = normalizeHintText(`${candidate.name || ""} ${candidate.public_url || ""} ${candidate.url || ""}`);
  let score = 0;

  for (const hint of HEADSHOT_HINTS) {
    if (haystack.includes(hint)) score += 3;
  }
  for (const hint of SIGNATURE_HINTS) {
    if (haystack.includes(hint)) score -= 6;
  }

  return score;
};

const parseMondayColumnFiles = (columnValue: string | null): MondayFileCandidate[] => {
  if (!columnValue) return [];

  try {
    const parsed = JSON.parse(columnValue);
    const files = Array.isArray(parsed?.files) ? parsed.files : [];
    return files
      .map((file: Record<string, unknown>) => ({
        assetId: typeof file?.assetId === "number" || typeof file?.assetId === "string" ? String(file.assetId) : undefined,
        name: typeof file?.name === "string" ? file.name : undefined,
        public_url: typeof file?.public_url === "string" ? file.public_url : undefined,
        url: typeof file?.url === "string" ? file.url : undefined,
      }))
      .filter((file: MondayFileCandidate) => Boolean(file.assetId || file.public_url || file.url));
  } catch {
    return [];
  }
};

const getPngDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  if (bytes.length < 24) return null;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  if (width <= 0 || height <= 0) return null;
  return { width, height };
};

const getJpegDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) return null;

    const isSof =
      marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3 ||
      marker === 0xc5 || marker === 0xc6 || marker === 0xc7 || marker === 0xc9 ||
      marker === 0xca || marker === 0xcb || marker === 0xcd || marker === 0xce || marker === 0xcf;

    if (isSof && offset + 8 < bytes.length) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      if (width > 0 && height > 0) return { width, height };
      return null;
    }

    offset += 2 + length;
  }

  return null;
};

const getWebpDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  if (bytes.length < 30) return null;
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff !== "RIFF" || webp !== "WEBP") return null;

  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  if (chunk === "VP8X" && bytes.length >= 30) {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return { width, height };
  }

  return null;
};

const getImageDimensions = (contentType: string, imageData: ArrayBuffer): ImageDimensions | null => {
  const bytes = new Uint8Array(imageData);
  if (contentType.includes("png")) return getPngDimensions(bytes);
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return getJpegDimensions(bytes);
  if (contentType.includes("webp")) return getWebpDimensions(bytes);
  return getPngDimensions(bytes) || getJpegDimensions(bytes) || getWebpDimensions(bytes);
};

const isLikelySignatureImage = (dimensions: ImageDimensions | null) => {
  if (!dimensions) return false;
  const ratio = dimensions.width / Math.max(1, dimensions.height);
  return ratio >= 2.3 || dimensions.height <= 140;
};

const buildCandidateUrls = (candidate: MondayFileCandidate, refreshed: MondayFileCandidate | null) => {
  const urls = [candidate.public_url, candidate.url, refreshed?.public_url, refreshed?.url].filter(
    (value): value is string => Boolean(value && value.length > 0)
  );
  return Array.from(new Set(urls));
};

const fetchBestPhotoForCandidate = async (
  candidateUrls: string[],
  authVariants: Array<Record<string, string>>
): Promise<Response | null> => {
  for (const candidateUrl of candidateUrls) {
    for (const headers of authVariants) {
      try {
        const res = await fetch(candidateUrl, {
          headers,
          redirect: "follow",
        });

        if (!res.ok) continue;

        const contentType = (res.headers.get("content-type") || "").toLowerCase();
        if (!contentType.startsWith("image/")) continue;

        return res;
      } catch {
        // try next candidate
      }
    }
  }

  return null;
};

const hasNonSignatureExistingPhoto = async (supabase: ReturnType<typeof createClient>, path: string) => {
  try {
    const { data: existingFile, error } = await supabase.storage
      .from("registration-signatures")
      .download(path);

    if (error || !existingFile) return false;

    const contentType = (existingFile.type || "").toLowerCase();
    if (!contentType.startsWith("image/")) return false;

    const imageData = await existingFile.arrayBuffer();
    if (imageData.byteLength < 500) return false;

    const dims = getImageDimensions(contentType, imageData);
    return !isLikelySignatureImage(dims);
  } catch {
    return false;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mondayToken = Deno.env.get("MONDAY_API_TOKEN");
    if (!mondayToken) {
      return new Response(JSON.stringify({ error: "MONDAY_API_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list_boards";

    // Step 1: List boards so the user can pick the right one
    if (action === "list_boards") {
      // Paginated board listing to avoid Monday.com complexity/rate-limit errors
      const PAGE_SIZE = 50;
      const page = Math.max(1, Number(body.page || 1));
      const search = String(body.search || "").trim();

      const data = await mondayQuery(mondayToken, `{
        boards(limit: ${PAGE_SIZE}, page: ${page}, state: all) {
          id
          name
        }
      }`);

      const rawBoards = (data.boards || []).map((b: { id: string; name: string }) => ({
        ...b,
        items_count: 0,
      }));

      const boards = search
        ? rawBoards.filter((b: { name: string }) => boardMatchesSearch(b.name, search))
        : rawBoards;

      return new Response(JSON.stringify({
        boards,
        page,
        hasMore: rawBoards.length === PAGE_SIZE,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Get board columns to find the photo column
    if (action === "get_columns") {
      const boardId = body.boardId;
      if (!boardId) {
        return new Response(JSON.stringify({ error: "boardId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await mondayQuery(mondayToken, `{
        boards(ids: [${boardId}]) {
          columns {
            id
            title
            type
          }
        }
      }`);
      return new Response(JSON.stringify({ columns: data.boards[0]?.columns || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Sync photos from a specific board
    if (action === "sync_photos") {
      const boardId = body.boardId;
      const photoColumnId = body.photoColumnId;
      const firstNameColumnId = body.firstNameColumnId || null;
      const lastNameColumnId = body.lastNameColumnId || null;

      if (!boardId || !photoColumnId) {
        return new Response(JSON.stringify({ error: "boardId and photoColumnId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get all existing registrations
      const { data: registrations } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name, child_headshot_url, submission_date");

      if (!registrations || registrations.length === 0) {
        return new Response(JSON.stringify({ error: "No registrations found to match against" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch a single batch from Monday board (cursor-based) to avoid request timeouts
      const batchSizeRaw = Number(body.batchSize ?? 20);
      const batchSize = Number.isFinite(batchSizeRaw)
        ? Math.max(5, Math.min(50, Math.floor(batchSizeRaw)))
        : 20;
      const inputCursor = typeof body.cursor === "string" && body.cursor.length > 0 ? body.cursor : null;

      const columnIds = [photoColumnId, firstNameColumnId, lastNameColumnId].filter(
        (id): id is string => Boolean(id)
      );
      const columnValuesArg = columnIds.length
        ? `(ids: [${columnIds.map((id) => `"${id}"`).join(", ")}])`
        : "";

      let allItems: MondayItem[] = [];
      let nextCursor: string | null = null;

      if (inputCursor) {
        const nextPage = await mondayQuery(mondayToken, `{
          next_items_page(limit: ${batchSize}, cursor: "${inputCursor}") {
            cursor
            items {
              id
              name
              column_values${columnValuesArg} {
                id
                text
                value
              }
              assets {
                id
                public_url
                url
              }
            }
          }
        }`);
        const np = nextPage.next_items_page;
        allItems = np?.items || [];
        nextCursor = np?.cursor || null;
      } else {
        const firstPage = await mondayQuery(mondayToken, `{
          boards(ids: [${boardId}]) {
            items_page(limit: ${batchSize}) {
              cursor
              items {
                id
                name
                column_values${columnValuesArg} {
                  id
                  text
                  value
                }
                assets {
                  id
                  public_url
                  url
                }
              }
            }
          }
        }`);

        const page = firstPage.boards[0]?.items_page;
        allItems = page?.items || [];
        nextCursor = page?.cursor || null;
      }

      const results = {
        total_monday_items: allItems.length,
        matched: 0,
        uploaded: 0,
        skipped_no_photo: 0,
        skipped_already_has_photo: 0,
        skipped_no_match: 0,
        errors: [] as string[],
        details: [] as Array<{ mondayName: string; status: string; matchedTo?: string }>,
        next_cursor: nextCursor,
        has_more: Boolean(nextCursor),
      };

      for (const item of allItems) {
        // Extract first/last name from Monday item
        let firstName = "";
        let lastName = "";

        if (firstNameColumnId && lastNameColumnId) {
          firstName = item.column_values.find((c) => c.id === firstNameColumnId)?.text?.trim() || "";
          lastName = item.column_values.find((c) => c.id === lastNameColumnId)?.text?.trim() || "";
        } else {
          // Try to parse from item name (usually "First Last")
          const parts = item.name.trim().split(/\s+/);
          firstName = parts[0] || "";
          lastName = parts.slice(1).join(" ") || "";
        }

        if (!firstName && !lastName) {
          results.skipped_no_match++;
          results.details.push({ mondayName: item.name, status: "no_name" });
          continue;
        }

        // Find photo candidates strictly from the selected file column (no generic asset fallback)
        const photoCol = item.column_values.find((c) => c.id === photoColumnId);
        const parsedFiles = parseMondayColumnFiles(photoCol?.value ?? null);

        if (parsedFiles.length === 0) {
          results.skipped_no_photo++;
          results.details.push({ mondayName: `${firstName} ${lastName}`, status: "no_photo" });
          continue;
        }

        const rankedCandidates = [...parsedFiles]
          .sort((a, b) => scoreCandidateByName(b) - scoreCandidateByName(a));

        // Match to registration
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
        const match = registrations.find(
          (r) =>
            normalize(r.child_first_name) === normalize(firstName) &&
            normalize(r.child_last_name) === normalize(lastName)
        );

        if (!match) {
          results.skipped_no_match++;
          results.details.push({ mondayName: `${firstName} ${lastName}`, status: "no_match" });
          continue;
        }

        results.matched++;

        // Skip if already has a non-signature headshot image
        if (match.child_headshot_url) {
          const hasValidExistingPhoto = await hasNonSignatureExistingPhoto(supabase, match.child_headshot_url);

          if (hasValidExistingPhoto) {
            results.skipped_already_has_photo++;
            results.details.push({
              mondayName: `${firstName} ${lastName}`,
              status: "already_has_photo",
              matchedTo: `${match.child_first_name} ${match.child_last_name}`,
            });
            continue;
          }
        }

        // Download and upload the best headshot candidate from the selected column
        try {
          const baseHeaders = {
            "User-Agent": "Mozilla/5.0",
            Accept: "image/*,*/*;q=0.8",
          };

          const authVariants: Array<Record<string, string>> = [
            { ...baseHeaders, Authorization: `Bearer ${mondayToken}` },
            { ...baseHeaders, Authorization: mondayToken },
            baseHeaders,
          ];

          let uploadedPath: string | null = null;

          for (const candidate of rankedCandidates) {
            if (scoreCandidateByName(candidate) < 0) {
              continue;
            }

            let refreshed: MondayFileCandidate | null = null;
            if (candidate.assetId) {
              try {
                const assetData = await mondayQuery(mondayToken, `{
                  assets(ids: [${candidate.assetId}]) {
                    public_url
                    url
                  }
                }`);
                const freshAsset = assetData?.assets?.[0];
                refreshed = {
                  assetId: candidate.assetId,
                  name: candidate.name,
                  public_url: freshAsset?.public_url,
                  url: freshAsset?.url,
                };
              } catch {
                refreshed = null;
              }
            }

            const candidateUrls = buildCandidateUrls(candidate, refreshed);
            if (candidateUrls.length === 0) {
              continue;
            }

            const imageRes = await fetchBestPhotoForCandidate(candidateUrls, authVariants);
            if (!imageRes) {
              continue;
            }

            const contentType = (imageRes.headers.get("content-type") || "").toLowerCase();
            const imageData = await imageRes.arrayBuffer();

            if (imageData.byteLength < 500 || !contentType.startsWith("image/")) {
              continue;
            }

            const dimensions = getImageDimensions(contentType, imageData);
            if (isLikelySignatureImage(dimensions)) {
              continue;
            }

            const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
            const fileName = `monday_headshot_${match.id}_${Date.now()}.${ext}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("registration-signatures")
              .upload(fileName, imageData, { contentType, upsert: false });

            if (uploadError) {
              results.errors.push(`Upload failed for ${firstName} ${lastName}: ${uploadError.message}`);
              continue;
            }

            const { error: updateError } = await supabase
              .from("youth_registrations")
              .update({ child_headshot_url: uploadData.path })
              .eq("id", match.id);

            if (updateError) {
              results.errors.push(`Update failed for ${firstName} ${lastName}: ${updateError.message}`);
              continue;
            }

            uploadedPath = uploadData.path;
            break;
          }

          if (!uploadedPath) {
            results.skipped_no_photo++;
            results.details.push({
              mondayName: `${firstName} ${lastName}`,
              status: "signature_filtered_or_no_valid_photo",
              matchedTo: `${match.child_first_name} ${match.child_last_name}`,
            });
            continue;
          }

          results.uploaded++;
          results.details.push({
            mondayName: `${firstName} ${lastName}`,
            status: "uploaded",
            matchedTo: `${match.child_first_name} ${match.child_last_name}`,
          });
        } catch (err) {
          results.errors.push(`Error processing ${firstName} ${lastName}: ${String(err)}`);
          results.details.push({ mondayName: `${firstName} ${lastName}`, status: "error" });
        }
      }

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
