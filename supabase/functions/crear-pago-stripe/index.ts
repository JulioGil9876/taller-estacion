import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { pedido_id, articulos } = await req.json()
    
    // 1. Conectamos con tu base de datos
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const line_items = []
    let totalRealCalculado = 0

    // 2. Revisamos pieza por pieza EN LA BASE DE DATOS REAL (Anti-Hackeo)
    for (const item of articulos) {
        // Buscamos la referencia en tu tabla de productos
        const { data: productoReal, error } = await supabase
            .from('productos')
            .select('titulo, precio, foto_url')
            .eq('referencia', item.referencia)
            .single()

        if (error || !productoReal) {
            throw new Error(`¡Alerta! Referencia ${item.referencia} manipulada o no existe.`)
        }

        // Usamos el precio REAL de la base de datos
        const precioLimpio = parseFloat(productoReal.precio.replace(/[^\d,.]/g, '').replace(',', '.'))
        totalRealCalculado += (precioLimpio * (item.cantidad || 1))

        line_items.push({
            price_data: {
                currency: 'eur',
                product_data: { 
                    name: productoReal.titulo, // Nombre REAL
                    images: [productoReal.foto_url || 'https://via.placeholder.com/300']
                },
                unit_amount: Math.round(precioLimpio * 100),
            },
            quantity: item.cantidad || 1,
        })
    }

    // 3. Actualizamos el pedido en la base de datos con el TOTAL REAL (por si la web mandó uno falso)
    await supabase.from('pedidos').update({ total: totalRealCalculado }).eq('id', pedido_id)

    // 4. Mandamos a Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/perfil.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/recambios.html`,
      metadata: { pedido_id },
    })

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})