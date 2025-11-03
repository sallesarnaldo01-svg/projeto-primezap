import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadPreferences, tenantId, limit = 5 } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar imóveis disponíveis
    let query = supabaseClient
      .from('properties')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'available');

    if (leadPreferences.propertyType && leadPreferences.propertyType !== 'unknown') {
      query = query.eq('type', leadPreferences.propertyType);
    }

    if (leadPreferences.transactionType && leadPreferences.transactionType !== 'unknown') {
      query = query.in('transaction_type', [leadPreferences.transactionType, 'both']);
    }

    if (leadPreferences.priceRange) {
      if (leadPreferences.transactionType === 'rent' && leadPreferences.priceRange.max) {
        query = query.lte('rent_price', leadPreferences.priceRange.max);
      } else if (leadPreferences.priceRange.max) {
        query = query.lte('price', leadPreferences.priceRange.max);
      }
    }

    if (leadPreferences.location?.city) {
      query = query.eq('city', leadPreferences.location.city);
    }

    if (leadPreferences.bedrooms) {
      query = query.gte('bedrooms', leadPreferences.bedrooms);
    }

    const { data: properties, error } = await query.limit(20);

    if (error) {
      throw error;
    }

    if (!properties || properties.length === 0) {
      return new Response(JSON.stringify({ recommendations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Usar IA para ranquear e recomendar os melhores imóveis
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `Você é um especialista em recomendação de imóveis.
Analise as preferências do cliente e ranqueie os imóveis do mais adequado ao menos adequado.
Considere: tipo, preço, localização, características e score de match.
Retorne os top ${limit} imóveis com score de compatibilidade e motivos da recomendação.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Preferências do cliente: ${JSON.stringify(leadPreferences, null, 2)}\n\nImóveis disponíveis: ${JSON.stringify(properties, null, 2)}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "recommend_properties",
              description: "Recomenda imóveis baseado nas preferências do cliente",
              parameters: {
                type: "object",
                properties: {
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        propertyId: { type: "string" },
                        matchScore: { 
                          type: "number",
                          minimum: 0,
                          maximum: 100 
                        },
                        reasons: {
                          type: "array",
                          items: { type: "string" }
                        },
                        highlights: {
                          type: "array",
                          items: { type: "string" }
                        }
                      },
                      required: ["propertyId", "matchScore", "reasons"]
                    }
                  }
                },
                required: ["recommendations"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "recommend_properties" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429 || response.status === 402) {
        // Fallback: retornar imóveis sem IA
        return new Response(JSON.stringify({ 
          recommendations: properties.slice(0, limit).map(p => ({
            property: p,
            matchScore: 70,
            reasons: [
              'Compatível com preferências básicas',
              'Disponível para visitação'
            ]
          }))
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);

    const recommendations = (result.recommendations || [])
      .slice(0, limit)
      .map((r: any) => ({
        property: properties.find((p: any) => p.id === r.propertyId) || null,
        matchScore: r.matchScore,
        reasons: r.reasons,
        highlights: r.highlights
      }))
      .filter((x: any) => x.property);

    return new Response(JSON.stringify({ recommendations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
