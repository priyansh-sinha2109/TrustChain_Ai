/** Browser contract tests: every Auth/API/Storage request is intercepted.
 * The synthetic session below is NEVER sent to Supabase or the real backend.
 * This suite is not proof of hosted authentication or persistence.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const caseId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const quoteId = "33333333-3333-4333-8333-333333333333";
const finalId = "44444444-4444-4444-8444-444444444444";
const rfqId = "55555555-5555-4555-8555-555555555555";
const purchase = { id: caseId, supplier_id: "synthetic-supplier", title: "SYNTHETIC browser fixture", supplier_name: "SYNTHETIC purchasing fixture", public_supplier_url: "https://example.com" };
const pdf = Buffer.from("%PDF-1.4\nSYNTHETIC browser contract fixture\n%%EOF");

async function fixtures(page: Page, options: { loginFailure?: boolean; casesFailure?: boolean; failedJob?: boolean; uploadFailure?: boolean; staleFindings?: boolean } = {}) {
  const documents: Record<string, unknown>[] = [];
  let polls = 0;
  let reviews = 0;
  let reviewed = false;
  const source = (id: string, type: string, value: string) => ({ document_id: id, document_type: type, field_key: "thickness", value, unit: "mm", page_number: 1, raw_text: `SYNTHETIC thickness: ${value} mm` });
  const findings = { case_id: caseId, job_id: jobId, supplier_id: purchase.supplier_id, baseline_document_id: quoteId, final_document_id: finalId,
    created_at: "2026-10-24T13:00:00Z", investigation_status: "REVIEW_READY",
    findings: [{ field_key: "thickness", category: "TECHNICAL", status: "CONFLICT", severity: "HIGH", baseline: [source(quoteId, "ACCEPTED_QUOTE", "8")], final: [source(finalId, "FINAL_PI", "6")], explanation: "SYNTHETIC fixture: accepted 8 mm differs from final 6 mm." }],
    advance_exposure: { status: "CALCULATED", currency: "INR", baseline_amount: "144000.00", final_amount: "384000.00", difference: "240000.00" },
    evidence: [{ provider_run_id: "SYNTHETIC-mocked-run", source_url: "https://example.com", observation: "SYNTHETIC public observation; not supplier evidence.", captured_at: "2026-10-24T13:00:00Z" }] };
  const cors = { "access-control-allow-origin": "http://localhost:3107", "access-control-allow-headers": "authorization,apikey,content-type,idempotency-key,x-client-info,x-supabase-api-version", "access-control-allow-methods": "GET,POST,PUT,OPTIONS", "content-type": "application/json" };
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === "localhost" && url.port === "3107") return route.continue();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const reply = (body: unknown, status = 200) => route.fulfill({ status, headers: cors, body: JSON.stringify(body) });
    if (url.pathname.startsWith("/auth/v1/")) {
      if (options.loginFailure) return reply({ error_code: "invalid_credentials", msg: "Invalid login credentials" }, 400);
      const user = { id: "66666666-6666-4666-8666-666666666666", aud: "authenticated", role: "authenticated", email: "synthetic@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-10-24T00:00:00Z" };
      // Auth SDK parses JWT claims locally; the signature is deliberately invalid.
      const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url"), "synthetic-invalid-signature"].join(".");
      return reply({ access_token: token, token_type: "bearer", expires_in: 3600, refresh_token: "synthetic-not-a-real-refresh-token", user });
    }
    if (url.hostname === "storage.test") return route.fulfill({ status: options.uploadFailure ? 500 : 200, headers: cors, body: "{}" });
    if (url.port !== "8000") return route.abort(); // Block all unmocked external traffic.
    const path = url.pathname;
    if (path === "/health") return reply({ status: "ok" });
    if (path === "/api/v1/cases") {
      if (options.casesFailure) return reply({ error: { message: "Synthetic API outage" } }, 503);
      if (req.method() === "POST") expect(req.postDataJSON()).toEqual({ title: purchase.title, supplier_name: purchase.supplier_name, public_supplier_url: purchase.public_supplier_url });
      return reply(req.method() === "POST" ? purchase : [purchase], req.method() === "POST" ? 201 : 200);
    }
    if (path === `/api/v1/cases/${caseId}`) return reply(purchase);
    if (path.endsWith("/documents/upload-intents")) {
      const data = req.postDataJSON();
      const id = data.document_type === "ACCEPTED_QUOTE" ? quoteId : data.document_type === "FINAL_PI" ? finalId : rfqId;
      documents.push({ ...data, id, case_id: caseId, approved: false });
      return reply({ document_id: id, upload_url: `https://storage.test/upload/${id}`, expires_at: "2099-01-01T00:00:00Z" }, 201);
    }
    if (path.endsWith("/documents/confirm")) return reply(documents.find(d => d.id === req.postDataJSON().document_id));
    if (path.endsWith("/approval")) { const doc = documents.find(d => d.id === quoteId)!; doc.approved = true; return reply(doc); }
    if (path.endsWith("/documents")) return reply(documents);
    if (path.endsWith("/content")) return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/pdf" }, body: pdf });
    if (path.endsWith("/investigations")) {
      expect(req.headers()["idempotency-key"]).toBeTruthy();
      expect(req.postDataJSON()).toEqual({ baseline_document_id: quoteId, final_document_id: finalId, public_research: true });
      return reply({ job_id: jobId, status: "QUEUED", poll_url: `/api/v1/jobs/${jobId}` }, 202);
    }
    if (path === `/api/v1/jobs/${jobId}`) return reply({ id: jobId, case_id: caseId, status: options.failedJob ? "FAILED" : reviewed ? "REVIEWED" : ++polls === 1 ? "PROCESSING" : "REVIEW_READY", stage: options.failedJob ? "FAILED" : "COMPARISON", error_code: options.failedJob ? "PDF_EXTRACTION_FAILED" : null });
    if (path.endsWith("/findings")) return reply({ ...findings, job_id: options.staleFindings ? "another-job-version" : jobId });
    if (path.endsWith("/reviews")) {
      expect(req.postDataJSON().job_id).toBe(jobId);
      if (++reviews === 1) return reply({ error: { message: "Reviewer membership required" } }, 403);
      reviewed = true;
      return reply(req.postDataJSON(), 201);
    }
    return reply({ error: { message: `Unmocked fixture path: ${path}` } }, 500);
  });
}

async function login(page: Page) {
  await page.goto("/auth");
  await page.locator('input[type="email"]').fill("synthetic@example.com");
  await page.locator('input[type="password"]').fill("SYNTHETIC-not-a-real-password");
  await page.getByRole("button", { name: "Log in to workspace" }).click();
}

test("mocked browser contract: upload, approval, persisted job display, review and PDF export", async ({ page }) => {
  await fixtures(page);
  await login(page);
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/cases/new");
  await page.getByPlaceholder("e.g. Precision steel blanks").fill(purchase.title);
  await page.getByPlaceholder("e.g. Kaveri Metalworks").fill(purchase.supplier_name);
  await page.getByLabel("Public supplier URL").fill(purchase.public_supplier_url);
  await page.getByRole("button", { name: "Continue to documents" }).click();
  await expect(page).toHaveURL(new RegExp(`${caseId}/documents`));
  const start = page.getByRole("button", { name: "Start investigation" });
  await expect(start).toBeDisabled();
  for (const [index, name] of ["RFQ", "ACCEPTED_QUOTE", "FINAL_PI"].entries()) {
    await page.getByRole("button", { name: "Choose PDF", exact: true }).nth(index).click();
    await page.locator('input[type="file"]').setInputFiles({ name: `${name}.pdf`, mimeType: "application/pdf", buffer: pdf });
    await expect(page.getByText(`${name}.pdf`, { exact: true })).toBeVisible();
  }
  await expect(start).toBeDisabled();
  await page.getByRole("button", { name: "Approve baseline (reviewer)" }).click();
  await expect(page.getByRole("button", { name: "Baseline approved" })).toBeVisible();
  await page.getByRole("checkbox").last().check();
  await start.click();
  await expect(page.getByRole("heading", { name: "REVIEW_READY", exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("INR 2,40,000.00", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "evidence", exact: true }).click();
  await expect(page.getByText("SYNTHETIC public observation; not supplier evidence.")).toBeVisible();
  await page.getByRole("link", { name: "review", exact: true }).click();
  await page.getByLabel("Review comment").fill("SYNTHETIC reviewer contract verification");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Reviewer membership required" })).toBeVisible();
  await expect(page.getByText(/Decision recorded:/)).toHaveCount(0);
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText("Decision recorded: REQUEST_CLARIFICATION")).toBeVisible();
  await page.getByRole("link", { name: "reports", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const report = await readFile((await download.path())!);
  expect(report.subarray(0, 4).toString()).toBe("%PDF");
  expect(report.toString()).toContain("SYNTHETIC browser fixture");
  expect(report.toString()).toContain("240000.00");
  await page.screenshot({ path: "../tmp/full-stack-report.png", fullPage: true });
});

test("invalid login remains on authentication page", async ({ page }) => {
  await fixtures(page, { loginFailure: true }); await login(page);
  await expect(page.getByText("Invalid login credentials")).toBeVisible();
  await expect(page).toHaveURL(/auth/);
});

test("API outage never displays illustrative cases", async ({ page }) => {
  await fixtures(page, { casesFailure: true }); await login(page);
  await expect(page.getByRole("alert").filter({ hasText: "Synthetic API outage" })).toBeVisible();
  await expect(page.getByText("TC024", { exact: false })).toHaveCount(0);
});

test("failed saved job remains failed", async ({ page }) => {
  await fixtures(page, { failedJob: true }); await login(page);
  await page.goto(`/cases/${caseId}/progress?job_id=${jobId}`);
  await expect(page.getByRole("heading", { name: "FAILED", exact: true })).toBeVisible();
  await expect(page.getByText("PDF_EXTRACTION_FAILED")).toBeVisible();
  await expect(page.getByText("INR 2,40,000.00", { exact: true })).toHaveCount(0);
});

test("failed private upload is not confirmed or shown as attached", async ({ page }) => {
  await fixtures(page, { uploadFailure: true }); await login(page);
  await page.goto(`/cases/${caseId}/documents`);
  await page.getByRole("button", { name: "Choose PDF", exact: true }).first().click();
  await page.locator('input[type="file"]').setInputFiles({ name: "failed.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.getByText("Private PDF upload failed (500).")).toBeVisible();
  await expect(page.getByText("PDF uploaded", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start investigation" })).toBeDisabled();
});

test("progress does not mix a newer result with the selected job", async ({ page }) => {
  await fixtures(page, { staleFindings: true }); await login(page);
  await page.goto(`/cases/${caseId}/progress?job_id=${jobId}`);
  await expect(page.getByText("A newer investigation is available. Open findings to view its results.")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("INR 2,40,000.00", { exact: true })).toHaveCount(0);
});
