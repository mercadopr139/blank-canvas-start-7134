// Send the per-conversation "important message" email blast.
//
// Triggered by the message board UI immediately after a message is
// inserted with is_important=true. Looks up the conversation, members,
// and sender, then emails every member except the sender via Resend.
//
// Phase 2 (reply-by-email) is intentionally not built yet. The from/
// reply_to is a simple address today; when we move to inbound parsing,
// the only change here is swapping in a per-conversation reply token.

import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGO_URL = "https://rkdkmzjontaufbyjbcku.supabase.co/storage/v1/object/public/email-assets/nla-logo.png";
const APP_URL = "https://nolimitsboxingacademy.org";
const FROM_ADDRESS = "No Limits Academy <joshmercado@nolimitsboxingacademy.org>";

const PILLAR_COLOR: Record<string, string> = {
  operations: "#bf0f3e",
  sales_marketing: "#22c55e",
  finance: "#38bdf8",
};

const PILLAR_LABEL: Record<string, string> = {
  operations: "Operations",
  sales_marketing: "Sales & Marketing",
  finance: "Finance",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

interface EmailArgs {
  recipientName: string;
  senderName: string;
  conversationTitle: string;
  conversationId: string;
  pillar: string;
  isGroup: boolean;
  messageContent: string;
}

function renderEmailHtml({
  recipientName,
  senderName,
  conversationTitle,
  conversationId,
  pillar,
  isGroup,
  messageContent,
}: EmailArgs): string {
  const accent = PILLAR_COLOR[pillar] || "#bf0f3e";
  const pillarLabel = PILLAR_LABEL[pillar] || "Operations";
  const openLink = `${APP_URL}/admin/message-board?conv=${conversationId}`;
  const firstName = recipientName.split(" ")[0] || recipientName;
  const contextLine = isGroup
    ? `in the group <strong>${escapeHtml(conversationTitle)}</strong>`
    : `regarding <strong>${escapeHtml(conversationTitle)}</strong>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Important Message — ${escapeHtml(conversationTitle)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Letterhead -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #e5e7eb;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 14px;" width="56">
                    <img src="${LOGO_URL}" alt="" width="48" style="display: block; width: 48px; height: auto; max-width: 48px; border: 0; outline: none;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <p style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: 700; color: #111827; letter-spacing: 0.3px;">No Limits Academy</p>
                    <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #9ca3af;">Message Board</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Important badge + title -->
          <tr>
            <td style="padding: 32px 32px 12px 32px;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 18px;">
                <tr>
                  <td style="background-color: ${accent}; padding: 5px 12px; border-radius: 999px;">
                    <span style="font-family: Arial, Helvetica, sans-serif; font-size: 10px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 1.5px;">Important · ${escapeHtml(pillarLabel)}</span>
                  </td>
                </tr>
              </table>

              <h1 style="margin: 0 0 8px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #111827; line-height: 1.3;">
                ${escapeHtml(senderName)} flagged a message as important.
              </h1>
              <p style="margin: 0 0 24px 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #6b7280;">
                Hi ${escapeHtml(firstName)} — ${escapeHtml(senderName)} sent you an important message ${contextLine}.
              </p>
            </td>
          </tr>

          <!-- Message body -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color: #fafafa; border-left: 4px solid ${accent}; border-radius: 6px; padding: 18px 22px;">
                    <p style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.7; color: #374151; white-space: pre-wrap;">${escapeHtml(messageContent)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 32px 32px 32px;" align="center">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color: ${accent}; border-radius: 10px;">
                    <a href="${openLink}" style="display: inline-block; padding: 14px 28px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none;">
                      Open in Message Board →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 14px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #9ca3af;">
                Or paste this into your browser:<br/>
                <a href="${openLink}" style="color: #9ca3af; word-break: break-all;">${openLink}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 18px 32px; border-top: 1px solid #e5e7eb; background-color: #fafafa; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #9ca3af;">
                You're receiving this because someone flagged a message to you as important on the No Limits Academy Message Board.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

interface SendBody {
  message_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body: SendBody = await req.json();
    if (!body.message_id) {
      throw new Error("message_id required");
    }

    // Pull the message and verify the caller is the sender.
    const { data: msg, error: msgErr } = await supabase
      .from("mb_messages")
      .select("id, conversation_id, sender_id, content, is_important")
      .eq("id", body.message_id)
      .single();
    if (msgErr || !msg) throw new Error("Message not found");
    if (msg.sender_id !== user.id) throw new Error("Only the sender can fire the important email");
    if (!msg.is_important) throw new Error("Message is not marked important");

    // Conversation context (title, pillar, group flag).
    const { data: conv, error: convErr } = await supabase
      .from("mb_conversations")
      .select("id, name, is_group, pillar")
      .eq("id", msg.conversation_id)
      .single();
    if (convErr || !conv) throw new Error("Conversation not found");

    // All members.
    const { data: members } = await supabase
      .from("mb_conversation_members")
      .select("user_id")
      .eq("conversation_id", msg.conversation_id);

    const recipientUserIds = (members || [])
      .map((m) => m.user_id)
      .filter((id) => id !== msg.sender_id);

    if (recipientUserIds.length === 0) {
      // Nothing to do — message saved fine, just no one to notify.
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Sender + recipient names/emails from staff_profiles.
    const allUserIds = [msg.sender_id, ...recipientUserIds];
    const { data: profiles } = await supabase
      .from("staff_profiles")
      .select("user_id, full_name, email")
      .in("user_id", allUserIds);

    const profileMap = new Map<string, { full_name: string; email: string }>();
    (profiles || []).forEach((p) => {
      profileMap.set(p.user_id, { full_name: p.full_name, email: p.email });
    });

    const sender = profileMap.get(msg.sender_id);
    const senderName = sender?.full_name || "A teammate";

    // For DMs the subject reads "Important Message — {sender name}"; for
    // groups it reads "Important Message — {group title}".
    const subjectTitle = conv.is_group
      ? (conv.name?.trim() || "Untitled conversation")
      : senderName;
    const subject = `Important Message — ${subjectTitle}`;
    const conversationTitle = conv.name?.trim() || "Untitled conversation";

    // Send in parallel. Each email is independent — one failure does not
    // block the rest. We collect outcomes for the response.
    const results = await Promise.allSettled(
      recipientUserIds.map(async (rid) => {
        const recipient = profileMap.get(rid);
        if (!recipient?.email) {
          return { user_id: rid, status: "no_email" as const };
        }
        const html = renderEmailHtml({
          recipientName: recipient.full_name,
          senderName,
          conversationTitle,
          conversationId: conv.id,
          pillar: conv.pillar,
          isGroup: conv.is_group,
          messageContent: msg.content,
        });
        const r = await resend.emails.send({
          from: FROM_ADDRESS,
          to: [recipient.email],
          subject,
          html,
        });
        if (r.error) {
          return { user_id: rid, status: "failed" as const, error: r.error.message };
        }
        return { user_id: rid, status: "sent" as const };
      })
    );

    const sentCount = results.filter(
      (r) => r.status === "fulfilled" && (r.value as { status: string }).status === "sent"
    ).length;
    const failures = results
      .map((r, i) => ({ recipient: recipientUserIds[i], outcome: r }))
      .filter(({ outcome }) => outcome.status === "rejected"
        || (outcome.status === "fulfilled" && (outcome.value as { status: string }).status !== "sent"));

    return new Response(JSON.stringify({
      success: true,
      sent: sentCount,
      attempted: recipientUserIds.length,
      failures: failures.length > 0 ? failures : undefined,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    console.error("send-important-message error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
