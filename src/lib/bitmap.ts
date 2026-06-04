export class BitmapData {
  img: ImageData;
  bitmap: Uint8ClampedArray;

  constructor(img: ImageData) {
    this.img = img;
    this.bitmap = new Uint8ClampedArray(img.data.length / 32);
    const data = img.data;
    for (let i = 0; i < this.bitmap.length; i++) {
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        byte = byte << 1;
        byte += BitmapData.isPixelOn(data, (i * 8 + j) * 4) ? 1 : 0;
      }
      this.bitmap[i] = byte;
    }
  }

  /** Dark opaque pixels print; light/transparent pixels do not. */
  static isPixelOn(data: Uint8ClampedArray, offset: number): boolean {
    const a = data[offset + 3]!;
    if (a === 0) return false;
    const lum =
      0.299 * data[offset]! +
      0.587 * data[offset + 1]! +
      0.114 * data[offset + 2]!;
    return lum < 128;
  }

  // LX: each 0x55 packet carries 96 bytes = two raster rows; index is packet #.
  *generatePrintData() {
    for (let i = 0; i < this.printLength; i++) {
      const line = new Uint8Array(100);
      const dv = new DataView(line.buffer);
      dv.setUint8(0, 0x55);
      dv.setUint16(1, i);
      line.set(this.bitmap.slice(i * 96, (i + 1) * 96), 3);
      yield line;
    }
  }

  get printLength() {
    return Math.ceil(this.bitmap.length / 96);
  }
}
