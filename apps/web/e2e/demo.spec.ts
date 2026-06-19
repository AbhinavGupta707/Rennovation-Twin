import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

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
  await page.locator("canvas").first().waitFor();
  await page.waitForTimeout(900);

  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");

    if (!canvas) {
      return { width: 0, height: 0, nonZeroSamples: 0, samples: 0 };
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
      };
    }

    const webgl = gl as WebGLRenderingContext;
    const pixel = new Uint8Array(4);
    const stepX = Math.max(1, Math.floor(webgl.drawingBufferWidth / 80));
    const stepY = Math.max(1, Math.floor(webgl.drawingBufferHeight / 60));
    let nonZeroSamples = 0;
    let samples = 0;

    for (let y = 0; y < webgl.drawingBufferHeight; y += stepY) {
      for (let x = 0; x < webgl.drawingBufferWidth; x += stepX) {
        webgl.readPixels(x, y, 1, 1, webgl.RGBA, webgl.UNSIGNED_BYTE, pixel);

        if (pixel[0] || pixel[1] || pixel[2] || pixel[3]) {
          nonZeroSamples += 1;
        }

        samples += 1;
      }
    }

    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      nonZeroSamples,
      samples,
    };
  });
}

test("London flat 3D model renders, orbits, and changes variants on desktop and mobile", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 980 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/projects/demo-london-flat/model");
    await expect(
      page.getByRole("heading", { name: "London flat model" }),
    ).toBeVisible();

    const stats = await webglCanvasStats(page);
    expect(stats.width).toBeGreaterThan(viewport.width > 500 ? 700 : 300);
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
  }
});

test("London flat plan editor shows fixture geometry and supports manual wall drawing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/projects/demo-london-flat/plan");

  await expect(
    page.getByRole("heading", { name: "Confirm the London flat plan." }),
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
  await expect(page.getByRole("link", { name: /Generate 3D/ })).toHaveAttribute(
    "aria-disabled",
    "false",
  );
});

test("upload flow accepts a custom floor plan and exposes parser fallback state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/projects/e2e-upload/upload");

  await expect(
    page.getByRole("heading", { name: "Bring in the floor plan." }),
  ).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-floorplan.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="980" height="700"><rect width="980" height="700" fill="#fbfcfa"/><path d="M80 70H900V620H80Z" fill="none" stroke="#14201c" stroke-width="10"/></svg>',
    ),
  });

  await page.getByRole("button", { name: /^Upload$/ }).click();
  await expect(
    page.getByText(
      "Floor plan attached. Run parse fallback, then confirm the trace.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: /Parse fallback/ }).click();
  await expect(
    page.getByText("Fallback parse ready for manual trace."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Automatic parsing is in fallback mode. Use manual trace to confirm walls, openings, and scale.",
    ),
  ).toBeVisible();
});

test("variant, report, share, and proof flows create observable hackathon events", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/projects/demo-london-flat/design");

  await page.getByRole("button", { name: "Resale Neutral" }).click();
  await page.getByRole("button", { name: /Generate variant/ }).click();
  await expect(
    page.getByRole("heading", { name: "Resale Neutral" }),
  ).toBeVisible();

  await page.goto("/projects/demo-london-flat/report");
  await page.getByRole("button", { name: /Record report export/ }).click();
  await expect(page.getByText(/Report export recorded/)).toBeVisible();
  await page.getByRole("button", { name: /Create share view/ }).click();

  const shareLink = page.locator(".share-url").first();
  await expect(shareLink).toContainText("/share/");
  await shareLink.click();
  await expect(
    page.getByRole("heading", { name: "Sample London flat" }),
  ).toBeVisible();

  await page.goto("/novus-proof");
  await expect(page.getByText("variant_generated")).toBeVisible();
  await expect(page.getByText("report_exported")).toBeVisible();
  await expect(page.getByText("share_created")).toBeVisible();
});
