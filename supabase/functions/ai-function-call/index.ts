import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { toolName, parameters, agentId, provider, model } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("AI_GATEWAY_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Executing AI function call", { toolName, parameters });

    // Provider/model resolution for non‑official gateway
    const defaultProvider = (Deno.env.get('AI_PROVIDER_DEFAULT') || 'gemini').toLowerCase();
    const selectedProvider = (provider || defaultProvider).toLowerCase();
    function normalizeModel(p: string, m?: string): string {
      if (m && m.includes('/')) return m;
      if (!m) {
        if (p === 'chatgpt' || p === 'openai') return 'openai/gpt-4o-mini';
        if (p === 'mannus') return 'google/gemini-2.5-flash';
        return 'google/gemini-2.5-flash';
      }
      if (p === 'chatgpt' || p === 'openai') return `openai/${m}`;
      if (p === 'gemini' || p === 'google') return `google/${m}`;
      if (p === 'mannus') return /^gpt/i.test(m) ? `openai/${m}` : `google/${m}`;
      return m;
    }
    const targetModel = normalizeModel(selectedProvider, model);

    // Chamar LLM para executar a função
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that executes function calls. Call the function ${toolName} with the provided parameters.`
          },
          {
            role: "user",
            content: JSON.stringify(parameters)
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: toolName,
              description: `Execute ${toolName} with parameters`,
              parameters: {
                type: "object",
                properties: parameters
              }
            }
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao executar função" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    return new Response(JSON.stringify({ result: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error in ai-function-call:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
