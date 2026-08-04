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

export interface Sides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type HorizontalAlignment = 'left' | 'center' | 'right' | 'expand';
export type VerticalAlignment = 'top' | 'center' | 'bottom' | 'expand';

export interface AlignmentConfig {
  horizontal?: HorizontalAlignment;
  vertical?: VerticalAlignment;
}

export type LayoutNodeType = 'grid' | 'horizontal' | 'vertical' | 'imageSlot' | 'freeformCanvas';
export type ScalingRule = 'fitInParent' | 'envelopeParent' | 'stretch' | 'specificSize';
export type PageSizePreset = 'A4' | 'Letter' | 'Legal' | '4x6' | '5x7' | 'A3' | 'Custom';

export interface FixedSizeMm {
  widthMm?: number;
  heightMm?: number;
}

export interface GridConfig {
  rows: number;
  columns: number;
  autoFit?: boolean;
  rowGapMm?: number;
  columnGapMm?: number;
}

export interface FocalPoint {
  x: number;
  y: number;
}

export interface SpecificSizeMm {
  widthMm: number;
  heightMm: number;
  /** Which axis the user typed in directly — the other is derived from it + the asset's aspect ratio. */
  lockedAxis: 'width' | 'height' | 'both';
}

export interface ImageSlotConfig {
  aspectRatio?: number;
  scalingRule?: ScalingRule;
  focalPoint?: FocalPoint;
  /** Only meaningful when scalingRule === 'specificSize'. Both fields are always resolved (never partial). */
  specificSizeMm?: SpecificSizeMm;
}

export interface FreeformTransform {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
  lockAspectRatio?: boolean;
}

export interface FreeformElement {
  id: string;
  imageNodeId: string;
  zIndex?: number;
  transform: FreeformTransform;
}

export interface LayoutNode {
  id: string;
  type: LayoutNodeType;
  sizeRatio?: number;
  fixedSizeMm?: FixedSizeMm;
  alignment?: AlignmentConfig;
  gapMm?: number;
  paddingMm?: Partial<Sides>;
  gridConfig?: GridConfig;
  imageSlotConfig?: ImageSlotConfig;
  freeformElements?: FreeformElement[];
  children?: LayoutNode[];
}

export interface ImageAsset {
  id: string;
  originalPath: string;
  storedPath: string;
  fileName: string;
  widthPx: number;
  heightPx: number;
  dpiOriginal?: number;
  thumbnailDataUrl: string;
}

export interface PageConfig {
  sizePreset: PageSizePreset;
  customSizeMm?: {
    widthMm: number;
    heightMm: number;
  };
  orientation: 'portrait' | 'landscape';
  dpi: number;
}

export interface EPPTemplate {
  schemaVersion: '1.0.0';
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  page: PageConfig;
  rootNode: LayoutNode;
}

export interface EPPProjectPage {
  id: string;
  pageConfig: PageConfig;
  templateRef?: string;
  rootNode: LayoutNode;
  assignments: Record<string, string>;
}

export interface EPPProject {
  schemaVersion: '1.0.0';
  id: string;
  name: string;
  pages: EPPProjectPage[];
  imagePool: ImageAsset[];
}

export interface FeasibilityWarning {
  nodeId: string;
  axis: 'w' | 'h';
  requiredMm: number;
  availableMm: number;
}

export interface EnvelopeCrop {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FitInParentBox {
  offsetXMm: number;
  offsetYMm: number;
  widthMm: number;
  heightMm: number;
}

export interface StretchResult {
  widthMm: number;
  heightMm: number;
  distortionWarning: boolean;
}

export interface TemplateReconciliationResult {
  rootNode: LayoutNode;
  assignments: Record<string, string>;
  removedAssignments: Record<string, string>;
  preservedSlotIds: string[];
  addedSlotIds: string[];
}

