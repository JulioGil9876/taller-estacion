import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // 1. Stripe nos manda la carta (el aviso de pago)
    const payload = await req.text()
    const event = JSON.parse(payload)

    // 2. Comprobamos si el aviso es exactamente: "El cliente ha pagado con éxito"
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const pedidoId = session.metadata.pedido_id

      // 3. Conectamos con tu base de datos de Supabase por el canal interno
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      const supabase = createClient(supabaseUrl, supabaseKey)

      // 4. Actualizamos la factura a "Pagado"
      const { error } = await supabase
        .from('pedidos')
        .update({ estado: 'Pagado - Preparando envío ✅' })
        .eq('id', pedidoId)

      if (error) throw error
    }

    // Le decimos a Stripe: "Mensaje recibido, gracias"
    return new Response(JSON.stringify({ received: true }), { status: 200 })
    
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400 }
    )
  }
})