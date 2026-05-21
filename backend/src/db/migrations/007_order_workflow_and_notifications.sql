-- Order workflow status + in-app notifications
ALTER TABLE public.ordre
  ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'new'
    CHECK (workflow_status IN ('new', 'processing', 'shipped', 'invoiced', 'cancelled'));

ALTER TABLE public.ordre
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ordre_workflow_status ON public.ordre (workflow_status);

CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  audience TEXT NOT NULL CHECK (audience IN ('admin', 'kunde')),
  kundenr TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id BIGINT NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_audience ON public.notifications (audience, kundenr);
