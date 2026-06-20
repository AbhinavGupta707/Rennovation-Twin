import { expect, test, type Page } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PlanSchema } from "@renovation-twin/types";

test.describe.configure({ mode: "serial" });

const runId = Date.now();
const editorProjectId = `e2e-editor-${runId}`;
const uploadProjectId = `e2e-upload-${runId}`;
const pdfProjectId = `e2e-pdf-${runId}`;
const pdfFallbackProjectId = `e2e-pdf-fallback-${runId}`;
const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

const apiPlan: PlanSchema = {
  units: "m",
  scalePxPerMeter: 70,
  image: {
    widthPx: 980,
    heightPx: 700,
    url: "/demo/floorplans/london-flat.svg",
  },
  walls: [
    {
      id: "api-n",
      start: { x: 100, y: 100 },
      end: { x: 500, y: 100 },
      thicknessM: 0.14,
      heightM: 2.6,
    },
    {
      id: "api-e",
      start: { x: 500, y: 100 },
      end: { x: 500, y: 420 },
      thicknessM: 0.14,
      heightM: 2.6,
    },
    {
      id: "api-s",
      start: { x: 500, y: 420 },
      end: { x: 100, y: 420 },
      thicknessM: 0.14,
      heightM: 2.6,
    },
    {
      id: "api-w",
      start: { x: 100, y: 420 },
      end: { x: 100, y: 100 },
      thicknessM: 0.14,
      heightM: 2.6,
    },
  ],
  openings: [
    {
      id: "api-door",
      type: "door",
      wallId: "api-s",
      offsetM: 2.2,
      widthM: 0.85,
      heightM: 2.1,
    },
  ],
  rooms: [
    {
      id: "api-room",
      label: "API room",
      polygon: [
        { x: 120, y: 120 },
        { x: 480, y: 120 },
        { x: 480, y: 400 },
        { x: 120, y: 400 },
      ],
    },
  ],
};

function byteDiff(a: Buffer, b: Buffer): number {
  const max = Math.min(a.length, b.length);
  let diff = Math.abs(a.length - b.length);

  for (let index = 0; index < max; index += 1) {
    if (a[index] !== b[index]) {
      diff += 1;
    }
  }

  return diff;
}

async function webglCanvasStats(page: Page) {
  await page.locator("canvas").first().waitFor({
    state: "attached",
    timeout: 30_000,
  });

  let stats = {
    width: 0,
    height: 0,
    nonZeroSamples: 0,
    samples: 0,
    colorBuckets: 0,
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await page.waitForTimeout(300);
    stats = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");

      if (!canvas) {
        return {
          width: 0,
          height: 0,
          nonZeroSamples: 0,
          samples: 0,
          colorBuckets: 0,
        };
      }

      const rect = canvas.getBoundingClientRect();
      const gl =
        canvas.getContext("webgl2") ??
        canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl");

      if (!gl || !("readPixels" in gl)) {
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          nonZeroSamples: 0,
          samples: 0,
          colorBuckets: 0,
        };
      }

      const webgl = gl as WebGLRenderingContext;
      const pixel = new Uint8Array(4);
      const stepX = Math.max(1, Math.floor(webgl.drawingBufferWidth / 32));
      const stepY = Math.max(1, Math.floor(webgl.drawingBufferHeight / 24));
      let nonZeroSamples = 0;
      let samples = 0;
      const colors = new Set<string>();

      for (let y = 0; y < webgl.drawingBufferHeight; y += stepY) {
        for (let x = 0; x < webgl.drawingBufferWidth; x += stepX) {
          webgl.readPixels(x, y, 1, 1, webgl.RGBA, webgl.UNSIGNED_BYTE, pixel);

          if (pixel[0] || pixel[1] || pixel[2] || pixel[3]) {
            nonZeroSamples += 1;
            colors.add(`${pixel[0] >> 4}-${pixel[1] >> 4}-${pixel[2] >> 4}`);
          }

          samples += 1;
        }
      }

      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        nonZeroSamples,
        samples,
        colorBuckets: colors.size,
      };
    });

    if (stats.nonZeroSamples > 0) {
      return stats;
    }
  }

  return stats;
}

function createSamplePdf(): Buffer {
  const content = [
    "q",
    "0.98 0.99 0.98 rg 0 0 612 792 re f",
    "0.08 0.13 0.11 RG 10 w 80 160 452 0 0 300 -452 0 h S",
    "8 w 260 160 0 150 160 0 0 -150 S",
    "8 w 380 160 0 150 S",
    "0.1 0.41 0.82 RG 4 w 105 130 80 0 S",
    "Q",
    "",
  ].join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream\nendobj\n`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf);
}

test("London flat 3D model renders human room cameras on desktop", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await page.setViewportSize({ width: 1440, height: 980 });
  await page.goto("/projects/demo-london-flat/model");
  await expect(
    page.getByRole("heading", { name: "London flat model" }),
  ).toBeVisible();
  await expect(
    page.getByText(/could not be saved to the project log/i),
  ).toHaveCount(0);

  const stats = await webglCanvasStats(page);
  expect(stats.width).toBeGreaterThan(700);
  expect(stats.height).toBeGreaterThan(450);
  expect(stats.nonZeroSamples).toBeGreaterThan(0);
  expect(stats.samples).toBeGreaterThan(0);

  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(
    box!.x + box!.width * 0.5,
    box!.y + box!.height * 0.5,
  );
  await page.mouse.wheel(0, -650);
  await page.waitForTimeout(500);
  const beforeVariant = await page.screenshot({ fullPage: true });

  await page.getByRole("button", { name: "Rental Staging" }).click();
  await expect(
    page.getByRole("button", { name: "Rental Staging" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(500);
  const afterVariant = await page.screenshot({ fullPage: true });

  expect(byteDiff(beforeVariant, afterVariant)).toBeGreaterThan(1_000);

  const beforeCamera = await page.screenshot({ fullPage: true });
  await page.getByRole("button", { name: /Living/ }).click();
  await expect(page.getByRole("button", { name: /Living/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.waitForTimeout(500);
  const afterCamera = await page.screenshot({ fullPage: true });
  expect(byteDiff(beforeCamera, afterCamera)).toBeGreaterThan(1_000);
  const livingStats = await webglCanvasStats(page);
  expect(livingStats.colorBuckets).toBeGreaterThan(6);

  const beforeStandingLook = await page.screenshot({ fullPage: true });
  await page.mouse.move(
    box!.x + box!.width * 0.52,
    box!.y + box!.height * 0.52,
  );
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width * 0.36,
    box!.y + box!.height * 0.46,
    { steps: 12 },
  );
  await page.mouse.up();
  await page.waitForTimeout(500);
  const afterStandingLook = await page.screenshot({ fullPage: true });
  expect(byteDiff(beforeStandingLook, afterStandingLook)).toBeGreaterThan(800);
  const draggedLivingStats = await webglCanvasStats(page);
  expect(draggedLivingStats.colorBuckets).toBeGreaterThan(6);

  const beforeRoomMove = await page.screenshot({ fullPage: true });
  await page.mouse.wheel(0, -220);
  await page.keyboard.down("w");
  await page.waitForTimeout(400);
  await page.keyboard.up("w");
  await page.waitForTimeout(500);
  const afterRoomMove = await page.screenshot({ fullPage: true });
  expect(byteDiff(beforeRoomMove, afterRoomMove)).toBeGreaterThan(500);
  const movedLivingStats = await webglCanvasStats(page);
  expect(movedLivingStats.colorBuckets).toBeGreaterThan(6);

  await page.getByRole("button", { name: /Bedroom \/ office/ }).click();
  await expect(
    page.getByRole("button", { name: /Bedroom \/ office/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(500);
  const bedroomStats = await webglCanvasStats(page);
  expect(bedroomStats.colorBuckets).toBeGreaterThan(6);

  const beforeWalkthrough = await page.screenshot({ fullPage: true });
  await page.getByRole("button", { name: /^Walkthrough$/ }).click();
  await expect(
    page.getByRole("button", { name: /^Walkthrough$/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(500);
  const afterWalkthrough = await page.screenshot({ fullPage: true });
  expect(byteDiff(beforeWalkthrough, afterWalkthrough)).toBeGreaterThan(1_000);
  const walkthroughStats = await webglCanvasStats(page);
  expect(walkthroughStats.colorBuckets).toBeGreaterThan(6);

  await page.getByRole("button", { name: /Auto tour/ }).click();
  await expect(
    page.getByRole("button", { name: /Auto tour/ }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /Capture view/ }).click();
  await expect(page.getByText(/Screenshot saved for report/)).toBeVisible();
});

test("London flat 3D model renders on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects/demo-london-flat/model");
  await expect(
    page.getByRole("heading", { name: "London flat model" }),
  ).toBeVisible();
  await expect(
    page.getByText(/could not be saved to the project log/i),
  ).toHaveCount(0);

  const stats = await webglCanvasStats(page);
  expect(stats.width).toBeGreaterThan(300);
  expect(stats.height).toBeGreaterThan(450);
  expect(stats.nonZeroSamples).toBeGreaterThan(0);
  expect(stats.samples).toBeGreaterThan(0);
});

test("London flat plan editor shows fixture geometry and supports manual wall drawing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/projects/${editorProjectId}/plan`);

  await expect(
    page.getByRole("heading", { name: "Confirm the floor plan." }),
  ).toBeVisible();
  await expect(page.getByText("10 walls")).toBeVisible();
  await expect(page.getByText("Scale 70 px/m")).toBeVisible();

  await page.getByRole("button", { name: /Draw/ }).click();
  const canvas = page
    .locator('[aria-label="Interactive floor plan canvas"] canvas')
    .first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + 120, box!.y + 120);
  await page.mouse.down();
  await page.mouse.move(box!.x + 260, box!.y + 160, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByText("1 manual")).toBeVisible();
  await expect(page.getByRole("button", { name: /Generate 3D/ })).toHaveAttribute(
    "aria-disabled",
    "false",
  );

  await page.getByRole("button", { name: /^Scale$/ }).click();
  await page.mouse.move(box!.x + 120, box!.y + 520);
  await page.mouse.down();
  await page.mouse.move(box!.x + 260, box!.y + 520, { steps: 8 });
  await page.mouse.up();
  await page.getByLabel("Reference length in metres").fill("2");
  await page.getByRole("button", { name: /Calibrate from line/ }).click();
  await expect(page.getByLabel("Pixels per metre")).not.toHaveValue("0");
  await expect(page.getByText(/Scale \d+ px\/m/)).toBeVisible();

  await page.getByRole("button", { name: /Door/ }).click();
  await page.getByRole("button", { name: /Window/ }).click();
  await page.getByLabel("Selected room label").fill("Primary suite");
  await expect(
    page.getByRole("button", { name: /Primary suite/ }),
  ).toBeVisible();
  await page.getByLabel("New room label").fill("Utility");
  await page.getByRole("button", { name: /Add room label/ }).click();
  await expect(page.getByRole("button", { name: /Utility/ })).toBeVisible();

  await page.getByRole("button", { name: /Save confirmed plan/ }).click();
  await expect(
    page.getByText(new RegExp(`Saved ${editorProjectId}-`)),
  ).toBeVisible();
});

test("upload flow accepts a custom floor plan and exposes parser fallback state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/projects/${uploadProjectId}/upload`);

  await expect(
    page.getByRole("heading", { name: "Bring in the floor plan." }),
  ).toBeVisible();

  await page
    .locator('input[type="file"]')
    .setInputFiles(join(fixtureDir, "parser-floorplan.svg"));

  await page.getByRole("button", { name: /^Upload$/ }).click();
  await expect(
    page.getByText(
      "Floor plan attached. Run parser proposal, then confirm the trace.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: /Parse proposal/ }).click();
  await expect(
    page.getByText("Parser proposal ready for review."),
  ).toBeVisible();
  await expect(
    page.getByText(/Parser found \d+ normalized SVG wall candidates/),
  ).toBeVisible();
  await expect(page.getByText("Detected walls")).toBeVisible();
  const detectedWalls = Number(
    await page
      .locator('[aria-label="Parse result"] strong')
      .nth(1)
      .textContent(),
  );
  expect(detectedWalls).toBeGreaterThanOrEqual(6);
});

test("PDF upload renders the first page in-browser and server fallback remains traceable", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/projects/${pdfProjectId}/upload`);

  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-floorplan.pdf",
    mimeType: "application/pdf",
    buffer: createSamplePdf(),
  });

  await page.getByRole("button", { name: /^Upload$/ }).click();
  await expect(page.getByText(/PDF first page rendered/)).toBeVisible({
    timeout: 15_000,
  });

  const previewSrc = await page
    .locator(".plan-preview img")
    .first()
    .getAttribute("src");
  expect(previewSrc).toMatch(/^data:image\/png;base64,/);
  expect(previewSrc).not.toContain("PDF preview fallback");

  await page.getByRole("button", { name: /Parse proposal/ }).click();
  await expect(
    page.getByText("Fallback parse ready for manual trace."),
  ).toBeVisible();
  await expect(
    page.getByText(/low-confidence bounding-room proposal/),
  ).toBeVisible();

  const fallbackResponse = await request.post(
    `/api/projects/${pdfFallbackProjectId}/upload-floorplan`,
    {
      multipart: {
        file: {
          name: "server-fallback.pdf",
          mimeType: "application/pdf",
          buffer: createSamplePdf(),
        },
        imageWidth: "980",
        imageHeight: "700",
      },
    },
  );
  const fallbackPayload = await fallbackResponse.json();
  expect(fallbackPayload.ok).toBe(true);
  expect(fallbackPayload.data.previewKind).toBe("pdf-fallback");
  expect(fallbackPayload.data.planImageUrl).toContain("data:image/svg+xml");
});

test("project APIs persist plan, events, and share lookup through the store adapter", async ({
  request,
}) => {
  const createResponse = await request.post("/api/projects", {
    data: { title: "Persistence API test" },
  });
  const createPayload = await createResponse.json();
  expect(createPayload.ok).toBe(true);
  const projectId = createPayload.data.projectId as string;

  const planResponse = await request.put(`/api/projects/${projectId}/plan`, {
    data: { plan: apiPlan },
  });
  const planPayload = await planResponse.json();
  expect(planPayload.ok).toBe(true);
  expect(planPayload.data.project.plan.walls).toHaveLength(4);
  expect(planPayload.data.project.plan.openings).toHaveLength(1);
  expect(planPayload.data.project.plan.rooms).toHaveLength(1);

  const shareResponse = await request.post(`/api/projects/${projectId}/share`);
  const sharePayload = await shareResponse.json();
  expect(sharePayload.ok).toBe(true);

  const publicResponse = await request.get(
    `/api/share/${sharePayload.data.shareToken}`,
  );
  const publicPayload = await publicResponse.json();
  expect(publicPayload.ok).toBe(true);
  expect(publicPayload.data.project.id).toBe(projectId);
  expect(publicPayload.data.project.plan.rooms[0].label).toBe("API room");

  const variantResponse = await request.post(
    `/api/projects/${projectId}/generate-variant`,
    {
      data: {
        prompt: "Make the room a compact work-from-home studio.",
        stylePreset: "Compact Family",
        budgetLevel: "premium",
        useIntent: "work-from-home",
        householdType: "hybrid worker",
        roomPriorities: ["api-room", "missing-room"],
      },
    },
  );
  const variantPayload = await variantResponse.json();
  expect(variantPayload.ok).toBe(true);
  expect(variantPayload.data.variant.intent.budgetLevel).toBe("premium");
  expect(variantPayload.data.variant.intent.roomPriorities).toEqual([
    "api-room",
  ]);
  expect(variantPayload.data.variant.rationale).toContain("premium");
  expect(
    variantPayload.data.variant.furniture.every(
      (item: { roomId: string }) => item.roomId === "api-room",
    ),
  ).toBe(true);

  const screenshotResponse = await request.post(
    `/api/projects/${projectId}/screenshots`,
    {
      data: {
        imageDataUrl: `data:image/png;base64,${Buffer.from("png").toString("base64")}`,
        variantName: variantPayload.data.variant.name,
        cameraPreset: "API camera",
      },
    },
  );
  const screenshotPayload = await screenshotResponse.json();
  expect(screenshotPayload.ok).toBe(true);

  const reportResponse = await request.post(
    `/api/projects/${projectId}/report`,
  );
  const reportPayload = await reportResponse.json();
  expect(reportPayload.ok).toBe(true);
  expect(reportPayload.data.screenshotId).toBe(
    screenshotPayload.data.screenshot.id,
  );

  const eventsResponse = await request.get("/api/events");
  const eventsPayload = await eventsResponse.json();
  expect(eventsPayload.ok).toBe(true);
  expect(
    eventsPayload.data.events.some(
      (event: { name: string; projectId?: string }) =>
        event.name === "share_created" && event.projectId === projectId,
    ),
  ).toBe(true);
});

test("variant, report, share, and proof flows create observable hackathon events", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/projects/demo-london-flat/design");

  await page.getByRole("button", { name: "Premium" }).click();
  await page.getByRole("button", { name: "resale uplift" }).click();
  await page.getByRole("button", { name: "family", exact: true }).click();
  await page.getByRole("button", { name: "Resale Neutral" }).click();
  await page.getByRole("button", { name: /Generate variant/ }).click();
  await expect(
    page.getByRole("heading", { name: "Resale Neutral" }),
  ).toBeVisible();
  await expect(page.getByText(/Fits a premium budget/)).toBeVisible();

  await page.goto("/projects/demo-london-flat/model?variant=Resale%20Neutral");
  await page.getByRole("button", { name: /Bedroom \/ office/ }).click();
  await page.getByRole("button", { name: /Capture view/ }).click();
  await expect(page.getByText(/Screenshot saved for report/)).toBeVisible();

  await page.goto("/projects/demo-london-flat/report");
  await expect(page.getByText("Captured 3D view")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Variant comparison" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What changed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Room-by-room brief" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Warnings and disclaimers" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Print$/ })).toBeVisible();
  await page.getByRole("button", { name: /Record report export/ }).click();
  await expect(page.getByText(/Report export recorded/)).toBeVisible();
  await page.getByRole("button", { name: /Create share view/ }).click();

  const shareLink = page.locator(".share-url").first();
  await expect(shareLink).toContainText("/share/");
  await shareLink.click();
  await expect(
    page.getByRole("heading", { name: /Sample London flat concept/ }),
  ).toBeVisible();
  await expect(page.getByText("Read-only walkthrough")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Room-by-room brief" }),
  ).toBeVisible();

  await page.goto("/novus-proof");
  await expect(page.getByText("variant_generated").first()).toBeVisible();
  await expect(page.getByText("report_exported").first()).toBeVisible();
  await expect(page.getByText("share_created").first()).toBeVisible();
});
