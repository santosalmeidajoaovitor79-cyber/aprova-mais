// @ts-nocheck
import "@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      success: true,
      plan: {
        title: "Plano teste",
        days: [
          {
            day: "Segunda-feira",
            tasks: [
              {
                subject: "Português",
                time: "1h",
                focus: "Interpretação de texto",
              },
            ],
          },
        ],
      },
    }),
    {
      status: 200,
      headers: corsHeaders,
    }
  );
});