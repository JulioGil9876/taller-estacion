import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

// El "Pase VIP" para que el navegador no bloquee la conexión (CORS)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Cuando el navegador pregunta "¿Puedo pasar?", respondemos que SÍ
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pedido_id, articulos } = await req.json()
    
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const line_items = articulos.map((item: any) => {
        const precioLimpio = parseFloat(item.precio.replace(/[^\d,.]/g, '').replace(',', '.'));
        return {
            price_data: {
                currency: 'eur',
                product_data: { 
                    name: item.nombre,
                    images: [item.imagen]
                },
                unit_amount: Math.round(precioLimpio * 100),
            },
            quantity: 1,
        }
    })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/perfil.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/recambios.html`,
      metadata: { pedido_id },
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})