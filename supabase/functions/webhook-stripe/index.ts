import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // 1. Le pedimos el "DNI" (La firma) al mensaje que llega
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      throw new Error('¡Alto ahí! Falta la firma de Stripe.')
    }

    const body = await req.text()
    
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })
    
    // Sacamos la contraseña secreta que acabamos de guardar
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

    // 2. EL PORTERO ACTÚA: Comprueba si la firma coincide con la contraseña
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error(`⚠️ ALERTA DE HACKEO: Firma inválida.`, err.message)
      return new Response(`Error: Mensaje falso detectado`, { status: 400 })
    }

    // 3. Si el portero le deja pasar (es Stripe de verdad), procesamos el pago
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
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
    
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 })
  }
})