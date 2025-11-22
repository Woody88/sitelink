import { $ } from 'bun'
import { watch } from "node:fs";


const dir = `${import.meta.dir}/tests/fixtures/tmp`

const watcher = watch(import.meta.dir, { recursive: true }, (event, relativePath) => {
  console.log(`Detected ${event} in ${relativePath}`);
});

await $`vips dzsave ${import.meta.dir}/tests/fixtures/sample-plan-2.pdf[page=0,dpi=150] ${dir} --tile-size 254 --overlap 1 --depth onetile --suffix .jpg[Q=85]`

await Bun.sleep(3000)

process.on("SIGINT", () => {
  // close watcher when Ctrl-C is pressed
  console.log("Closing watcher...");
  watcher.close();

  process.exit(0);
});