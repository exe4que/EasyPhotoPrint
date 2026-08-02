import { describe, expect, it } from 'vitest';

import {
  displayLengthStepToMm,
  domainToPdfCoords,
  formatLength,
  inchesToMm,
  mmToInches,
  mmToPt,
  parseLength,
  pxToMm,
} from './units.js';

describe('units', () => {
  it('formats and parses metric lengths', () => {
    expect(formatLength(12.34, 'metric')).toBe('12.3mm');
    expect(parseLength('12.3mm', 'metric')).toBeCloseTo(12.3);
  });

  it('formats and parses imperial lengths', () => {
    expect(formatLength(25.4, 'imperial')).toBe('1.00"');
    expect(parseLength('1.00"', 'imperial')).toBeCloseTo(25.4);
  });

  it('converts between mm, px and pt', () => {
    expect(mmToPt(25.4)).toBeCloseTo(72);
    expect(pxToMm(96)).toBeCloseTo(25.4);
    expect(mmToInches(inchesToMm(3.5))).toBeCloseTo(3.5);
    expect(displayLengthStepToMm(0.1, 'metric')).toBeCloseTo(0.1);
    expect(displayLengthStepToMm(0.1, 'imperial')).toBeCloseTo(2.54);
  });

  it('maps the domain box into the PDF coordinate system', () => {
    expect(domainToPdfCoords({ x: 10, y: 20, w: 30, h: 40 }, 100)).toEqual({
      x: mmToPt(10),
      y: mmToPt(40),
      width: mmToPt(30),
      height: mmToPt(40),
    });
  });
});
