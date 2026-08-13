-- Create stripe_payments table to track Stripe payment intents
CREATE TABLE IF NOT EXISTS public.stripe_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_payment_intent_id text NOT NULL UNIQUE,
  client_id uuid REFERENCES public.hostivo_clients(id) ON DELETE SET NULL,
  customer_email text NOT NULL,
  customer_name text NOT NULL,
  amount integer NOT NULL COMMENT 'Amount in cents',
  currency text NOT NULL DEFAULT 'eur',
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'requires_payment_method')),
  failure_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  last_reminder_sent_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.stripe_payments ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can view all payments
CREATE POLICY "stripe_payments_select_authenticated"
  ON public.stripe_payments
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: authenticated users can insert payments (via Edge Function)
CREATE POLICY "stripe_payments_insert_authenticated"
  ON public.stripe_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: authenticated users can update payments (e.g., last_reminder_sent_at)
CREATE POLICY "stripe_payments_update_authenticated"
  ON public.stripe_payments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create index on status for queries
CREATE INDEX IF NOT EXISTS idx_stripe_payments_status ON public.stripe_payments(status);

-- Create index on stripe_payment_intent_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_stripe_payments_intent_id ON public.stripe_payments(stripe_payment_intent_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_stripe_payments_created_at ON public.stripe_payments(created_at DESC);
