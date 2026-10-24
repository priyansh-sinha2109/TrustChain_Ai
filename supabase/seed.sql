-- ==============================================================================
-- TrustChain AI — Seed Data: Sharma Auto Parts Benchmark Scenario
-- Team Ashwamedha (HackIIITD 2026) | Role: Member 3
-- ==============================================================================
-- Purpose:
-- Provides realistic, source-linked test data for the benchmark test case:
-- Sharma Auto Components Pvt Ltd purchasing 5,000 steel components from
-- SteelForge Industrial Supplies.
--
-- Discrepancies Demonstrated:
-- 1. Material thickness: 8 mm (Agreed) -> 6 mm (Final PI) [Silent Technical Downgrade]
-- 2. Delivery timeline: 7 days -> 20 days [13 days delay]
-- 3. Advance percentage: 30% -> 80% [INR 144,000 -> INR 384,000: +INR 240,000 Exposure]
--
-- Multi-Tenant Isolation Test Target:
-- Apex Engineering Ltd (Org B) exists alongside to verify zero cross-tenant leakage.
-- ==============================================================================

-- Fixed deterministic UUIDs for repeatable testing and assertions
DO $$
DECLARE
    -- Organizations
    v_org_a UUID := 'a0000000-0000-0000-0000-000000000001';
    v_org_b UUID := 'b0000000-0000-0000-0000-000000000002';

    -- Users (Supabase Auth IDs)
    v_user_buyer_a UUID    := '10000000-0000-0000-0000-000000000001'; -- Anil Sharma
    v_user_reviewer_a UUID := '10000000-0000-0000-0000-000000000002'; -- Priya Nair
    v_user_admin_a UUID    := '10000000-0000-0000-0000-000000000003'; -- Rajesh Verma
    v_user_buyer_b UUID    := '20000000-0000-0000-0000-000000000001'; -- Vikram Deshmukh (Org B)

    -- Supplier
    v_supplier_id UUID := 'c0000000-0000-0000-0000-000000000001';

    -- Purchase Case
    v_case_id UUID := 'd0000000-0000-0000-0000-000000000001';
    v_case_supplier_id UUID := 'd1000000-0000-0000-0000-000000000001';

    -- Documents
    v_doc_rfq UUID    := 'e0000000-0000-0000-0000-000000000001';
    v_doc_quote UUID  := 'e0000000-0000-0000-0000-000000000002';
    v_doc_pi UUID     := 'e0000000-0000-0000-0000-000000000003';

    -- Deal Versions
    v_ver_rfq UUID   := 'f0000000-0000-0000-0000-000000000001';
    v_ver_quote UUID := 'f0000000-0000-0000-0000-000000000002';
    v_ver_pi UUID    := 'f0000000-0000-0000-0000-000000000003';

    -- Evidence Sources
    v_src_quote_p2 UUID := 'aa000000-0000-0000-0000-000000000001';
    v_src_pi_p1_mat UUID:= 'aa000000-0000-0000-0000-000000000002';
    v_src_pi_p1_adv UUID:= 'aa000000-0000-0000-0000-000000000003';
    v_src_web_terms UUID:= 'aa000000-0000-0000-0000-000000000004';

    -- Findings
    v_finding_adv UUID := 'bb000000-0000-0000-0000-000000000001';
    v_finding_mat UUID := 'bb000000-0000-0000-0000-000000000002';
    v_finding_del UUID := 'bb000000-0000-0000-0000-000000000003';

    -- Deal Changes
    v_chg_thickness UUID := 'cc000000-0000-0000-0000-000000000001';
    v_chg_advance UUID   := 'cc000000-0000-0000-0000-000000000002';
    v_chg_delivery UUID  := 'cc000000-0000-0000-0000-000000000003';

BEGIN
    -- 1. Create Organizations
    INSERT INTO public.organizations (id, name, slug)
    VALUES 
        (v_org_a, 'Sharma Auto Components Pvt Ltd', 'sharma-auto'),
        (v_org_b, 'Apex Engineering Ltd', 'apex-engineering')
    ON CONFLICT (id) DO NOTHING;

    -- 2. Organization Members
    INSERT INTO public.organization_members (org_id, user_id, role)
    VALUES
        (v_org_a, v_user_buyer_a, 'buyer'),
        (v_org_a, v_user_reviewer_a, 'reviewer'),
        (v_org_a, v_user_admin_a, 'admin'),
        (v_org_b, v_user_buyer_b, 'buyer')
    ON CONFLICT (org_id, user_id) DO NOTHING;

    -- 3. Supplier (Scoped to Org A)
    INSERT INTO public.suppliers (id, org_id, legal_name, trade_name, gstin, pan, website_url, contact_email)
    VALUES (
        v_supplier_id,
        v_org_a,
        'SteelForge Industrial Supplies Pvt Ltd',
        'SteelForge India',
        '07AABCS1429B1Z2',
        'AABCS1429B',
        'https://steelforge-industries.in',
        'sales@steelforge-industries.in'
    )
    ON CONFLICT (id) DO NOTHING;

    -- 4. Purchase Case
    INSERT INTO public.purchase_cases (
        id, org_id, case_number, title, status, currency, target_item, target_quantity, created_by
    )
    VALUES (
        v_case_id,
        v_org_a,
        'TC-2026-10-001',
        'Steel Components — October Investigation',
        'IN_REVIEW',
        'INR',
        'Grade A Auto Stamping Steel Components',
        5000.00,
        v_user_buyer_a
    )
    ON CONFLICT (id) DO NOTHING;

    -- 5. Case Supplier Mapping
    INSERT INTO public.case_suppliers (id, case_id, supplier_id, is_primary)
    VALUES (v_case_supplier_id, v_case_id, v_supplier_id, true)
    ON CONFLICT (case_id, supplier_id) DO NOTHING;

    -- 6. Private Documents
    INSERT INTO public.documents (
        id, case_id, supplier_id, doc_type, storage_key, file_name, mime_type, file_size, sha256, status
    )
    VALUES
        (
            v_doc_rfq,
            v_case_id,
            v_supplier_id,
            'RFQ',
            v_org_a || '/' || v_case_id || '/' || v_doc_rfq || '.pdf',
            'RFQ_Steel_Components_SharmaAuto.pdf',
            'application/pdf',
            245120,
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            'EXTRACTED'
        ),
        (
            v_doc_quote,
            v_case_id,
            v_supplier_id,
            'ACCEPTED_QUOTE',
            v_org_a || '/' || v_case_id || '/' || v_doc_quote || '.pdf',
            'Accepted_Quotation_SteelForge_Q420.pdf',
            'application/pdf',
            382100,
            'd41d8cd98f00b204e9800998ecf8427e56b8b0e8b83984ca3b281f6d33267d32',
            'EXTRACTED'
        ),
        (
            v_doc_pi,
            v_case_id,
            v_supplier_id,
            'FINAL_PI',
            v_org_a || '/' || v_case_id || '/' || v_doc_pi || '.pdf',
            'Final_Proforma_Invoice_PI8821.pdf',
            'application/pdf',
            412950,
            '8a8bb7ec342b63a5f04d09f904f43420e743d49603b733ec5a469f026ca82142',
            'EXTRACTED'
        )
    ON CONFLICT (id) DO NOTHING;

    -- 7. Deal Versions (Baseline Quote vs Final PI)
    INSERT INTO public.deal_versions (
        id, case_id, supplier_id, document_id, stage, version_no, total_amount, advance_percentage, delivery_timeline_days, notes
    )
    VALUES
        (
            v_ver_rfq,
            v_case_id,
            v_supplier_id,
            v_doc_rfq,
            'RFQ',
            1,
            480000.00,
            30.00,
            7,
            'Initial buyer specification: 8mm thickness, 5,000 units'
        ),
        (
            v_ver_quote,
            v_case_id,
            v_supplier_id,
            v_doc_quote,
            'ACCEPTED_QUOTE',
            1,
            480000.00,
            30.00,
            7,
            'Accepted quotation baseline: INR 480k, 30% advance (INR 144k), 8mm thickness'
        ),
        (
            v_ver_pi,
            v_case_id,
            v_supplier_id,
            v_doc_pi,
            'FINAL_PI',
            1,
            480000.00,
            80.00,
            20,
            'Final PI received: 80% advance (INR 384k), 6mm thickness, 20 days delivery'
        )
    ON CONFLICT (case_id, stage, version_no) DO NOTHING;

    -- 8. Public Research Run (TinyFish Execution Simulation)
    INSERT INTO public.public_research_runs (
        case_id, case_supplier_id, tinyfish_run_id, target_url, status, started_at, completed_at, raw_result
    )
    VALUES (
        v_case_id,
        v_case_supplier_id,
        'tf_run_live_7a9f82d01',
        'https://steelforge-industries.in/commercial-terms',
        'COMPLETED',
        now() - INTERVAL '1 hour',
        now() - INTERVAL '58 minutes',
        '{
            "pages_analyzed": 3,
            "terms_found": {
                "standard_advance": "25-30% for verified MSME buyers",
                "default_lead_time": "7-10 business days"
            },
            "source_urls": [
                "https://steelforge-industries.in/terms",
                "https://steelforge-industries.in/about"
            ]
        }'::jsonb
    );

    -- 9. Evidence Sources
    INSERT INTO public.evidence_sources (
        id, case_id, kind, source_url, document_id, page_number, extracted_text, verification_status, metadata_json
    )
    VALUES
        (
            v_src_quote_p2,
            v_case_id,
            'PRIVATE_PDF',
            NULL,
            v_doc_quote,
            2,
            'Specification: Hot Rolled Sheet Metal Stamping Grade 1. Thickness: 8.00 mm (+/- 0.05 mm). Quantity: 5,000 Pcs.',
            'VERIFIED_MATCH',
            '{"field": "steel_thickness_mm", "stage": "ACCEPTED_QUOTE"}'::jsonb
        ),
        (
            v_src_pi_p1_mat,
            v_case_id,
            'PRIVATE_PDF',
            NULL,
            v_doc_pi,
            1,
            'Description: Sheet Metal Components. Thickness: 6.00 mm. Total Qty: 5,000 units. Unit Price: INR 96.00.',
            'DISCREPANCY',
            '{"field": "steel_thickness_mm", "stage": "FINAL_PI"}'::jsonb
        ),
        (
            v_src_pi_p1_adv,
            v_case_id,
            'PRIVATE_PDF',
            NULL,
            v_doc_pi,
            1,
            'Payment Terms: 80% Advance against Proforma Invoice via RTGS/NEFT. Balance 20% against dispatch documentation.',
            'DISCREPANCY',
            '{"field": "advance_percentage", "stage": "FINAL_PI"}'::jsonb
        ),
        (
            v_src_web_terms,
            v_case_id,
            'PUBLIC_WEB',
            'https://steelforge-industries.in/commercial-terms',
            NULL,
            NULL,
            'Standard Commercial Terms: Verified domestic manufacturing buyers are eligible for 25% to 30% advance deposit.',
            'OBSERVED',
            '{"scraped_by": "TinyFish", "run_id": "tf_run_live_7a9f82d01"}'::jsonb
        )
    ON CONFLICT (id) DO NOTHING;

    -- 10. Extracted Claims
    INSERT INTO public.claims (case_id, source_id, field_key, claim_value, confidence_score)
    VALUES
        (v_case_id, v_src_quote_p2, 'steel_thickness_mm', '{"value": 8, "unit": "mm"}'::jsonb, 0.99),
        (v_case_id, v_src_pi_p1_mat, 'steel_thickness_mm', '{"value": 6, "unit": "mm"}'::jsonb, 0.98),
        (v_case_id, v_src_pi_p1_adv, 'advance_percentage', '{"value": 80, "unit": "%"}'::jsonb, 1.00),
        (v_case_id, v_src_web_terms, 'public_standard_advance', '{"value": 30, "unit": "%"}'::jsonb, 0.92);

    -- 11. Findings
    INSERT INTO public.findings (id, case_id, status, severity, summary, details)
    VALUES
        (
            v_finding_adv,
            v_case_id,
            'FLAGGED',
            'CRITICAL',
            'Advance Commitment Escalation: Advance increased from 30% (INR 144,000) to 80% (INR 384,000), exposing an additional INR 240,000 in unbacked cash risk.',
            '{
                "agreed_advance_pct": 30,
                "agreed_advance_inr": 144000,
                "pi_advance_pct": 80,
                "pi_advance_inr": 384000,
                "exposure_increase_inr": 240000
            }'::jsonb
        ),
        (
            v_finding_mat,
            v_case_id,
            'FLAGGED',
            'HIGH',
            'Material Specification Downgrade: Component thickness silently dropped from 8 mm in Accepted Quotation to 6 mm in Final Proforma Invoice.',
            '{
                "agreed_thickness_mm": 8,
                "pi_thickness_mm": 6,
                "variance_mm": -2
            }'::jsonb
        ),
        (
            v_finding_del,
            v_case_id,
            'OPEN',
            'MEDIUM',
            'Delivery Timeline Extended: Lead time changed from 7 days (Accepted Quotation) to 20 days (Final PI).',
            '{
                "agreed_days": 7,
                "pi_days": 20,
                "delay_days": 13
            }'::jsonb
        )
    ON CONFLICT (id) DO NOTHING;

    -- 12. Deal Changes (USP Core Diffs)
    INSERT INTO public.deal_changes (
        id, finding_id, case_id, baseline_version_id, final_version_id, field_key, category,
        before_value, after_value, baseline_page, final_page, financial_impact_inr, status
    )
    VALUES
        (
            v_chg_advance,
            v_finding_adv,
            v_case_id,
            v_ver_quote,
            v_ver_pi,
            'advance_percentage',
            'COMMERCIAL',
            '{"value": 30, "unit": "%", "amount_inr": 144000}'::jsonb,
            '{"value": 80, "unit": "%", "amount_inr": 384000}'::jsonb,
            1,
            1,
            240000.00,
            'OPEN'
        ),
        (
            v_chg_thickness,
            v_finding_mat,
            v_case_id,
            v_ver_quote,
            v_ver_pi,
            'steel_thickness_mm',
            'TECHNICAL',
            '{"value": 8, "unit": "mm"}'::jsonb,
            '{"value": 6, "unit": "mm"}'::jsonb,
            2,
            1,
            0.00,
            'OPEN'
        ),
        (
            v_chg_delivery,
            v_finding_del,
            v_case_id,
            v_ver_quote,
            v_ver_pi,
            'delivery_days',
            'COMMERCIAL',
            '{"value": 7, "unit": "days"}'::jsonb,
            '{"value": 20, "unit": "days"}'::jsonb,
            1,
            1,
            0.00,
            'OPEN'
        )
    ON CONFLICT (id) DO NOTHING;

    -- 13. Deal Change Reviews (Human Reviewer line-item actions)
    INSERT INTO public.deal_change_reviews (deal_change_id, reviewer_id, action, note)
    VALUES
        (
            v_chg_thickness,
            v_user_reviewer_a,
            'NEEDS_ENGINEER',
            'Downgrade to 6mm will compromise tensile load for chassis assembly. Forwarded to Quality Assurance lead.'
        ),
        (
            v_chg_advance,
            v_user_reviewer_a,
            'REQUEST_INFO',
            '80% advance payment violates procurement guidelines. Demand supplier revert to 30% advance before payment release.'
        );

    -- 14. Review Decision (Overall Human Sign-off)
    INSERT INTO public.review_decisions (case_id, reviewer_id, decision, justification)
    VALUES (
        v_case_id,
        v_user_reviewer_a,
        'REQUEST_SUPPLIER_CLARIFICATION',
        'Pre-advance verification failed: INR 240,000 unexpected advance exposure and 2mm material thickness deficit detected. Hold all advance disbursements until supplier re-issues compliant PI.'
    );

    -- 15. Audit Events (Append-only trail)
    INSERT INTO public.audit_events (org_id, actor_id, action, payload_json)
    VALUES
        (
            v_org_a,
            v_user_buyer_a,
            'PURCHASE_CASE_CREATED',
            '{"case_number": "TC-2026-10-001", "title": "Steel Components — October Investigation"}'::jsonb
        ),
        (
            v_org_a,
            v_user_buyer_a,
            'SUPPLIER_ATTACHED',
            '{"supplier_id": "c0000000-0000-0000-0000-000000000001", "supplier_name": "SteelForge Industrial Supplies Pvt Ltd"}'::jsonb
        ),
        (
            v_org_a,
            v_user_buyer_a,
            'DOCUMENT_REGISTERED',
            '{"doc_type": "ACCEPTED_QUOTE", "file_name": "Accepted_Quotation_SteelForge_Q420.pdf"}'::jsonb
        ),
        (
            v_org_a,
            v_user_buyer_a,
            'DOCUMENT_REGISTERED',
            '{"doc_type": "FINAL_PI", "file_name": "Final_Proforma_Invoice_PI8821.pdf"}'::jsonb
        ),
        (
            v_org_a,
            v_user_buyer_a,
            'RESEARCH_RUN_COMPLETED',
            '{"tinyfish_run_id": "tf_run_live_7a9f82d01", "target_url": "https://steelforge-industries.in/commercial-terms"}'::jsonb
        ),
        (
            v_org_a,
            v_user_reviewer_a,
            'DEAL_CHANGE_REVIEW_SUBMITTED',
            '{"change_field": "advance_percentage", "action": "REQUEST_INFO", "financial_impact": 240000}'::jsonb
        ),
        (
            v_org_a,
            v_user_reviewer_a,
            'REVIEW_DECISION_RECORDED',
            '{"decision": "REQUEST_SUPPLIER_CLARIFICATION", "status": "HOLD_PAYMENT"}'::jsonb
        );

END $$;
