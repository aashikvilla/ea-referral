import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261025040049_purge_candidate_notification_outbox.sql",
    import.meta.url,
  ),
  "utf8",
);
const uncommentedMigration = migration.replace(/^--\s?/gm, "");

test("candidate deletion migration purges all matching outbox rows transactionally", () => {
  assert.match(
    uncommentedMigration,
    /function public\.ea_referral_require_live_notification_candidate\(\)[\s\S]*?security invoker[\s\S]*?set search_path = pg_catalog, public[\s\S]*?lower\(new\.recipient_email\)\s+and \(new\.recipient_user_id is null or c\.auth_user_id = new\.recipient_user_id\)[\s\S]*?for key share[\s\S]*?errcode = '23503'/i,
  );
  assert.match(
    migration,
    /create trigger ea_referral_require_live_notification_candidate\s+before insert on public\.ea_referral_outbox\s+for each row\s+execute function public\.ea_referral_require_live_notification_candidate\(\)/i,
  );
  assert.match(
    migration,
    /create or replace function public\.ea_referral_purge_candidate_notification_outbox\(\)[\s\S]*?security invoker[\s\S]*?set search_path = pg_catalog, public/i,
  );
  assert.match(
    migration,
    /delete from public\.ea_referral_outbox\s+where recipient_user_id = old\.auth_user_id\s+or lower\(recipient_email\) = lower\(old\.email\)/i,
  );
  assert.match(
    migration,
    /create trigger ea_referral_purge_candidate_notification_outbox\s+after delete on public\.ea_referral_candidates\s+for each row\s+execute function public\.ea_referral_purge_candidate_notification_outbox\(\)/i,
  );
  assert.doesNotMatch(migration, /where[^;]*status\s*=/i);
});

test("candidate deletion migration warns that accepted in-flight email cannot be recalled", () => {
  assert.match(
    uncommentedMigration,
    /cannot\s+recall email already\s+accepted by the provider/i,
  );
});
