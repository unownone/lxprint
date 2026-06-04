import { PrinterContextProvider } from "./context.tsx";
import { AppShell } from "./components/layout/AppShell.tsx";
import Printer from "./Printer.tsx";
import { LabelMaker } from "./Label.tsx";

function App() {
  return (
    <PrinterContextProvider>
      <AppShell>
        <Printer />
        <LabelMaker />
      </AppShell>
    </PrinterContextProvider>
  );
}

export default App;
