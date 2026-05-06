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
    
    // 🔑 Usamos las llaves guardadas en Supabase
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })
    
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

    let event;
    try {
      // ✅ La clave para que no falle en Deno es usar constructEventAsync
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    } catch (err) {
      return new Response(`Error de Firma: ${err.message}`, { status: 400 })
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const pedidoId = session.metadata.pedido_id //

      // 🏠 Montamos la dirección para tu columna 'direccion_envio'
      const nombre = session.customer_details?.name || 'Cliente'
      const dir = session.customer_details?.address
      const textoDireccion = `${nombre}. ${dir?.line1 || ''}, ${dir?.postal_code || ''} ${dir?.city || ''}, ${dir?.country || ''}`.trim()

      const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      const supabase = createClient(supabaseUrl, supabaseKey)

      // 1. Actualizamos el pedido con la dirección[cite: 1]
      await supabase
        .from('pedidos')
        .update({ 
          estado: 'Pagado - Preparando envío ✅',
          direccion_envio: textoDireccion 
        })
        .eq('id', pedidoId)

      // 2. 📉 RESTAR STOCK (Aquí respondemos a tu duda)
      // Buscamos los artículos que hay dentro del pedido[cite: 1]
      const { data: pedidoData } = await supabase
        .from('pedidos')
        .select('articulos')
        .eq('id', pedidoId)
        .single()

      if (pedidoData?.articulos) {
        // Recorremos cada pieza comprada
        for (const item of pedidoData.articulos) {
           // Buscamos el stock actual de esa referencia
           const { data: prod } = await supabase
             .from('productos')
             .select('stock')
             .eq('referencia', item.referencia)
             .single()

           if (prod) {
             // Restamos la cantidad comprada (si no hay cantidad, restamos 1)
             const cantidadARestar = item.cantidad || 1
             const nuevoStock = Math.max(0, prod.stock - cantidadARestar)
             
             await supabase
               .from('productos')
               .update({ stock: nuevoStock })
               .eq('referencia', item.referencia)
           }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
    
  } catch (err) {
    // Si algo falla dentro, esto nos dirá qué ha sido
    return new Response(`Error General: ${err.message}`, { status: 400 })
  }
})