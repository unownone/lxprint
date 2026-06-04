import { use } from "react";
import { PrinterContext } from "./context";

export default function Info() {
  const { printer, printerStatus } = use(PrinterContext);

  return (
    <div>
      <h2>Printer Information</h2>
      <p>Printer Name: {printer?.name}</p>
      <p>Printer Status: {printerStatus.state}</p>
      <p>Printer Driver: {printer?.driverName}</p>
    </div>
  );
}
