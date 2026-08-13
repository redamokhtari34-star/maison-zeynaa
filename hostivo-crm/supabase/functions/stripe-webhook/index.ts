import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const stripe = await import('https://esm.sh/stripe@14.8.0').then(m => m.default);

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variables');
}

const stripeClient = stripe(Deno.env.get('STRIPE_SECRET_KEY'));
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === 'POST') {
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    let event;
    try {
      event = stripeClient.webhooks.constructEvent(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object;

          // Extract customer info from payment intent metadata
          const customerName = paymentIntent.metadata?.customer_name || 'Client Stripe';
          const customerEmail = paymentIntent.metadata?.customer_email || '';
          const nomEntreprise = paymentIntent.metadata?.nom_entreprise || customerName;

          // Create new client from payment intent
          const { data: newClient, error: clientError } = await supabase
            .from('hostivo_clients')
            .insert({
              nom_entreprise: nomEntreprise,
              telephone: paymentIntent.metadata?.telephone || '',
              secteur: paymentIntent.metadata?.secteur || '',
              date_demande: new Date().toISOString().split('T')[0],
              statut_site: 'En attente client',
              statut_modification: 'Modification à faire',
            })
            .select('id')
            .single();

          if (clientError) {
            console.error('Error creating client:', clientError);
          }

          const clientId = newClient?.id || null;

          // Record the successful payment
          const { error: paymentError } = await supabase
            .from('stripe_payments')
            .insert({
              stripe_payment_intent_id: paymentIntent.id,
              client_id: clientId,
              customer_email: customerEmail,
              customer_name: customerName,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              status: 'succeeded',
            });

          if (paymentError) {
            console.error('Error recording payment:', paymentError);
          }

          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object;

          // Record the failed payment
          const { error: paymentError } = await supabase
            .from('stripe_payments')
            .insert({
              stripe_payment_intent_id: paymentIntent.id,
              customer_email: paymentIntent.metadata?.customer_email || '',
              customer_name: paymentIntent.metadata?.customer_name || 'Unknown',
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              status: 'failed',
              failure_reason: paymentIntent.last_payment_error?.message || 'Payment failed',
            });

          if (paymentError) {
            console.error('Error recording failed payment:', paymentError);
          }

          // TODO: Send email notification to admin about failed payment
          // This will be handled by a separate function or Resend integration

          break;
        }

        case 'payment_intent.requires_action': {
          const paymentIntent = event.data.object;

          // Record payment requiring action
          const { error: paymentError } = await supabase
            .from('stripe_payments')
            .insert({
              stripe_payment_intent_id: paymentIntent.id,
              customer_email: paymentIntent.metadata?.customer_email || '',
              customer_name: paymentIntent.metadata?.customer_name || 'Unknown',
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              status: 'requires_payment_method',
              failure_reason: 'Payment requires additional action from customer',
            });

          if (paymentError) {
            console.error('Error recording payment requiring action:', paymentError);
          }

          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return new Response(
        JSON.stringify({ received: true }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('Error processing webhook:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } else {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
