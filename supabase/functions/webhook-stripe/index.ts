import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response(`Error: No llega la firma`, { status: 400 })
    }

    const body = await req.text()
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })
    
    const webhookSecret = 'whsec_o4yS01MmlDafUZueeJL4YDWWf9xTC6DP'

    let event;
    try {
      // ✨ EL CAMBIO MÁGICO: Añadimos 'await' y 'Async' al final
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    } catch (err) {
      return new Response(`Error de Firma: ${err.message}`, { status: 400 })
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const pedidoId = session.metadata.pedido_id

      const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      const supabase = createClient(supabaseUrl, supabaseKey)

      await supabase
        .from('pedidos')
        .update({ estado: 'Pagado - Preparando envío ✅' })
        .eq('id', pedidoId)

      const { data: pedidoData } = await supabase.from('pedidos').select('articulos').eq('id', pedidoId).single()
      if (pedidoData?.articulos) {
        for (const item of pedidoData.articulos) {
           const { data: prod } = await supabase.from('productos').select('stock').eq('referencia', item.referencia).single()
           if (prod) {
             const nuevoStock = Math.max(0, prod.stock - (item.cantidad || 1))
             await supabase.from('productos').update({ stock: nuevoStock }).eq('referencia', item.referencia)
           }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
    
  } catch (err) {
    return new Response(`Error General: ${err.message}`, { status: 400 })
  }
})