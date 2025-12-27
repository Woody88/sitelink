import { $ } from 'bun'
import { watch } from "node:fs";


const dir = `${import.meta.dir}/tests/fixtures/tmp`

const watcher = watch(import.meta.dir, { recursive: true }, (event, relativePath) => {
  console.log(`Detected ${event} in ${relativePath}`);
});


await Bun.sleep(3000)

process.on("SIGINT", () => {
  // close watcher when Ctrl-C is pressed
  console.log("Closing watcher...");
  watcher.close();

  process.exit(0);
});