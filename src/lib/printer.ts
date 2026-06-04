export abstract class Printer<
  TStatus extends PrinterStatus = PrinterStatus,
> extends EventTarget {
  abstract get driverName(): string;
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract print(img: ImageData): Promise<void>;
  abstract cancelPrint(): void;
  abstract status: TStatus;
  abstract name: string | undefined;

  setStatus(status: Partial<TStatus>) {
    this.status = { ...this.status, ...status };
    // console.dir({ setStatus: this.status });
    this.dispatchEvent(new PrinterStatusEvent<TStatus>(this.status));
  }
}

export type PrinterState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "printing";

export interface PrinterStatus {
  state: PrinterState;
}

export class PrinterStatusEvent<TStatus> extends Event {
  status: TStatus;

  constructor(status: TStatus) {
    super("status");
    this.status = status;
  }
}

export class PrinterErrorEvent extends Event {
  msg: string;

  constructor(msg: string) {
    super("error");
    this.msg = msg;
  }
}
