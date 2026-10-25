import { getReferralRepository } from "@/server/supabase-repository";
import { fail, json } from "@/server/http";

export async function GET() {
  try {
    const jobs = await getReferralRepository().listJobs(true);
    return json({ jobs });
  } catch (error) {
    return fail(error);
  }
}
