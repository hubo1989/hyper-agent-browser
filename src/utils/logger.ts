export function log(message: string, verbose = false) {
  if (verbose) {
    console.log(`[HBA] ${message}`);
  }
}

export function error(message: string, hint?: string) {
  console.error(`Error: ${message}`);
  if (hint) {
    console.error(`  Hint: ${hint}`);
  }
}
