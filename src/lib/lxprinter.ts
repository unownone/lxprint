import "core-js/proposals/array-buffer-base64";

import { BitmapData } from "./bitmap.ts";
import { Printer, type PrinterStatus, PrinterErrorEvent } from "./printer.ts";

function crc16xmodem(data: Uint8Array): number {
  return data.reduce((crc: number, x: number) => {
    crc ^= x << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
    return crc & 0xffff;
  }, 0);
}

export interface LXPrinterStatus extends PrinterStatus {
  battery?: number;
  noPaper?: boolean;
  charging?: boolean;
  overheat?: boolean;
  lowBatt?: boolean;
  density?: number;
  voltage?: number;
  unk1?: number;
  unk2?: number;
}

function parseStatusMsg(msg: Uint8Array): Omit<PrinterStatus, "state"> {
  const d = new DataView(msg.buffer);
  return {
    battery: d.getUint8(2),
    noPaper: !!d.getUint8(3),
    charging: !!d.getUint8(4),
    overheat: !!d.getUint8(5),
    lowBatt: !!d.getUint8(6),
    density: d.getUint8(7),
    voltage: d.getUint16(8),
    unk1: d.getUint8(10),
    unk2: d.getUint8(11),
  };
}

export class LXPrinter extends Printer<LXPrinterStatus> {
  dev?: BluetoothDevice;
  _name?: string;
  server?: BluetoothRemoteGATTServer;
  service?: BluetoothRemoteGATTService;
  recvChar?: BluetoothRemoteGATTCharacteristic;
  sendChar?: BluetoothRemoteGATTCharacteristic;

  onDisconnected: (event: Event) => Promise<void>;
  recvHandler: (event: Event) => Promise<void>;

  status: PrinterStatus = { state: "disconnected" };
  // statusCallback?: (status: PrinterStatus) => void;

  connectTimeout?: number;
  // error?: string;

  mac?: Uint8Array;
  authBytes?: Uint8Array;
  authCrc?: number[];

  printingImage?: BitmapData;
  private resolvePrintStartAck?: () => void;
  /** Flow-control credits from 0x5a 0x07 (typically 0x14 = 20 lines per grant). */
  private flowCredits = 0;
  private releaseFlowWait?: () => void;
  /** True while print() is sending raster packets. */
  private printTxActive = false;
  private printAbortRequested = false;
  /** True after all 0x55 lines and the end marker have been written. */
  private printTxDone = false;
  private pendingDoneMsg?: Uint8Array;
  private resolvePrintDone?: () => void;
  private doneAckSent = false;

  get driverName(): string {
    return "lx";
  }

  get name(): string | undefined {
    return this._name;
  }

  constructor() {
    super();
    // this.statusCallback = statusCallback;
    this.recvHandler = async (event: Event) => await this.receiveMessage(event);
    this.onDisconnected = async (_: Event) => {
      this.error("Disconnected");
      await this.disconnect();
    };
  }

  // static async connect() {
  //   const printer = new LXPrinter();
  //   await printer.init();
  //   return printer;
  // }

  // setStatus(status: Partial<PrinterStatus>) {
  //   this.status = {...this.status, ...status};
  //   if (this.statusCallback) this.statusCallback(status);
  // }

  error(msg: string) {
    this.dispatchEvent(new PrinterErrorEvent(msg));
  }

  async connect() {
    try {
      this.connectTimeout = setTimeout(() => {
        this.error("Connection Timeout");
        this.disconnect();
      }, 30000);
      this.setStatus({ state: "connecting" });
      // this.error = undefined;
      this.dev = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "LX" }],
        optionalServices: [0xffe6],
      });
      if (!this.dev?.gatt) throw new Error("No dev");
      this._name = this.dev.name;
      this.dev.addEventListener("gattserverdisconnected", this.onDisconnected);

      this.server = await this.dev.gatt.connect();
      if (!this.server) throw new Error("No GATT server");

      for (let i = 0; i < 4; i++) {
        if (i > 2)
          throw new Error("Failed to get GATT service after 3 retries");
        try {
          await this.server.getPrimaryServices();
          this.service = await this.server.getPrimaryService(0xffe6);
          if (!this.service) throw new Error("No service");
          i = 5;
        } catch (err) {
          console.log(`Failed to get GATT service, attempt ${i + 1}: ${err}`);
        }
      }
      if (!this.service) throw new Error("No service");
      this.sendChar = await this.service.getCharacteristic(0xffe1);
      this.recvChar = await this.service.getCharacteristic(0xffe2);

      await this.recvChar.startNotifications();
      this.recvChar.addEventListener(
        "characteristicvaluechanged",
        this.recvHandler,
      );

      await this.sendChar.writeValueWithoutResponse(
        new Uint8Array([0x5a, 0x01]),
      );
    } catch (err: any) {
      this.error("Connection Error");
      console.dir(err);
      await this.disconnect();
    }
  }

  async authStage1(msg: Uint8Array) {
    this.mac = msg.slice(4, 10);
    console.dir(this.mac);
    this.authBytes = new Uint8Array(10);
    crypto.getRandomValues(this.authBytes);
    if (!this.authBytes) return;
    if (!this.mac) return;
    this.authCrc = Array.from(this.authBytes).map((x: number): number => {
      const y = new Uint8Array(7);
      y[0] = x;
      y.set(this.mac || new Uint8Array(6), 1);
      return crc16xmodem(y);
    });

    const newMsg = new Uint8Array([0x5a, 0x0a, ...this.authBytes]);
    await this.sendChar?.writeValueWithoutResponse(newMsg);
  }

  async authStage2(_: Uint8Array) {
    // We don't bother to verify the incoming message, but it should be 0x5a0a + authCrc.map(x => x & 0xFF)

    if (!this.authCrc) throw new Error("No authCrc");
    const newMsg = new Uint8Array([
      0x5a,
      0x0b,
      ...this.authCrc.map((x) => x >> 8),
    ]);
    await this.sendChar?.writeValueWithoutResponse(newMsg);
  }

  async disconnect() {
    clearTimeout(this.connectTimeout);
    this.connectTimeout = undefined;
    try {
      console.log("Stopping notifications");
      await this.recvChar?.stopNotifications();
      this.recvChar?.removeEventListener(
        "characteristicvaluechanged",
        this.recvHandler,
      );
    } catch {
      console.log("Failed to stop notifications");
    }

    try {
      console.log("Removing disconnect handler");
      this.dev?.removeEventListener(
        "gattserverdisconnected",
        this.onDisconnected,
      );
    } catch {
      console.log("Failed to remove disconnect handler");
    }

    this.dev = undefined;
    this._name = undefined;
    this.server = undefined;
    this.service = undefined;
    this.sendChar = undefined;
    this.recvChar = undefined;
    this.mac = undefined;
    this.authBytes = undefined;
    this.authCrc = undefined;
    this.setStatus({ state: "disconnected" });
  }

  async authResult(msg: Uint8Array) {
    if (msg[2] !== 1) {
      await this.disconnect();
      return;
    }
    clearTimeout(this.connectTimeout);
    this.connectTimeout = undefined;
    this.setStatus({ state: "connected" });
  }

  async receiveMessage(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;
    const msg = new Uint8Array(target.value.buffer);

    if (msg[0] !== 0x5a) return;

    switch (msg[1]) {
      case 0x01:
        console.log("Auth Stage 1", msg.toHex());
        return await this.authStage1(msg);
      case 0x0a:
        console.log("Auth Stage 2", msg.toHex());
        return await this.authStage2(msg);
      case 0x0b:
        console.log("Auth Result", msg.toHex());
        return await this.authResult(msg);
      case 0x02:
        console.log("Status", msg.toHex());
        return this.setStatus(parseStatusMsg(msg));
      case 0x04:
        return this.onPrintAck(msg);
      case 0x06:
        console.log("Done Printing", msg.toHex());
        return await this.donePrinting(msg);
      case 0x07:
        return this.onFlowControl(msg);
      default:
        console.log("Unknown Message: ", msg.toHex());
    }
  }

  private grantFlowCredits(count: number) {
    this.flowCredits += count;
    const release = this.releaseFlowWait;
    this.releaseFlowWait = undefined;
    release?.();
  }

  /** Pace TX when the printer grants credits; do not block forever if 0x07 stops. */
  private async waitFlowCredit(): Promise<void> {
    if (this.flowCredits > 0) {
      this.flowCredits--;
      return;
    }
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 75);
      this.releaseFlowWait = () => {
        clearTimeout(t);
        resolve();
      };
    });
    if (this.flowCredits > 0) {
      this.flowCredits--;
    }
  }

  /** Start-of-job ACK (0x5a 0x04 …, flags/code zero). End-of-job uses flags=0x01. */
  onPrintAck(msg: Uint8Array) {
    const dv = new DataView(msg.buffer);
    const lineCount = dv.getUint16(2);
    const flags = msg[4];
    const code = msg[5];
    console.log(
      `Print ACK: lines=${lineCount} flags=0x${flags.toString(16)} code=0x${code.toString(16)}`,
      msg.toHex(),
    );
    if (flags === 0 && code === 0) {
      this.resolvePrintStartAck?.();
      this.resolvePrintStartAck = undefined;
    }
  }

  /** Buffer credits (byte 2 is often 0x14 = 20 lines) before sending raster data. */
  onFlowControl(msg: Uint8Array) {
    console.log(`Flow control credits=${msg[2]}`, msg.toHex());
    this.grantFlowCredits(msg[2]);
  }

  /** 0x06 done: uint16 BE @2 = packet count; byte 4 often 0x01 when job finished. */
  async donePrinting(msg: Uint8Array) {
    const dv = new DataView(msg.buffer);
    const packetCount = dv.getUint16(2);
    const status = msg[4];
    console.log(
      `Done Printing: packets=${packetCount} status=0x${status.toString(16)}`,
      msg.toHex(),
    );

    if (!this.printTxDone) {
      console.log("Done received before TX complete — deferring ACK");
      this.pendingDoneMsg = msg;
      return;
    }

    await this.ackDonePrinting(msg);
  }

  async ackDonePrinting(msg: Uint8Array) {
    if (this.doneAckSent) return;
    this.doneAckSent = true;
    const dv = new DataView(msg.buffer);
    const packetCount = dv.getUint16(2);
    await this.sendChar?.writeValueWithoutResponse(
      new Uint8Array([
        0x5a,
        0x04,
        packetCount >> 8,
        packetCount & 0xff,
        0x01,
        0x00,
      ]),
    );
    this.pendingDoneMsg = undefined;
    this.resolvePrintDone?.();
    this.resolvePrintDone = undefined;
    this.setStatus({ state: "connected" });
  }

  private async waitForPrintDone(timeoutMs = 120_000): Promise<void> {
    if (this.pendingDoneMsg) return;
    await Promise.race([
      new Promise<void>((resolve) => {
        this.resolvePrintDone = resolve;
      }),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Print done timeout")), timeoutMs),
      ),
    ]);
  }

  cancelPrint(): void {
    if (!this.printTxActive) return;
    this.printAbortRequested = true;
    const release = this.releaseFlowWait;
    this.releaseFlowWait = undefined;
    release?.();
    this.resolvePrintStartAck?.();
    this.resolvePrintStartAck = undefined;
    this.resolvePrintDone?.();
    this.resolvePrintDone = undefined;
  }

  async print(img: ImageData) {
    if (this.printTxActive) throw new Error("Print already in progress");
    this.setStatus({ state: "printing" });

    this.printingImage = new BitmapData(img);
    this.printTxActive = true;
    this.printAbortRequested = false;
    this.printTxDone = false;
    this.pendingDoneMsg = undefined;
    this.doneAckSent = false;
    this.flowCredits = 0;

    const expectedPackets = this.printingImage.printLength;
    const msg = new Uint8Array(6);
    const dv = new DataView(msg.buffer);
    msg.set([0x5a, 0x04]);
    dv.setUint16(2, expectedPackets + 1);

    try {
      const startAck = new Promise<void>((resolve) => {
        this.resolvePrintStartAck = resolve;
      });
      await this.sendChar?.writeValueWithoutResponse(msg);
      await Promise.race([
        startAck,
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("Print start ACK timeout")), 5000),
        ),
      ]);

      for (const line of this.printingImage.generatePrintData()) {
        if (this.printAbortRequested) break;
        await this.waitFlowCredit();
        if (this.printAbortRequested) break;
        await this.sendChar?.writeValueWithoutResponse(line);
      }

      if (this.printAbortRequested) {
        this.setStatus({ state: "connected" });
        return;
      }

      const lastLine = new Uint8Array(100);
      lastLine.set([
        0x55,
        expectedPackets >> 8,
        expectedPackets & 0xff,
      ]);
      await this.waitFlowCredit();
      await this.sendChar?.writeValueWithoutResponse(lastLine);

      this.printTxDone = true;
      if (this.pendingDoneMsg) {
        await this.ackDonePrinting(this.pendingDoneMsg);
      } else {
        await this.waitForPrintDone();
        if (this.pendingDoneMsg) {
          await this.ackDonePrinting(this.pendingDoneMsg);
        }
      }
    } finally {
      this.printTxActive = false;
      this.printTxDone = false;
      this.printAbortRequested = false;
      this.resolvePrintStartAck = undefined;
      this.resolvePrintDone = undefined;
      this.pendingDoneMsg = undefined;
    }
  }
}
