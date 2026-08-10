export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;
export const MICRONS_PER_MM = 1000;

export type UnitSystem = 'metric' | 'imperial';

export interface BoxMm {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoxPt {
  x: number;
  y: number;
  width: number;
  height: number;
}

function assertPositiveScale(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number.`);
  }
}

export function mmToPx(mm: number, zoomLevel = 1, screenDpi = 96): number {
  assertPositiveScale(zoomLevel, 'zoomLevel');
  assertPositiveScale(screenDpi, 'screenDpi');
  return (mm / MM_PER_INCH) * screenDpi * zoomLevel;
}

export function pxToMm(px: number, zoomLevel = 1, screenDpi = 96): number {
  assertPositiveScale(zoomLevel, 'zoomLevel');
  assertPositiveScale(screenDpi, 'screenDpi');
  return (px / (screenDpi * zoomLevel)) * MM_PER_INCH;
}

export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * PT_PER_INCH;
}

/** Electron's print `pageSize` is expressed in microns, and only accepts whole numbers. */
export function mmToMicrons(mm: number): number {
  return Math.round(mm * MICRONS_PER_MM);
}

export function mmToInches(mm: number): number {
  return mm / MM_PER_INCH;
}

export function inchesToMm(inches: number): number {
  return inches * MM_PER_INCH;
}

export function displayLengthStepToMm(step: number, unitSystem: UnitSystem): number {
  return unitSystem === 'imperial' ? inchesToMm(step) : step;
}

export function formatLength(mm: number, unitSystem: UnitSystem): string {
  return unitSystem === 'imperial' ? `${mmToInches(mm).toFixed(2)}"` : `${mm.toFixed(1)}mm`;
}

export function parseLength(input: string, unitSystem: UnitSystem): number {
  const numericValue = Number.parseFloat(input.replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(numericValue)) {
    throw new Error(`Could not parse a numeric length from "${input}".`);
  }

  return unitSystem === 'imperial' ? inchesToMm(numericValue) : numericValue;
}

export function domainToPdfCoords(box: BoxMm, pageHeightMm: number): BoxPt {
  return {
    x: mmToPt(box.x),
    y: mmToPt(pageHeightMm - box.y - box.h),
    width: mmToPt(box.w),
    height: mmToPt(box.h),
  };
}
