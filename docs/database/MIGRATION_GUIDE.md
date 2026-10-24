# TrustChain AI — Supabase Cloud Migration & Setup Guide

**Role:** Member 3 (Supabase Architecture, Data Persistence, Security & Audit)  
**Target Environment:** Cloud-Hosted Supabase Project

---

## 1. Safety Rules & Zero Data Loss Policy

> [!CAUTION]
> **DO NOT RUN `supabase db reset` ON THE SHARED CLOUD PROJECT.**
> The Supabase project is shared across the three-person hackathon team. Resetting the database will destroy Member 1 and Member 2's configurations. All migrations in this repository are **additive** and use `IF NOT EXISTS` guards.

---

## 2. Migration Execution Order

Migrations are version-controlled in `supabase/migrations/`:

| Order | Migration File | Description |
|---|---|---|
| **1** | `20261024000001_core_procurement_schema.sql` | Organizations, members, suppliers, cases, documents, RLS |
| **2** | `20261024000002_evidence_and_usp_layer.sql` | Deal versions, TinyFish runs, evidence sources, deal changes, audit log |
| **3** | `20261024000003_storage_policies.sql` | Storage buckets (`case-documents`, `case-reports`), storage RLS |
| **Opt** | `supabase/seed.sql` | Benchmark test data (Sharma Auto Parts, 8mm->6mm, INR 240k advance risk) |

---

## 3. How to Apply Migrations to Remote Supabase

### Method A: Via Supabase Dashboard (Recommended for Hackathon)

1. Log in to the [Supabase Dashboard](https://supabase.com/dashboard).
2. Open your Team's TrustChain AI Project.
3. In the left sidebar, click **SQL Editor**.
4. Click **New Query**.
5. Copy the contents of `supabase/migrations/20261024000001_core_procurement_schema.sql` and click **Run**.
6. Repeat for `20261024000002_evidence_and_usp_layer.sql`.
7. Repeat for `20261024000003_storage_policies.sql`.
8. To load benchmark test data, paste and run `supabase/seed.sql`.

---

### Method B: Via Supabase CLI (If Linked)

```bash
# Verify project linkage
npx supabase status

# Push incremental migrations safely (does not reset database)
npx supabase db push
```

---

## 4. Supabase Storage Configuration Verification

1. Go to **Storage** in the Supabase Dashboard.
2. Confirm the existence of two private buckets:
   - `case-documents` (Private, 15 MB limit, PDF only)
   - `case-reports` (Private, 20 MB limit, PDF/JSON)
3. Under **Policies**, confirm that:
   - Authenticated users can only read objects under their own `{org_id}/...` path.
   - Public access is disabled.

---

## 5. Verification Checklist

Run this SQL snippet in the Supabase SQL Editor to verify tables and row counts:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected tables:
- `audit_events`
- `case_suppliers`
- `claims`
- `deal_change_reviews`
- `deal_changes`
- `deal_versions`
- `documents`
- `evidence_sources`
- `findings`
- `organization_members`
- `organizations`
- `public_research_runs`
- `purchase_cases`
- `review_decisions`
- `suppliers`
