// Decompiles every function in the current program and writes the pseudocode to one C file.
// Usage (headless): -postScript ExportAllDecompiled.java <output.c>
import java.io.PrintWriter;

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;

public class ExportAllDecompiled extends GhidraScript {
	@Override
	public void run() throws Exception {
		String out = getScriptArgs()[0];
		DecompInterface ifc = new DecompInterface();
		ifc.openProgram(currentProgram);
		int done = 0, failed = 0;
		try (PrintWriter w = new PrintWriter(out, "UTF-8")) {
			for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
				if (monitor.isCancelled()) {
					break;
				}
				DecompileResults r = ifc.decompileFunction(f, 60, monitor);
				w.println("// ===== " + f.getName() + " @ " + f.getEntryPoint());
				if (r != null && r.decompileCompleted()) {
					w.println(r.getDecompiledFunction().getC());
					done++;
				}
				else {
					w.println("// decompile failed: " + (r == null ? "null" : r.getErrorMessage()));
					failed++;
				}
			}
		}
		ifc.dispose();
		println("Decompiled " + done + " functions, " + failed + " failed -> " + out);
	}
}
