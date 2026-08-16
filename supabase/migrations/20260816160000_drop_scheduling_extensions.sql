-- Drop the scheduling extensions left behind by the reverted self-training
-- experiment. The cron job was unscheduled and its tables dropped; these
-- extensions are no longer used anywhere.

drop extension if exists pg_net;
drop extension if exists pg_cron;
