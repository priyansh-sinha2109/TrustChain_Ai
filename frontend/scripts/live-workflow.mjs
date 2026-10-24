/** Explicit genuine Auth/API/Storage browser workflow. No mocks, no TinyFish run.
 * Logs only stage names, never exception details, request URLs, passwords or tokens.
 * The account/token setup helper must succeed first. All purchasing input is synthetic.
 */
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { chromium } from "@playwright/test";
import { jsPDF } from "jspdf";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
nextEnv.loadEnvConfig(root);
const env = process.env;
let browser;
let stage = "configuration";
function check(ok) { if (!ok) throw new Error("Live verification condition failed"); }
try {
  check(env.TRUSTCHAIN_LIVE_TESTS === "1");
  check(new URL(env.SUPABASE_URL).hostname === `${env.TRUSTCHAIN_TEST_PROJECT_REF}.supabase.co`);
  for (const role of ["BUYER", "REVIEWER"]) check(env[`TRUSTCHAIN_TEST_${role}_EMAIL`] && env[`TRUSTCHAIN_TEST_${role}_PASSWORD`]);
  const base = env.TRUSTCHAIN_BROWSER_ORIGIN || "http://localhost:3000";
  check(new URL(base).hostname === "localhost" || new URL(base).hostname === "127.0.0.1");
  browser = await chromium.launch({ channel: "chrome" });
  const buyer = await browser.newPage();
  const reviewer = await browser.newPage();
  for (const page of [buyer, reviewer]) {
    page.on("response", response => {
      const url = new URL(response.url());
      if (url.pathname === "/auth/v1/token" || (url.hostname === "localhost" && url.pathname.startsWith("/api/v1/"))) {
        console.log(`Live HTTP ${response.status()} ${response.request().method()} ${url.pathname}`);
      }
    });
    page.on("pageerror", () => console.log("Browser runtime exception detected (details withheld)."));
  }
  async function login(page, role) {
    stage = `${role.toLowerCase()} login`;
    await page.goto(`${base}/auth`);
    await page.locator('input[type="email"]').fill(env[`TRUSTCHAIN_TEST_${role}_EMAIL`]);
    await page.locator('input[type="password"]').fill(env[`TRUSTCHAIN_TEST_${role}_PASSWORD`]);
    const casesResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/cases" && response.request().method() === "GET", { timeout: 60000 }).then(response => response.status()).catch(() => 0);
    await page.getByRole("button", { name: "Log in to workspace" }).click();
    await page.waitForURL(/\/dashboard$/, { timeout: 60000 });
    await page.getByRole("heading", { name: "Your purchasing workspace." }).waitFor({ timeout: 60000 });
    check(await casesResponse === 200);
  }
  await login(buyer, "BUYER");
  await login(reviewer, "REVIEWER");
  stage = "case creation";
  await buyer.goto(`${base}/cases/new`);
  await buyer.getByPlaceholder("e.g. Precision steel blanks").fill("SYNTHETIC live browser verification");
  await buyer.getByPlaceholder("e.g. Kaveri Metalworks").fill("SYNTHETIC TEST FIXTURE - not supplier evidence");
  await buyer.getByRole("button", { name: "Continue to documents" }).click();
  await buyer.waitForURL(/\/cases\/[0-9a-f-]+\/documents$/, { timeout: 30000 });
  const caseId = new URL(buyer.url()).pathname.split("/")[2];
  function pdf(thickness, advance, days) {
    const doc = new jsPDF();
    doc.text(["SYNTHETIC TEST FIXTURE", "Product: SYNTHETIC PANEL", "Part number: SYNTHETIC-PANEL", `Thickness: ${thickness} mm`, "Order value: INR 480000", `Advance: ${advance}%`, `Delivery: ${days} days`], 15, 20);
    return Buffer.from(doc.output("arraybuffer"));
  }
  for (const [index, [name, thickness, advance, days]] of [["RFQ", 8, 30, 7], ["ACCEPTED_QUOTE", 8, 30, 7], ["FINAL_PI", 6, 80, 20]].entries()) {
    stage = `private ${name} upload and confirmation`;
    await buyer.getByRole("button", { name: "Choose PDF", exact: true }).nth(index).click();
    await buyer.locator('input[type="file"]').setInputFiles({ name: `synthetic-${name}.pdf`, mimeType: "application/pdf", buffer: pdf(thickness, advance, days) });
    await buyer.getByText(`synthetic-${name}.pdf`, { exact: true }).waitFor({ timeout: 60000 });
  }
  check(await buyer.getByRole("button", { name: "Start investigation" }).isDisabled());
  stage = "reviewer baseline approval";
  await reviewer.goto(`${base}/cases/${caseId}/documents`);
  await reviewer.getByRole("button", { name: "Approve baseline (reviewer)" }).click();
  await reviewer.getByRole("button", { name: "Baseline approved" }).waitFor({ timeout: 30000 });
  stage = "buyer investigation and saved findings";
  await buyer.reload();
  await buyer.getByRole("button", { name: "Baseline approved" }).waitFor({ timeout: 30000 });
  check(!await buyer.getByRole("checkbox").last().isChecked()); // Paid public research stays off.
  await buyer.getByRole("button", { name: "Start investigation" }).click();
  await buyer.getByRole("heading", { name: "REVIEW_READY", exact: true }).waitFor({ timeout: 180000 });
  await buyer.getByText("INR 2,40,000.00", { exact: true }).waitFor();
  stage = "private source retrieval";
  const sourceResponse = buyer.waitForResponse(response => response.url().includes("/documents/") && response.url().endsWith("/content"));
  await buyer.getByRole("button", { name: /Open PDF/ }).first().click();
  const source = await sourceResponse;
  check(source.status() === 200 && (await source.body()).subarray(0, 4).toString() === "%PDF");
  stage = "reviewer decision";
  await reviewer.goto(`${base}/cases/${caseId}/review`);
  await reviewer.getByLabel("Review comment").fill("SYNTHETIC live browser test; no real purchasing authority exercised.");
  await reviewer.getByRole("button", { name: "Record decision" }).click();
  await reviewer.getByText("Decision recorded: REQUEST_CLARIFICATION").waitFor({ timeout: 30000 });
  stage = "saved report download";
  await buyer.goto(`${base}/cases/${caseId}/reports`);
  const downloadPromise = buyer.waitForEvent("download");
  await buyer.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const report = await fs.readFile(await download.path());
  check(report.subarray(0, 4).toString() === "%PDF" && report.toString().includes("240000.00") && report.toString().includes(caseId));
  await fs.writeFile(path.join(root, "tmp/live-browser-report.pdf"), report);
  console.log("LIVE browser workflow PASSED: real Auth, membership, private uploads/confirmation/retrieval, approval, investigation, saved exposure, review and PDF download. No TinyFish request.");
} catch {
  console.error(`LIVE browser workflow NOT PASSED at stage: ${stage}. No credentials or provider response were logged.`);
  process.exitCode = 1;
} finally { if (browser) await browser.close(); }
