// send-email (HTTP wrapper)
// Accepts: { customer_id, template_name, dynamic_variables, occasion_id?,
//            reminder_type?, attachments? }
import { adminClient, corsHeaders, json, requireServiceRole } from "../_shared/client.ts";
import { sendEmail, SendEmailInput } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authError = requireServiceRole(req);
  if (authError) return authError;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: SendEmailInput;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const result = await sendEmail(adminClient(), body);
  const code = result.status === "failed" ? 502 : 200;
  return json(result, code);
});
