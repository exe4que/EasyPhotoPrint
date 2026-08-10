## Purpose

The image-decoding capability defines the single contract Main-process code uses to decode, resize, crop, and encode image bytes — for PDF composition, image ingest/thumbnails, and print-resolution preview — so that logic never hardcodes a host-specific image API directly and can be repointed at a different decoder implementation without changing its own code.

## ADDED Requirements

### Requirement: Pixel Operations Go Through a Single Decoder Contract
Main-process code that decodes, resizes, crops, or encodes image bytes SHALL do so exclusively through the `ImageDecoder`/`DecodedImage` contract, obtained at the point of use, never by importing or calling a host-specific image API (such as Electron's `nativeImage`) directly.

#### Scenario: PDF composition uses the decoder contract
- **WHEN** composing a project's pages into a PDF and an image needs to be decoded, optionally cropped, resized, and encoded for embedding
- **THEN** that work SHALL happen through the `ImageDecoder`/`DecodedImage` contract

#### Scenario: Ingest and preview decoding use the decoder contract
- **WHEN** an ingested image's thumbnail is generated, a re-opened project's image is re-extracted, or a print-resolution preview image is decoded at a requested size
- **THEN** that work SHALL happen through the `ImageDecoder`/`DecodedImage` contract

#### Scenario: Only one file binds to the host-specific image API
- **WHEN** the application runs on the Electron host
- **THEN** exactly one file — the Electron decoder implementation — SHALL import `nativeImage` from `electron`
- **AND** no other Main-process file SHALL reference it

### Requirement: The Electron Decoder Implementation Is a Behavior-Preserving Pass-Through
The Electron implementation of the decoder contract SHALL return the host's own decoded-image object directly from `decodeFromPath`, without re-encoding, re-wrapping, or otherwise transforming it, so that PDF output, thumbnails, and print-resolution previews are byte-for-byte identical to what they were before this contract existed.

#### Scenario: Decoding on Electron returns the native decoded image unmodified
- **WHEN** `decodeFromPath` is called on the Electron decoder implementation
- **THEN** the returned `DecodedImage` SHALL be the host's own native decoded-image object, not a copy or a wrapper around it

#### Scenario: Output is unaffected by the contract's introduction
- **WHEN** the same project is composed to PDF, or the same image is ingested/thumbnailed/previewed, before and after this contract's introduction
- **THEN** the resulting bytes SHALL be identical
