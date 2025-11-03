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
    const { messages, agentId, provider, model } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("AI_GATEWAY_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Starting AI chat with", messages.length, "messages");

    // Provider/model resolution (default to non‑official gateway models)
    const defaultProvider = (Deno.env.get('AI_PROVIDER_DEFAULT') || 'gemini').toLowerCase();
    const selectedProvider = (provider || defaultProvider).toLowerCase();

    function normalizeModel(p: string, m?: string): string {
      // If an explicit fully-qualified model was provided, use it
      if (m && m.includes('/')) return m;
      if (!m) {
        // Fallbacks per provider
        if (p === 'chatgpt' || p === 'openai') return 'openai/gpt-4o-mini';
        // 'mannus' uses the gateway with Gemini flash by default
        if (p === 'mannus') return 'google/gemini-2.5-flash';
        // default 'gemini' (google)
        return 'google/gemini-2.5-flash';
      }
      // Qualify short names
      if (p === 'chatgpt' || p === 'openai') return `openai/${m}`;
      if (p === 'gemini' || p === 'google') return `google/${m}`;
      if (p === 'mannus') {
        // Heuristic: prefix by family if recognizable, else default to Gemini
        return /^gpt/i.test(m) ? `openai/${m}` : `google/${m}`;
      }
      return m;
    }

    const targetModel = normalizeModel(selectedProvider, model);

    // System prompt padrão (pode ser customizado por agente)
    const systemPrompt = "Você é um assistente de vendas profissional. Seu objetivo é qualificar leads, responder perguntas e agendar atendimentos. Seja cordial, objetivo e eficiente.";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(JSON.stringify({ error: "Taxa de requisições excedida. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos na sua workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao comunicar com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Retornar o stream diretamente
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Error in ai-chat:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
