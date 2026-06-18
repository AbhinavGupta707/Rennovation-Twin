import type { DesignVariantSchema } from "@renovation-twin/types";

export function getFallbackVariant(variants: DesignVariantSchema[], index = 0): DesignVariantSchema {
  if (!variants.length) {
    throw new Error("No fallback variants are available.");
  }

  return variants[index % variants.length]!;
}
