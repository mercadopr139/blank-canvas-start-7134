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

        // Find photo in the file column
        const photoCol = item.column_values.find((c) => c.id === photoColumnId);
        let photoUrl: string | null = null;

        // First priority: parse the specific photo column JSON
        if (photoCol?.value) {
          try {
            const parsed = JSON.parse(photoCol.value);
            const file = parsed?.files?.[0];
            if (file?.public_url || file?.url) {
              photoUrl = file.public_url || file.url;
            }
          } catch {
            // not JSON, continue to fallback
          }
        }

        // Fallback: use item assets only if no photo found in specific column
        if (!photoUrl && item.assets?.length) {
          const asset = item.assets[0];
          photoUrl = asset.public_url || asset.url;
        }

        if (!photoUrl) {
          results.skipped_no_photo++;
          results.details.push({ mondayName: `${firstName} ${lastName}`, status: "no_photo" });
          continue;
        }

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

        // Skip if already has a valid image photo; replace if stored file is broken/non-image
        if (match.child_headshot_url) {
          let hasValidExistingPhoto = false;
          try {
            const { data: existingObject } = await supabase
              .schema("storage")
              .from("objects")
              .select("metadata")
              .eq("bucket_id", "registration-signatures")
              .eq("name", match.child_headshot_url)
              .maybeSingle();

            const metadata = existingObject?.metadata as { mimetype?: string; size?: number; contentLength?: number } | null;
            const existingMime = (metadata?.mimetype || "").toLowerCase();
            const existingSize = Number(metadata?.size ?? metadata?.contentLength ?? 0);

            hasValidExistingPhoto = existingMime.startsWith("image/") && existingSize > 500;
          } catch {
            hasValidExistingPhoto = false;
          }

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

        // Download and upload the photo
        try {
          const candidateUrls = [photoUrl];

          // Refresh asset URLs from Monday when available
          if (item.assets?.length) {
            const assetId = item.assets[0].id;
            try {
              const assetData = await mondayQuery(mondayToken, `{
                assets(ids: [${assetId}]) {
                  public_url
                  url
                }
              }`);
              const freshAsset = assetData?.assets?.[0];
              const refreshed = [freshAsset?.public_url, freshAsset?.url]
                .filter((u): u is string => Boolean(u));
              for (const u of refreshed) {
                if (!candidateUrls.includes(u)) candidateUrls.push(u);
              }
            } catch {
              // ignore refresh errors
            }
          }

          const baseHeaders = {
            "User-Agent": "Mozilla/5.0",
            Accept: "image/*,*/*;q=0.8",
          };

          // Monday asset endpoints can behave differently; try Bearer, raw token, and no auth.
          const authVariants: Array<Record<string, string>> = [
            { ...baseHeaders, Authorization: `Bearer ${mondayToken}` },
            { ...baseHeaders, Authorization: mondayToken },
            baseHeaders,
          ];

          let imageRes: Response | null = null;

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

                imageRes = res;
                break;
              } catch {
                // try next attempt
              }
            }

            if (imageRes) break;
          }

          if (!imageRes) {
            results.errors.push(`Failed to download photo for ${firstName} ${lastName}`);
            results.details.push({ mondayName: `${firstName} ${lastName}`, status: "download_failed", matchedTo: `${match.child_first_name} ${match.child_last_name}` });
            continue;
          }

          const contentType = (imageRes.headers.get("content-type") || "").toLowerCase();
          const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
          const imageData = await imageRes.arrayBuffer();

          if (imageData.byteLength < 100) {
            results.errors.push(`Downloaded file too small for ${firstName} ${lastName}`);
            continue;
          }

          const fileName = `monday_headshot_${match.id}_${Date.now()}.${ext}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("registration-signatures")
            .upload(fileName, imageData, { contentType, upsert: false });

          if (uploadError) {
            results.errors.push(`Upload failed for ${firstName} ${lastName}: ${uploadError.message}`);
            results.details.push({ mondayName: `${firstName} ${lastName}`, status: "upload_failed", matchedTo: `${match.child_first_name} ${match.child_last_name}` });
            continue;
          }

          // Update registration
          await supabase
            .from("youth_registrations")
            .update({ child_headshot_url: uploadData.path })
            .eq("id", match.id);

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
