-- A server-side race guard: one account can have only one unresolved manual
-- payment request. Resolved requests remain available for audit history.
CREATE UNIQUE INDEX IF NOT EXISTS idx_manual_payment_one_pending_per_user
  ON public.manual_payment_requests (user_id)
  WHERE status = 'PENDING';
